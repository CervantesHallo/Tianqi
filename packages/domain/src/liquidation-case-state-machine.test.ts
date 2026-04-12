import {
  createConfigVersion,
  createLiquidationCaseId,
  createRiskCaseId,
  createTraceId
} from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { LiquidationCase } from "./liquidation-case.js";
import { LiquidationCaseState } from "./liquidation-case-state.js";
import { LiquidationCaseStateMachine } from "./liquidation-case-state-machine.js";
import { LiquidationCaseTransitionAction } from "./liquidation-case-transition-action.js";

const createBaseLiquidationCase = (): LiquidationCase => {
  const created = LiquidationCase.create({
    id: createLiquidationCaseId("liq-state-machine-001"),
    sourceRiskCaseId: createRiskCaseId("risk-state-machine-001"),
    traceId: createTraceId("trace-liq-sm-create"),
    configVersion: createConfigVersion(1),
    createdAt: new Date("2026-03-25T00:00:00.000Z")
  });
  if (!created.ok) {
    throw new Error("failed to create base liquidation case");
  }
  return created.value;
};

describe("LiquidationCaseStateMachine", () => {
  it("allows Initiated -> InProgress", () => {
    const machine = new LiquidationCaseStateMachine();
    const result = machine.transition({
      liquidationCase: createBaseLiquidationCase(),
      action: LiquidationCaseTransitionAction.StartProgress,
      context: {
        traceId: createTraceId("trace-liq-sm-legal"),
        reason: "start liquidation processing",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.after.state).toBe(LiquidationCaseState.InProgress);
    }
  });

  it("rejects illegal Initiated -> Complete transition", () => {
    const machine = new LiquidationCaseStateMachine();
    const result = machine.transition({
      liquidationCase: createBaseLiquidationCase(),
      action: LiquidationCaseTransitionAction.Complete,
      context: {
        traceId: createTraceId("trace-liq-sm-illegal"),
        reason: "invalid direct complete",
        triggeredBy: "manual",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-DOM-002");
    }
  });
});
