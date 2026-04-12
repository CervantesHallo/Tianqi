import type { DiagnosticHistoryReplayValidationResult } from "./coordination-diagnostic-history-replay-validation.js";

export type DiagnosticReplayOperationalHint =
  | "no_operational_action_needed"
  | "review_version_compatibility"
  | "inspect_history_slot_schema"
  | "inspect_fact_key_mapping"
  | "inspect_snapshot_conflict"
  | "manual_diagnostic_review_required";

export type DiagnosticReadAlert = {
  readonly severity: "info" | "warning" | "critical";
  readonly alertCode: string;
  readonly alertSummary: string;
  readonly operationalHint: DiagnosticReplayOperationalHint;
  readonly triggerSource: "replay_validation" | "history_slot_consistency";
  readonly requiresAttention: boolean;
};

export type DiagnosticReplayOperationalAssessment = {
  readonly operationalHint: DiagnosticReplayOperationalHint;
  readonly operationalHintReason: string;
};

export const buildDiagnosticReplayOperationalHint = (
  replayValidation: DiagnosticHistoryReplayValidationResult
): DiagnosticReplayOperationalAssessment => {
  if (replayValidation.status === "passed") {
    return {
      operationalHint: "no_operational_action_needed",
      operationalHintReason: "Replay validation passed with no actionable conflict"
    };
  }

  switch (replayValidation.reasonCategory) {
    case "version_mismatch":
      return {
        operationalHint: "review_version_compatibility",
        operationalHintReason: "Replay validation indicates version compatibility drift"
      };
    case "schema_incompatible":
      return {
        operationalHint: "inspect_history_slot_schema",
        operationalHintReason: "Replay validation indicates history slot schema incompatibility"
      };
    case "fact_key_mismatch":
      return {
        operationalHint: "inspect_fact_key_mapping",
        operationalHintReason: "Replay validation indicates fact key mapping mismatch"
      };
    case "current_snapshot_conflict":
    case "previous_snapshot_conflict":
    case "status_field_conflict":
    case "rules_version_conflict":
      return {
        operationalHint: "inspect_snapshot_conflict",
        operationalHintReason: "Replay validation indicates snapshot/status conflict requiring inspection"
      };
    default:
      return replayValidation.status === "failed"
        ? {
            operationalHint: "manual_diagnostic_review_required",
            operationalHintReason: "Replay validation failed with unclassified category"
          }
        : {
            operationalHint: "inspect_snapshot_conflict",
            operationalHintReason: "Replay validation notice requires conflict inspection"
          };
  }
};

export const buildDiagnosticReadAlert = (input: {
  readonly replayValidation: DiagnosticHistoryReplayValidationResult;
  readonly operationalHint: DiagnosticReplayOperationalHint;
  readonly triggerSource: "replay_validation" | "history_slot_consistency";
}): DiagnosticReadAlert => {
  const severity: DiagnosticReadAlert["severity"] =
    input.replayValidation.status === "failed"
      ? "critical"
      : input.replayValidation.status === "notice"
        ? "warning"
        : "info";

  const statusCodePrefix =
    input.replayValidation.status === "failed"
      ? "TQ-DIAG-CRIT"
      : input.replayValidation.status === "notice"
        ? "TQ-DIAG-WARN"
        : "TQ-DIAG-INFO";

  return {
    severity,
    alertCode: `${statusCodePrefix}-${input.replayValidation.reasonCategory.toUpperCase()}`,
    alertSummary: input.replayValidation.reason,
    operationalHint: input.operationalHint,
    triggerSource: input.triggerSource,
    requiresAttention: input.replayValidation.status !== "passed"
  };
};
