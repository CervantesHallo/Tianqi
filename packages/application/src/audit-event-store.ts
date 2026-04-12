import type { Result } from "@tianqi/shared";

// ─── stored event model ─────────────────────────────────────────────────────

export type StoredAuditEvent = {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly traceId: string;
  readonly caseId: string;
  readonly occurredAt: string;
  readonly producer: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, string>;
  readonly storedAt: string;
  readonly sequenceNumber: number;
};

// ─── store error ────────────────────────────────────────────────────────────

export type AuditEventStoreError = {
  readonly code: string;
  readonly type: "event_store_append_failed" | "event_store_read_failed";
  readonly message: string;
};

// ─── port ───────────────────────────────────────────────────────────────────

export type AuditEventStorePort = {
  append(event: Omit<StoredAuditEvent, "storedAt" | "sequenceNumber">): Result<StoredAuditEvent, AuditEventStoreError>;
  listByCaseId(caseId: string): Result<readonly StoredAuditEvent[], AuditEventStoreError>;
  getByEventId(eventId: string): Result<StoredAuditEvent | null, AuditEventStoreError>;
};

// ─── in-memory implementation ───────────────────────────────────────────────

import { ok } from "@tianqi/shared";

export const createInMemoryAuditEventStore = (): AuditEventStorePort => {
  const events: StoredAuditEvent[] = [];
  let seq = 0;

  return {
    append(event) {
      const stored: StoredAuditEvent = {
        ...event,
        storedAt: new Date().toISOString(),
        sequenceNumber: ++seq
      };
      events.push(stored);
      return ok(stored);
    },
    listByCaseId(caseId) {
      return ok(events.filter(e => e.caseId === caseId));
    },
    getByEventId(eventId) {
      return ok(events.find(e => e.eventId === eventId) ?? null);
    }
  };
};
