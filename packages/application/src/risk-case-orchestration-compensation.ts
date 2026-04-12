import type { SagaStepName, CompensationPlan } from "./risk-case-orchestration-saga.js";

export type CompensationStepStatus =
  | "not_required"
  | "planned"
  | "executed"
  | "failed";

export type CompensationStepExecutionResult = {
  readonly stepName: SagaStepName;
  readonly compensationAction: string;
  readonly compensationStatus: CompensationStepStatus;
  readonly reason: string;
};

export type OrchestrationCompensationResult = {
  readonly orchestrationId: string;
  readonly caseId: string;
  readonly compensationStatus: "completed" | "partially_failed" | "not_needed";
  readonly executedCompensationSteps: readonly CompensationStepExecutionResult[];
  readonly failedCompensationStep: CompensationStepExecutionResult | null;
  readonly summary: string;
};

// Compensation action descriptors per step (skeleton — no real side effects)
const COMPENSATION_ACTIONS: Partial<Record<SagaStepName, string>> = {
  execute_candidate_selection: "revert_candidate_selection",
  execute_ranking: "revert_ranking",
  execute_fund_waterfall: "revert_fund_allocation"
};

export const executeOrchestrationCompensation = (
  orchestrationId: string,
  caseId: string,
  plan: CompensationPlan
): OrchestrationCompensationResult => {
  if (!plan.needed || plan.requirements.length === 0) {
    return {
      orchestrationId, caseId,
      compensationStatus: "not_needed",
      executedCompensationSteps: [],
      failedCompensationStep: null,
      summary: "No compensation needed"
    };
  }

  const allSteps = plan.requirements.flatMap(r => r.compensableSteps);
  const reversed = [...allSteps].reverse();

  const results: CompensationStepExecutionResult[] = reversed.map(stepName => ({
    stepName,
    compensationAction: COMPENSATION_ACTIONS[stepName] ?? `compensate_${stepName}`,
    compensationStatus: "executed" as CompensationStepStatus,
    reason: `Compensation executed for ${stepName} (skeleton — no real side effect)`
  }));

  return {
    orchestrationId, caseId,
    compensationStatus: "completed",
    executedCompensationSteps: results,
    failedCompensationStep: null,
    summary: `Compensation completed: ${results.length} step(s) reversed`
  };
};
