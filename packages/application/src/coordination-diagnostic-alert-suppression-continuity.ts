import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { StoredDiagnosticAlertSuppressionState } from "@tianqi/ports";

import { invalidApplicationCommandError } from "./application-error.js";
import {
  evaluateDiagnosticAlertSuppressionStateReadCompatibility
} from "./diagnostic-alert-suppression-state-read-compatibility.js";

type ContinuityValidationError = ReturnType<typeof invalidApplicationCommandError>;

export type DiagnosticAlertSuppressionContinuityStatus = "passed" | "notice" | "failed";
export type DiagnosticAlertSuppressionContinuityReasonCategory =
  | "validated"
  | "state_missing"
  | "schema_missing"
  | "schema_incompatible"
  | "suppression_key_mismatch"
  | "semantic_mismatch"
  | "repeat_count_regressed"
  | "invalid_timeline"
  | "status_mismatch"
  | "persisted_state_malformed";

export type DiagnosticAlertSuppressionContinuity = {
  readonly status: DiagnosticAlertSuppressionContinuityStatus;
  readonly reasonCategory: DiagnosticAlertSuppressionContinuityReasonCategory;
  readonly reason: string;
  readonly isContinuous: boolean;
};

export const validateSuppressionStateContinuity = (input: {
  readonly suppressionKey: string;
  readonly factKey: string;
  readonly reasonCategory: string;
  readonly severity: "info" | "warning" | "critical";
  readonly triggerSource: "replay_validation" | "history_slot_consistency";
  readonly currentRepeatCount: number;
  readonly currentFirstSeenAt: string;
  readonly currentLastSeenAt: string;
  readonly currentStatus: "emitted" | "deduplicated" | "suppressed_with_notice";
  readonly persistedState?: StoredDiagnosticAlertSuppressionState;
}): Result<DiagnosticAlertSuppressionContinuity, ContinuityValidationError> => {
  const timestampRangeValid = (firstSeenAt: string, lastSeenAt: string): boolean => {
    const first = Date.parse(firstSeenAt);
    const last = Date.parse(lastSeenAt);
    if (Number.isNaN(first) || Number.isNaN(last)) {
      return false;
    }
    return last >= first;
  };

  const expectedStatusFor = (repeatCount: number, severity: "info" | "warning" | "critical") =>
    repeatCount <= 1 ? "emitted" : severity === "critical" ? "suppressed_with_notice" : "deduplicated";

  if (!input.persistedState) {
    return ok({
      status: "notice",
      reasonCategory: "state_missing",
      reason: "No persisted suppression state found; using in-memory fresh continuity",
      isContinuous: false
    });
  }

  const readCompatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
    state: input.persistedState
  });
  if (readCompatibility.status === "missing_version") {
    return ok({
      status: "failed",
      reasonCategory: "schema_missing",
      reason: readCompatibility.reason,
      isContinuous: false
    });
  }
  if (readCompatibility.status === "incompatible_version") {
    return ok({
      status: "failed",
      reasonCategory: "schema_incompatible",
      reason: readCompatibility.reason,
      isContinuous: false
    });
  }
  if (readCompatibility.status === "malformed_state") {
    return ok({
      status: "failed",
      reasonCategory: "persisted_state_malformed",
      reason: readCompatibility.reason,
      isContinuous: false
    });
  }
  if (readCompatibility.status === "state_missing") {
    return err(invalidApplicationCommandError("Unexpected state_missing compatibility for present persisted suppression state"));
  }

  if (input.persistedState.suppressionKey !== input.suppressionKey) {
    return ok({
      status: "failed",
      reasonCategory: "suppression_key_mismatch",
      reason: "Persisted suppression key mismatches current suppression key",
      isContinuous: false
    });
  }
  if (
    input.persistedState.factKey !== input.factKey ||
    input.persistedState.reasonCategory !== input.reasonCategory ||
    input.persistedState.severity !== input.severity ||
    input.persistedState.triggerSource !== input.triggerSource
  ) {
    return ok({
      status: "failed",
      reasonCategory: "semantic_mismatch",
      reason: "Persisted suppression state semantic fields mismatch current alert semantic",
      isContinuous: false
    });
  }
  if (input.persistedState.repeatCount < 1 || !timestampRangeValid(input.persistedState.firstSeenAt, input.persistedState.lastSeenAt)) {
    return ok({
      status: "failed",
      reasonCategory: "persisted_state_malformed",
      reason: "Persisted suppression state is malformed: invalid repeatCount or timeline",
      isContinuous: false
    });
  }
  if (input.persistedState.repeatCount > input.currentRepeatCount) {
    return ok({
      status: "failed",
      reasonCategory: "repeat_count_regressed",
      reason: "Current repeatCount regressed against persisted suppression state",
      isContinuous: false
    });
  }
  if (!timestampRangeValid(input.currentFirstSeenAt, input.currentLastSeenAt)) {
    return ok({
      status: "failed",
      reasonCategory: "invalid_timeline",
      reason: "Current suppression timeline is invalid: lastSeenAt earlier than firstSeenAt",
      isContinuous: false
    });
  }
  const expectedPersistedStatus = expectedStatusFor(input.persistedState.repeatCount, input.persistedState.severity);
  if (input.persistedState.lastStatus !== expectedPersistedStatus) {
    return ok({
      status: "notice",
      reasonCategory: "status_mismatch",
      reason: "Persisted suppression lastStatus does not match persisted repeatCount/severity",
      isContinuous: false
    });
  }
  const expectedCurrentStatus = expectedStatusFor(input.currentRepeatCount, input.severity);
  if (input.currentStatus !== expectedCurrentStatus) {
    return ok({
      status: "notice",
      reasonCategory: "status_mismatch",
      reason: "Current suppression status does not match repeatCount/severity expectation",
      isContinuous: false
    });
  }

  if (readCompatibility.status === "compatible_with_notice") {
    return ok({
      status: "notice",
      reasonCategory: "schema_incompatible",
      reason: readCompatibility.reason,
      isContinuous: true
    });
  }

  return ok({
    status: "passed",
    reasonCategory: "validated",
    reason: "Suppression state continuity validated",
    isContinuous: true
  });
};
