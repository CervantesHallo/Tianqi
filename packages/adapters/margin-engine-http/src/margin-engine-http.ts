import {
  createHttpBaseEngine,
  type HttpBaseCallRequest,
  type HttpBaseEngineAdapter,
  type HttpBaseEngineError,
  type HttpBaseEngineOptions,
  type HttpCallResponse
} from "@tianqi/external-engine-http-base";
import type { AdapterHealthStatus } from "@tianqi/ports";
import type {
  CalculateMarginRequest,
  CalculateMarginResponse,
  LockMarginRequest,
  LockMarginResponse,
  MarginAccountId,
  MarginAmount,
  MarginCurrency,
  MarginEnginePort,
  MarginEnginePortError,
  MarginLockId,
  QueryMarginBalanceRequest,
  QueryMarginBalanceResponse,
  ReleaseMarginRequest,
  ReleaseMarginResponse
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

// MarginEngineHttp — Phase 8's first business Engine Adapter. Consumes the
// external-engine-http-base via workspace:* and implements MarginEnginePort.
//
// META-RULE O consumption discipline (Step 14 author's reminder):
//   1. The base's five-pack configuration (timeouts / retry / circuitBreaker /
//      rateLimit / traceHeaderName / healthCheckTimeoutMs / healthCheckPath) is
//      passed through verbatim via Omit<HttpBaseEngineOptions, never>; this
//      adapter does not re-design or re-interpret any of it.
//   2. No deep imports — only the public surface exported by the base's
//      `src/index.ts` (createHttpBaseEngine + types) appears above. The base's
//      internal helpers (classifyHttpStatus, CircuitBreaker class, etc) remain
//      invisible to this adapter.
//   3. Stability behaviours (retry, timeout, circuit breaker, rate limit, trace
//      propagation) are 100% delegated to the base. This file contains ZERO
//      retry loops, ZERO backoff sleeps, ZERO circuit-breaker state machines.
//   4. META-RULE F (Adapters don't depend on one another) is preserved because
//      the base is the single permitted exception under META-RULE O, and this
//      adapter does not depend on any sibling business engine (no future
//      position-engine-http, match-engine-http, etc. imports will be added).
//
// The business methods are four thin translators, each ~15 lines:
//   - read the Port request
//   - build an ExternalEngineRequest (operation + payload)
//   - call base.call()
//   - classify the result: success → parse response body → domain type;
//                          error → remap to MarginEnginePortError
//
// The parse step (parseCalculateMarginResponse et al) is strict: a single
// missing or malformed field raises TQ-CON-010 via
// marginResponseSchemaInvalidError. No lenient defaults.

// -- Options -------------------------------------------------------------------------

// Accepts every HttpBaseEngineOptions field so callers can tune five-pack knobs
// the same way they do on the base. The adapter-specific defaults kick in only
// when the caller omits a field AND the base's own default is not what we want
// (currently, we accept every base default unchanged).
export type MarginEngineHttpOptions = HttpBaseEngineOptions & {
  // No Margin-specific fields today. Present as a named type for discoverability
  // and to give Step 16-17 a template for adding their own engine-specific knobs
  // (e.g. Match engine might need a symbol-whitelist option later).
};

// -- Adapter public surface ---------------------------------------------------------

type ExternalEngineContractProbeSurface = {
  readonly __externalEngineProbe: true;
  getCircuitBreakerState(): ReturnType<HttpBaseEngineAdapter["getCircuitBreakerState"]>;
  getCurrentConcurrency(): number;
  getPeakConcurrency(): number;
  getLastTraceId(): TraceId | null;
  getRetryStats(): ReturnType<HttpBaseEngineAdapter["getRetryStats"]>;
  getLastCircuitTransitionAt(): string | null;
};

export type MarginEngineHttpAdapter = MarginEnginePort &
  ExternalEngineContractProbeSurface & {
    readonly adapterName: "margin-engine-http";
    init(): Promise<void>;
    shutdown(): Promise<void>;
    healthCheck(): Promise<AdapterHealthStatus>;
    // Generic pass-through to the base's call(). Required by
    // TestkitExternalEngineFoundation so the business adapter can be fed to
    // defineExternalEngineContractTests (META-RULE P lower tier); also useful
    // for escape-hatch scenarios where a caller needs to invoke an operation
    // that hasn't been lifted to a business method yet. Business-method tests
    // NEVER go through this path — they go through calculateMargin /
    // lockMargin / releaseMargin / queryMarginBalance.
    call(
      request: HttpBaseCallRequest,
      traceId?: TraceId
    ): Promise<Result<HttpCallResponse, HttpBaseEngineError>>;
  };

// -- Response parsers (strict; no lenient defaults) ---------------------------------

// Each parser narrows an unknown body to a domain type. The only way this code
// produces a MarginEnginePortError with code TQ-CON-010 is via these parsers.
// Operator-facing reason strings are domain monikers ("missing_field" /
// "wrong_type" / "invalid_timestamp"); the raw downstream response never leaks.
const isIsoTimestamp = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  // Date.parse accepts some non-ISO formats; require the canonical "T" separator
  // and either "Z" or an explicit offset to reject RFC-2822 et al.
  return /T/.test(value) && /(Z|[+-]\d{2}:?\d{2})$/.test(value);
};

