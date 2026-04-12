import { describe, expect, it } from "vitest";

import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import {
  runPhase2AcceptancePipeline,
  validatePhase2AcceptancePipelineConsistency,
  type Phase2AcceptancePipelineResult
} from "./core-case-diagnostic-aggregate-acceptance-pipeline.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-s27|ADLCase|adl-s27|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s27",
      subcaseType: "ADLCase",
      subcaseId: "adl-s27",
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
    targetSuppressionKey: "risk-case-s27|current_snapshot_conflict",
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

const fk = "risk-case-s27|ADLCase|adl-s27|2026-03-25T00:00:02.000Z";
const sk = "risk-case-s27|current_snapshot_conflict";

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
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
        view: { factKey: fk, riskCaseId: "risk-case-s27", subcaseType: "ADLCase", subcaseId: "adl-s27", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 2, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "retryable", actionHintReason: "retry required", diagnosticSummary: "retryable" },
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }),
        suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" })
      });
    case "M03":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s27", subcaseType: "ADLCase", subcaseId: "adl-s27", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "manual_confirmation_recommended", riskReason: "manual confirmation required", actionHintReason: "manual confirm", diagnosticSummary: "manual review" },
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
        view: { factKey: fk, riskCaseId: "risk-case-s27", subcaseType: "ADLCase", subcaseId: "adl-s27", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repaired", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict", actionHintReason: "investigate", diagnosticSummary: "validation conflict" },
        readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M11":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s27", subcaseType: "ADLCase", subcaseId: "adl-s27", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "incompatible version + suppression failed", actionHintReason: "repair needed", diagnosticSummary: "incompatible + continuity failed" },
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
  switch (combinationId) {
    case "FC01":
      return makeBaseSuccessResult({
        view: { factKey: fk, riskCaseId: "risk-case-s27", subcaseType: "ADLCase", subcaseId: "adl-s27", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict + manual confirmation", actionHintReason: "investigate + manual", diagnosticSummary: "validation conflict + manual review" },
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
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({
      diagnosticQueryReader: { handle: async () => result }
    });
    const queryResult = await handler.handle({ factKey: result.view.factKey, includeHistoryComparison: true });
    if (!queryResult.success) throw new Error("aggregate query should succeed");
    return queryResult.aggregateView;
  };
};

const createStandardProviders = () => ({
  scenarioInputProvider: buildScenarioInput,
  failureCombinationInputProvider: buildFailureCombinationInput,
  aggregateViewProvider: createAggregateViewProvider()
});

const createBoundaryProviders = (
  viewOverrides: Record<string, Partial<CoreCaseDiagnosticAggregateView>>
) => {
  let currentId = "";
  const baseViewProvider = createAggregateViewProvider();
  return {
    scenarioInputProvider: (matrixId: string) => {
      currentId = matrixId;
      return buildScenarioInput(matrixId);
    },
    failureCombinationInputProvider: (combinationId: string) => {
      currentId = combinationId;
      return buildFailureCombinationInput(combinationId);
    },
    aggregateViewProvider: async (result: DiagnosticSuccessResult) => {
      const baseView = await baseViewProvider(result);
      const override = viewOverrides[currentId];
      if (override !== undefined) {
        return { ...baseView, ...override } as CoreCaseDiagnosticAggregateView;
      }
      return baseView;
    }
  };
};

describe("Step 27: pipeline end-to-end ready path", () => {
  it("clean run produces ready status with full pipeline chain", async () => {
    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "pipeline-ready",
      ...createStandardProviders()
    });

    expect(result.pipelineRunId).toBe("pipeline-ready");
    expect(result.pipelineStatus).toBe("ready");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBe(0);
    expect(result.pipelineSummary).toContain("READY");
    expect(result.pipelineSummary).toContain("Ready for close");
    expect(result.recommendedNextActions.length).toBeGreaterThan(0);
    expect(result.recommendedNextActions[0]).toContain("Step 30");

    expect(result.differenceMatrix.overallStatus).toBe("passed");
    expect(result.differenceMatrix.totalScenarios).toBe(12);
    expect(result.differenceMatrix.totalFailureCombinations).toBe(3);
    expect(result.acceptanceInput.differenceMatrixOverallStatus).toBe("passed");
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.acceptanceGate.recommendedDecision).toBe("ready_for_phase2_close");
  });
});

describe("Step 27: pipeline ready_with_notices path", () => {
  it("non-blocking aggregateSummary drift produces ready_with_notices", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [persistence fallback active]"
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "pipeline-notice",
      ...providers
    });

    expect(result.pipelineStatus).toBe("ready_with_notices");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.pipelineSummary).toContain("READY WITH NOTICES");
    expect(result.recommendedNextActions.some((a) => a.includes("Review"))).toBe(true);

    expect(result.differenceMatrix.overallStatus).toBe("passed_with_notice");
    expect(result.acceptanceGate.gateStatus).toBe("pass_with_notice");
    expect(result.acceptanceGate.recommendedDecision).toBe("ready_with_notices");
  });
});

describe("Step 27: pipeline not_ready path", () => {
  it("blocking core field drift produces not_ready", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        riskLevel: "high",
        manualActionHint: "investigate_missing_read_view",
        requiresAttention: true,
        requiresManualReview: true
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "pipeline-fail",
      ...providers
    });

    expect(result.pipelineStatus).toBe("not_ready");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.pipelineSummary).toContain("NOT READY");
    expect(result.recommendedNextActions.some((a) => a.includes("Fix"))).toBe(true);
    expect(result.recommendedNextActions.some((a) => a.includes("Re-run"))).toBe(true);

    expect(result.differenceMatrix.overallStatus).toBe("failed");
    expect(result.acceptanceGate.gateStatus).toBe("fail");
    expect(result.acceptanceGate.recommendedDecision).toBe("not_ready_for_phase2_close");
  });
});

