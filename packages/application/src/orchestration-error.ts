import { ERROR_CODES } from "@tianqi/contracts";
import type { ApplicationErrorCode } from "@tianqi/contracts";

export type OrchestrationErrorType =
  | "idempotency_conflict"
  | "case_not_orchestrable"
  | "active_config_missing"
  | "bundle_resolution_failed"
  | "strategy_execution_failed"
  | "saga_step_failed"
  | "compensation_required"
  | "port_unavailable"
  | "compensation_execution_failed"
  | "replay_record_missing"
  | "audit_publish_failed"
  | "saga_resume_rejected";

export type OrchestrationError = {
  readonly code: ApplicationErrorCode;
  readonly type: OrchestrationErrorType;
  readonly message: string;
  readonly context: Record<string, string>;
};

export const idempotencyConflictError = (key: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_IDEMPOTENCY_CONFLICT,
  type: "idempotency_conflict",
  message: `Duplicate request rejected for idempotency key: ${key}`,
  context: { idempotencyKey: key }
});

export const caseNotOrchestrable = (caseId: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_CASE_NOT_ORCHESTRABLE,
  type: "case_not_orchestrable",
  message: `Case ${caseId} is not orchestrable: ${reason}`,
  context: { caseId, reason }
});

export const activeConfigMissing = (): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_ACTIVE_CONFIG_MISSING,
  type: "active_config_missing",
  message: "No active policy config version available for orchestration",
  context: {}
});

export const bundleResolutionFailed = (reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_BUNDLE_RESOLUTION_FAILED,
  type: "bundle_resolution_failed",
  message: `Policy bundle resolution failed: ${reason}`,
  context: { reason }
});

export const strategyExecutionFailed = (step: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_STRATEGY_EXECUTION_FAILED,
  type: "strategy_execution_failed",
  message: `Strategy execution failed at step ${step}: ${reason}`,
  context: { step, reason }
});

export const sagaStepFailed = (stepName: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_SAGA_STEP_FAILED,
  type: "saga_step_failed",
  message: `Saga step '${stepName}' failed: ${reason}`,
  context: { stepName, reason }
});

export const compensationRequired = (failedStep: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_COMPENSATION_REQUIRED,
  type: "compensation_required",
  message: `Compensation required after step '${failedStep}' failed: ${reason}`,
  context: { failedStep, reason }
});

export const portUnavailable = (portName: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_PORT_UNAVAILABLE,
  type: "port_unavailable",
  message: `Port '${portName}' is unavailable: ${reason}`,
  context: { portName, reason }
});

export const compensationExecutionFailed = (step: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_COMPENSATION_REQUIRED,
  type: "compensation_execution_failed",
  message: `Compensation execution failed at step '${step}': ${reason}`,
  context: { step, reason }
});

export const replayRecordMissing = (key: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_CONFLICT,
  type: "replay_record_missing",
  message: `Replay record not found for key: ${key}`,
  context: { idempotencyKey: key }
});

export const auditPublishFailed = (reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_PUBLISH_FAILED,
  type: "audit_publish_failed",
  message: `Audit event publish failed: ${reason}`,
  context: { reason }
});

export const sagaResumeRejected = (sagaId: string, reason: string): OrchestrationError => ({
  code: ERROR_CODES.APPLICATION_CONFLICT,
  type: "saga_resume_rejected",
  message: `Saga ${sagaId} resume rejected: ${reason}`,
  context: { sagaId, reason }
});
