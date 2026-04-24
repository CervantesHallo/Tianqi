import { setTimeout as scheduleTimer, clearTimeout as clearScheduledTimer } from "node:timers";

import { Pool, errors as undiciErrors } from "undici";

import type { AdapterHealthStatus } from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// Local-only structural types mirroring @tianqi/adapter-testkit contract surfaces.
// META-RULE F: the production code of this base adapter MUST NOT import from
// @tianqi/adapter-testkit — the testkit is a devDependency only. The shapes below
// are structurally compatible with TestkitExternalEngineFoundation and
// ExternalEngineContractProbe without depending on them at runtime.

// HttpBaseCallRequest — the public `call()` parameter shape. Structurally compatible
// with the testkit's ExternalEngineRequest ({ operation, payload? }) so the Step 13
// contract suite drops in without adapter-side translation. Business engines (Step
// 15-18) can supply optional method / headers overrides to tune the outbound HTTP.
//
// Default interpretation:
//   method = "POST"            — external engines are RPC-shaped, POST is the default
//   path   = `/${operation}`   — operation becomes the last segment of the URL path
//   body   = JSON.stringify(payload) when payload is defined, otherwise null
//   content-type = "application/json" when body is populated
export type HttpBaseCallRequest = {
  readonly operation: string;
  readonly payload?: unknown;
  readonly method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  readonly headers?: Record<string, string>;
};

export type HttpCallResponse = {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
};

export type HttpBaseEngineErrorCode =
  | "TQ-INF-003"
  | "TQ-INF-004"
  | "TQ-INF-013"
  | "TQ-INF-014"
  | "TQ-INF-015"
  | "TQ-INF-016"
  | "TQ-INF-017"
  | "TQ-INF-018";

export type HttpBaseEngineError = {
  readonly code: HttpBaseEngineErrorCode;
  readonly message: string;
  readonly context: Readonly<Record<string, unknown>>;
};

type CircuitBreakerState = "closed" | "open" | "half-open";

type ExternalEngineRetryStats = {
  readonly attempts: number;
  readonly maxSeen: number;
};

export type HttpBaseEngineOptions = {
  readonly baseUrl: string;
  readonly timeouts?: {
    readonly connectMs?: number;
    readonly requestMs?: number;
    readonly totalMs?: number;
  };
  readonly retry?: {
    readonly maxAttempts?: number;
    readonly baseDelayMs?: number;
    readonly maxDelayMs?: number;
  };
  readonly circuitBreaker?: {
    readonly threshold?: number;
    readonly resetTimeoutMs?: number;
  };
  readonly rateLimit?: {
    readonly maxConcurrency?: number;
  };
  readonly traceHeaderName?: string;
  readonly healthCheckTimeoutMs?: number;
  readonly healthCheckPath?: string;
  readonly adapterName?: string;
};

