import { describe, expect, it } from "vitest";
import { executeOrchestrationCompensation } from "./risk-case-orchestration-compensation.js";
import type { CompensationPlan } from "./risk-case-orchestration-saga.js";

describe("Compensation: execution skeleton", () => {
  it("returns not_needed when plan is empty", () => {
    const plan: CompensationPlan = { needed: false, requirements: [] };
    const r = executeOrchestrationCompensation("o1", "c1", plan);
    expect(r.compensationStatus).toBe("not_needed");
    expect(r.executedCompensationSteps).toHaveLength(0);
  });

  it("executes compensation steps in reverse order", () => {
    const plan: CompensationPlan = {
      needed: true,
      requirements: [{
        failedStep: "execute_fund_waterfall",
        reason: "timeout",
        compensableSteps: ["execute_candidate_selection", "execute_ranking"]
      }]
    };
    const r = executeOrchestrationCompensation("o2", "c2", plan);
    expect(r.compensationStatus).toBe("completed");
    expect(r.executedCompensationSteps).toHaveLength(2);
    expect(r.executedCompensationSteps[0]!.stepName).toBe("execute_ranking");
    expect(r.executedCompensationSteps[1]!.stepName).toBe("execute_candidate_selection");
    expect(r.executedCompensationSteps[0]!.compensationAction).toBe("revert_ranking");
    expect(r.executedCompensationSteps[1]!.compensationAction).toBe("revert_candidate_selection");
  });

  it("each step has correct status fields", () => {
    const plan: CompensationPlan = {
      needed: true,
      requirements: [{
        failedStep: "execute_ranking",
        reason: "crash",
        compensableSteps: ["execute_candidate_selection"]
      }]
    };
    const r = executeOrchestrationCompensation("o3", "c3", plan);
    expect(r.executedCompensationSteps[0]!.compensationStatus).toBe("executed");
    expect(r.failedCompensationStep).toBeNull();
    expect(r.summary).toContain("1 step(s)");
  });

  it("result is serializable", () => {
    const plan: CompensationPlan = {
      needed: true,
      requirements: [{ failedStep: "execute_ranking", reason: "err", compensableSteps: ["execute_candidate_selection"] }]
    };
    const r = executeOrchestrationCompensation("o4", "c4", plan);
    const json = JSON.parse(JSON.stringify(r));
    expect(json.orchestrationId).toBe("o4");
    expect(json.compensationStatus).toBe("completed");
  });
});
