// Phase 9 / Step 3 — @tianqi/saga-state-store-postgres：跨进程持久化
// SagaStateStorePort 实现。
//
// 元规则 H（Adapter 自管 schema）：
//   - 在 init() 内创建 schema + saga_state 表 + schema_version 表
//   - schema_version 不匹配抛 TQ-INF-021
//   - 不依赖外部迁移工具（Phase 11 部署模型 ADR 后引入）
//
// 元规则 I（healthCheck）：
//   - 不抛错（即使连接池失效也返回 healthy=false）
//   - 独立超时（healthCheckTimeoutMs，默认 2s）
//   - 探测动作只读（SELECT 1）
//
// 元规则 J（测试隔离）：
//   - TIANQI_TEST_POSTGRES_URL 控制 contract / persistent / 自有测试 skip
//
// §6.5 转译纪律延续：原始 PG 错误码 / SQL 文本不透出到 SagaStateStoreError；
// 仅产出领域级摘要（"connection refused" / "schema mismatch" 等）。

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
  PersistedCompensationEntry,
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaId,
  SagaStateStoreError,
  SagaStateStorePort,
  SagaStepStatusSnapshot
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import {
  createSagaStateOverallStatusIndexDdl,
  createSagaStateTableDdl,
  createSchemaDdl,
  createSchemaVersionTableDdl,
  deleteSagaStateSql,
  SCHEMA_VERSION,
  seedSchemaVersionDml,
  selectIncompleteSagaStatesSql,
  selectSagaStateSql,
  selectSchemaVersionSql,
  upsertSagaStateSql
} from "./schema.js";

const { Pool } = pg;
type PgPool = pgTypes.Pool;
type PgQueryResult = pgTypes.QueryResult;

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "saga-state-store-postgres";
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const VALID_SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

const VALID_OVERALL_STATUSES: ReadonlyArray<PersistedSagaStateOverallStatus> = [
  "in_progress",
  "completed",
  "compensating",
  "compensated",
  "partially_compensated",
  "timed_out"
];

const isOverallStatus = (value: unknown): value is PersistedSagaStateOverallStatus =>
  typeof value === "string" &&
  (VALID_OVERALL_STATUSES as readonly string[]).includes(value);

export type PostgresSagaStateStore = SagaStateStorePort & AdapterFoundation;

export type PostgresSagaStateStoreOptions = Readonly<{
  connectionString: string;
  schema?: string;
  poolSize?: number;
  connectionTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
}>;

const infError = (
  code: "TQ-INF-019" | "TQ-INF-020",
  attemptedAction: string
): SagaStateStoreError => ({
  message: `${code}: saga state store ${ADAPTER_NAME} ${
    code === "TQ-INF-019" ? "not initialized" : "already shut down"
  } (action: ${attemptedAction})`
});

const operationFailed = (
  attemptedAction: string,
  reason: string
): SagaStateStoreError => ({
  // §6.5：reason 必须是领域级摘要而非原始 PG 错误码 / SQL 文本
  message: `TQ-INF-001: ${ADAPTER_NAME} ${attemptedAction} failed: ${reason}`
});

const summarizePgError = (cause: unknown): string => {
  // 拒绝直接吐出 cause.message（可能含 schema 名 / SQL 片段 / 服务器主机名）
  if (cause instanceof Error) {
    // 仅取错误名作为类别标签
    return cause.name === "Error" ? "operation_failed" : cause.name;
  }
  return "unknown_failure";
};

// 从 connectionString 中安全提取 host:port 用于错误信息（不含密码）
const sanitizeConnectionTarget = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    return `${url.hostname}:${url.port || "5432"}/${url.pathname.replace(/^\//, "")}`;
  } catch {
    return "<invalid_connection_string>";
  }
};

