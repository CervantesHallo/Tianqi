import { describe, expect, it } from "vitest";
import {
  createSagaState,
  advanceSaga,
  recordStepSuccess,
  recordStepFailure,
  completeSaga
} from "./risk-case-orchestration-saga.js";

const T = "2026-03-25T00:00:00.000Z";

describe("Saga: lifecycle", () => {
  it("creates saga in started state", () => {
    const s = createSagaState("sg1", "c1", T);
    expect(s.sagaStatus).toBe("started");
    expect(s.currentStep).toBeNull();
    expect(s.completedSteps).toHaveLength(0);
    expect(s.failedStep).toBeNull();
    expect(s.compensationPlan.needed).toBe(false);
  });

  it("advances to in_progress", () => {
    let s = createSagaState("sg2", "c2", T);
    s = advanceSaga(s, "load_case");
    expect(s.sagaStatus).toBe("in_progress");
    expect(s.currentStep).toBe("load_case");
  });

  it("records step success", () => {
    let s = createSagaState("sg3", "c3", T);
    s = advanceSaga(s, "load_case");
    s = recordStepSuccess(s, "load_case", "ok");
    expect(s.completedSteps).toHaveLength(1);
    expect(s.completedSteps[0]!.status).toBe("succeeded");
  });

  it("completes saga", () => {
    let s = createSagaState("sg4", "c4", T);
    s = advanceSaga(s, "finalize");
    s = recordStepSuccess(s, "finalize", "done");
    s = completeSaga(s, T);
    expect(s.sagaStatus).toBe("completed");
    expect(s.completedAt).toBe(T);
  });
});

describe("Saga: failure and compensation", () => {
  it("fails without compensation when no compensable steps completed", () => {
    let s = createSagaState("sg5", "c5", T);
    s = advanceSaga(s, "load_case");
    s = recordStepFailure(s, "load_case", "not found");
    expect(s.sagaStatus).toBe("failed");
    expect(s.failedStep?.stepName).toBe("load_case");
    expect(s.compensationPlan.needed).toBe(false);
  });

  it("requires compensation when compensable steps already completed", () => {
    let s = createSagaState("sg6", "c6", T);
    s = advanceSaga(s, "execute_candidate_selection");
    s = recordStepSuccess(s, "execute_candidate_selection", "ok");
    s = advanceSaga(s, "execute_ranking");
    s = recordStepFailure(s, "execute_ranking", "ranking failed");
    expect(s.sagaStatus).toBe("compensation_required");
    expect(s.compensationPlan.needed).toBe(true);
    expect(s.compensationPlan.requirements).toHaveLength(1);
    expect(s.compensationPlan.requirements[0]!.compensableSteps).toContain("execute_candidate_selection");
  });
});