export type HttpBaseEngineAdapter = {
  readonly adapterName: string;
  readonly __externalEngineProbe: true;
  init(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<AdapterHealthStatus>;
  call(
    request: HttpBaseCallRequest,
    traceId?: TraceId
  ): Promise<Result<HttpCallResponse, HttpBaseEngineError>>;
  getCircuitBreakerState(): CircuitBreakerState;
  getCurrentConcurrency(): number;
  getPeakConcurrency(): number;
  getLastTraceId(): TraceId | null;
  getRetryStats(): ExternalEngineRetryStats;
  getLastCircuitTransitionAt(): string | null;
};

// -- Defaults -------------------------------------------------------------------------
// These are intentionally permissive for production and tight for tests. Step 15-18
// business engines can override any field through their own options pass-through.

const DEFAULT_CONNECT_TIMEOUT_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ATTEMPTS = 4; // 1 initial + 3 retries
const DEFAULT_BASE_DELAY_MS = 50;
const DEFAULT_MAX_DELAY_MS = 1_000;
const DEFAULT_CIRCUIT_THRESHOLD = 3;
const DEFAULT_RESET_TIMEOUT_MS = 500;
const DEFAULT_MAX_CONCURRENCY = 10;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const DEFAULT_HEALTH_CHECK_PATH = "/";
const DEFAULT_TRACE_HEADER_NAME = "x-tianqi-trace-id";
const DEFAULT_ADAPTER_NAME = "external-engine-http-base";

type LifecycleState = "created" | "running" | "shut_down";

// Classification of HTTP / network outcomes into domain categories. The § 6.5
// discipline lives here: every branch produces a domain moniker and an explicit
// retryable flag, NEVER a raw HTTP status or a socket error class name in the
// surfaced error's context.
type HttpOutcomeClassification =
  | { readonly kind: "ok" }
  | { readonly kind: "retryable"; readonly category: string }
  | { readonly kind: "non_retryable"; readonly category: string; readonly reason: string };

type NetworkOutcomeClassification =
  | { readonly kind: "retryable"; readonly category: string }
  | { readonly kind: "timeout"; readonly phase: "connect" | "request" | "total" };

const classifyHttpStatus = (statusCode: number): HttpOutcomeClassification => {
  if (statusCode >= 200 && statusCode < 300) return { kind: "ok" };
  // Treat 408 and 429 as retryable — they indicate transient conditions.
  if (statusCode === 408 || statusCode === 429 || statusCode >= 500) {
    return { kind: "retryable", category: "downstream_unavailable" };
  }
  // Other 4xx are non-retryable business / contract errors.
  if (statusCode === 401) {
    return { kind: "non_retryable", category: "unauthenticated", reason: "authentication failed" };
  }
  if (statusCode === 403) {
    return {
      kind: "non_retryable",
      category: "permission_denied",
      reason: "downstream refused the operation"
    };
  }
  if (statusCode === 404) {
    return { kind: "non_retryable", category: "not_found", reason: "resource does not exist" };
  }
  if (statusCode === 409) {
    return { kind: "non_retryable", category: "conflict", reason: "state conflict at downstream" };
  }
  // 400, 410, 422, and any other 4xx → invalid request.
  return {
    kind: "non_retryable",
    category: "invalid_request",
    reason: "request rejected by downstream"
  };
};

// Translates undici / node network errors into classifications. The input error is
// inspected by `name` and `code`; NONE of those strings leak into the returned
// Classification — only the domain moniker survives.
const classifyNetworkError = (error: unknown): NetworkOutcomeClassification => {
  const candidate = error as { readonly name?: string; readonly code?: string };
  const name = candidate.name ?? "";
  const code = candidate.code ?? "";
  // undici-specific timeout symbols.
  if (code === "UND_ERR_CONNECT_TIMEOUT") return { kind: "timeout", phase: "connect" };
  if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
    return { kind: "timeout", phase: "request" };
  }
  if (name === "AbortError" || code === "ABORT_ERR") {
    // AbortController fired — this is our "total timeout" guard hitting.
    return { kind: "timeout", phase: "total" };
  }
  // Everything else (ECONNRESET / ECONNREFUSED / ENOTFOUND / EPIPE / socket errors
  // surfaced by undici) translates to a retryable "downstream_unavailable" —
  // transient network faults are safe to retry once the circuit breaker still
  // allows.
  return { kind: "retryable", category: "downstream_unavailable" };
};

// -- Circuit breaker (independent, hand-rolled — no third-party lib) --------------------

class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private consecutiveFailures = 0;
  private openedAt: Date | null = null;
  private lastTransitionAt: string | null = null;

  public constructor(
    private readonly threshold: number,
    private readonly resetTimeoutMs: number
  ) {}

  public getState(): CircuitBreakerState {
    this.reconsiderHalfOpen();
    return this.state;
  }

  public getOpenedAt(): Date | null {
    return this.openedAt;
  }

  public getConsecutiveFailures(): number {
    return this.consecutiveFailures;
  }

  public getLastTransitionAt(): string | null {
    return this.lastTransitionAt;
  }

  private recordTransition(to: CircuitBreakerState): void {
    this.state = to;
    this.lastTransitionAt = new Date().toISOString();
  }

  private reconsiderHalfOpen(): void {
    if (this.state !== "open" || this.openedAt === null) return;
    if (Date.now() - this.openedAt.getTime() >= this.resetTimeoutMs) {
      this.recordTransition("half-open");
    }
  }

  public onSuccess(): void {
    this.consecutiveFailures = 0;
    if (this.state !== "closed") {
      this.openedAt = null;
      this.recordTransition("closed");
    }
  }

  public onFailure(): void {
    this.consecutiveFailures += 1;
    if (this.state === "half-open") {
      this.openedAt = new Date();
      this.recordTransition("open");
      return;
    }
    if (this.consecutiveFailures >= this.threshold && this.state !== "open") {
      this.openedAt = new Date();
      this.recordTransition("open");
    }
  }
}

// -- Factory ---------------------------------------------------------------------------

