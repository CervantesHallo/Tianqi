import type { Phase4AcceptanceInputSnapshot, Phase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import { runPhase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import type { Phase4AcceptanceGateResult } from "./orchestration-acceptance-gate.js";
import { runPhase4AcceptanceGate } from "./orchestration-acceptance-gate.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase4FinalAcceptanceStatus =
  | "ready_to_close_preparation"
  | "ready_with_notices"
  | "not_ready_to_close_preparation";

export type Phase4PreCloseChecklistItem = {
  readonly itemId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
};

export type Phase4PreCloseChecklist = {
  readonly items: readonly Phase4PreCloseChecklistItem[];
  readonly passedItems: number;
  readonly failedItems: number;
  readonly warningItems: number;
};

export type Phase4FinalAcceptanceResult = {
  readonly finalRunId: string;
  readonly differenceMatrix: Phase4OrchestrationDifferenceMatrix;
  readonly acceptanceInput: Phase4AcceptanceInputSnapshot;
  readonly acceptanceGate: Phase4AcceptanceGateResult;
  readonly preCloseChecklist: Phase4PreCloseChecklist;
  readonly finalAcceptanceStatus: Phase4FinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase4FinalAcceptanceConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_TOTAL_SCENARIOS = 10;
const EXPECTED_GATE_CHECKS = 8;

// ─── pre-close checklist evaluators ─────────────────────────────────────────

const evaluateMatrixCompleted = (matrix: Phase4OrchestrationDifferenceMatrix): Phase4PreCloseChecklistItem => {
  const ok = matrix.totalScenarios >= EXPECTED_TOTAL_SCENARIOS;
  return { itemId: "difference_matrix_completed", status: ok ? "pass" : "fail", reason: ok ? `Matrix completed: ${matrix.totalScenarios} scenarios` : `Matrix incomplete: ${matrix.totalScenarios} < ${EXPECTED_TOTAL_SCENARIOS}`, blocking: true };
};

const evaluateInputBuilt = (input: Phase4AcceptanceInputSnapshot): Phase4PreCloseChecklistItem => {
  const ok = input.baselineCoreFields.length > 0 && input.riskCaseScenarioIds.length > 0 && input.liquidationCaseScenarioIds.length > 0;
  return { itemId: "acceptance_input_built", status: ok ? "pass" : "fail", reason: ok ? "Acceptance input built with all sections" : "Acceptance input missing sections", blocking: true };
};

const evaluateGateEvaluated = (gate: Phase4AcceptanceGateResult): Phase4PreCloseChecklistItem => {
  const ok = gate.checkResults.length >= EXPECTED_GATE_CHECKS;
  return { itemId: "acceptance_gate_evaluated", status: ok ? "pass" : "fail", reason: ok ? `Gate evaluated: ${gate.checkResults.length} checks` : `Gate incomplete: ${gate.checkResults.length} < ${EXPECTED_GATE_CHECKS}`, blocking: true };
};

const evaluateRcCoverage = (gate: Phase4AcceptanceGateResult): Phase4PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "orchestration_matrix_covered");
  if (!check) return { itemId: "risk_case_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "risk_case_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateLcCoverage = (gate: Phase4AcceptanceGateResult): Phase4PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "orchestration_matrix_covered");
  if (!check) return { itemId: "liquidation_case_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "liquidation_case_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBlockingResolved = (gate: Phase4AcceptanceGateResult, input: Phase4AcceptanceInputSnapshot): Phase4PreCloseChecklistItem => {
  const gateCount = gate.blockingIssues.length;
  const inputCount = input.blockingIssues.length;
  if (gateCount > 0 || inputCount > 0) {
    return { itemId: "blocking_issues_resolved_or_acknowledged", status: "fail", reason: `Blocking issues present: ${gateCount} from gate, ${inputCount} from input`, blocking: true };
  }
  return { itemId: "blocking_issues_resolved_or_acknowledged", status: "pass", reason: "All blocking issues resolved", blocking: true };
};

// ─── pre-close checklist builder ────────────────────────────────────────────

export const buildPhase4PreCloseChecklist = (
  matrix: Phase4OrchestrationDifferenceMatrix,
  input: Phase4AcceptanceInputSnapshot,
  gate: Phase4AcceptanceGateResult
): Phase4PreCloseChecklist => {
  const items: Phase4PreCloseChecklistItem[] = [
    evaluateMatrixCompleted(matrix),
    evaluateInputBuilt(input),
    evaluateGateEvaluated(gate),
    evaluateRcCoverage(gate),
    evaluateLcCoverage(gate),
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

export const determinePhase4FinalAcceptanceStatus = (
  gate: Phase4AcceptanceGateResult,
  checklist: Phase4PreCloseChecklist
): Phase4FinalAcceptanceStatus => {
  const hasBlockingChecklistFail = checklist.items.some(i => i.blocking && i.status === "fail");
  if (gate.gateStatus === "fail" || hasBlockingChecklistFail) return "not_ready_to_close_preparation";
  if (gate.gateStatus === "pass_with_notice" || checklist.warningItems > 0) return "ready_with_notices";
  return "ready_to_close_preparation";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase4FinalAcceptance = (
  finalRunId: string,
  differenceMatrix: Phase4OrchestrationDifferenceMatrix,
  acceptanceInput: Phase4AcceptanceInputSnapshot,
  acceptanceGate: Phase4AcceptanceGateResult
): Phase4FinalAcceptanceResult => {
  const preCloseChecklist = buildPhase4PreCloseChecklist(differenceMatrix, acceptanceInput, acceptanceGate);
  const finalAcceptanceStatus = determinePhase4FinalAcceptanceStatus(acceptanceGate, preCloseChecklist);

  const checklistBlockingReasons = preCloseChecklist.items.filter(i => i.blocking && i.status === "fail").map(i => `[checklist] ${i.reason}`);
  const blockingIssues = [...new Set([...acceptanceGate.blockingIssues, ...checklistBlockingReasons])];

  const checklistWarningReasons = preCloseChecklist.items.filter(i => i.status === "warning").map(i => `[checklist] ${i.reason}`);
  const nonBlockingNotices = [...new Set([...acceptanceGate.nonBlockingNotices, ...checklistWarningReasons])];

  const recommendedNextActions: string[] = [];
  if (finalAcceptanceStatus === "ready_to_close_preparation") {
    recommendedNextActions.push("Proceed to Phase 4 final close (Step 7)");
  } else if (finalAcceptanceStatus === "ready_with_notices") {
    recommendedNextActions.push("Review notices before proceeding");
    recommendedNextActions.push("Proceed to Phase 4 final close (Step 7) after review");
  } else {
    recommendedNextActions.push("Resolve blocking issues");
    recommendedNextActions.push("Re-run final acceptance after fixes");
  }

  const partial: Phase4FinalAcceptanceResult = {
    finalRunId, differenceMatrix, acceptanceInput, acceptanceGate, preCloseChecklist,
    finalAcceptanceStatus, finalAcceptanceSummary: "", blockingIssues, nonBlockingNotices, recommendedNextActions
  };
  return { ...partial, finalAcceptanceSummary: buildPhase4FinalAcceptanceSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase4FinalAcceptance = (finalRunId: string): Phase4FinalAcceptanceResult => {
  const { matrix, acceptanceInput } = runPhase4OrchestrationDifferenceMatrix(`${finalRunId}-matrix`);
  const acceptanceGate = runPhase4AcceptanceGate(`${finalRunId}-gate`, acceptanceInput);
  return assemblePhase4FinalAcceptance(finalRunId, matrix, acceptanceInput, acceptanceGate);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase4FinalAcceptanceConsistency = (
  result: Phase4FinalAcceptanceResult
): Phase4FinalAcceptanceConsistencyResult => {
  const violations: string[] = [];

  if (result.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus !== "not_ready_to_close_preparation") {
    violations.push("gate failed but finalAcceptanceStatus is not not_ready");
  }

  const hasBlockingFail = result.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (result.acceptanceGate.gateStatus === "pass" && !hasBlockingFail && result.finalAcceptanceStatus === "not_ready_to_close_preparation") {
    violations.push("gate passed, no checklist blocking fail, but finalAcceptanceStatus is not_ready");
  }

  const allClean = result.preCloseChecklist.failedItems === 0 && result.preCloseChecklist.warningItems === 0 && result.acceptanceGate.gateStatus === "pass";
  if (allClean && result.finalAcceptanceStatus !== "ready_to_close_preparation") {
    violations.push("all clean but finalAcceptanceStatus is not ready_to_close_preparation");
  }

  if (result.blockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close_preparation") {
    violations.push("blockingIssues non-empty but finalAcceptanceStatus is ready");
  }

  if (result.blockingIssues.length === 0 && !hasBlockingFail && result.acceptanceGate.gateStatus !== "fail" && result.finalAcceptanceStatus === "not_ready_to_close_preparation") {
    violations.push("no blocking source but finalAcceptanceStatus is not_ready");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase4FinalAcceptanceSummary = (result: Phase4FinalAcceptanceResult): string => {
  const lines: string[] = [];

  if (result.finalAcceptanceStatus === "ready_to_close_preparation") {
    lines.push(`Phase 4 Final Acceptance [${result.finalRunId}] READY: all gates and checks passed`);
    lines.push("Phase 4 has reached close preparation readiness");
  } else if (result.finalAcceptanceStatus === "ready_with_notices") {
    lines.push(`Phase 4 Final Acceptance [${result.finalRunId}] READY WITH NOTICES`);
    lines.push("Phase 4 close preparation can proceed after reviewing notices");
  } else {
    lines.push(`Phase 4 Final Acceptance [${result.finalRunId}] NOT READY`);
    lines.push("Phase 4 is NOT ready for close preparation");
  }

  if (result.blockingIssues.length > 0) lines.push(`Blocking (${result.blockingIssues.length}): ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices (${result.nonBlockingNotices.length}): ${result.nonBlockingNotices.join("; ")}`);

  lines.push(`Gate: ${result.acceptanceGate.gateStatus} | Checklist: ${result.preCloseChecklist.passedItems}/${result.preCloseChecklist.items.length} passed`);

  if (result.finalAcceptanceStatus === "not_ready_to_close_preparation") lines.push("Action required: resolve blocking issues and re-run final acceptance");
  else if (result.finalAcceptanceStatus === "ready_with_notices") lines.push("Action: review notices, then proceed to Phase 4 final close (Step 7)");
  else lines.push("Action: proceed to Phase 4 final close (Step 7)");

  return lines.join("\n");
};
