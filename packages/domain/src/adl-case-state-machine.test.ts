import { createADLCaseId, createConfigVersion, createRiskCaseId, createTraceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { ADLCase } from "./adl-case.js";
import { ADLCaseState } from "./adl-case-state.js";
import { ADLCaseStateMachine } from "./adl-case-state-machine.js";
import { ADLCaseTransitionAction } from "./adl-case-transition-action.js";

const createBaseAdlCase = (): ADLCase => {
  const created = ADLCase.create({
    id: createADLCaseId("adl-state-machine-001"),
    sourceRiskCaseId: createRiskCaseId("risk-state-machine-001"),
    traceId: createTraceId("trace-adl-sm-create"),
    configVersion: createConfigVersion(1),
    createdAt: new Date("2026-03-25T00:00:00.000Z")
  });
  if (!created.ok) {
    throw new Error("failed to create base adl case");
  }
  return created.value;
};

describe("ADLCaseStateMachine", () => {
  it("allows Initiated -> Queued", () => {
    const machine = new ADLCaseStateMachine();
    const result = machine.transition({
      adlCase: createBaseAdlCase(),
      action: ADLCaseTransitionAction.Queue,
      context: {
        traceId: createTraceId("trace-adl-sm-legal"),
        reason: "queue adl execution",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.after.state).toBe(ADLCaseState.Queued);
    }
  });

  it("rejects illegal Initiated -> Execute transition", () => {
    const machine = new ADLCaseStateMachine();
    const result = machine.transition({
      adlCase: createBaseAdlCase(),
      action: ADLCaseTransitionAction.Execute,
      context: {
        traceId: createTraceId("trace-adl-sm-illegal"),
        reason: "invalid execute without queue",
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
