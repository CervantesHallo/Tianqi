import type { Phase7AcceptanceInputSnapshot } from "./phase7-difference-matrix.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase7GateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase7GateRecommendedDecision =
  | "ready_for_phase7_close_preparation"
  | "ready_with_notices"
  | "not_ready_for_phase7_close_preparation";

export type Phase7AcceptanceGateChecklistItem = {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase7AcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase7GateStatus;
  readonly checkResults: readonly Phase7AcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly gateSummary: string;
  readonly recommendedDecision: Phase7GateRecommendedDecision;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_PREFLIGHT_SCENARIOS = 5;
const EXPECTED_ROLLBACK_RUNBOOK_SCENARIOS = 5;

// ─── checklist evaluators ───────────────────────────────────────────────────

const hasIn = (issues: readonly string[], pattern: string): boolean => issues.some(i => i.includes(pattern));
const matching = (issues: readonly string[], pattern: string): readonly string[] => issues.filter(i => i.includes(pattern));

const evaluateConfigPreflight = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const failed = hasIn(input.blockingIssues, "preflightStatus");
  return { checkId: "config_preflight_stable", status: failed ? "fail" : "pass", reason: failed ? "Config preflight has blocking drift" : "Config preflight stable", blocking: true, relatedArtifacts: failed ? matching(input.blockingIssues, "preflightStatus") : [] };
};

const evaluateContractFreeze = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const failed = hasIn(input.blockingIssues, "contractBaselineStatus");
  return { checkId: "contract_freeze_stable", status: failed ? "fail" : "pass", reason: failed ? "Contract freeze has blocking drift" : "Contract freeze stable", blocking: true, relatedArtifacts: failed ? matching(input.blockingIssues, "contractBaselineStatus") : [] };
};

const evaluateRollbackReady = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const failed = hasIn(input.blockingIssues, "rollbackPlanStatus");
  return { checkId: "rollback_plan_ready", status: failed ? "fail" : "pass", reason: failed ? "Rollback plan has blocking drift" : "Rollback plan ready", blocking: true, relatedArtifacts: failed ? matching(input.blockingIssues, "rollbackPlanStatus") : [] };
};

const evaluateRunbookReady = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const failed = hasIn(input.blockingIssues, "runbookStatus");
  return { checkId: "runbook_ready", status: failed ? "fail" : "pass", reason: failed ? "Runbook has blocking drift" : "Runbook ready", blocking: true, relatedArtifacts: failed ? matching(input.blockingIssues, "runbookStatus") : [] };
};

const evaluateGuardConsistency = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const failed = hasIn(input.blockingIssues, "summaryStatus");
  return { checkId: "release_guard_consistency_stable", status: failed ? "fail" : "pass", reason: failed ? "Release guard consistency has blocking drift" : "Release guard consistency stable", blocking: true, relatedArtifacts: failed ? matching(input.blockingIssues, "summaryStatus") : [] };
};

const evaluateMatrixCoverage = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  const pfOk = input.preflightScenarioIds.length >= EXPECTED_PREFLIGHT_SCENARIOS;
  const rrOk = input.rollbackRunbookScenarioIds.length >= EXPECTED_ROLLBACK_RUNBOOK_SCENARIOS;
  const failed = !pfOk || !rrOk;
  return { checkId: "phase7_matrix_covered", status: failed ? "fail" : "pass", reason: failed ? `Matrix coverage insufficient: PF=${input.preflightScenarioIds.length}, RR=${input.rollbackRunbookScenarioIds.length}` : `Matrix covered: PF=${input.preflightScenarioIds.length}, RR=${input.rollbackRunbookScenarioIds.length}`, blocking: true, relatedArtifacts: [...input.preflightScenarioIds, ...input.rollbackRunbookScenarioIds] };
};

const evaluateNoBlockingDrift = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  if (input.blockingIssues.length > 0) return { checkId: "no_blocking_core_field_drift", status: "fail", reason: `${input.blockingIssues.length} blocking drift(s) detected`, blocking: true, relatedArtifacts: [...input.blockingIssues] };
  if (input.nonBlockingNotices.length > 0) return { checkId: "no_blocking_core_field_drift", status: "warning", reason: `No blocking drift, but ${input.nonBlockingNotices.length} notice(s)`, blocking: true, relatedArtifacts: [...input.nonBlockingNotices] };
  return { checkId: "no_blocking_core_field_drift", status: "pass", reason: "No core field drift", blocking: true, relatedArtifacts: [] };
};

