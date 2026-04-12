import { describe, expect, it } from "vitest";

import { PHASE2_AGGREGATE_BASELINE_CORE_FIELDS } from "./core-case-diagnostic-aggregate-baseline.js";
import type { Phase2AcceptanceInputSnapshot } from "./core-case-diagnostic-aggregate-difference-matrix.js";
import {
  buildPhase2AcceptanceGateSummary,
  PHASE2_ACCEPTANCE_GATE_CHECK_IDS,
  runPhase2AcceptanceGate,
  type Phase2AcceptanceGateCheckId
} from "./core-case-diagnostic-aggregate-acceptance-gate.js";

const makeCleanSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE2_AGGREGATE_BASELINE_CORE_FIELDS],
  scenarioMatrixIds: ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11", "M12"],
  failureCombinationIds: ["FC01", "FC02", "FC03"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [],
  blockingIssues: [],
  nonBlockingNotices: [],
  recommendedPreCloseActions: ["All baselines pass; proceed to final acceptance gate"]
});

const makeNoticeSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  differenceMatrixOverallStatus: "passed_with_notice",
  keyDriftFindings: [
    { sourceId: "M01", field: "aggregateSummary", expected: "x", actual: "y", blocking: false }
  ],
  nonBlockingNotices: ["M01: aggregateSummary minor drift"]
});

const makeBlockingDriftSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  differenceMatrixOverallStatus: "failed",
  keyDriftFindings: [
    { sourceId: "M02", field: "riskLevel", expected: "low", actual: "high", blocking: true }
  ],
  blockingIssues: ["M02: riskLevel drifted (expected=low, actual=high)"]
});

const makeSemanticMismatchSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  differenceMatrixOverallStatus: "failed",
  blockingIssues: ["FC01: failure semantic mismatch"]
});

const makeCommandDriftSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  differenceMatrixOverallStatus: "failed",
  keyDriftFindings: [
    { sourceId: "M02", field: "requiresAttention", expected: false, actual: true, blocking: true }
  ],
  blockingIssues: ["M02: requiresAttention drifted"]
});

const makeSessionDriftSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  differenceMatrixOverallStatus: "failed",
  keyDriftFindings: [
    { sourceId: "M08", field: "isCrossSessionConsistent", expected: true, actual: false, blocking: true }
  ],
  blockingIssues: ["M08: isCrossSessionConsistent drifted"]
});

const makeInsufficientCoverageSnapshot = (): Phase2AcceptanceInputSnapshot => ({
  ...makeCleanSnapshot(),
  scenarioMatrixIds: ["M01", "M02", "M03"],
  failureCombinationIds: ["FC01"]
});

describe("Step 26: acceptance gate pass path", () => {
  it("all clean -> pass with ready_for_phase2_close", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-pass", snapshot: makeCleanSnapshot() });

    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase2_close");
    expect(result.passedChecks).toBe(8);
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBe(0);
    expect(result.checkResults.length).toBe(8);
    expect(result.gateSummary).toContain("PASS");
    expect(result.gateSummary).toContain("Ready for Phase 2 close");
  });
});

describe("Step 26: acceptance gate pass_with_notice path", () => {
  it("non-blocking notice -> pass_with_notice with ready_with_notices", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-notice", snapshot: makeNoticeSnapshot() });

    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.passedChecks).toBe(7);
    expect(result.warningChecks).toBe(1);
    expect(result.failedChecks).toBe(0);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBe(1);
    expect(result.gateSummary).toContain("PASS WITH NOTICE");
    expect(result.gateSummary).toContain("Review before closing");
  });
});

describe("Step 26: acceptance gate fail paths", () => {
  it("blocking core field drift -> fail with not_ready_for_phase2_close", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-drift", snapshot: makeBlockingDriftSnapshot() });

    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase2_close");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
    expect(result.gateSummary).toContain("FAIL");
    expect(result.gateSummary).toContain("Must resolve");
  });

  it("failure semantic mismatch -> fail", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-semantic", snapshot: makeSemanticMismatchSnapshot() });

    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase2_close");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.some((s) => s.includes("failure semantic"))).toBe(true);
  });

  it("command-path consistency drift -> fail", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-cmd", snapshot: makeCommandDriftSnapshot() });

    expect(result.gateStatus).toBe("fail");
    const cmdCheck = result.checkResults.find((c) => c.checkId === "cross_command_consistency_passed");
    expect(cmdCheck?.status).toBe("fail");
    expect(cmdCheck?.blocking).toBe(true);
  });

  it("cross-session consistency drift -> fail", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-session", snapshot: makeSessionDriftSnapshot() });

    expect(result.gateStatus).toBe("fail");
    const sessionCheck = result.checkResults.find((c) => c.checkId === "cross_session_consistency_passed");
    expect(sessionCheck?.status).toBe("fail");
    expect(sessionCheck?.blocking).toBe(true);
  });

  it("insufficient coverage -> fail", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-coverage", snapshot: makeInsufficientCoverageSnapshot() });

    expect(result.gateStatus).toBe("fail");
    const scenarioCheck = result.checkResults.find((c) => c.checkId === "scenario_matrix_covered");
    expect(scenarioCheck?.status).toBe("fail");
    const comboCheck = result.checkResults.find((c) => c.checkId === "failure_combination_matrix_covered");
    expect(comboCheck?.status).toBe("fail");
  });
});

