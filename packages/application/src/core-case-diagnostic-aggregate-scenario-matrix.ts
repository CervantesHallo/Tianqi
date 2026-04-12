import type { Phase2AggregateFailureSemantic } from "./core-case-diagnostic-aggregate-baseline.js";
import type { Phase2AggregateBaselineCoreField } from "./core-case-diagnostic-aggregate-baseline-consistency.js";

export type Phase2AggregateScenarioCategory =
  | "stable"
  | "repair"
  | "manual_review"
  | "continuity"
  | "accountability"
  | "failure_combination";

export type Phase2AggregateScenarioMatrixEntry = {
  readonly matrixId: string;
  readonly scenarioCategory: Phase2AggregateScenarioCategory;
  readonly baselineId: string;
  readonly variantName: string;
  readonly triggeredPaths: readonly string[];
  readonly expectedCoreFields: Readonly<Record<Phase2AggregateBaselineCoreField, string | boolean>>;
  readonly expectedFailureSemantics?: readonly Phase2AggregateFailureSemantic[];
  readonly expectedAggregateOutcome: "fully_explained" | "attention_required" | "partially_explained" | "inconsistent";
  readonly notes: string;
};

export const PHASE2_AGGREGATE_SCENARIO_MATRIX: readonly Phase2AggregateScenarioMatrixEntry[] = [
  {
    matrixId: "M01",
    scenarioCategory: "stable",
    baselineId: "A",
    variantName: "stable_normal_path",
    triggeredPaths: ["persisted", "validation_passed", "repaired", "command_link_passed"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: false,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: true,
      explanationStatus: "fully_explained",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes",
      recommendedNextStep: "no_action_needed"
    },
    expectedAggregateOutcome: "fully_explained",
    notes: "Baseline A: all green"
  },
  {
    matrixId: "M02",
    scenarioCategory: "repair",
    baselineId: "B",
    variantName: "retryable_repair_path",
    triggeredPaths: ["repair_failed_retryable", "retry_hint", "canRetry=true"],
    expectedCoreFields: {
      riskLevel: "medium",
      manualActionHint: "retry_repair_recommended",
      requiresAttention: true,
      requiresRepairAction: true,
      requiresManualReview: false,
      isCrossSessionConsistent: true,
      explanationStatus: "attention_required",
      aggregateSummary: "risk=medium; hint=retry_repair_recommended; attention=yes; repair=yes; manual_review=no; consistent=yes",
      recommendedNextStep: "execute_controlled_repair_or_retry"
    },
    expectedAggregateOutcome: "attention_required",
    notes: "Baseline B: repair retryable"
  },
  {
    matrixId: "M03",
    scenarioCategory: "manual_review",
    baselineId: "C",
    variantName: "manual_review_path",
    triggeredPaths: ["validation_failed", "manual_confirmation_required", "critical_alert"],
    expectedCoreFields: {
      riskLevel: "high",
      manualActionHint: "manual_confirmation_recommended",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: true,
      isCrossSessionConsistent: true,
      explanationStatus: "attention_required",
      aggregateSummary: "risk=high; hint=manual_confirmation_recommended; attention=yes; repair=no; manual_review=yes; consistent=yes",
      recommendedNextStep: "perform_manual_review_and_confirmation"
    },
    expectedAggregateOutcome: "attention_required",
    notes: "Baseline C: manual review required"
  },
  {
    matrixId: "M04",
    scenarioCategory: "continuity",
    baselineId: "D-notice",
    variantName: "history_continuity_notice",
    triggeredPaths: ["history_consistency_notice", "replay_validation_notice"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: true,
      explanationStatus: "attention_required",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=yes",
      recommendedNextStep: "inspect_current_alert_and_validation_signals"
    },
    expectedAggregateOutcome: "attention_required",
    notes: "History consistency notice: attention but still consistent"
  },
  {
    matrixId: "M05",
    scenarioCategory: "continuity",
    baselineId: "D",
    variantName: "history_continuity_failed",
    triggeredPaths: ["history_consistency_failed", "replay_validation_failed"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedFailureSemantics: ["history_replay_failed"],
    expectedAggregateOutcome: "inconsistent",
    notes: "Baseline D: history continuity failed"
  },
  {
    matrixId: "M06",
    scenarioCategory: "continuity",
    baselineId: "F-notice",
    variantName: "suppression_continuity_notice",
    triggeredPaths: ["suppression_continuity_notice"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: false,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: true,
      explanationStatus: "fully_explained",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes",
      recommendedNextStep: "no_action_needed"
    },
    expectedAggregateOutcome: "fully_explained",
    notes: "Suppression continuity notice: not failed, still consistent"
  },
  {
    matrixId: "M07",
    scenarioCategory: "continuity",
    baselineId: "F",
    variantName: "suppression_continuity_failed",
    triggeredPaths: ["suppression_persistence_continuity_failed"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedAggregateOutcome: "inconsistent",
    notes: "Baseline F: suppression continuity failed"
  },
  {
    matrixId: "M08",
    scenarioCategory: "accountability",
    baselineId: "E",
    variantName: "command_link_missing",
    triggeredPaths: ["command_link_missing_record"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedFailureSemantics: ["command_link_missing_record"],
    expectedAggregateOutcome: "inconsistent",
    notes: "Baseline E: command link missing"
  },
  {
    matrixId: "M09",
    scenarioCategory: "accountability",
    baselineId: "E-mismatch",
    variantName: "command_link_status_mismatch",
    triggeredPaths: ["command_link_status_mismatch"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedFailureSemantics: ["command_link_status_mismatch"],
    expectedAggregateOutcome: "inconsistent",
    notes: "Command link status mismatch"
  },
  {
    matrixId: "M10",
    scenarioCategory: "failure_combination",
    baselineId: "COMBO-validation-manual",
    variantName: "validation_conflict_plus_manual_review",
    triggeredPaths: ["validation_failed", "investigate_validation_conflict", "critical_alert", "manual_review"],
    expectedCoreFields: {
      riskLevel: "high",
      manualActionHint: "investigate_validation_conflict",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: true,
      isCrossSessionConsistent: true,
      explanationStatus: "attention_required",
      aggregateSummary: "risk=high; hint=investigate_validation_conflict; attention=yes; repair=no; manual_review=yes; consistent=yes",
      recommendedNextStep: "perform_manual_review_and_confirmation"
    },
    expectedFailureSemantics: ["diagnostic_validation_conflict"],
    expectedAggregateOutcome: "attention_required",
    notes: "Combo: validation conflict triggers manual review"
  },
  {
    matrixId: "M11",
    scenarioCategory: "failure_combination",
    baselineId: "COMBO-repair-suppression",
    variantName: "repair_retryable_plus_suppression_continuity_failed",
    triggeredPaths: ["repair_failed_retryable", "canRetry=true", "suppression_continuity_failed"],
    expectedCoreFields: {
      riskLevel: "medium",
      manualActionHint: "retry_repair_recommended",
      requiresAttention: true,
      requiresRepairAction: true,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=medium; hint=retry_repair_recommended; attention=yes; repair=yes; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedFailureSemantics: ["suppression_state_incompatible_version"],
    expectedAggregateOutcome: "inconsistent",
    notes: "Combo: retryable repair + suppression continuity failed"
  },
  {
    matrixId: "M12",
    scenarioCategory: "failure_combination",
    baselineId: "COMBO-cmdlink-history",
    variantName: "command_link_mismatch_plus_history_replay_failed",
    triggeredPaths: ["command_link_status_mismatch", "history_replay_failed", "history_consistency_failed"],
    expectedCoreFields: {
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      requiresAttention: true,
      requiresRepairAction: false,
      requiresManualReview: false,
      isCrossSessionConsistent: false,
      explanationStatus: "inconsistent",
      aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
      recommendedNextStep: "investigate_cross_session_inconsistency"
    },
    expectedFailureSemantics: ["command_link_status_mismatch", "history_replay_failed"],
    expectedAggregateOutcome: "inconsistent",
    notes: "Combo: command-link mismatch + history replay failed"
  }
] as const;

export const getPhase2ScenarioMatrixEntryById = (
  matrixId: string
): Phase2AggregateScenarioMatrixEntry | undefined =>
  PHASE2_AGGREGATE_SCENARIO_MATRIX.find((entry) => entry.matrixId === matrixId);
