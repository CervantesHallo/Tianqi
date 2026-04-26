// Phase 9 / Step 4 — @tianqi/dead-letter-store-postgres：跨进程持久化
// DeadLetterStorePort 实现。
//
// 元规则 H（Adapter 自管 schema）：
//   - 在 init() 内创建 schema + dead_letter_entries 表 + 双索引
//     + schema_version 表
//   - schema_version 不匹配抛 TQ-INF-024
//
// 元规则 I（healthCheck）：
//   - 不抛错（即使连接池失效也返回 healthy=false）
//   - 独立超时（healthCheckTimeoutMs，默认 2s）
//   - 探测动作只读（SELECT 1）
//
// 元规则 J（测试隔离）：
//   - TIANQI_TEST_POSTGRES_URL 控制 contract / persistent / 自有测试 skip
//
// §6.5 转译纪律延续：原始 PG 错误码 / SQL 文本不透出到 DeadLetterStoreError；
// 仅产出领域级摘要。

import { URL } from "node:url";
import {
  setTimeout as scheduleTimer,
  clearTimeout as clearScheduledTimer
} from "node:timers";

import pg from "pg";
import type pgTypes from "pg";

import type {
  AdapterFoundation,
  AdapterHealthStatus,
  DeadLetterEntry,
  DeadLetterEntryStatus,
  DeadLetterId,
  DeadLetterStoreError,
  DeadLetterStorePort,
  SagaId
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import {
  createDeadLetterEntriesTableDdl,
  createDeadLetterPendingIndexDdl,
  createDeadLetterSagaIndexDdl,
  createSchemaDdl,
  createSchemaVersionTableDdl,
  SCHEMA_VERSION,
  seedSchemaVersionDml,
  selectDeadLetterEntriesBySagaSql,
  selectDeadLetterEntrySql,
  selectPendingDeadLetterEntriesSql,
  selectSchemaVersionSql,
  updateMarkAsProcessedSql,
  upsertDeadLetterEntrySql
} from "./schema.js";

const { Pool } = pg;
type PgPool = pgTypes.Pool;
type PgQueryResult = pgTypes.QueryResult;

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "dead-letter-store-postgres";
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const VALID_SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

const VALID_STATUSES: ReadonlyArray<DeadLetterEntryStatus> = [
  "pending",
  "processed",
  "archived"
];

const isStatus = (value: unknown): value is DeadLetterEntryStatus =>
  typeof value === "string" && (VALID_STATUSES as readonly string[]).includes(value);

export type PostgresDeadLetterStore = DeadLetterStorePort & AdapterFoundation;

export type PostgresDeadLetterStoreOptions = Readonly<{
  connectionString: string;
  schema?: string;
  poolSize?: number;
  connectionTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
}>;

const infError = (
  code: "TQ-INF-022" | "TQ-INF-023",
  attemptedAction: string
): DeadLetterStoreError => ({
  message: `${code}: dead letter store ${ADAPTER_NAME} ${
    code === "TQ-INF-022" ? "not initialized" : "already shut down"
  } (action: ${attemptedAction})`
});

const operationFailed = (
  attemptedAction: string,
  reason: string
): DeadLetterStoreError => ({
  // §6.5：reason 必须是领域级摘要而非原始 PG 错误码 / SQL 文本
  message: `TQ-INF-001: ${ADAPTER_NAME} ${attemptedAction} failed: ${reason}`
});

const summarizePgError = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.name === "Error" ? "operation_failed" : cause.name;
  }
  return "unknown_failure";
};

const sanitizeConnectionTarget = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "<invalid_connection_string>";
  }
};

const rowToDeadLetterEntry = (row: Record<string, unknown>): DeadLetterEntry => {
  const status = row["status"];
  if (!isStatus(status)) {
    throw new Error(
      `TQ-INF-001: unexpected status value loaded from dead_letter_entries: ${String(status)}`
    );
  }
  const enqueuedAt = row["enqueued_at"];
  const lastAttemptAt = row["last_attempt_at"];
  const processedAt = row["processed_at"];

  return {
    entryId: row["entry_id"] as DeadLetterId,
    sagaId: row["saga_id"] as SagaId,
    stepName: String(row["step_name"]),
    status,
    enqueuedAt:
      enqueuedAt instanceof Date ? enqueuedAt.toISOString() : String(enqueuedAt),
    attemptCount: Number(row["attempt_count"]),
    compensationContext: row["compensation_context"],
    failureChain: row["failure_chain"] as ReadonlyArray<string>,
    correlationId: (row["correlation_id"] as DeadLetterEntry["correlationId"]) ?? null,
    traceId: (row["trace_id"] as DeadLetterEntry["traceId"]) ?? null,
    lastAttemptAt:
      lastAttemptAt instanceof Date
        ? lastAttemptAt.toISOString()
        : lastAttemptAt === null
          ? null
          : String(lastAttemptAt),
    processedAt:
      processedAt instanceof Date
        ? processedAt.toISOString()
        : processedAt === null
          ? null
          : String(processedAt),
    processedBy: (row["processed_by"] as string | null) ?? null,
    processingNotes: (row["processing_notes"] as string | null) ?? null
  };
};

