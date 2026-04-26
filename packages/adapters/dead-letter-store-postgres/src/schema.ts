// Phase 9 / Step 4 — dead_letter_entries schema 自管理（元规则 H）。
//
// Schema 设计：单表 + JSONB（与 saga-state-store-postgres 同模式；裁决记
// 录见 ADR-0002 Step 4 段）：
//   - dead_letter_entries 表含 13 列对应 DeadLetterEntry 13 字段
//   - compensation_context / failure_chain 用 JSONB（前者是嵌套对象，后
//     者是字符串数组——都适合 JSONB）
//   - 两类索引：
//     * idx_dlq_saga_id：support listBySaga（无 WHERE 限定）
//     * idx_dlq_pending：仅覆盖 status='pending' 的部分索引
//       （listPending 是最频繁的运维操作；已处理 / 归档行不查询性能成本）
//   - schema_version 单行表（id=1 CHECK）与 Step 3 saga_state_store /
//     Phase 8 event-store-postgres 同模式

export const SCHEMA_VERSION = "1.0.0";

export const createSchemaDdl = (schema: string): string =>
  `CREATE SCHEMA IF NOT EXISTS "${schema}"`;

export const createDeadLetterEntriesTableDdl = (schema: string): string => `
  CREATE TABLE IF NOT EXISTS "${schema}".dead_letter_entries (
    entry_id TEXT PRIMARY KEY,
    saga_id TEXT NOT NULL,
    step_name TEXT NOT NULL,
    status TEXT NOT NULL,
    enqueued_at TIMESTAMPTZ NOT NULL,
    attempt_count INTEGER NOT NULL,
    compensation_context JSONB NOT NULL,
    failure_chain JSONB NOT NULL,
    correlation_id TEXT,
    trace_id TEXT,
    last_attempt_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    processed_by TEXT,
    processing_notes TEXT
  )
`;

// listBySaga 查询索引（无 status 过滤）
export const createDeadLetterSagaIndexDdl = (schema: string): string => `
  CREATE INDEX IF NOT EXISTS idx_dlq_saga_id
    ON "${schema}".dead_letter_entries (saga_id)
`;

// listPending 部分索引：仅覆盖 pending 状态行；按 enqueued_at 排序便于
// 运维 dashboard 按时序展示。已处理 / 归档行不在本索引内（节省存储 + 写
// 入性能；status 字段更新时 postgres 自动从索引中移出）。
export const createDeadLetterPendingIndexDdl = (schema: string): string => `
  CREATE INDEX IF NOT EXISTS idx_dlq_pending
    ON "${schema}".dead_letter_entries (enqueued_at)
    WHERE status = 'pending'
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

// upsert by entry_id（last-write-wins 与 memory Adapter 一致）
export const upsertDeadLetterEntrySql = (schema: string): string => `
  INSERT INTO "${schema}".dead_letter_entries
    (entry_id, saga_id, step_name, status, enqueued_at, attempt_count,
     compensation_context, failure_chain, correlation_id, trace_id,
     last_attempt_at, processed_at, processed_by, processing_notes)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14)
  ON CONFLICT (entry_id) DO UPDATE SET
    saga_id = EXCLUDED.saga_id,
    step_name = EXCLUDED.step_name,
    status = EXCLUDED.status,
    enqueued_at = EXCLUDED.enqueued_at,
    attempt_count = EXCLUDED.attempt_count,
    compensation_context = EXCLUDED.compensation_context,
    failure_chain = EXCLUDED.failure_chain,
    correlation_id = EXCLUDED.correlation_id,
    trace_id = EXCLUDED.trace_id,
    last_attempt_at = EXCLUDED.last_attempt_at,
    processed_at = EXCLUDED.processed_at,
    processed_by = EXCLUDED.processed_by,
    processing_notes = EXCLUDED.processing_notes
`;

export const selectDeadLetterEntrySql = (schema: string): string => `
  SELECT entry_id, saga_id, step_name, status, enqueued_at, attempt_count,
    compensation_context, failure_chain, correlation_id, trace_id,
    last_attempt_at, processed_at, processed_by, processing_notes
  FROM "${schema}".dead_letter_entries
  WHERE entry_id = $1
`;

export const selectPendingDeadLetterEntriesSql = (schema: string): string => `
  SELECT entry_id, saga_id, step_name, status, enqueued_at, attempt_count,
    compensation_context, failure_chain, correlation_id, trace_id,
    last_attempt_at, processed_at, processed_by, processing_notes
  FROM "${schema}".dead_letter_entries
  WHERE status = 'pending'
  ORDER BY enqueued_at ASC
`;

export const selectDeadLetterEntriesBySagaSql = (schema: string): string => `
  SELECT entry_id, saga_id, step_name, status, enqueued_at, attempt_count,
    compensation_context, failure_chain, correlation_id, trace_id,
    last_attempt_at, processed_at, processed_by, processing_notes
  FROM "${schema}".dead_letter_entries
  WHERE saga_id = $1
  ORDER BY enqueued_at ASC
`;

// markAsProcessed 通过单 UPDATE 实现：status='pending' 才转换；其他状态
// 静默 no-op（语义对齐 memory adapter）。
// **NOTE**：本实现使用 Adapter 层判断后调 UPDATE，让"已是 processed 的
// 记录再次 mark"也覆盖（与 memory 一致 last-write-wins）；契约测试
// `test_markAsProcessed_for_unknown_entry_id_is_idempotent_no_op` 验证。
export const updateMarkAsProcessedSql = (schema: string): string => `
  UPDATE "${schema}".dead_letter_entries
  SET status = 'processed',
      processed_at = $2,
      processed_by = $3,
      processing_notes = $4
  WHERE entry_id = $1
`;
