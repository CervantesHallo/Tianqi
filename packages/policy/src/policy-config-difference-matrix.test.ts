import { describe, expect, it } from "vitest";
import {
  runPhase3PolicyConfigDifferenceMatrix,
  PHASE3_STRATEGY_SCENARIO_BASELINES,
  PHASE3_CONFIG_VERSION_SCENARIO_BASELINES
} from "./policy-config-difference-matrix.js";
import {
  classifyFieldDrift,
  PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS
} from "./policy-config-difference-report.js";
import { assertPhase3PolicyConfigBaselineConsistency } from "./policy-config-matrix-consistency.js";

const run = () => runPhase3PolicyConfigDifferenceMatrix("test-run");

// ─── full matrix ────────────────────────────────────────────────────────────

describe("Phase3 matrix: full run produces correct aggregate", () => {
  it("all 11 scenarios match and matrix passes", () => {
    const { matrix, acceptanceInput } = run();

    expect(matrix.totalScenarios).toBe(11);
    expect(matrix.strategyScenarioReports.length).toBe(5);
    expect(matrix.configVersionScenarioReports.length).toBe(6);
    expect(matrix.matchedScenarios).toBe(11);
    expect(matrix.mismatchedScenarios).toBe(0);
    expect(matrix.overallStatus).toBe("passed");
    expect(matrix.coreFieldDriftSummary.length).toBe(0);
    expect(matrix.matrixSummary).toContain("11/11");

    expect(acceptanceInput.strategyScenarioIds).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(acceptanceInput.configVersionScenarioIds).toEqual(["C1", "C2", "C3", "C4", "C5", "C6"]);
    expect(acceptanceInput.differenceMatrixOverallStatus).toBe("passed");
    expect(acceptanceInput.blockingIssues.length).toBe(0);
    expect(acceptanceInput.nonBlockingNotices.length).toBe(0);
    expect(acceptanceInput.recommendedNextActions[0]).toContain("Step 8");
  });
});

// ─── strategy scenarios ─────────────────────────────────────────────────────

describe("Phase3 matrix: strategy scenario reports", () => {
  it("S1 stub bundle dry-run matched", () => {
    const { matrix } = run();
    const s1 = matrix.strategyScenarioReports.find(r => r.scenarioId === "S1")!;
    expect(s1.matched).toBe(true);
    expect(s1.matchedFields).toContain("dryRunPassed");
  });

  it("S2 real bundle dry-run matched", () => {
    const { matrix } = run();
    const s2 = matrix.strategyScenarioReports.find(r => r.scenarioId === "S2")!;
    expect(s2.matched).toBe(true);
  });

  it("S3 coexistence matched", () => {
    const { matrix } = run();
    const s3 = matrix.strategyScenarioReports.find(r => r.scenarioId === "S3")!;
    expect(s3.matched).toBe(true);
  });

  it("S4 resolution failure matched", () => {
    const { matrix } = run();
    const s4 = matrix.strategyScenarioReports.find(r => r.scenarioId === "S4")!;
    expect(s4.matched).toBe(true);
    expect(s4.matchedFields).toContain("preflightPassed");
  });

  it("S5 full preflight pipeline matched", () => {
    const { matrix } = run();
    const s5 = matrix.strategyScenarioReports.find(r => r.scenarioId === "S5")!;
    expect(s5.matched).toBe(true);
  });
});

// ─── config version scenarios ───────────────────────────────────────────────

describe("Phase3 matrix: config version scenario reports", () => {
  it("C1 first activation matched", () => {
    const { matrix } = run();
    const c1 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C1")!;
    expect(c1.matched).toBe(true);
    expect(c1.matchedFields).toContain("activationStatus");
    expect(c1.matchedFields).toContain("rollbackAvailable");
  });

  it("C2 version switch matched", () => {
    const { matrix } = run();
    const c2 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C2")!;
    expect(c2.matched).toBe(true);
    expect(c2.matchedFields).toContain("diffSummary");
  });

  it("C3 preflight failure matched", () => {
    const { matrix } = run();
    const c3 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C3")!;
    expect(c3.matched).toBe(true);
  });

  it("C4 rollback matched", () => {
    const { matrix } = run();
    const c4 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C4")!;
    expect(c4.matched).toBe(true);
    expect(c4.matchedFields).toContain("auditAction");
  });

  it("C5 already_active matched", () => {
    const { matrix } = run();
    const c5 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C5")!;
    expect(c5.matched).toBe(true);
  });

  it("C6 audit+diff+readview matched", () => {
    const { matrix } = run();
    const c6 = matrix.configVersionScenarioReports.find(r => r.scenarioId === "C6")!;
    expect(c6.matched).toBe(true);
  });
});

// ─── blocking / notice classification ───────────────────────────────────────

describe("Phase3 matrix: blocking/notice classification", () => {
  it("blocking fields classified correctly", () => {
    for (const f of ["configVersion", "activationStatus", "preflightPassed", "dryRunPassed", "currentActiveVersion", "auditAction", "rollbackAvailable"]) {
      expect(classifyFieldDrift(f)).toBe("blocking");
    }
  });

  it("notice fields classified correctly", () => {
    for (const f of ["diffSummary", "policySelectionSummary"]) {
      expect(classifyFieldDrift(f)).toBe("notice");
    }
  });
});

// ─── consistency ────────────────────────────────────────────────────────────

describe("Phase3 matrix: consistency validation", () => {
  it("matrix passes consistency check", () => {
    const { matrix } = run();
    const result = assertPhase3PolicyConfigBaselineConsistency(matrix);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });
});

// ─── core fields constant ──────────────────────────────────────────────────

describe("Phase3 matrix: core fields constant", () => {
  it("contains all required fields", () => {
    const required = [
      "configVersion", "activationStatus", "preflightPassed",
      "policySelectionSummary", "dryRunPassed", "auditAction",
      "diffSummary", "currentActiveVersion", "rollbackAvailable"
    ];
    for (const f of required) {
      expect(PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS).toContain(f);
    }
  });
});

// ─── scenario baseline completeness ─────────────────────────────────────────

describe("Phase3 matrix: scenario baseline completeness", () => {
  it("has 5 strategy + 6 config version baselines", () => {
    expect(PHASE3_STRATEGY_SCENARIO_BASELINES.length).toBe(5);
    expect(PHASE3_CONFIG_VERSION_SCENARIO_BASELINES.length).toBe(6);
  });

  it("all strategy baselines have at least 3 expected fields", () => {
    for (const b of PHASE3_STRATEGY_SCENARIO_BASELINES) {
      expect(Object.keys(b.expectedFields).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("all config version baselines have at least 5 expected fields", () => {
    for (const b of PHASE3_CONFIG_VERSION_SCENARIO_BASELINES) {
      expect(Object.keys(b.expectedFields).length).toBeGreaterThanOrEqual(5);
    }
  });
});
