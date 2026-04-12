import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import {
  runPhase2AcceptancePipeline,
  type Phase2AcceptancePipelineResult
} from "./core-case-diagnostic-aggregate-acceptance-pipeline.js";

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

export type Phase2FinalAcceptanceStatus = "ready_to_close" | "ready_with_notices" | "not_ready_to_close";

export type Phase2PreCloseChecklistItem = {
  readonly checkId: string;
  readonly passed: boolean;
  readonly reason: string;
};

export type Phase2PreCloseChecklist = {
  readonly matrixCompleted: Phase2PreCloseChecklistItem;
  readonly acceptanceInputBuilt: Phase2PreCloseChecklistItem;
  readonly gateEvaluated: Phase2PreCloseChecklistItem;
  readonly highRiskBoundaryCoveredRound1: Phase2PreCloseChecklistItem;
  readonly highRiskBoundaryCoveredRound2: Phase2PreCloseChecklistItem;
  readonly blockingIssuesResolvedOrAcknowledged: Phase2PreCloseChecklistItem;
};

export type Phase2FinalAcceptanceResult = {
  readonly finalAcceptanceRunId: string;
  readonly pipeline: Phase2AcceptancePipelineResult;
  readonly finalAcceptanceStatus: Phase2FinalAcceptanceStatus;
  readonly finalAcceptanceSummary: string;
  readonly finalBlockingIssues: readonly string[];
  readonly finalNotices: readonly string[];
  readonly preCloseChecklistStatus: Phase2PreCloseChecklist;
};

export type Phase2FinalAcceptanceConsistencyResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
};

const EXPECTED_MIN_SCENARIOS = 12;
const EXPECTED_MIN_COMBINATIONS = 3;
const EXPECTED_MIN_GATE_CHECKS = 8;

const allPreCloseChecksPassed = (checklist: Phase2PreCloseChecklist): boolean =>
  checklist.matrixCompleted.passed &&
  checklist.acceptanceInputBuilt.passed &&
  checklist.gateEvaluated.passed &&
  checklist.highRiskBoundaryCoveredRound1.passed &&
  checklist.highRiskBoundaryCoveredRound2.passed &&
  checklist.blockingIssuesResolvedOrAcknowledged.passed;

const buildPreCloseChecklist = (
  pipeline: Phase2AcceptancePipelineResult,
  boundaryRound1Covered: boolean,
  boundaryRound2Covered: boolean
): Phase2PreCloseChecklist => {
  const matrixOk =
    pipeline.differenceMatrix.totalScenarios >= EXPECTED_MIN_SCENARIOS &&
    pipeline.differenceMatrix.totalFailureCombinations >= EXPECTED_MIN_COMBINATIONS;
  const inputOk = pipeline.acceptanceInput.scenarioMatrixIds.length > 0;
  const gateOk = pipeline.acceptanceGate.checkResults.length >= EXPECTED_MIN_GATE_CHECKS;
  const noBlocking = pipeline.blockingIssues.length === 0;

  return {
    matrixCompleted: {
      checkId: "matrixCompleted",
      passed: matrixOk,
      reason: matrixOk
        ? `${pipeline.differenceMatrix.totalScenarios} scenarios, ${pipeline.differenceMatrix.totalFailureCombinations} combinations`
        : "Matrix coverage insufficient"
    },
    acceptanceInputBuilt: {
      checkId: "acceptanceInputBuilt",
      passed: inputOk,
      reason: inputOk ? "Acceptance input generated" : "Acceptance input missing"
    },
    gateEvaluated: {
      checkId: "gateEvaluated",
      passed: gateOk,
      reason: gateOk ? `${pipeline.acceptanceGate.checkResults.length} checks evaluated` : "Gate not fully evaluated"
    },
    highRiskBoundaryCoveredRound1: {
      checkId: "highRiskBoundaryCoveredRound1",
      passed: boundaryRound1Covered,
      reason: boundaryRound1Covered ? "Round 1 boundary scenarios covered" : "Round 1 boundary scenarios pending"
    },
    highRiskBoundaryCoveredRound2: {
      checkId: "highRiskBoundaryCoveredRound2",
      passed: boundaryRound2Covered,
      reason: boundaryRound2Covered ? "Round 2 boundary scenarios covered" : "Round 2 boundary scenarios pending"
    },
    blockingIssuesResolvedOrAcknowledged: {
      checkId: "blockingIssuesResolvedOrAcknowledged",
      passed: noBlocking,
      reason: noBlocking ? "No blocking issues" : `${pipeline.blockingIssues.length} blocking issue(s) unresolved`
    }
  };
};

