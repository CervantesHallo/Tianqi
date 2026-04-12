import { createADLCaseId, createConfigVersion, createRiskCaseId, createTraceId } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { ADLCase } from "./adl-case.js";
import { ADLCaseState } from "./adl-case-state.js";

describe("ADLCase", () => {
  it("creates a minimal adl case with initiated state", () => {
    const created = ADLCase.create({
      id: createADLCaseId("adl-case-001"),
      sourceRiskCaseId: createRiskCaseId("risk-case-001"),
      traceId: createTraceId("trace-adl-create"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });

    expect(created.ok).toBe(true);
    if (created.ok) {
      expect(created.value.state).toBe(ADLCaseState.Initiated);
      expect(created.value.sourceRiskCaseId).toBe("risk-case-001");
    }
  });

  it("prevents transition time from moving backwards", () => {
    const created = ADLCase.create({
      id: createADLCaseId("adl-case-002"),
      sourceRiskCaseId: createRiskCaseId("risk-case-002"),
      traceId: createTraceId("trace-adl-invalid-time"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const transitioned = created.value.transitionTo(
      ADLCaseState.Queued,
      new Date("2026-03-24T23:59:59.000Z")
    );
    expect(transitioned.ok).toBe(false);
    if (!transitioned.ok) {
      expect(transitioned.error.code).toBe("TQ-DOM-001");
    }
  });
});
