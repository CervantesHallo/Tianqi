import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

import type { DomainEventEnvelope } from "@tianqi/contracts";
import type {
  AdapterFoundation,
  AdapterHealthStatus,
  EventStorePort,
  EventStoreWriteError
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { EventId, Result, RiskCaseId } from "@tianqi/shared";

import {
  COUNT_TOTAL_SQL,
  EVENTS_INDEX_DDL,
  EVENTS_TABLE_DDL,
  INSERT_EVENT_SQL,
  LIST_BY_CASE_SQL,
  SCHEMA_VERSION,
  SCHEMA_VERSION_SEED_DML,
  SCHEMA_VERSION_SELECT_SQL,
  SCHEMA_VERSION_TABLE_DDL
} from "./schema.js";

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "event-store-sqlite";
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

type TestkitProbe = {
  readonly __testkitProbe: true;
  listByCaseId(
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]>;
  countTotal(): Promise<number>;
};

export type SqliteEventStore = EventStorePort & AdapterFoundation & TestkitProbe;

export type SqliteEventStoreOptions = Readonly<{
  databasePath: string;
}>;

const infError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): EventStoreWriteError => ({
  message: `${code}: ${action}`
});

const conError = (fieldName: string, reason: string): EventStoreWriteError => ({
  message: `TQ-CON-005: ${fieldName}: ${reason}`
});

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isSerializablePrimitive = (value: unknown): boolean =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const validateMetadataValues = (metadata: Record<string, unknown>): string | null => {
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (!isSerializablePrimitive(value)) {
      return `metadata.${key}`;
    }
  }
  return null;
};

const validateSchema = (
  event: DomainEventEnvelope<Record<string, unknown>>
): EventStoreWriteError | null => {
  if (!isNonEmptyString(event.eventId)) return conError("eventId", "missing or empty");
  if (!isNonEmptyString(event.eventType)) return conError("eventType", "missing or empty");
  if (!isNonEmptyString(event.caseId)) return conError("caseId", "missing or empty");
  if (!isNonEmptyString(event.traceId)) return conError("traceId", "missing or empty");
  if (!isNonEmptyString(event.producer)) return conError("producer", "missing or empty");
  if (!isNonEmptyString(event.occurredAt) || !ISO_8601_PATTERN.test(event.occurredAt)) {
    return conError("occurredAt", "not a UTC ISO-8601 string");
  }
  if (!isNonEmptyString(event.eventVersion) || !SEMVER_PATTERN.test(event.eventVersion)) {
    return conError("eventVersion", "not a semver string like 1.0.0");
  }
  if (event.metadata === null || event.metadata === undefined) {
    return conError("metadata", "missing");
  }
  if (typeof event.metadata !== "object") {
    return conError("metadata", "not an object");
  }
  if (!isNonEmptyString(event.metadata.sourceModule)) {
    return conError("metadata.sourceModule", "missing or empty");
  }
  if (!isNonEmptyString(event.metadata.schemaVersion)) {
    return conError("metadata.schemaVersion", "missing or empty");
  }
  const metadataValuesError = validateMetadataValues(
    event.metadata as unknown as Record<string, unknown>
  );
  if (metadataValuesError !== null) {
    return conError(metadataValuesError, "non-serializable value");
  }
  if (event.payload === null || typeof event.payload !== "object") {
    return conError("payload", "not an object");
  }
  return null;
};

type EventRow = {
  readonly event_id: string;
  readonly event_type: string;
  readonly event_version: string;
  readonly trace_id: string;
  readonly case_id: string;
  readonly occurred_at: string;
  readonly producer: string;
  readonly payload: string;
  readonly metadata: string;
};

const rowToEnvelope = (row: EventRow): DomainEventEnvelope<Record<string, unknown>> =>
  ({
    eventId: row.event_id as EventId,
    eventType: row.event_type,
    eventVersion: row.event_version,
    traceId: row.trace_id,
    caseId: row.case_id,
    occurredAt: row.occurred_at,
    producer: row.producer,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>
  }) as DomainEventEnvelope<Record<string, unknown>>;

export const createSqliteEventStore = (options: SqliteEventStoreOptions): SqliteEventStore => {
  const databasePath = options.databasePath;
  let state: LifecycleState = "created";
  let database: DatabaseType | null = null;
  let currentSchemaVersion: string | null = null;

  const openDatabase = (): DatabaseType => {
    try {
      return new Database(databasePath);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      const error = new Error(
        `TQ-INF-005: SQLite database is unreachable at ${databasePath}: ${reason}`
      );
      throw error;
    }
  };

  const bootstrapSchema = (db: DatabaseType): string => {
    db.exec(EVENTS_TABLE_DDL);
    db.exec(EVENTS_INDEX_DDL);
    db.exec(SCHEMA_VERSION_TABLE_DDL);
    db.exec(SCHEMA_VERSION_SEED_DML);
    const row = db.prepare(SCHEMA_VERSION_SELECT_SQL).get() as { version: string } | undefined;
    const actual = row?.version ?? "";
    if (actual !== SCHEMA_VERSION) {
      throw new Error(
        `TQ-INF-008: SQLite schema_version mismatch at ${databasePath}: expected ${SCHEMA_VERSION} but found ${actual}`
      );
    }
    return actual;
  };

  const append = async <TPayload extends Record<string, unknown>>(
    event: DomainEventEnvelope<TPayload>
  ): Promise<Result<void, EventStoreWriteError>> => {
    if (state === "shut_down") {
      return err(infError("TQ-INF-004", "append called after shutdown"));
    }
    if (state === "created" || database === null) {
      return err(infError("TQ-INF-003", "append called before init"));
    }

    const schemaError = validateSchema(event as DomainEventEnvelope<Record<string, unknown>>);
    if (schemaError !== null) {
      return err(schemaError);
    }

    const params = {
      eventId: event.eventId as string,
      eventType: event.eventType as string,
      eventVersion: event.eventVersion as string,
      traceId: event.traceId as string,
      caseId: event.caseId as string,
      occurredAt: event.occurredAt,
      producer: event.producer,
      payload: JSON.stringify(event.payload),
      metadata: JSON.stringify(event.metadata)
    };
    database.prepare(INSERT_EVENT_SQL).run(params);
    return ok(undefined);
  };

  const listByCaseId = async (
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]> => {
    if (database === null || state !== "running") return [];
    const rows = database.prepare(LIST_BY_CASE_SQL).all(caseId as string) as EventRow[];
    return rows.map(rowToEnvelope);
  };

  const countTotal = async (): Promise<number> => {
    if (database === null || state !== "running") return 0;
    const row = database.prepare(COUNT_TOTAL_SQL).get() as { total: number };
    return row.total;
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;
    const db = openDatabase();
    try {
      currentSchemaVersion = bootstrapSchema(db);
    } catch (cause) {
      db.close();
      throw cause;
    }
    database = db;
    state = "running";
  };

  const shutdown = async (): Promise<void> => {
    if (state === "shut_down") {
      return;
    }
    if (database !== null) {
      database.close();
      database = null;
    }
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName: ADAPTER_NAME,
    healthy: state === "running" && database !== null,
    details: {
      lifecycle: state,
      databasePath,
      schemaVersion: currentSchemaVersion ?? "unknown"
    },
    checkedAt: new Date().toISOString()
  });

  return {
    adapterName: ADAPTER_NAME,
    __testkitProbe: true,
    append,
    listByCaseId,
    countTotal,
    init,
    shutdown,
    healthCheck
  };
};