const buildSchemaError = (
  operation: string,
  fieldPath: string,
  reason: string
): MarginEnginePortError => ({
  code: "TQ-CON-010",
  message: `TQ-CON-010: ${operation} response ${fieldPath} ${reason}`,
  context: {
    adapterName: "margin-engine-http",
    operation,
    fieldPath,
    reason
  }
});

// parseJsonBody centralises the "reject non-JSON / non-object" gate so each
// per-method parser only has to validate its own fields.
const parseJsonBody = (
  operation: string,
  body: string
): Result<Record<string, unknown>, MarginEnginePortError> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return err(buildSchemaError(operation, "body", "not_json"));
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return err(buildSchemaError(operation, "body", "not_object"));
  }
  return ok(parsed as Record<string, unknown>);
};

const requireString = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, MarginEnginePortError> => {
  if (typeof value !== "string" || value.length === 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_non_string"));
  }
  return ok(value);
};

const requireNonNegativeNumber = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<number, MarginEnginePortError> => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return err(buildSchemaError(operation, fieldPath, "missing_or_negative_number"));
  }
  return ok(value);
};

const requireIsoTimestamp = (
  operation: string,
  fieldPath: string,
  value: unknown
): Result<string, MarginEnginePortError> => {
  if (!isIsoTimestamp(value)) {
    return err(buildSchemaError(operation, fieldPath, "invalid_timestamp"));
  }
  return ok(value);
};

