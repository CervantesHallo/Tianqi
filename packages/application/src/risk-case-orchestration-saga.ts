// Saga state machine for risk case orchestration.
// Each step is explicit; no hidden booleans.

export type SagaStatus =
  | "started"
  | "in_progress"
  | "completed"
  | "failed"
  | "compensation_required";

export type SagaStepName =
  | "load_case"
  | "load_active_config"
  | "resolve_bundle"
  | "execute_candidate_selection"
  | "execute_ranking"
  | "execute_fund_waterfall"
  | "finalize";

export type SagaStepResult = {
  readonly stepName: SagaStepName;
  readonly status: "succeeded" | "failed" | "skipped";
  readonly reason: string;
};

export type CompensationRequirement = {
  readonly failedStep: SagaStepName;
  readonly reason: string;
  readonly compensableSteps: readonly SagaStepName[];
};

export type CompensationPlan = {
  readonly needed: boolean;
  readonly requirements: readonly CompensationRequirement[];
};

export type OrchestrationSagaState = {
  readonly sagaId: string;
  readonly caseId: string;
  readonly sagaStatus: SagaStatus;
  readonly currentStep: SagaStepName | null;
  readonly completedSteps: readonly SagaStepResult[];
  readonly failedStep: SagaStepResult | null;
  readonly compensationPlan: CompensationPlan;
  readonly startedAt: string;
  readonly completedAt: string | null;
};

const COMPENSABLE_STEPS: ReadonlySet<SagaStepName> = new Set([
  "execute_candidate_selection",
  "execute_ranking",
  "execute_fund_waterfall"
]);

export const createSagaState = (sagaId: string, caseId: string, startedAt: string): OrchestrationSagaState => ({
  sagaId,
  caseId,
  sagaStatus: "started",
  currentStep: null,
  completedSteps: [],
  failedStep: null,
  compensationPlan: { needed: false, requirements: [] },
  startedAt,
  completedAt: null
});

export const advanceSaga = (
  state: OrchestrationSagaState,
  stepName: SagaStepName
): OrchestrationSagaState => ({
  ...state,
  sagaStatus: "in_progress",
  currentStep: stepName
});

export const recordStepSuccess = (
  state: OrchestrationSagaState,
  stepName: SagaStepName,
  reason: string
): OrchestrationSagaState => ({
  ...state,
  completedSteps: [...state.completedSteps, { stepName, status: "succeeded", reason }]
});

export const recordStepFailure = (
  state: OrchestrationSagaState,
  stepName: SagaStepName,
  reason: string
): OrchestrationSagaState => {
  const failedResult: SagaStepResult = { stepName, status: "failed", reason };
  const compensableCompleted = state.completedSteps
    .filter(s => s.status === "succeeded" && COMPENSABLE_STEPS.has(s.stepName))
    .map(s => s.stepName);
  const needsCompensation = compensableCompleted.length > 0;

  return {
    ...state,
    sagaStatus: needsCompensation ? "compensation_required" : "failed",
    currentStep: null,
    failedStep: failedResult,
    compensationPlan: needsCompensation
      ? {
          needed: true,
          requirements: [{
            failedStep: stepName,
            reason,
            compensableSteps: compensableCompleted
          }]
        }
      : state.compensationPlan
  };
};

export const completeSaga = (
  state: OrchestrationSagaState,
  completedAt: string
): OrchestrationSagaState => ({
  ...state,
  sagaStatus: "completed",
  currentStep: null,
  completedAt
});
