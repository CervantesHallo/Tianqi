// Phase 9 / Step 3 — saga_state schema 自管理（元规则 H）。
//
// Schema 设计裁决：单表 + JSONB（克制 > 堆砌；裁决记录见 ADR-0002 Step 3 段）：
//   - saga_state 表含 10 列对应 PersistedSagaState 10 字段
//   - step_statuses 与 compensation_contexts 用 JSONB（变长数组天然适合）
//   - 与 event-store-postgres 的 events 表风格一致（payload / metadata 也 JSONB）
//   - schema_version 单行表（id=1 CHECK）与 event-store-postgres 同模式
//
// 不引入双表分离（saga_state + saga_compensation_contexts）。理由：
//   - JSONB 数组的有序性已可保证逆序补偿
//   - 双表会引入 JOIN 与额外索引维护成本
//   - "克制 > 堆砌"权重生效

export const SCHEMA_VERSION = "1.0.0";

export const createSchemaDdl = (schema: string): string =>
  `CREATE SCHEMA IF NOT EXISTS "${schema}"`;

export const createSagaStateTableDdl = (schema: string): string => `
  CREATE TABLE IF NOT EXISTS "${schema}".saga_state (
    saga_id TEXT PRIMARY KEY,
    saga_started_at TIMESTAMPTZ NOT NULL,
    last_updated_at TIMESTAMPTZ NOT NULL,
    current_step_index INTEGER NOT NULL,
    total_steps INTEGER NOT NULL,
    overall_status TEXT NOT NULL,
    correlation_id TEXT,
    trace_id TEXT,
    step_statuses JSONB NOT NULL,
    compensation_contexts JSONB NOT NULL
  )
`;

// listIncomplete 扫描索引：只索引过渡态（in_progress / compensating）行。
// 终态 saga 不索引，让索引体积保持小。
export const createSagaStateOverallStatusIndexDdl = (schema: string): string => `
  CREATE INDEX IF NOT EXISTS idx_saga_state_incomplete
    ON "${schema}".saga_state (overall_status, last_updated_at)
    WHERE overall_status IN ('in_progress', 'compensating')
`;

export const createSchemaVersionTableDdl = (schema: string): string => `
  CREATE TABLE IF NOT EXISTS "${schema}".schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version TEXT NOT NULL
  )
`;

export const seedSchemaVersionDml = (schema: string): string => `
  INSERT INTO "${schema}".schema_version (id, version)
  VALUES (1, '${SCHEMA_VERSION}')
  ON CONFLICT (id) DO NOTHING
`;

export const selectSchemaVersionSql = (schema: string): string =>
  `SELECT version FROM "${schema}".schema_version WHERE id = 1`;

// upsert by saga_id（last-write-wins 语义；契约测试 P3.1 验证）
export const upsertSagaStateSql = (schema: string): string => `
  INSERT INTO "${schema}".saga_state
    (saga_id, saga_started_at, last_updated_at, current_step_index, total_steps,
     overall_status, correlation_id, trace_id, step_statuses, compensation_contexts)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)
  ON CONFLICT (saga_id) DO UPDATE SET
    saga_started_at = EXCLUDED.saga_started_at,
    last_updated_at = EXCLUDED.last_updated_at,
    current_step_index = EXCLUDED.current_step_index,
    total_steps = EXCLUDED.total_steps,
    overall_status = EXCLUDED.overall_status,
    correlation_id = EXCLUDED.correlation_id,
    trace_id = EXCLUDED.trace_id,
    step_statuses = EXCLUDED.step_statuses,
    compensation_contexts = EXCLUDED.compensation_contexts
`;

export const selectSagaStateSql = (schema: string): string => `
  SELECT saga_id, saga_started_at, last_updated_at, current_step_index, total_steps,
    overall_status, correlation_id, trace_id, step_statuses, compensation_contexts
  FROM "${schema}".saga_state
  WHERE saga_id = $1
`;

export const selectIncompleteSagaStatesSql = (schema: string): string => `
  SELECT saga_id, saga_started_at, last_updated_at, current_step_index, total_steps,
    overall_status, correlation_id, trace_id, step_statuses, compensation_contexts
  FROM "${schema}".saga_state
  WHERE overall_status IN ('in_progress', 'compensating')
`;

export const deleteSagaStateSql = (schema: string): string =>
  `DELETE FROM "${schema}".saga_state WHERE saga_id = $1`;
