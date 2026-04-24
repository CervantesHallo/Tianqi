import { URL } from "node:url";
import { setTimeout as scheduleTimer } from "node:timers";

import pg from "pg";
import type pgTypes from "pg";

import type { DomainEventEnvelope } from "@tianqi/contracts";
import type {
  AdapterFoundation,
  AdapterHealthStatus,
  EventStorePort,
  EventStoreWriteError
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result, RiskCaseId } from "@tianqi/shared";

import {
  countTotalSql,
  createEventsIndexDdl,
  createEventsTableDdl,
  createSchemaDdl,
  createSchemaVersionTableDdl,
  insertEventSql,
  listByCaseSql,
  SCHEMA_VERSION,
  seedSchemaVersionDml,
  selectSchemaVersionSql
} from "./schema.js";

const { Pool } = pg;
type PgPool = pgTypes.Pool;

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "event-store-postgres";
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const DEFAULT_POOL_SIZE = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
// Valid Postgres identifier: unquoted letters / digits / underscore; must not start with digit.
const VALID_SCHEMA_NAME = /^[a-z_][a-z0-9_]{0,62}$/;

type TestkitProbe = {
  readonly __testkitProbe: true;
  listByCaseId(
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]>;
  countTotal(): Promise<number>;
};

export type PostgresEventStore = EventStorePort & AdapterFoundation & TestkitProbe;

