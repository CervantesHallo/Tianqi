import { describe, expect, it } from "vitest";

import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import { PHASE2_NOTICE_ESCALATION_THRESHOLD } from "./core-case-diagnostic-aggregate-acceptance-gate.js";
import {
  runPhase2FinalAcceptance,
  type Phase2FinalAcceptanceResult
} from "./core-case-diagnostic-aggregate-final-acceptance.js";
import {
  PHASE2_FINAL_ACCEPTANCE_GATE_RULESET,
  PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS,
  PHASE2_STEP30_RUNBOOK,
  validatePhase2CloseReadinessConsistency
} from "./core-case-diagnostic-aggregate-close-readiness.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-s29|ADLCase|adl-s29|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s29",
      subcaseType: "ADLCase",
      subcaseId: "adl-s29",
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
  suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: "risk-case-s29|current_snapshot_conflict", canRetry: false, canConfirmManually: false },
  suppressionStateRepairPersistence: { source: "persisted", continuityStatus: "passed", continuityReasonCategory: "ok", continuityReason: "continuous", historyAvailable: true, currentLifecycleReadable: true, previousLifecycleAvailable: true },
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

const fk = "risk-case-s29|ADLCase|adl-s29|2026-03-25T00:00:02.000Z";
const sk = "risk-case-s29|current_snapshot_conflict";

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
  switch (matrixId) {
    case "M01": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence(), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M02": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s29", subcaseType: "ADLCase", subcaseId: "adl-s29", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 2, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "retryable", actionHintReason: "retry required", diagnosticSummary: "retryable" }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" }) });
    case "M03": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s29", subcaseType: "ADLCase", subcaseId: "adl-s29", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "manual_confirmation_recommended", riskReason: "manual confirmation required", actionHintReason: "manual confirm", diagnosticSummary: "manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT", alertSummary: "critical conflict", operationalHint: "manual_diagnostic_review_required", triggerSource: "replay_validation", requiresAttention: true }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "failed" }) });
    case "M04": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "passed", reason: "notice: minor slot drift" }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay notice" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M05": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M06": return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "passed", continuityReason: "suppression continuity notice: minor drift" }), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M07": return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed" }), suppressionStateRepairCommandLink: buildCommandLink() });
    case "M08": return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "missing_record", commandLinkConsistencyReason: "record missing" }) });
    case "M09": return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    case "M10": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s29", subcaseType: "ADLCase", subcaseId: "adl-s29", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repaired", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict", actionHintReason: "investigate", diagnosticSummary: "validation conflict" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M11": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s29", subcaseType: "ADLCase", subcaseId: "adl-s29", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "incompatible version + suppression failed", actionHintReason: "repair needed", diagnosticSummary: "incompatible + continuity failed" }, alertSuppressionPersistence: buildSuppressionPersistence({ stateReadCompatibility: "incompatible_version", stateRepairRecommended: true, continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed", suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M12": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    default: throw new Error(`Unknown scenario: ${matrixId}`);
  }
};

const buildFailureCombinationInput = (combinationId: string): DiagnosticSuccessResult => {
  switch (combinationId) {
    case "FC01": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s29", subcaseType: "ADLCase", subcaseId: "adl-s29", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict + manual confirmation", actionHintReason: "investigate + manual", diagnosticSummary: "validation conflict + manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "FC02": return buildScenarioInput("M11");
    case "FC03": return buildScenarioInput("M12");
    default: throw new Error(`Unknown combination: ${combinationId}`);
  }
};

const createAggregateViewProvider = () =>
  async (result: DiagnosticSuccessResult): Promise<CoreCaseDiagnosticAggregateView> => {
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: { handle: async () => result } });
    const qr = await handler.handle({ factKey: result.view.factKey, includeHistoryComparison: true });
    if (!qr.success) throw new Error("should succeed");
    return qr.aggregateView;
  };

const createStandardProviders = () => ({
  scenarioInputProvider: buildScenarioInput,
  failureCombinationInputProvider: buildFailureCombinationInput,
  aggregateViewProvider: createAggregateViewProvider()
});

const createBoundaryProviders = (overrides: Record<string, Partial<CoreCaseDiagnosticAggregateView>>) => {
  let currentId = "";
  const base = createAggregateViewProvider();
  return {
    scenarioInputProvider: (id: string) => { currentId = id; return buildScenarioInput(id); },
    failureCombinationInputProvider: (id: string) => { currentId = id; return buildFailureCombinationInput(id); },
    aggregateViewProvider: async (r: DiagnosticSuccessResult) => {
      const v = await base(r);
      const o = overrides[currentId];
      return o !== undefined ? { ...v, ...o } as CoreCaseDiagnosticAggregateView : v;
    }
  };
};

