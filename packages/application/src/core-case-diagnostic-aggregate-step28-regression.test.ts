import { describe, expect, it } from "vitest";

import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import { PHASE2_NOTICE_ESCALATION_THRESHOLD } from "./core-case-diagnostic-aggregate-acceptance-gate.js";
import {
  runPhase2FinalAcceptance,
  validatePhase2FinalAcceptanceConsistency,
  type Phase2FinalAcceptanceResult
} from "./core-case-diagnostic-aggregate-final-acceptance.js";
import {
  runPhase2AcceptancePipeline,
  validatePhase2AcceptancePipelineConsistency
} from "./core-case-diagnostic-aggregate-acceptance-pipeline.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-s28|ADLCase|adl-s28|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s28",
      subcaseType: "ADLCase",
      subcaseId: "adl-s28",
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
    targetSuppressionKey: "risk-case-s28|current_snapshot_conflict",
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

const fk = "risk-case-s28|ADLCase|adl-s28|2026-03-25T00:00:02.000Z";
const sk = "risk-case-s28|current_snapshot_conflict";

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
  switch (matrixId) {
    case "M01":
      return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence(), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M02":
      return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s28", subcaseType: "ADLCase", subcaseId: "adl-s28", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 2, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "retryable", actionHintReason: "retry required", diagnosticSummary: "retryable" }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" }) });
    case "M03":
      return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s28", subcaseType: "ADLCase", subcaseId: "adl-s28", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "manual_confirmation_recommended", riskReason: "manual confirmation required", actionHintReason: "manual confirm", diagnosticSummary: "manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT", alertSummary: "critical conflict", operationalHint: "manual_diagnostic_review_required", triggerSource: "replay_validation", requiresAttention: true }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "failed" }) });
    case "M04":
      return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "passed", reason: "notice: minor slot drift" }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay notice" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M05":
      return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M06":
      return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "passed", continuityReason: "suppression continuity notice: minor drift" }), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M07":
      return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed" }), suppressionStateRepairCommandLink: buildCommandLink() });
    case "M08":
      return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "missing_record", commandLinkConsistencyReason: "record missing" }) });
    case "M09":
      return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    case "M10":
      return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s28", subcaseType: "ADLCase", subcaseId: "adl-s28", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repaired", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict", actionHintReason: "investigate", diagnosticSummary: "validation conflict" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M11":
      return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s28", subcaseType: "ADLCase", subcaseId: "adl-s28", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "incompatible version + suppression failed", actionHintReason: "repair needed", diagnosticSummary: "incompatible + continuity failed" }, alertSuppressionPersistence: buildSuppressionPersistence({ stateReadCompatibility: "incompatible_version", stateRepairRecommended: true, continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed", suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M12":
      return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    default:
      throw new Error(`Unknown scenario: ${matrixId}`);
  }
};

const buildFailureCombinationInput = (combinationId: string): DiagnosticSuccessResult => {
  switch (combinationId) {
    case "FC01":
      return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s28", subcaseType: "ADLCase", subcaseId: "adl-s28", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict + manual confirmation", actionHintReason: "investigate + manual", diagnosticSummary: "validation conflict + manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
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

describe("Step 28: final acceptance ready_to_close path", () => {
  it("clean run with all boundaries covered → ready_to_close", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "final-ready",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_to_close");
    expect(result.finalBlockingIssues.length).toBe(0);
    expect(result.finalNotices.length).toBe(0);
    expect(result.finalAcceptanceSummary).toContain("READY TO CLOSE");
    expect(result.preCloseChecklistStatus.matrixCompleted.passed).toBe(true);
    expect(result.preCloseChecklistStatus.acceptanceInputBuilt.passed).toBe(true);
    expect(result.preCloseChecklistStatus.gateEvaluated.passed).toBe(true);
    expect(result.preCloseChecklistStatus.highRiskBoundaryCoveredRound1.passed).toBe(true);
    expect(result.preCloseChecklistStatus.highRiskBoundaryCoveredRound2.passed).toBe(true);
    expect(result.preCloseChecklistStatus.blockingIssuesResolvedOrAcknowledged.passed).toBe(true);
  });

  it("pipeline ready but boundary round2 not covered → not_ready_to_close", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "final-no-r2",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: false
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.preCloseChecklistStatus.highRiskBoundaryCoveredRound2.passed).toBe(false);
    expect(result.finalAcceptanceSummary).toContain("NOT READY");
  });
});

describe("Step 28: final acceptance ready_with_notices path", () => {
  it("non-blocking summary drift → ready_with_notices", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [version compat notice]" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "final-notice",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.finalNotices.length).toBeGreaterThan(0);
    expect(result.finalAcceptanceSummary).toContain("READY WITH NOTICES");
  });
});

describe("Step 28: final acceptance not_ready_to_close path", () => {
  it("blocking core field drift → not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": { riskLevel: "high", manualActionHint: "investigate_missing_read_view", requiresAttention: true }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "final-fail",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.length).toBeGreaterThan(0);
    expect(result.finalAcceptanceSummary).toContain("NOT READY");
  });
});

