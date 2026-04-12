import { describe, expect, it } from "vitest";

import {
  RiskCase,
  RiskCaseStateMachine,
  RiskCaseType,
  TransitionAction
} from "@tianqi/domain";
import { createConfigVersion, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { mapRiskCaseDomainEventToContractEnvelope } from "./risk-case-domain-event-mapper.js";

describe("risk case domain event mapper", () => {
  it("maps RiskCaseCreated domain event to contract envelope", () => {
    const created = RiskCase.create({
      id: createRiskCaseId("case-map-created"),
      caseType: RiskCaseType.Liquidation,
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
      traceId: createTraceId("trace-map-created")
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const mapped = mapRiskCaseDomainEventToContractEnvelope(created.value.events[0]!);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.eventType).toBe("RiskCaseCreated");
      if (mapped.value.eventType === "RiskCaseCreated") {
        expect(mapped.value.payload.initialState).toBe("Detected");
      }
    }
  });

  it("maps transition domain event to contract envelope", () => {
    const created = RiskCase.create({
      id: createRiskCaseId("case-map-transition"),
      caseType: RiskCaseType.Liquidation,
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
      traceId: createTraceId("trace-map-transition-create")
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const stateMachine = new RiskCaseStateMachine();
    const transitioned = stateMachine.transition({
      riskCase: created.value.riskCase,
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-map-transition-run"),
        reason: "map test",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });
    expect(transitioned.ok).toBe(true);
    if (!transitioned.ok) {
      return;
    }

    const mapped = mapRiskCaseDomainEventToContractEnvelope(transitioned.value.events[0]!);
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.value.eventType).toBe("RiskCaseStateTransitioned");
      if (mapped.value.eventType === "RiskCaseStateTransitioned") {
        expect(mapped.value.payload.toState).toBe("Validating");
      }
    }
  });
});
