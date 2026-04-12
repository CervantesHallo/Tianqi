import type { Phase2AggregateDifferenceMatrixOverallStatus } from "./core-case-diagnostic-aggregate-difference-matrix.js";
import type { Phase2AcceptanceGateStatus } from "./core-case-diagnostic-aggregate-acceptance-gate.js";
import type {
  Phase2FinalAcceptanceResult,
  Phase2FinalAcceptanceStatus,
  Phase2PreCloseChecklist
} from "./core-case-diagnostic-aggregate-final-acceptance.js";
import {
  PHASE2_FINAL_ACCEPTANCE_GATE_RULESET,
  PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS,
  PHASE2_STEP30_RUNBOOK
} from "./core-case-diagnostic-aggregate-close-readiness.js";

export type Phase2CloseDecisionStatus = "phase2_closed" | "phase2_closed_with_notices" | "phase2_not_closed";

export type Phase2FinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase2";
  readonly decision: Phase2CloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase2AggregateDifferenceMatrixOverallStatus;
  readonly acceptanceGateStatus: Phase2AcceptanceGateStatus;
  readonly finalAcceptanceStatus: Phase2FinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: boolean;
  readonly missingArtifacts: readonly string[];
  readonly readyForPhase3: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase2FinalCloseDecisionConsistencyResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
};

export const PHASE2_FINAL_REQUIRED_ARTIFACTS = [
  "CoreCaseDiagnosticAggregateBaseline",
  "PHASE2_AGGREGATE_SCENARIO_MATRIX",
  "PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX",
  "Phase2AggregateBaselineDifferenceReport",
  "Phase2AggregateDifferenceMatrix",
  "Phase2AcceptanceInputSnapshot",
  "Phase2AcceptanceGateResult",
  "Phase2AcceptancePipelineResult",
  "Phase2FinalAcceptanceResult",
  "PHASE2_FINAL_ACCEPTANCE_GATE_RULESET",
  "PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS",
  "PHASE2_STEP30_RUNBOOK"
] as const;

const allChecksPassed = (checklist: Phase2PreCloseChecklist): boolean =>
  checklist.matrixCompleted.passed &&
  checklist.acceptanceInputBuilt.passed &&
  checklist.gateEvaluated.passed &&
  checklist.highRiskBoundaryCoveredRound1.passed &&
  checklist.highRiskBoundaryCoveredRound2.passed &&
  checklist.blockingIssuesResolvedOrAcknowledged.passed;

export const verifyPhase2FinalArtifacts = (
  result: Phase2FinalAcceptanceResult
): { readonly verified: boolean; readonly missing: readonly string[] } => {
  const missing: string[] = [];

  if (result.pipeline.differenceMatrix.totalScenarios === 0) missing.push("Phase2AggregateDifferenceMatrix");
  if (result.pipeline.acceptanceInput.scenarioMatrixIds.length === 0) missing.push("Phase2AcceptanceInputSnapshot");
  if (result.pipeline.acceptanceGate.checkResults.length === 0) missing.push("Phase2AcceptanceGateResult");
  if (!result.pipeline.pipelineRunId) missing.push("Phase2AcceptancePipelineResult");
  if (!result.finalAcceptanceRunId) missing.push("Phase2FinalAcceptanceResult");
  if (result.pipeline.differenceMatrix.totalFailureCombinations === 0) missing.push("PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX");
  if (result.pipeline.differenceMatrix.scenarioReports.length === 0) missing.push("PHASE2_AGGREGATE_SCENARIO_MATRIX");
  if (!PHASE2_FINAL_ACCEPTANCE_GATE_RULESET.version) missing.push("PHASE2_FINAL_ACCEPTANCE_GATE_RULESET");
  if (PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS.length === 0) missing.push("PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS");
  if (!PHASE2_STEP30_RUNBOOK.runbookId) missing.push("PHASE2_STEP30_RUNBOOK");

  return { verified: missing.length === 0, missing };
};

const buildCloseDecisionSummary = (
  decision: Phase2CloseDecisionStatus,
  result: Phase2FinalAcceptanceResult,
  artifacts: { readonly verified: boolean; readonly missing: readonly string[] }
): string => {
  if (decision === "phase2_closed") {
    return `Phase 2 CLOSED. All checks passed, all artifacts verified. Ready for Phase 3.`;
  }
  if (decision === "phase2_closed_with_notices") {
    return `Phase 2 CLOSED WITH NOTICES. ${result.finalNotices.length} notice(s) to review. No blocking issues. Ready for Phase 3.`;
  }
  const reasons: string[] = [];
  if (result.finalBlockingIssues.length > 0) reasons.push(`${result.finalBlockingIssues.length} blocking issue(s)`);
  if (!artifacts.verified) reasons.push(`missing artifacts: ${artifacts.missing.join(", ")}`);
  if (!allChecksPassed(result.preCloseChecklistStatus)) reasons.push("pre-close checklist incomplete");
  return `Phase 2 NOT CLOSED. ${reasons.join("; ")}. Not ready for Phase 3.`;
};

