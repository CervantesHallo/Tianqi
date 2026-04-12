import type { Phase4AcceptanceInputSnapshot } from "./orchestration-difference-matrix.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase4AcceptanceGateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase4AcceptanceGateRecommendedDecision =
  | "ready_for_phase4_close_preparation"
  | "ready_with_notices"
  | "not_ready_for_phase4_close_preparation";

export type Phase4AcceptanceGateChecklistItem = {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase4AcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase4AcceptanceGateStatus;
  readonly checkResults: readonly Phase4AcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly gateSummary: string;
  readonly recommendedDecision: Phase4AcceptanceGateRecommendedDecision;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_RISK_CASE_SCENARIOS = 5;
const EXPECTED_LIQUIDATION_CASE_SCENARIOS = 5;

// ─── checklist evaluators ───────────────────────────────────────────────────

const hasBlockingIn = (issues: readonly string[], pattern: string): boolean =>
  issues.some(i => i.includes(pattern));

const matchingIssues = (issues: readonly string[], pattern: string): readonly string[] =>
  issues.filter(i => i.includes(pattern));

const evaluateRiskCaseStable = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const failed = input.blockingIssues.some(i => i.startsWith("R") && (i.includes("resultStatus") || i.includes("sagaStatus")));
  return {
    checkId: "risk_case_orchestration_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "RiskCase orchestration has blocking drift" : "RiskCase orchestration stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "R") : [...input.riskCaseScenarioIds]
  };
};

const evaluateLiquidationCaseStable = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const failed = input.blockingIssues.some(i => i.startsWith("L") && (i.includes("resultStatus") || i.includes("sagaStatus")));
  return {
    checkId: "liquidation_case_orchestration_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "LiquidationCase orchestration has blocking drift" : "LiquidationCase orchestration stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "L") : [...input.liquidationCaseScenarioIds]
  };
};

const evaluateReplayStable = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "idempotencyStatus");
  return {
    checkId: "replay_semantics_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Replay semantics has blocking idempotencyStatus drift" : "Replay semantics stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "idempotencyStatus") : []
  };
};

const evaluateCompensationStable = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "pendingCompensation") || hasBlockingIn(input.blockingIssues, "compensationStatus");
  return {
    checkId: "compensation_semantics_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Compensation semantics has blocking drift" : "Compensation semantics stable",
    blocking: true,
    relatedArtifacts: failed ? [...matchingIssues(input.blockingIssues, "pendingCompensation"), ...matchingIssues(input.blockingIssues, "compensationStatus")] : []
  };
};

const evaluateSagaResumeStable = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "sagaStatus");
  return {
    checkId: "saga_resume_semantics_stable",
    status: failed ? "fail" : "pass",
    reason: failed ? "Saga/resume semantics has blocking sagaStatus drift" : "Saga/resume semantics stable",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "sagaStatus") : []
  };
};

const evaluateMatrixCoverage = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  const rcOk = input.riskCaseScenarioIds.length >= EXPECTED_RISK_CASE_SCENARIOS;
  const lcOk = input.liquidationCaseScenarioIds.length >= EXPECTED_LIQUIDATION_CASE_SCENARIOS;
  const failed = !rcOk || !lcOk;
  return {
    checkId: "orchestration_matrix_covered",
    status: failed ? "fail" : "pass",
    reason: failed
      ? `Matrix coverage insufficient: RC=${input.riskCaseScenarioIds.length}, LC=${input.liquidationCaseScenarioIds.length}`
      : `Matrix covered: RC=${input.riskCaseScenarioIds.length}, LC=${input.liquidationCaseScenarioIds.length}`,
    blocking: true,
    relatedArtifacts: [...input.riskCaseScenarioIds, ...input.liquidationCaseScenarioIds]
  };
};

const evaluateNoBlockingDrift = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  if (input.blockingIssues.length > 0) {
    return {
      checkId: "no_blocking_core_field_drift",
      status: "fail",
      reason: `${input.blockingIssues.length} blocking core field drift(s) detected`,
      blocking: true,
      relatedArtifacts: [...input.blockingIssues]
    };
  }
  if (input.nonBlockingNotices.length > 0) {
    return {
      checkId: "no_blocking_core_field_drift",
      status: "warning",
      reason: `No blocking drift, but ${input.nonBlockingNotices.length} notice-level drift(s)`,
      blocking: true,
      relatedArtifacts: [...input.nonBlockingNotices]
    };
  }
  return { checkId: "no_blocking_core_field_drift", status: "pass", reason: "No core field drift detected", blocking: true, relatedArtifacts: [] };
};

