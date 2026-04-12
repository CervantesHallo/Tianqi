import type { Phase6AcceptanceInputSnapshot } from "./phase6-difference-matrix.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase6GateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase6GateRecommendedDecision =
  | "ready_for_phase6_close_preparation"
  | "ready_with_notices"
  | "not_ready_for_phase6_close_preparation";

export type Phase6AcceptanceGateChecklistItem = {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase6AcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase6GateStatus;
  readonly checkResults: readonly Phase6AcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly gateSummary: string;
  readonly recommendedDecision: Phase6GateRecommendedDecision;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_OBS_SCENARIOS = 5;
const EXPECTED_DRILL_SCENARIOS = 5;

// ─── checklist evaluators ───────────────────────────────────────────────────

const hasBlockingIn = (issues: readonly string[], pattern: string): boolean =>
  issues.some(i => i.includes(pattern));

const matchingIssues = (issues: readonly string[], pattern: string): readonly string[] =>
  issues.filter(i => i.includes(pattern));

const evaluateTracePropagation = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "tracePropagationStatus");
  return { checkId: "trace_propagation_stable", status: failed ? "fail" : "pass", reason: failed ? "Trace propagation has blocking drift" : "Trace propagation stable", blocking: true, relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "tracePropagationStatus") : [] };
};

const evaluateMetricsRecording = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "metricRecordingStatus");
  return { checkId: "metrics_recording_stable", status: failed ? "fail" : "pass", reason: failed ? "Metrics recording has blocking drift" : "Metrics recording stable", blocking: true, relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "metricRecordingStatus") : [] };
};

const evaluateBenchmarkOutput = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "benchmarkStatus");
  return { checkId: "benchmark_output_stable", status: failed ? "fail" : "pass", reason: failed ? "Benchmark output has blocking drift" : "Benchmark output stable", blocking: true, relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "benchmarkStatus") : [] };
};

const evaluateDrillSemantics = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "drillStatus") || hasBlockingIn(input.blockingIssues, "failedUnexpectedlyCount");
  return { checkId: "fault_drill_semantics_stable", status: failed ? "fail" : "pass", reason: failed ? "Fault drill semantics has blocking drift" : "Fault drill semantics stable", blocking: true, relatedArtifacts: failed ? [...matchingIssues(input.blockingIssues, "drillStatus"), ...matchingIssues(input.blockingIssues, "failedUnexpectedlyCount")] : [] };
};

const evaluateDrillConsistency = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const failed = hasBlockingIn(input.blockingIssues, "overallStatus");
  return { checkId: "fault_drill_consistency_stable", status: failed ? "fail" : "pass", reason: failed ? "Fault drill consistency has blocking drift" : "Fault drill consistency stable", blocking: true, relatedArtifacts: failed ? matchingIssues(input.blockingIssues, "overallStatus") : [] };
};

const evaluateMatrixCoverage = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  const obsOk = input.observabilityScenarioIds.length >= EXPECTED_OBS_SCENARIOS;
  const drillOk = input.faultDrillScenarioIds.length >= EXPECTED_DRILL_SCENARIOS;
  const failed = !obsOk || !drillOk;
  return {
    checkId: "phase6_matrix_covered", status: failed ? "fail" : "pass",
    reason: failed ? `Matrix coverage insufficient: OBS=${input.observabilityScenarioIds.length}, DRILL=${input.faultDrillScenarioIds.length}` : `Matrix covered: OBS=${input.observabilityScenarioIds.length}, DRILL=${input.faultDrillScenarioIds.length}`,
    blocking: true, relatedArtifacts: [...input.observabilityScenarioIds, ...input.faultDrillScenarioIds]
  };
};

const evaluateNoBlockingDrift = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  if (input.blockingIssues.length > 0) return { checkId: "no_blocking_core_field_drift", status: "fail", reason: `${input.blockingIssues.length} blocking drift(s) detected`, blocking: true, relatedArtifacts: [...input.blockingIssues] };
  if (input.nonBlockingNotices.length > 0) return { checkId: "no_blocking_core_field_drift", status: "warning", reason: `No blocking drift, but ${input.nonBlockingNotices.length} notice(s)`, blocking: true, relatedArtifacts: [...input.nonBlockingNotices] };
  return { checkId: "no_blocking_core_field_drift", status: "pass", reason: "No core field drift", blocking: true, relatedArtifacts: [] };
};