describe("Step 29: final acceptance ready_to_close — all conditions met", () => {
  it("clean run + all boundaries → ready_to_close + passes close readiness", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-ready",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_to_close");
    expect(result.finalBlockingIssues.length).toBe(0);
    expect(result.finalNotices.length).toBe(0);
    expect(result.finalAcceptanceSummary).toContain("READY TO CLOSE");

    const validation = validatePhase2CloseReadinessConsistency(result);
    expect(validation.valid).toBe(true);
    expect(validation.issues.length).toBe(0);
  });
});

describe("Step 29: final acceptance ready_with_notices", () => {
  it("single notice drift + all boundaries → ready_with_notices + passes close readiness", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [write failure fallback]" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-notice",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.finalNotices.length).toBeGreaterThan(0);

    const validation = validatePhase2CloseReadinessConsistency(result);
    expect(validation.valid).toBe(true);
  });
});

describe("Step 29: final acceptance not_ready_to_close", () => {
  it("blocking drift → not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": { riskLevel: "high", manualActionHint: "investigate_missing_read_view", requiresAttention: true }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-fail-drift",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.length).toBeGreaterThan(0);

    const validation = validatePhase2CloseReadinessConsistency(result);
    expect(validation.valid).toBe(true);
  });

  it("gate fail → not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": { isCrossSessionConsistent: false, explanationStatus: "inconsistent" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-fail-gate",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.pipeline.acceptanceGate.gateStatus).toBe("fail");
  });
});

describe("Step 29: Z-series final boundary scenarios", () => {
  it("Z1: persistence write failure but previously persisted readable → notice, not full block", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        currentReadViewStatus: "fallback_only",
        aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [persistence write failed, fallback read]"
      }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-z1",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.finalBlockingIssues.length).toBe(0);
    expect(result.finalNotices.length).toBeGreaterThan(0);
  });

  it("Z2: state missing + fallback unavailable → blocking, not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": {
        currentReadViewStatus: "missing",
        riskLevel: "high",
        manualActionHint: "investigate_missing_read_view",
        requiresAttention: true,
        requiresManualReview: true
      }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-z2",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalBlockingIssues.length).toBeGreaterThan(0);
  });

  it("Z3: gate pass_with_notice + pre-close checklist incomplete → not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [z3-notice]" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-z3",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: false
    });

    expect(result.pipeline.acceptanceGate.gateStatus).toBe("pass_with_notice");
    expect(result.preCloseChecklistStatus.highRiskBoundaryCoveredRound2.passed).toBe(false);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
    expect(result.finalAcceptanceSummary).toContain("NOT READY");
  });

  it("Z4: multiple notice escalation + boundary overlap → not_ready_to_close", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "drifted-z4-1" },
      "M06": { aggregateSummary: "drifted-z4-2" },
      "M08": { aggregateSummary: "drifted-z4-3" }
    });

    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "boundary-z4",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: false
    });

    expect(result.pipeline.acceptanceInput.keyDriftFindings.filter((f) => !f.blocking).length).toBeGreaterThanOrEqual(PHASE2_NOTICE_ESCALATION_THRESHOLD);
    expect(result.pipeline.acceptanceGate.gateStatus).toBe("fail");
    expect(result.preCloseChecklistStatus.highRiskBoundaryCoveredRound2.passed).toBe(false);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close");
  });
});

