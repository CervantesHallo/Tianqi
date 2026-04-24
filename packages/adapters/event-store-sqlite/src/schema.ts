export const SCHEMA_VERSION = "1.0.0";

export const EVENTS_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS events (
    append_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    producer TEXT NOT NULL,
    payload TEXT NOT NULL,
    metadata TEXT NOT NULL
  );
`;

export const EVENTS_INDEX_DDL = `
  CREATE INDEX IF NOT EXISTS idx_events_case_occurred_seq
    ON events (case_id, occurred_at, append_seq);
`;

export const SCHEMA_VERSION_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version TEXT NOT NULL
  );
`;

export const SCHEMA_VERSION_SEED_DML = `
  INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, '${SCHEMA_VERSION}');
`;

export const SCHEMA_VERSION_SELECT_SQL = `SELECT version FROM schema_version WHERE id = 1;`;

export const INSERT_EVENT_SQL = `
  INSERT OR IGNORE INTO events
    (event_id, event_type, event_version, trace_id, case_id, occurred_at, producer, payload, metadata)
  VALUES
    (@eventId, @eventType, @eventVersion, @traceId, @caseId, @occurredAt, @producer, @payload, @metadata);
`;

export const LIST_BY_CASE_SQL = `
  SELECT event_id, event_type, event_version, trace_id, case_id, occurred_at, producer, payload, metadata, append_seq
  FROM events
  WHERE case_id = ?
  ORDER BY occurred_at ASC, append_seq ASC;
`;

export const COUNT_TOTAL_SQL = `SELECT COUNT(*) AS total FROM events;`;