const evaluateCrossConsistency = (input: Phase6AcceptanceInputSnapshot): Phase6AcceptanceGateChecklistItem => {
  if (input.differenceMatrixOverallStatus === "failed") return { checkId: "observability_and_drill_consistency_passed", status: "fail", reason: "Difference matrix overall status is failed", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  if (input.differenceMatrixOverallStatus === "passed_with_notice") return { checkId: "observability_and_drill_consistency_passed", status: "warning", reason: "Difference matrix passed_with_notice", blocking: true, relatedArtifacts: [...input.keyDriftFindings] };
  return { checkId: "observability_and_drill_consistency_passed", status: "pass", reason: "Observability/drill consistency passed", blocking: true, relatedArtifacts: [] };
};

const CHECKLIST_EVALUATORS = [
  evaluateTracePropagation, evaluateMetricsRecording, evaluateBenchmarkOutput,
  evaluateDrillSemantics, evaluateDrillConsistency, evaluateMatrixCoverage,
  evaluateNoBlockingDrift, evaluateCrossConsistency
] as const;

// ─── gate runner ────────────────────────────────────────────────────────────

export const runPhase6AcceptanceGate = (
  gateId: string,
  input: Phase6AcceptanceInputSnapshot
): Phase6AcceptanceGateResult => {
  const checkResults = CHECKLIST_EVALUATORS.map(ev => ev(input));
  const passedChecks = checkResults.filter(c => c.status === "pass").length;
  const failedChecks = checkResults.filter(c => c.status === "fail").length;
  const warningChecks = checkResults.filter(c => c.status === "warning").length;

  const hasBlockingFailure = checkResults.some(c => c.blocking && c.status === "fail");
  const hasWarning = warningChecks > 0;

  const gateStatus: Phase6GateStatus = hasBlockingFailure ? "fail" : hasWarning ? "pass_with_notice" : "pass";
  const recommendedDecision: Phase6GateRecommendedDecision =
    gateStatus === "pass" ? "ready_for_phase6_close_preparation"
    : gateStatus === "pass_with_notice" ? "ready_with_notices"
    : "not_ready_for_phase6_close_preparation";

  const blockingIssues = checkResults.filter(c => c.blocking && c.status === "fail").map(c => c.reason);
  const warningReasons = checkResults.filter(c => c.status === "warning").map(c => c.reason);
  const nonBlockingNotices = [...new Set([...warningReasons, ...input.nonBlockingNotices])];

  const gateSummary = buildPhase6AcceptanceGateSummary({
    gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks,
    blockingIssues, nonBlockingNotices, gateSummary: "", recommendedDecision
  });

  return { gateId, gateStatus, checkResults, passedChecks, failedChecks, warningChecks, blockingIssues, nonBlockingNotices, gateSummary, recommendedDecision };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase6AcceptanceGateSummary = (result: Phase6AcceptanceGateResult): string => {
  const lines: string[] = [];
  if (result.gateStatus === "pass") {
    lines.push(`Phase 6 Gate [${result.gateId}] PASSED: all ${result.passedChecks} checks passed`);
    lines.push("Phase 6 has reached close preparation readiness");
  } else if (result.gateStatus === "pass_with_notice") {
    lines.push(`Phase 6 Gate [${result.gateId}] PASSED WITH NOTICE: ${result.passedChecks} passed, ${result.warningChecks} warning(s)`);
    lines.push("Phase 6 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 6 Gate [${result.gateId}] FAILED: ${result.failedChecks} check(s) failed`);
    lines.push("Phase 6 is NOT ready for close preparation");
  }
  if (result.blockingIssues.length > 0) lines.push(`Blocking: ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices: ${result.nonBlockingNotices.join("; ")}`);
  if (result.gateStatus === "fail") lines.push("Next: resolve blocking issues and re-run gate");
  else if (result.gateStatus === "pass_with_notice") lines.push("Next: review notices, then proceed to Phase 6 close preparation (Step 5)");
  else lines.push("Next: proceed to Phase 6 close preparation (Step 5)");
  return lines.join("\n");
};
