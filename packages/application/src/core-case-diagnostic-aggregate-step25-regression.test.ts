import { describe, expect, it } from "vitest";

import { getPhase2ScenarioBaselineById, PHASE2_AGGREGATE_BASELINE_CORE_FIELDS } from "./core-case-diagnostic-aggregate-baseline.js";
import {
  buildPhase2AggregateBaselineDifferenceReport,
  PHASE2_BLOCKING_CORE_FIELDS,
  type Phase2AggregateBaselineDifferenceReport
} from "./core-case-diagnostic-aggregate-difference-report.js";
import {
  buildPhase2AcceptanceInputSnapshot,
  computePhase2MatrixOverallStatus,
  runPhase2AggregateDifferenceMatrix
} from "./core-case-diagnostic-aggregate-difference-matrix.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

class FakeDiagnosticQueryReader {
  public nextResult: CoordinationResultDiagnosticQueryResult;
  public constructor(result: CoordinationResultDiagnosticQueryResult) {
    this.nextResult = result;
  }
  public async handle() {
    return this.nextResult;
  }
}

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-s25|ADLCase|adl-s25|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s25",
      subcaseType: "ADLCase",
      subcaseId: "adl-s25",
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      assessmentRulesVersion: "1.0.0",
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      riskReason: "stable",
      actionHintReason: "stable",
      diagnosticSummary: "stable"
    },
    readCompatibility: "compatible_read",
    compatibilityReason: "ok",
    ...input
  }) satisfies DiagnosticSuccessResult;

const buildSuppressionPersistence = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["alertSuppressionPersistence"]>>
): NonNullable<DiagnosticSuccessResult["alertSuppressionPersistence"]> => ({
  source: "persisted",
  readStatus: "found",
  writeStatus: "written",
  stateReadCompatibility: "compatible_read",
  stateCompatibilityReason: "compatible",
  stateRepairAvailable: true,
  stateRepairRecommended: false,
  stateRepairStatus: "repaired",
  continuityStatus: "passed",
  continuityReasonCategory: "ok",
  continuityReason: "continuous",
  isRepeatCountContinuous: true,
  suppressionStateRepair: {
    repairStatus: "repaired",
    repairAttempts: 1,
    lastRepairOutcome: "repaired",
    manualConfirmation: false,
    targetSuppressionKey: "risk-case-s25|current_snapshot_conflict",
    canRetry: false,
    canConfirmManually: false
  },
  suppressionStateRepairPersistence: {
    source: "persisted",
    continuityStatus: "passed",
    continuityReasonCategory: "ok",
    continuityReason: "continuous",
    historyAvailable: true,
    currentLifecycleReadable: true,
    previousLifecycleAvailable: true
  },
  ...input
});

const buildHistoryConsistency = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["historyConsistency"]>>
): NonNullable<DiagnosticSuccessResult["historyConsistency"]> => ({
  status: "passed",
  reason: "history replay passed",
  replayValidation: { status: "passed", reasonCategory: "current_snapshot_conflict", reason: "history replay passed" },
  ...input
});

const buildCommandLink = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["suppressionStateRepairCommandLink"]>>
): NonNullable<DiagnosticSuccessResult["suppressionStateRepairCommandLink"]> => ({
  commandLinkConsistencyStatus: "passed",
  commandLinkConsistencyReason: "linked",
  lastCommandType: "repair",
  lastCommandOutcome: "repaired",
  lastCommandTriggeredAt: "2026-03-25T00:00:03.000Z",
  ...input
});

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
  const fk = "risk-case-s25|ADLCase|adl-s25|2026-03-25T00:00:02.000Z";
  const sk = "risk-case-s25|current_snapshot_conflict";
  switch (matrixId) {
    case "M01":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence(),
        suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M02":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s25", subcaseType: "ADLCase", subcaseId: "adl-s25", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 2, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "retryable", actionHintReason: "retry required", diagnosticSummary: "retryable" },
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }),
        suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" })
      });
    case "M03":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s25", subcaseType: "ADLCase", subcaseId: "adl-s25", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "manual_confirmation_recommended", riskReason: "manual confirmation required", actionHintReason: "manual confirm", diagnosticSummary: "manual review" },
        readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT", alertSummary: "critical conflict", operationalHint: "manual_diagnostic_review_required", triggerSource: "replay_validation", requiresAttention: true },
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true } }),
        suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "failed" })
      });
    case "M04":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({ status: "passed", reason: "notice: minor slot drift" }),
        historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay notice" },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M05":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }),
        historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M06":
      return makeBaseSuccessResult({
        alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "passed", continuityReason: "suppression continuity notice: minor drift" }),
        suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M07":
      return makeBaseSuccessResult({
        alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed" }),
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M08":
      return makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "missing_record", commandLinkConsistencyReason: "record missing" })
      });
    case "M09":
      return makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" })
      });
    case "M10":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s25", subcaseType: "ADLCase", subcaseId: "adl-s25", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repaired", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict", actionHintReason: "investigate", diagnosticSummary: "validation conflict" },
        readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M11":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s25", subcaseType: "ADLCase", subcaseId: "adl-s25", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "incompatible version + suppression failed", actionHintReason: "repair needed", diagnosticSummary: "incompatible + continuity failed" },
        alertSuppressionPersistence: buildSuppressionPersistence({ stateReadCompatibility: "incompatible_version", stateRepairRecommended: true, continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed", suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }),
        suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M12":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }),
        historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" },
        suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" })
      });
    default:
      throw new Error(`Unknown scenario: ${matrixId}`);
  }
};

