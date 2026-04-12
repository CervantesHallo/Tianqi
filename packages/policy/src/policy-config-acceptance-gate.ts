import type { Phase3AcceptanceInputSnapshot } from "./policy-config-difference-matrix.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase3AcceptanceGateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase3AcceptanceGateRecommendedDecision =
  | "ready_for_phase3_close_preparation"
  | "ready_with_notices"
  | "not_ready_for_phase3_close_preparation";

export type Phase3AcceptanceGateChecklistItem = {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase3AcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase3AcceptanceGateStatus;
  readonly checkResults: readonly Phase3AcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly gateSummary: string;
  readonly recommendedDecision: Phase3AcceptanceGateRecommendedDecision;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_STRATEGY_SCENARIOS = 5;
const EXPECTED_CONFIG_VERSION_SCENARIOS = 6;

// ─── checklist evaluators ───────────────────────────────────────────────────

const hasBlockingField = (issues: readonly string[], field: string): boolean =>
  issues.some(i => i.includes(field));

const hasBlockingInGroup = (issues: readonly string[], field: string, prefix: string): boolean =>
  issues.some(i => i.startsWith(prefix) && i.includes(field));

const matchingIssues = (issues: readonly string[], field: string): readonly string[] =>
  issues.filter(i => i.includes(field));

const evaluateBundleResolution = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const failed = hasBlockingInGroup(input.blockingIssues, "preflightPassed", "S");
  return {
    checkId: "policy_bundle_resolution_stable",
    status: failed ? "fail" : "pass",
    reason: failed
      ? "Strategy bundle resolution has blocking preflightPassed drift"
      : "Strategy bundle resolution stable across all scenarios",
    blocking: true,
    relatedArtifacts: failed
      ? matchingIssues(input.blockingIssues, "preflightPassed")
      : [...input.strategyScenarioIds]
  };
};

const evaluateDryRun = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const failed = hasBlockingField(input.blockingIssues, "dryRunPassed");
  return {
    checkId: "policy_dry_run_stable",
    status: failed ? "fail" : "pass",
    reason: failed
      ? "Policy dry-run has blocking dryRunPassed drift"
      : "Policy dry-run stable across all scenarios",
    blocking: true,
    relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "dryRunPassed") : []
  };
};

const evaluateStrategyMatrixCoverage = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const count = input.strategyScenarioIds.length;
  const failed = count < EXPECTED_STRATEGY_SCENARIOS;
  return {
    checkId: "strategy_matrix_covered",
    status: failed ? "fail" : "pass",
    reason: failed
      ? `Strategy matrix has ${count} scenarios, expected >= ${EXPECTED_STRATEGY_SCENARIOS}`
      : `Strategy matrix covered: ${count} scenarios`,
    blocking: true,
    relatedArtifacts: [...input.strategyScenarioIds]
  };
};

const evaluateConfigVersionMatrixCoverage = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const count = input.configVersionScenarioIds.length;
  const failed = count < EXPECTED_CONFIG_VERSION_SCENARIOS;
  return {
    checkId: "config_version_matrix_covered",
    status: failed ? "fail" : "pass",
    reason: failed
      ? `Config version matrix has ${count} scenarios, expected >= ${EXPECTED_CONFIG_VERSION_SCENARIOS}`
      : `Config version matrix covered: ${count} scenarios`,
    blocking: true,
    relatedArtifacts: [...input.configVersionScenarioIds]
  };
};

const evaluateNoBlockingDrift = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
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
  return {
    checkId: "no_blocking_core_field_drift",
    status: "pass",
    reason: "No core field drift detected",
    blocking: true,
    relatedArtifacts: []
  };
};

const ACTIVATION_CHAIN_FIELDS = ["activationStatus", "currentActiveVersion", "rollbackAvailable"];

const evaluateActivationChain = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const matched = input.blockingIssues.filter(i =>
    ACTIVATION_CHAIN_FIELDS.some(f => i.includes(f))
  );
  const failed = matched.length > 0;
  return {
    checkId: "activation_chain_consistent",
    status: failed ? "fail" : "pass",
    reason: failed
      ? "Activation chain has blocking drift in status/version/rollback fields"
      : "Activation chain consistent across config version scenarios",
    blocking: true,
    relatedArtifacts: failed ? [...matched] : []
  };
};

