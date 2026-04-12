import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import {
  PHASE2_AGGREGATE_BASELINE_CORE_FIELDS,
  type CoreCaseDiagnosticAggregateBaseline
} from "./core-case-diagnostic-aggregate-baseline.js";
import type { Phase2AggregateBaselineCoreField } from "./core-case-diagnostic-aggregate-baseline-consistency.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import {
  PHASE2_AGGREGATE_SCENARIO_MATRIX,
  type Phase2AggregateScenarioMatrixEntry
} from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import {
  PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX,
  type Phase2AggregateFailureCombinationEntry
} from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import {
  buildPhase2AggregateBaselineDifferenceReport,
  PHASE2_BLOCKING_CORE_FIELDS,
  type Phase2AggregateBaselineDifferenceReport
} from "./core-case-diagnostic-aggregate-difference-report.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

export type Phase2AggregateDifferenceMatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase2CoreFieldDriftSummaryEntry = {
  readonly field: Phase2AggregateBaselineCoreField;
  readonly driftCount: number;
  readonly blocking: boolean;
};

export type Phase2AggregateDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly scenarioReports: readonly Phase2AggregateBaselineDifferenceReport[];
  readonly failureCombinationReports: readonly Phase2AggregateBaselineDifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly totalFailureCombinations: number;
  readonly matchedFailureCombinations: number;
  readonly mismatchedFailureCombinations: number;
  readonly coreFieldDriftSummary: readonly Phase2CoreFieldDriftSummaryEntry[];
  readonly overallStatus: Phase2AggregateDifferenceMatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase2AcceptanceDriftFinding = {
  readonly sourceId: string;
  readonly field: Phase2AggregateBaselineCoreField;
  readonly expected: string | boolean;
  readonly actual: string | boolean;
  readonly blocking: boolean;
};

export type Phase2AcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly Phase2AggregateBaselineCoreField[];
  readonly scenarioMatrixIds: readonly string[];
  readonly failureCombinationIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase2AggregateDifferenceMatrixOverallStatus;
  readonly keyDriftFindings: readonly Phase2AcceptanceDriftFinding[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedPreCloseActions: readonly string[];
};

const scenarioMatrixEntryToSyntheticBaseline = (
  entry: Phase2AggregateScenarioMatrixEntry
): CoreCaseDiagnosticAggregateBaseline => ({
  baselineId: entry.baselineId,
  scenarioName: entry.variantName,
  inputShape: entry.triggeredPaths.join(" + "),
  expectedAggregateSummary: entry.expectedCoreFields.aggregateSummary as string,
  expectedRequiresAttention: entry.expectedCoreFields.requiresAttention as boolean,
  expectedRequiresRepairAction: entry.expectedCoreFields.requiresRepairAction as boolean,
  expectedRequiresManualReview: entry.expectedCoreFields.requiresManualReview as boolean,
  expectedIsCrossSessionConsistent: entry.expectedCoreFields.isCrossSessionConsistent as boolean,
  expectedExplanationStatus: entry.expectedCoreFields.explanationStatus as CoreCaseDiagnosticAggregateView["explanationStatus"],
  expectedRiskLevel: entry.expectedCoreFields.riskLevel as CoreCaseDiagnosticAggregateView["riskLevel"],
  expectedManualActionHint: entry.expectedCoreFields.manualActionHint as CoreCaseDiagnosticAggregateView["manualActionHint"]
});

const failureCombinationToSyntheticBaseline = (
  combo: Phase2AggregateFailureCombinationEntry,
  aggregate: CoreCaseDiagnosticAggregateView
): CoreCaseDiagnosticAggregateBaseline => ({
  baselineId: combo.combinationId,
  scenarioName: combo.combinationId,
  inputShape: combo.failureSet.join(" + "),
  expectedAggregateSummary: aggregate.aggregateSummary,
  expectedRequiresAttention: combo.expectedRequiresAttention,
  expectedRequiresRepairAction: combo.expectedRequiresRepairAction,
  expectedRequiresManualReview: combo.expectedRequiresManualReview,
  expectedIsCrossSessionConsistent: combo.expectedIsCrossSessionConsistent,
  expectedExplanationStatus: combo.expectedExplanationStatus,
  expectedRiskLevel: aggregate.riskLevel,
  expectedManualActionHint: aggregate.manualActionHint
});

const computeCoreFieldDriftSummary = (
  reports: readonly Phase2AggregateBaselineDifferenceReport[]
): readonly Phase2CoreFieldDriftSummaryEntry[] => {
  const driftCounts = new Map<Phase2AggregateBaselineCoreField, number>();
  for (const report of reports) {
    for (const diff of report.differenceSummaries) {
      driftCounts.set(diff.field, (driftCounts.get(diff.field) ?? 0) + 1);
    }
  }
  return PHASE2_AGGREGATE_BASELINE_CORE_FIELDS.map((field) => ({
    field,
    driftCount: driftCounts.get(field) ?? 0,
    blocking: PHASE2_BLOCKING_CORE_FIELDS.has(field)
  }));
};