export const computePhase2CloseDecision = (
  closeDecisionId: string,
  result: Phase2FinalAcceptanceResult,
  freezeConfirmedAt: string
): Phase2FinalCloseDecision => {
  const artifacts = verifyPhase2FinalArtifacts(result);
  const checklistPassed = allChecksPassed(result.preCloseChecklistStatus);

  let decision: Phase2CloseDecisionStatus;

  if (
    !artifacts.verified ||
    result.pipeline.differenceMatrix.overallStatus === "failed" ||
    result.pipeline.acceptanceGate.gateStatus === "fail" ||
    result.finalAcceptanceStatus === "not_ready_to_close" ||
    !checklistPassed ||
    result.finalBlockingIssues.length > 0
  ) {
    decision = "phase2_not_closed";
  } else if (
    result.pipeline.differenceMatrix.overallStatus === "passed_with_notice" ||
    result.pipeline.acceptanceGate.gateStatus === "pass_with_notice" ||
    result.finalAcceptanceStatus === "ready_with_notices"
  ) {
    decision = "phase2_closed_with_notices";
  } else {
    decision = "phase2_closed";
  }

  const readyForPhase3 = decision !== "phase2_not_closed";

  return {
    closeDecisionId,
    phase: "phase2",
    decision,
    decisionSummary: buildCloseDecisionSummary(decision, result, artifacts),
    differenceMatrixStatus: result.pipeline.differenceMatrix.overallStatus,
    acceptanceGateStatus: result.pipeline.acceptanceGate.gateStatus,
    finalAcceptanceStatus: result.finalAcceptanceStatus,
    finalChecklistStatus: checklistPassed ? "all_passed" : "has_failures",
    blockingIssues: [...result.finalBlockingIssues],
    nonBlockingNotices: [...result.finalNotices],
    artifactsVerified: artifacts.verified,
    missingArtifacts: [...artifacts.missing],
    readyForPhase3,
    freezeConfirmedAt
  };
};

export const validatePhase2FinalCloseDecisionConsistency = (
  decision: Phase2FinalCloseDecision
): Phase2FinalCloseDecisionConsistencyResult => {
  const issues: string[] = [];

  if (decision.decision === "phase2_closed") {
    if (decision.blockingIssues.length > 0) {
      issues.push("phase2_closed but blocking issues exist");
    }
    if (decision.differenceMatrixStatus !== "passed") {
      issues.push("phase2_closed but difference matrix not passed");
    }
    if (decision.acceptanceGateStatus !== "pass") {
      issues.push("phase2_closed but gate status not pass");
    }
    if (decision.finalAcceptanceStatus !== "ready_to_close") {
      issues.push("phase2_closed but final acceptance not ready_to_close");
    }
    if (decision.finalChecklistStatus !== "all_passed") {
      issues.push("phase2_closed but checklist has failures");
    }
    if (!decision.artifactsVerified) {
      issues.push("phase2_closed but artifacts not verified");
    }
  }

  if (decision.decision === "phase2_closed_with_notices") {
    if (decision.blockingIssues.length > 0) {
      issues.push("phase2_closed_with_notices but blocking issues exist");
    }
    if (decision.nonBlockingNotices.length === 0) {
      issues.push("phase2_closed_with_notices but no notices present");
    }
    if (decision.finalChecklistStatus !== "all_passed") {
      issues.push("phase2_closed_with_notices but checklist has failures");
    }
    if (!decision.artifactsVerified) {
      issues.push("phase2_closed_with_notices but artifacts not verified");
    }
  }

  if (decision.decision === "phase2_not_closed" && decision.readyForPhase3) {
    issues.push("phase2_not_closed but readyForPhase3 is true");
  }

  if (decision.decision !== "phase2_not_closed" && !decision.readyForPhase3) {
    issues.push(`${decision.decision} but readyForPhase3 is false`);
  }

  if (!decision.artifactsVerified && decision.decision !== "phase2_not_closed") {
    issues.push("Artifacts not verified but decision is not phase2_not_closed");
  }

  return { valid: issues.length === 0, issues };
};