const withTimeout = async <T>(
  task: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> => {
  let timer: ReturnType<typeof scheduleTimer> | undefined;
  try {
    return await Promise.race([
      task(),
      new Promise<T>((_resolve, reject) => {
        timer = scheduleTimer(() => {
          reject(new Error(`TQ-INF-001: ${ADAPTER_NAME} ${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer !== undefined) clearScheduledTimer(timer);
  }
};

const validateSchemaName = (schema: string): void => {
  if (!VALID_SCHEMA_NAME.test(schema)) {
    throw new Error(
      `TQ-INF-002: Postgres schema name is invalid (must match ${String(VALID_SCHEMA_NAME)}): ${schema}`
    );
  }
};

export const createPostgresDeadLetterStore = (
  options: PostgresDeadLetterStoreOptions
): PostgresDeadLetterStore => {
  const schema = options.schema ?? "public";
  validateSchemaName(schema);
  const poolSize = options.poolSize ?? DEFAULT_POOL_SIZE;
  const connectionTimeoutMs = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const healthCheckTimeoutMs =
    options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const connectionTarget = sanitizeConnectionTarget(options.connectionString);

  let pool: PgPool | undefined;
  let lifecycle: LifecycleState = "created";
  let lastObservedSchemaVersion: string | undefined;

  const guardLifecycleForOperation = (
    attemptedAction: string
  ): DeadLetterStoreError | null => {
    if (lifecycle === "shut_down") return infError("TQ-INF-023", attemptedAction);
    if (lifecycle === "created" || pool === undefined)
      return infError("TQ-INF-022", attemptedAction);
    return null;
  };

  const bootstrap = async (): Promise<void> => {
    if (pool === undefined) {
      throw new Error("TQ-INF-002: bootstrap called without pool");
    }
    const client = await pool.connect();
    try {
      await client.query(createSchemaDdl(schema));
      await client.query(createDeadLetterEntriesTableDdl(schema));
      await client.query(createDeadLetterSagaIndexDdl(schema));
      await client.query(createDeadLetterPendingIndexDdl(schema));
      await client.query(createSchemaVersionTableDdl(schema));
      await client.query(seedSchemaVersionDml(schema));
      const result = (await client.query(selectSchemaVersionSql(schema))) as PgQueryResult;
      const actual = result.rows[0]?.["version"] as string | undefined;
      if (actual !== undefined && actual !== SCHEMA_VERSION) {
        throw new Error(
          `TQ-INF-024: Postgres dead_letter_entries schema_version mismatch in "${schema}": expected ${SCHEMA_VERSION} but found ${actual}`
        );
      }
      lastObservedSchemaVersion = actual ?? SCHEMA_VERSION;
    } finally {
      client.release();
    }
  };

  return {
    adapterName: ADAPTER_NAME,
    async init(): Promise<void> {
      if (lifecycle === "shut_down") return;
      if (lifecycle === "running") return;
      pool = new Pool({
        connectionString: options.connectionString,
        max: poolSize,
        connectionTimeoutMillis: connectionTimeoutMs
      });
      try {
        await bootstrap();
      } catch (cause) {
        try {
          await pool.end();
        } catch {
          // 忽略二次清理错误
        }
        pool = undefined;
        if (cause instanceof Error && cause.message.startsWith("TQ-INF-024:")) {
          throw cause;
        }
        const reason = summarizePgError(cause);
        throw new Error(
          `TQ-INF-009: Postgres server unreachable via ${connectionTarget}: ${reason}`
        );
      }
      lifecycle = "running";
    },
    async shutdown(): Promise<void> {
      if (pool !== undefined) {
        try {
          await pool.end();
        } catch {
          // 忽略关闭时错误
        }
        pool = undefined;
      }
      lifecycle = "shut_down";
    },
    async healthCheck(): Promise<AdapterHealthStatus> {
      if (lifecycle !== "running" || pool === undefined) {
        return {
          adapterName: ADAPTER_NAME,
          healthy: false,
          details: {
            lifecycle,
            schemaVersion: lastObservedSchemaVersion ?? "unknown"
          },
          checkedAt: new Date().toISOString()
        };
      }
      try {
        await withTimeout(
          async () => {
            await pool!.query("SELECT 1");
          },
          healthCheckTimeoutMs,
          "healthCheck"
        );
        return {
          adapterName: ADAPTER_NAME,
          healthy: true,
          details: {
            lifecycle,
            schemaVersion: lastObservedSchemaVersion ?? SCHEMA_VERSION
          },
          checkedAt: new Date().toISOString()
        };
      } catch {
        return {
          adapterName: ADAPTER_NAME,
          healthy: false,
          details: {
            lifecycle,
            schemaVersion: lastObservedSchemaVersion ?? "unknown",
            reason: "select_1_failed"
          },
          checkedAt: new Date().toISOString()
        };
      }
    },
    async enqueue(
      entry: DeadLetterEntry
    ): Promise<Result<void, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("enqueue");
      if (guardError) return err(guardError);
      try {
        await pool!.query(upsertDeadLetterEntrySql(schema), [
          entry.entryId,
          entry.sagaId,
          entry.stepName,
          entry.status,
          entry.enqueuedAt,
          entry.attemptCount,
          JSON.stringify(entry.compensationContext),
          JSON.stringify(entry.failureChain),
          entry.correlationId,
          entry.traceId,
          entry.lastAttemptAt,
          entry.processedAt,
          entry.processedBy,
          entry.processingNotes
        ]);
        return ok(undefined);
      } catch (cause) {
        return err(operationFailed("enqueue", summarizePgError(cause)));
      }
    },
    async load(
      entryId: DeadLetterId
    ): Promise<Result<DeadLetterEntry | null, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("load");
      if (guardError) return err(guardError);
      try {
        const result = (await pool!.query(selectDeadLetterEntrySql(schema), [
          entryId
        ])) as PgQueryResult;
        if (result.rows.length === 0) return ok(null);
        return ok(rowToDeadLetterEntry(result.rows[0] as Record<string, unknown>));
      } catch (cause) {
        return err(operationFailed("load", summarizePgError(cause)));
      }
    },
    async listPending(): Promise<
      Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>
    > {
      const guardError = guardLifecycleForOperation("listPending");
      if (guardError) return err(guardError);
      try {
        const result = (await pool!.query(
          selectPendingDeadLetterEntriesSql(schema)
        )) as PgQueryResult;
        return ok(
          result.rows.map(row => rowToDeadLetterEntry(row as Record<string, unknown>))
        );
      } catch (cause) {
        return err(operationFailed("listPending", summarizePgError(cause)));
      }
    },
    async listBySaga(
      sagaId: SagaId
    ): Promise<Result<ReadonlyArray<DeadLetterEntry>, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("listBySaga");
      if (guardError) return err(guardError);
      try {
        const result = (await pool!.query(selectDeadLetterEntriesBySagaSql(schema), [
          sagaId
        ])) as PgQueryResult;
        return ok(
          result.rows.map(row => rowToDeadLetterEntry(row as Record<string, unknown>))
        );
      } catch (cause) {
        return err(operationFailed("listBySaga", summarizePgError(cause)));
      }
    },
    async markAsProcessed(
      entryId: DeadLetterId,
      processedBy: string,
      processingNotes?: string
    ): Promise<Result<void, DeadLetterStoreError>> {
      const guardError = guardLifecycleForOperation("markAsProcessed");
      if (guardError) return err(guardError);
      try {
        // UPDATE 影响 0 行时不抛错（与 memory 实现"未知 entryId 静默 ok"
        // 语义一致）。pg.query 不会因影响 0 行而 reject。
        await pool!.query(updateMarkAsProcessedSql(schema), [
          entryId,
          new Date().toISOString(),
          processedBy,
          processingNotes ?? null
        ]);
        return ok(undefined);
      } catch (cause) {
        return err(operationFailed("markAsProcessed", summarizePgError(cause)));
      }
    }
  };
};