describe("Step 27: high-risk boundary scenarios", () => {
  it("G1: missing read view → pipeline detects blocking drift and blocks", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        currentReadViewStatus: "missing",
        riskLevel: "high",
        manualActionHint: "investigate_missing_read_view",
        requiresAttention: true,
        requiresManualReview: true
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "boundary-g1",
      ...providers
    });

    expect(result.pipelineStatus).toBe("not_ready");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.acceptanceGate.gateStatus).toBe("fail");
    const driftFindings = result.acceptanceInput.keyDriftFindings;
    expect(driftFindings.some((f) => f.sourceId === "M01" && f.blocking)).toBe(true);
  });

  it("G2: persistence failure but readable fallback → notice-level, not blocking", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        currentReadViewStatus: "fallback_only",
        aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [fallback]"
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "boundary-g2",
      ...providers
    });

    expect(result.pipelineStatus).toBe("ready_with_notices");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass_with_notice");
  });

  it("G3: history incompatible version → isCrossSessionConsistent drifts, pipeline blocks", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        isCrossSessionConsistent: false,
        explanationStatus: "inconsistent"
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "boundary-g3",
      ...providers
    });

    expect(result.pipelineStatus).toBe("not_ready");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    const sessionCheck = result.acceptanceGate.checkResults.find(
      (c) => c.checkId === "cross_session_consistency_passed"
    );
    expect(sessionCheck?.status).toBe("fail");
  });

  it("G4: repair lifecycle continuity invalid → repair/manual/attention drift, pipeline blocks", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        requiresRepairAction: true,
        requiresManualReview: true,
        requiresAttention: true,
        riskLevel: "high",
        manualActionHint: "manual_confirmation_recommended"
      }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "boundary-g4",
      ...providers
    });

    expect(result.pipelineStatus).toBe("not_ready");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    const cmdCheck = result.acceptanceGate.checkResults.find(
      (c) => c.checkId === "cross_command_consistency_passed"
    );
    expect(cmdCheck?.status).toBe("fail");
    const driftFindings = result.acceptanceInput.keyDriftFindings;
    expect(driftFindings.some((f) => f.field === "requiresRepairAction" && f.blocking)).toBe(true);
    expect(driftFindings.some((f) => f.field === "requiresManualReview" && f.blocking)).toBe(true);
  });
});

describe("Step 27: pipeline consistency validation", () => {
  it("clean pipeline run passes consistency validation", async () => {
    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "consistency-clean",
      ...createStandardProviders()
    });

    const validation = validatePhase2AcceptancePipelineConsistency(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues.length).toBe(0);
  });

  it("failing pipeline run still passes consistency validation", async () => {
    const providers = createBoundaryProviders({
      "M01": { riskLevel: "high", manualActionHint: "investigate_missing_read_view", requiresAttention: true }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "consistency-fail",
      ...providers
    });

    const validation = validatePhase2AcceptancePipelineConsistency(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues.length).toBe(0);
  });

  it("notice pipeline run passes consistency validation", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "drifted summary" }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "consistency-notice",
      ...providers
    });

    const validation = validatePhase2AcceptancePipelineConsistency(result);
    expect(validation.valid).toBe(true);
  });

  it("detects inconsistent pipeline status vs gate status", () => {
    const fakeResult = {
      pipelineRunId: "fake",
      differenceMatrix: { overallStatus: "passed" },
      acceptanceInput: { blockingIssues: [] },
      acceptanceGate: { gateStatus: "fail", failedChecks: 1, blockingIssues: ["x"], nonBlockingNotices: [] },
      pipelineStatus: "ready",
      blockingIssues: ["x"],
      nonBlockingNotices: []
    } as unknown as Phase2AcceptancePipelineResult;

    const validation = validatePhase2AcceptancePipelineConsistency(fakeResult);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });
});

describe("Step 27: Step 25/26 semantics preserved", () => {
  it("pipeline wraps matrix/input/gate without mutating their semantics", async () => {
    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "compat-test",
      ...createStandardProviders()
    });

    expect(result.differenceMatrix.matrixRunId).toBe("compat-test-matrix");
    expect(result.acceptanceGate.gateId).toBe("compat-test-gate");
    expect(result.differenceMatrix.scenarioReports.length).toBe(PHASE2_AGGREGATE_SCENARIO_MATRIX.length);
    expect(result.differenceMatrix.failureCombinationReports.length).toBe(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length);
    expect(result.acceptanceInput.scenarioMatrixIds.length).toBe(12);
    expect(result.acceptanceInput.failureCombinationIds.length).toBe(3);
    expect(result.acceptanceGate.checkResults.length).toBe(8);
  });

  it("scenario and failure combination matrices unchanged", () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBe(12);
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBe(3);
  });

  it("pipeline runner is centralized — not hand-assembled in tests", async () => {
    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "centralized-check",
      ...createStandardProviders()
    });

    expect(result.differenceMatrix).toBeDefined();
    expect(result.acceptanceInput).toBeDefined();
    expect(result.acceptanceGate).toBeDefined();
    expect(result.pipelineStatus).toBeDefined();
    expect(result.pipelineSummary).toBeDefined();
  });
});
