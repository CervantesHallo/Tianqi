import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";
import type { CoordinationResultRepairStatus } from "./coordination-result-repair-status.js";
import {
  DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
} from "./coordination-result-diagnostic-assessment-rules.js";
import type {
  CoordinationDiagnosticAssessmentRules,
  CoordinationDiagnosticAssessmentRulesVersion
} from "./coordination-result-diagnostic-assessment-rules.js";

export type CoordinationResultDiagnosticRiskLevel = "low" | "medium" | "high";

export type CoordinationResultManualActionHint =
  | "no_action_needed"
  | "retry_repair_recommended"
  | "manual_confirmation_recommended"
  | "investigate_validation_conflict"
  | "investigate_missing_read_view"
  | "investigate_persistence_failure";

type AssessmentInput = {
  readonly currentReadViewStatus: CoordinationResultDiagnosticView["currentReadViewStatus"];
  readonly validationStatus: CoordinationResultDiagnosticView["validationStatus"];
  readonly repairStatus: CoordinationResultRepairStatus;
  readonly manualConfirmation: boolean;
  readonly lastQueryObservation?: CoordinationResultDiagnosticView["lastQueryObservation"];
  readonly lastPersistenceObservation?: CoordinationResultDiagnosticView["lastPersistenceObservation"];
  readonly lastRepairObservation?: CoordinationResultDiagnosticView["lastRepairObservation"];
};

export type CoordinationDiagnosticAssessment = {
  readonly assessmentRulesVersion: CoordinationDiagnosticAssessmentRulesVersion;
  readonly riskLevel: CoordinationResultDiagnosticRiskLevel;
  readonly manualActionHint: CoordinationResultManualActionHint;
  readonly riskReason: string;
  readonly actionHintReason: string;
};

const hasPersistenceFailureSignal = (input: AssessmentInput): boolean =>
  input.lastPersistenceObservation?.persistenceWriteFailed === true ||
  input.lastQueryObservation?.persistenceWriteFailed === true ||
  input.lastRepairObservation?.persistenceWriteFailed === true;

const highRiskAssessment = (
  input: AssessmentInput,
  rules: CoordinationDiagnosticAssessmentRules
): CoordinationDiagnosticAssessment | null => {
  if (rules.highRiskRules.validationFailedDirectHigh && input.validationStatus === "failed") {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "high",
      manualActionHint: "investigate_validation_conflict",
      riskReason: "Validation failure indicates potential data conflict across read-side sources",
      actionHintReason: "Validation conflict should be investigated before retry or manual confirmation"
    };
  }
  if (rules.highRiskRules.readViewMissingDirectHigh && input.currentReadViewStatus === "missing") {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "high",
      manualActionHint: "investigate_missing_read_view",
      riskReason: "Read-view is missing in both persisted store and fallback registry",
      actionHintReason: "Missing read-view requires manual investigation of source and persistence boundary"
    };
  }
  if (
    rules.highRiskRules.repairFailedManualConfirmationRequiredDirectHigh &&
    input.repairStatus === "repair_failed_manual_confirmation_required"
  ) {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "high",
      manualActionHint: "manual_confirmation_recommended",
      riskReason: "Repair failure is classified as manual-confirmation-required",
      actionHintReason: "Operator confirmation is recommended before any further handling"
    };
  }
  return null;
};

const mediumRiskAssessment = (
  input: AssessmentInput,
  rules: CoordinationDiagnosticAssessmentRules
): CoordinationDiagnosticAssessment | null => {
  if (rules.mediumRiskRules.persistenceFailureReadableDirectMedium && hasPersistenceFailureSignal(input)) {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "medium",
      manualActionHint: "investigate_persistence_failure",
      riskReason: "Persistence failure signal exists but current state remains readable",
      actionHintReason: "Investigate persistence boundary to prevent future degradation"
    };
  }
  if (rules.mediumRiskRules.repairFailedRetryableDirectMedium && input.repairStatus === "repair_failed_retryable") {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "medium",
      manualActionHint: "retry_repair_recommended",
      riskReason: "Repair is currently in retryable failure state",
      actionHintReason: "A controlled single retry is recommended"
    };
  }
  if (rules.mediumRiskRules.fallbackOnlyDirectMedium && input.currentReadViewStatus === "fallback_only") {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "medium",
      manualActionHint: hasPersistenceFailureSignal(input)
        ? "investigate_persistence_failure"
        : "retry_repair_recommended",
      riskReason: "Diagnostic currently depends on fallback registry without persisted read-view",
      actionHintReason: hasPersistenceFailureSignal(input)
        ? "Persistence failures were observed and should be investigated"
        : "Fallback-only state should be repaired to persisted read-view when possible"
    };
  }
  if (rules.mediumRiskRules.manuallyConfirmedDirectMedium && input.repairStatus === "manually_confirmed") {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "medium",
      manualActionHint: "retry_repair_recommended",
      riskReason: "Repair is manually confirmed but not yet converged to repaired",
      actionHintReason: "A later controlled retry can close the repair loop"
    };
  }
  return null;
};

export const buildCoordinationDiagnosticAssessment = (
  input: AssessmentInput,
  rules: CoordinationDiagnosticAssessmentRules = DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
): CoordinationDiagnosticAssessment => {
  const high = highRiskAssessment(input, rules);
  if (high) {
    return high;
  }

  const medium = mediumRiskAssessment(input, rules);
  if (medium) {
    return medium;
  }

  if (
    rules.lowRiskRules.persistedValidationPassedRepairedDirectLow &&
    input.currentReadViewStatus === "persisted" &&
    input.validationStatus === "passed" &&
    input.repairStatus === "repaired"
  ) {
    return {
      assessmentRulesVersion: rules.version,
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      riskReason: "Read-view is persisted with passed validation and repaired lifecycle state",
      actionHintReason: "No immediate manual action is needed"
    };
  }

  return {
    assessmentRulesVersion: rules.version,
    riskLevel: "low",
    manualActionHint: "no_action_needed",
    riskReason: "Read-view is stable with no active validation or repair risk signal",
    actionHintReason: "No immediate manual action is needed"
  };
};
