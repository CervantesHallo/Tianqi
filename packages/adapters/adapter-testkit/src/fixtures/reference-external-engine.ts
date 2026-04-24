import { setTimeout as scheduleTimer } from "node:timers";

import type { AdapterHealthStatus } from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

import type {
  ExternalEngineAdapterUnderTest,
  ExternalEngineError,
  ExternalEngineRequest,
  ExternalEngineSuccess
} from "../external-engine-contract.js";
import type {
  CircuitBreakerState,
  ExternalEngineRetryStats
} from "../external-engine-contract-probe.js";

// ReferenceExternalEngine — internal fixture used only by the adapter-testkit's own
// self-test of defineExternalEngineContractTests. It implements every member of the
// five-pack (timeout / retry / circuit breaker / rate limit / trace propagation) with
// REAL behavior, not stubs: retry actually loops and sleeps, circuit breaker actually
// maintains state and transitions, rate limit actually rejects overflow concurrent
// calls. This is mandatory per Step 13 §10 "禁止让契约在参考实现上假装通过".
//
// META-RULE F applies strictly: this fixture is NOT exported from src/index.ts and
// NOT listed in the package's "exports" field. The only consumer is the self-test
// driver at src/external-engine-contract.test.ts. Any future real adapter
// (Step 14's external-engine-http-base and the business engines that follow) MUST
// re-implement the five-pack independently; copy-pasting this file is forbidden.

// -- Types exposed back to the self-test so it can wire up ExternalEngineContractOptions.

export type ReferenceExternalEngineInjector = {
  readonly timeoutNext: () => void;
  readonly errorNext: (downstreamCategory: string, retryable: boolean) => void;
  readonly slowNext: (delayMs: number) => void;
  readonly successAfterFailures: (failureCount: number) => void;
  readonly reset: () => void;
};

export type ReferenceExternalEngine = ExternalEngineAdapterUnderTest & {
  // Exposed only so the self-test can wire the `options` callbacks to these
  // fault-injection methods. A real adapter would not expose this surface.
  readonly __referenceInjector: ReferenceExternalEngineInjector;
};

export type ReferenceExternalEngineOptions = Readonly<{
  readonly maxRetries?: number;
  readonly baseBackoffMs?: number;
  readonly totalTimeoutMs?: number;
  readonly concurrencyCap?: number;
  readonly circuitThreshold?: number;
  readonly resetTimeoutMs?: number;
  readonly adapterName?: string;
}>;

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 10;
const DEFAULT_TOTAL_TIMEOUT_MS = 200;
const DEFAULT_CONCURRENCY_CAP = 5;
const DEFAULT_CIRCUIT_THRESHOLD = 3;
const DEFAULT_RESET_TIMEOUT_MS = 100;

type LifecycleState = "created" | "running" | "shut_down";

type Injection =
  | { readonly kind: "timeout" }
  | { readonly kind: "error"; readonly category: string; readonly retryable: boolean }
  | { readonly kind: "slow"; readonly delayMs: number }
  | { readonly kind: "success_after_failures"; remainingFailures: number };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(resolve, ms);
  });

const buildPortError = (
  code: "TQ-INF-003" | "TQ-INF-004",
  adapterName: string,
  action: string
): ExternalEngineError => ({
  code,
  message: `${code}: ${action}`,
  context: { adapterName }
});

