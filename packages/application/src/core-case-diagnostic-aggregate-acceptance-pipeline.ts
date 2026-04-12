import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import {
  buildPhase2AcceptanceInputSnapshot,
  runPhase2AggregateDifferenceMatrix,
  type Phase2AggregateDifferenceMatrix,
  type Phase2AcceptanceInputSnapshot
} from "./core-case-diagnostic-aggregate-difference-matrix.js";
import {
  runPhase2AcceptanceGate,
  type Phase2AcceptanceGateResult,
  type Phase2AcceptanceGateStatus
} from "./core-case-diagnostic-aggregate-acceptance-gate.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

export type Phase2AcceptancePipelineStatus = "ready" | "ready_with_notices" | "not_ready";

export type Phase2AcceptancePipelineResult = {
  readonly pipelineRunId: string;
  readonly differenceMatrix: Phase2AggregateDifferenceMatrix;
  readonly acceptanceInput: Phase2AcceptanceInputSnapshot;
  readonly acceptanceGate: Phase2AcceptanceGateResult;
  readonly pipelineStatus: Phase2AcceptancePipelineStatus;
  readonly pipelineSummary: string;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

export type Phase2PipelineConsistencyValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
};

const mapGateStatusToPipelineStatus = (
  gateStatus: Phase2AcceptanceGateStatus
): Phase2AcceptancePipelineStatus => {
  switch (gateStatus) {
    case "pass":
      return "ready";
    case "pass_with_notice":
      return "ready_with_notices";
    case "fail":
      return "not_ready";
  }
};

const buildPipelineSummary = (
  matrix: Phase2AggregateDifferenceMatrix,
  gate: Phase2AcceptanceGateResult,
  pipelineStatus: Phase2AcceptancePipelineStatus
): string => {
  const coverage = `${matrix.matchedScenarios}/${matrix.totalScenarios} scenarios, ${matrix.matchedFailureCombinations}/${matrix.totalFailureCombinations} combinations`;
  if (pipelineStatus === "ready") {
    return `Phase 2 Pipeline: READY. ${coverage} matched. ${gate.passedChecks}/${gate.checkResults.length} checks passed. Ready for close.`;
  }
  if (pipelineStatus === "ready_with_notices") {
    return `Phase 2 Pipeline: READY WITH NOTICES. ${coverage}. ${gate.warningChecks} notice(s) to review. Confirm before close.`;
  }
  return `Phase 2 Pipeline: NOT READY. ${coverage}. ${gate.failedChecks} check(s) failed. Resolve before close.`;
};

const deriveRecommendedNextActions = (
  gate: Phase2AcceptanceGateResult,
  pipelineStatus: Phase2AcceptancePipelineStatus
): readonly string[] => {
  if (pipelineStatus === "ready") {
    return ["Proceed to Phase 2 final acceptance (Step 30)"];
  }
  if (pipelineStatus === "ready_with_notices") {
    return [
      "Review all non-blocking notices before final acceptance",
      ...gate.nonBlockingNotices.map((n) => `Review: ${n}`),
      "Proceed to Step 30 after notice review"
    ];
  }
  return [
    "Resolve all blocking issues before Phase 2 can close",
    ...gate.blockingIssues.map((i) => `Fix: ${i}`),
    "Re-run acceptance pipeline after fixes"
  ];
};

export const runPhase2AcceptancePipeline = async (input: {
  readonly pipelineRunId: string;
  readonly scenarioInputProvider: (matrixId: string) => DiagnosticSuccessResult;
  readonly failureCombinationInputProvider: (combinationId: string) => DiagnosticSuccessResult;
  readonly aggregateViewProvider: (result: DiagnosticSuccessResult) => Promise<CoreCaseDiagnosticAggregateView>;
}): Promise<Phase2AcceptancePipelineResult> => {
  const differenceMatrix = await runPhase2AggregateDifferenceMatrix({
    matrixRunId: `${input.pipelineRunId}-matrix`,
    scenarioInputProvider: input.scenarioInputProvider,
    failureCombinationInputProvider: input.failureCombinationInputProvider,
    aggregateViewProvider: input.aggregateViewProvider
  });

  const acceptanceInput = buildPhase2AcceptanceInputSnapshot(differenceMatrix);

  const acceptanceGate = runPhase2AcceptanceGate({
    gateId: `${input.pipelineRunId}-gate`,
    snapshot: acceptanceInput
  });

  const pipelineStatus = mapGateStatusToPipelineStatus(acceptanceGate.gateStatus);
  const pipelineSummary = buildPipelineSummary(differenceMatrix, acceptanceGate, pipelineStatus);
  const recommendedNextActions = deriveRecommendedNextActions(acceptanceGate, pipelineStatus);

  return {
    pipelineRunId: input.pipelineRunId,
    differenceMatrix,
    acceptanceInput,
    acceptanceGate,
    pipelineStatus,
    pipelineSummary,
    blockingIssues: [...acceptanceGate.blockingIssues],
    nonBlockingNotices: [...acceptanceGate.nonBlockingNotices],
    recommendedNextActions
  };
};

export const validatePhase2AcceptancePipelineConsistency = (
  result: Phase2AcceptancePipelineResult
): Phase2PipelineConsistencyValidationResult => {
  const issues: string[] = [];

  if (result.differenceMatrix.overallStatus === "passed" && result.acceptanceGate.gateStatus === "fail") {
    issues.push("Matrix passed but gate failed — inconsistent");
  }
  if (result.differenceMatrix.overallStatus === "failed" && result.acceptanceGate.gateStatus === "pass") {
    issues.push("Matrix failed but gate passed — inconsistent");
  }

  if (result.acceptanceInput.blockingIssues.length > 0 && result.acceptanceGate.failedChecks === 0) {
    issues.push("Acceptance input has blocking issues but gate has no failed checks");
  }

  const expectedStatus = mapGateStatusToPipelineStatus(result.acceptanceGate.gateStatus);
  if (result.pipelineStatus !== expectedStatus) {
    issues.push(`Pipeline status '${result.pipelineStatus}' mismatches expected '${expectedStatus}'`);
  }

  if (result.blockingIssues.length !== result.acceptanceGate.blockingIssues.length) {
    issues.push("Pipeline blocking issues count differs from gate");
  }
  if (result.nonBlockingNotices.length !== result.acceptanceGate.nonBlockingNotices.length) {
    issues.push("Pipeline notices count differs from gate");
  }

  return { valid: issues.length === 0, issues };
};
