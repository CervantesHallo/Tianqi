import { setTimeout as scheduleTimer } from "node:timers";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterFoundation } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

import type {
  CircuitBreakerState,
  ExternalEngineContractProbe
} from "./external-engine-contract-probe.js";

// TestkitExternalEngineFoundation — minimum public surface a contract-testable External
// Engine Adapter must expose. This abstraction is testkit-owned because, per Step 13's
// design-decision #1 (docs §C), Phase 1-7 did NOT pre-define a common ExternalEnginePort
// base interface: the five business Engine Ports (Margin / Position / Match / MarkPrice
// / Fund) shipped in later Steps will each define their own business methods, but they
// ALL have to satisfy this stability-focused testkit foundation.
//
// The contract suite deliberately exercises a single generic `call()` method rather
// than any business-specific signature. Five-pack stability (timeout / retry / circuit /
// rate limit / trace propagation) is orthogonal to what the call actually means — an
// Adapter that implements both this foundation and, say, a MarginEnginePort still gets
// its stability contracts validated via the same set of it-blocks.

export type ExternalEngineRequest = {
  readonly operation: string;
  readonly payload?: unknown;
};

export type ExternalEngineSuccess = {
  readonly payload: unknown;
};

// TQ-INF-* code literal union — narrow at type level so misuse is caught at compile
// time. Every adapter-returned error MUST carry one of these codes; §6.5 discipline
// requires domain monikers in the context payload (no raw HTTP statuses / socket error
// strings) but the code namespace itself is fixed.
export type ExternalEngineErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017";

export type ExternalEngineError = {
  readonly code: ExternalEngineErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

export type TestkitExternalEngineFoundation = {
  readonly adapterName: string;
  call(
    request: ExternalEngineRequest,
    traceId?: TraceId
  ): Promise<Result<ExternalEngineSuccess, ExternalEngineError>>;
};

export type ExternalEngineAdapterUnderTest = TestkitExternalEngineFoundation &
  AdapterFoundation &
  ExternalEngineContractProbe;

export type ExternalEngineAdapterFactory<
  T extends ExternalEngineAdapterUnderTest = ExternalEngineAdapterUnderTest
> = () => T | Promise<T>;

// Fault-injection callbacks. Each mount point (self-test / future Step 14 HTTP base)
// wires these up against its own Adapter — the testkit suite never reaches into the
// Adapter's internals directly. Rationale for the "option β" shape (docs §C.2): mirrors
// Step 12's persistent-config options; avoids putting write methods on the probe
// (META-RULE M); stays decoupled from any particular fault-injection strategy.
export type ExternalEngineContractOptions = {
  // Causes the NEXT call() to trigger a simulated timeout path. The adapter should
  // surface it as a TQ-INF-013 failure. Injection is consumed after one call.
  readonly injectTimeout: (adapter: ExternalEngineAdapterUnderTest) => void;
  // Causes the NEXT call() to fail with the given domain category. `retryable` tells
  // the adapter whether the failure should be swallowed-and-retried (→ TQ-INF-014 on
  // retry exhaustion) or surfaced immediately (→ TQ-INF-017).
  readonly injectError: (
    adapter: ExternalEngineAdapterUnderTest,
    downstreamCategory: string,
    retryable: boolean
  ) => void;
  // Delays the NEXT call() by `delayMs` before returning a success. Used to exercise
  // concurrent-call accounting and to probe concurrency-cap enforcement.
  readonly injectSlowResponse: (adapter: ExternalEngineAdapterUnderTest, delayMs: number) => void;
  // Arms the next call so the first N attempts fail with a retryable error and the
  // (N+1)-th succeeds. Exercises the retry-budget + backoff path end-to-end.
  readonly injectSuccessAfterFailures: (
    adapter: ExternalEngineAdapterUnderTest,
    failureCount: number
  ) => void;
  // Clears any armed injections. Called between tests; safe to invoke when nothing is
  // armed (no-op). The contract suite uses this to isolate its from each other.
  readonly resetInjections: (adapter: ExternalEngineAdapterUnderTest) => void;
};

// -- Helpers ---------------------------------------------------------------------------

const expectErr = (
  result: Result<ExternalEngineSuccess, ExternalEngineError>,
  expectedCode: ExternalEngineErrorCode
): ExternalEngineError => {
  if (result.ok) {
    throw new Error(`expected error ${expectedCode}, got ok: ${JSON.stringify(result.value)}`);
  }
  expect(result.error.code).toBe(expectedCode);
  return result.error;
};

const delayMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(resolve, ms);
  });