const evaluateAuditDiffReadview = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  const blockingMatch = input.blockingIssues.filter(i => i.includes("auditAction"));
  if (blockingMatch.length > 0) {
    return {
      checkId: "audit_diff_readview_consistent",
      status: "fail",
      reason: "Audit/diff/readview has blocking auditAction drift",
      blocking: true,
      relatedArtifacts: [...blockingMatch]
    };
  }
  const noticeMatch = input.nonBlockingNotices.filter(i =>
    i.includes("diffSummary") || i.includes("policySelectionSummary")
  );
  if (noticeMatch.length > 0) {
    return {
      checkId: "audit_diff_readview_consistent",
      status: "warning",
      reason: "Audit/diff consistent, but notice-level summary drift present",
      blocking: true,
      relatedArtifacts: [...noticeMatch]
    };
  }
  return {
    checkId: "audit_diff_readview_consistent",
    status: "pass",
    reason: "Audit/diff/readview consistent across all scenarios",
    blocking: true,
    relatedArtifacts: []
  };
};

const evaluateNoFailureMismatch = (input: Phase3AcceptanceInputSnapshot): Phase3AcceptanceGateChecklistItem => {
  if (input.differenceMatrixOverallStatus === "failed") {
    return {
      checkId: "no_blocking_failure_semantic_mismatch",
      status: "fail",
      reason: "Difference matrix overall status is failed",
      blocking: true,
      relatedArtifacts: [...input.keyDriftFindings]
    };
  }
  if (input.differenceMatrixOverallStatus === "passed_with_notice") {
    return {
      checkId: "no_blocking_failure_semantic_mismatch",
      status: "warning",
      reason: "Difference matrix overall status is passed_with_notice",
      blocking: true,
      relatedArtifacts: [...input.keyDriftFindings]
    };
  }
  return {
    checkId: "no_blocking_failure_semantic_mismatch",
    status: "pass",
    reason: "Difference matrix overall status is passed",
    blocking: true,
    relatedArtifacts: []
  };
};

const CHECKLIST_EVALUATORS = [
  evaluateBundleResolution,
  evaluateDryRun,
  evaluateStrategyMatrixCoverage,
  evaluateConfigVersionMatrixCoverage,
  evaluateNoBlockingDrift,
  evaluateActivationChain,
  evaluateAuditDiffReadview,
  evaluateNoFailureMismatch
] as const;

// ─── gate runner ────────────────────────────────────────────────────────────

export const runPhase3AcceptanceGate = (
  gateId: string,
  input: Phase3AcceptanceInputSnapshot
): Phase3AcceptanceGateResult => {
  const checkResults = CHECKLIST_EVALUATORS.map(ev => ev(input));

  const passedChecks = checkResults.filter(c => c.status === "pass").length;
  const failedChecks = checkResults.filter(c => c.status === "fail").length;
  const warningChecks = checkResults.filter(c => c.status === "warning").length;

  const hasBlockingFailure = checkResults.some(c => c.blocking && c.status === "fail");
  const hasWarning = warningChecks > 0;

  const gateStatus: Phase3AcceptanceGateStatus =
    hasBlockingFailure ? "fail" : hasWarning ? "pass_with_notice" : "pass";

  const recommendedDecision: Phase3AcceptanceGateRecommendedDecision =
    gateStatus === "pass" ? "ready_for_phase3_close_preparation"
    : gateStatus === "pass_with_notice" ? "ready_with_notices"
    : "not_ready_for_phase3_close_preparation";

  const blockingIssues = checkResults
    .filter(c => c.blocking && c.status === "fail")
    .map(c => c.reason);
  const warningReasons = checkResults
    .filter(c => c.status === "warning")
    .map(c => c.reason);
  const nonBlockingNotices = [...new Set([...warningReasons, ...input.nonBlockingNotices])];

  const gateSummary = buildPhase3AcceptanceGateSummary({
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary: "", recommendedDecision
  });

  return {
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary, recommendedDecision
  };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase3AcceptanceGateSummary = (
  result: Phase3AcceptanceGateResult
): string => {
  const lines: string[] = [];

  if (result.gateStatus === "pass") {
    lines.push(`Phase 3 Acceptance Gate [${result.gateId}] PASSED: all ${result.passedChecks} checks passed`);
    lines.push("Phase 3 has reached close preparation readiness");
  } else if (result.gateStatus === "pass_with_notice") {
    lines.push(`Phase 3 Acceptance Gate [${result.gateId}] PASSED WITH NOTICE: ${result.passedChecks} passed, ${result.warningChecks} warning(s)`);
    lines.push("Phase 3 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 3 Acceptance Gate [${result.gateId}] FAILED: ${result.failedChecks} check(s) failed`);
    lines.push("Phase 3 is NOT ready for close preparation");
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
    lines.push("Next: review notices, then proceed to Phase 3 close preparation (Step 9)");
  } else {
    lines.push("Next: proceed to Phase 3 close preparation (Step 9)");
  }

  return lines.join("\n");
};
