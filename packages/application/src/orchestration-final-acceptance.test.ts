import { describe, expect, it } from "vitest";
import type { Phase4AcceptanceInputSnapshot } from "./orchestration-difference-matrix.js";
import { runPhase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import type { Phase4AcceptanceGateResult, Phase4AcceptanceGateChecklistItem } from "./orchestration-acceptance-gate.js";
import { runPhase4AcceptanceGate } from "./orchestration-acceptance-gate.js";
import { PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS } from "./orchestration-difference-report.js";
import {
  runPhase4FinalAcceptance,
  assemblePhase4FinalAcceptance,
  validatePhase4FinalAcceptanceConsistency,
  buildPhase4FinalAcceptanceSummary
} from "./orchestration-final-acceptance.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const DEFAULT_8_CHECKS: readonly Phase4AcceptanceGateChecklistItem[] = [
  { checkId: "risk_case_orchestration_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "liquidation_case_orchestration_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "replay_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "compensation_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "saga_resume_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "orchestration_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_core_field_drift", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "cross_path_consistency_passed", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] }
];

const makePassGate = (gateId: string, checks: readonly Phase4AcceptanceGateChecklistItem[] = DEFAULT_8_CHECKS): Phase4AcceptanceGateResult => ({
  gateId, gateStatus: "pass", checkResults: checks,
  passedChecks: checks.filter(c => c.status === "pass").length,
  failedChecks: checks.filter(c => c.status === "fail").length,
  warningChecks: checks.filter(c => c.status === "warning").length,
  blockingIssues: [], nonBlockingNotices: [], gateSummary: "test-pass", recommendedDecision: "ready_for_phase4_close_preparation"
});

const buildPassInput = (): Phase4AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS],
  riskCaseScenarioIds: ["R1", "R2", "R3", "R4", "R5"],
  liquidationCaseScenarioIds: ["L1", "L2", "L3", "L4", "L5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── ready_to_close_preparation ─────────────────────────────────────────────

describe("Phase4 Final Acceptance: ready_to_close_preparation", () => {
  it("full pipeline produces ready", () => {
    const result = runPhase4FinalAcceptance("fa-pass");
    expect(result.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.preCloseChecklist.failedItems).toBe(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.recommendedNextActions).toContain("Proceed to Phase 4 final close (Step 7)");
  });
});

// ─── ready_with_notices ─────────────────────────────────────────────────────

describe("Phase4 Final Acceptance: ready_with_notices", () => {
  it("produces ready_with_notices when gate has notices", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("fa-notice-mx");
    const noticeInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["R1: resultSummary drifted"]
    };
    const gate = runPhase4AcceptanceGate("fa-notice-gate", noticeInput);
    const result = assemblePhase4FinalAcceptance("fa-notice", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── not_ready_to_close_preparation ─────────────────────────────────────────

describe("Phase4 Final Acceptance: not_ready_to_close_preparation", () => {
  it("produces not_ready when gate fails", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("fa-fail-mx");
    const failInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["R1: resultStatus drifted"]
    };
    const gate = runPhase4AcceptanceGate("fa-fail-gate", failInput);
    const result = assemblePhase4FinalAcceptance("fa-fail", matrix, failInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── F-series boundary scenarios ────────────────────────────────────────────

describe("Phase4 Final Acceptance: F1 — matrix pass but checklist blocking fail", () => {
  it("must not be ready when gate has incomplete checks", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("f1-mx");
    const input = buildPassInput();
    const incompleteGate = makePassGate("f1-gate", []);
    const result = assemblePhase4FinalAcceptance("f1", matrix, input, incompleteGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const gateItem = result.preCloseChecklist.items.find(i => i.itemId === "acceptance_gate_evaluated");
    expect(gateItem?.status).toBe("fail");
  });
});

describe("Phase4 Final Acceptance: F2 — gate pass_with_notice, checklist all pass", () => {
  it("must stabilize as ready_with_notices", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("f2-mx");
    const noticeInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["R1: resultSummary drifted"]
    };
    const gate = runPhase4AcceptanceGate("f2-gate", noticeInput);
    expect(gate.gateStatus).toBe("pass_with_notice");
    const result = assemblePhase4FinalAcceptance("f2", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.preCloseChecklist.failedItems).toBe(0);
  });
});

describe("Phase4 Final Acceptance: F4 — RC coverage ok but LC coverage insufficient", () => {
  it("must block final acceptance", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("f4-mx");
    const shortInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      liquidationCaseScenarioIds: ["L1"]
    };
    const gate = runPhase4AcceptanceGate("f4-gate", shortInput);
    const result = assemblePhase4FinalAcceptance("f4", matrix, shortInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
  });
});

describe("Phase4 Final Acceptance: F5 — gate pass but blocking_issues_resolved fails", () => {
  it("must block when input has undetected blocking issues", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("f5-mx");
    const inputWithHidden: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      blockingIssues: ["undetected-blocking-issue"]
    };
    const spoofedGate = makePassGate("f5-gate");
    const result = assemblePhase4FinalAcceptance("f5", matrix, inputWithHidden, spoofedGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const blockItem = result.preCloseChecklist.items.find(i => i.itemId === "blocking_issues_resolved_or_acknowledged");
    expect(blockItem?.status).toBe("fail");
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Phase4 Final Acceptance: consistency", () => {
  it("real pipeline is consistent", () => {
    const result = runPhase4FinalAcceptance("fa-con");
    const c = validatePhase4FinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(5);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("fa-con-n-mx");
    const noticeInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["R1: resultSummary drifted"]
    };
    const gate = runPhase4AcceptanceGate("fa-con-n-gate", noticeInput);
    const result = assemblePhase4FinalAcceptance("fa-con-n", matrix, noticeInput, gate);
    const c = validatePhase4FinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase4 Final Acceptance: summary", () => {
  it("ready summary is human-readable", () => {
    const result = runPhase4FinalAcceptance("fa-sum");
    expect(result.finalAcceptanceSummary).toContain("READY");
    expect(result.finalAcceptanceSummary).toContain("Step 7");
    expect(result.finalAcceptanceSummary).toContain("Gate: pass");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase4FinalAcceptance("fa-sum-cmp");
    const standalone = buildPhase4FinalAcceptanceSummary(result);
    expect(standalone).toBe(result.finalAcceptanceSummary);
  });
});

// ─── checklist coverage ─────────────────────────────────────────────────────

describe("Phase4 Final Acceptance: all 6 checklist items", () => {
  const EXPECTED = [
    "difference_matrix_completed", "acceptance_input_built", "acceptance_gate_evaluated",
    "risk_case_matrix_coverage_confirmed", "liquidation_case_matrix_coverage_confirmed",
    "blocking_issues_resolved_or_acknowledged"
  ];

  it("real pipeline produces all 6 items", () => {
    const result = runPhase4FinalAcceptance("fa-cl");
    expect(result.preCloseChecklist.items.length).toBe(6);
    for (const id of EXPECTED) {
      expect(result.preCloseChecklist.items.find(i => i.itemId === id)).toBeDefined();
    }
  });
});

// ─── Step 5 compatibility ───────────────────────────────────────────────────

describe("Phase4 Final Acceptance: Step 5 gate semantics preserved", () => {
  it("gate result inside final acceptance matches standalone gate run", () => {
    const { matrix, acceptanceInput } = runPhase4OrchestrationDifferenceMatrix("compat-mx");
    const standaloneGate = runPhase4AcceptanceGate("compat-gate", acceptanceInput);
    const final = assemblePhase4FinalAcceptance("compat", matrix, acceptanceInput, standaloneGate);
    expect(final.acceptanceGate.gateStatus).toBe(standaloneGate.gateStatus);
    expect(final.acceptanceGate.checkResults.length).toBe(standaloneGate.checkResults.length);
    expect(final.acceptanceGate.recommendedDecision).toBe(standaloneGate.recommendedDecision);
  });
});
