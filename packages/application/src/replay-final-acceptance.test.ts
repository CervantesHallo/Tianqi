import { describe, expect, it } from "vitest";
import type { Phase5ReplayAcceptanceInputSnapshot } from "./replay-difference-matrix.js";
import { runPhase5ReplayDifferenceMatrix, PHASE5_REPLAY_BASELINE_CORE_FIELDS } from "./replay-difference-matrix.js";
import type { Phase5ReplayAcceptanceGateResult, Phase5ReplayAcceptanceGateChecklistItem } from "./replay-acceptance-gate.js";
import { runPhase5ReplayAcceptanceGate } from "./replay-acceptance-gate.js";
import {
  runPhase5ReplayFinalAcceptance,
  assemblePhase5ReplayFinalAcceptance,
  validatePhase5ReplayFinalAcceptanceConsistency,
  buildPhase5ReplayFinalAcceptanceSummary
} from "./replay-final-acceptance.js";

// ─── helpers ────────────────────────────────────────────────────────────────

const DEFAULT_8_CHECKS: readonly Phase5ReplayAcceptanceGateChecklistItem[] = [
  { checkId: "single_case_replay_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "batch_replay_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "reconstruction_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "comparison_semantics_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "replay_consistency_stable", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "replay_matrix_covered", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "no_blocking_core_field_drift", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] },
  { checkId: "single_and_batch_consistency_passed", status: "pass", reason: "ok", blocking: true, relatedArtifacts: [] }
];

const makePassGate = (gateId: string, checks: readonly Phase5ReplayAcceptanceGateChecklistItem[] = DEFAULT_8_CHECKS): Phase5ReplayAcceptanceGateResult => ({
  gateId, gateStatus: "pass", checkResults: checks,
  passedChecks: checks.filter(c => c.status === "pass").length,
  failedChecks: checks.filter(c => c.status === "fail").length,
  warningChecks: checks.filter(c => c.status === "warning").length,
  blockingIssues: [], nonBlockingNotices: [], gateSummary: "test-pass", recommendedDecision: "ready_for_phase5_close_preparation"
});

