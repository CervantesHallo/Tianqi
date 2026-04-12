import { describe, expect, it } from "vitest";

import { createEventId, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { DOMAIN_EVENT_TYPES } from "./domain-event-type.js";
import { createDomainEventEnvelope } from "./domain-event-envelope.js";
import { createEventVersion } from "./event-version.js";
import type { RiskCaseCreatedEvent } from "./risk-case-created-event.js";
import type { RiskCaseStateTransitionedEvent } from "./risk-case-state-transitioned-event.js";

describe("risk case domain events", () => {
  it("creates RiskCaseCreated event structure", () => {
    const event = createDomainEventEnvelope({
      eventId: createEventId("event-created"),
      eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
      eventVersion: createEventVersion("1.0.0"),
      traceId: createTraceId("trace-created"),
      caseId: createRiskCaseId("case-created"),
      occurredAt: "2026-03-25T00:00:00.000Z",
      producer: "domain",
      payload: {
        caseType: "Liquidation",
        initialState: "Detected",
        initialStage: "Detection",
        configVersion: 1
      },
      metadata: {
        sourceModule: "domain",
        schemaVersion: "1.0.0"
      }
    });

    expect(event.ok).toBe(true);
    if (event.ok) {
      const typedEvent: RiskCaseCreatedEvent = event.value;
      expect(typedEvent.payload.initialState).toBe("Detected");
    }
  });

  it("creates RiskCaseStateTransitioned event structure", () => {
    const event = createDomainEventEnvelope({
      eventId: createEventId("event-transition"),
      eventType: DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned,
      eventVersion: createEventVersion("1.0.0"),
      traceId: createTraceId("trace-transition"),
      caseId: createRiskCaseId("case-transition"),
      occurredAt: "2026-03-25T00:00:01.000Z",
      producer: "domain",
      payload: {
        fromState: "Detected",
        toState: "Validating",
        fromStage: "Detection",
        toStage: "Validation",
        action: "StartValidation",
        reason: "risk detected",
        transitionedAt: "2026-03-25T00:00:01.000Z"
      },
      metadata: {
        sourceModule: "domain",
        schemaVersion: "1.0.0"
      }
    });

    expect(event.ok).toBe(true);
    if (event.ok) {
      const typedEvent: RiskCaseStateTransitionedEvent = event.value;
      expect(typedEvent.payload.toState).toBe("Validating");
    }
  });
});
