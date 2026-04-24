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