const evaluateCrossPathConsistency = (input: Phase4AcceptanceInputSnapshot): Phase4AcceptanceGateChecklistItem => {
  if (input.differenceMatrixOverallStatus === "failed") {
    return {
      checkId: "cross_path_consistency_passed",
      status: "fail",
      reason: "Difference matrix overall status is failed",
      blocking: true,
      relatedArtifacts: [...input.keyDriftFindings]
    };
  }
  if (input.differenceMatrixOverallStatus === "passed_with_notice") {
    return {
      checkId: "cross_path_consistency_passed",
      status: "warning",
      reason: "Difference matrix overall status is passed_with_notice",
      blocking: true,
      relatedArtifacts: [...input.keyDriftFindings]
    };
  }
  return { checkId: "cross_path_consistency_passed", status: "pass", reason: "Cross-path consistency passed", blocking: true, relatedArtifacts: [] };
};

const CHECKLIST_EVALUATORS = [
  evaluateRiskCaseStable,
  evaluateLiquidationCaseStable,
  evaluateReplayStable,
  evaluateCompensationStable,
  evaluateSagaResumeStable,
  evaluateMatrixCoverage,
  evaluateNoBlockingDrift,
  evaluateCrossPathConsistency
] as const;

// ─── gate runner ────────────────────────────────────────────────────────────

export const runPhase4AcceptanceGate = (
  gateId: string,
  input: Phase4AcceptanceInputSnapshot
): Phase4AcceptanceGateResult => {
  const checkResults = CHECKLIST_EVALUATORS.map(ev => ev(input));

  const passedChecks = checkResults.filter(c => c.status === "pass").length;
  const failedChecks = checkResults.filter(c => c.status === "fail").length;
  const warningChecks = checkResults.filter(c => c.status === "warning").length;

  const hasBlockingFailure = checkResults.some(c => c.blocking && c.status === "fail");
  const hasWarning = warningChecks > 0;

  const gateStatus: Phase4AcceptanceGateStatus =
    hasBlockingFailure ? "fail" : hasWarning ? "pass_with_notice" : "pass";

  const recommendedDecision: Phase4AcceptanceGateRecommendedDecision =
    gateStatus === "pass" ? "ready_for_phase4_close_preparation"
    : gateStatus === "pass_with_notice" ? "ready_with_notices"
    : "not_ready_for_phase4_close_preparation";

  const blockingIssues = checkResults.filter(c => c.blocking && c.status === "fail").map(c => c.reason);
  const warningReasons = checkResults.filter(c => c.status === "warning").map(c => c.reason);
  const nonBlockingNotices = [...new Set([...warningReasons, ...input.nonBlockingNotices])];

  const gateSummary = buildPhase4AcceptanceGateSummary({
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary: "", recommendedDecision
  });

  return {
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary, recommendedDecision
  };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase4AcceptanceGateSummary = (
  result: Phase4AcceptanceGateResult
): string => {
  const lines: string[] = [];

  if (result.gateStatus === "pass") {
    lines.push(`Phase 4 Acceptance Gate [${result.gateId}] PASSED: all ${result.passedChecks} checks passed`);
    lines.push("Phase 4 has reached close preparation readiness");
  } else if (result.gateStatus === "pass_with_notice") {
    lines.push(`Phase 4 Acceptance Gate [${result.gateId}] PASSED WITH NOTICE: ${result.passedChecks} passed, ${result.warningChecks} warning(s)`);
    lines.push("Phase 4 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 4 Acceptance Gate [${result.gateId}] FAILED: ${result.failedChecks} check(s) failed`);
    lines.push("Phase 4 is NOT ready for close preparation");
  }

  if (result.blockingIssues.length > 0) {
    lines.push(`Blocking: ${result.blockingIssues.join("; ")}`);
  }
  if (result.nonBlockingNotices.length > 0) {
    lines.push(`Notices: ${result.nonBlockingNotices.join("; ")}`);
  }

  if (result.gateStatus === "fail") {
    lines.push("Next: resolve blocking issues and re-run acceptance gate");
  } else if (result.gateStatus === "pass_with_notice") {
    lines.push("Next: review notices, then proceed to Phase 4 close preparation (Step 6)");
  } else {
    lines.push("Next: proceed to Phase 4 close preparation (Step 6)");
  }

  return lines.join("\n");
};
