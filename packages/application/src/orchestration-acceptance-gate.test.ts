import { describe, expect, it } from "vitest";
import type { Phase4AcceptanceInputSnapshot } from "./orchestration-difference-matrix.js";
import { runPhase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import { PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS } from "./orchestration-difference-report.js";
import { runPhase4AcceptanceGate, buildPhase4AcceptanceGateSummary } from "./orchestration-acceptance-gate.js";

const buildPassInput = (): Phase4AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS],
  riskCaseScenarioIds: ["R1", "R2", "R3", "R4", "R5"],
  liquidationCaseScenarioIds: ["L1", "L2", "L3", "L4", "L5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [],
  blockingIssues: [],
  nonBlockingNotices: [],
  recommendedNextActions: []
});

const buildNoticeInput = (): Phase4AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "passed_with_notice",
  nonBlockingNotices: ["R1: resultSummary drifted"]
});

const buildFailInput = (): Phase4AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "failed",
  blockingIssues: ["R1: resultStatus drifted", "L2: sagaStatus drifted"],
  keyDriftFindings: ["R1: resultStatus drift", "L2: sagaStatus drift"]
});

// ─── pass path ──────────────────────────────────────────────────────────────

describe("Phase4 Gate: pass path", () => {
  it("produces pass with correct decision", () => {
    const result = runPhase4AcceptanceGate("g-pass", buildPassInput());
    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase4_close_preparation");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.passedChecks).toBe(8);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── pass_with_notice path ──────────────────────────────────────────────────

describe("Phase4 Gate: pass_with_notice path", () => {
  it("produces pass_with_notice when only notices present", () => {
    const result = runPhase4AcceptanceGate("g-notice", buildNoticeInput());
    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

// ─── fail path ──────────────────────────────────────────────────────────────

describe("Phase4 Gate: fail path", () => {
  it("produces fail with blocking issues", () => {
    const result = runPhase4AcceptanceGate("g-fail", buildFailInput());
    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase4_close_preparation");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── checklist item coverage ────────────────────────────────────────────────

describe("Phase4 Gate: all 8 checklist items evaluated", () => {
  const EXPECTED_CHECK_IDS = [
    "risk_case_orchestration_stable",
    "liquidation_case_orchestration_stable",
    "replay_semantics_stable",
    "compensation_semantics_stable",
    "saga_resume_semantics_stable",
    "orchestration_matrix_covered",
    "no_blocking_core_field_drift",
    "cross_path_consistency_passed"
  ];

  it("pass input produces all 8 checks", () => {
    const result = runPhase4AcceptanceGate("g-checks", buildPassInput());
    expect(result.checkResults.length).toBe(8);
    for (const id of EXPECTED_CHECK_IDS) {
      expect(result.checkResults.find(c => c.checkId === id)).toBeDefined();
    }
  });

  it("all checks pass for clean input", () => {
    const result = runPhase4AcceptanceGate("g-all-pass", buildPassInput());
    for (const c of result.checkResults) {
      expect(c.status).toBe("pass");
    }
  });

  it("orchestration_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), riskCaseScenarioIds: ["R1"] };
    const result = runPhase4AcceptanceGate("g-cov", input);
    const check = result.checkResults.find(c => c.checkId === "orchestration_matrix_covered")!;
    expect(check.status).toBe("fail");
  });

  it("risk_case_orchestration_stable fails on R-series blocking drift", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["R1: resultStatus drifted"] };
    const result = runPhase4AcceptanceGate("g-rc", input);
    const check = result.checkResults.find(c => c.checkId === "risk_case_orchestration_stable")!;
    expect(check.status).toBe("fail");
  });

  it("liquidation_case_orchestration_stable fails on L-series blocking drift", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["L3: sagaStatus drifted"] };
    const result = runPhase4AcceptanceGate("g-lc", input);
    const check = result.checkResults.find(c => c.checkId === "liquidation_case_orchestration_stable")!;
    expect(check.status).toBe("fail");
  });

  it("replay_semantics_stable fails on idempotencyStatus drift", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["R2: idempotencyStatus drifted"] };
    const result = runPhase4AcceptanceGate("g-replay", input);
    const check = result.checkResults.find(c => c.checkId === "replay_semantics_stable")!;
    expect(check.status).toBe("fail");
  });

  it("compensation_semantics_stable fails on pendingCompensation drift", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["R3: pendingCompensation drifted"] };
    const result = runPhase4AcceptanceGate("g-comp", input);
    const check = result.checkResults.find(c => c.checkId === "compensation_semantics_stable")!;
    expect(check.status).toBe("fail");
  });

  it("saga_resume_semantics_stable fails on sagaStatus drift", () => {
    const input: Phase4AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["L5: sagaStatus drifted"] };
    const result = runPhase4AcceptanceGate("g-saga", input);
    const check = result.checkResults.find(c => c.checkId === "saga_resume_semantics_stable")!;
    expect(check.status).toBe("fail");
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase4 Gate: summary builder", () => {
  it("pass summary contains readiness statement", () => {
    const result = runPhase4AcceptanceGate("g-sum-pass", buildPassInput());
    expect(result.gateSummary).toContain("PASSED");
    expect(result.gateSummary).toContain("readiness");
    expect(result.gateSummary).toContain("Step 6");
  });

  it("fail summary contains blocking information", () => {
    const result = runPhase4AcceptanceGate("g-sum-fail", buildFailInput());
    expect(result.gateSummary).toContain("FAILED");
    expect(result.gateSummary).toContain("NOT ready");
    expect(result.gateSummary).toContain("resolve");
  });

  it("standalone summary builder produces identical output", () => {
    const result = runPhase4AcceptanceGate("g-sum-cmp", buildPassInput());
    const standalone = buildPhase4AcceptanceGateSummary(result);
    expect(standalone).toBe(result.gateSummary);
  });
});

// ─── end-to-end: matrix → gate ──────────────────────────────────────────────

describe("Phase4 Gate: end-to-end with real matrix runner", () => {
  it("real matrix produces pass gate", () => {
    const { acceptanceInput } = runPhase4OrchestrationDifferenceMatrix("e2e-mx");
    const gate = runPhase4AcceptanceGate("e2e-gate", acceptanceInput);
    expect(gate.gateStatus).toBe("pass");
    expect(gate.recommendedDecision).toBe("ready_for_phase4_close_preparation");
    expect(gate.passedChecks).toBe(8);
    expect(gate.failedChecks).toBe(0);
  });
});