const buildFailureCombinationInput = (combinationId: string): DiagnosticSuccessResult => {
  const fk = "risk-case-s25|ADLCase|adl-s25|2026-03-25T00:00:02.000Z";
  const sk = "risk-case-s25|current_snapshot_conflict";
  switch (combinationId) {
    case "FC01":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s25", subcaseType: "ADLCase", subcaseId: "adl-s25", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict + manual confirmation", actionHintReason: "investigate + manual", diagnosticSummary: "validation conflict + manual review" },
        readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true },
        suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "FC02":
      return buildScenarioInput("M11");
    case "FC03":
      return buildScenarioInput("M12");
    default:
      throw new Error(`Unknown combination: ${combinationId}`);
  }
};

const createAggregateViewProvider = () => {
  return async (result: DiagnosticSuccessResult): Promise<CoreCaseDiagnosticAggregateView> => {
    const reader = new FakeDiagnosticQueryReader(result);
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });
    const queryResult = await handler.handle({ factKey: result.view.factKey, includeHistoryComparison: true });
    if (!queryResult.success) throw new Error("aggregate query should succeed");
    return queryResult.aggregateView;
  };
};

describe("Step 25: batch runner end-to-end", () => {
  it("runs full matrix and produces correct counts with passed status", async () => {
    const matrix = await runPhase2AggregateDifferenceMatrix({
      matrixRunId: "step25-full-run",
      scenarioInputProvider: buildScenarioInput,
      failureCombinationInputProvider: buildFailureCombinationInput,
      aggregateViewProvider: createAggregateViewProvider()
    });

    expect(matrix.matrixRunId).toBe("step25-full-run");
    expect(matrix.totalScenarios).toBe(PHASE2_AGGREGATE_SCENARIO_MATRIX.length);
    expect(matrix.totalFailureCombinations).toBe(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length);
    expect(matrix.scenarioReports.length).toBe(12);
    expect(matrix.failureCombinationReports.length).toBe(3);
    expect(matrix.matchedScenarios).toBe(12);
    expect(matrix.mismatchedScenarios).toBe(0);
    expect(matrix.matchedFailureCombinations).toBe(3);
    expect(matrix.mismatchedFailureCombinations).toBe(0);
    expect(matrix.overallStatus).toBe("passed");
    expect(matrix.matrixSummary).toContain("12/12");
    expect(matrix.matrixSummary).toContain("3/3");
    expect(matrix.matrixSummary).toContain("passed");

    for (const report of matrix.scenarioReports) {
      expect(report.matched, `scenario ${report.scenarioOrCombinationId}`).toBe(true);
      expect(report.blocking).toBe(false);
      expect(report.noticeOnly).toBe(false);
      expect(report.driftCategory).toBe("none");
    }
    for (const report of matrix.failureCombinationReports) {
      expect(report.matched, `combo ${report.scenarioOrCombinationId}`).toBe(true);
      expect(report.blocking).toBe(false);
    }
  });

  it("produces correct coreFieldDriftSummary when all pass", async () => {
    const matrix = await runPhase2AggregateDifferenceMatrix({
      matrixRunId: "drift-summary-test",
      scenarioInputProvider: buildScenarioInput,
      failureCombinationInputProvider: buildFailureCombinationInput,
      aggregateViewProvider: createAggregateViewProvider()
    });

    expect(matrix.coreFieldDriftSummary.length).toBe(PHASE2_AGGREGATE_BASELINE_CORE_FIELDS.length);
    for (const entry of matrix.coreFieldDriftSummary) {
      expect(entry.driftCount).toBe(0);
      expect(typeof entry.blocking).toBe("boolean");
    }
  });
});

