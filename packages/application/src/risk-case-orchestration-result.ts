import type { SagaStatus, SagaStepResult, CompensationPlan } from "./risk-case-orchestration-saga.js";
import type { IdempotencyStatus } from "./orchestration-idempotency.js";
import type { OrchestrationCompensationResult } from "./risk-case-orchestration-compensation.js";

export type OrchestrationResultStatus =
  | "succeeded"
  | "rejected"
  | "failed"
  | "compensation_required";

export type RiskCaseOrchestrationResult = {
  readonly orchestrationId: string;
  readonly caseId: string;
  readonly configVersion: string;
  readonly policyBundleSummary: string;
  readonly sagaStatus: SagaStatus;
  readonly idempotencyStatus: IdempotencyStatus;
  readonly executedSteps: readonly SagaStepResult[];
  readonly pendingCompensation: CompensationPlan;
  readonly compensationResult: OrchestrationCompensationResult | null;
  readonly auditEventSummary: string;
  readonly replayedFromPreviousResult: boolean;
  readonly auditSummary: string;
  readonly resultStatus: OrchestrationResultStatus;
  readonly resultSummary: string;
};
