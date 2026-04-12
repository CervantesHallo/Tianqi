import { createConfigVersion, createLiquidationCaseId, createRiskCaseId, createTraceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { LiquidationCase } from "./liquidation-case.js";
import { LiquidationCaseState } from "./liquidation-case-state.js";

describe("LiquidationCase", () => {
  it("creates a minimal liquidation case with initiated state", () => {
    const created = LiquidationCase.create({
      id: createLiquidationCaseId("liq-case-001"),
      sourceRiskCaseId: createRiskCaseId("risk-case-001"),
      traceId: createTraceId("trace-liq-create"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.state).toBe(LiquidationCaseState.Initiated);
      expect(created.value.sourceRiskCaseId).toBe("risk-case-001");
    }
  });

  it("prevents transition time from moving backwards", () => {
    const created = LiquidationCase.create({
      id: createLiquidationCaseId("liq-case-002"),
      sourceRiskCaseId: createRiskCaseId("risk-case-002"),
      traceId: createTraceId("trace-liq-invalid-time"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const transitioned = created.value.transitionTo(
      LiquidationCaseState.InProgress,
      new Date("2026-03-24T23:59:59.000Z")
    );
    expect(transitioned.ok).toBe(false);
    if (!transitioned.ok) {
      expect(transitioned.error.code).toBe("TQ-DOM-001");
    }
  });
});
