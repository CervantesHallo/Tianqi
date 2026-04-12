import { describe, expect, it } from "vitest";
import { canResumeSaga, prepareSagaForResume } from "./orchestration-saga-resume.js";
import type { OrchestrationSagaState } from "./risk-case-orchestration-saga.js";

const T = "2026-03-25T00:00:00.000Z";

const makeSaga = (status: OrchestrationSagaState["sagaStatus"]): OrchestrationSagaState => ({
  sagaId: "sg1", caseId: "c1", sagaStatus: status, currentStep: null,
  completedSteps: [], failedStep: null,
  compensationPlan: { needed: false, requirements: [] },
  startedAt: T, completedAt: null
});

describe("Saga resume: eligibility rules", () => {
  it("failed → eligible", () => {
    const e = canResumeSaga(makeSaga("failed"));
    expect(e.eligible).toBe(true);
  });

  it("compensation_required → not eligible (must compensate first)", () => {
    const e = canResumeSaga(makeSaga("compensation_required"));
    expect(e.eligible).toBe(false);
    expect(e.reason).toContain("compensation");
  });

  it("completed → not eligible", () => {
    const e = canResumeSaga(makeSaga("completed"));
    expect(e.eligible).toBe(false);
    expect(e.reason).toContain("completed");
  });

  it("started → not eligible", () => {
    const e = canResumeSaga(makeSaga("started"));
    expect(e.eligible).toBe(false);
    expect(e.reason).toContain("active");
  });

  it("in_progress → not eligible", () => {
    const e = canResumeSaga(makeSaga("in_progress"));
    expect(e.eligible).toBe(false);
    expect(e.reason).toContain("active");
  });
});

describe("Saga resume: prepare", () => {
  it("resets failed saga to in_progress", () => {
    const failed: OrchestrationSagaState = {
      ...makeSaga("failed"),
      failedStep: { stepName: "execute_ranking", status: "failed", reason: "timeout" }
    };
    const resumed = prepareSagaForResume(failed);
    expect(resumed.sagaStatus).toBe("in_progress");
    expect(resumed.failedStep).toBeNull();
    expect(resumed.currentStep).toBeNull();
    expect(resumed.completedSteps).toEqual(failed.completedSteps);
  });
});
