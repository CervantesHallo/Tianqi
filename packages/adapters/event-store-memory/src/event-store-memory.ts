import type { DomainEventEnvelope } from "@tianqi/contracts";
import type {
  AdapterFoundation,
  AdapterHealthStatus,
  EventStorePort,
  EventStoreWriteError
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { EventId, Result, RiskCaseId } from "@tianqi/shared";

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "event-store-memory";
const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

type StoredEntry = {
  readonly event: DomainEventEnvelope<Record<string, unknown>>;
  readonly appendSeq: number;
};

type TestkitProbe = {
  readonly __testkitProbe: true;
  listByCaseId(
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]>;
  countTotal(): Promise<number>;
};

export type InMemoryEventStore = EventStorePort & AdapterFoundation & TestkitProbe;

export type InMemoryEventStoreOptions = Readonly<Record<string, never>>;

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

const cloneEnvelope = (
  event: DomainEventEnvelope<Record<string, unknown>>
): DomainEventEnvelope<Record<string, unknown>> =>
  JSON.parse(JSON.stringify(event)) as DomainEventEnvelope<Record<string, unknown>>;

export const createInMemoryEventStore = (
  _options: InMemoryEventStoreOptions = {} as InMemoryEventStoreOptions
): InMemoryEventStore => {
  const entries: StoredEntry[] = [];
  const eventIds = new Set<EventId>();
  let state: LifecycleState = "created";
  let appendCounter = 0;

  const append = async <TPayload extends Record<string, unknown>>(
    event: DomainEventEnvelope<TPayload>
  ): Promise<Result<void, EventStoreWriteError>> => {
    if (state === "created") {
      return err(infError("TQ-INF-003", "append called before init"));
    }
    if (state === "shut_down") {
      return err(infError("TQ-INF-004", "append called after shutdown"));
    }

    const schemaError = validateSchema(event as DomainEventEnvelope<Record<string, unknown>>);
    if (schemaError !== null) {
      return err(schemaError);
    }

    if (eventIds.has(event.eventId)) {
      return ok(undefined);
    }

    eventIds.add(event.eventId);
    entries.push({
      event: cloneEnvelope(event as DomainEventEnvelope<Record<string, unknown>>),
      appendSeq: appendCounter
    });
    appendCounter += 1;
    return ok(undefined);
  };

  const listByCaseId = async (
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]> => {
    const filtered = entries.filter((entry) => entry.event.caseId === caseId);
    const sorted = [...filtered].sort((a, b) => {
      if (a.event.occurredAt < b.event.occurredAt) return -1;
      if (a.event.occurredAt > b.event.occurredAt) return 1;
      return a.appendSeq - b.appendSeq;
    });
    return sorted.map((entry) => cloneEnvelope(entry.event));
  };

  const countTotal = async (): Promise<number> => entries.length;

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;
    state = "running";
  };

  const shutdown = async (): Promise<void> => {
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName: ADAPTER_NAME,
    healthy: state === "running",
    details: {
      lifecycle: state,
      eventCount: entries.length
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
