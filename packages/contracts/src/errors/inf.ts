import { ERROR_CODES } from "../error-code.js";
import type { InfrastructureErrorCode } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import type { ErrorLayer, TianqiErrorContext } from "./error-layer.js";

export class InfrastructureError extends Error {
  public readonly code: InfrastructureErrorCode;
  public readonly layer: ErrorLayer;
  public readonly context: TianqiErrorContext;
  public override readonly cause?: Error | InfrastructureError;

  public constructor(
    code: InfrastructureErrorCode,
    message: string,
    context: TianqiErrorContext,
    cause?: Error | InfrastructureError
  ) {
    super(message);
    this.name = "InfrastructureError";
    this.code = code;
    this.layer = ERROR_LAYERS.INFRASTRUCTURE;
    this.context = context;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export const adapterInitializationFailedError = (
  adapterName: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.ADAPTER_INITIALIZATION_FAILED,
    "Adapter initialization failed",
    {
      adapterName,
      reason
    },
    cause
  );

export const eventStoreNotInitializedError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EVENT_STORE_NOT_INITIALIZED,
    "Event store adapter is not initialized",
    {
      adapterName,
      attemptedAction
    }
  );

export const eventStoreAlreadyShutDownError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EVENT_STORE_ALREADY_SHUT_DOWN,
    "Event store adapter has already been shut down",
    {
      adapterName,
      attemptedAction
    }
  );

export const sqliteDatabaseUnreachableError = (
  adapterName: string,
  databasePath: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.SQLITE_DATABASE_UNREACHABLE,
    "SQLite database is unreachable",
    {
      adapterName,
      databasePath,
      reason
    },
    cause
  );

export const sqliteSchemaVersionMismatchError = (
  adapterName: string,
  databasePath: string,
  expectedVersion: string,
  actualVersion: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.SQLITE_SCHEMA_VERSION_MISMATCH,
    "SQLite schema_version does not match the value expected by the adapter",
    {
      adapterName,
      databasePath,
      expectedVersion,
      actualVersion
    }
  );

export const postgresUnreachableError = (
  adapterName: string,
  connectionTarget: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.POSTGRES_UNREACHABLE,
    "Postgres server is unreachable",
    {
      adapterName,
      connectionTarget,
      reason
    },
    cause
  );

export const kafkaBrokerUnreachableError = (
  adapterName: string,
  brokers: readonly string[],
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.KAFKA_BROKER_UNREACHABLE,
    "Kafka broker is unreachable",
    {
      adapterName,
      brokers: brokers.join(","),
      reason
    },
    cause
  );

// Config-file adapter specific: raised when init() cannot open / read the YAML file.
// Tool chain ("which path, whose mount, what permission") diverges from DB-connection
// failures and Kafka-broker failures, so Convention K says mint a distinct code rather
// than reuse TQ-INF-001/009/010.
export const configFileUnreadableError = (
  adapterName: string,
  filePath: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.CONFIG_FILE_UNREADABLE,
    "Config file is unreadable",
    {
      adapterName,
      filePath,
      reason
    },
    cause
  );

// Config-file adapter specific (Step 12): raised when historyDirectory cannot be created,
// listed, or written to during init() or reload(). Diagnostic tool-chain ("chmod the
// directory, df for space, check for cross-device bind mounts") differs from the config
// file itself — historyDirectory is a directory requiring lsattr/xattr checks too —
// so Convention K says mint a distinct code rather than fold into TQ-INF-011.
export const configHistoryDirectoryUnreadableError = (
  adapterName: string,
  historyDirectory: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE,
    "Config history directory is unreadable or unwritable",
    {
      adapterName,
      historyDirectory,
      reason
    },
    cause
  );

// External Engine five-pack (Step 13): each of the five factories below enforces the
// §6.5 "领域摘要转译" discipline — the `reason` / category parameters are deliberately
// typed as domain-level strings (e.g. "invalid_request" / "downstream_unavailable"),
// NOT raw HTTP status codes, socket error class names, or downstream stack traces.
// Adapter implementations MUST translate whatever lower-level signal they saw into a
// domain-recognisable moniker before calling these factories; doing otherwise leaks
// downstream details into the TQ-INF error context, which is exactly what §6.5 forbids.

