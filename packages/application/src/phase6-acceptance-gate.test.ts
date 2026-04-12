import { describe, expect, it } from "vitest";
import type { Phase6AcceptanceInputSnapshot } from "./phase6-difference-matrix.js";
import { runPhase6DifferenceMatrix, PHASE6_BASELINE_CORE_FIELDS } from "./phase6-difference-matrix.js";
import { runPhase6AcceptanceGate, buildPhase6AcceptanceGateSummary } from "./phase6-acceptance-gate.js";

const buildPassInput = (): Phase6AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE6_BASELINE_CORE_FIELDS],
  observabilityScenarioIds: ["T1", "T2", "T3", "T4", "T5"],
  faultDrillScenarioIds: ["F1", "F2", "F3", "F4", "F5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

const buildNoticeInput = (): Phase6AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "passed_with_notice",
  nonBlockingNotices: ["T3: avgDurationMs drifted"]
});

const buildFailInput = (): Phase6AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "failed",
  blockingIssues: ["T1: tracePropagationStatus drifted", "F1: drillStatus drifted"],
  keyDriftFindings: ["T1: tracePropagationStatus drift"]
});

// ─── pass path ──────────────────────────────────────────────────────────────

describe("Phase6 Gate: pass path", () => {
  it("produces pass with correct decision", () => {
    const result = runPhase6AcceptanceGate("g-pass", buildPassInput());
    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase6_close_preparation");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.passedChecks).toBe(8);
    expect(result.blockingIssues.length).toBe(0);
  });
});

// ─── pass_with_notice path ──────────────────────────────────────────────────

describe("Phase6 Gate: pass_with_notice path", () => {
  it("produces pass_with_notice when only notices present", () => {
    const result = runPhase6AcceptanceGate("g-notice", buildNoticeInput());
    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

// ─── fail path ──────────────────────────────────────────────────────────────

describe("Phase6 Gate: fail path", () => {
  it("produces fail with blocking issues", () => {
    const result = runPhase6AcceptanceGate("g-fail", buildFailInput());
    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase6_close_preparation");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── checklist item coverage ────────────────────────────────────────────────

describe("Phase6 Gate: all 8 checklist items", () => {
  const EXPECTED_CHECK_IDS = [
    "trace_propagation_stable", "metrics_recording_stable",
    "benchmark_output_stable", "fault_drill_semantics_stable",
    "fault_drill_consistency_stable", "phase6_matrix_covered",
    "no_blocking_core_field_drift", "observability_and_drill_consistency_passed"
  ];

  it("pass input produces all 8 checks", () => {
    const result = runPhase6AcceptanceGate("g-checks", buildPassInput());
    expect(result.checkResults.length).toBe(8);
    for (const id of EXPECTED_CHECK_IDS) {
      expect(result.checkResults.find(c => c.checkId === id)).toBeDefined();
    }
  });

  it("all checks pass for clean input", () => {
    const result = runPhase6AcceptanceGate("g-all-pass", buildPassInput());
    for (const c of result.checkResults) expect(c.status).toBe("pass");
  });

  it("phase6_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), observabilityScenarioIds: ["T1"] };
    const result = runPhase6AcceptanceGate("g-cov", input);
    const check = result.checkResults.find(c => c.checkId === "phase6_matrix_covered")!;
    expect(check.status).toBe("fail");
  });

  it("trace_propagation_stable fails on tracePropagationStatus drift", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["T1: tracePropagationStatus drifted"] };
    const result = runPhase6AcceptanceGate("g-trace", input);
    expect(result.checkResults.find(c => c.checkId === "trace_propagation_stable")!.status).toBe("fail");
  });

  it("metrics_recording_stable fails on metricRecordingStatus drift", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["T2: metricRecordingStatus drifted"] };
    const result = runPhase6AcceptanceGate("g-metric", input);
    expect(result.checkResults.find(c => c.checkId === "metrics_recording_stable")!.status).toBe("fail");
  });

  it("benchmark_output_stable fails on benchmarkStatus drift", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["T3: benchmarkStatus drifted"] };
    const result = runPhase6AcceptanceGate("g-bench", input);
    expect(result.checkResults.find(c => c.checkId === "benchmark_output_stable")!.status).toBe("fail");
  });

  it("fault_drill_semantics_stable fails on drillStatus drift", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["F1: drillStatus drifted"] };
    const result = runPhase6AcceptanceGate("g-drill", input);
    expect(result.checkResults.find(c => c.checkId === "fault_drill_semantics_stable")!.status).toBe("fail");
  });

  it("fault_drill_consistency_stable fails on overallStatus drift", () => {
    const input: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), blockingIssues: ["F5: overallStatus drifted"] };
    const result = runPhase6AcceptanceGate("g-dcon", input);
    expect(result.checkResults.find(c => c.checkId === "fault_drill_consistency_stable")!.status).toBe("fail");
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Phase6 Gate: summary", () => {
  it("pass summary contains readiness", () => {
    const result = runPhase6AcceptanceGate("g-sum-p", buildPassInput());
    expect(result.gateSummary).toContain("PASSED");
    expect(result.gateSummary).toContain("readiness");
    expect(result.gateSummary).toContain("Step 5");
  });

  it("fail summary contains blocking info", () => {
    const result = runPhase6AcceptanceGate("g-sum-f", buildFailInput());
    expect(result.gateSummary).toContain("FAILED");
    expect(result.gateSummary).toContain("NOT ready");
  });

  it("standalone builder produces identical output", () => {
    const result = runPhase6AcceptanceGate("g-sum-cmp", buildPassInput());
    expect(buildPhase6AcceptanceGateSummary(result)).toBe(result.gateSummary);
  });
});

// ─── end-to-end: matrix → gate ──────────────────────────────────────────────

describe("Phase6 Gate: end-to-end with real matrix", () => {
  it("real matrix produces pass gate", () => {
    const { acceptanceInput } = runPhase6DifferenceMatrix("e2e-mx");
    const gate = runPhase6AcceptanceGate("e2e-gate", acceptanceInput);
    expect(gate.gateStatus).toBe("pass");
    expect(gate.recommendedDecision).toBe("ready_for_phase6_close_preparation");
    expect(gate.passedChecks).toBe(8);
    expect(gate.failedChecks).toBe(0);
  });
});
