import type { Phase6AcceptanceInputSnapshot, Phase6ObservabilityDifferenceMatrix } from "./phase6-difference-matrix.js";
import { runPhase6DifferenceMatrix } from "./phase6-difference-matrix.js";
import type { Phase6AcceptanceGateResult } from "./phase6-acceptance-gate.js";
import { runPhase6AcceptanceGate } from "./phase6-acceptance-gate.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase6FinalAcceptanceStatus =
  | "ready_to_close_preparation"
  | "ready_with_notices"
  | "not_ready_to_close_preparation";

export type Phase6PreCloseChecklistItem = {
  readonly itemId: string;
  readonly status: "pass" | "warning" | "fail";
  readonly reason: string;
  readonly blocking: boolean;
};

export type Phase6PreCloseChecklist = {
  readonly items: readonly Phase6PreCloseChecklistItem[];
  readonly passedItems: number;
  readonly failedItems: number;
  readonly warningItems: number;
};

export type Phase6FinalAcceptanceResult = {
  readonly finalRunId: string;
  readonly differenceMatrix: Phase6ObservabilityDifferenceMatrix;
  readonly acceptanceInput: Phase6AcceptanceInputSnapshot;
  readonly acceptanceGate: Phase6AcceptanceGateResult;
  readonly preCloseChecklist: Phase6PreCloseChecklist;
  readonly finalAcceptanceStatus: Phase6FinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase6FinalAcceptanceConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

// ─── constants ──────────────────────────────────────────────────────────────

const EXPECTED_TOTAL_SCENARIOS = 10;
const EXPECTED_GATE_CHECKS = 8;

// ─── pre-close checklist evaluators ─────────────────────────────────────────

const evaluateMatrixCompleted = (matrix: Phase6ObservabilityDifferenceMatrix): Phase6PreCloseChecklistItem => {
  const ok = matrix.totalScenarios >= EXPECTED_TOTAL_SCENARIOS;
  return { itemId: "difference_matrix_completed", status: ok ? "pass" : "fail", reason: ok ? `Matrix completed: ${matrix.totalScenarios} scenarios` : `Matrix incomplete: ${matrix.totalScenarios} < ${EXPECTED_TOTAL_SCENARIOS}`, blocking: true };
};

const evaluateInputBuilt = (input: Phase6AcceptanceInputSnapshot): Phase6PreCloseChecklistItem => {
  const ok = input.baselineCoreFields.length > 0 && input.observabilityScenarioIds.length > 0 && input.faultDrillScenarioIds.length > 0;
  return { itemId: "acceptance_input_built", status: ok ? "pass" : "fail", reason: ok ? "Acceptance input built with all sections" : "Acceptance input missing sections", blocking: true };
};

const evaluateGateEvaluated = (gate: Phase6AcceptanceGateResult): Phase6PreCloseChecklistItem => {
  const ok = gate.checkResults.length >= EXPECTED_GATE_CHECKS;
  return { itemId: "acceptance_gate_evaluated", status: ok ? "pass" : "fail", reason: ok ? `Gate evaluated: ${gate.checkResults.length} checks` : `Gate incomplete: ${gate.checkResults.length} < ${EXPECTED_GATE_CHECKS}`, blocking: true };
};

const evaluateObsCoverage = (gate: Phase6AcceptanceGateResult): Phase6PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "phase6_matrix_covered");
  if (!check) return { itemId: "observability_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "observability_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateDrillCoverage = (gate: Phase6AcceptanceGateResult): Phase6PreCloseChecklistItem => {
  const check = gate.checkResults.find(c => c.checkId === "phase6_matrix_covered");
  if (!check) return { itemId: "fault_drill_matrix_coverage_confirmed", status: "fail", reason: "Matrix coverage check not found in gate", blocking: true };
  return { itemId: "fault_drill_matrix_coverage_confirmed", status: check.status, reason: check.reason, blocking: true };
};

const evaluateBlockingResolved = (gate: Phase6AcceptanceGateResult, input: Phase6AcceptanceInputSnapshot): Phase6PreCloseChecklistItem => {
  const gateCount = gate.blockingIssues.length;
  const inputCount = input.blockingIssues.length;
  if (gateCount > 0 || inputCount > 0) return { itemId: "blocking_issues_resolved_or_acknowledged", status: "fail", reason: `Blocking issues present: ${gateCount} from gate, ${inputCount} from input`, blocking: true };
  return { itemId: "blocking_issues_resolved_or_acknowledged", status: "pass", reason: "All blocking issues resolved", blocking: true };
};

// ─── pre-close checklist builder ────────────────────────────────────────────

export const buildPhase6PreCloseChecklist = (
  matrix: Phase6ObservabilityDifferenceMatrix, input: Phase6AcceptanceInputSnapshot, gate: Phase6AcceptanceGateResult
): Phase6PreCloseChecklist => {
  const items: Phase6PreCloseChecklistItem[] = [
    evaluateMatrixCompleted(matrix), evaluateInputBuilt(input), evaluateGateEvaluated(gate),
    evaluateObsCoverage(gate), evaluateDrillCoverage(gate), evaluateBlockingResolved(gate, input)
  ];
  return { items, passedItems: items.filter(i => i.status === "pass").length, failedItems: items.filter(i => i.status === "fail").length, warningItems: items.filter(i => i.status === "warning").length };
};

// ─── status determination ───────────────────────────────────────────────────

export const determinePhase6FinalAcceptanceStatus = (
  gate: Phase6AcceptanceGateResult, checklist: Phase6PreCloseChecklist
): Phase6FinalAcceptanceStatus => {
  const hasBlockingChecklistFail = checklist.items.some(i => i.blocking && i.status === "fail");
  if (gate.gateStatus === "fail" || hasBlockingChecklistFail) return "not_ready_to_close_preparation";
  if (gate.gateStatus === "pass_with_notice" || checklist.warningItems > 0) return "ready_with_notices";
  return "ready_to_close_preparation";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase6FinalAcceptance = (
  finalRunId: string, differenceMatrix: Phase6ObservabilityDifferenceMatrix,
  acceptanceInput: Phase6AcceptanceInputSnapshot, acceptanceGate: Phase6AcceptanceGateResult
): Phase6FinalAcceptanceResult => {
  const preCloseChecklist = buildPhase6PreCloseChecklist(differenceMatrix, acceptanceInput, acceptanceGate);
  const finalAcceptanceStatus = determinePhase6FinalAcceptanceStatus(acceptanceGate, preCloseChecklist);

  const checklistBlockingReasons = preCloseChecklist.items.filter(i => i.blocking && i.status === "fail").map(i => `[checklist] ${i.reason}`);
  const blockingIssues = [...new Set([...acceptanceGate.blockingIssues, ...checklistBlockingReasons])];
  const checklistWarningReasons = preCloseChecklist.items.filter(i => i.status === "warning").map(i => `[checklist] ${i.reason}`);
  const nonBlockingNotices = [...new Set([...acceptanceGate.nonBlockingNotices, ...checklistWarningReasons])];

  const recommendedNextActions: string[] = [];
  if (finalAcceptanceStatus === "ready_to_close_preparation") recommendedNextActions.push("Proceed to Phase 6 final close (Step 6)");
  else if (finalAcceptanceStatus === "ready_with_notices") { recommendedNextActions.push("Review notices before proceeding"); recommendedNextActions.push("Proceed to Phase 6 final close (Step 6) after review"); }
  else { recommendedNextActions.push("Resolve blocking issues"); recommendedNextActions.push("Re-run final acceptance after fixes"); }

  const partial: Phase6FinalAcceptanceResult = {
    finalRunId, differenceMatrix, acceptanceInput, acceptanceGate, preCloseChecklist,
    finalAcceptanceStatus, finalAcceptanceSummary: "", blockingIssues, nonBlockingNotices, recommendedNextActions
  };
  return { ...partial, finalAcceptanceSummary: buildPhase6FinalAcceptanceSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase6FinalAcceptance = (finalRunId: string): Phase6FinalAcceptanceResult => {
  const { matrix, acceptanceInput } = runPhase6DifferenceMatrix(`${finalRunId}-matrix`);
  const acceptanceGate = runPhase6AcceptanceGate(`${finalRunId}-gate`, acceptanceInput);
  return assemblePhase6FinalAcceptance(finalRunId, matrix, acceptanceInput, acceptanceGate);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase6FinalAcceptanceConsistency = (
  result: Phase6FinalAcceptanceResult
): Phase6FinalAcceptanceConsistencyResult => {
  const violations: string[] = [];
  if (result.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus !== "not_ready_to_close_preparation") violations.push("gate failed but finalAcceptanceStatus is not not_ready");
  const hasBlockingFail = result.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (result.acceptanceGate.gateStatus === "pass" && !hasBlockingFail && result.finalAcceptanceStatus === "not_ready_to_close_preparation") violations.push("gate passed, no checklist blocking fail, but finalAcceptanceStatus is not_ready");
  const allClean = result.preCloseChecklist.failedItems === 0 && result.preCloseChecklist.warningItems === 0 && result.acceptanceGate.gateStatus === "pass";
  if (allClean && result.finalAcceptanceStatus !== "ready_to_close_preparation") violations.push("all clean but finalAcceptanceStatus is not ready_to_close_preparation");
  if (result.blockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close_preparation") violations.push("blockingIssues non-empty but finalAcceptanceStatus is ready");
  if (result.blockingIssues.length === 0 && !hasBlockingFail && result.acceptanceGate.gateStatus !== "fail" && result.finalAcceptanceStatus === "not_ready_to_close_preparation") violations.push("no blocking source but finalAcceptanceStatus is not_ready");
  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};

// ─── summary builder ────────────────────────────────────────────────────────

export const buildPhase6FinalAcceptanceSummary = (result: Phase6FinalAcceptanceResult): string => {
  const lines: string[] = [];
  if (result.finalAcceptanceStatus === "ready_to_close_preparation") { lines.push(`Phase 6 Final Acceptance [${result.finalRunId}] READY: all gates and checks passed`); lines.push("Phase 6 has reached close preparation readiness"); }
  else if (result.finalAcceptanceStatus === "ready_with_notices") { lines.push(`Phase 6 Final Acceptance [${result.finalRunId}] READY WITH NOTICES`); lines.push("Phase 6 close preparation can proceed after reviewing notices"); }
  else { lines.push(`Phase 6 Final Acceptance [${result.finalRunId}] NOT READY`); lines.push("Phase 6 is NOT ready for close preparation"); }
  if (result.blockingIssues.length > 0) lines.push(`Blocking (${result.blockingIssues.length}): ${result.blockingIssues.join("; ")}`);
  if (result.nonBlockingNotices.length > 0) lines.push(`Notices (${result.nonBlockingNotices.length}): ${result.nonBlockingNotices.join("; ")}`);
  lines.push(`Gate: ${result.acceptanceGate.gateStatus} | Checklist: ${result.preCloseChecklist.passedItems}/${result.preCloseChecklist.items.length} passed`);
  if (result.finalAcceptanceStatus === "not_ready_to_close_preparation") lines.push("Action required: resolve blocking issues and re-run final acceptance");
  else if (result.finalAcceptanceStatus === "ready_with_notices") lines.push("Action: review notices, then proceed to Phase 6 final close (Step 6)");
  else lines.push("Action: proceed to Phase 6 final close (Step 6)");
  return lines.join("\n");
};