// Timeout phase is one of three: the time to open the socket (connect), the time from
// request-sent to response-received (request), or the overall budget including retries
// and backoff (total). Callers pass the elapsed time in ms so the error message alone
// tells an operator "we waited X against a budget of Y and gave up".
export const externalEngineTimeoutError = (
  adapterName: string,
  timeoutPhase: "connect" | "request" | "total",
  timeoutMs: number,
  elapsedMs: number
): InfrastructureError =>
  new InfrastructureError(ERROR_CODES.EXTERNAL_ENGINE_TIMEOUT, "External engine call timed out", {
    adapterName,
    timeoutPhase,
    timeoutMs,
    elapsedMs
  });

// Retries exhausted after all retryable attempts failed. `attempts` is the total number
// of attempts made (including the first one), `maxRetries` is the configured budget, and
// `finalFailureCategory` is a domain moniker ("downstream_unavailable" /
// "transient_conflict" / etc) — NEVER a raw HTTP status or socket error string.
export const externalEngineRetriesExhaustedError = (
  adapterName: string,
  attempts: number,
  maxRetries: number,
  finalFailureCategory: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EXTERNAL_ENGINE_RETRIES_EXHAUSTED,
    "External engine retries exhausted",
    {
      adapterName,
      attempts,
      maxRetries,
      finalFailureCategory
    }
  );

// Raised when the circuit breaker is in "open" state and the call is refused without
// reaching the downstream. openedAt is ISO-8601; consecutiveFailures is the count that
// tripped the breaker, so a runbook can decide whether to lower the threshold or
// investigate downstream health.
export const externalEngineCircuitOpenError = (
  adapterName: string,
  openedAt: string,
  consecutiveFailures: number
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EXTERNAL_ENGINE_CIRCUIT_OPEN,
    "External engine circuit breaker is open",
    {
      adapterName,
      openedAt,
      consecutiveFailures
    }
  );

// Raised when the client-side rate limiter refuses a call because concurrency would
// exceed the configured cap. currentConcurrency and cap quantify the signal; together
// they tell an operator whether to raise the cap or add a queue ahead of the adapter.
export const externalEngineRateLimitedError = (
  adapterName: string,
  currentConcurrency: number,
  cap: number
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EXTERNAL_ENGINE_RATE_LIMITED,
    "External engine call rate limited",
    {
      adapterName,
      currentConcurrency,
      cap
    }
  );

// Raised when the downstream returned an error that the adapter classified as
// non-retryable. downstreamCategory is a domain moniker (e.g. "invalid_request" /
// "permission_denied" / "not_found") — NEVER the raw HTTP status (400/403/404) or a
// provider-specific error code. The translation lives in the adapter; §6.5 discipline.
export const externalEngineNonRetryableError = (
  adapterName: string,
  downstreamCategory: string,
  reason: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EXTERNAL_ENGINE_NON_RETRYABLE,
    "External engine returned a non-retryable error",
    {
      adapterName,
      downstreamCategory,
      reason
    }
  );

// External Engine HTTP base (Step 14): raised when init() verifies that baseUrl cannot
// be reached at all (DNS resolve failure, connection refused, TLS handshake failure).
// Distinct from TQ-INF-013 (runtime call timeout) because the diagnostic tool-chain
// diverges — "is the hostname correct; are we in the right network; is TLS trust
// store seeded" vs "is the budget too tight for normal latency". Also distinct from
// TQ-INF-009 POSTGRES_UNREACHABLE / TQ-INF-010 KAFKA_BROKER_UNREACHABLE because HTTP
// endpoints have their own curl-based runbooks. §6.5 discipline applies: reason must
// be a domain moniker, not a raw socket error name.
export const externalEngineBaseUrlUnreachableError = (
  adapterName: string,
  baseUrl: string,
  reason: string,
  cause?: Error
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.EXTERNAL_ENGINE_BASE_URL_UNREACHABLE,
    "External engine base URL is unreachable",
    {
      adapterName,
      baseUrl,
      reason
    },
    cause
  );

