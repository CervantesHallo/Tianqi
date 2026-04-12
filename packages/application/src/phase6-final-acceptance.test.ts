import { describe, expect, it } from "vitest";
import type { Phase6AcceptanceInputSnapshot } from "./phase6-difference-matrix.js";
import { runPhase6DifferenceMatrix, PHASE6_BASELINE_CORE_FIELDS } from "./phase6-difference-matrix.js";
import type { Phase6AcceptanceGateResult, Phase6AcceptanceGateChecklistItem } from "./phase6-acceptance-gate.js";
import { runPhase6AcceptanceGate } from "./phase6-acceptance-gate.js";
import {
  runPhase6FinalAcceptance, assemblePhase6FinalAcceptance,
  validatePhase6FinalAcceptanceConsistency, buildPhase6FinalAcceptanceSummary
} from "./phase6-final-acceptance.js";

const DEFAULT_8_CHECKS: readonly Phase6AcceptanceGateChecklistItem[] = [
  { checkId: "trace_propagation_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "metrics_recording_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "benchmark_output_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "fault_drill_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "fault_drill_consistency_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "phase6_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_core_field_drift", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "observability_and_drill_consistency_passed", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] }
];

const makePassGate = (gateId: string, checks: readonly Phase6AcceptanceGateChecklistItem[] = DEFAULT_8_CHECKS): Phase6AcceptanceGateResult => ({
  gateId, gateStatus: "pass", checkResults: checks,
  passedChecks: checks.filter(c => c.status === "pass").length, failedChecks: checks.filter(c => c.status === "fail").length,
  warningChecks: checks.filter(c => c.status === "warning").length,
  blockingIssues: [], nonBlockingNotices: [], gateSummary: "test-pass", recommendedDecision: "ready_for_phase6_close_preparation"
});

const buildPassInput = (): Phase6AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE6_BASELINE_CORE_FIELDS],
  observabilityScenarioIds: ["T1", "T2", "T3", "T4", "T5"],
  faultDrillScenarioIds: ["F1", "F2", "F3", "F4", "F5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── ready_to_close_preparation ─────────────────────────────────────────────

describe("Phase6 Final Acceptance: ready_to_close_preparation", () => {
  it("full pipeline produces ready", () => {
    const result = runPhase6FinalAcceptance("fa-pass");
    expect(result.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.preCloseChecklist.failedItems).toBe(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.recommendedNextActions).toContain("Proceed to Phase 6 final close (Step 6)");
  });
});

// ─── ready_with_notices ─────────────────────────────────────────────────────

describe("Phase6 Final Acceptance: ready_with_notices", () => {
  it("produces ready_with_notices when gate has notices", () => {
    const { matrix } = runPhase6DifferenceMatrix("fa-notice-mx");
    const noticeInput: Phase6AcceptanceInputSnapshot = {
      ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["T3: avgDurationMs drifted"]
    };
    const gate = runPhase6AcceptanceGate("fa-notice-gate", noticeInput);
    const result = assemblePhase6FinalAcceptance("fa-notice", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── not_ready_to_close_preparation ─────────────────────────────────────────

describe("Phase6 Final Acceptance: not_ready_to_close_preparation", () => {
  it("produces not_ready when gate fails", () => {
    const { matrix } = runPhase6DifferenceMatrix("fa-fail-mx");
    const failInput: Phase6AcceptanceInputSnapshot = {
      ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["T1: tracePropagationStatus drifted"]
    };
    const gate = runPhase6AcceptanceGate("fa-fail-gate", failInput);
    const result = assemblePhase6FinalAcceptance("fa-fail", matrix, failInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── F-series boundary scenarios ────────────────────────────────────────────

describe("Phase6 Final Acceptance: F1 — matrix pass but checklist blocking fail", () => {
  it("must not be ready when gate has incomplete checks", () => {
    const { matrix } = runPhase6DifferenceMatrix("f1-mx");
    const input = buildPassInput();
    const incompleteGate = makePassGate("f1-gate", []);
    const result = assemblePhase6FinalAcceptance("f1", matrix, input, incompleteGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.preCloseChecklist.items.find(i => i.itemId === "acceptance_gate_evaluated")?.status).toBe("fail");
  });
});

describe("Phase6 Final Acceptance: F2 — gate pass_with_notice, checklist all pass", () => {
  it("must stabilize as ready_with_notices", () => {
    const { matrix } = runPhase6DifferenceMatrix("f2-mx");
    const noticeInput: Phase6AcceptanceInputSnapshot = {
      ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["T3: avgDurationMs drifted"]
    };
    const gate = runPhase6AcceptanceGate("f2-gate", noticeInput);
    expect(gate.gateStatus).toBe("pass_with_notice");
    const result = assemblePhase6FinalAcceptance("f2", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.preCloseChecklist.failedItems).toBe(0);
  });
});

describe("Phase6 Final Acceptance: F4 — observability ok but drill coverage insufficient", () => {
  it("must block final acceptance", () => {
    const { matrix } = runPhase6DifferenceMatrix("f4-mx");
    const shortInput: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), faultDrillScenarioIds: ["F1"] };
    const gate = runPhase6AcceptanceGate("f4-gate", shortInput);
    const result = assemblePhase6FinalAcceptance("f4", matrix, shortInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
  });
});

describe("Phase6 Final Acceptance: F5 — gate pass but blocking_issues_resolved fails", () => {
  it("must block when input has undetected blocking issues", () => {
    const { matrix } = runPhase6DifferenceMatrix("f5-mx");
    const inputWithHidden: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["undetected-blocking-issue"] };
    const spoofedGate = makePassGate("f5-gate");
    const result = assemblePhase6FinalAcceptance("f5", matrix, inputWithHidden, spoofedGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.preCloseChecklist.items.find(i => i.itemId === "blocking_issues_resolved_or_acknowledged")?.status).toBe("fail");
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Phase6 Final Acceptance: consistency", () => {
  it("real pipeline is consistent", () => {
    const result = runPhase6FinalAcceptance("fa-con");
    const c = validatePhase6FinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(5);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase6DifferenceMatrix("fa-con-n-mx");
    const noticeInput: Phase6AcceptanceInputSnapshot = {
      ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["T3: avgDurationMs drifted"]
    };
    const gate = runPhase6AcceptanceGate("fa-con-n-gate", noticeInput);
    const result = assemblePhase6FinalAcceptance("fa-con-n", matrix, noticeInput, gate);
    const c = validatePhase6FinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase6 Final Acceptance: summary", () => {
  it("ready summary is human-readable", () => {
    const result = runPhase6FinalAcceptance("fa-sum");
    expect(result.finalAcceptanceSummary).toContain("READY");
    expect(result.finalAcceptanceSummary).toContain("Step 6");
    expect(result.finalAcceptanceSummary).toContain("Gate: pass");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase6FinalAcceptance("fa-sum-cmp");
    expect(buildPhase6FinalAcceptanceSummary(result)).toBe(result.finalAcceptanceSummary);
  });
});

// ─── checklist coverage ─────────────────────────────────────────────────────

describe("Phase6 Final Acceptance: all 6 checklist items", () => {
  const EXPECTED = [
    "difference_matrix_completed", "acceptance_input_built", "acceptance_gate_evaluated",
    "observability_matrix_coverage_confirmed", "fault_drill_matrix_coverage_confirmed",
    "blocking_issues_resolved_or_acknowledged"
  ];

  it("real pipeline produces all 6 items", () => {
    const result = runPhase6FinalAcceptance("fa-cl");
    expect(result.preCloseChecklist.items.length).toBe(6);
    for (const id of EXPECTED) expect(result.preCloseChecklist.items.find(i => i.itemId === id)).toBeDefined();
  });
});

// ─── Step 4 compatibility ───────────────────────────────────────────────────

describe("Phase6 Final Acceptance: Step 4 gate semantics preserved", () => {
  it("gate result inside final acceptance matches standalone gate run", () => {
    const { matrix, acceptanceInput } = runPhase6DifferenceMatrix("compat-mx");
    const standaloneGate = runPhase6AcceptanceGate("compat-gate", acceptanceInput);
    const final = assemblePhase6FinalAcceptance("compat", matrix, acceptanceInput, standaloneGate);
    expect(final.acceptanceGate.gateStatus).toBe(standaloneGate.gateStatus);
    expect(final.acceptanceGate.checkResults.length).toBe(standaloneGate.checkResults.length);
    expect(final.acceptanceGate.recommendedDecision).toBe(standaloneGate.recommendedDecision);
  });
});
