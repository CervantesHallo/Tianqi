import { describe, expect, it } from "vitest";

import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import {
  runPhase2FinalAcceptance
} from "./core-case-diagnostic-aggregate-final-acceptance.js";
import {
  PHASE2_FINAL_ACCEPTANCE_GATE_RULESET,
  PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS,
  PHASE2_STEP30_RUNBOOK
} from "./core-case-diagnostic-aggregate-close-readiness.js";
import {
  computePhase2CloseDecision,
  PHASE2_FINAL_REQUIRED_ARTIFACTS,
  validatePhase2FinalCloseDecisionConsistency,
  verifyPhase2FinalArtifacts,
  type Phase2FinalCloseDecision
} from "./core-case-diagnostic-aggregate-final-close.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-s30|ADLCase|adl-s30|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s30",
      subcaseType: "ADLCase",
      subcaseId: "adl-s30",
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
  suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: "risk-case-s30|current_snapshot_conflict", canRetry: false, canConfirmManually: false },
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

const fk = "risk-case-s30|ADLCase|adl-s30|2026-03-25T00:00:02.000Z";
const sk = "risk-case-s30|current_snapshot_conflict";

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
  switch (matrixId) {
    case "M01": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence(), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M02": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s30", subcaseType: "ADLCase", subcaseId: "adl-s30", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 2, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "retryable", actionHintReason: "retry required", diagnosticSummary: "retryable" }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 2, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" }) });
    case "M03": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s30", subcaseType: "ADLCase", subcaseId: "adl-s30", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "manual_confirmation_recommended", riskReason: "manual confirmation required", actionHintReason: "manual confirm", diagnosticSummary: "manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT", alertSummary: "critical conflict", operationalHint: "manual_diagnostic_review_required", triggerSource: "replay_validation", requiresAttention: true }, historyConsistency: buildHistoryConsistency(), alertSuppressionPersistence: buildSuppressionPersistence({ suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "failed" }) });
    case "M04": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "passed", reason: "notice: minor slot drift" }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay notice" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M05": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M06": return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "passed", continuityReason: "suppression continuity notice: minor drift" }), suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: false }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M07": return makeBaseSuccessResult({ alertSuppressionPersistence: buildSuppressionPersistence({ continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed" }), suppressionStateRepairCommandLink: buildCommandLink() });
    case "M08": return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "missing_record", commandLinkConsistencyReason: "record missing" }) });
    case "M09": return makeBaseSuccessResult({ suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    case "M10": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s30", subcaseType: "ADLCase", subcaseId: "adl-s30", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repaired", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict", actionHintReason: "investigate", diagnosticSummary: "validation conflict" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M11": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s30", subcaseType: "ADLCase", subcaseId: "adl-s30", currentReadViewStatus: "persisted", validationStatus: "passed", repairStatus: "repair_failed_retryable", repairAttempts: 1, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "medium", manualActionHint: "retry_repair_recommended", riskReason: "incompatible version + suppression failed", actionHintReason: "repair needed", diagnosticSummary: "incompatible + continuity failed" }, alertSuppressionPersistence: buildSuppressionPersistence({ stateReadCompatibility: "incompatible_version", stateRepairRecommended: true, continuityStatus: "failed", continuityReasonCategory: "suppression_key_mismatch", continuityReason: "suppression continuity failed", suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true } }), suppressionStateRepair: { repairStatus: "repair_failed_retryable", repairAttempts: 1, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: true, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
    case "M12": return makeBaseSuccessResult({ historyConsistency: buildHistoryConsistency({ status: "failed", reason: "history continuity failed", replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" } }), historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }, suppressionStateRepairCommandLink: buildCommandLink({ commandLinkConsistencyStatus: "status_mismatch", commandLinkConsistencyReason: "status mismatch" }) });
    default: throw new Error(`Unknown scenario: ${matrixId}`);
  }
};

const buildFailureCombinationInput = (combinationId: string): DiagnosticSuccessResult => {
  switch (combinationId) {
    case "FC01": return makeBaseSuccessResult({ view: { factKey: fk, riskCaseId: "risk-case-s30", subcaseType: "ADLCase", subcaseId: "adl-s30", currentReadViewStatus: "persisted", validationStatus: "failed", repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, manualConfirmation: false, assessmentRulesVersion: "1.0.0", riskLevel: "high", manualActionHint: "investigate_validation_conflict", riskReason: "validation conflict + manual confirmation", actionHintReason: "investigate + manual", diagnosticSummary: "validation conflict + manual review" }, readAlert: { severity: "critical", alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT", alertSummary: "conflict", operationalHint: "inspect_snapshot_conflict", triggerSource: "replay_validation", requiresAttention: true }, suppressionStateRepair: { repairStatus: "repair_failed_manual_confirmation_required", repairAttempts: 3, lastRepairOutcome: "failed", manualConfirmation: false, targetSuppressionKey: sk, canRetry: false, canConfirmManually: true }, suppressionStateRepairCommandLink: buildCommandLink() });
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

const FREEZE_TS = "2026-03-25T12:00:00.000Z";

describe("Step 30 Runbook Execution: phase2_closed — all conditions met", () => {
  it("clean run → phase2_closed + readyForPhase3 + consistency valid", async () => {
    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-closed",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(acceptance.finalAcceptanceStatus).toBe("ready_to_close");
    expect(acceptance.pipeline.differenceMatrix.overallStatus).toBe("passed");
    expect(acceptance.pipeline.acceptanceGate.gateStatus).toBe("pass");

    const artifacts = verifyPhase2FinalArtifacts(acceptance);
    expect(artifacts.verified).toBe(true);

    const decision = computePhase2CloseDecision("close-01", acceptance, FREEZE_TS);

    expect(decision.decision).toBe("phase2_closed");
    expect(decision.readyForPhase3).toBe(true);
    expect(decision.phase).toBe("phase2");
    expect(decision.differenceMatrixStatus).toBe("passed");
    expect(decision.acceptanceGateStatus).toBe("pass");
    expect(decision.finalAcceptanceStatus).toBe("ready_to_close");
    expect(decision.finalChecklistStatus).toBe("all_passed");
    expect(decision.blockingIssues.length).toBe(0);
    expect(decision.artifactsVerified).toBe(true);
    expect(decision.missingArtifacts.length).toBe(0);
    expect(decision.freezeConfirmedAt).toBe(FREEZE_TS);
    expect(decision.decisionSummary).toContain("CLOSED");
    expect(decision.decisionSummary).toContain("Phase 3");

    const consistency = validatePhase2FinalCloseDecisionConsistency(decision);
    expect(consistency.valid).toBe(true);
    expect(consistency.issues.length).toBe(0);
  });
});

describe("Step 30 Runbook Execution: phase2_closed_with_notices", () => {
  it("single notice drift → phase2_closed_with_notices + readyForPhase3", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "risk=low; hint=no_action_needed; attention=no; repair=no; manual_review=no; consistent=yes [notice drift]" }
    });

    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-notices",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    expect(acceptance.finalAcceptanceStatus).toBe("ready_with_notices");

    const decision = computePhase2CloseDecision("close-02", acceptance, FREEZE_TS);

    expect(decision.decision).toBe("phase2_closed_with_notices");
    expect(decision.readyForPhase3).toBe(true);
    expect(decision.blockingIssues.length).toBe(0);
    expect(decision.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(decision.decisionSummary).toContain("CLOSED WITH NOTICES");

    const consistency = validatePhase2FinalCloseDecisionConsistency(decision);
    expect(consistency.valid).toBe(true);
  });
});

describe("Step 30 Runbook Execution: phase2_not_closed", () => {
  it("blocking drift → phase2_not_closed + readyForPhase3=false", async () => {
    const providers = createBoundaryProviders({
      "M01": { riskLevel: "high", manualActionHint: "investigate_missing_read_view", requiresAttention: true }
    });

    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-fail-drift",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const decision = computePhase2CloseDecision("close-03", acceptance, FREEZE_TS);

    expect(decision.decision).toBe("phase2_not_closed");
    expect(decision.readyForPhase3).toBe(false);
    expect(decision.blockingIssues.length).toBeGreaterThan(0);
    expect(decision.decisionSummary).toContain("NOT CLOSED");

    const consistency = validatePhase2FinalCloseDecisionConsistency(decision);
    expect(consistency.valid).toBe(true);
  });

  it("gate fail → phase2_not_closed", async () => {
    const providers = createBoundaryProviders({
      "M01": { isCrossSessionConsistent: false, explanationStatus: "inconsistent" }
    });

    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-fail-gate",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const decision = computePhase2CloseDecision("close-04", acceptance, FREEZE_TS);

    expect(decision.decision).toBe("phase2_not_closed");
    expect(decision.readyForPhase3).toBe(false);
    expect(decision.acceptanceGateStatus).toBe("fail");
  });

  it("checklist incomplete → phase2_not_closed", async () => {
    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-fail-checklist",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: false
    });

    const decision = computePhase2CloseDecision("close-05", acceptance, FREEZE_TS);

    expect(decision.decision).toBe("phase2_not_closed");
    expect(decision.readyForPhase3).toBe(false);
    expect(decision.finalChecklistStatus).toBe("has_failures");
  });
});

describe("Step 30: artifact verification", () => {
  it("all artifacts present → verified", async () => {
    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-art-ok",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });

    const artifacts = verifyPhase2FinalArtifacts(acceptance);
    expect(artifacts.verified).toBe(true);
    expect(artifacts.missing.length).toBe(0);
  });

  it("PHASE2_FINAL_REQUIRED_ARTIFACTS lists 12 assets", () => {
    expect(PHASE2_FINAL_REQUIRED_ARTIFACTS.length).toBe(12);
  });

  it("frozen constants are available at runtime", () => {
    expect(PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.version).toBe("vFinal");
    expect(PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS.length).toBe(6);
    expect(PHASE2_STEP30_RUNBOOK.runbookId).toBe("phase2-step30-final-acceptance");
    expect(PHASE2_STEP30_RUNBOOK.steps.length).toBe(7);
  });
});

describe("Step 30: final close decision consistency validator", () => {
  it("detects phase2_closed with blocking issues", () => {
    const fake: Phase2FinalCloseDecision = {
      closeDecisionId: "x", phase: "phase2", decision: "phase2_closed",
      decisionSummary: "", differenceMatrixStatus: "passed", acceptanceGateStatus: "pass",
      finalAcceptanceStatus: "ready_to_close", finalChecklistStatus: "all_passed",
      blockingIssues: ["some_issue"], nonBlockingNotices: [],
      artifactsVerified: true, missingArtifacts: [], readyForPhase3: true, freezeConfirmedAt: FREEZE_TS
    };
    const v = validatePhase2FinalCloseDecisionConsistency(fake);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => i.includes("blocking issues"))).toBe(true);
  });

  it("detects phase2_closed_with_notices without notices", () => {
    const fake: Phase2FinalCloseDecision = {
      closeDecisionId: "x", phase: "phase2", decision: "phase2_closed_with_notices",
      decisionSummary: "", differenceMatrixStatus: "passed_with_notice", acceptanceGateStatus: "pass_with_notice",
      finalAcceptanceStatus: "ready_with_notices", finalChecklistStatus: "all_passed",
      blockingIssues: [], nonBlockingNotices: [],
      artifactsVerified: true, missingArtifacts: [], readyForPhase3: true, freezeConfirmedAt: FREEZE_TS
    };
    const v = validatePhase2FinalCloseDecisionConsistency(fake);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => i.includes("no notices"))).toBe(true);
  });

  it("detects phase2_not_closed with readyForPhase3=true", () => {
    const fake: Phase2FinalCloseDecision = {
      closeDecisionId: "x", phase: "phase2", decision: "phase2_not_closed",
      decisionSummary: "", differenceMatrixStatus: "failed", acceptanceGateStatus: "fail",
      finalAcceptanceStatus: "not_ready_to_close", finalChecklistStatus: "has_failures",
      blockingIssues: ["x"], nonBlockingNotices: [],
      artifactsVerified: true, missingArtifacts: [], readyForPhase3: true, freezeConfirmedAt: FREEZE_TS
    };
    const v = validatePhase2FinalCloseDecisionConsistency(fake);
    expect(v.valid).toBe(false);
    expect(v.issues.some((i) => i.includes("readyForPhase3"))).toBe(true);
  });

  it("valid for real closed run", async () => {
    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-consistency",
      ...createStandardProviders(),
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });
    const decision = computePhase2CloseDecision("close-cv", acceptance, FREEZE_TS);
    const v = validatePhase2FinalCloseDecisionConsistency(decision);
    expect(v.valid).toBe(true);
  });

  it("valid for real closed_with_notices run", async () => {
    const providers = createBoundaryProviders({
      "M01": { aggregateSummary: "drifted-consistency-notice" }
    });
    const acceptance = await runPhase2FinalAcceptance({
      finalAcceptanceRunId: "s30-consistency-notice",
      ...providers,
      boundaryRound1Covered: true,
      boundaryRound2Covered: true
    });
    const decision = computePhase2CloseDecision("close-cn", acceptance, FREEZE_TS);
    const v = validatePhase2FinalCloseDecisionConsistency(decision);
    expect(v.valid).toBe(true);
  });
});

describe("Step 30: runbook structure integrity", () => {
  it("runbook steps match execution sequence", () => {
    const stepIds = PHASE2_STEP30_RUNBOOK.steps.map((s) => s.stepId);
    expect(stepIds).toEqual([
      "run_difference_matrix",
      "build_acceptance_input",
      "run_acceptance_gate",
      "run_final_acceptance",
      "validate_gate_ruleset",
      "validate_preclose_checklist",
      "output_close_decision"
    ]);
  });

  it("matrices unchanged", () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBe(12);
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBe(3);
  });
});