describe("Step 29: close readiness consistency validator", () => {
  it("detects gate fail + ready_to_close inconsistency", () => {
    const fakeResult = {
      pipeline: { pipelineStatus: "not_ready", acceptanceGate: { gateStatus: "fail", checkResults: Array.from({ length: 8 }) } },
      finalAcceptanceStatus: "ready_to_close",
      finalBlockingIssues: ["x"],
      preCloseChecklistStatus: {
        matrixCompleted: { passed: true }, acceptanceInputBuilt: { passed: true }, gateEvaluated: { passed: true },
        highRiskBoundaryCoveredRound1: { passed: true }, highRiskBoundaryCoveredRound2: { passed: true },
        blockingIssuesResolvedOrAcknowledged: { passed: false }
      }
    } as unknown as Phase2FinalAcceptanceResult;

    const v = validatePhase2CloseReadinessConsistency(fakeResult);
    expect(v.valid).toBe(false);
    expect(v.issues.length).toBeGreaterThan(0);
  });

  it("detects notices-only misclassified as not_ready_to_close", () => {
    const fakeResult = {
      pipeline: { pipelineStatus: "ready_with_notices", acceptanceGate: { gateStatus: "pass_with_notice", checkResults: Array.from({ length: 8 }) } },
      finalAcceptanceStatus: "not_ready_to_close",
      finalBlockingIssues: [],
      preCloseChecklistStatus: {
        matrixCompleted: { passed: true }, acceptanceInputBuilt: { passed: true }, gateEvaluated: { passed: true },
        highRiskBoundaryCoveredRound1: { passed: true }, highRiskBoundaryCoveredRound2: { passed: true },
        blockingIssuesResolvedOrAcknowledged: { passed: true }
      }
    } as unknown as Phase2FinalAcceptanceResult;

    const v = validatePhase2CloseReadinessConsistency(fakeResult);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => i.includes("Notices-only"))).toBe(true);
  });

  it("valid for clean ready_to_close run", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-consistency-ok",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const v = validatePhase2CloseReadinessConsistency(result);
    expect(v.valid).toBe(true);
  });
});

describe("Step 29: frozen ruleset / checklist / runbook structure", () => {
  it("PHASE2_FINAL_ACCEPTANCE_GATE_RULESET has required fields", () => {
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.version).toBe("vFinal");
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.blockingDriftFields.length).toBe(7);
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.noticeOnlyDriftFields.length).toBe(2);
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.failureSemanticStrictness).toBe("strict");
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.escalationThreshold).toBe(3);
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.gateChecks.length).toBe(8);
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.decisionMapping.pass).toBe("ready_for_phase2_close");
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.decisionMapping.pass_with_notice).toBe("ready_with_notices");
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.decisionMapping.fail).toBe("not_ready_for_phase2_close");
  });

  it("PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS has 6 blocking items", () => {
    expect(PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS.length).toBe(6);
    expect(PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS.every((i) => i.blocking)).toBe(true);
    const ids = PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS.map((i) => i.checkId);
    expect(ids).toContain("matrixCompleted");
    expect(ids).toContain("acceptanceInputBuilt");
    expect(ids).toContain("gateEvaluated");
    expect(ids).toContain("highRiskBoundaryCoveredRound1");
    expect(ids).toContain("highRiskBoundaryCoveredRound2");
    expect(ids).toContain("blockingIssuesResolvedOrAcknowledged");
  });

  it("PHASE2_STEP30_RUNBOOK has 7 ordered steps and required artifacts", () => {
    expect(PHASE2_STEP30_RUNBOOK.runbookId).toBe("phase2-step30-final-acceptance");
    expect(PHASE2_STEP30_RUNBOOK.version).toBe("vFinal");
    expect(PHASE2_STEP30_RUNBOOK.steps.length).toBe(7);
    expect(PHASE2_STEP30_RUNBOOK.steps[0]!.stepOrder).toBe(1);
    expect(PHASE2_STEP30_RUNBOOK.steps[6]!.stepOrder).toBe(7);
    expect(PHASE2_STEP30_RUNBOOK.requiredArtifacts.length).toBe(4);
    expect(PHASE2_STEP30_RUNBOOK.successCondition).toContain("ready_to_close");
    expect(PHASE2_STEP30_RUNBOOK.failureCondition).toContain("not_ready_to_close");
    expect(PHASE2_STEP30_RUNBOOK.closeDecisionRule).toBeTruthy();
  });
});

describe("Step 29: Step 28 semantics preserved", () => {
  it("matrices unchanged", () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBe(12);
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBe(3);
  });

  it("final runner wraps pipeline without breaking semantics", async () => {
    const result = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s29-compat",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(result.pipeline.differenceMatrix.totalScenarios).toBe(12);
    expect(result.pipeline.differenceMatrix.totalFailureCombinations).toBe(3);
    expect(result.pipeline.acceptanceGate.checkResults.length).toBe(8);
    expect(result.preCloseChecklistStatus.matrixCompleted.passed).toBe(true);
  });

  it("escalation threshold unchanged at 3", () => {
    expect(PHASE2_NOTICE_ESCALATION_THRESHOLD).toBe(3);
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.escalationThreshold).toBe(3);
  });
});