// waitForCircuitState polls the probe for up to `budgetMs` looking for the target
// state. Needed because the circuit-breaker contract asserts state transitions after
// resetTimeout elapses — polling is more robust against CI timing jitter than a single
// bet on a fixed delay.
const waitForCircuitState = async (
  probe: ExternalEngineContractProbe,
  target: CircuitBreakerState,
  budgetMs = 500,
  stepMs = 10
): Promise<boolean> => {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (probe.getCircuitBreakerState() === target) return true;
    await delayMs(stepMs);
  }
  return probe.getCircuitBreakerState() === target;
};

// -- Contract suite --------------------------------------------------------------------

export const defineExternalEngineContractTests = <
  T extends ExternalEngineAdapterUnderTest = ExternalEngineAdapterUnderTest
>(
  adapterName: string,
  factory: ExternalEngineAdapterFactory<T>,
  options: ExternalEngineContractOptions
): void => {
  describe(`[adapter-testkit] External Engine contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      options.resetInjections(adapter);
      await adapter.shutdown();
    });

    describe("category 1: timeout (§6.1 five-pack member)", () => {
      it("test_timeout_injection_rejects_with_tq_inf_013_and_phase_context", async () => {
        options.injectTimeout(adapter);
        const result = await adapter.call({ operation: "lookup" });
        const error = expectErr(result, "TQ-INF-013");
        // Domain moniker, not a raw socket error — §6.5 discipline.
        expect(typeof error.context["timeoutPhase"]).toBe("string");
        expect(["connect", "request", "total"]).toContain(error.context["timeoutPhase"]);
      });

      it("test_timeout_error_context_includes_budget_and_elapsed_milliseconds", async () => {
        // Operators reading logs must see "we waited X against budget Y" without having
        // to correlate against config files. The numbers must be present and non-negative.
        options.injectTimeout(adapter);
        const result = await adapter.call({ operation: "lookup" });
        const error = expectErr(result, "TQ-INF-013");
        expect(typeof error.context["timeoutMs"]).toBe("number");
        expect(typeof error.context["elapsedMs"]).toBe("number");
        expect(error.context["timeoutMs"]).toBeGreaterThan(0);
        expect(error.context["elapsedMs"]).toBeGreaterThanOrEqual(0);
      });

      it("test_timeout_error_does_not_leak_raw_socket_or_http_details", async () => {
        // §6.5: the error context MUST NOT carry stack traces, HTTP status codes,
        // or socket-class error names. A soft regex guard catches regressions.
        options.injectTimeout(adapter);
        const result = await adapter.call({ operation: "lookup" });
        const error = expectErr(result, "TQ-INF-013");
        const serialised = JSON.stringify(error);
        expect(serialised).not.toMatch(/ECONNRESET|EPIPE|ETIMEDOUT|AggregateError/);
        expect(serialised).not.toMatch(/\b[45]\d\d\b/); // no raw HTTP status
      });

      it("test_successful_call_after_timeout_injection_reset_succeeds_cleanly", async () => {
        // Timeout injection is one-shot and must not poison subsequent calls. This
        // guards against a regression where "injectTimeout" accidentally sets a
        // permanent flag.
        options.injectTimeout(adapter);
        await adapter.call({ operation: "lookup" });
        const second = await adapter.call({ operation: "lookup" });
        expect(second.ok).toBe(true);
      });
    });

    describe("category 2: retry (§6.1 + §6.2 + §6.3)", () => {
      it("test_retryable_failures_recover_within_retry_budget_and_return_success", async () => {
        // With 2 injected retryable failures and default maxRetries≥2, the third
        // attempt succeeds. This proves the retry loop actually re-invokes the call.
        options.injectSuccessAfterFailures(adapter, 2);
        const result = await adapter.call({ operation: "lookup" });
        expect(result.ok).toBe(true);
        const stats = adapter.getRetryStats();
        expect(stats.maxSeen).toBeGreaterThanOrEqual(2);
      });

      it("test_non_retryable_error_returns_tq_inf_017_immediately_without_retry", async () => {
        // §6.3 "不可重试透出": the adapter classifies and surfaces non-retryable
        // errors on the first attempt without burning retry budget.
        options.injectError(adapter, "permission_denied", false);
        const before = adapter.getRetryStats().attempts;
        const result = await adapter.call({ operation: "lookup" });
        expectErr(result, "TQ-INF-017");
        const after = adapter.getRetryStats().attempts;
        // Exactly one attempt — no retry followed.
        expect(after - before).toBe(1);
      });

      it("test_retry_intervals_follow_backoff_so_total_elapsed_exceeds_base_interval", async () => {
        // Can't assert exact timing portably; instead assert that two injected
        // retryable failures produce measurable elapsed time greater than the
        // immediate-return case. This proves a backoff actually took place.
        options.injectSuccessAfterFailures(adapter, 2);
        const started = Date.now();
        const result = await adapter.call({ operation: "lookup" });
        const elapsed = Date.now() - started;
        expect(result.ok).toBe(true);
        // Two backoff intervals, base 10ms each (reference config) — total must be
        // measurably > 0. CI jitter makes a tighter bound fragile.
        expect(elapsed).toBeGreaterThanOrEqual(5);
      });

      it("test_retry_budget_exhausted_returns_tq_inf_014_with_domain_category_context", async () => {
        // Arm MORE failures than the retry budget so every attempt fails and the
        // adapter gives up with TQ-INF-014. Context must include the attempt count
        // and a domain-level finalFailureCategory (NOT a raw downstream error).
        options.injectSuccessAfterFailures(adapter, 100);
        const result = await adapter.call({ operation: "lookup" });
        const error = expectErr(result, "TQ-INF-014");
        expect(typeof error.context["attempts"]).toBe("number");
        expect(typeof error.context["maxRetries"]).toBe("number");
        expect(typeof error.context["finalFailureCategory"]).toBe("string");
        expect(String(error.context["finalFailureCategory"])).not.toMatch(/^\d\d\d$/);
      });
    });

    describe("category 3: circuit breaker (§6.1 + §6.4 熔断可观测)", () => {
      it("test_consecutive_failures_reaching_threshold_open_the_circuit", async () => {
        // Repeatedly inject non-retryable failures until the breaker trips. The exact
        // threshold is adapter-configured; contract asserts the observable transition.
        for (let i = 0; i < 10; i += 1) {
          options.injectError(adapter, "downstream_unavailable", false);
          await adapter.call({ operation: "lookup" });
          if (adapter.getCircuitBreakerState() === "open") break;
        }
        expect(adapter.getCircuitBreakerState()).toBe("open");
      });

      it("test_open_circuit_rejects_calls_with_tq_inf_015_without_invoking_downstream", async () => {
        // After tripping the breaker, the next call must short-circuit — it must NOT
        // consume an injected fault, proving no downstream invocation happened.
        for (let i = 0; i < 10; i += 1) {
          options.injectError(adapter, "downstream_unavailable", false);
          await adapter.call({ operation: "lookup" });
          if (adapter.getCircuitBreakerState() === "open") break;
        }
        expect(adapter.getCircuitBreakerState()).toBe("open");
        options.injectSuccessAfterFailures(adapter, 0); // arm a success
        const result = await adapter.call({ operation: "lookup" });
        const error = expectErr(result, "TQ-INF-015");
        expect(typeof error.context["openedAt"]).toBe("string");
      });

      it("test_open_circuit_transitions_to_half_open_after_reset_timeout_elapses", async () => {
        for (let i = 0; i < 10; i += 1) {
          options.injectError(adapter, "downstream_unavailable", false);
          await adapter.call({ operation: "lookup" });
          if (adapter.getCircuitBreakerState() === "open") break;
        }
        expect(adapter.getCircuitBreakerState()).toBe("open");
        // Wait beyond reset timeout; reference config is 100ms, give 500ms budget.
        const reached = await waitForCircuitState(adapter, "half-open");
        expect(reached).toBe(true);
        expect(adapter.getLastCircuitTransitionAt()).not.toBeNull();
      });

      it("test_half_open_success_closes_circuit_and_resets_failure_counter", async () => {
        // Trip → wait to half-open → next call succeeds → breaker closes.
        for (let i = 0; i < 10; i += 1) {
          options.injectError(adapter, "downstream_unavailable", false);
          await adapter.call({ operation: "lookup" });
          if (adapter.getCircuitBreakerState() === "open") break;
        }
        await waitForCircuitState(adapter, "half-open");
        const result = await adapter.call({ operation: "lookup" });
        expect(result.ok).toBe(true);
        expect(adapter.getCircuitBreakerState()).toBe("closed");
      });
    });

    describe("category 4: rate limit (§6.1 member)", () => {
      it("test_concurrent_calls_exceeding_cap_reject_with_tq_inf_016", async () => {
        // Fire more concurrent slow calls than the cap allows. The overflow calls
        // must reject with TQ-INF-016; the context carries currentConcurrency and
        // cap so operators can decide whether to lift the cap.
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        options.injectSlowResponse(adapter, 100);
        const fireSixAtOnce = Array.from({ length: 7 }, () =>
          adapter.call({ operation: "lookup" })
        );
        const settled = await Promise.all(fireSixAtOnce);
        const rateLimited = settled.filter(
          (result) => !result.ok && result.error.code === "TQ-INF-016"
        );
        expect(rateLimited.length).toBeGreaterThan(0);
        const firstLimited = rateLimited[0];
        if (firstLimited !== undefined && !firstLimited.ok) {
          expect(typeof firstLimited.error.context["currentConcurrency"]).toBe("number");
          expect(typeof firstLimited.error.context["cap"]).toBe("number");
        }
      });

      it("test_sequential_calls_below_cap_never_rate_limit", async () => {
        // Five sequential calls (never concurrent) must never hit the rate limit,
        // regardless of the cap. Confirms the limiter uses concurrency and not a
        // total-call budget.
        for (let i = 0; i < 5; i += 1) {
          const result = await adapter.call({ operation: "lookup" });
          expect(result.ok).toBe(true);
        }
      });

      it("test_probe_exposes_current_and_peak_concurrency_accurately", async () => {
        // At rest, currentConcurrency is 0. A single call raises peak to >= 1
        // for the duration of its in-flight window.
        expect(adapter.getCurrentConcurrency()).toBe(0);
        options.injectSlowResponse(adapter, 50);
        const pending = adapter.call({ operation: "lookup" });
        // Give the call a chance to enter the in-flight set.
        await delayMs(10);
        expect(adapter.getCurrentConcurrency()).toBeGreaterThanOrEqual(1);
        await pending;
        expect(adapter.getCurrentConcurrency()).toBe(0);
        expect(adapter.getPeakConcurrency()).toBeGreaterThanOrEqual(1);
      });
    });

    describe("category 5: trace propagation (§6.1 member)", () => {
      it("test_trace_id_passed_to_call_is_observable_through_probe", async () => {
        const trace = createTraceId("trace-contract-1");
        await adapter.call({ operation: "lookup" }, trace);
        expect(adapter.getLastTraceId()).toBe(trace);
      });

      it("test_call_without_trace_id_produces_defined_probe_state", async () => {
        // Contract permits either a null or a generated default — the Adapter
        // chooses. The assertion is that the state is well-defined (not undefined),
        // so log-scraping pipelines can always serialize it.
        await adapter.call({ operation: "lookup" });
        const observed = adapter.getLastTraceId();
        expect(observed === null || typeof observed === "string").toBe(true);
      });

      it("test_distinct_calls_update_trace_id_independently", async () => {
        // Trace IDs are per-call, not sticky. The second call's trace must replace
        // the first, proving the adapter is not mutating a shared mutable state.
        const first = createTraceId("trace-contract-first");
        const second = createTraceId("trace-contract-second");
        await adapter.call({ operation: "lookup" }, first);
        expect(adapter.getLastTraceId()).toBe(first);
        await adapter.call({ operation: "lookup" }, second);
        expect(adapter.getLastTraceId()).toBe(second);
      });
    });

    describe("category 6: AdapterFoundation integration", () => {
      it("test_call_before_init_rejects_with_tq_inf_003", async () => {
        const fresh = await factory();
        const result = await fresh.call({ operation: "lookup" });
        expectErr(result, "TQ-INF-003");
      });

      it("test_call_after_shutdown_rejects_with_tq_inf_004", async () => {
        const fresh = await factory();
        await fresh.init();
        await fresh.shutdown();
        const result = await fresh.call({ operation: "lookup" });
        expectErr(result, "TQ-INF-004");
      });

      it("test_health_check_reports_healthy_false_when_circuit_is_open", async () => {
        // Step 13 §C decision: open circuit = healthy: false. The operator dashboard
        // must reflect the actual refusal-to-serve state of the adapter.
        const healthyAtRest = await adapter.healthCheck();
        expect(healthyAtRest.healthy).toBe(true);
        for (let i = 0; i < 10; i += 1) {
          options.injectError(adapter, "downstream_unavailable", false);
          await adapter.call({ operation: "lookup" });
          if (adapter.getCircuitBreakerState() === "open") break;
        }
        const healthyWhenOpen = await adapter.healthCheck();
        expect(healthyWhenOpen.healthy).toBe(false);
        expect(typeof healthyWhenOpen.details["circuitBreakerState"]).toBe("string");
        expect(typeof healthyWhenOpen.details["currentConcurrency"]).toBe("number");
        expect(typeof healthyWhenOpen.details["lastError"]).toBe("string");
      });
    });
  });
};
