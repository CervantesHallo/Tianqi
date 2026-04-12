import { invalidApplicationCommandError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import type { DiagnosticAlertSuppressionPersistence } from "./coordination-diagnostic-alert-suppression.js";

export type DiagnosticAlertSuppressionStateRepairStatus =
  | "not_repaired"
  | "repair_failed_retryable"
  | "repair_failed_manual_confirmation_required"
  | "manually_confirmed"
  | "repaired";

export type DiagnosticAlertSuppressionStateRepairOutcome = "repaired" | "failed" | "noop" | "manually_confirmed";

export type DiagnosticAlertSuppressionStateRepairLifecycleState = {
  readonly targetSuppressionKey: string;
  readonly repairStatus: DiagnosticAlertSuppressionStateRepairStatus;
  readonly repairAttempts: number;
  readonly lastRepairOutcome?: DiagnosticAlertSuppressionStateRepairOutcome;
  readonly manualConfirmation: boolean;
  readonly lastReason?: string;
  readonly lastAttemptedAt?: string;
  readonly lastRepairedAt?: string;
  readonly schemaVersionBefore?: string;
  readonly schemaVersionAfter?: string;
  readonly lastUpdatedAt: string;
};

export const canRetrySuppressionStateRepairUnderStatus = (status: DiagnosticAlertSuppressionStateRepairStatus): boolean =>
  status === "repair_failed_retryable" || status === "manually_confirmed";

export const canConfirmSuppressionStateRepairManuallyUnderStatus = (
  status: DiagnosticAlertSuppressionStateRepairStatus
): boolean => status === "repair_failed_retryable" || status === "repair_failed_manual_confirmation_required";

export const invalidSuppressionStateRepairStatusTransitionError = (input: {
  readonly suppressionKey: string;
  readonly from: DiagnosticAlertSuppressionStateRepairStatus;
  readonly to: DiagnosticAlertSuppressionStateRepairStatus;
  readonly reason: string;
}): ApplicationError =>
  invalidApplicationCommandError("Suppression state repair status transition is invalid", {
    suppressionKey: input.suppressionKey,
    from: input.from,
    to: input.to,
    reason: input.reason
  });

export const mapContinuityFailureToRepairStatus = (input: {
  readonly persistence: DiagnosticAlertSuppressionPersistence;
}): DiagnosticAlertSuppressionStateRepairStatus => {
  if (input.persistence.continuityStatus === "passed") {
    return "not_repaired";
  }
  if (
    input.persistence.continuityReasonCategory === "suppression_key_mismatch" ||
    input.persistence.continuityReasonCategory === "semantic_mismatch"
  ) {
    return "repair_failed_manual_confirmation_required";
  }
  if (input.persistence.stateReadCompatibility === "incompatible_version") {
    return "repair_failed_manual_confirmation_required";
  }
  return "repair_failed_retryable";
};
