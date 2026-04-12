import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import type { Phase2AggregateFailureSemantic } from "./core-case-diagnostic-aggregate-baseline.js";

export type Phase2AggregateFailureCombinationEntry = {
  readonly combinationId: string;
  readonly failureSet: readonly Phase2AggregateFailureSemantic[];
  readonly expectedRequiresAttention: boolean;
  readonly expectedRequiresRepairAction: boolean;
  readonly expectedRequiresManualReview: boolean;
  readonly expectedIsCrossSessionConsistent: boolean;
  readonly expectedExplanationStatus: CoreCaseDiagnosticAggregateView["explanationStatus"];
  readonly expectedPrimaryReasonPattern: string;
  readonly expectedRecommendedNextStep: CoreCaseDiagnosticAggregateView["recommendedNextStep"];
};

export const PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX: readonly Phase2AggregateFailureCombinationEntry[] = [
  {
    combinationId: "FC01",
    failureSet: ["diagnostic_validation_conflict", "suppression_state_manual_confirmation_required"],
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: true,
    expectedIsCrossSessionConsistent: true,
    expectedExplanationStatus: "attention_required",
    expectedPrimaryReasonPattern: "Manual review",
    expectedRecommendedNextStep: "perform_manual_review_and_confirmation"
  },
  {
    combinationId: "FC02",
    failureSet: ["suppression_state_incompatible_version"],
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: true,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: false,
    expectedExplanationStatus: "inconsistent",
    expectedPrimaryReasonPattern: "linked",
    expectedRecommendedNextStep: "investigate_cross_session_inconsistency"
  },
  {
    combinationId: "FC03",
    failureSet: ["command_link_status_mismatch", "history_replay_failed"],
    expectedRequiresAttention: true,
    expectedRequiresRepairAction: false,
    expectedRequiresManualReview: false,
    expectedIsCrossSessionConsistent: false,
    expectedExplanationStatus: "inconsistent",
    expectedPrimaryReasonPattern: "status mismatch",
    expectedRecommendedNextStep: "investigate_cross_session_inconsistency"
  }
] as const;

export const getPhase2FailureCombinationById = (
  combinationId: string
): Phase2AggregateFailureCombinationEntry | undefined =>
  PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.find((entry) => entry.combinationId === combinationId);
