import { describe, expect, it } from "vitest";
import type { Phase5ReplayAcceptanceInputSnapshot } from "./replay-difference-matrix.js";
import { runPhase5ReplayDifferenceMatrix, PHASE5_REPLAY_BASELINE_CORE_FIELDS } from "./replay-difference-matrix.js";
import { runPhase5ReplayAcceptanceGate, buildPhase5ReplayAcceptanceGateSummary } from "./replay-acceptance-gate.js";

const buildPassInput = (): Phase5ReplayAcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE5_REPLAY_BASELINE_CORE_FIELDS],
  singleCaseScenarioIds: ["S1", "S2", "S3", "S4", "S5"],
  batchReplayScenarioIds: ["B1", "B2", "B3", "B4", "B5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

const buildNoticeInput = (): Phase5ReplayAcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "passed_with_notice",
  nonBlockingNotices: ["S1: eventCount drifted"]
});

const buildFailInput = (): Phase5ReplayAcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "failed",
  blockingIssues: ["S1: reconstructionStatus drifted", "B2: failedCases drifted"],
  keyDriftFindings: ["S1: reconstructionStatus drift"]
});

// ─── pass path ──────────────────────────────────────────────────────────────

describe("Phase5 Replay Gate: pass path", () => {
  it("produces pass with correct decision", () => {
    const result = runPhase5ReplayAcceptanceGate("g-pass", buildPassInput());
    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase5_close_preparation");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.passedChecks).toBe(8);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── pass_with_notice path ──────────────────────────────────────────────────

describe("Phase5 Replay Gate: pass_with_notice path", () => {
  it("produces pass_with_notice when only notices present", () => {
    const result = runPhase5ReplayAcceptanceGate("g-notice", buildNoticeInput());
    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

// ─── fail path ──────────────────────────────────────────────────────────────

describe("Phase5 Replay Gate: fail path", () => {
  it("produces fail with blocking issues", () => {
    const result = runPhase5ReplayAcceptanceGate("g-fail", buildFailInput());
    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase5_close_preparation");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── checklist item coverage ────────────────────────────────────────────────

describe("Phase5 Replay Gate: all 8 checklist items", () => {
  const EXPECTED_CHECK_IDS = [
    "single_case_replay_stable", "batch_replay_stable",
    "reconstruction_semantics_stable", "comparison_semantics_stable",
    "replay_consistency_stable", "replay_matrix_covered",
    "no_blocking_core_field_drift", "single_and_batch_consistency_passed"
  ];

  it("pass input produces all 8 checks", () => {
    const result = runPhase5ReplayAcceptanceGate("g-checks", buildPassInput());
    expect(result.checkResults.length).toBe(8);
    for (const id of EXPECTED_CHECK_IDS) {
      expect(result.checkResults.find(c => c.checkId === id)).toBeDefined();
    }
  });

  it("all checks pass for clean input", () => {
    const result = runPhase5ReplayAcceptanceGate("g-all-pass", buildPassInput());
    for (const c of result.checkResults) expect(c.status).toBe("pass");
  });

  it("replay_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), singleCaseScenarioIds: ["S1"] };
    const result = runPhase5ReplayAcceptanceGate("g-cov", input);
    const check = result.checkResults.find(c => c.checkId === "replay_matrix_covered")!;
    expect(check.status).toBe("fail");
  });

  it("single_case_replay_stable fails on S-series blocking drift", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["S1: reconstructionStatus drifted"] };
    const result = runPhase5ReplayAcceptanceGate("g-sc", input);
    const check = result.checkResults.find(c => c.checkId === "single_case_replay_stable")!;
    expect(check.status).toBe("fail");
  });

  it("batch_replay_stable fails on B-series blocking drift", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["B2: failedCases drifted"] };
    const result = runPhase5ReplayAcceptanceGate("g-bt", input);
    const check = result.checkResults.find(c => c.checkId === "batch_replay_stable")!;
    expect(check.status).toBe("fail");
  });

  it("reconstruction_semantics_stable fails on reconstructionStatus drift", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["S1: reconstructionStatus drifted"] };
    const result = runPhase5ReplayAcceptanceGate("g-recon", input);
    const check = result.checkResults.find(c => c.checkId === "reconstruction_semantics_stable")!;
    expect(check.status).toBe("fail");
  });

  it("comparison_semantics_stable fails on comparisonStatus drift", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["B1: comparisonStatus drifted"] };
    const result = runPhase5ReplayAcceptanceGate("g-comp", input);
    const check = result.checkResults.find(c => c.checkId === "comparison_semantics_stable")!;
    expect(check.status).toBe("fail");
  });

  it("replay_consistency_stable fails on failedCases drift", () => {
    const input: Phase5ReplayAcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["B4: failedCases drifted"] };
    const result = runPhase5ReplayAcceptanceGate("g-cons", input);
    const check = result.checkResults.find(c => c.checkId === "replay_consistency_stable")!;
    expect(check.status).toBe("fail");
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase5 Replay Gate: summary", () => {
  it("pass summary contains readiness", () => {
    const result = runPhase5ReplayAcceptanceGate("g-sum-p", buildPassInput());
    expect(result.gateSummary).toContain("PASSED");
    expect(result.gateSummary).toContain("readiness");
    expect(result.gateSummary).toContain("Step 5");
  });

  it("fail summary contains blocking info", () => {
    const result = runPhase5ReplayAcceptanceGate("g-sum-f", buildFailInput());
    expect(result.gateSummary).toContain("FAILED");
    expect(result.gateSummary).toContain("NOT ready");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase5ReplayAcceptanceGate("g-sum-cmp", buildPassInput());
    expect(buildPhase5ReplayAcceptanceGateSummary(result)).toBe(result.gateSummary);
  });
});

// ─── end-to-end: matrix → gate ──────────────────────────────────────────────

describe("Phase5 Replay Gate: end-to-end with real matrix", () => {
  it("real matrix produces pass gate", () => {
    const { acceptanceInput } = runPhase5ReplayDifferenceMatrix("e2e-mx");
    const gate = runPhase5ReplayAcceptanceGate("e2e-gate", acceptanceInput);
    expect(gate.gateStatus).toBe("pass");
    expect(gate.recommendedDecision).toBe("ready_for_phase5_close_preparation");
    expect(gate.passedChecks).toBe(8);
    expect(gate.failedChecks).toBe(0);
  });
});
