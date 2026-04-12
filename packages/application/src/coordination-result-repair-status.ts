import type { ApplicationError } from "./application-error.js";
import { invalidApplicationCommandError } from "./application-error.js";

export type CoordinationResultRepairStatus =
  | "not_repaired"
  | "repair_failed_retryable"
  | "repair_failed_manual_confirmation_required"
  | "manually_confirmed"
  | "repaired";

export type CoordinationResultRepairLifecycleState = {
  readonly factKey: string;
  readonly repairStatus: CoordinationResultRepairStatus;
  readonly repairAttempts: number;
  readonly lastRepairOutcome?: "repaired" | "already_persisted" | "failed" | "manually_confirmed";
  readonly manualConfirmation: boolean;
  readonly lastErrorCode?: string;
  readonly lastUpdatedAt: string;
};

const manualConfirmationRequiredErrorCodes = new Set(["TQ-APP-007", "TQ-APP-008", "TQ-APP-002"]);

export const classifyRepairFailureStatus = (
  error: Pick<ApplicationError, "code">
): CoordinationResultRepairStatus =>
  manualConfirmationRequiredErrorCodes.has(error.code)
    ? "repair_failed_manual_confirmation_required"
    : "repair_failed_retryable";

export const canRetryUnderStatus = (status: CoordinationResultRepairStatus): boolean =>
  status === "repair_failed_retryable" || status === "manually_confirmed";

export const canConfirmManuallyUnderStatus = (status: CoordinationResultRepairStatus): boolean =>
  status === "repair_failed_retryable" || status === "repair_failed_manual_confirmation_required";

export const invalidRepairStatusTransitionError = (input: {
  readonly factKey: string;
  readonly from: CoordinationResultRepairStatus;
  readonly to: CoordinationResultRepairStatus;
  readonly reason: string;
}): ApplicationError =>
  invalidApplicationCommandError("Repair status transition is invalid for current phase", {
    factKey: input.factKey,
    from: input.from,
    to: input.to,
    reason: input.reason
  });
