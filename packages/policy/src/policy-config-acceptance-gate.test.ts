import { describe, expect, it } from "vitest";
import type { Phase3AcceptanceInputSnapshot } from "./policy-config-difference-matrix.js";
import { runPhase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import { PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS } from "./policy-config-difference-report.js";
import {
  runPhase3AcceptanceGate,
  buildPhase3AcceptanceGateSummary
} from "./policy-config-acceptance-gate.js";

const buildPassInput = (): Phase3AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS],
  strategyScenarioIds: ["S1", "S2", "S3", "S4", "S5"],
  configVersionScenarioIds: ["C1", "C2", "C3", "C4", "C5", "C6"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [],
  blockingIssues: [],
  nonBlockingNotices: [],
  recommendedNextActions: []
});

const buildNoticeInput = (): Phase3AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "passed_with_notice",
  nonBlockingNotices: ["S1: policySelectionSummary drifted"]
});

const buildFailInput = (): Phase3AcceptanceInputSnapshot => ({
  ...buildPassInput(),
  differenceMatrixOverallStatus: "failed",
  blockingIssues: ["C2: activationStatus drifted", "S4: preflightPassed drifted"],
  keyDriftFindings: ["C2: activationStatus drift", "S4: preflightPassed drift"]
});

// ─── pass path ──────────────────────────────────────────────────────────────

describe("Gate: pass path", () => {
  it("produces pass with correct decision", () => {
    const result = runPhase3AcceptanceGate("g-pass", buildPassInput());
    expect(result.gateStatus).toBe("pass");
    expect(result.recommendedDecision).toBe("ready_for_phase3_close_preparation");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBe(0);
    expect(result.passedChecks).toBe(8);
    expect(result.blockingIssues.length).toBe(0);
    expect(result.nonBlockingNotices.length).toBe(0);
  });
});

// ─── pass_with_notice path ──────────────────────────────────────────────────

describe("Gate: pass_with_notice path", () => {
  it("produces pass_with_notice when only notices present", () => {
    const result = runPhase3AcceptanceGate("g-notice", buildNoticeInput());
    expect(result.gateStatus).toBe("pass_with_notice");
    expect(result.recommendedDecision).toBe("ready_with_notices");
    expect(result.failedChecks).toBe(0);
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

// ─── fail path ──────────────────────────────────────────────────────────────

describe("Gate: fail path", () => {
  it("produces fail with blocking issues", () => {
    const result = runPhase3AcceptanceGate("g-fail", buildFailInput());
    expect(result.gateStatus).toBe("fail");
    expect(result.recommendedDecision).toBe("not_ready_for_phase3_close_preparation");
    expect(result.failedChecks).toBeGreaterThan(0);
    expect(result.blockingIssues.length).toBeGreaterThan(0);
  });
});

// ─── checklist item coverage ────────────────────────────────────────────────

describe("Gate: all 8 checklist items evaluated", () => {
  const EXPECTED_CHECK_IDS = [
    "policy_bundle_resolution_stable",
    "policy_dry_run_stable",
    "strategy_matrix_covered",
    "config_version_matrix_covered",
    "no_blocking_core_field_drift",
    "activation_chain_consistent",
    "audit_diff_readview_consistent",
    "no_blocking_failure_semantic_mismatch"
  ];

  it("pass input produces all 8 checks", () => {
    const result = runPhase3AcceptanceGate("g-checks", buildPassInput());
    expect(result.checkResults.length).toBe(8);
    for (const id of EXPECTED_CHECK_IDS) {
      expect(result.checkResults.find(c => c.checkId === id)).toBeDefined();
    }
  });

  it("all checks pass for clean input", () => {
    const result = runPhase3AcceptanceGate("g-all-pass", buildPassInput());
    for (const c of result.checkResults) {
      expect(c.status).toBe("pass");
      expect(c.blocking).toBe(true);
    }
  });

  it("strategy_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      strategyScenarioIds: ["S1", "S2"]
    };
    const result = runPhase3AcceptanceGate("g-strat", input);
    const check = result.checkResults.find(c => c.checkId === "strategy_matrix_covered")!;
    expect(check.status).toBe("fail");
  });

  it("config_version_matrix_covered fails with insufficient scenarios", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      configVersionScenarioIds: ["C1", "C2"]
    };
    const result = runPhase3AcceptanceGate("g-cv", input);
    const check = result.checkResults.find(c => c.checkId === "config_version_matrix_covered")!;
    expect(check.status).toBe("fail");
  });

  it("activation_chain_consistent fails on activationStatus drift", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["C2: activationStatus drifted"]
    };
    const result = runPhase3AcceptanceGate("g-chain", input);
    const check = result.checkResults.find(c => c.checkId === "activation_chain_consistent")!;
    expect(check.status).toBe("fail");
  });

  it("audit_diff_readview_consistent warns on notice-level diffSummary drift", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["C2: diffSummary drifted"]
    };
    const result = runPhase3AcceptanceGate("g-audit", input);
    const check = result.checkResults.find(c => c.checkId === "audit_diff_readview_consistent")!;
    expect(check.status).toBe("warning");
  });

  it("policy_bundle_resolution_stable fails on S-prefixed preflightPassed drift", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["S2: preflightPassed drifted"]
    };
    const result = runPhase3AcceptanceGate("g-bundle", input);
    const check = result.checkResults.find(c => c.checkId === "policy_bundle_resolution_stable")!;
    expect(check.status).toBe("fail");
  });

  it("policy_dry_run_stable fails on dryRunPassed drift", () => {
    const input: Phase3AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["S1: dryRunPassed drifted"]
    };
    const result = runPhase3AcceptanceGate("g-dryrun", input);
    const check = result.checkResults.find(c => c.checkId === "policy_dry_run_stable")!;
    expect(check.status).toBe("fail");
  });
});

// ─── summary builder ────────────────────────────────────────────────────────

describe("Gate: summary builder", () => {
  it("pass summary contains readiness statement", () => {
    const result = runPhase3AcceptanceGate("g-sum-pass", buildPassInput());
    expect(result.gateSummary).toContain("PASSED");
    expect(result.gateSummary).toContain("readiness");
    expect(result.gateSummary).toContain("Step 9");
  });

  it("fail summary contains blocking information", () => {
    const result = runPhase3AcceptanceGate("g-sum-fail", buildFailInput());
    expect(result.gateSummary).toContain("FAILED");
    expect(result.gateSummary).toContain("NOT ready");
    expect(result.gateSummary).toContain("resolve");
  });

  it("standalone summary builder produces identical output", () => {
    const result = runPhase3AcceptanceGate("g-sum-cmp", buildPassInput());
    const standalone = buildPhase3AcceptanceGateSummary(result);
    expect(standalone).toBe(result.gateSummary);
  });
});

// ─── end-to-end: matrix → gate ──────────────────────────────────────────────

describe("Gate: end-to-end with real matrix runner", () => {
  it("real matrix produces pass gate", () => {
    const { acceptanceInput } = runPhase3PolicyConfigDifferenceMatrix("e2e-matrix");
    const gate = runPhase3AcceptanceGate("e2e-gate", acceptanceInput);
    expect(gate.gateStatus).toBe("pass");
    expect(gate.recommendedDecision).toBe("ready_for_phase3_close_preparation");
    expect(gate.passedChecks).toBe(8);
    expect(gate.failedChecks).toBe(0);
  });
});