export type PostgresEventStoreOptions = Readonly<{
  connectionString: string;
  schema?: string;
  poolSize?: number;
  connectionTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
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

const redactConnectionTarget = (connectionString: string): string => {
  try {
    const url = new URL(connectionString);
    url.password = "";
    url.username = "";
    return url.toString();
  } catch {
    return "<invalid connection string>";
  }
};

type EventRow = {
  readonly event_id: string;
  readonly event_type: string;
  readonly event_version: string;
  readonly trace_id: string;
  readonly case_id: string;
  readonly occurred_at: Date;
  readonly producer: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
};

const rowToEnvelope = (row: EventRow): DomainEventEnvelope<Record<string, unknown>> =>
  ({
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    traceId: row.trace_id,
    caseId: row.case_id,
    occurredAt: row.occurred_at.toISOString(),
    producer: row.producer,
    payload: row.payload,
    metadata: row.metadata
  }) as DomainEventEnvelope<Record<string, unknown>>;

export const createPostgresEventStore = (
  options: PostgresEventStoreOptions
): PostgresEventStore => {
  const connectionString = options.connectionString;
  const schema = options.schema ?? "public";
  if (!VALID_SCHEMA_NAME.test(schema)) {
    throw new Error(
      `TQ-INF-002: Postgres schema name is invalid (must match ${String(VALID_SCHEMA_NAME)}): ${schema}`
    );
  }
  const poolSize = options.poolSize ?? DEFAULT_POOL_SIZE;
  const connectionTimeoutMs = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const connectionTarget = redactConnectionTarget(connectionString);

  let state: LifecycleState = "created";
  let pool: PgPool | null = null;
  let currentSchemaVersion: string | null = null;
  let lastSuccessAt: string | null = null;
  let lastError: string | null = null;

  const bootstrap = async (): Promise<void> => {
    if (pool === null) {
      throw new Error("TQ-INF-002: bootstrap called without pool");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (schema !== "public") {
        await client.query(createSchemaDdl(schema));
      }
      await client.query(createEventsTableDdl(schema));
      await client.query(createEventsIndexDdl(schema));
      await client.query(createSchemaVersionTableDdl(schema));
      await client.query(seedSchemaVersionDml(schema));
      const versionRow = (await client.query<{ version: string }>(selectSchemaVersionSql(schema)))
        .rows[0];
      const actual = versionRow?.version ?? "";
      if (actual !== SCHEMA_VERSION) {
        await client.query("ROLLBACK");
        throw new Error(
          `TQ-INF-008: Postgres schema_version mismatch in "${schema}": expected ${SCHEMA_VERSION} but found ${actual}`
        );
      }
      await client.query("COMMIT");
      currentSchemaVersion = actual;
    } catch (cause) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Transaction already unwound; swallow to keep the original cause.
      }
      throw cause;
    } finally {
      client.release();
    }
  };

  const append = async <TPayload extends Record<string, unknown>>(
    event: DomainEventEnvelope<TPayload>
  ): Promise<Result<void, EventStoreWriteError>> => {
    // Step 5 lesson: check shut_down before created/null so shutdown wins over null-pool.
    if (state === "shut_down") {
      return err(infError("TQ-INF-004", "append called after shutdown"));
    }
    if (state === "created" || pool === null) {
      return err(infError("TQ-INF-003", "append called before init"));
    }

    const schemaError = validateSchema(event as DomainEventEnvelope<Record<string, unknown>>);
    if (schemaError !== null) {
      return err(schemaError);
    }

    try {
      await pool.query(insertEventSql(schema), [
        event.eventId as string,
        event.eventType as string,
        event.eventVersion as string,
        event.traceId as string,
        event.caseId as string,
        event.occurredAt,
        event.producer,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata)
      ]);
      lastSuccessAt = new Date().toISOString();
      return ok(undefined);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      lastError = reason;
      return err({ message: `TQ-INF-001: Postgres append failed: ${reason}` });
    }
  };

  const listByCaseId = async (
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]> => {
    if (pool === null || state !== "running") return [];
    const res = await pool.query<EventRow>(listByCaseSql(schema), [caseId as string]);
    return res.rows.map(rowToEnvelope);
  };

  const countTotal = async (): Promise<number> => {
    if (pool === null || state !== "running") return 0;
    const res = await pool.query<{ total: string | number }>(countTotalSql(schema));
    return Number(res.rows[0]?.total ?? 0);
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;
    try {
      pool = new Pool({
        connectionString,
        max: poolSize,
        connectionTimeoutMillis: connectionTimeoutMs
      });
      // pg.Pool rejects unhandled errors on idle clients; attach a silent handler so
      // background disconnects cannot crash the Node process under vitest's watchdog.
      pool.on("error", (poolError) => {
        lastError = poolError.message;
      });
      await bootstrap();
      state = "running";
      lastSuccessAt = new Date().toISOString();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      lastError = reason;
      if (pool !== null) {
        await pool.end().catch(() => {
          // Pool teardown best-effort; bootstrap failure is already the originating error.
        });
        pool = null;
      }
      if (cause instanceof Error && cause.message.startsWith("TQ-INF-008:")) {
        throw cause;
      }
      throw new Error(`TQ-INF-009: Postgres server unreachable via ${connectionTarget}: ${reason}`);
    }
  };

  const shutdown = async (): Promise<void> => {
    if (state === "shut_down") return;
    if (pool !== null) {
      await pool.end().catch(() => {
        // Pool teardown best-effort; shutdown must never throw.
      });
      pool = null;
    }
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => {
    const baseDetails = {
      lifecycle: state,
      schemaVersion: currentSchemaVersion ?? "unknown",
      connectionTarget,
      lastSuccessAt: lastSuccessAt ?? "never",
      lastError: lastError ?? "none",
      healthCheckTimeoutMs
    };
    if (state !== "running" || pool === null) {
      return {
        adapterName: ADAPTER_NAME,
        healthy: false,
        details: {
          ...baseDetails,
          idleCount: 0,
          totalCount: 0,
          waitingCount: 0
        },
        checkedAt: new Date().toISOString()
      };
    }
    // Probe with an independent timeout so a network-stuck connection cannot block healthCheck.
    const probe = new Promise<boolean>((resolve) => {
      pool
        ?.query("SELECT 1 AS ok")
        .then(() => resolve(true))
        .catch((cause: unknown) => {
          lastError = cause instanceof Error ? cause.message : String(cause);
          resolve(false);
        });
    });
    const timeout = new Promise<boolean>((resolve) => {
      scheduleTimer(() => resolve(false), healthCheckTimeoutMs);
    });
    const healthy = await Promise.race([probe, timeout]);
    if (healthy) {
      lastSuccessAt = new Date().toISOString();
    }
    return {
      adapterName: ADAPTER_NAME,
      healthy,
      details: {
        ...baseDetails,
        idleCount: pool.idleCount,
        totalCount: pool.totalCount,
        waitingCount: pool.waitingCount
      },
      checkedAt: new Date().toISOString()
    };
  };

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
