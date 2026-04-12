import { describe, expect, it } from "vitest";
import {
  runPhase4OrchestrationDifferenceMatrix,
  PHASE4_RISK_CASE_SCENARIO_BASELINES,
  PHASE4_LIQUIDATION_CASE_SCENARIO_BASELINES
} from "./orchestration-difference-matrix.js";
import { PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS } from "./orchestration-difference-report.js";
import { assertPhase4OrchestrationBaselineConsistency } from "./orchestration-baseline-consistency.js";

describe("Phase 4 Difference Matrix: full run", () => {
  const { matrix } = runPhase4OrchestrationDifferenceMatrix("p4-test");

  it("has correct total scenarios", () => {
    expect(matrix.totalScenarios).toBe(10);
  });

  it("all 10 scenarios matched", () => {
    expect(matrix.matchedScenarios).toBe(10);
    expect(matrix.mismatchedScenarios).toBe(0);
  });

  it("overallStatus is passed", () => {
    expect(matrix.overallStatus).toBe("passed");
  });

  it("no core field drift", () => {
    expect(matrix.coreFieldDriftSummary).toHaveLength(0);
  });

  it("matrix summary is human-readable", () => {
    expect(matrix.matrixSummary).toContain("10/10");
    expect(matrix.matrixSummary).toContain("passed");
  });
});

describe("Phase 4 Difference Matrix: scenario reports", () => {
  const { matrix } = runPhase4OrchestrationDifferenceMatrix("p4-reports");

  it("has 5 risk case reports", () => {
    expect(matrix.riskCaseScenarioReports).toHaveLength(5);
    for (const r of matrix.riskCaseScenarioReports) {
      expect(r.matched).toBe(true);
    }
  });

  it("has 5 liquidation case reports", () => {
    expect(matrix.liquidationCaseScenarioReports).toHaveLength(5);
    for (const r of matrix.liquidationCaseScenarioReports) {
      expect(r.matched).toBe(true);
    }
  });

  it("R1 scenario matches expected fields", () => {
    const r1 = matrix.riskCaseScenarioReports.find(r => r.scenarioId === "R1")!;
    expect(r1.matched).toBe(true);
    expect(r1.matchedFields).toContain("resultStatus");
    expect(r1.matchedFields).toContain("sagaStatus");
  });

  it("L1 scenario matches expected fields", () => {
    const l1 = matrix.liquidationCaseScenarioReports.find(r => r.scenarioId === "L1")!;
    expect(l1.matched).toBe(true);
    expect(l1.matchedFields).toContain("resultStatus");
  });

  it("R2 replay scenario matches", () => {
    const r2 = matrix.riskCaseScenarioReports.find(r => r.scenarioId === "R2")!;
    expect(r2.matched).toBe(true);
  });

  it("R3 compensation scenario matches", () => {
    const r3 = matrix.riskCaseScenarioReports.find(r => r.scenarioId === "R3")!;
    expect(r3.matched).toBe(true);
  });
});

describe("Phase 4 Acceptance Input Snapshot", () => {
  const { acceptanceInput } = runPhase4OrchestrationDifferenceMatrix("p4-input");

  it("has correct baseline core fields", () => {
    expect(acceptanceInput.baselineCoreFields).toEqual([...PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS]);
  });

  it("has 5 risk case scenario ids", () => {
    expect(acceptanceInput.riskCaseScenarioIds).toHaveLength(5);
    expect(acceptanceInput.riskCaseScenarioIds).toContain("R1");
  });

  it("has 5 liquidation case scenario ids", () => {
    expect(acceptanceInput.liquidationCaseScenarioIds).toHaveLength(5);
    expect(acceptanceInput.liquidationCaseScenarioIds).toContain("L1");
  });

  it("has no blocking issues", () => {
    expect(acceptanceInput.blockingIssues).toHaveLength(0);
  });

  it("has no notices", () => {
    expect(acceptanceInput.nonBlockingNotices).toHaveLength(0);
  });

  it("recommends proceeding to Step 5", () => {
    expect(acceptanceInput.recommendedNextActions.length).toBeGreaterThan(0);
    expect(acceptanceInput.recommendedNextActions[0]).toContain("Step 5");
  });
});

describe("Phase 4 Baseline Consistency", () => {
  it("matrix is internally consistent", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("p4-con");
    const c = assertPhase4OrchestrationBaselineConsistency(matrix);
    expect(c.consistent).toBe(true);
    expect(c.violations).toHaveLength(0);
    expect(c.checkedInvariants).toBe(6);
  });
});

describe("Phase 4 Scenario Baselines: completeness", () => {
  it("risk case baselines cover R1-R5", () => {
    const ids = PHASE4_RISK_CASE_SCENARIO_BASELINES.map(b => b.scenarioId);
    expect(ids).toEqual(["R1", "R2", "R3", "R4", "R5"]);
  });

  it("liquidation case baselines cover L1-L5", () => {
    const ids = PHASE4_LIQUIDATION_CASE_SCENARIO_BASELINES.map(b => b.scenarioId);
    expect(ids).toEqual(["L1", "L2", "L3", "L4", "L5"]);
  });
});
