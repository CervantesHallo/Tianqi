import { describe, expect, it } from "vitest";
import type { Phase3AcceptanceInputSnapshot } from "./policy-config-difference-matrix.js";
import { runPhase3PolicyConfigDifferenceMatrix, buildPhase3AcceptanceInputSnapshot } from "./policy-config-difference-matrix.js";
import type { Phase3AcceptanceGateResult, Phase3AcceptanceGateChecklistItem } from "./policy-config-acceptance-gate.js";
import { runPhase3AcceptanceGate } from "./policy-config-acceptance-gate.js";
import {
  runPhase3FinalAcceptance,
  assemblePhase3FinalAcceptance,
  validatePhase3FinalAcceptanceConsistency,
  buildPhase3FinalAcceptanceSummary
} from "./policy-config-final-acceptance.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const makePassGate = (gateId: string, checks: readonly Phase3AcceptanceGateChecklistItem[] = DEFAULT_8_CHECKS): Phase3AcceptanceGateResult => ({
  gateId,
  gateStatus: "pass",
  checkResults: checks,
  passedChecks: checks.filter(c => c.status === "pass").length,
  failedChecks: checks.filter(c => c.status === "fail").length,
  warningChecks: checks.filter(c => c.status === "warning").length,
  blockingIssues: [],
  nonBlockingNotices: [],
  gateSummary: "test-pass",
  recommendedDecision: "ready_for_phase3_close_preparation"
});

const DEFAULT_8_CHECKS: readonly Phase3AcceptanceGateChecklistItem[] = [
  { checkId: "policy_bundle_resolution_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "policy_dry_run_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "strategy_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "config_version_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_core_field_drift", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "activation_chain_consistent", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "audit_diff_readview_consistent", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_failure_semantic_mismatch", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] }
];

// ─── ready_to_close_preparation path ────────────────────────────────────────

describe("Final Acceptance: ready_to_close_preparation", () => {
  it("full pipeline produces ready when matrix is clean", () => {
    const result = runPhase3FinalAcceptance("fa-pass");
    expect(result.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.preCloseChecklist.failedItems).toBe(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.recommendedNextActions).toContain("Proceed to Phase 3 final close (Step 10)");
  });
});

// ─── ready_with_notices path ────────────────────────────────────────────────

