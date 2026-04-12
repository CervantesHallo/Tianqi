import type {
  StoredDiagnosticAlertSuppressionStateRepairLifecycle,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot
} from "@tianqi/ports";
import { ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { ApplicationError } from "./application-error.js";
import { invalidApplicationCommandError } from "./application-error.js";
import type { DiagnosticAlertSuppressionStateRepairLifecycleState } from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import {
  validateDiagnosticAlertSuppressionRepairLifecycleSlotSchemaVersion
} from "./diagnostic-alert-suppression-repair-lifecycle-slot-schema.js";

export type SuppressionRepairLifecycleContinuityStatus = "passed" | "notice" | "failed";

export type SuppressionRepairLifecycleContinuityReasonCategory =
  | "validated"
  | "slot_missing"
  | "schema_missing"
  | "schema_incompatible"
  | "suppression_key_mismatch"
  | "live_conflict"
  | "attempts_regressed"
  | "manual_status_mismatch"
  | "invalid_timeline"
  | "invalid_transition";

export type SuppressionRepairLifecycleContinuity = {
  readonly status: SuppressionRepairLifecycleContinuityStatus;
  readonly reasonCategory: SuppressionRepairLifecycleContinuityReasonCategory;
  readonly reason: string;
  readonly isContinuous: boolean;
};

const isManualAndStatusConsistent = (
  lifecycle:
    | StoredDiagnosticAlertSuppressionStateRepairLifecycle
    | DiagnosticAlertSuppressionStateRepairLifecycleState
): boolean => {
  if (!lifecycle.manualConfirmation) {
    return true;
  }
  return lifecycle.repairStatus === "manually_confirmed" || lifecycle.repairStatus === "repaired";
};

const hasValidTimeline = (
  lifecycle:
    | StoredDiagnosticAlertSuppressionStateRepairLifecycle
    | DiagnosticAlertSuppressionStateRepairLifecycleState
): boolean => {
  if (!lifecycle.lastAttemptedAt) {
    return true;
  }
  const attemptedAt = Date.parse(lifecycle.lastAttemptedAt);
  if (Number.isNaN(attemptedAt)) {
    return false;
  }
  if (!lifecycle.lastRepairedAt) {
    return true;
  }
  const repairedAt = Date.parse(lifecycle.lastRepairedAt);
  if (Number.isNaN(repairedAt)) {
    return false;
  }
  return repairedAt >= attemptedAt;
};

const canTransition = (
  from: StoredDiagnosticAlertSuppressionStateRepairLifecycle["repairStatus"],
  to: StoredDiagnosticAlertSuppressionStateRepairLifecycle["repairStatus"]
): boolean => {
  if (from === to) {
    return true;
  }
  if (from === "not_repaired") {
    return to === "repaired" || to === "repair_failed_retryable" || to === "repair_failed_manual_confirmation_required";
  }
  if (from === "repair_failed_retryable") {
    return to === "repaired" || to === "manually_confirmed" || to === "repair_failed_manual_confirmation_required";
  }
  if (from === "repair_failed_manual_confirmation_required") {
    return to === "manually_confirmed" || to === "repair_failed_retryable";
  }
  if (from === "manually_confirmed") {
    return to === "repaired" || to === "repair_failed_retryable" || to === "repair_failed_manual_confirmation_required";
  }
  return false;
};

export const validateSuppressionRepairLifecycleContinuity = (input: {
  readonly suppressionKey: string;
  readonly liveLifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState;
  readonly persistedSlot?: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot;
}): Result<SuppressionRepairLifecycleContinuity, ApplicationError> => {
  if (!input.persistedSlot) {
    return ok({
      status: "notice",
      reasonCategory: "slot_missing",
      reason: "No persisted suppression repair lifecycle slot found; using in-memory lifecycle",
      isContinuous: false
    });
  }

  const schemaValidated = validateDiagnosticAlertSuppressionRepairLifecycleSlotSchemaVersion(input.persistedSlot.schemaVersion);
  if (!schemaValidated.ok) {
    return ok({
      status: schemaValidated.error.code === "TQ-APP-007" ? "failed" : "failed",
      reasonCategory: schemaValidated.error.code === "TQ-APP-007" ? "schema_missing" : "schema_incompatible",
      reason: schemaValidated.error.message,
      isContinuous: false
    });
  }

  if (
    input.persistedSlot.suppressionKey !== input.suppressionKey ||
    input.persistedSlot.currentLifecycle.targetSuppressionKey !== input.suppressionKey
  ) {
    return ok({
      status: "failed",
      reasonCategory: "suppression_key_mismatch",
      reason: "Persisted lifecycle suppressionKey mismatches requested suppressionKey",
      isContinuous: false
    });
  }

  if (!isManualAndStatusConsistent(input.persistedSlot.currentLifecycle)) {
    return ok({
      status: "failed",
      reasonCategory: "manual_status_mismatch",
      reason: "Persisted current lifecycle has invalid manualConfirmation/status combination",
      isContinuous: false
    });
  }
  if (!hasValidTimeline(input.persistedSlot.currentLifecycle)) {
    return ok({
      status: "failed",
      reasonCategory: "invalid_timeline",
      reason: "Persisted current lifecycle timeline is invalid",
      isContinuous: false
    });
  }
  if (
    input.persistedSlot.previousLifecycle &&
    (!isManualAndStatusConsistent(input.persistedSlot.previousLifecycle) ||
      !hasValidTimeline(input.persistedSlot.previousLifecycle))
  ) {
    return ok({
      status: "failed",
      reasonCategory: "invalid_timeline",
      reason: "Persisted previous lifecycle is malformed",
      isContinuous: false
    });
  }

  if (
    input.persistedSlot.previousLifecycle &&
    input.persistedSlot.currentLifecycle.repairAttempts < input.persistedSlot.previousLifecycle.repairAttempts
  ) {
    return ok({
      status: "failed",
      reasonCategory: "attempts_regressed",
      reason: "Persisted lifecycle current attempts regressed against previous lifecycle",
      isContinuous: false
    });
  }
  if (
    input.persistedSlot.currentLifecycle.repairAttempts < input.liveLifecycle.repairAttempts
  ) {
    return ok({
      status: "failed",
      reasonCategory: "attempts_regressed",
      reason: "Persisted lifecycle attempts regressed against live in-memory lifecycle",
      isContinuous: false
    });
  }
  if (
    input.liveLifecycle.repairAttempts > 0 &&
    (input.persistedSlot.currentLifecycle.repairStatus !== input.liveLifecycle.repairStatus ||
      input.persistedSlot.currentLifecycle.manualConfirmation !== input.liveLifecycle.manualConfirmation)
  ) {
    return ok({
      status: "failed",
      reasonCategory: "live_conflict",
      reason: "Persisted lifecycle conflicts with live in-memory lifecycle",
      isContinuous: false
    });
  }

  if (
    input.persistedSlot.previousLifecycle &&
    !canTransition(input.persistedSlot.previousLifecycle.repairStatus, input.persistedSlot.currentLifecycle.repairStatus)
  ) {
    return ok({
      status: "failed",
      reasonCategory: "invalid_transition",
      reason: "Persisted lifecycle previous->current transition is invalid",
      isContinuous: false
    });
  }

  return ok({
    status: "passed",
    reasonCategory: "validated",
    reason: "Suppression repair lifecycle continuity validated",
    isContinuous: true
  });
};

export const invalidSuppressionRepairLifecycleContinuityError = (message: string): ApplicationError =>
  invalidApplicationCommandError(message);