export const createHttpBaseEngine = (options: HttpBaseEngineOptions): HttpBaseEngineAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error(`${DEFAULT_ADAPTER_NAME}: baseUrl is required`);
  }

  const baseUrl = options.baseUrl;
  const adapterName = options.adapterName ?? DEFAULT_ADAPTER_NAME;
  const connectTimeoutMs = options.timeouts?.connectMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  const requestTimeoutMs = options.timeouts?.requestMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const totalTimeoutMs = options.timeouts?.totalMs ?? DEFAULT_TOTAL_TIMEOUT_MS;
  const maxAttempts = options.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = options.retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const circuitThreshold = options.circuitBreaker?.threshold ?? DEFAULT_CIRCUIT_THRESHOLD;
  const resetTimeoutMs = options.circuitBreaker?.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
  const maxConcurrency = options.rateLimit?.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const healthCheckPath = options.healthCheckPath ?? DEFAULT_HEALTH_CHECK_PATH;
  const traceHeaderName = options.traceHeaderName ?? DEFAULT_TRACE_HEADER_NAME;

  let lifecycle: LifecycleState = "created";
  let pool: Pool | null = null;

  const circuit = new CircuitBreaker(circuitThreshold, resetTimeoutMs);
  let currentConcurrency = 0;
  let peakConcurrency = 0;
  let totalAttempts = 0;
  let maxSeenAttempts = 0;
  let lastTraceId: TraceId | null = null;
  let lastError: string | null = null;
  let lastSuccessAt: string | null = null;

  const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): HttpBaseEngineError => ({
    code,
    message: `${code}: ${action}`,
    context: { adapterName }
  });

  const backoffMs = (attemptIndex: number): number => {
    const exponent = Math.max(0, attemptIndex);
    return Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
  };

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      scheduleTimer(resolve, ms);
    });

  // Runs a single HTTP attempt against undici. The outer retry loop decides what to
  // do with the classification. Per-attempt concerns in this function: inject the
  // trace header, enforce the total-timeout AbortController, collect the body text,
  // translate errors.
  type AttemptOutcome =
    | { readonly kind: "success"; readonly response: HttpCallResponse }
    | { readonly kind: "retryable"; readonly category: string }
    | { readonly kind: "non_retryable"; readonly category: string; readonly reason: string }
    | { readonly kind: "timeout"; readonly phase: "connect" | "request" | "total" };

  // Normalises a HttpBaseCallRequest into the concrete HTTP-level shape. Kept as a
  // pure helper so Step 15-18 business engines can reason about the mapping by
  // reading this one function.
  const normaliseRequest = (
    request: HttpBaseCallRequest
  ): {
    readonly method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    readonly path: string;
    readonly headers: Record<string, string>;
    readonly body: string | null;
  } => {
    const method = request.method ?? "POST";
    const suffix = request.operation.startsWith("/") ? request.operation : `/${request.operation}`;
    const headers: Record<string, string> = { ...(request.headers ?? {}) };
    let body: string | null = null;
    if (request.payload !== undefined && request.payload !== null) {
      body = JSON.stringify(request.payload);
      headers["content-type"] = headers["content-type"] ?? "application/json";
    }
    return { method, path: suffix, headers, body };
  };

  const attemptOnce = async (
    request: HttpBaseCallRequest,
    traceId: TraceId | null
  ): Promise<AttemptOutcome> => {
    if (pool === null) {
      return { kind: "non_retryable", category: "invalid_request", reason: "pool uninitialised" };
    }

    const controller = new globalThis.AbortController();
    const totalTimer = scheduleTimer(() => {
      controller.abort();
    }, totalTimeoutMs);

    const normalised = normaliseRequest(request);
    const headers: Record<string, string> = { ...normalised.headers };
    if (traceId !== null) {
      headers[traceHeaderName] = String(traceId);
    }

    try {
      const requestOptions = {
        method: normalised.method,
        path: normalised.path,
        headers,
        body: normalised.body,
        signal: controller.signal,
        // undici honours these at the request level too; setting them here per-
        // request (rather than only at pool-level) lets Step 15-18 tune per-call if
        // needed without rebuilding the pool.
        headersTimeout: requestTimeoutMs,
        bodyTimeout: requestTimeoutMs
      };
      const response = await pool.request(requestOptions);

      const bodyText = await response.body.text();
      const normalisedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(response.headers)) {
        if (typeof value === "string") {
          normalisedHeaders[key] = value;
        } else if (Array.isArray(value)) {
          normalisedHeaders[key] = value.join(",");
        }
      }
      const classification = classifyHttpStatus(response.statusCode);
      if (classification.kind === "ok") {
        return {
          kind: "success",
          response: {
            statusCode: response.statusCode,
            headers: normalisedHeaders,
            body: bodyText
          }
        };
      }
      return classification;
    } catch (error) {
      return classifyNetworkError(error);
    } finally {
      clearScheduledTimer(totalTimer);
    }
  };

  const call = async (
    request: HttpBaseCallRequest,
    traceId?: TraceId
  ): Promise<Result<HttpCallResponse, HttpBaseEngineError>> => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (lifecycle === "shut_down") {
      return err(portError("TQ-INF-004", "call after shutdown"));
    }
    if (lifecycle === "created") {
      return err(portError("TQ-INF-003", "call before init"));
    }

    lastTraceId = traceId ?? null;

    // Circuit-breaker check runs BEFORE rate-limit so an open breaker never leaks
    // headroom to a rate-limited queue (which would hide the breaker trip from
    // operators watching concurrency metrics).
    const circuitSnapshotState = circuit.getState();
    if (circuitSnapshotState === "open") {
      const openedAt = (circuit.getOpenedAt() ?? new Date()).toISOString();
      lastError = `TQ-INF-015: circuit open since ${openedAt}`;
      return err({
        code: "TQ-INF-015",
        message: `TQ-INF-015: circuit open, refusing call (since ${openedAt})`,
        context: {
          adapterName,
          openedAt,
          consecutiveFailures: circuit.getConsecutiveFailures()
        }
      });
    }

    if (currentConcurrency >= maxConcurrency) {
      lastError = `TQ-INF-016: rate limited at ${currentConcurrency}/${maxConcurrency}`;
      return err({
        code: "TQ-INF-016",
        message: `TQ-INF-016: rate limited, concurrency ${currentConcurrency}/${maxConcurrency}`,
        context: {
          adapterName,
          currentConcurrency,
          cap: maxConcurrency
        }
      });
    }

    currentConcurrency += 1;
    if (currentConcurrency > peakConcurrency) peakConcurrency = currentConcurrency;

    try {
      let attempts = 0;
      let lastRetryableCategory = "downstream_unavailable";

      while (attempts < maxAttempts) {
        attempts += 1;
        totalAttempts += 1;

        const outcome = await attemptOnce(request, lastTraceId);

        if (outcome.kind === "success") {
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          circuit.onSuccess();
          lastError = null;
          lastSuccessAt = new Date().toISOString();
          return ok(outcome.response);
        }

        if (outcome.kind === "timeout") {
          // Timeouts surface immediately — retrying a timed-out downstream would
          // amplify cascading failure. Operators tune the timeout budget or the
          // downstream health; the retry budget is reserved for transient 5xx /
          // network flaps.
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          circuit.onFailure();
          lastError = `TQ-INF-013: timeout phase=${outcome.phase}`;
          return err({
            code: "TQ-INF-013",
            message: `TQ-INF-013: call timed out (phase=${outcome.phase})`,
            context: {
              adapterName,
              timeoutPhase: outcome.phase,
              timeoutMs:
                outcome.phase === "connect"
                  ? connectTimeoutMs
                  : outcome.phase === "request"
                    ? requestTimeoutMs
                    : totalTimeoutMs,
              elapsedMs:
                outcome.phase === "connect"
                  ? connectTimeoutMs
                  : outcome.phase === "request"
                    ? requestTimeoutMs
                    : totalTimeoutMs
            }
          });
        }

        if (outcome.kind === "non_retryable") {
          maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
          circuit.onFailure();
          lastError = `TQ-INF-017: ${outcome.category}`;
          return err({
            code: "TQ-INF-017",
            message: `TQ-INF-017: downstream returned non-retryable ${outcome.category}`,
            context: {
              adapterName,
              downstreamCategory: outcome.category,
              reason: outcome.reason
            }
          });
        }

        // retryable — sleep backoff and loop (unless budget exhausted).
        lastRetryableCategory = outcome.category;
        if (attempts < maxAttempts) {
          await sleep(backoffMs(attempts - 1));
        }
      }

      maxSeenAttempts = Math.max(maxSeenAttempts, attempts);
      circuit.onFailure();
      lastError = `TQ-INF-014: retries exhausted after ${attempts} attempts`;
      return err({
        code: "TQ-INF-014",
        message: `TQ-INF-014: retries exhausted after ${attempts} attempts`,
        context: {
          adapterName,
          attempts,
          maxRetries: maxAttempts - 1,
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

    try {
      pool = new Pool(baseUrl, {
        connections: maxConcurrency,
        connectTimeout: connectTimeoutMs,
        headersTimeout: requestTimeoutMs,
        bodyTimeout: requestTimeoutMs
      });
    } catch (error) {
      const reason = error instanceof Error ? "downstream_unavailable" : "downstream_unavailable";
      throw new Error(`TQ-INF-018: base URL unreachable at ${baseUrl} (${reason})`);
    }
    lifecycle = "running";
  };

  const shutdown = async (): Promise<void> => {
    if (pool !== null) {
      // pool.close() waits for all in-flight requests to settle. Operators relying on
      // graceful shutdown (e.g. during rolling deploys) get a clean hand-off; if that
      // wait blocks for too long the process supervisor will SIGKILL us — that
      // trade-off is intentional and documented in the README § Semantics.
      try {
        await pool.close();
      } catch {
        // Pool already closed or never initialised; swallowing is safe here.
      }
      pool = null;
    }
    lifecycle = "shut_down";
  };

  // healthCheck probe — must NOT make a business call. We inspect the circuit
  // breaker and pool state synchronously and, with an independent timeout, send a
  // single OPTIONS request to the configured health path. An OPTIONS probe is
  // universally benign — it asks "what can I do here" and most HTTP servers
  // respond within tens of ms even under load.
  const healthCheck = async (): Promise<AdapterHealthStatus> => {
    if (lifecycle !== "running") {
      return {
        adapterName,
        healthy: false,
        details: {
          lifecycle,
          baseUrl,
          circuitBreakerState: circuit.getState(),
          currentConcurrency,
          peakConcurrency,
          lastError: lastError ?? "none",
          healthCheckTimeoutMs
        },
        checkedAt: new Date().toISOString()
      };
    }
    const circuitState = circuit.getState();
    // Step 13 decision: open AND half-open → healthy: false. Only closed + running
    // reports healthy: true. This never lies to operator dashboards.
    if (circuitState !== "closed") {
      return {
        adapterName,
        healthy: false,
        details: {
          lifecycle,
          baseUrl,
          circuitBreakerState: circuitState,
          currentConcurrency,
          peakConcurrency,
          lastError: lastError ?? "none",
          lastSuccessAt: lastSuccessAt ?? "none",
          healthCheckTimeoutMs
        },
        checkedAt: new Date().toISOString()
      };
    }

    // Optional light-weight probe. We never throw; on failure healthy becomes false
    // and lastError gets a domain moniker.
    let probeOk = true;
    let probeReason: string | null = null;
    if (pool !== null) {
      const controller = new globalThis.AbortController();
      const timer = scheduleTimer(() => controller.abort(), healthCheckTimeoutMs);
      try {
        const response = await pool.request({
          method: "OPTIONS",
          path: healthCheckPath,
          signal: controller.signal,
          headersTimeout: healthCheckTimeoutMs,
          bodyTimeout: healthCheckTimeoutMs
        });
        await response.body.dump();
        // Any response — even a 4xx — proves the socket opened and the server is
        // alive. 5xx indicates the server rejected the health probe specifically;
        // we still report the raw response status only through the numeric field,
        // never as a domain category leak.
        if (response.statusCode >= 500) {
          probeOk = false;
          probeReason = "downstream_unavailable";
        }
      } catch {
        probeOk = false;
        probeReason = "downstream_unavailable";
      } finally {
        clearScheduledTimer(timer);
      }
    }

    return {
      adapterName,
      healthy: probeOk,
      details: {
        lifecycle,
        baseUrl,
        circuitBreakerState: circuitState,
        currentConcurrency,
        peakConcurrency,
        maxConcurrency,
        lastError: probeReason ?? lastError ?? "none",
        lastSuccessAt: lastSuccessAt ?? "none",
        lastCircuitTransitionAt: circuit.getLastTransitionAt() ?? "none",
        healthCheckTimeoutMs
      },
      checkedAt: new Date().toISOString()
    };
  };

  const getCircuitBreakerState = (): CircuitBreakerState => circuit.getState();
  const getCurrentConcurrency = (): number => currentConcurrency;
  const getPeakConcurrency = (): number => peakConcurrency;
  const getLastTraceId = (): TraceId | null => lastTraceId;
  const getRetryStats = (): ExternalEngineRetryStats => ({
    attempts: totalAttempts,
    maxSeen: maxSeenAttempts
  });
  const getLastCircuitTransitionAt = (): string | null => circuit.getLastTransitionAt();

  return {
    adapterName,
    __externalEngineProbe: true,
    init,
    shutdown,
    healthCheck,
    call,
    getCircuitBreakerState,
    getCurrentConcurrency,
    getPeakConcurrency,
    getLastTraceId,
    getRetryStats,
    getLastCircuitTransitionAt
  };
};

// Re-export the undici error namespace so Step 15-18 can narrow error types
// without adding undici to their dependency surface if they don't need the full
// client (they still get it transitively via this base package's dependency).
export { undiciErrors };