describe("Step 25: overallStatus computation", () => {
  const makeReport = (overrides: Partial<Phase2AggregateBaselineDifferenceReport>): Phase2AggregateBaselineDifferenceReport => ({
    reportId: "test@X",
    baselineId: "X",
    scenarioOrCombinationId: "test",
    matched: true,
    matchedCoreFields: [...PHASE2_AGGREGATE_BASELINE_CORE_FIELDS],
    mismatchedCoreFields: [],
    differenceSummaries: [],
    failureSemanticMatch: true,
    consistencyStatus: "passed",
    reportSummary: "all matched",
    driftCategory: "none",
    blocking: false,
    noticeOnly: false,
    ...overrides
  });

  it("returns passed when all reports match", () => {
    const reports = [makeReport({}), makeReport({})];
    expect(computePhase2MatrixOverallStatus(reports)).toBe("passed");
  });

  it("returns passed_with_notice when non-blocking notices exist", () => {
    const reports = [
      makeReport({}),
      makeReport({
        matched: false,
        noticeOnly: true,
        driftCategory: "non_blocking_summary_drift",
        consistencyStatus: "failed",
        mismatchedCoreFields: ["aggregateSummary"],
        differenceSummaries: [{ field: "aggregateSummary", expected: "x", actual: "y", blocking: false }]
      })
    ];
    expect(computePhase2MatrixOverallStatus(reports)).toBe("passed_with_notice");
  });

  it("returns failed when blocking drift exists", () => {
    const reports = [
      makeReport({}),
      makeReport({
        matched: false,
        blocking: true,
        driftCategory: "blocking_core_field_drift",
        consistencyStatus: "failed",
        mismatchedCoreFields: ["requiresAttention"],
        differenceSummaries: [{ field: "requiresAttention", expected: false, actual: true, blocking: true }]
      })
    ];
    expect(computePhase2MatrixOverallStatus(reports)).toBe("failed");
  });

  it("returns failed when failure semantic mismatch", () => {
    const reports = [
      makeReport({
        matched: false,
        blocking: true,
        failureSemanticMatch: false,
        driftCategory: "blocking_failure_semantic_mismatch",
        consistencyStatus: "failed"
      })
    ];
    expect(computePhase2MatrixOverallStatus(reports)).toBe("failed");
  });

  it("failed takes precedence over notice", () => {
    const reports = [
      makeReport({ noticeOnly: true }),
      makeReport({ blocking: true })
    ];
    expect(computePhase2MatrixOverallStatus(reports)).toBe("failed");
  });
});

