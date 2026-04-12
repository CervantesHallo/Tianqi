import {
  PHASE2_ACCEPTANCE_GATE_CHECK_IDS,
  PHASE2_NOTICE_ESCALATION_THRESHOLD
} from "./core-case-diagnostic-aggregate-acceptance-gate.js";
import type {
  Phase2FinalAcceptanceConsistencyResult,
  Phase2FinalAcceptanceResult,
  Phase2PreCloseChecklist
} from "./core-case-diagnostic-aggregate-final-acceptance.js";

export const PHASE2_FINAL_ACCEPTANCE_GATE_RULESET = {
  version: "vFinal",
  blockingDriftFields: [
    "riskLevel",
    "manualActionHint",
    "requiresAttention",
    "requiresRepairAction",
    "requiresManualReview",
    "isCrossSessionConsistent",
    "explanationStatus"
  ],
  noticeOnlyDriftFields: [
    "aggregateSummary",
    "recommendedNextStep"
  ],
  failureSemanticStrictness: "strict",
  escalationThreshold: PHASE2_NOTICE_ESCALATION_THRESHOLD,
  gateChecks: PHASE2_ACCEPTANCE_GATE_CHECK_IDS,
  decisionMapping: {
    pass: "ready_for_phase2_close",
    pass_with_notice: "ready_with_notices",
    fail: "not_ready_for_phase2_close"
  }
} as const;

export type Phase2FinalPreCloseChecklistItemDef = {
  readonly checkId: string;
  readonly blocking: boolean;
  readonly description: string;
};

export const PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS: readonly Phase2FinalPreCloseChecklistItemDef[] = [
  { checkId: "matrixCompleted", blocking: true, description: "Difference matrix covers >=12 scenarios and >=3 combinations" },
  { checkId: "acceptanceInputBuilt", blocking: true, description: "Acceptance input snapshot generated" },
  { checkId: "gateEvaluated", blocking: true, description: "Acceptance gate evaluates >=8 checks" },
  { checkId: "highRiskBoundaryCoveredRound1", blocking: true, description: "Round 1 boundary scenarios (G1-G4) covered" },
  { checkId: "highRiskBoundaryCoveredRound2", blocking: true, description: "Round 2 boundary scenarios (H1-H4) covered" },
  { checkId: "blockingIssuesResolvedOrAcknowledged", blocking: true, description: "All blocking issues resolved or acknowledged" }
] as const;

export type Phase2RunbookStep = {
  readonly stepOrder: number;
  readonly stepId: string;
  readonly description: string;
  readonly producesArtifact: string;
};

export type Phase2FinalAcceptanceRunbook = {
  readonly runbookId: string;
  readonly version: string;
  readonly steps: readonly Phase2RunbookStep[];
  readonly requiredArtifacts: readonly string[];
  readonly successCondition: string;
  readonly failureCondition: string;
  readonly closeDecisionRule: string;
};

export const PHASE2_STEP30_RUNBOOK: Phase2FinalAcceptanceRunbook = {
  runbookId: "phase2-step30-final-acceptance",
  version: "vFinal",
  steps: [
    { stepOrder: 1, stepId: "run_difference_matrix", description: "Run difference matrix across 12 scenarios + 3 failure combinations", producesArtifact: "Phase2AggregateDifferenceMatrix" },
    { stepOrder: 2, stepId: "build_acceptance_input", description: "Build acceptance input snapshot from matrix results", producesArtifact: "Phase2AcceptanceInputSnapshot" },
    { stepOrder: 3, stepId: "run_acceptance_gate", description: "Evaluate 8 gate checks + notice escalation (threshold=" + String(PHASE2_NOTICE_ESCALATION_THRESHOLD) + ")", producesArtifact: "Phase2AcceptanceGateResult" },
    { stepOrder: 4, stepId: "run_final_acceptance", description: "Run final acceptance runner with pipeline + pre-close checklist (6 items)", producesArtifact: "Phase2FinalAcceptanceResult" },
    { stepOrder: 5, stepId: "validate_gate_ruleset", description: "Verify PHASE2_FINAL_ACCEPTANCE_GATE_RULESET vFinal applied", producesArtifact: "gate_ruleset_validation" },
    { stepOrder: 6, stepId: "validate_preclose_checklist", description: "Verify all 6 PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS pass", producesArtifact: "preclose_checklist_validation" },
    { stepOrder: 7, stepId: "output_close_decision", description: "Output final: ready_to_close / ready_with_notices / not_ready_to_close", producesArtifact: "Phase2CloseDecision" }
  ],
  requiredArtifacts: [
    "Phase2AggregateDifferenceMatrix",
    "Phase2AcceptanceInputSnapshot",
    "Phase2AcceptanceGateResult",
    "Phase2FinalAcceptanceResult"
  ],
  successCondition: "finalAcceptanceStatus=ready_to_close: pipeline ready, gate pass, all 6 pre-close checks passed, no blocking issues",
  failureCondition: "finalAcceptanceStatus=not_ready_to_close: gate fail OR pipeline not_ready OR pre-close incomplete OR blocking issues exist",
  closeDecisionRule: "ready_to_close -> Phase 2 closes; ready_with_notices -> close after notice review; not_ready_to_close -> resolve first"
};

const allChecksPassed = (checklist: Phase2PreCloseChecklist): boolean =>
  checklist.matrixCompleted.passed &&
  checklist.acceptanceInputBuilt.passed &&
  checklist.gateEvaluated.passed &&
  checklist.highRiskBoundaryCoveredRound1.passed &&
  checklist.highRiskBoundaryCoveredRound2.passed &&
  checklist.blockingIssuesResolvedOrAcknowledged.passed;

export const validatePhase2CloseReadinessConsistency = (
  result: Phase2FinalAcceptanceResult
): Phase2FinalAcceptanceConsistencyResult => {
  const issues: string[] = [];

  if (result.pipeline.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Gate failed but close decision is ready_to_close");
  }

  if (result.pipeline.pipelineStatus === "not_ready" && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Pipeline not ready but close decision is ready_to_close");
  }

  if (result.finalBlockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Blocking issues exist but status is ready_to_close");
  }

  if (
    result.pipeline.pipelineStatus === "ready_with_notices" &&
    result.finalBlockingIssues.length === 0 &&
    allChecksPassed(result.preCloseChecklistStatus) &&
    result.finalAcceptanceStatus === "not_ready_to_close"
  ) {
    issues.push("Notices-only with all pre-close passed should not be not_ready_to_close");
  }

  if (!allChecksPassed(result.preCloseChecklistStatus) && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Pre-close checklist incomplete but status is ready_to_close");
  }

  if (
    result.pipeline.pipelineStatus === "ready" &&
    allChecksPassed(result.preCloseChecklistStatus) &&
    result.finalAcceptanceStatus === "not_ready_to_close"
  ) {
    issues.push("All conditions met but status is not_ready_to_close");
  }

  if (result.pipeline.acceptanceGate.checkResults.length < PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.gateChecks.length) {
    issues.push(
      `Gate evaluated ${result.pipeline.acceptanceGate.checkResults.length} checks, expected >= ${PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.gateChecks.length}`
    );
  }

  return { valid: issues.length === 0, issues };
};
