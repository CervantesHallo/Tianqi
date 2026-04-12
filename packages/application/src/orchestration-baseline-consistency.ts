import type { Phase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";

export type Phase4OrchestrationBaselineConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const assertPhase4OrchestrationBaselineConsistency = (
  matrix: Phase4OrchestrationDifferenceMatrix
): Phase4OrchestrationBaselineConsistencyResult => {
  const violations: string[] = [];
  const allReports = [...matrix.riskCaseScenarioReports, ...matrix.liquidationCaseScenarioReports];

  if (matrix.totalScenarios !== allReports.length) {
    violations.push(`totalScenarios ${matrix.totalScenarios} != report count ${allReports.length}`);
  }

  if (matrix.matchedScenarios + matrix.mismatchedScenarios !== matrix.totalScenarios) {
    violations.push("matched + mismatched != total");
  }

  const actualMatched = allReports.filter(r => r.matched).length;
  if (actualMatched !== matrix.matchedScenarios) {
    violations.push(`matchedScenarios ${matrix.matchedScenarios} != actual ${actualMatched}`);
  }

  for (const r of allReports) {
    if (r.matched && r.mismatchedFields.length > 0) {
      violations.push(`${r.scenarioId}: marked matched but has mismatchedFields`);
    }
    if (!r.matched && r.mismatchedFields.length === 0) {
      violations.push(`${r.scenarioId}: marked not-matched but no mismatchedFields`);
    }
  }

  if (matrix.overallStatus === "passed" && matrix.mismatchedScenarios > 0) {
    violations.push("overallStatus passed but has mismatched scenarios");
  }

  const rcIds = new Set(matrix.riskCaseScenarioReports.map(r => r.scenarioId));
  const lcIds = new Set(matrix.liquidationCaseScenarioReports.map(r => r.scenarioId));
  if (rcIds.size < 5) violations.push(`risk case scenarios < 5: ${rcIds.size}`);
  if (lcIds.size < 5) violations.push(`liquidation case scenarios < 5: ${lcIds.size}`);

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};
