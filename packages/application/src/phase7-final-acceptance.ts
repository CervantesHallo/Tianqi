import type { Phase7AcceptanceInputSnapshot, Phase7ReleaseGuardDifferenceMatrix } from "./phase7-difference-matrix.js";
import { runPhase7DifferenceMatrix } from "./phase7-difference-matrix.js";
import type { Phase7AcceptanceGateResult } from "./phase7-acceptance-gate.js";
import { runPhase7AcceptanceGate } from "./phase7-acceptance-gate.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase7FinalAcceptanceStatus = "ready_to_close_preparation" | "ready_with_notices" | "not_ready_to_close_preparation";

export type Phase7PreCloseChecklistItem = { readonly itemId: string; readonly status: "pass" | "warning" | "fail"; readonly reason: string; readonly blocking: boolean; };

export type Phase7PreCloseChecklist = { readonly items: readonly Phase7PreCloseChecklistItem[]; readonly passedItems: number; readonly failedItems: number; readonly warningItems: number; };

export type Phase7FinalAcceptanceResult = {
  readonly finalRunId: string;
  readonly differenceMatrix: Phase7ReleaseGuardDifferenceMatrix;
  readonly acceptanceInput: Phase7AcceptanceInputSnapshot;
  readonly acceptanceGate: Phase7AcceptanceGateResult;
  readonly preCloseChecklist: Phase7PreCloseChecklist;
  readonly finalAcceptanceStatus: Phase7FinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase7FinalAcceptanceConsistencyResult = { readonly consistent: boolean; readonly violations: readonly string[]; readonly checkedInvariants: number; };

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_TOTAL_SCENARIOS = 10;
const EXPECTED_GATE_CHECKS = 8;

// ─── pre-close checklist evaluators ─────────────────────────────────────────

const evaluateMatrixCompleted = (matrix: Phase7ReleaseGuardDifferenceMatrix): Phase7PreCloseChecklistItem => {
  const ok = matrix.totalScenarios >= EXPECTED_TOTAL_SCENARIOS;
  return { itemId: "difference_matrix_completed", status: ok ? "pass" : "fail", reason: ok ? `Matrix completed: ${matrix.totalScenarios} scenarios` : `Matrix incomplete: ${matrix.totalScenarios} < ${EXPECTED_TOTAL_SCENARIOS}`, blocking: true };
};

const evaluateInputBuilt = (input: Phase7AcceptanceInputSnapshot): Phase7PreCloseChecklistItem => {
  const ok = input.baselineCoreFields.length > 0 && input.preflightScenarioIds.length > 0 && input.rollbackRunbookScenarioIds.length > 0;
  return { itemId: "acceptance_input_built", status: ok ? "pass" : "fail", reason: ok ? "Acceptance input built" : "Acceptance input missing sections", blocking: true };
};

const evaluateGateEvaluated = (gate: Phase7AcceptanceGateResult): Phase7PreCloseChecklistItem => {
  const ok = gate.checkResults.length >= EXPECTED_GATE_CHECKS;
  return { itemId: "acceptance_gate_evaluated", status: ok ? "pass" : "fail", reason: ok ? `Gate evaluated: ${gate.checkResults.length} checks` : `Gate incomplete: ${gate.checkResults.length} < ${EXPECTED_GATE_CHECKS}`, blocking: true };
};

const evaluatePfCoverage = (gate: Phase7AcceptanceGateResult): Phase7PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "phase7_matrix_covered");
  if (!check) return { itemId: "preflight_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found", blocking: true };
  return { itemId: "preflight_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateRrCoverage = (gate: Phase7AcceptanceGateResult): Phase7PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "phase7_matrix_covered");
  if (!check) return { itemId: "rollback_runbook_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found", blocking: true };
  return { itemId: "rollback_runbook_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBlockingResolved = (gate: Phase7AcceptanceGateResult, input: Phase7AcceptanceInputSnapshot): Phase7PreCloseChecklistItem => {
  const count = gate.blockingIssues.length + input.blockingIssues.length;
  if (count > 0) return { itemId: "blocking_issues_resolved_or_acknowledged", status: "fail", reason: `Blocking issues present: ${count}`, blocking: true };
  return { itemId: "blocking_issues_resolved_or_acknowledged", status: "pass", reason: "All blocking issues resolved", blocking: true };
};

// ─── pre-close checklist builder ────────────────────────────────────────────

export const buildPhase7PreCloseChecklist = (matrix: Phase7ReleaseGuardDifferenceMatrix, input: Phase7AcceptanceInputSnapshot, gate: Phase7AcceptanceGateResult): Phase7PreCloseChecklist => {
  const items: Phase7PreCloseChecklistItem[] = [evaluateMatrixCompleted(matrix), evaluateInputBuilt(input), evaluateGateEvaluated(gate), evaluatePfCoverage(gate), evaluateRrCoverage(gate), evaluateBlockingResolved(gate, input)];
  return { items, passedItems: items.filter(i => i.status === "pass").length, failedItems: items.filter(i => i.status === "fail").length, warningItems: items.filter(i => i.status === "warning").length };
};

// ─── status determination ───────────────────────────────────────────────────

export const determinePhase7FinalAcceptanceStatus = (gate: Phase7AcceptanceGateResult, checklist: Phase7PreCloseChecklist): Phase7FinalAcceptanceStatus => {
  const hasBlockingFail = checklist.items.some(i => i.blocking && i.status === "fail");
  if (gate.gateStatus === "fail" || hasBlockingFail) return "not_ready_to_close_preparation";
  if (gate.gateStatus === "pass_with_notice" || checklist.warningItems > 0) return "ready_with_notices";
  return "ready_to_close_preparation";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase7FinalAcceptance = (finalRunId: string, differenceMatrix: Phase7ReleaseGuardDifferenceMatrix, acceptanceInput: Phase7AcceptanceInputSnapshot, acceptanceGate: Phase7AcceptanceGateResult): Phase7FinalAcceptanceResult => {
  const preCloseChecklist = buildPhase7PreCloseChecklist(differenceMatrix, acceptanceInput, acceptanceGate);
  const finalAcceptanceStatus = determinePhase7FinalAcceptanceStatus(acceptanceGate, preCloseChecklist);
  const checklistBlockingReasons = preCloseChecklist.items.filter(i => i.blocking && i.status === "fail").map(i => `[checklist] ${i.reason}`);
  const blockingIssues = [...new Set([...acceptanceGate.blockingIssues, ...checklistBlockingReasons])];
  const checklistWarningReasons = preCloseChecklist.items.filter(i => i.status === "warning").map(i => `[checklist] ${i.reason}`);
  const nonBlockingNotices = [...new Set([...acceptanceGate.nonBlockingNotices, ...checklistWarningReasons])];
  const recommendedNextActions: string[] = [];
  if (finalAcceptanceStatus === "ready_to_close_preparation") recommendedNextActions.push("Proceed to Phase 7 final close (Step 6)");
  else if (finalAcceptanceStatus === "ready_with_notices") { recommendedNextActions.push("Review notices before proceeding"); recommendedNextActions.push("Proceed to Phase 7 final close (Step 6) after review"); }
  else { recommendedNextActions.push("Resolve blocking issues"); recommendedNextActions.push("Re-run final acceptance after fixes"); }
  const partial: Phase7FinalAcceptanceResult = { finalRunId, differenceMatrix, acceptanceInput, acceptanceGate, preCloseChecklist, finalAcceptanceStatus, finalAcceptanceSummary: "", blockingIssues, nonBlockingNotices, recommendedNextActions };
  return { ...partial, finalAcceptanceSummary: buildPhase7FinalAcceptanceSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase7FinalAcceptance = (finalRunId: string): Phase7FinalAcceptanceResult => {
  const { matrix, acceptanceInput } = runPhase7DifferenceMatrix(`${finalRunId}-matrix`);
  const acceptanceGate = runPhase7AcceptanceGate(`${finalRunId}-gate`, acceptanceInput);
  return assemblePhase7FinalAcceptance(finalRunId, matrix, acceptanceInput, acceptanceGate);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase7FinalAcceptanceConsistency = (result: Phase7FinalAcceptanceResult): Phase7FinalAcceptanceConsistencyResult => {
  const violations: string[] = [];
  if (result.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus !== "not_ready_to_close_preparation") violations.push("gate failed but not not_ready");
  const hasBlockingFail = result.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (result.acceptanceGate.gateStatus === "pass" && !hasBlockingFail && result.finalAcceptanceStatus === "not_ready_to_close_preparation") violations.push("gate passed, no checklist fail, but not_ready");
  const allClean = result.preCloseChecklist.failedItems === 0 && result.preCloseChecklist.warningItems === 0 && result.acceptanceGate.gateStatus === "pass";
  if (allClean && result.finalAcceptanceStatus !== "ready_to_close_preparation") violations.push("all clean but not ready");
  if (result.blockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close_preparation") violations.push("blocking but ready");
  if (result.blockingIssues.length === 0 && !hasBlockingFail && result.acceptanceGate.gateStatus !== "fail" && result.finalAcceptanceStatus === "not_ready_to_close_preparation") violations.push("no blocking but not_ready");
  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase7FinalAcceptanceSummary = (result: Phase7FinalAcceptanceResult): string => {
  const lines: string[] = [];
  if (result.finalAcceptanceStatus === "ready_to_close_preparation") { lines.push(`Phase 7 Final Acceptance [${result.finalRunId}] READY: all gates and checks passed`); lines.push("Phase 7 has reached close preparation readiness"); }
  else if (result.finalAcceptanceStatus === "ready_with_notices") { lines.push(`Phase 7 Final Acceptance [${result.finalRunId}] READY WITH NOTICES`); lines.push("Phase 7 close preparation can proceed after reviewing notices"); }
  else { lines.push(`Phase 7 Final Acceptance [${result.finalRunId}] NOT READY`); lines.push("Phase 7 is NOT ready for close preparation"); }
  if (result.blockingIssues.length > 0) lines.push(`Blocking (${result.blockingIssues.length}): ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices (${result.nonBlockingNotices.length}): ${result.nonBlockingNotices.join("; ")}`);
  lines.push(`Gate: ${result.acceptanceGate.gateStatus} | Checklist: ${result.preCloseChecklist.passedItems}/${result.preCloseChecklist.items.length} passed`);
  if (result.finalAcceptanceStatus === "not_ready_to_close_preparation") lines.push("Action required: resolve blocking issues and re-run");
  else if (result.finalAcceptanceStatus === "ready_with_notices") lines.push("Action: review notices, then proceed to Phase 7 final close (Step 6)");
  else lines.push("Action: proceed to Phase 7 final close (Step 6)");
  return lines.join("\n");
};