describe("Final Acceptance: ready_with_notices", () => {
  it("produces ready_with_notices when gate has notices", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("fa-notice-mx");
    const noticeInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: policySelectionSummary drifted"]
    };
    const gate = runPhase3AcceptanceGate("fa-notice-gate", noticeInput);
    const result = assemblePhase3FinalAcceptance("fa-notice", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── not_ready_to_close_preparation path ────────────────────────────────────

describe("Final Acceptance: not_ready_to_close_preparation", () => {
  it("produces not_ready when gate fails", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("fa-fail-mx");
    const failInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["C2: activationStatus drifted"]
    };
    const gate = runPhase3AcceptanceGate("fa-fail-gate", failInput);
    const result = assemblePhase3FinalAcceptance("fa-fail", matrix, failInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── F-series boundary scenarios ────────────────────────────────────────────

describe("Final Acceptance: F1 — matrix pass but checklist blocking fail", () => {
  it("must not be ready when gate has incomplete checks", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("f1-mx");
    const input = buildPhase3AcceptanceInputSnapshot(matrix);
    const incompleteGate = makePassGate("f1-gate", []);
    const result = assemblePhase3FinalAcceptance("f1", matrix, input, incompleteGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const gateItem = result.preCloseChecklist.items.find(i => i.itemId === "acceptance_gate_evaluated");
    expect(gateItem?.status).toBe("fail");
  });
});

describe("Final Acceptance: F2 — gate pass_with_notice, checklist all pass", () => {
  it("must stabilize as ready_with_notices", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("f2-mx");
    const noticeInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: policySelectionSummary drifted"]
    };
    const gate = runPhase3AcceptanceGate("f2-gate", noticeInput);
    expect(gate.gateStatus).toBe("pass_with_notice");
    const result = assemblePhase3FinalAcceptance("f2", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.preCloseChecklist.failedItems).toBe(0);
  });
});

describe("Final Acceptance: F4 — strategy ok but config version coverage insufficient", () => {
  it("must block final acceptance", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("f4-mx");
    const shortInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      configVersionScenarioIds: ["C1", "C2"]
    };
    const gate = runPhase3AcceptanceGate("f4-gate", shortInput);
    const result = assemblePhase3FinalAcceptance("f4", matrix, shortInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const cvItem = result.preCloseChecklist.items.find(i => i.itemId === "config_version_matrix_coverage_confirmed");
    expect(cvItem?.status).toBe("fail");
  });
});

describe("Final Acceptance: F5 — gate pass but blocking_issues_resolved_or_acknowledged fails", () => {
  it("must block when input has undetected blocking issues", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("f5-mx");
    const inputWithHidden: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      blockingIssues: ["undetected-blocking-issue"]
    };
    const spoofedGate = makePassGate("f5-gate");
    const result = assemblePhase3FinalAcceptance("f5", matrix, inputWithHidden, spoofedGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const blockItem = result.preCloseChecklist.items.find(i => i.itemId === "blocking_issues_resolved_or_acknowledged");
    expect(blockItem?.status).toBe("fail");
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Final Acceptance: consistency validation", () => {
  it("real pipeline is internally consistent", () => {
    const result = runPhase3FinalAcceptance("fa-con");
    const consistency = validatePhase3FinalAcceptanceConsistency(result);
    expect(consistency.consistent).toBe(true);
    expect(consistency.violations.length).toBe(0);
    expect(consistency.checkedInvariants).toBe(5);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("fa-con-n-mx");
    const noticeInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: policySelectionSummary drifted"]
    };
    const gate = runPhase3AcceptanceGate("fa-con-n-gate", noticeInput);
    const result = assemblePhase3FinalAcceptance("fa-con-n", matrix, noticeInput, gate);
    const consistency = validatePhase3FinalAcceptanceConsistency(result);
    expect(consistency.consistent).toBe(true);
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Final Acceptance: summary builder", () => {
  it("ready summary is human-readable", () => {
    const result = runPhase3FinalAcceptance("fa-sum");
    expect(result.finalAcceptanceSummary).toContain("READY");
    expect(result.finalAcceptanceSummary).toContain("Step 10");
    expect(result.finalAcceptanceSummary).toContain("Gate: pass");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase3FinalAcceptance("fa-sum-cmp");
    const standalone = buildPhase3FinalAcceptanceSummary(result);
    expect(standalone).toBe(result.finalAcceptanceSummary);
  });
});

// ─── pre-close checklist coverage ───────────────────────────────────────────

describe("Final Acceptance: all 6 checklist items evaluated", () => {
  const EXPECTED_ITEM_IDS = [
    "difference_matrix_completed",
    "acceptance_input_built",
    "acceptance_gate_evaluated",
    "strategy_matrix_coverage_confirmed",
    "config_version_matrix_coverage_confirmed",
    "blocking_issues_resolved_or_acknowledged"
  ];

  it("real pipeline produces all 6 items", () => {
    const result = runPhase3FinalAcceptance("fa-cl");
    expect(result.preCloseChecklist.items.length).toBe(6);
    for (const id of EXPECTED_ITEM_IDS) {
      expect(result.preCloseChecklist.items.find(i => i.itemId === id)).toBeDefined();
    }
  });
});

// ─── Step 8 compatibility ───────────────────────────────────────────────────

describe("Final Acceptance: Step 8 gate semantics preserved", () => {
  it("gate result inside final acceptance matches standalone gate run", () => {
    const { matrix, acceptanceInput } = runPhase3PolicyConfigDifferenceMatrix("compat-mx");
    const standaloneGate = runPhase3AcceptanceGate("compat-gate", acceptanceInput);
    const final = assemblePhase3FinalAcceptance("compat", matrix, acceptanceInput, standaloneGate);
    expect(final.acceptanceGate.gateStatus).toBe(standaloneGate.gateStatus);
    expect(final.acceptanceGate.checkResults.length).toBe(standaloneGate.checkResults.length);
    expect(final.acceptanceGate.recommendedDecision).toBe(standaloneGate.recommendedDecision);
  });
});
