import { describe, expect, it } from "vitest";

import { createEventId, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { DOMAIN_EVENT_TYPES } from "./domain-event-type.js";
import { createDomainEventEnvelope } from "./domain-event-envelope.js";
import { createEventVersion } from "./event-version.js";

describe("domain event envelope", () => {
  it("builds an envelope with mandatory contract fields", () => {
    const envelope = createDomainEventEnvelope({
      eventId: createEventId("event-001"),
      eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
      eventVersion: createEventVersion("1.0.0"),
      traceId: createTraceId("trace-001"),
      caseId: createRiskCaseId("case-001"),
      occurredAt: "2026-03-25T00:00:00.000Z",
      producer: "domain-test",
      payload: { action: "detect" },
      metadata: {
        sourceModule: "contracts-test",
        schemaVersion: "1.0.0"
      }
    });

    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expect(envelope.value.eventType).toBe("RiskCaseCreated");
      expect(envelope.value.metadata.sourceModule).toBe("contracts-test");
    }
  });

  it("rejects invalid occurredAt format", () => {
    const envelope = createDomainEventEnvelope({
      eventId: createEventId("event-002"),
      eventType: DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned,
      eventVersion: createEventVersion("1.0.0"),
      traceId: createTraceId("trace-002"),
      caseId: createRiskCaseId("case-002"),
      occurredAt: "2026/03/25",
      producer: "domain-test",
      payload: { action: "transition" },
      metadata: {
        sourceModule: "contracts-test",
        schemaVersion: "1.0.0"
      }
    });

    expect(envelope.ok).toBe(false);
    if (!envelope.ok) {
      expect(envelope.error.code).toBe("TQ-CON-003");
    }
  });
});
