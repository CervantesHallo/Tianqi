import { describe, expect, it } from "vitest";
import type { Phase7AcceptanceInputSnapshot } from "./phase7-difference-matrix.js";
import { runPhase7DifferenceMatrix, PHASE7_BASELINE_CORE_FIELDS } from "./phase7-difference-matrix.js";
import type { Phase7AcceptanceGateResult, Phase7AcceptanceGateChecklistItem } from "./phase7-acceptance-gate.js";
import { runPhase7AcceptanceGate } from "./phase7-acceptance-gate.js";
import { runPhase7FinalAcceptance, assemblePhase7FinalAcceptance, validatePhase7FinalAcceptanceConsistency, buildPhase7FinalAcceptanceSummary } from "./phase7-final-acceptance.js";

const DEFAULT_8_CHECKS: readonly Phase7AcceptanceGateChecklistItem[] = [
  { checkId: "config_preflight_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "contract_freeze_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "rollback_plan_ready", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "runbook_ready", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "release_guard_consistency_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "phase7_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_core_field_drift", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "preflight_and_rollback_runbook_consistency_passed", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] }
];

const makePassGate = (gateId: string, checks: readonly Phase7AcceptanceGateChecklistItem[] = DEFAULT_8_CHECKS): Phase7AcceptanceGateResult => ({
  gateId, gateStatus: "pass", checkResults: checks,
  passedChecks: checks.filter(c => c.status === "pass").length, failedChecks: checks.filter(c => c.status === "fail").length,
  warningChecks: checks.filter(c => c.status === "warning").length,
  blockingIssues: [], nonBlockingNotices: [], gateSummary: "test-pass", recommendedDecision: "ready_for_phase7_close_preparation"
});

const buildPassInput = (): Phase7AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE7_BASELINE_CORE_FIELDS], preflightScenarioIds: ["P1", "P2", "P3", "P4", "P5"],
  rollbackRunbookScenarioIds: ["R1", "R2", "R3", "R4", "R5"], differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── ready_to_close_preparation ─────────────────────────────────────────────

describe("Phase7 Final Acceptance: ready_to_close_preparation", () => {
  it("full pipeline produces ready", () => {
    const result = runPhase7FinalAcceptance("fa-pass");
    expect(result.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.preCloseChecklist.failedItems).toBe(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.recommendedNextActions).toContain("Proceed to Phase 7 final close (Step 6)");
  });
});

// ─── ready_with_notices ─────────────────────────────────────────────────────

