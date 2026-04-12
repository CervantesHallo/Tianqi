import { describe, expect, it } from "vitest";
import {
  runPhase6DifferenceMatrix,
  assertPhase6BaselineConsistency,
  PHASE6_OBSERVABILITY_BASELINES,
  PHASE6_FAULT_DRILL_BASELINES,
  PHASE6_BASELINE_CORE_FIELDS
} from "./phase6-difference-matrix.js";

describe("Phase 6 Difference Matrix: full run", () => {
  const { matrix } = runPhase6DifferenceMatrix("p6-test");

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

describe("Phase 6 Difference Matrix: scenario reports", () => {
  const { matrix } = runPhase6DifferenceMatrix("p6-reports");

  it("has 5 observability reports", () => {
    expect(matrix.observabilityScenarioReports).toHaveLength(5);
    for (const r of matrix.observabilityScenarioReports) expect(r.matched).toBe(true);
  });

  it("has 5 fault drill reports", () => {
    expect(matrix.faultDrillScenarioReports).toHaveLength(5);
    for (const r of matrix.faultDrillScenarioReports) expect(r.matched).toBe(true);
  });

  it("T1 trace propagation matches", () => {
    const t1 = matrix.observabilityScenarioReports.find(r => r.scenarioId === "T1")!;
    expect(t1.matched).toBe(true);
    expect(t1.matchedFields).toContain("tracePropagationStatus");
  });

  it("F1 orchestration timeout matches", () => {
    const f1 = matrix.faultDrillScenarioReports.find(r => r.scenarioId === "F1")!;
    expect(f1.matched).toBe(true);
    expect(f1.matchedFields).toContain("drillStatus");
  });
});

describe("Phase 6 Acceptance Input Snapshot", () => {
  const { acceptanceInput } = runPhase6DifferenceMatrix("p6-input");

  it("has correct baseline core fields", () => {
    expect(acceptanceInput.baselineCoreFields).toEqual([...PHASE6_BASELINE_CORE_FIELDS]);
  });

  it("has 5 observability scenario ids", () => {
    expect(acceptanceInput.observabilityScenarioIds).toHaveLength(5);
    expect(acceptanceInput.observabilityScenarioIds).toContain("T1");
  });

  it("has 5 fault drill scenario ids", () => {
    expect(acceptanceInput.faultDrillScenarioIds).toHaveLength(5);
    expect(acceptanceInput.faultDrillScenarioIds).toContain("F1");
  });

  it("has no blocking issues", () => {
    expect(acceptanceInput.blockingIssues).toHaveLength(0);
  });

  it("recommends proceeding to Step 4", () => {
    expect(acceptanceInput.recommendedNextActions[0]).toContain("Step 4");
  });
});

describe("Phase 6 Baseline Consistency", () => {
  it("matrix is internally consistent", () => {
    const { matrix } = runPhase6DifferenceMatrix("p6-con");
    const c = assertPhase6BaselineConsistency(matrix);
    expect(c.consistent).toBe(true);
    expect(c.violations).toHaveLength(0);
    expect(c.checkedInvariants).toBe(6);
  });
});

describe("Phase 6 Scenario Baselines: completeness", () => {
  it("observability baselines cover T1-T5", () => {
    expect(PHASE6_OBSERVABILITY_BASELINES.map(b => b.scenarioId)).toEqual(["T1", "T2", "T3", "T4", "T5"]);
  });
  it("fault drill baselines cover F1-F5", () => {
    expect(PHASE6_FAULT_DRILL_BASELINES.map(b => b.scenarioId)).toEqual(["F1", "F2", "F3", "F4", "F5"]);
  });
});