export const computePhase2MatrixOverallStatus = (
  allReports: readonly Phase2AggregateBaselineDifferenceReport[]
): Phase2AggregateDifferenceMatrixOverallStatus => {
  if (allReports.some((r) => r.blocking)) return "failed";
  if (allReports.some((r) => r.noticeOnly)) return "passed_with_notice";
  return "passed";
};

export const runPhase2AggregateDifferenceMatrix = async (input: {
  readonly matrixRunId: string;
  readonly scenarioInputProvider: (matrixId: string) => DiagnosticSuccessResult;
  readonly failureCombinationInputProvider: (combinationId: string) => DiagnosticSuccessResult;
  readonly aggregateViewProvider: (result: DiagnosticSuccessResult) => Promise<CoreCaseDiagnosticAggregateView>;
}): Promise<Phase2AggregateDifferenceMatrix> => {
  const scenarioReports: Phase2AggregateBaselineDifferenceReport[] = [];
  for (const entry of PHASE2_AGGREGATE_SCENARIO_MATRIX) {
    const diagnosticResult = input.scenarioInputProvider(entry.matrixId);
    const aggregate = await input.aggregateViewProvider(diagnosticResult);
    const baseline = scenarioMatrixEntryToSyntheticBaseline(entry);
    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: entry.matrixId
    });
    scenarioReports.push(report);
  }

  const failureCombinationReports: Phase2AggregateBaselineDifferenceReport[] = [];
  for (const combo of PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX) {
    const diagnosticResult = input.failureCombinationInputProvider(combo.combinationId);
    const aggregate = await input.aggregateViewProvider(diagnosticResult);
    const syntheticBaseline = failureCombinationToSyntheticBaseline(combo, aggregate);
    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline: syntheticBaseline,
      aggregate,
      scenarioOrCombinationId: combo.combinationId,
      failureCombination: combo
    });
    failureCombinationReports.push(report);
  }

  const allReports = [...scenarioReports, ...failureCombinationReports];
  const overallStatus = computePhase2MatrixOverallStatus(allReports);
  const coreFieldDriftSummary = computeCoreFieldDriftSummary(allReports);

  const matchedScenarios = scenarioReports.filter((r) => r.matched).length;
  const matchedCombos = failureCombinationReports.filter((r) => r.matched).length;

  const matrixSummary =
    `scenarios: ${matchedScenarios}/${scenarioReports.length} matched; ` +
    `combinations: ${matchedCombos}/${failureCombinationReports.length} matched; ` +
    `overall: ${overallStatus}`;

  return {
    matrixRunId: input.matrixRunId,
    scenarioReports,
    failureCombinationReports,
    totalScenarios: scenarioReports.length,
    matchedScenarios,
    mismatchedScenarios: scenarioReports.length - matchedScenarios,
    totalFailureCombinations: failureCombinationReports.length,
    matchedFailureCombinations: matchedCombos,
    mismatchedFailureCombinations: failureCombinationReports.length - matchedCombos,
    coreFieldDriftSummary,
    overallStatus,
    matrixSummary
  };
};

export const buildPhase2AcceptanceInputSnapshot = (
  matrix: Phase2AggregateDifferenceMatrix
): Phase2AcceptanceInputSnapshot => {
  const allReports = [...matrix.scenarioReports, ...matrix.failureCombinationReports];

  const keyDriftFindings: Phase2AcceptanceDriftFinding[] = [];
  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];

  for (const report of allReports) {
    for (const diff of report.differenceSummaries) {
      keyDriftFindings.push({
        sourceId: report.scenarioOrCombinationId,
        field: diff.field,
        expected: diff.expected,
        actual: diff.actual,
        blocking: diff.blocking
      });
      if (diff.blocking) {
        blockingIssues.push(
          `${report.scenarioOrCombinationId}: ${diff.field} drifted (expected=${String(diff.expected)}, actual=${String(diff.actual)})`
        );
      } else {
        nonBlockingNotices.push(
          `${report.scenarioOrCombinationId}: ${diff.field} minor drift (${String(diff.expected)} -> ${String(diff.actual)})`
        );
      }
    }
    if (!report.failureSemanticMatch) {
      blockingIssues.push(`${report.scenarioOrCombinationId}: failure semantic mismatch`);
    }
  }

  const recommendedPreCloseActions: string[] = [];
  if (matrix.overallStatus === "failed") {
    recommendedPreCloseActions.push("Resolve all blocking core field drifts before closing Phase 2");
    recommendedPreCloseActions.push("Verify failure semantic baselines are aligned with current aggregate behavior");
  } else if (matrix.overallStatus === "passed_with_notice") {
    recommendedPreCloseActions.push("Review non-blocking notices and confirm they are acceptable for closure");
  } else {
    recommendedPreCloseActions.push("All baselines pass; proceed to final acceptance gate");
  }

  return {
    baselineCoreFields: [...PHASE2_AGGREGATE_BASELINE_CORE_FIELDS],
    scenarioMatrixIds: matrix.scenarioReports.map((r) => r.scenarioOrCombinationId),
    failureCombinationIds: matrix.failureCombinationReports.map((r) => r.scenarioOrCombinationId),
    differenceMatrixOverallStatus: matrix.overallStatus,
    keyDriftFindings,
    blockingIssues,
    nonBlockingNotices,
    recommendedPreCloseActions
  };
};
