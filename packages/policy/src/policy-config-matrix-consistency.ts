import type { Phase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import { classifyFieldDrift } from "./policy-config-difference-report.js";

export type Phase3MatrixConsistencyResult = {
  readonly passed: boolean;
  readonly violations: readonly string[];
};

export const assertPhase3PolicyConfigBaselineConsistency = (
  matrix: Phase3PolicyConfigDifferenceMatrix
): Phase3MatrixConsistencyResult => {
  const violations: string[] = [];
  const allReports = [...matrix.strategyScenarioReports, ...matrix.configVersionScenarioReports];

  for (const r of allReports) {
    if (r.matched && r.mismatchedFields.length > 0) {
      violations.push(`${r.scenarioId}: matched=true but has ${r.mismatchedFields.length} mismatched field(s)`);
    }
    if (!r.matched && r.mismatchedFields.length === 0) {
      violations.push(`${r.scenarioId}: matched=false but no mismatched fields`);
    }
  }

  const expectedTotal = matrix.strategyScenarioReports.length + matrix.configVersionScenarioReports.length;
  if (matrix.totalScenarios !== expectedTotal) {
    violations.push(`totalScenarios (${matrix.totalScenarios}) !== report count (${expectedTotal})`);
  }
  if (matrix.matchedScenarios + matrix.mismatchedScenarios !== matrix.totalScenarios) {
    violations.push(`matched + mismatched !== total`);
  }

  for (const snap of matrix.strategySnapshots) {
    if (snap.fields.preflightPassed === "false" && snap.fields.dryRunPassed === "true") {
      violations.push(`${snap.scenarioId}: preflightPassed=false but dryRunPassed=true`);
    }
  }

  for (const snap of matrix.configVersionSnapshots) {
    if (snap.fields.activationStatus === "rejected" && snap.fields.preflightPassed === "true") {
      violations.push(`${snap.scenarioId}: activationStatus=rejected but preflightPassed=true`);
    }
    if (snap.fields.preflightPassed === "false" && snap.fields.activationStatus === "activated") {
      violations.push(`${snap.scenarioId}: preflightPassed=false but activationStatus=activated`);
    }
  }

  const hasBlockingDrift = allReports.some(r =>
    r.mismatchedFields.some(f => classifyFieldDrift(f) === "blocking"));
  if (hasBlockingDrift && matrix.overallStatus !== "failed") {
    violations.push(`Blocking drift exists but overallStatus=${matrix.overallStatus}`);
  }
  if (!hasBlockingDrift && matrix.overallStatus === "failed") {
    violations.push(`No blocking drift but overallStatus=failed`);
  }

  return { passed: violations.length === 0, violations };
};
