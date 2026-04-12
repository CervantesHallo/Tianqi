import type { OrchestrationSagaState, SagaStatus } from "./risk-case-orchestration-saga.js";

export type SagaResumeEligibility = {
  readonly eligible: boolean;
  readonly reason: string;
};

const RESUMABLE_STATUSES: ReadonlySet<SagaStatus> = new Set(["failed"]);

export const canResumeSaga = (saga: OrchestrationSagaState): SagaResumeEligibility => {
  if (RESUMABLE_STATUSES.has(saga.sagaStatus)) {
    return { eligible: true, reason: `Saga in ${saga.sagaStatus} state is eligible for resume` };
  }
  if (saga.sagaStatus === "compensation_required") {
    return { eligible: false, reason: "Saga requires compensation before resume; execute compensation first" };
  }
  if (saga.sagaStatus === "completed") {
    return { eligible: false, reason: "Saga already completed; cannot resume" };
  }
  if (saga.sagaStatus === "started" || saga.sagaStatus === "in_progress") {
    return { eligible: false, reason: `Saga is ${saga.sagaStatus}; cannot resume an active saga` };
  }
  return { eligible: false, reason: `Unknown saga status: ${saga.sagaStatus as string}` };
};

export const prepareSagaForResume = (saga: OrchestrationSagaState): OrchestrationSagaState => ({
  ...saga,
  sagaStatus: "in_progress",
  currentStep: null,
  failedStep: null
});