describe("Step 28: gate tightening Rule C — notice escalation", () => {
  it("≥3 non-blocking drifts escalate pass_with_notice → fail", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "drifted-summary-1" },
      "M06": { aggregateSummary: "drifted-summary-2" },
      "M08": { aggregateSummary: "drifted-summary-3" }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "escalation-test",
      ...providers
    });

    expect(result.acceptanceInput.keyDriftFindings.filter((f) => !f.blocking).length).toBeGreaterThanOrEqual(PHASE2_NOTICE_ESCALATION_THRESHOLD);
    expect(result.acceptanceGate.gateStatus).toBe("fail");
    expect(result.pipelineStatus).toBe("not_ready");
    expect(result.blockingIssues.some((s) => s.includes("notice_escalation"))).toBe(true);
  });

  it("<3 non-blocking drifts stay as pass_with_notice", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "drifted-summary-only-one" }
    });

    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "no-escalation",
      ...providers
    });

    expect(result.acceptanceInput.keyDriftFindings.filter((f) => !f.blocking).length).toBeLessThan(PHASE2_NOTICE_ESCALATION_THRESHOLD);
    expect(result.acceptanceGate.gateStatus).toBe("pass_with_notice");
    expect(result.pipelineStatus).toBe("ready_with_notices");
  });
});

describe("Step 28: round 2 high-risk boundary scenarios", () => {
  it("H1: cross-step consistency anomaly — repair path drift → blocks", async () => {
    const providers = createBoundaryProviders({
      "M02": { requiresRepairAction: false }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-h1",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.length).toBeGreaterThan(0);
    const driftFindings = result.pipeline.acceptanceInput.keyDriftFindings;
    expect(driftFindings.some((f) => f.sourceId === "M02" && f.field === "requiresRepairAction" && f.blocking)).toBe(true);
  });

  it("H2: history baseline version compat notice → ready_with_notices", async () => {
    const providers = createBoundaryProviders({
      "M04": { aggregateSummary: "risk=low; hint=no_action_needed; attention=yes; repair=no; manual_review=no; consistent=yes [history version compat notice]" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-h2",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.finalNotices.length).toBeGreaterThan(0);
    expect(result.pipeline.acceptanceGate.gateStatus).toBe("pass_with_notice");
  });

  it("H3: failure semantic mismatch but core fields stable → blocks via semantic check", async () => {
    const providers = createBoundaryProviders({
      "FC01": { recommendedNextStep: "wrong_unexpected_step" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-h3",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.some((s) => s.includes("failure semantic") || s.includes("failure_semantics"))).toBe(true);
  });

  it("H4: command-link AND continuity both abnormal → stable pipeline with multiple blocking issues", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        isCrossSessionConsistent: false,
        explanationStatus: "inconsistent",
        requiresAttention: true,
        requiresRepairAction: true
      }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-h4",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.length).toBeGreaterThan(0);

    const sessionCheck = result.pipeline.acceptanceGate.checkResults.find((c) => c.checkId === "cross_session_consistency_passed");
    expect(sessionCheck?.status).toBe("fail");
    const cmdCheck = result.pipeline.acceptanceGate.checkResults.find((c) => c.checkId === "cross_command_consistency_passed");
    expect(cmdCheck?.status).toBe("fail");
  });
});

describe("Step 28: final acceptance consistency validation", () => {
  it("clean run passes consistency", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "consistency-ok",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const validation = validatePhase2FinalAcceptanceConsistency(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues.length).toBe(0);
  });

  it("failing run still passes internal consistency", async () => {
    const providers = createBoundaryProviders({
      "M01": { riskLevel: "high", requiresAttention: true }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "consistency-fail",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const validation = validatePhase2FinalAcceptanceConsistency(result);
    expect(validation.valid).toBe(true);
  });

  it("detects inconsistent manually constructed result", () => {
    const fakeResult = {
      pipeline: {
        pipelineStatus: "not_ready",
        acceptanceGate: { gateStatus: "fail" },
        blockingIssues: ["x"]
      },
      finalAcceptanceStatus: "ready_to_close",
      finalBlockingIssues: ["x"],
      preCloseChecklistStatus: {
        matrixCompleted: { passed: true },
        acceptanceInputBuilt: { passed: true },
        gateEvaluated: { passed: true },
        highRiskBoundaryCoveredRound1: { passed: true },
        highRiskBoundaryCoveredRound2: { passed: true },
        blockingIssuesResolvedOrAcknowledged: { passed: false }
      }
    } as unknown as Phase2FinalAcceptanceResult;

    const validation = validatePhase2FinalAcceptanceConsistency(fakeResult);
    expect(validation.valid).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });
});

describe("Step 28: pipeline consistency still valid after gate tightening", () => {
  it("clean pipeline still passes consistency", async () => {
    const result = await runPhase2AcceptancePipeline({
      pipelineRunId: "s28-compat",
      ...createStandardProviders()
    });

    const validation = validatePhase2AcceptancePipelineConsistency(result);
    expect(validation.valid).toBe(true);
    expect(result.pipelineStatus).toBe("ready");
  });
});

describe("Step 28: Step 27 semantics preserved", () => {
  it("scenario and failure combination matrices unchanged", () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBe(12);
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBe(3);
  });

  it("final acceptance runner wraps pipeline without breaking its semantics", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "semantics-check",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.pipeline.differenceMatrix.totalScenarios).toBe(12);
    expect(result.pipeline.differenceMatrix.totalFailureCombinations).toBe(3);
    expect(result.pipeline.acceptanceInput.scenarioMatrixIds.length).toBe(12);
    expect(result.pipeline.acceptanceGate.checkResults.length).toBe(8);
    expect(result.pipeline.pipelineStatus).toBe("ready");
  });

  it("pre-close checklist has 6 items", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "checklist-count",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const c = result.preCloseChecklistStatus;
    const items = [c.matrixCompleted, c.acceptanceInputBuilt, c.gateEvaluated, c.highRiskBoundaryCoveredRound1, c.highRiskBoundaryCoveredRound2, c.blockingIssuesResolvedOrAcknowledged];
    expect(items.length).toBe(6);
    expect(items.every((i) => i.passed)).toBe(true);
  });
});
