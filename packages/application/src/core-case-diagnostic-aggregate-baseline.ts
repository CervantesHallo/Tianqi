import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";

export type Phase2AggregateFailureSemantic =
  | "history_replay_failed"
  | "command_link_missing_record"
  | "command_link_status_mismatch"
  | "suppression_state_incompatible_version"
  | "suppression_state_manual_confirmation_required"
  | "diagnostic_validation_conflict";

export type CoreCaseDiagnosticAggregateBaseline = {
  readonly baselineId: string;
  readonly scenarioName: string;
  readonly inputShape: string;
  readonly expectedAggregateSummary: string;
  readonly expectedRequiresAttention: boolean;
  readonly expectedRequiresRepairAction: boolean;
  readonly expectedRequiresManualReview: boolean;
  readonly expectedIsCrossSessionConsistent: boolean;
  readonly expectedExplanationStatus: CoreCaseDiagnosticAggregateView["explanationStatus"];
  readonly expectedRiskLevel: CoreCaseDiagnosticAggregateView["riskLevel"];
  readonly expectedManualActionHint: CoreCaseDiagnosticAggregateView["manualActionHint"];
  readonly expectedReadAlertSeverity?: NonNullable<CoreCaseDiagnosticAggregateView["readAlert"]>["severity"];
  readonly expectedRepairStatus?: NonNullable<CoreCaseDiagnosticAggregateView["suppressionStateRepair"]>["repairStatus"];
  readonly expectedCommandLinkStatus?: NonNullable<
    CoreCaseDiagnosticAggregateView["suppressionStateRepairCommandLink"]
  >["commandLinkConsistencyStatus"];
};

export const PHASE2_AGGREGATE_BASELINE_CORE_FIELDS = [
  "riskLevel",
  "manualActionHint",
  "requiresAttention",
  "requiresRepairAction",
  "requiresManualReview",
  "isCrossSessionConsistent",
  "explanationStatus",
  "aggregateSummary",
  "recommendedNextStep"
] as const;

export const PHASE2_AGGREGATE_SCENARIO_BASELINES: readonly CoreCaseDiagnosticAggregateBaseline[] = [
  {
    baselineId: "A",
    scenarioName: "stable_normal_path",
    inputShape: "persisted + validation_passed + repaired + no_alert",
    expectedAggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes",
    expectedRequiresAttention: false,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: true,
    expectedExplanationStatus: "fully_explained",
    expectedRiskLevel: "low",
    expectedManualActionHint: "no_action_needed",
    expectedRepairStatus: "repaired",
    expectedCommandLinkStatus: "passed"
  },
  {
    baselineId: "B",
    scenarioName: "retryable_repair_path",
    inputShape: "repair_failed_retryable + retry_hint",
    expectedAggregateSummary: "risk=medium; hint=retry_repair_recommended; attention=yes; repair=yes; manual_review=no; consistent=yes",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: true,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: true,
    expectedExplanationStatus: "attention_required",
    expectedRiskLevel: "medium",
    expectedManualActionHint: "retry_repair_recommended",
    expectedRepairStatus: "repair_failed_retryable",
    expectedCommandLinkStatus: "passed"
  },
  {
    baselineId: "C",
    scenarioName: "manual_review_path",
    inputShape: "validation_failed + manual_confirmation_required + critical_alert",
    expectedAggregateSummary:
      "risk=high; hint=manual_confirmation_recommended; attention=yes; repair=no; manual_review=yes; consistent=yes",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: true,
    expectedIsCrossSessionConsistent: true,
    expectedExplanationStatus: "attention_required",
    expectedRiskLevel: "high",
    expectedManualActionHint: "manual_confirmation_recommended",
    expectedReadAlertSeverity: "critical",
    expectedRepairStatus: "repair_failed_manual_confirmation_required",
    expectedCommandLinkStatus: "passed"
  },
  {
    baselineId: "D",
    scenarioName: "history_continuity_anomaly",
    inputShape: "history_replay_failed + history_consistency_failed",
    expectedAggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: false,
    expectedExplanationStatus: "inconsistent",
    expectedRiskLevel: "low",
    expectedManualActionHint: "no_action_needed",
    expectedCommandLinkStatus: "passed"
  },
  {
    baselineId: "E",
    scenarioName: "command_link_anomaly",
    inputShape: "command_link_missing_or_mismatch",
    expectedAggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: false,
    expectedExplanationStatus: "inconsistent",
    expectedRiskLevel: "low",
    expectedManualActionHint: "no_action_needed",
    expectedCommandLinkStatus: "missing_record"
  },
  {
    baselineId: "F",
    scenarioName: "suppression_continuity_anomaly",
    inputShape: "suppression_persistence_continuity_failed",
    expectedAggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=no",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: false,
    expectedExplanationStatus: "inconsistent",
    expectedRiskLevel: "low",
    expectedManualActionHint: "no_action_needed",
    expectedCommandLinkStatus: "passed"
  }
] as const;

export const PHASE2_AGGREGATE_FAILURE_BASELINES: Readonly<Record<Phase2AggregateFailureSemantic, CoreCaseDiagnosticAggregateBaseline>> = {
  history_replay_failed: PHASE2_AGGREGATE_SCENARIO_BASELINES[3]!,
  command_link_missing_record: {
    ...PHASE2_AGGREGATE_SCENARIO_BASELINES[4]!,
    baselineId: "E1",
    scenarioName: "command_link_missing_record",
    expectedCommandLinkStatus: "missing_record"
  },
  command_link_status_mismatch: {
    ...PHASE2_AGGREGATE_SCENARIO_BASELINES[4]!,
    baselineId: "E2",
    scenarioName: "command_link_status_mismatch",
    expectedCommandLinkStatus: "status_mismatch"
  },
  suppression_state_incompatible_version: {
    ...PHASE2_AGGREGATE_SCENARIO_BASELINES[1]!,
    baselineId: "F1",
    scenarioName: "suppression_state_incompatible_version",
    expectedRequiresRepairAction: true,
    expectedExplanationStatus: "attention_required"
  },
  suppression_state_manual_confirmation_required: {
    ...PHASE2_AGGREGATE_SCENARIO_BASELINES[2]!,
    baselineId: "F2",
    scenarioName: "suppression_state_manual_confirmation_required"
  },
  diagnostic_validation_conflict: {
    baselineId: "F3",
    scenarioName: "diagnostic_validation_conflict",
    inputShape: "validation_failed + validation_conflict_hint + critical_alert",
    expectedAggregateSummary:
      "risk=high; hint=investigate_validation_conflict; attention=yes; repair=no; manual_review=yes; consistent=yes",
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: true,
    expectedIsCrossSessionConsistent: true,
    expectedExplanationStatus: "attention_required",
    expectedRiskLevel: "high",
    expectedManualActionHint: "investigate_validation_conflict",
    expectedReadAlertSeverity: "critical",
    expectedCommandLinkStatus: "passed"
  }
};

export const getPhase2ScenarioBaselineById = (
  baselineId: CoreCaseDiagnosticAggregateBaseline["baselineId"]
): CoreCaseDiagnosticAggregateBaseline | undefined =>
  PHASE2_AGGREGATE_SCENARIO_BASELINES.find((item) => item.baselineId === baselineId);