export const createReferenceExternalEngine = (
  options: ReferenceExternalEngineOptions = {}
): ReferenceExternalEngine => {
  const adapterName = options.adapterName ?? "reference-external-engine";
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  const concurrencyCap = options.concurrencyCap ?? DEFAULT_CONCURRENCY_CAP;
  const circuitThreshold = options.circuitThreshold ?? DEFAULT_CIRCUIT_THRESHOLD;
  const resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;

  let lifecycle: LifecycleState = "created";

  // Circuit-breaker state machine — see §6.4 熔断可观测. Every transition updates both
  // the state slot and lastTransitionAt ISO timestamp so operator dashboards can
  // render "when did the breaker move" without guessing.
  let circuitState: CircuitBreakerState = "closed";
  let circuitOpenedAt: Date | null = null;
  let consecutiveFailures = 0;
  let lastTransitionAt: string | null = null;

  let currentConcurrency = 0;
  let peakConcurrency = 0;

  // Queue of armed one-shot injections. call() consumes head-of-queue per attempt
  // inside the retry loop. A queue (rather than a single slot) is necessary so the
  // retry tests can arm "fail 2, succeed on 3rd".
  const injectionQueue: Injection[] = [];

  let totalRetryAttempts = 0;
  let maxSeenAttempts = 0;
  let lastTraceId: TraceId | null = null;
  let lastError: string | null = null;

  const recordTransition = (toState: CircuitBreakerState): void => {
    circuitState = toState;
    lastTransitionAt = new Date().toISOString();
  };

  const markCircuitFailure = (): void => {
    consecutiveFailures += 1;
    if (consecutiveFailures >= circuitThreshold && circuitState !== "open") {
      circuitOpenedAt = new Date();
      recordTransition("open");
    } else if (circuitState === "half-open") {
      // Half-open test call failed → reopen with fresh openedAt.
      circuitOpenedAt = new Date();
      recordTransition("open");
    }
  };

  const markCircuitSuccess = (): void => {
    consecutiveFailures = 0;
    if (circuitState !== "closed") {
      circuitOpenedAt = null;
      recordTransition("closed");
    }
  };

  // Called at the top of every call(), BEFORE we decide whether to refuse. Migrates
  // a stale-open breaker into half-open once the reset timeout has elapsed.
  const maybeTransitionToHalfOpen = (): void => {
    if (circuitState !== "open" || circuitOpenedAt === null) return;
    const elapsed = Date.now() - circuitOpenedAt.getTime();
    if (elapsed >= resetTimeoutMs) {
      recordTransition("half-open");
    }
  };

  const exponentialBackoffMs = (attemptIndex: number): number => {
    const capped = Math.min(baseBackoffMs * 2 ** attemptIndex, baseBackoffMs * 10);
    return capped;
  };

  const runAttempt = async (): Promise<
    | { readonly kind: "success" }
    | { readonly kind: "retryable_failure"; readonly category: string }
    | { readonly kind: "non_retryable_failure"; readonly category: string }
    | { readonly kind: "timeout" }
  > => {
    const injection = injectionQueue.shift();
    if (injection === undefined) {
      return { kind: "success" };
    }
    switch (injection.kind) {
      case "timeout":
        return { kind: "timeout" };
      case "error":
        return injection.retryable
          ? { kind: "retryable_failure", category: injection.category }
          : { kind: "non_retryable_failure", category: injection.category };
      case "slow": {
        // If the injected delay exceeds the total timeout, surface it as a timeout;
        // otherwise honor the delay and return success. Ensures the "slow response"
        // injection doubles as a stress test for concurrency accounting.
        if (injection.delayMs > totalTimeoutMs) {
          await sleep(totalTimeoutMs);
          return { kind: "timeout" };
        }
        await sleep(injection.delayMs);
        return { kind: "success" };
      }
      case "success_after_failures": {
        if (injection.remainingFailures > 0) {
          // Decrement in-place and put the injection back at the head so the next
          // attempt picks it up. This is how we model "fail 2 times, then succeed".
          const updated: Injection = {
            kind: "success_after_failures",
            remainingFailures: injection.remainingFailures - 1
          };
          injectionQueue.unshift(updated);
          return { kind: "retryable_failure", category: "transient_conflict" };
        }
        return { kind: "success" };
      }
    }
  };

  const call = async (
    _request: ExternalEngineRequest,
    traceId?: TraceId
  ): Promise<Result<ExternalEngineSuccess, ExternalEngineError>> => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (lifecycle === "shut_down") {
      return err(buildPortError("TQ-INF-004", adapterName, "call called after shutdown"));
    }
    if (lifecycle === "created") {
      return err(buildPortError("TQ-INF-003", adapterName, "call called before init"));
    }

    lastTraceId = traceId ?? null;

    maybeTransitionToHalfOpen();

    if (circuitState === "open") {
      const openedAt = (circuitOpenedAt ?? new Date()).toISOString();
      lastError = `TQ-INF-015: circuit open since ${openedAt}`;
      return err({
        code: "TQ-INF-015",
        message: `TQ-INF-015: circuit open, refusing call (since ${openedAt})`,
        context: {
          adapterName,
          openedAt,
          consecutiveFailures
        }
      });
    }

    if (currentConcurrency >= concurrencyCap) {
      lastError = `TQ-INF-016: rate limited at ${currentConcurrency}/${concurrencyCap}`;
      return err({
        code: "TQ-INF-016",
        message: `TQ-INF-016: rate limited, concurrency ${currentConcurrency}/${concurrencyCap}`,
        context: {
          adapterName,
          currentConcurrency,
          cap: concurrencyCap
        }
      });
    }

    currentConcurrency += 1;
    if (currentConcurrency > peakConcurrency) peakConcurrency = currentConcurrency;

    try {
      let attempts = 0;
      let lastRetryableCategory = "downstream_unavailable";

      // Retry loop: one initial attempt + up to maxRetries additional. Each attempt
      // consumes one injection from the queue (or returns immediate success if the
      // queue is empty). Backoff is exponential with a cap.
      while (attempts < maxRetries + 1) {
        attempts += 1;
        totalRetryAttempts += 1;

        const outcome = await runAttempt();

        if (outcome.kind === "success") {
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          markCircuitSuccess();
          lastError = null;
          return ok({ payload: { ok: true } });
        }

        if (outcome.kind === "timeout") {
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          markCircuitFailure();
          lastError = "TQ-INF-013: timeout";
          return err({
            code: "TQ-INF-013",
            message: "TQ-INF-013: call timed out",
            context: {
              adapterName,
              timeoutPhase: "total",
              timeoutMs: totalTimeoutMs,
              elapsedMs: totalTimeoutMs
            }
          });
        }

        if (outcome.kind === "non_retryable_failure") {
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          markCircuitFailure();
          lastError = `TQ-INF-017: ${outcome.category}`;
          return err({
            code: "TQ-INF-017",
            message: `TQ-INF-017: downstream returned non-retryable ${outcome.category}`,
            context: {
              adapterName,
              downstreamCategory: outcome.category,
              reason: `reference-engine classified ${outcome.category} as non-retryable`
            }
          });
        }

        // retryable_failure — sleep backoff and loop (unless we're out of budget).
        lastRetryableCategory = outcome.category;
        if (attempts < maxRetries + 1) {
          await sleep(exponentialBackoffMs(attempts - 1));
        }
      }

      maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
      markCircuitFailure();
      lastError = `TQ-INF-014: retries exhausted after ${attempts} attempts`;
      return err({
        code: "TQ-INF-014",
        message: `TQ-INF-014: retries exhausted after ${attempts} attempts`,
        context: {
          adapterName,
          attempts,
          maxRetries,
          finalFailureCategory: lastRetryableCategory
        }
      });
    } finally {
      currentConcurrency -= 1;
    }
  };

  const init = async (): Promise<void> => {
    if (lifecycle === "running") return;
    if (lifecycle === "shut_down") return;
    lifecycle = "running";
  };

  const shutdown = async (): Promise<void> => {
    lifecycle = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName,
    // Step 13 §C decision: "open" → healthy: false. The adapter is actively refusing
    // calls; reporting healthy: true would mislead operator dashboards. Half-open =
    // probe phase, treat as not-yet-healthy too. Only closed + running = healthy.
    healthy: lifecycle === "running" && circuitState === "closed",
    details: {
      lifecycle,
      circuitBreakerState: circuitState,
      currentConcurrency,
      peakConcurrency,
      consecutiveFailures,
      maxRetries,
      lastError: lastError ?? "none",
      lastTransitionAt: lastTransitionAt ?? "none",
      lastTraceId: lastTraceId ?? "none",
      concurrencyCap,
      circuitThreshold,
      resetTimeoutMs,
      totalTimeoutMs
    },
    checkedAt: new Date().toISOString()
  });

  const getCircuitBreakerState = (): CircuitBreakerState => {
    // Re-check transition eligibility on every probe read. Without this, an idle
    // Adapter that tripped open but never received another call would keep reporting
    // "open" indefinitely — callers observing the probe should see the half-open
    // transition materialise as soon as the reset timeout elapses.
    maybeTransitionToHalfOpen();
    return circuitState;
  };

  const getCurrentConcurrency = (): number => currentConcurrency;
  const getPeakConcurrency = (): number => peakConcurrency;
  const getLastTraceId = (): TraceId | null => lastTraceId;
  const getRetryStats = (): ExternalEngineRetryStats => ({
    attempts: totalRetryAttempts,
    maxSeen: maxSeenAttempts
  });
  const getLastCircuitTransitionAt = (): string | null => lastTransitionAt;

  const injector: ReferenceExternalEngineInjector = {
    timeoutNext: () => {
      injectionQueue.push({ kind: "timeout" });
    },
    errorNext: (category, retryable) => {
      injectionQueue.push({ kind: "error", category, retryable });
    },
    slowNext: (delay) => {
      injectionQueue.push({ kind: "slow", delayMs: delay });
    },
    successAfterFailures: (failureCount) => {
      injectionQueue.push({
        kind: "success_after_failures",
        remainingFailures: failureCount
      });
    },
    reset: () => {
      injectionQueue.length = 0;
    }
  };

  return {
    adapterName,
    __externalEngineProbe: true,
    call,
    init,
    shutdown,
    healthCheck,
    getCircuitBreakerState,
    getCurrentConcurrency,
    getPeakConcurrency,
    getLastTraceId,
    getRetryStats,
    getLastCircuitTransitionAt,
    __referenceInjector: injector
  };
};
