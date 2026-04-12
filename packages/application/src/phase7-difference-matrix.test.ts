import { describe, expect, it } from "vitest";
import {
  runPhase7DifferenceMatrix, assertPhase7BaselineConsistency,
  PHASE7_PREFLIGHT_BASELINES, PHASE7_ROLLBACK_RUNBOOK_BASELINES, PHASE7_BASELINE_CORE_FIELDS
} from "./phase7-difference-matrix.js";

describe("Phase 7 Difference Matrix: full run", () => {
  const { matrix } = runPhase7DifferenceMatrix("p7-test");

  it("has correct total scenarios", () => { expect(matrix.totalScenarios).toBe(10); });
  it("all 10 scenarios matched", () => { expect(matrix.matchedScenarios).toBe(10); expect(matrix.mismatchedScenarios).toBe(0); });
  it("overallStatus is passed", () => { expect(matrix.overallStatus).toBe("passed"); });
  it("no core field drift", () => { expect(matrix.coreFieldDriftSummary).toHaveLength(0); });
  it("summary is human-readable", () => { expect(matrix.matrixSummary).toContain("10/10"); expect(matrix.matrixSummary).toContain("passed"); });
});

describe("Phase 7 Difference Matrix: scenario reports", () => {
  const { matrix } = runPhase7DifferenceMatrix("p7-reports");

  it("has 5 preflight reports", () => { expect(matrix.preflightScenarioReports).toHaveLength(5); for (const r of matrix.preflightScenarioReports) expect(r.matched).toBe(true); });
  it("has 5 rollback/runbook reports", () => { expect(matrix.rollbackRunbookScenarioReports).toHaveLength(5); for (const r of matrix.rollbackRunbookScenarioReports) expect(r.matched).toBe(true); });

  it("P1 clean preflight matches", () => { const p1 = matrix.preflightScenarioReports.find(r => r.scenarioId === "P1")!; expect(p1.matched).toBe(true); expect(p1.matchedFields).toContain("preflightStatus"); });
  it("P4 contract blocked matches", () => { expect(matrix.preflightScenarioReports.find(r => r.scenarioId === "P4")!.matched).toBe(true); });
  it("R1 valid rollback/runbook matches", () => { const r1 = matrix.rollbackRunbookScenarioReports.find(r => r.scenarioId === "R1")!; expect(r1.matched).toBe(true); expect(r1.matchedFields).toContain("rollbackPlanStatus"); });
  it("R3 invalid target matches", () => { expect(matrix.rollbackRunbookScenarioReports.find(r => r.scenarioId === "R3")!.matched).toBe(true); });
  it("R5 escalation missing matches", () => { expect(matrix.rollbackRunbookScenarioReports.find(r => r.scenarioId === "R5")!.matched).toBe(true); });
});

describe("Phase 7 Acceptance Input Snapshot", () => {
  const { acceptanceInput } = runPhase7DifferenceMatrix("p7-input");

  it("has correct baseline core fields", () => { expect(acceptanceInput.baselineCoreFields).toEqual([...PHASE7_BASELINE_CORE_FIELDS]); });
  it("has 5 preflight scenario ids", () => { expect(acceptanceInput.preflightScenarioIds).toHaveLength(5); expect(acceptanceInput.preflightScenarioIds).toContain("P1"); });
  it("has 5 rollback/runbook scenario ids", () => { expect(acceptanceInput.rollbackRunbookScenarioIds).toHaveLength(5); expect(acceptanceInput.rollbackRunbookScenarioIds).toContain("R1"); });
  it("has no blocking issues", () => { expect(acceptanceInput.blockingIssues).toHaveLength(0); });
  it("recommends proceeding to Step 4", () => { expect(acceptanceInput.recommendedNextActions[0]).toContain("Step 4"); });
});

describe("Phase 7 Baseline Consistency", () => {
  it("matrix is internally consistent", () => {
    const { matrix } = runPhase7DifferenceMatrix("p7-con");
    const c = assertPhase7BaselineConsistency(matrix);
    expect(c.consistent).toBe(true);
    expect(c.violations).toHaveLength(0);
    expect(c.checkedInvariants).toBe(6);
  });
});

describe("Phase 7 Scenario Baselines: completeness", () => {
  it("preflight baselines cover P1-P5", () => { expect(PHASE7_PREFLIGHT_BASELINES.map(b => b.scenarioId)).toEqual(["P1", "P2", "P3", "P4", "P5"]); });
  it("rollback/runbook baselines cover R1-R5", () => { expect(PHASE7_ROLLBACK_RUNBOOK_BASELINES.map(b => b.scenarioId)).toEqual(["R1", "R2", "R3", "R4", "R5"]); });
});
