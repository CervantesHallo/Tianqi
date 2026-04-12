import { describe, expect, it } from "vitest";
import {
  runPhase5ReplayDifferenceMatrix,
  assertPhase5ReplayBaselineConsistency,
  PHASE5_SINGLE_CASE_SCENARIO_BASELINES,
  PHASE5_BATCH_REPLAY_SCENARIO_BASELINES,
  PHASE5_REPLAY_BASELINE_CORE_FIELDS
} from "./replay-difference-matrix.js";

describe("Phase 5 Replay Matrix: full run", () => {
  const { matrix } = runPhase5ReplayDifferenceMatrix("p5-test");

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

describe("Phase 5 Replay Matrix: scenario reports", () => {
  const { matrix } = runPhase5ReplayDifferenceMatrix("p5-reports");

  it("has 5 single-case reports", () => {
    expect(matrix.singleCaseScenarioReports).toHaveLength(5);
    for (const r of matrix.singleCaseScenarioReports) expect(r.matched).toBe(true);
  });

  it("has 5 batch reports", () => {
    expect(matrix.batchReplayScenarioReports).toHaveLength(5);
    for (const r of matrix.batchReplayScenarioReports) expect(r.matched).toBe(true);
  });

  it("S1 scenario matches expected fields", () => {
    const s1 = matrix.singleCaseScenarioReports.find(r => r.scenarioId === "S1")!;
    expect(s1.matched).toBe(true);
    expect(s1.matchedFields).toContain("reconstructionStatus");
    expect(s1.matchedFields).toContain("finalState");
  });

  it("B1 scenario matches expected fields", () => {
    const b1 = matrix.batchReplayScenarioReports.find(r => r.scenarioId === "B1")!;
    expect(b1.matched).toBe(true);
    expect(b1.matchedFields).toContain("matchedCases");
  });
});

describe("Phase 5 Acceptance Input Snapshot", () => {
  const { acceptanceInput } = runPhase5ReplayDifferenceMatrix("p5-input");

  it("has correct baseline core fields", () => {
    expect(acceptanceInput.baselineCoreFields).toEqual([...PHASE5_REPLAY_BASELINE_CORE_FIELDS]);
  });

  it("has 5 single-case scenario ids", () => {
    expect(acceptanceInput.singleCaseScenarioIds).toHaveLength(5);
    expect(acceptanceInput.singleCaseScenarioIds).toContain("S1");
  });

  it("has 5 batch scenario ids", () => {
    expect(acceptanceInput.batchReplayScenarioIds).toHaveLength(5);
    expect(acceptanceInput.batchReplayScenarioIds).toContain("B1");
  });

  it("has no blocking issues", () => {
    expect(acceptanceInput.blockingIssues).toHaveLength(0);
  });

  it("recommends proceeding to Step 4", () => {
    expect(acceptanceInput.recommendedNextActions[0]).toContain("Step 4");
  });
});

describe("Phase 5 Baseline Consistency", () => {
  it("matrix is internally consistent", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("p5-con");
    const c = assertPhase5ReplayBaselineConsistency(matrix);
    expect(c.consistent).toBe(true);
    expect(c.violations).toHaveLength(0);
    expect(c.checkedInvariants).toBe(6);
  });
});

describe("Phase 5 Scenario Baselines: completeness", () => {
  it("single-case baselines cover S1-S5", () => {
    expect(PHASE5_SINGLE_CASE_SCENARIO_BASELINES.map(b => b.scenarioId)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
  });
  it("batch baselines cover B1-B5", () => {
    expect(PHASE5_BATCH_REPLAY_SCENARIO_BASELINES.map(b => b.scenarioId)).toEqual(["B1", "B2", "B3", "B4", "B5"]);
  });
});
