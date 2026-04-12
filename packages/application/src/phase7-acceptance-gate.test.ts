import { describe, expect, it } from "vitest";
import type { Phase7AcceptanceInputSnapshot } from "./phase7-difference-matrix.js";
import { runPhase7DifferenceMatrix, PHASE7_BASELINE_CORE_FIELDS } from "./phase7-difference-matrix.js";
import { runPhase7AcceptanceGate, buildPhase7AcceptanceGateSummary } from "./phase7-acceptance-gate.js";

const buildPassInput = (): Phase7AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE7_BASELINE_CORE_FIELDS],
  preflightScenarioIds: ["P1", "P2", "P3", "P4", "P5"],
  rollbackRunbookScenarioIds: ["R1", "R2", "R3", "R4", "R5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

const buildNoticeInput = (): Phase7AcceptanceInputSnapshot => ({
  ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: noticeCount drifted"]
});

const buildFailInput = (): Phase7AcceptanceInputSnapshot => ({
  ...buildPassInput(), differenceMatrixOverallStatus: "failed",
  blockingIssues: ["P3: preflightStatus drifted", "R3: rollbackPlanStatus drifted"],
  keyDriftFindings: ["P3: preflightStatus drift"]
});

describe("Phase7 Gate: pass path", () => {
  it("produces pass with correct decision", () => {
    const result = runPhase7AcceptanceGate("g-pass", buildPassInput());
    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase7_close_preparation");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.passedChecks).toBe(8);
    expect(result.blockingIssues.length).toBe(0);
  });
});

describe("Phase7 Gate: pass_with_notice path", () => {
  it("produces pass_with_notice when only notices present", () => {
    const result = runPhase7AcceptanceGate("g-notice", buildNoticeInput());
    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

describe("Phase7 Gate: fail path", () => {
  it("produces fail with blocking issues", () => {
    const result = runPhase7AcceptanceGate("g-fail", buildFailInput());
    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase7_close_preparation");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

describe("Phase7 Gate: all 8 checklist items", () => {
  const EXPECTED_CHECK_IDS = [
    "config_preflight_stable", "contract_freeze_stable", "rollback_plan_ready", "runbook_ready",
    "release_guard_consistency_stable", "phase7_matrix_covered",
    "no_blocking_core_field_drift", "preflight_and_rollback_runbook_consistency_passed"
  ];

  it("pass input produces all 8 checks", () => {
    const result = runPhase7AcceptanceGate("g-checks", buildPassInput());
    expect(result.checkResults.length).toBe(8);
    for (const id of EXPECTED_CHECK_IDS) expect(result.checkResults.find(c => c.checkId === id)).toBeDefined();
  });

  it("all checks pass for clean input", () => {
    const result = runPhase7AcceptanceGate("g-all-pass", buildPassInput());
    for (const c of result.checkResults) expect(c.status).toBe("pass");
  });

  it("phase7_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), preflightScenarioIds: ["P1"] };
    const result = runPhase7AcceptanceGate("g-cov", input);
    expect(result.checkResults.find(c => c.checkId === "phase7_matrix_covered")!.status).toBe("fail");
  });

  it("config_preflight_stable fails on preflightStatus drift", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["P1: preflightStatus drifted"] };
    expect(runPhase7AcceptanceGate("g-pf", input).checkResults.find(c => c.checkId === "config_preflight_stable")!.status).toBe("fail");
  });

  it("contract_freeze_stable fails on contractBaselineStatus drift", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["P4: contractBaselineStatus drifted"] };
    expect(runPhase7AcceptanceGate("g-cf", input).checkResults.find(c => c.checkId === "contract_freeze_stable")!.status).toBe("fail");
  });

  it("rollback_plan_ready fails on rollbackPlanStatus drift", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["R3: rollbackPlanStatus drifted"] };
    expect(runPhase7AcceptanceGate("g-rp", input).checkResults.find(c => c.checkId === "rollback_plan_ready")!.status).toBe("fail");
  });

  it("runbook_ready fails on runbookStatus drift", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["R5: runbookStatus drifted"] };
    expect(runPhase7AcceptanceGate("g-rb", input).checkResults.find(c => c.checkId === "runbook_ready")!.status).toBe("fail");
  });

  it("release_guard_consistency_stable fails on summaryStatus drift", () => {
    const input: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["G7: summaryStatus drifted"] };
    expect(runPhase7AcceptanceGate("g-gc", input).checkResults.find(c => c.checkId === "release_guard_consistency_stable")!.status).toBe("fail");
  });
});

describe("Phase7 Gate: summary", () => {
  it("pass summary contains readiness", () => {
    const result = runPhase7AcceptanceGate("g-sum-p", buildPassInput());
    expect(result.gateSummary).toContain("PASSED");
    expect(result.gateSummary).toContain("readiness");
    expect(result.gateSummary).toContain("Step 5");
  });

  it("fail summary contains blocking info", () => {
    const result = runPhase7AcceptanceGate("g-sum-f", buildFailInput());
    expect(result.gateSummary).toContain("FAILED");
    expect(result.gateSummary).toContain("NOT ready");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase7AcceptanceGate("g-sum-cmp", buildPassInput());
    expect(buildPhase7AcceptanceGateSummary(result)).toBe(result.gateSummary);
  });
});

describe("Phase7 Gate: end-to-end with real matrix", () => {
  it("real matrix produces pass gate", () => {
    const { acceptanceInput } = runPhase7DifferenceMatrix("e2e-mx");
    const gate = runPhase7AcceptanceGate("e2e-gate", acceptanceInput);
    expect(gate.gateStatus).toBe("pass");
    expect(gate.recommendedDecision).toBe("ready_for_phase7_close_preparation");
    expect(gate.passedChecks).toBe(8);
    expect(gate.failedChecks).toBe(0);
  });
});