describe("Phase7 Final Acceptance: ready_with_notices", () => {
  it("produces ready_with_notices when gate has notices", () => {
    const { matrix } = runPhase7DifferenceMatrix("fa-notice-mx");
    const noticeInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: noticeCount drifted"] };
    const gate = runPhase7AcceptanceGate("fa-notice-gate", noticeInput);
    const result = assemblePhase7FinalAcceptance("fa-notice", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

// ─── not_ready_to_close_preparation ─────────────────────────────────────────

describe("Phase7 Final Acceptance: not_ready_to_close_preparation", () => {
  it("produces not_ready when gate fails", () => {
    const { matrix } = runPhase7DifferenceMatrix("fa-fail-mx");
    const failInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["P3: preflightStatus drifted"] };
    const gate = runPhase7AcceptanceGate("fa-fail-gate", failInput);
    const result = assemblePhase7FinalAcceptance("fa-fail", matrix, failInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── F-series boundary scenarios ────────────────────────────────────────────

describe("Phase7 Final Acceptance: F1 — matrix pass but checklist blocking fail", () => {
  it("must not be ready when gate has incomplete checks", () => {
    const { matrix } = runPhase7DifferenceMatrix("f1-mx");
    const result = assemblePhase7FinalAcceptance("f1", matrix, buildPassInput(), makePassGate("f1-gate", []));
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.preCloseChecklist.items.find(i => i.itemId === "acceptance_gate_evaluated")?.status).toBe("fail");
  });
});

describe("Phase7 Final Acceptance: F2 — gate pass_with_notice, checklist all pass", () => {
  it("must stabilize as ready_with_notices", () => {
    const { matrix } = runPhase7DifferenceMatrix("f2-mx");
    const noticeInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: noticeCount drifted"] };
    const gate = runPhase7AcceptanceGate("f2-gate", noticeInput);
    const result = assemblePhase7FinalAcceptance("f2", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.preCloseChecklist.failedItems).toBe(0);
  });
});

describe("Phase7 Final Acceptance: F4 — preflight ok but rollback/runbook coverage insufficient", () => {
  it("must block final acceptance", () => {
    const { matrix } = runPhase7DifferenceMatrix("f4-mx");
    const shortInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), rollbackRunbookScenarioIds: ["R1"] };
    const gate = runPhase7AcceptanceGate("f4-gate", shortInput);
    const result = assemblePhase7FinalAcceptance("f4", matrix, shortInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
  });
});

describe("Phase7 Final Acceptance: F5 — gate pass but blocking_issues_resolved fails", () => {
  it("must block when input has undetected blocking issues", () => {
    const { matrix } = runPhase7DifferenceMatrix("f5-mx");
    const inputWithHidden: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["undetected-blocking-issue"] };
    const result = assemblePhase7FinalAcceptance("f5", matrix, inputWithHidden, makePassGate("f5-gate"));
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.preCloseChecklist.items.find(i => i.itemId === "blocking_issues_resolved_or_acknowledged")?.status).toBe("fail");
  });
});

// ─── consistency ────────────────────────────────────────────────────────────

describe("Phase7 Final Acceptance: consistency", () => {
  it("real pipeline is consistent", () => {
    const result = runPhase7FinalAcceptance("fa-con");
    const c = validatePhase7FinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
    expect(c.checkedInvariants).toBe(5);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase7DifferenceMatrix("fa-con-n-mx");
    const noticeInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: notice"] };
    const gate = runPhase7AcceptanceGate("fa-con-n-gate", noticeInput);
    const result = assemblePhase7FinalAcceptance("fa-con-n", matrix, noticeInput, gate);
    expect(validatePhase7FinalAcceptanceConsistency(result).consistent).toBe(true);
  });
});

// ─── summary + checklist + compat ───────────────────────────────────────────

describe("Phase7 Final Acceptance: summary + checklist + compat", () => {
  it("ready summary is human-readable", () => {
    const result = runPhase7FinalAcceptance("fa-sum");
    expect(result.finalAcceptanceSummary).toContain("READY");
    expect(result.finalAcceptanceSummary).toContain("Step 6");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase7FinalAcceptance("fa-sum-cmp");
    expect(buildPhase7FinalAcceptanceSummary(result)).toBe(result.finalAcceptanceSummary);
  });

  it("real pipeline produces all 6 checklist items", () => {
    const result = runPhase7FinalAcceptance("fa-cl");
    expect(result.preCloseChecklist.items.length).toBe(6);
    for (const id of ["difference_matrix_completed", "acceptance_input_built", "acceptance_gate_evaluated", "preflight_matrix_coverage_confirmed", "rollback_runbook_matrix_coverage_confirmed", "blocking_issues_resolved_or_acknowledged"]) {
      expect(result.preCloseChecklist.items.find(i => i.itemId === id)).toBeDefined();
    }
  });

  it("gate result inside final acceptance matches standalone gate run", () => {
    const { matrix, acceptanceInput } = runPhase7DifferenceMatrix("compat-mx");
    const standaloneGate = runPhase7AcceptanceGate("compat-gate", acceptanceInput);
    const final = assemblePhase7FinalAcceptance("compat", matrix, acceptanceInput, standaloneGate);
    expect(final.acceptanceGate.gateStatus).toBe(standaloneGate.gateStatus);
    expect(final.acceptanceGate.checkResults.length).toBe(standaloneGate.checkResults.length);
  });
});