const determineFinalAcceptanceStatus = (
  pipeline: Phase2AcceptancePipelineResult,
  checklist: Phase2PreCloseChecklist
): Phase2FinalAcceptanceStatus => {
  if (pipeline.pipelineStatus === "not_ready" || !allPreCloseChecksPassed(checklist)) {
    return "not_ready_to_close";
  }
  if (pipeline.pipelineStatus === "ready_with_notices") {
    return "ready_with_notices";
  }
  return "ready_to_close";
};

const buildFinalAcceptanceSummary = (
  status: Phase2FinalAcceptanceStatus,
  pipeline: Phase2AcceptancePipelineResult,
  checklist: Phase2PreCloseChecklist
): string => {
  const checklistItems = [
    checklist.matrixCompleted,
    checklist.acceptanceInputBuilt,
    checklist.gateEvaluated,
    checklist.highRiskBoundaryCoveredRound1,
    checklist.highRiskBoundaryCoveredRound2,
    checklist.blockingIssuesResolvedOrAcknowledged
  ];
  const passedCount = checklistItems.filter((c) => c.passed).length;
  const totalCount = checklistItems.length;

  if (status === "ready_to_close") {
    return `Phase 2 Final Acceptance: READY TO CLOSE. Pipeline ready, ${passedCount}/${totalCount} pre-close checks passed. Proceed to Step 30 封板.`;
  }
  if (status === "ready_with_notices") {
    return (
      `Phase 2 Final Acceptance: READY WITH NOTICES. Pipeline has notices, ${passedCount}/${totalCount} pre-close checks passed. ` +
      `Review ${pipeline.nonBlockingNotices.length} notice(s) before close.`
    );
  }
  const failedItems = checklistItems.filter((c) => !c.passed).map((c) => c.checkId);
  return (
    `Phase 2 Final Acceptance: NOT READY TO CLOSE. ` +
    `Pipeline: ${pipeline.pipelineStatus}. Pre-close: ${passedCount}/${totalCount} passed. ` +
    `Failing: ${failedItems.join(", ")}. Resolve before Step 30.`
  );
};

export const runPhase2FinalAcceptance = async (input: {
  readonly finalAcceptanceRunId: string;
  readonly scenarioInputProvider: (matrixId: string) => DiagnosticSuccessResult;
  readonly failureCombinationInputProvider: (combinationId: string) => DiagnosticSuccessResult;
  readonly aggregateViewProvider: (result: DiagnosticSuccessResult) => Promise<CoreCaseDiagnosticAggregateView>;
  readonly boundaryRound1Covered: boolean;
  readonly boundaryRound2Covered: boolean;
}): Promise<Phase2FinalAcceptanceResult> => {
  const pipeline = await runPhase2AcceptancePipeline({
    pipelineRunId: `${input.finalAcceptanceRunId}-pipeline`,
    scenarioInputProvider: input.scenarioInputProvider,
    failureCombinationInputProvider: input.failureCombinationInputProvider,
    aggregateViewProvider: input.aggregateViewProvider
  });

  const preCloseChecklistStatus = buildPreCloseChecklist(
    pipeline,
    input.boundaryRound1Covered,
    input.boundaryRound2Covered
  );

  const finalAcceptanceStatus = determineFinalAcceptanceStatus(pipeline, preCloseChecklistStatus);
  const finalAcceptanceSummary = buildFinalAcceptanceSummary(
    finalAcceptanceStatus,
    pipeline,
    preCloseChecklistStatus
  );

  return {
    finalAcceptanceRunId: input.finalAcceptanceRunId,
    pipeline,
    finalAcceptanceStatus,
    finalAcceptanceSummary,
    finalBlockingIssues: [...pipeline.blockingIssues],
    finalNotices: [...pipeline.nonBlockingNotices],
    preCloseChecklistStatus
  };
};

export const validatePhase2FinalAcceptanceConsistency = (
  result: Phase2FinalAcceptanceResult
): Phase2FinalAcceptanceConsistencyResult => {
  const issues: string[] = [];

  if (result.pipeline.pipelineStatus === "not_ready" && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Pipeline not ready but final acceptance is ready_to_close");
  }
  if (result.pipeline.acceptanceGate.gateStatus === "fail" && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Gate failed but final acceptance is ready_to_close");
  }
  if (result.finalBlockingIssues.length > 0 && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Final blocking issues exist but status is ready_to_close");
  }
  if (!allPreCloseChecksPassed(result.preCloseChecklistStatus) && result.finalAcceptanceStatus === "ready_to_close") {
    issues.push("Pre-close checklist has failing items but final acceptance is ready_to_close");
  }
  if (result.pipeline.pipelineStatus === "ready" && allPreCloseChecksPassed(result.preCloseChecklistStatus) && result.finalAcceptanceStatus === "not_ready_to_close") {
    issues.push("Pipeline ready and all pre-close checks passed but final acceptance is not_ready_to_close");
  }

  return { valid: issues.length === 0, issues };
};
