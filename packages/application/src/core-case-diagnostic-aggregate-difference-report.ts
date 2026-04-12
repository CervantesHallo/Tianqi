import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import {
  PHASE2_AGGREGATE_BASELINE_CORE_FIELDS,
  type CoreCaseDiagnosticAggregateBaseline
} from "./core-case-diagnostic-aggregate-baseline.js";
import type { Phase2AggregateBaselineCoreField } from "./core-case-diagnostic-aggregate-baseline-consistency.js";
import type { Phase2AggregateFailureCombinationEntry } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";

export type Phase2DriftCategory =
  | "none"
  | "blocking_core_field_drift"
  | "blocking_failure_semantic_mismatch"
  | "non_blocking_summary_drift"
  | "non_blocking_notice";

export const PHASE2_BLOCKING_CORE_FIELDS: ReadonlySet<Phase2AggregateBaselineCoreField> = new Set([
  "riskLevel",
  "manualActionHint",
  "requiresAttention",
  "requiresRepairAction",
  "requiresManualReview",
  "isCrossSessionConsistent",
  "explanationStatus"
]);

export type Phase2AggregateBaselineDifferenceSummary = {
  readonly field: Phase2AggregateBaselineCoreField;
  readonly expected: string | boolean;
  readonly actual: string | boolean;
  readonly blocking: boolean;
};

export type Phase2AggregateBaselineDifferenceReport = {
  readonly reportId: string;
  readonly baselineId: string;
  readonly scenarioOrCombinationId: string;
  readonly matched: boolean;
  readonly matchedCoreFields: readonly Phase2AggregateBaselineCoreField[];
  readonly mismatchedCoreFields: readonly Phase2AggregateBaselineCoreField[];
  readonly differenceSummaries: readonly Phase2AggregateBaselineDifferenceSummary[];
  readonly failureSemanticMatch: boolean;
  readonly consistencyStatus: "passed" | "failed";
  readonly reportSummary: string;
  readonly driftCategory: Phase2DriftCategory;
  readonly blocking: boolean;
  readonly noticeOnly: boolean;
};

const coreFieldValue = (
  aggregate: CoreCaseDiagnosticAggregateView,
  field: Phase2AggregateBaselineCoreField
): string | boolean => {
  const value = aggregate[field];
  return value;
};

export const buildPhase2AggregateBaselineDifferenceReport = (input: {
  readonly baseline: CoreCaseDiagnosticAggregateBaseline;
  readonly aggregate: CoreCaseDiagnosticAggregateView;
  readonly scenarioOrCombinationId: string;
  readonly failureCombination?: Phase2AggregateFailureCombinationEntry;
}): Phase2AggregateBaselineDifferenceReport => {
  const baseline = input.baseline;
  const aggregate = input.aggregate;

  const expectedMap: Readonly<Record<Phase2AggregateBaselineCoreField, string | boolean>> = {
    riskLevel: baseline.expectedRiskLevel,
    manualActionHint: baseline.expectedManualActionHint,
    requiresAttention: baseline.expectedRequiresAttention,
    requiresRepairAction: baseline.expectedRequiresRepairAction,
    requiresManualReview: baseline.expectedRequiresManualReview,
    isCrossSessionConsistent: baseline.expectedIsCrossSessionConsistent,
    explanationStatus: baseline.expectedExplanationStatus,
    aggregateSummary: baseline.expectedAggregateSummary,
    recommendedNextStep: ""
  };

  const matched: Phase2AggregateBaselineCoreField[] = [];
  const mismatched: Phase2AggregateBaselineCoreField[] = [];
  const summaries: Phase2AggregateBaselineDifferenceSummary[] = [];

  for (const field of PHASE2_AGGREGATE_BASELINE_CORE_FIELDS) {
    if (field === "recommendedNextStep") {
      matched.push(field);
      continue;
    }
    const expected = expectedMap[field];
    const actual = coreFieldValue(aggregate, field);
    if (expected === actual) {
      matched.push(field);
    } else {
      mismatched.push(field);
      summaries.push({ field, expected, actual, blocking: PHASE2_BLOCKING_CORE_FIELDS.has(field) });
    }
  }

  let failureSemanticMatch = true;
  if (input.failureCombination) {
    const combo = input.failureCombination;
    if (combo.expectedRequiresAttention !== aggregate.requiresAttention) {
      failureSemanticMatch = false;
    }
    if (combo.expectedRequiresRepairAction !== aggregate.requiresRepairAction) {
      failureSemanticMatch = false;
    }
    if (combo.expectedRequiresManualReview !== aggregate.requiresManualReview) {
      failureSemanticMatch = false;
    }
    if (combo.expectedIsCrossSessionConsistent !== aggregate.isCrossSessionConsistent) {
      failureSemanticMatch = false;
    }
    if (combo.expectedExplanationStatus !== aggregate.explanationStatus) {
      failureSemanticMatch = false;
    }
    if (combo.expectedRecommendedNextStep !== aggregate.recommendedNextStep) {
      failureSemanticMatch = false;
    }
    if (!aggregate.primaryReason.toLowerCase().includes(combo.expectedPrimaryReasonPattern.toLowerCase())) {
      failureSemanticMatch = false;
    }
  }

  const hasBlockingDrift = mismatched.some((f) => PHASE2_BLOCKING_CORE_FIELDS.has(f));
  const isBlocking = hasBlockingDrift || !failureSemanticMatch;
  const isNoticeOnly = !isBlocking && mismatched.length > 0;
  const driftCategory: Phase2DriftCategory = isBlocking
    ? !failureSemanticMatch
      ? "blocking_failure_semantic_mismatch"
      : "blocking_core_field_drift"
    : isNoticeOnly
      ? "non_blocking_summary_drift"
      : "none";

  const allMatched = mismatched.length === 0 && failureSemanticMatch;
  const reportSummary = allMatched
    ? `All ${matched.length} core fields match baseline ${baseline.baselineId}`
    : `${mismatched.length} core field(s) mismatched: ${mismatched.join(", ")}${!failureSemanticMatch ? "; failure semantic mismatch" : ""}`;

  return {
    reportId: `${input.scenarioOrCombinationId}@${baseline.baselineId}`,
    baselineId: baseline.baselineId,
    scenarioOrCombinationId: input.scenarioOrCombinationId,
    matched: allMatched,
    matchedCoreFields: matched,
    mismatchedCoreFields: mismatched,
    differenceSummaries: summaries,
    failureSemanticMatch,
    consistencyStatus: allMatched ? "passed" : "failed",
    reportSummary,
    driftCategory,
    blocking: isBlocking,
    noticeOnly: isNoticeOnly
  };
};
