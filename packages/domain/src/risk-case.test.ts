import { describe, expect, it } from "vitest";

import { createConfigVersion, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { CaseStage } from "./case-stage.js";
import { CaseState } from "./case-state.js";
import { RiskCase } from "./risk-case.js";
import { RISK_CASE_DOMAIN_EVENT_TYPES } from "./risk-case-domain-event.js";
import { RiskCaseType } from "./risk-case-type.js";

describe("RiskCase invariants", () => {
  it("creates risk case with default state/stage and timestamps", () => {
    const created = RiskCase.create({
      id: createRiskCaseId("case-001"),
      caseType: RiskCaseType.Liquidation,
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
      traceId: createTraceId("trace-case-create")
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.riskCase.state).toBe(CaseState.Detected);
      expect(created.value.riskCase.stage).toBe(CaseStage.Detection);
      expect(created.value.riskCase.updatedAt.toISOString()).toBe("2026-03-25T00:00:00.000Z");
      expect(created.value.events).toHaveLength(1);
      expect(created.value.events[0]?.eventType).toBe(RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseCreated);
    }
  });

  it("rejects mismatched state-stage pair during rehydrate", () => {
    const rebuilt = RiskCase.rehydrate({
      id: createRiskCaseId("case-mismatch"),
      caseType: RiskCaseType.ADL,
      state: CaseState.Detected,
      stage: CaseStage.Validation,
      configVersion: createConfigVersion(2),
      createdAt: new Date("2026-03-25T00:00:00.000Z"),
      updatedAt: new Date("2026-03-25T00:00:00.000Z")
    });

    expect(rebuilt.ok).toBe(false);
    if (!rebuilt.ok) {
      expect(rebuilt.error.code).toBe("TQ-DOM-004");
      expect(rebuilt.error.context.details?.state).toBe("Detected");
      expect(rebuilt.error.context.details?.stage).toBe("Validation");
    }
  });
});
