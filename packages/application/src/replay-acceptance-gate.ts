import type { Phase5ReplayAcceptanceInputSnapshot } from "./replay-difference-matrix.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase5ReplayGateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase5ReplayGateRecommendedDecision =
  | "ready_for_phase5_close_preparation"
  | "ready_with_notices"
  | "not_ready_for_phase5_close_preparation";

export type Phase5ReplayAcceptanceGateChecklistItem = {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase5ReplayAcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase5ReplayGateStatus;
  readonly checkResults: readonly Phase5ReplayAcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly gateSummary: string;
  readonly recommendedDecision: Phase5ReplayGateRecommendedDecision;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_SINGLE_CASE_SCENARIOS = 5;
const EXPECTED_BATCH_SCENARIOS = 5;

// ─── checklist evaluators ───────────────────────────────────────────────────

const hasBlockingIn = (issues: readonly string[], pattern: string): boolean =>
  issues.some(i => i.includes(pattern));

const matchingIssues = (issues: readonly string[], pattern: string): readonly string[] =>
  issues.filter(i => i.includes(pattern));

const evaluateSingleCaseStable = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const failed = input.blockingIssues.some(i => i.startsWith("S"));
  return {
    checkId: "single_case_replay_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Single-case replay has blocking drift" : "Single-case replay stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "S") : [...input.singleCaseScenarioIds]
  };
};

const evaluateBatchStable = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const failed = input.blockingIssues.some(i => i.startsWith("B"));
  return {
    checkId: "batch_replay_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Batch replay has blocking drift" : "Batch replay stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "B") : [...input.batchReplayScenarioIds]
  };
};

const evaluateReconstructionStable = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "reconstructionStatus") || hasBlockingIn(input.blockingIssues, "finalState");
  return {
    checkId: "reconstruction_semantics_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Reconstruction semantics has blocking drift" : "Reconstruction semantics stable",
    blocking: true,
    relatedArtifacts: failed ? [...matchingIssues(input.blockingIssues, "reconstructionStatus"), ...matchingIssues(input.blockingIssues, "finalState")] : []
  };
};

const evaluateComparisonStable = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "comparisonStatus") || hasBlockingIn(input.blockingIssues, "hasDifference");
  return {
    checkId: "comparison_semantics_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Comparison semantics has blocking drift" : "Comparison semantics stable",
    blocking: true,
    relatedArtifacts: failed ? [...matchingIssues(input.blockingIssues, "comparisonStatus"), ...matchingIssues(input.blockingIssues, "hasDifference")] : []
  };
};

const evaluateConsistencyStable = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "failedCases") || hasBlockingIn(input.blockingIssues, "incompleteCases");
  return {
    checkId: "replay_consistency_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Replay consistency has blocking drift in aggregate counts" : "Replay consistency stable",
    blocking: true,
    relatedArtifacts: failed ? [...matchingIssues(input.blockingIssues, "failedCases"), ...matchingIssues(input.blockingIssues, "incompleteCases")] : []
  };
};

const evaluateMatrixCoverage = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  const scOk = input.singleCaseScenarioIds.length >= EXPECTED_SINGLE_CASE_SCENARIOS;
  const btOk = input.batchReplayScenarioIds.length >= EXPECTED_BATCH_SCENARIOS;
  const failed = !scOk || !btOk;
  return {
    checkId: "replay_matrix_covered",
    status: failed ? "fail" : "pass",
    reason: failed
      ? `Matrix coverage insufficient: SC=${input.singleCaseScenarioIds.length}, BT=${input.batchReplayScenarioIds.length}`
      : `Matrix covered: SC=${input.singleCaseScenarioIds.length}, BT=${input.batchReplayScenarioIds.length}`,
    blocking: true,
    relatedArtifacts: [...input.singleCaseScenarioIds, ...input.batchReplayScenarioIds]
  };
};

const evaluateNoBlockingDrift = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  if (input.blockingIssues.length > 0) {
    return { checkId: "no_blocking_core_field_drift", status: "fail", reason: `${input.blockingIssues.length} blocking drift(s) detected`, blocking: true, relatedArtifacts: [...input.blockingIssues] };
  }
  if (input.nonBlockingNotices.length > 0) {
    return { checkId: "no_blocking_core_field_drift", status: "warning", reason: `No blocking drift, but ${input.nonBlockingNotices.length} notice(s)`, blocking: true, relatedArtifacts: [...input.nonBlockingNotices] };
  }
  return { checkId: "no_blocking_core_field_drift", status: "pass", reason: "No core field drift", blocking: true, relatedArtifacts: [] };
};