const parseCalculateMarginResponse = (
  body: string
): Result<CalculateMarginResponse, MarginEnginePortError> => {
  const parsed = parseJsonBody("calculate-margin", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const amount = requireNonNegativeNumber(
    "calculate-margin",
    "requiredMargin",
    root["requiredMargin"]
  );
  if (!amount.ok) return err(amount.error);
  const currency = requireString("calculate-margin", "currency", root["currency"]);
  if (!currency.ok) return err(currency.error);
  const calculatedAt = requireIsoTimestamp(
    "calculate-margin",
    "calculatedAt",
    root["calculatedAt"]
  );
  if (!calculatedAt.ok) return err(calculatedAt.error);
  return ok({
    requiredMargin: amount.value as MarginAmount,
    currency: currency.value as MarginCurrency,
    calculatedAt: calculatedAt.value
  });
};

const parseLockMarginResponse = (
  body: string
): Result<LockMarginResponse, MarginEnginePortError> => {
  const parsed = parseJsonBody("lock-margin", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const lockId = requireString("lock-margin", "lockId", root["lockId"]);
  if (!lockId.ok) return err(lockId.error);
  const amount = requireNonNegativeNumber("lock-margin", "lockedAmount", root["lockedAmount"]);
  if (!amount.ok) return err(amount.error);
  const currency = requireString("lock-margin", "currency", root["currency"]);
  if (!currency.ok) return err(currency.error);
  const lockedAt = requireIsoTimestamp("lock-margin", "lockedAt", root["lockedAt"]);
  if (!lockedAt.ok) return err(lockedAt.error);
  return ok({
    lockId: lockId.value as MarginLockId,
    lockedAmount: amount.value as MarginAmount,
    currency: currency.value as MarginCurrency,
    lockedAt: lockedAt.value
  });
};

const parseReleaseMarginResponse = (
  body: string
): Result<ReleaseMarginResponse, MarginEnginePortError> => {
  const parsed = parseJsonBody("release-margin", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const lockId = requireString("release-margin", "lockId", root["lockId"]);
  if (!lockId.ok) return err(lockId.error);
  const amount = requireNonNegativeNumber(
    "release-margin",
    "releasedAmount",
    root["releasedAmount"]
  );
  if (!amount.ok) return err(amount.error);
  const releasedAt = requireIsoTimestamp("release-margin", "releasedAt", root["releasedAt"]);
  if (!releasedAt.ok) return err(releasedAt.error);
  return ok({
    lockId: lockId.value as MarginLockId,
    releasedAmount: amount.value as MarginAmount,
    releasedAt: releasedAt.value
  });
};

const parseQueryMarginBalanceResponse = (
  body: string
): Result<QueryMarginBalanceResponse, MarginEnginePortError> => {
  const parsed = parseJsonBody("query-margin-balance", body);
  if (!parsed.ok) return err(parsed.error);
  const root = parsed.value;
  const accountId = requireString("query-margin-balance", "accountId", root["accountId"]);
  if (!accountId.ok) return err(accountId.error);
  const currency = requireString("query-margin-balance", "currency", root["currency"]);
  if (!currency.ok) return err(currency.error);
  const available = requireNonNegativeNumber(
    "query-margin-balance",
    "availableMargin",
    root["availableMargin"]
  );
  if (!available.ok) return err(available.error);
  const locked = requireNonNegativeNumber(
    "query-margin-balance",
    "lockedMargin",
    root["lockedMargin"]
  );
  if (!locked.ok) return err(locked.error);
  const total = requireNonNegativeNumber(
    "query-margin-balance",
    "totalMargin",
    root["totalMargin"]
  );
  if (!total.ok) return err(total.error);
  const queriedAt = requireIsoTimestamp("query-margin-balance", "queriedAt", root["queriedAt"]);
  if (!queriedAt.ok) return err(queriedAt.error);
  return ok({
    accountId: accountId.value as MarginAccountId,
    currency: currency.value as MarginCurrency,
    availableMargin: available.value as MarginAmount,
    lockedMargin: locked.value as MarginAmount,
    totalMargin: total.value as MarginAmount,
    queriedAt: queriedAt.value
  });
};

// translateBaseError — the base returns an HttpBaseEngineError with a TQ-INF-*
// code (TQ-INF-003/004/013/014/015/016/017/018). MarginEnginePortError accepts
// the same set plus TQ-CON-010, so the translation is mostly a passthrough: we
// only need to tighten the context's adapterName to "margin-engine-http" so
// logs name THIS adapter rather than the base. The code and domain-moniker
// context fields are preserved verbatim.
const translateBaseError = (baseError: {
  code: string;
  message: string;
  context: Readonly<Record<string, unknown>>;
}): MarginEnginePortError => ({
  code: baseError.code as MarginEnginePortError["code"],
  message: baseError.message,
  context: {
    ...baseError.context,
    adapterName: "margin-engine-http"
  }
});

// -- Factory -------------------------------------------------------------------------

export const createMarginEngineHttp = (
  options: MarginEngineHttpOptions
): MarginEngineHttpAdapter => {
  if (typeof options.baseUrl !== "string" || options.baseUrl.length === 0) {
    throw new Error("margin-engine-http: baseUrl is required");
  }

  // The base adapter owns all five-pack behaviour. By letting the base's
  // factory validate the full options object we avoid duplicating any default
  // calculation here — any business engine in Sprint E that re-implements
  // option defaults is suspect (META-RULE O consumption discipline).
  const base = createHttpBaseEngine({
    ...options,
    adapterName: "margin-engine-http"
  });

  const callWithTrace = async <T>(
    operation: string,
    payload: unknown,
    traceId: TraceId | undefined,
    parseBody: (body: string) => Result<T, MarginEnginePortError>
  ): Promise<Result<T, MarginEnginePortError>> => {
    const result = await base.call({ operation, payload }, traceId);
    if (!result.ok) {
      return err(translateBaseError(result.error));
    }
    const response: HttpCallResponse = result.value;
    return parseBody(response.body);
  };

  // Business methods — each is a three-line translator. This is the shape
  // Step 16-17 will replicate for Position / Match / MarkPrice / Fund.
  const calculateMargin = (
    request: CalculateMarginRequest
  ): Promise<Result<CalculateMarginResponse, MarginEnginePortError>> =>
    callWithTrace(
      "calculate-margin",
      {
        accountId: request.accountId,
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity,
        price: request.price
      },
      request.traceId,
      parseCalculateMarginResponse
    );

  const lockMargin = (
    request: LockMarginRequest
  ): Promise<Result<LockMarginResponse, MarginEnginePortError>> =>
    callWithTrace(
      "lock-margin",
      {
        accountId: request.accountId,
        amount: request.amount,
        currency: request.currency,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseLockMarginResponse
    );

  const releaseMargin = (
    request: ReleaseMarginRequest
  ): Promise<Result<ReleaseMarginResponse, MarginEnginePortError>> =>
    callWithTrace(
      "release-margin",
      {
        lockId: request.lockId,
        idempotencyKey: request.idempotencyKey
      },
      request.traceId,
      parseReleaseMarginResponse
    );

  const queryMarginBalance = (
    request: QueryMarginBalanceRequest
  ): Promise<Result<QueryMarginBalanceResponse, MarginEnginePortError>> =>
    callWithTrace(
      "query-margin-balance",
      {
        accountId: request.accountId,
        currency: request.currency
      },
      request.traceId,
      parseQueryMarginBalanceResponse
    );

  // Foundation / probe delegation — Step 5 state-guard semantics are inherited
  // from the base (init/shutdown check lifecycle with shut_down-first order,
  // the base emits TQ-INF-003/004 for before-init and after-shutdown calls).
  // No re-implementation here; that would duplicate base logic and invite drift.
  return {
    adapterName: "margin-engine-http",
    __externalEngineProbe: true,
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: async (): Promise<AdapterHealthStatus> => {
      const baseHealth = await base.healthCheck();
      // Business layer trusts the base's healthy verdict verbatim (META-RULE O:
      // business adapters do not re-implement stability judgement). details
      // gains two documentary fields so dashboards can see which engine kind
      // is behind a given health signal.
      return {
        adapterName: "margin-engine-http",
        healthy: baseHealth.healthy,
        details: {
          ...baseHealth.details,
          engineKind: "margin",
          businessMethods: "calculateMargin,lockMargin,releaseMargin,queryMarginBalance"
        },
        checkedAt: baseHealth.checkedAt
      };
    },
    calculateMargin,
    lockMargin,
    releaseMargin,
    queryMarginBalance,
    call: (request, traceId) => base.call(request, traceId),
    getCircuitBreakerState: () => base.getCircuitBreakerState(),
    getCurrentConcurrency: () => base.getCurrentConcurrency(),
    getPeakConcurrency: () => base.getPeakConcurrency(),
    getLastTraceId: () => base.getLastTraceId(),
    getRetryStats: () => base.getRetryStats(),
    getLastCircuitTransitionAt: () => base.getLastCircuitTransitionAt()
  };
};