const evaluateCrossConsistency = (input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateChecklistItem => {
  if (input.differenceMatrixOverallStatus === "failed") return { checkId: "preflight_and_rollback_runbook_consistency_passed", status: "fail", reason: "Difference matrix overall status is failed", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  if (input.differenceMatrixOverallStatus === "passed_with_notice") return { checkId: "preflight_and_rollback_runbook_consistency_passed", status: "warning", reason: "Difference matrix passed_with_notice", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  return { checkId: "preflight_and_rollback_runbook_consistency_passed", status: "pass", reason: "Preflight/rollback/runbook consistency passed", blocking: true, relatedArtifacts: [] };
};

const CHECKLIST_EVALUATORS = [
  evaluateConfigPreflight, evaluateContractFreeze, evaluateRollbackReady, evaluateRunbookReady,
  evaluateGuardConsistency, evaluateMatrixCoverage, evaluateNoBlockingDrift, evaluateCrossConsistency
] as const;

// ─── gate runner ────────────────────────────────────────────────────────────

export const runPhase7AcceptanceGate = (gateId: string, input: Phase7AcceptanceInputSnapshot): Phase7AcceptanceGateResult => {
  const checkResults = CHECKLIST_EVALUATORS.map(ev => ev(input));
  const passedChecks = checkResults.filter(c => c.status === "pass").length;
  const failedChecks = checkResults.filter(c => c.status === "fail").length;
  const warningChecks = checkResults.filter(c => c.status === "warning").length;

  const hasBlockingFailure = checkResults.some(c => c.blocking && c.status === "fail");
  const gateStatus: Phase7GateStatus = hasBlockingFailure ? "fail" : warningChecks > 0 ? "pass_with_notice" : "pass";
  const recommendedDecision: Phase7GateRecommendedDecision = gateStatus === "pass" ? "ready_for_phase7_close_preparation" : gateStatus === "pass_with_notice" ? "ready_with_notices" : "not_ready_for_phase7_close_preparation";

  const blockingIssues = checkResults.filter(c => c.blocking && c.status === "fail").map(c => c.reason);
  const warningReasons = checkResults.filter(c => c.status === "warning").map(c => c.reason);
  const nonBlockingNotices = [...new Set([...warningReasons, ...input.nonBlockingNotices])];

  const gateSummary = buildPhase7AcceptanceGateSummary({ gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks, blockingIssues, nonBlockingNotices, gateSummary: "", recommendedDecision });
  return { gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks, blockingIssues, nonBlockingNotices, gateSummary, recommendedDecision };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase7AcceptanceGateSummary = (result: Phase7AcceptanceGateResult): string => {
  const lines: string[] = [];
  if (result.gateStatus === "pass") { lines.push(`Phase 7 Gate [${result.gateId}] PASSED: all ${result.passedChecks} checks passed`); lines.push("Phase 7 has reached close preparation readiness"); }
  else if (result.gateStatus === "pass_with_notice") { lines.push(`Phase 7 Gate [${result.gateId}] PASSED WITH NOTICE: ${result.passedChecks} passed, ${result.warningChecks} warning(s)`); lines.push("Phase 7 close preparation can proceed after reviewing notices"); }
  else { lines.push(`Phase 7 Gate [${result.gateId}] FAILED: ${result.failedChecks} check(s) failed`); lines.push("Phase 7 is NOT ready for close preparation"); }
  if (result.blockingIssues.length > 0) lines.push(`Blocking: ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices: ${result.nonBlockingNotices.join("; ")}`);
  if (result.gateStatus === "fail") lines.push("Next: resolve blocking issues and re-run gate");
  else if (result.gateStatus === "pass_with_notice") lines.push("Next: review notices, then proceed to Phase 7 close preparation (Step 5)");
  else lines.push("Next: proceed to Phase 7 close preparation (Step 5)");
  return lines.join("\n");
};