const evaluateCrossConsistency = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayAcceptanceGateChecklistItem => {
  if (input.differenceMatrixOverallStatus === "failed") {
    return { checkId: "single_and_batch_consistency_passed", status: "fail", reason: "Difference matrix overall status is failed", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  }
  if (input.differenceMatrixOverallStatus === "passed_with_notice") {
    return { checkId: "single_and_batch_consistency_passed", status: "warning", reason: "Difference matrix passed_with_notice", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  }
  return { checkId: "single_and_batch_consistency_passed", status: "pass", reason: "Single/batch consistency passed", blocking: true, relatedArtifacts: [] };
};

const CHECKLIST_EVALUATORS = [
  evaluateSingleCaseStable,
  evaluateBatchStable,
  evaluateReconstructionStable,
  evaluateComparisonStable,
  evaluateConsistencyStable,
  evaluateMatrixCoverage,
  evaluateNoBlockingDrift,
  evaluateCrossConsistency
] as const;

// ─── gate runner ────────────────────────────────────────────────────────────

export const runPhase5ReplayAcceptanceGate = (
  gateId: string,
  input: Phase5ReplayAcceptanceInputSnapshot
): Phase5ReplayAcceptanceGateResult => {
  const checkResults = CHECKLIST_EVALUATORS.map(ev => ev(input));

  const passedChecks = checkResults.filter(c => c.status === "pass").length;
  const failedChecks = checkResults.filter(c => c.status === "fail").length;
  const warningChecks = checkResults.filter(c => c.status === "warning").length;

  const hasBlockingFailure = checkResults.some(c => c.blocking && c.status === "fail");
  const hasWarning = warningChecks > 0;

  const gateStatus: Phase5ReplayGateStatus =
    hasBlockingFailure ? "fail" : hasWarning ? "pass_with_notice" : "pass";

  const recommendedDecision: Phase5ReplayGateRecommendedDecision =
    gateStatus === "pass" ? "ready_for_phase5_close_preparation"
    : gateStatus === "pass_with_notice" ? "ready_with_notices"
    : "not_ready_for_phase5_close_preparation";

  const blockingIssues = checkResults.filter(c => c.blocking && c.status === "fail").map(c => c.reason);
  const warningReasons = checkResults.filter(c => c.status === "warning").map(c => c.reason);
  const nonBlockingNotices = [...new Set([...warningReasons, ...input.nonBlockingNotices])];

  const gateSummary = buildPhase5ReplayAcceptanceGateSummary({
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary: "", recommendedDecision
  });

  return { gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks, blockingIssues, nonBlockingNotices, gateSummary, recommendedDecision };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase5ReplayAcceptanceGateSummary = (
  result: Phase5ReplayAcceptanceGateResult
): string => {
  const lines: string[] = [];

  if (result.gateStatus === "pass") {
    lines.push(`Phase 5 Replay Gate [${result.gateId}] PASSED: all ${result.passedChecks} checks passed`);
    lines.push("Phase 5 has reached close preparation readiness");
  } else if (result.gateStatus === "pass_with_notice") {
    lines.push(`Phase 5 Replay Gate [${result.gateId}] PASSED WITH NOTICE: ${result.passedChecks} passed, ${result.warningChecks} warning(s)`);
    lines.push("Phase 5 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 5 Replay Gate [${result.gateId}] FAILED: ${result.failedChecks} check(s) failed`);
    lines.push("Phase 5 is NOT ready for close preparation");
  }

  if (result.blockingIssues.length > 0) lines.push(`Blocking: ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices: ${result.nonBlockingNotices.join("; ")}`);

  if (result.gateStatus === "fail") lines.push("Next: resolve blocking issues and re-run gate");
  else if (result.gateStatus === "pass_with_notice") lines.push("Next: review notices, then proceed to Phase 5 close preparation (Step 5)");
  else lines.push("Next: proceed to Phase 5 close preparation (Step 5)");

  return lines.join("\n");
};
