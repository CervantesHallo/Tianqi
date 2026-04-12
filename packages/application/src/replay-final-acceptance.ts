import type { Phase5ReplayAcceptanceInputSnapshot, Phase5ReplayDifferenceMatrix } from "./replay-difference-matrix.js";
import { runPhase5ReplayDifferenceMatrix } from "./replay-difference-matrix.js";
import type { Phase5ReplayAcceptanceGateResult } from "./replay-acceptance-gate.js";
import { runPhase5ReplayAcceptanceGate } from "./replay-acceptance-gate.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase5ReplayFinalAcceptanceStatus =
  | "ready_to_close_preparation"
  | "ready_with_notices"
  | "not_ready_to_close_preparation";

export type Phase5ReplayPreCloseChecklistItem = {
  readonly itemId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
};

export type Phase5ReplayPreCloseChecklist = {
  readonly items: readonly Phase5ReplayPreCloseChecklistItem[];
  readonly passedItems: number;
  readonly failedItems: number;
  readonly warningItems: number;
};

export type Phase5ReplayFinalAcceptanceResult = {
  readonly finalRunId: string;
  readonly differenceMatrix: Phase5ReplayDifferenceMatrix;
  readonly acceptanceInput: Phase5ReplayAcceptanceInputSnapshot;
  readonly acceptanceGate: Phase5ReplayAcceptanceGateResult;
  readonly preCloseChecklist: Phase5ReplayPreCloseChecklist;
  readonly finalAcceptanceStatus: Phase5ReplayFinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase5ReplayFinalAcceptanceConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_TOTAL_SCENARIOS = 10;
const EXPECTED_GATE_CHECKS = 8;

// ─── pre-close checklist evaluators ─────────────────────────────────────────

const evaluateMatrixCompleted = (matrix: Phase5ReplayDifferenceMatrix): Phase5ReplayPreCloseChecklistItem => {
  const ok = matrix.totalScenarios >= EXPECTED_TOTAL_SCENARIOS;
  return { itemId: "difference_matrix_completed", status: ok ? "pass" : "fail", reason: ok ? `Matrix completed: ${matrix.totalScenarios} scenarios` : `Matrix incomplete: ${matrix.totalScenarios} < ${EXPECTED_TOTAL_SCENARIOS}`, blocking: true };
};

const evaluateInputBuilt = (input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayPreCloseChecklistItem => {
  const ok = input.baselineCoreFields.length > 0 && input.singleCaseScenarioIds.length > 0 && input.batchReplayScenarioIds.length > 0;
  return { itemId: "acceptance_input_built", status: ok ? "pass" : "fail", reason: ok ? "Acceptance input built with all sections" : "Acceptance input missing sections", blocking: true };
};

const evaluateGateEvaluated = (gate: Phase5ReplayAcceptanceGateResult): Phase5ReplayPreCloseChecklistItem => {
  const ok = gate.checkResults.length >= EXPECTED_GATE_CHECKS;
  return { itemId: "acceptance_gate_evaluated", status: ok ? "pass" : "fail", reason: ok ? `Gate evaluated: ${gate.checkResults.length} checks` : `Gate incomplete: ${gate.checkResults.length} < ${EXPECTED_GATE_CHECKS}`, blocking: true };
};

const evaluateScCoverage = (gate: Phase5ReplayAcceptanceGateResult): Phase5ReplayPreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "replay_matrix_covered");
  if (!check) return { itemId: "single_case_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "single_case_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBtCoverage = (gate: Phase5ReplayAcceptanceGateResult): Phase5ReplayPreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "replay_matrix_covered");
  if (!check) return { itemId: "batch_replay_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "batch_replay_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBlockingResolved = (gate: Phase5ReplayAcceptanceGateResult, input: Phase5ReplayAcceptanceInputSnapshot): Phase5ReplayPreCloseChecklistItem => {
  const gateCount = gate.blockingIssues.length;
  const inputCount = input.blockingIssues.length;
  if (gateCount > 0 || inputCount > 0) {
    return { itemId: "blocking_issues_resolved_or_acknowledged", status: "fail", reason: `Blocking issues present: ${gateCount} from gate, ${inputCount} from input`, blocking: true };
  }
  return { itemId: "blocking_issues_resolved_or_acknowledged", status: "pass", reason: "All blocking issues resolved", blocking: true };
};

// ─── pre-close checklist builder ────────────────────────────────────────────

export const buildPhase5ReplayPreCloseChecklist = (
  matrix: Phase5ReplayDifferenceMatrix,
  input: Phase5ReplayAcceptanceInputSnapshot,
  gate: Phase5ReplayAcceptanceGateResult
): Phase5ReplayPreCloseChecklist => {
  const items: Phase5ReplayPreCloseChecklistItem[] = [
    evaluateMatrixCompleted(matrix),
    evaluateInputBuilt(input),
    evaluateGateEvaluated(gate),
    evaluateScCoverage(gate),
    evaluateBtCoverage(gate),
    evaluateBlockingResolved(gate, input)
  ];
  return {
    items,
    passedItems: items.filter(i => i.status === "pass").length,
    failedItems: items.filter(i => i.status === "fail").length,
    warningItems: items.filter(i => i.status === "warning").length
  };
};

// ─── status determination ───────────────────────────────────────────────────

export const determinePhase5ReplayFinalAcceptanceStatus = (
  gate: Phase5ReplayAcceptanceGateResult,
  checklist: Phase5ReplayPreCloseChecklist
): Phase5ReplayFinalAcceptanceStatus => {
  const hasBlockingChecklistFail = checklist.items.some(i => i.blocking && i.status === "fail");
  if (gate.gateStatus === "fail" || hasBlockingChecklistFail) return "not_ready_to_close_preparation";
  if (gate.gateStatus === "pass_with_notice" || checklist.warningItems > 0) return "ready_with_notices";
  return "ready_to_close_preparation";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase5ReplayFinalAcceptance = (
  finalRunId: string,
  differenceMatrix: Phase5ReplayDifferenceMatrix,
  acceptanceInput: Phase5ReplayAcceptanceInputSnapshot,
  acceptanceGate: Phase5ReplayAcceptanceGateResult
): Phase5ReplayFinalAcceptanceResult => {
  const preCloseChecklist = buildPhase5ReplayPreCloseChecklist(differenceMatrix, acceptanceInput, acceptanceGate);
  const finalAcceptanceStatus = determinePhase5ReplayFinalAcceptanceStatus(acceptanceGate, preCloseChecklist);

  const checklistBlockingReasons = preCloseChecklist.items.filter(i => i.blocking && i.status === "fail").map(i => `[checklist] ${i.reason}`);
  const blockingIssues = [...new Set([...acceptanceGate.blockingIssues, ...checklistBlockingReasons])];

  const checklistWarningReasons = preCloseChecklist.items.filter(i => i.status === "warning").map(i => `[checklist] ${i.reason}`);
  const nonBlockingNotices = [...new Set([...acceptanceGate.nonBlockingNotices, ...checklistWarningReasons])];

  const recommendedNextActions: string[] = [];
  if (finalAcceptanceStatus === "ready_to_close_preparation") recommendedNextActions.push("Proceed to Phase 5 final close (Step 6)");
  else if (finalAcceptanceStatus === "ready_with_notices") { recommendedNextActions.push("Review notices before proceeding"); recommendedNextActions.push("Proceed to Phase 5 final close (Step 6) after review"); }
  else { recommendedNextActions.push("Resolve blocking issues"); recommendedNextActions.push("Re-run final acceptance after fixes"); }

  const partial: Phase5ReplayFinalAcceptanceResult = {
    finalRunId, differenceMatrix, acceptanceInput, acceptanceGate, preCloseChecklist,
    finalAcceptanceStatus, finalAcceptanceSummary: "", blockingIssues, nonBlockingNotices, recommendedNextActions
  };
  return { ...partial, finalAcceptanceSummary: buildPhase5ReplayFinalAcceptanceSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase5ReplayFinalAcceptance = (finalRunId: string): Phase5ReplayFinalAcceptanceResult => {
  const { matrix, acceptanceInput } = runPhase5ReplayDifferenceMatrix(`${finalRunId}-matrix`);
  const acceptanceGate = runPhase5ReplayAcceptanceGate(`${finalRunId}-gate`, acceptanceInput);
  return assemblePhase5ReplayFinalAcceptance(finalRunId, matrix, acceptanceInput, acceptanceGate);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase5ReplayFinalAcceptanceConsistency = (
  result: Phase5ReplayFinalAcceptanceResult
): Phase5ReplayFinalAcceptanceConsistencyResult => {
  const violations: string[] = [];

  if (result.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus !== "not_ready_to_close_preparation")
    violations.push("gate failed but finalAcceptanceStatus is not not_ready");

  const hasBlockingFail = result.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (result.acceptanceGate.gateStatus === "pass" && !hasBlockingFail && result.finalAcceptanceStatus === "not_ready_to_close_preparation")
    violations.push("gate passed, no checklist blocking fail, but finalAcceptanceStatus is not_ready");

  const allClean = result.preCloseChecklist.failedItems === 0 && result.preCloseChecklist.warningItems === 0 && result.acceptanceGate.gateStatus === "pass";
  if (allClean && result.finalAcceptanceStatus !== "ready_to_close_preparation")
    violations.push("all clean but finalAcceptanceStatus is not ready_to_close_preparation");

  if (result.blockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close_preparation")
    violations.push("blockingIssues non-empty but finalAcceptanceStatus is ready");

  if (result.blockingIssues.length === 0 && !hasBlockingFail && result.acceptanceGate.gateStatus !== "fail" && result.finalAcceptanceStatus === "not_ready_to_close_preparation")
    violations.push("no blocking source but finalAcceptanceStatus is not_ready");

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase5ReplayFinalAcceptanceSummary = (result: Phase5ReplayFinalAcceptanceResult): string => {
  const lines: string[] = [];

  if (result.finalAcceptanceStatus === "ready_to_close_preparation") {
    lines.push(`Phase 5 Replay Final Acceptance [${result.finalRunId}] READY: all gates and checks passed`);
    lines.push("Phase 5 has reached close preparation readiness");
  } else if (result.finalAcceptanceStatus === "ready_with_notices") {
    lines.push(`Phase 5 Replay Final Acceptance [${result.finalRunId}] READY WITH NOTICES`);
    lines.push("Phase 5 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 5 Replay Final Acceptance [${result.finalRunId}] NOT READY`);
    lines.push("Phase 5 is NOT ready for close preparation");
  }

  if (result.blockingIssues.length > 0) lines.push(`Blocking (${result.blockingIssues.length}): ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices (${result.nonBlockingNotices.length}): ${result.nonBlockingNotices.join("; ")}`);

  lines.push(`Gate: ${result.acceptanceGate.gateStatus} | Checklist: ${result.preCloseChecklist.passedItems}/${result.preCloseChecklist.items.length} passed`);

  if (result.finalAcceptanceStatus === "not_ready_to_close_preparation") lines.push("Action required: resolve blocking issues and re-run final acceptance");
  else if (result.finalAcceptanceStatus === "ready_with_notices") lines.push("Action: review notices, then proceed to Phase 5 final close (Step 6)");
  else lines.push("Action: proceed to Phase 5 final close (Step 6)");

  return lines.join("\n");
};