// Phase 9 / Step 3 — SagaStateStore Adapter 错误工厂。
// 与 EventStore 的 TQ-INF-003/004 同形态（INIT 前调用 / SHUTDOWN 后调用），
// 但分配独立 code 让运维 runbook 与 EventStore 解耦——同样的"先 init 后操
// 作"错误，Saga 状态存储与事件存储的处理路径完全不同（前者影响 Saga 推
// 进，后者影响审计可回放）。

export const sagaStateStoreNotInitializedError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.SAGA_STATE_STORE_NOT_INITIALIZED,
    "Saga state store adapter is not initialized",
    {
      adapterName,
      attemptedAction
    }
  );

export const sagaStateStoreAlreadyShutDownError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.SAGA_STATE_STORE_ALREADY_SHUT_DOWN,
    "Saga state store adapter is already shut down",
    {
      adapterName,
      attemptedAction
    }
  );

// schema_version 不匹配：postgres adapter 在 init 时发现持久化表的
// schema_version 与代码内 SCHEMA_VERSION 常量不一致（譬如旧版部署后停服
// 升级）。运维 runbook 与 TQ-INF-008 SQLITE_SCHEMA_VERSION_MISMATCH 不
// 同：本码引导操作员检查 saga-state-store-postgres 包的 SCHEMA_VERSION
// 历史与 ALTER 迁移脚本（Phase 11+ 责任），而 TQ-INF-008 引导检查 SQLite
// 文件的本地状态。两条 runbook 分离更精确。
export const sagaStateStoreSchemaVersionMismatchError = (
  adapterName: string,
  expected: string,
  actual: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.SAGA_STATE_STORE_SCHEMA_VERSION_MISMATCH,
    "Saga state store schema_version does not match adapter expectation",
    {
      adapterName,
      expected,
      actual
    }
  );

// Phase 9 / Step 4 — DeadLetterStore Adapter 错误工厂。
// 与 SagaStateStore 同形态（INIT 前调用 / SHUTDOWN 后调用 / schema 不匹
// 配），但分配独立 code 让运维 runbook 与 SagaStateStore 解耦——同样的
// "先 init 后操作"错误，死信存储与状态存储的处理路径完全不同（前者影响
// 死信归档可恢复性，后者影响 Saga 推进；后者属于补偿路径而前者属于已经
// 失败后的兜底路径）。

export const deadLetterStoreNotInitializedError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.DEAD_LETTER_STORE_NOT_INITIALIZED,
    "Dead letter store adapter is not initialized",
    {
      adapterName,
      attemptedAction
    }
  );

export const deadLetterStoreAlreadyShutDownError = (
  adapterName: string,
  attemptedAction: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.DEAD_LETTER_STORE_ALREADY_SHUT_DOWN,
    "Dead letter store adapter is already shut down",
    {
      adapterName,
      attemptedAction
    }
  );

// 与 TQ-INF-021 SAGA_STATE_STORE_SCHEMA_VERSION_MISMATCH / TQ-INF-008
// SQLITE_SCHEMA_VERSION_MISMATCH 同形态但独立。运维 runbook：检查
// dead-letter-store-postgres 包的 SCHEMA_VERSION 历史与迁移脚本——具体
// 升级路径与 SagaStateStore / SQLite 各自独立（死信表结构变更相对低频）。
export const deadLetterStoreSchemaVersionMismatchError = (
  adapterName: string,
  expected: string,
  actual: string
): InfrastructureError =>
  new InfrastructureError(
    ERROR_CODES.DEAD_LETTER_STORE_SCHEMA_VERSION_MISMATCH,
    "Dead letter store schema_version does not match adapter expectation",
    {
      adapterName,
      expected,
      actual
    }
  );
