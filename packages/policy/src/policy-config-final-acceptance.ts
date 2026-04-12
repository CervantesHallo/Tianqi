import type { Phase3AcceptanceInputSnapshot, Phase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import { runPhase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import type { Phase3AcceptanceGateResult } from "./policy-config-acceptance-gate.js";
import { runPhase3AcceptanceGate } from "./policy-config-acceptance-gate.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase3FinalAcceptanceStatus =
  | "ready_to_close_preparation"
  | "ready_with_notices"
  | "not_ready_to_close_preparation";

export type Phase3PreCloseChecklistItem = {
  readonly itemId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
};

export type Phase3PreCloseChecklist = {
  readonly items: readonly Phase3PreCloseChecklistItem[];
  readonly passedItems: number;
  readonly failedItems: number;
  readonly warningItems: number;
};

export type Phase3FinalAcceptanceResult = {
  readonly finalRunId: string;
  readonly differenceMatrix: Phase3PolicyConfigDifferenceMatrix;
  readonly acceptanceInput: Phase3AcceptanceInputSnapshot;
  readonly acceptanceGate: Phase3AcceptanceGateResult;
  readonly preCloseChecklist: Phase3PreCloseChecklist;
  readonly finalAcceptanceStatus: Phase3FinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase3FinalAcceptanceConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_TOTAL_SCENARIOS = 11;
const EXPECTED_GATE_CHECKS = 8;

// ─── pre-close checklist evaluators ─────────────────────────────────────────

const evaluateMatrixCompleted = (
  matrix: Phase3PolicyConfigDifferenceMatrix
): Phase3PreCloseChecklistItem => {
  const ok = matrix.totalScenarios >= EXPECTED_TOTAL_SCENARIOS;
  return {
    itemId: "difference_matrix_completed",
    status: ok ? "pass" : "fail",
    reason: ok
      ? `Difference matrix completed: ${matrix.totalScenarios} scenarios`
      : `Difference matrix incomplete: ${matrix.totalScenarios} scenarios, expected >= ${EXPECTED_TOTAL_SCENARIOS}`,
    blocking: true
  };
};

const evaluateInputBuilt = (
  input: Phase3AcceptanceInputSnapshot
): Phase3PreCloseChecklistItem => {
  const ok = input.baselineCoreFields.length > 0
    && input.strategyScenarioIds.length > 0
    && input.configVersionScenarioIds.length > 0;
  return {
    itemId: "acceptance_input_built",
    status: ok ? "pass" : "fail",
    reason: ok
      ? "Acceptance input snapshot built with all required sections"
      : "Acceptance input snapshot missing required sections",
    blocking: true
  };
};

const evaluateGateEvaluated = (
  gate: Phase3AcceptanceGateResult
): Phase3PreCloseChecklistItem => {
  const ok = gate.checkResults.length >= EXPECTED_GATE_CHECKS;
  return {
    itemId: "acceptance_gate_evaluated",
    status: ok ? "pass" : "fail",
    reason: ok
      ? `Acceptance gate evaluated: ${gate.checkResults.length} checks`
      : `Acceptance gate incomplete: ${gate.checkResults.length} checks, expected >= ${EXPECTED_GATE_CHECKS}`,
    blocking: true
  };
};

const evaluateStratCoverage = (
  gate: Phase3AcceptanceGateResult
): Phase3PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "strategy_matrix_covered");
  if (!check) {
    return { itemId: "strategy_matrix_coverage_confirmed", status: "fail", reason: "Strategy matrix coverage check not found in gate", blocking: true };
  }
  return { itemId: "strategy_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateCvCoverage = (
  gate: Phase3AcceptanceGateResult
): Phase3PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "config_version_matrix_covered");
  if (!check) {
    return { itemId: "config_version_matrix_coverage_confirmed", status: "fail", reason: "Config version coverage check not found in gate", blocking: true };
  }
  return { itemId: "config_version_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBlockingResolved = (
  gate: Phase3AcceptanceGateResult,
  input: Phase3AcceptanceInputSnapshot
): Phase3PreCloseChecklistItem => {
  const gateCount = gate.blockingIssues.length;
  const inputCount = input.blockingIssues.length;
  if (gateCount > 0 || inputCount > 0) {
    return {
      itemId: "blocking_issues_resolved_or_acknowledged",
      status: "fail",
      reason: `Blocking issues present: ${gateCount} from gate, ${inputCount} from input`,
      blocking: true
    };
  }
  return { itemId: "blocking_issues_resolved_or_acknowledged", status: "pass", reason: "All blocking issues resolved", blocking: true };
};

// ─── pre-close checklist builder ────────────────────────────────────────────

export const buildPhase3PreCloseChecklist = (
  matrix: Phase3PolicyConfigDifferenceMatrix,
  input: Phase3AcceptanceInputSnapshot,
  gate: Phase3AcceptanceGateResult
): Phase3PreCloseChecklist => {
  const items: Phase3PreCloseChecklistItem[] = [
    evaluateMatrixCompleted(matrix),
    evaluateInputBuilt(input),
    evaluateGateEvaluated(gate),
    evaluateStratCoverage(gate),
    evaluateCvCoverage(gate),
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

export const determineFinalAcceptanceStatus = (
  gate: Phase3AcceptanceGateResult,
  checklist: Phase3PreCloseChecklist
): Phase3FinalAcceptanceStatus => {
  const hasBlockingChecklistFail = checklist.items.some(i => i.blocking && i.status === "fail");

  if (gate.gateStatus === "fail" || hasBlockingChecklistFail) {
    return "not_ready_to_close_preparation";
  }
  if (gate.gateStatus === "pass_with_notice" || checklist.warningItems > 0) {
    return "ready_with_notices";
  }
  return "ready_to_close_preparation";
};

// ─── assembly (testable with crafted components) ────────────────────────────

export const assemblePhase3FinalAcceptance = (
  finalRunId: string,
  differenceMatrix: Phase3PolicyConfigDifferenceMatrix,
  acceptanceInput: Phase3AcceptanceInputSnapshot,
  acceptanceGate: Phase3AcceptanceGateResult
): Phase3FinalAcceptanceResult => {
  const preCloseChecklist = buildPhase3PreCloseChecklist(differenceMatrix, acceptanceInput, acceptanceGate);
  const finalAcceptanceStatus = determineFinalAcceptanceStatus(acceptanceGate, preCloseChecklist);

  const checklistBlockingReasons = preCloseChecklist.items
    .filter(i => i.blocking && i.status === "fail")
    .map(i => `[checklist] ${i.reason}`);
  const blockingIssues = [...new Set([...acceptanceGate.blockingIssues, ...checklistBlockingReasons])];

  const checklistWarningReasons = preCloseChecklist.items
    .filter(i => i.status === "warning")
    .map(i => `[checklist] ${i.reason}`);
  const nonBlockingNotices = [...new Set([...acceptanceGate.nonBlockingNotices, ...checklistWarningReasons])];

  const recommendedNextActions: string[] = [];
  if (finalAcceptanceStatus === "ready_to_close_preparation") {
    recommendedNextActions.push("Proceed to Phase 3 final close (Step 10)");
  } else if (finalAcceptanceStatus === "ready_with_notices") {
    recommendedNextActions.push("Review notices before proceeding");
    recommendedNextActions.push("Proceed to Phase 3 final close (Step 10) after review");
  } else {
    recommendedNextActions.push("Resolve blocking issues");
    recommendedNextActions.push("Re-run final acceptance after fixes");
  }

  const partial: Phase3FinalAcceptanceResult = {
    finalRunId, differenceMatrix, acceptanceInput, acceptanceGate, preCloseChecklist,
    finalAcceptanceStatus, finalAcceptanceSummary: "", blockingIssues, nonBlockingNotices, recommendedNextActions
  };
  return { ...partial, finalAcceptanceSummary: buildPhase3FinalAcceptanceSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase3FinalAcceptance = (
  finalRunId: string
): Phase3FinalAcceptanceResult => {
  const { matrix, acceptanceInput } = runPhase3PolicyConfigDifferenceMatrix(`${finalRunId}-matrix`);
  const acceptanceGate = runPhase3AcceptanceGate(`${finalRunId}-gate`, acceptanceInput);
  return assemblePhase3FinalAcceptance(finalRunId, matrix, acceptanceInput, acceptanceGate);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase3FinalAcceptanceConsistency = (
  result: Phase3FinalAcceptanceResult
): Phase3FinalAcceptanceConsistencyResult => {
  const violations: string[] = [];

  if (result.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus !== "not_ready_to_close_preparation") {
    violations.push("gate failed but finalAcceptanceStatus is not not_ready");
  }

  const hasBlockingFail = result.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (result.acceptanceGate.gateStatus === "pass" && !hasBlockingFail && result.finalAcceptanceStatus === "not_ready_to_close_preparation") {
    violations.push("gate passed, no checklist blocking fail, but finalAcceptanceStatus is not_ready");
  }

  const allClean = result.preCloseChecklist.failedItems === 0
    && result.preCloseChecklist.warningItems === 0
    && result.acceptanceGate.gateStatus === "pass";
  if (allClean && result.finalAcceptanceStatus !== "ready_to_close_preparation") {
    violations.push("all checks pass, gate pass, but finalAcceptanceStatus is not ready_to_close_preparation");
  }

  if (result.blockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close_preparation") {
    violations.push("blockingIssues non-empty but finalAcceptanceStatus is ready_to_close_preparation");
  }

  if (result.blockingIssues.length === 0 && !hasBlockingFail
      && result.acceptanceGate.gateStatus !== "fail"
      && result.finalAcceptanceStatus === "not_ready_to_close_preparation") {
    violations.push("no blocking source but finalAcceptanceStatus is not_ready");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase3FinalAcceptanceSummary = (
  result: Phase3FinalAcceptanceResult
): string => {
  const lines: string[] = [];

  if (result.finalAcceptanceStatus === "ready_to_close_preparation") {
    lines.push(`Phase 3 Final Acceptance [${result.finalRunId}] READY: all gates and checks passed`);
    lines.push("Phase 3 has reached close preparation readiness");
  } else if (result.finalAcceptanceStatus === "ready_with_notices") {
    lines.push(`Phase 3 Final Acceptance [${result.finalRunId}] READY WITH NOTICES`);
    lines.push("Phase 3 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 3 Final Acceptance [${result.finalRunId}] NOT READY`);
    lines.push("Phase 3 is NOT ready for close preparation");
  }

  if (result.blockingIssues.length > 0) {
    lines.push(`Blocking (${result.blockingIssues.length}): ${result.blockingIssues.join("; ")}`);
  }
  if (result.nonBlockingNotices.length > 0) {
    lines.push(`Notices (${result.nonBlockingNotices.length}): ${result.nonBlockingNotices.join("; ")}`);
  }

  lines.push(`Gate: ${result.acceptanceGate.gateStatus} | Checklist: ${result.preCloseChecklist.passedItems}/${result.preCloseChecklist.items.length} passed`);

  if (result.finalAcceptanceStatus === "not_ready_to_close_preparation") {
    lines.push("Action required: resolve blocking issues and re-run final acceptance");
  } else if (result.finalAcceptanceStatus === "ready_with_notices") {
    lines.push("Action: review notices, then proceed to Phase 3 final close (Step 10)");
  } else {
    lines.push("Action: proceed to Phase 3 final close (Step 10)");
  }

  return lines.join("\n");
};