describe("Step 25: acceptance input snapshot", () => {
  it("generates acceptance input from passed matrix", async () => {
    const matrix = await runPhase2AggregateDifferenceMatrix({
      matrixRunId: "acceptance-test",
      scenarioInputProvider: buildScenarioInput,
      failureCombinationInputProvider: buildFailureCombinationInput,
      aggregateViewProvider: createAggregateViewProvider()
    });

    const snapshot = buildPhase2AcceptanceInputSnapshot(matrix);

    expect(snapshot.baselineCoreFields.length).toBe(9);
    expect(snapshot.scenarioMatrixIds.length).toBe(12);
    expect(snapshot.failureCombinationIds.length).toBe(3);
    expect(snapshot.differenceMatrixOverallStatus).toBe("passed");
    expect(snapshot.blockingIssues.length).toBe(0);
    expect(snapshot.nonBlockingNotices.length).toBe(0);
    expect(snapshot.keyDriftFindings.length).toBe(0);
    expect(snapshot.recommendedPreCloseActions.length).toBeGreaterThan(0);
    expect(snapshot.recommendedPreCloseActions[0]).toContain("proceed");
  });

  it("classifies blocking issues and non-blocking notices correctly", () => {
    const matrix: Parameters<typeof buildPhase2AcceptanceInputSnapshot>[0] = {
      matrixRunId: "classify-test",
      scenarioReports: [
        {
          reportId: "M-test@X", baselineId: "X", scenarioOrCombinationId: "M-test",
          matched: false, matchedCoreFields: [], mismatchedCoreFields: ["riskLevel", "aggregateSummary"],
          differenceSummaries: [
            { field: "riskLevel", expected: "low", actual: "high", blocking: true },
            { field: "aggregateSummary", expected: "a", actual: "b", blocking: false }
          ],
          failureSemanticMatch: true, consistencyStatus: "failed", reportSummary: "drift",
          driftCategory: "blocking_core_field_drift", blocking: true, noticeOnly: false
        }
      ],
      failureCombinationReports: [
        {
          reportId: "FC-test@Y", baselineId: "Y", scenarioOrCombinationId: "FC-test",
          matched: false, matchedCoreFields: [], mismatchedCoreFields: [],
          differenceSummaries: [],
          failureSemanticMatch: false, consistencyStatus: "failed", reportSummary: "semantic mismatch",
          driftCategory: "blocking_failure_semantic_mismatch", blocking: true, noticeOnly: false
        }
      ],
      totalScenarios: 1, matchedScenarios: 0, mismatchedScenarios: 1,
      totalFailureCombinations: 1, matchedFailureCombinations: 0, mismatchedFailureCombinations: 1,
      coreFieldDriftSummary: [], overallStatus: "failed", matrixSummary: "test"
    };

    const snapshot = buildPhase2AcceptanceInputSnapshot(matrix);

    expect(snapshot.blockingIssues.length).toBe(2);
    expect(snapshot.blockingIssues[0]).toContain("riskLevel");
    expect(snapshot.blockingIssues[1]).toContain("failure semantic mismatch");
    expect(snapshot.nonBlockingNotices.length).toBe(1);
    expect(snapshot.nonBlockingNotices[0]).toContain("aggregateSummary");
    expect(snapshot.keyDriftFindings.length).toBe(2);
    expect(snapshot.keyDriftFindings.filter((f) => f.blocking).length).toBe(1);
    expect(snapshot.recommendedPreCloseActions[0]).toContain("Resolve");
  });
});

describe("Step 25: enhanced difference report fields", () => {
  it("blocking=true for blocking core field drift", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const input = buildScenarioInput("M02");
    const provider = createAggregateViewProvider();
    const aggregate = await provider(input);

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: "drift-test"
    });

    expect(report.blocking).toBe(true);
    expect(report.driftCategory).toBe("blocking_core_field_drift");
    expect(report.noticeOnly).toBe(false);
    expect(report.differenceSummaries.some((d) => d.blocking)).toBe(true);
  });

  it("driftCategory=none when all fields match", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const input = buildScenarioInput("M01");
    const provider = createAggregateViewProvider();
    const aggregate = await provider(input);

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: "no-drift"
    });

    expect(report.blocking).toBe(false);
    expect(report.noticeOnly).toBe(false);
    expect(report.driftCategory).toBe("none");
    expect(report.matched).toBe(true);
  });

  it("PHASE2_BLOCKING_CORE_FIELDS covers all critical fields", () => {
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("riskLevel")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("manualActionHint")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("requiresAttention")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("requiresRepairAction")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("requiresManualReview")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("isCrossSessionConsistent")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("explanationStatus")).toBe(true);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("aggregateSummary")).toBe(false);
    expect(PHASE2_BLOCKING_CORE_FIELDS.has("recommendedNextStep")).toBe(false);
  });
});

describe("Step 25: Step 24 semantics preserved", () => {
  it("existing report fields and 9 core fields unchanged", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const input = buildScenarioInput("M01");
    const provider = createAggregateViewProvider();
    const aggregate = await provider(input);

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline, aggregate, scenarioOrCombinationId: "compat-test"
    });

    expect(report.reportId).toBe("compat-test@A");
    expect(report.baselineId).toBe("A");
    expect(report.matched).toBe(true);
    expect(report.matchedCoreFields.length + report.mismatchedCoreFields.length).toBe(9);
    expect(report.consistencyStatus).toBe("passed");
    expect(report.failureSemanticMatch).toBe(true);
    expect(report.reportSummary).toContain("match");
  });

  it("Step 23 baselines still accessible", () => {
    for (const id of ["A", "B", "C", "D", "E", "F"] as const) {
      expect(getPhase2ScenarioBaselineById(id)).toBeDefined();
    }
  });

  it("scenario matrix and failure combination matrix sizes unchanged", () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBe(12);
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBe(3);
  });
});