describe("Step 26: checklist coverage", () => {
  it("all 8 checklist items are evaluated for clean snapshot", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-checklist", snapshot: makeCleanSnapshot() });

    expect(result.checkResults.length).toBe(8);
    const checkIds = result.checkResults.map((c) => c.checkId);
    for (const expected of PHASE2_ACCEPTANCE_GATE_CHECK_IDS) {
      expect(checkIds).toContain(expected);
    }
  });

  it("each checklist item has required fields", () => {
    const result = runPhase2AcceptanceGate({ gateId: "gate-fields", snapshot: makeCleanSnapshot() });

    for (const check of result.checkResults) {
      expect(check.checkId).toBeDefined();
      expect(check.status).toBeDefined();
      expect(check.reason).toBeDefined();
      expect(typeof check.blocking).toBe("boolean");
      expect(Array.isArray(check.relatedArtifacts)).toBe(true);
    }
  });

  it("each check reports correct status for specific failure inputs", () => {
    const checks: Array<{ checkId: Phase2AcceptanceGateCheckId; snapshot: Phase2AcceptanceInputSnapshot; expected: "fail" }> = [
      { checkId: "baseline_core_fields_stable", snapshot: makeBlockingDriftSnapshot(), expected: "fail" },
      { checkId: "failure_semantics_frozen", snapshot: makeSemanticMismatchSnapshot(), expected: "fail" },
      { checkId: "scenario_matrix_covered", snapshot: makeInsufficientCoverageSnapshot(), expected: "fail" },
      { checkId: "failure_combination_matrix_covered", snapshot: makeInsufficientCoverageSnapshot(), expected: "fail" },
      { checkId: "cross_command_consistency_passed", snapshot: makeCommandDriftSnapshot(), expected: "fail" },
      { checkId: "cross_session_consistency_passed", snapshot: makeSessionDriftSnapshot(), expected: "fail" },
      { checkId: "no_blocking_core_field_drift", snapshot: makeBlockingDriftSnapshot(), expected: "fail" },
      { checkId: "no_blocking_failure_semantic_mismatch", snapshot: makeSemanticMismatchSnapshot(), expected: "fail" }
    ];

    for (const tc of checks) {
      const result = runPhase2AcceptanceGate({ gateId: `check-${tc.checkId}`, snapshot: tc.snapshot });
      const check = result.checkResults.find((c) => c.checkId === tc.checkId);
      expect(check?.status, `${tc.checkId} should be ${tc.expected}`).toBe(tc.expected);
    }
  });
});

describe("Step 26: gate summary builder", () => {
  it("pass summary is readable", () => {
    const summary = buildPhase2AcceptanceGateSummary({
      gateStatus: "pass",
      passedChecks: 8,
      failedChecks: 0,
      warningChecks: 0,
      blockingIssues: [],
      nonBlockingNotices: []
    });
    expect(summary).toContain("PASS");
    expect(summary).toContain("8");
    expect(summary).toContain("Ready for Phase 2 close");
  });

  it("pass_with_notice summary includes notices", () => {
    const summary = buildPhase2AcceptanceGateSummary({
      gateStatus: "pass_with_notice",
      passedChecks: 7,
      failedChecks: 0,
      warningChecks: 1,
      blockingIssues: [],
      nonBlockingNotices: ["minor drift on aggregateSummary"]
    });
    expect(summary).toContain("PASS WITH NOTICE");
    expect(summary).toContain("warning");
    expect(summary).toContain("minor drift");
    expect(summary).toContain("Review before closing");
  });

  it("fail summary includes blocking issues", () => {
    const summary = buildPhase2AcceptanceGateSummary({
      gateStatus: "fail",
      passedChecks: 5,
      failedChecks: 3,
      warningChecks: 0,
      blockingIssues: ["riskLevel drift", "semantic mismatch"],
      nonBlockingNotices: []
    });
    expect(summary).toContain("FAIL");
    expect(summary).toContain("riskLevel drift");
    expect(summary).toContain("Must resolve");
  });
});

describe("Step 26: Step 25 semantics preserved", () => {
  it("PHASE2_ACCEPTANCE_GATE_CHECK_IDS has exactly 8 entries", () => {
    expect(PHASE2_ACCEPTANCE_GATE_CHECK_IDS.length).toBe(8);
  });

  it("gate runner does not mutate input snapshot", () => {
    const snapshot = makeCleanSnapshot();
    const original = JSON.stringify(snapshot);
    runPhase2AcceptanceGate({ gateId: "immutability-test", snapshot });
    expect(JSON.stringify(snapshot)).toBe(original);
  });

  it("gate runner produces stable results for same input", () => {
    const snapshot = makeCleanSnapshot();
    const r1 = runPhase2AcceptanceGate({ gateId: "stable-1", snapshot });
    const r2 = runPhase2AcceptanceGate({ gateId: "stable-2", snapshot });

    expect(r1.gateStatus).toBe(r2.gateStatus);
    expect(r1.passedChecks).toBe(r2.passedChecks);
    expect(r1.failedChecks).toBe(r2.failedChecks);
    expect(r1.recommendedDecision).toBe(r2.recommendedDecision);
  });
});