const buildPassInput = (): Phase5ReplayAcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE5_REPLAY_BASELINE_CORE_FIELDS],
  singleCaseScenarioIds: ["S1", "S2", "S3", "S4", "S5"],
  batchReplayScenarioIds: ["B1", "B2", "B3", "B4", "B5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── ready_to_close_preparation ─────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: ready_to_close_preparation", () => {
  it("full pipeline produces ready", () => {
    const result = runPhase5ReplayFinalAcceptance("rfa-pass");
    expect(result.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(result.blockingIssues.length).toBe(0);
    expect(result.preCloseChecklist.failedItems).toBe(0);
    expect(result.acceptanceGate.gateStatus).toBe("pass");
    expect(result.recommendedNextActions).toContain("Proceed to Phase 5 final close (Step 6)");
  });
});

// ─── ready_with_notices ─────────────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: ready_with_notices", () => {
  it("produces ready_with_notices when gate has notices", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("rfa-notice-mx");
    const noticeInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: eventCount drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("rfa-notice-gate", noticeInput);
    const result = assemblePhase5ReplayFinalAcceptance("rfa-notice", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── not_ready_to_close_preparation ─────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: not_ready_to_close_preparation", () => {
  it("produces not_ready when gate fails", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("rfa-fail-mx");
    const failInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["S1: reconstructionStatus drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("rfa-fail-gate", failInput);
    const result = assemblePhase5ReplayFinalAcceptance("rfa-fail", matrix, failInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── F-series boundary scenarios ────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: F1 — matrix pass but checklist blocking fail", () => {
  it("must not be ready when gate has incomplete checks", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("f1-mx");
    const input = buildPassInput();
    const incompleteGate = makePassGate("f1-gate", []);
    const result = assemblePhase5ReplayFinalAcceptance("f1", matrix, input, incompleteGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const gateItem = result.preCloseChecklist.items.find(i => i.itemId === "acceptance_gate_evaluated");
    expect(gateItem?.status).toBe("fail");
  });
});

describe("Phase5 Replay Final Acceptance: F2 — gate pass_with_notice, checklist all pass", () => {
  it("must stabilize as ready_with_notices", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("f2-mx");
    const noticeInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: eventCount drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("f2-gate", noticeInput);
    expect(gate.gateStatus).toBe("pass_with_notice");
    const result = assemblePhase5ReplayFinalAcceptance("f2", matrix, noticeInput, gate);
    expect(result.finalAcceptanceStatus).toBe("ready_with_notices");
    expect(result.preCloseChecklist.failedItems).toBe(0);
  });
});

describe("Phase5 Replay Final Acceptance: F4 — single case ok but batch coverage insufficient", () => {
  it("must block final acceptance", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("f4-mx");
    const shortInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      batchReplayScenarioIds: ["B1"]
    };
    const gate = runPhase5ReplayAcceptanceGate("f4-gate", shortInput);
    const result = assemblePhase5ReplayFinalAcceptance("f4", matrix, shortInput, gate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
  });
});

describe("Phase5 Replay Final Acceptance: F5 — gate pass but blocking_issues_resolved fails", () => {
  it("must block when input has undetected blocking issues", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("f5-mx");
    const inputWithHidden: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      blockingIssues: ["undetected-blocking-issue"]
    };
    const spoofedGate = makePassGate("f5-gate");
    const result = assemblePhase5ReplayFinalAcceptance("f5", matrix, inputWithHidden, spoofedGate);
    expect(result.finalAcceptanceStatus).toBe("not_ready_to_close_preparation");
    const blockItem = result.preCloseChecklist.items.find(i => i.itemId === "blocking_issues_resolved_or_acknowledged");
    expect(blockItem?.status).toBe("fail");
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: consistency", () => {
  it("real pipeline is consistent", () => {
    const result = runPhase5ReplayFinalAcceptance("rfa-con");
    const c = validatePhase5ReplayFinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(5);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("rfa-con-n-mx");
    const noticeInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: eventCount drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("rfa-con-n-gate", noticeInput);
    const result = assemblePhase5ReplayFinalAcceptance("rfa-con-n", matrix, noticeInput, gate);
    const c = validatePhase5ReplayFinalAcceptanceConsistency(result);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: summary", () => {
  it("ready summary is human-readable", () => {
    const result = runPhase5ReplayFinalAcceptance("rfa-sum");
    expect(result.finalAcceptanceSummary).toContain("READY");
    expect(result.finalAcceptanceSummary).toContain("Step 6");
    expect(result.finalAcceptanceSummary).toContain("Gate: pass");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase5ReplayFinalAcceptance("rfa-sum-cmp");
    const standalone = buildPhase5ReplayFinalAcceptanceSummary(result);
    expect(standalone).toBe(result.finalAcceptanceSummary);
  });
});

// ─── checklist coverage ─────────────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: all 6 checklist items", () => {
  const EXPECTED = [
    "difference_matrix_completed", "acceptance_input_built", "acceptance_gate_evaluated",
    "single_case_matrix_coverage_confirmed", "batch_replay_matrix_coverage_confirmed",
    "blocking_issues_resolved_or_acknowledged"
  ];

  it("real pipeline produces all 6 items", () => {
    const result = runPhase5ReplayFinalAcceptance("rfa-cl");
    expect(result.preCloseChecklist.items.length).toBe(6);
    for (const id of EXPECTED) {
      expect(result.preCloseChecklist.items.find(i => i.itemId === id)).toBeDefined();
    }
  });
});

// ─── Step 4 compatibility ───────────────────────────────────────────────────

describe("Phase5 Replay Final Acceptance: Step 4 gate semantics preserved", () => {
  it("gate result inside final acceptance matches standalone gate run", () => {
    const { matrix, acceptanceInput } = runPhase5ReplayDifferenceMatrix("compat-mx");
    const standaloneGate = runPhase5ReplayAcceptanceGate("compat-gate", acceptanceInput);
    const final = assemblePhase5ReplayFinalAcceptance("compat", matrix, acceptanceInput, standaloneGate);
    expect(final.acceptanceGate.gateStatus).toBe(standaloneGate.gateStatus);
    expect(final.acceptanceGate.checkResults.length).toBe(standaloneGate.checkResults.length);
    expect(final.acceptanceGate.recommendedDecision).toBe(standaloneGate.recommendedDecision);
  });
});