const rowToPersistedSagaState = (row: Record<string, unknown>): PersistedSagaState => {
  // pg 返回 JSONB 列时已自动 parse 为 JS 对象（无需 JSON.parse）。
  // TIMESTAMPTZ 列以 Date 对象返回，转 ISO-8601 string。
  const sagaStartedAt = row["saga_started_at"];
  const lastUpdatedAt = row["last_updated_at"];
  const stepStatusesRaw = row["step_statuses"];
  const compensationContextsRaw = row["compensation_contexts"];
  const overallStatusRaw = row["overall_status"];

  if (!isOverallStatus(overallStatusRaw)) {
    throw new Error(
      `TQ-INF-001: unexpected overall_status value loaded from saga_state: ${String(overallStatusRaw)}`
    );
  }

  return {
    sagaId: row["saga_id"] as SagaId,
    sagaStartedAt:
      sagaStartedAt instanceof Date ? sagaStartedAt.toISOString() : String(sagaStartedAt),
    lastUpdatedAt:
      lastUpdatedAt instanceof Date ? lastUpdatedAt.toISOString() : String(lastUpdatedAt),
    currentStepIndex: Number(row["current_step_index"]),
    totalSteps: Number(row["total_steps"]),
    stepStatuses: stepStatusesRaw as ReadonlyArray<SagaStepStatusSnapshot>,
    compensationContexts:
      compensationContextsRaw as ReadonlyArray<PersistedCompensationEntry>,
    overallStatus: overallStatusRaw,
    correlationId: (row["correlation_id"] as PersistedSagaState["correlationId"]) ?? null,
    traceId: (row["trace_id"] as PersistedSagaState["traceId"]) ?? null
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

export const createPostgresSagaStateStore = (
  options: PostgresSagaStateStoreOptions
): PostgresSagaStateStore => {
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
  ): SagaStateStoreError | null => {
    if (lifecycle === "shut_down") return infError("TQ-INF-020", attemptedAction);
    if (lifecycle === "created" || pool === undefined)
      return infError("TQ-INF-019", attemptedAction);
    return null;
  };

  const bootstrap = async (): Promise<void> => {
    if (pool === undefined) {
      throw new Error("TQ-INF-002: bootstrap called without pool");
    }
    const client = await pool.connect();
    try {
      await client.query(createSchemaDdl(schema));
      await client.query(createSagaStateTableDdl(schema));
      await client.query(createSagaStateOverallStatusIndexDdl(schema));
      await client.query(createSchemaVersionTableDdl(schema));
      await client.query(seedSchemaVersionDml(schema));
      const result = (await client.query(selectSchemaVersionSql(schema))) as PgQueryResult;
      const actual = result.rows[0]?.["version"] as string | undefined;
      if (actual !== undefined && actual !== SCHEMA_VERSION) {
        throw new Error(
          `TQ-INF-021: Postgres saga_state schema_version mismatch in "${schema}": expected ${SCHEMA_VERSION} but found ${actual}`
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
      // init 幂等（与 event-store-postgres 同模式）：
      //   - created → running（执行 bootstrap）
      //   - running → running（no-op；不重复 bootstrap）
      //   - shut_down → 静默 no-op（lifecycle 保持 shut_down；要复用 adapter
      //     必须重新 createPostgresSagaStateStore）
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
        // 元规则 H 失败处置：bootstrap 失败时 pool 必须关闭（防 client 泄漏）
        try {
          await pool.end();
        } catch {
          // 忽略二次清理错误
        }
        pool = undefined;
        if (cause instanceof Error && cause.message.startsWith("TQ-INF-021:")) {
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
          // 关闭时忽略错误，仍切 lifecycle
        }
        pool = undefined;
      }
      lifecycle = "shut_down";
    },
    async healthCheck(): Promise<AdapterHealthStatus> {
      // 元规则 I：不抛 / 独立超时 / 只读探测
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
    async save(
      state: PersistedSagaState
    ): Promise<Result<void, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("save");
      if (guardError) return err(guardError);
      try {
        await pool!.query(upsertSagaStateSql(schema), [
          state.sagaId,
          state.sagaStartedAt,
          state.lastUpdatedAt,
          state.currentStepIndex,
          state.totalSteps,
          state.overallStatus,
          state.correlationId,
          state.traceId,
          JSON.stringify(state.stepStatuses),
          JSON.stringify(state.compensationContexts)
        ]);
        return ok(undefined);
      } catch (cause) {
        return err(operationFailed("save", summarizePgError(cause)));
      }
    },
    async load(
      sagaId: SagaId
    ): Promise<Result<PersistedSagaState | null, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("load");
      if (guardError) return err(guardError);
      try {
        const result = (await pool!.query(selectSagaStateSql(schema), [
          sagaId
        ])) as PgQueryResult;
        if (result.rows.length === 0) return ok(null);
        const row = result.rows[0] as Record<string, unknown>;
        return ok(rowToPersistedSagaState(row));
      } catch (cause) {
        return err(operationFailed("load", summarizePgError(cause)));
      }
    },
    async listIncomplete(): Promise<
      Result<ReadonlyArray<PersistedSagaState>, SagaStateStoreError>
    > {
      const guardError = guardLifecycleForOperation("listIncomplete");
      if (guardError) return err(guardError);
      try {
        const result = (await pool!.query(
          selectIncompleteSagaStatesSql(schema)
        )) as PgQueryResult;
        const states = result.rows.map(row =>
          rowToPersistedSagaState(row as Record<string, unknown>)
        );
        return ok(states);
      } catch (cause) {
        return err(operationFailed("listIncomplete", summarizePgError(cause)));
      }
    },
    async delete(sagaId: SagaId): Promise<Result<void, SagaStateStoreError>> {
      const guardError = guardLifecycleForOperation("delete");
      if (guardError) return err(guardError);
      try {
        await pool!.query(deleteSagaStateSql(schema), [sagaId]);
        return ok(undefined);
      } catch (cause) {
        return err(operationFailed("delete", summarizePgError(cause)));
      }
    }
  };
};
