export const SCHEMA_VERSION = "1.0.0";

export const createSchemaDdl = (schema: string): string =>
  `CREATE SCHEMA IF NOT EXISTS "${schema}"`;

export const createEventsTableDdl = (schema: string): string => `
  CREATE TABLE IF NOT EXISTS "${schema}".events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    producer TEXT NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB NOT NULL,
    append_seq BIGSERIAL NOT NULL
  )
`;

export const createEventsIndexDdl = (schema: string): string => `
  CREATE INDEX IF NOT EXISTS idx_events_case_occurred_seq
    ON "${schema}".events (case_id, occurred_at, append_seq)
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

export const insertEventSql = (schema: string): string => `
  INSERT INTO "${schema}".events
    (event_id, event_type, event_version, trace_id, case_id, occurred_at, producer, payload, metadata)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb)
  ON CONFLICT (event_id) DO NOTHING
`;

export const listByCaseSql = (schema: string): string => `
  SELECT event_id, event_type, event_version, trace_id, case_id, occurred_at, producer, payload, metadata, append_seq
  FROM "${schema}".events
  WHERE case_id = $1
  ORDER BY occurred_at ASC, append_seq ASC
`;

export const countTotalSql = (schema: string): string =>
  `SELECT COUNT(*)::bigint AS total FROM "${schema}".events`;
