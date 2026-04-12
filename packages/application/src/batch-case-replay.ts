import type { Result } from "@tianqi/shared";
import { ok } from "@tianqi/shared";

import type { AuditEventStorePort } from "./audit-event-store.js";
import type { CaseReplayResult } from "./case-replay-result.js";
import type { CaseReplayError } from "./case-replay-handler.js";
import { runCaseReplay } from "./case-replay-handler.js";

// ─── command ────────────────────────────────────────────────────────────────

export type BatchReplayExpectation = {
  readonly caseId: string;
  readonly expectedFinalState: string;
};

export type RunBatchCaseReplayCommand = {
  readonly batchReplayId: string;
  readonly caseIds: readonly string[];
  readonly expectations: readonly BatchReplayExpectation[];
  readonly replayReason: string;
  readonly traceId: string;
  readonly replayRequestedAt: string;
};

// ─── comparison ─────────────────────────────────────────────────────────────

export type CaseReconstructionComparisonStatus = "matched" | "mismatched" | "incomplete" | "failed";

export type CaseReconstructionComparison = {
  readonly caseId: string;
  readonly hasDifference: boolean;
  readonly expectedFinalState: string | null;
  readonly actualFinalState: string;
  readonly differenceSummary: string;
  readonly comparisonStatus: CaseReconstructionComparisonStatus;
};

// ─── batch result ───────────────────────────────────────────────────────────

export type BatchCaseReplayResult = {
  readonly batchReplayId: string;
  readonly requestedCaseIds: readonly string[];
  readonly completedCaseIds: readonly string[];
  readonly failedCaseIds: readonly string[];
  readonly totalCases: number;
  readonly successfulCases: number;
  readonly failedCases: number;
  readonly caseResults: readonly BatchCaseReplayEntry[];
  readonly summary: string;
};

export type BatchCaseReplayEntry = {
  readonly caseId: string;
  readonly replayResult: CaseReplayResult | null;
  readonly replayError: CaseReplayError | null;
  readonly comparison: CaseReconstructionComparison | null;
};

// ─── baseline snapshot ──────────────────────────────────────────────────────

export type ReplayBaselineOverallStatus = "passed" | "passed_with_notice" | "failed";

export type ReplayBaselineSnapshot = {
  readonly snapshotId: string;
  readonly caseCount: number;
  readonly matchedCases: number;
  readonly mismatchedCases: number;
  readonly incompleteCases: number;
  readonly failedCases: number;
  readonly comparisonResults: readonly CaseReconstructionComparison[];
  readonly overallStatus: ReplayBaselineOverallStatus;
  readonly snapshotSummary: string;
};

// ─── comparison builder ─────────────────────────────────────────────────────

const buildComparison = (
  caseId: string,
  replayResult: CaseReplayResult | null,
  expectation: BatchReplayExpectation | undefined
): CaseReconstructionComparison => {
  if (!replayResult) {
    return { caseId, hasDifference: true, expectedFinalState: expectation?.expectedFinalState ?? null, actualFinalState: "replay_failed", differenceSummary: "Replay failed, no reconstruction result", comparisonStatus: "failed" };
  }
  if (replayResult.reconstructionStatus === "incomplete") {
    return { caseId, hasDifference: true, expectedFinalState: expectation?.expectedFinalState ?? null, actualFinalState: replayResult.finalState, differenceSummary: "Reconstruction incomplete", comparisonStatus: "incomplete" };
  }
  if (!expectation) {
    return { caseId, hasDifference: false, expectedFinalState: null, actualFinalState: replayResult.finalState, differenceSummary: "No expectation provided, replay succeeded", comparisonStatus: "matched" };
  }
  const matched = replayResult.finalState === expectation.expectedFinalState;
  return {
    caseId,
    hasDifference: !matched,
    expectedFinalState: expectation.expectedFinalState,
    actualFinalState: replayResult.finalState,
    differenceSummary: matched
      ? "Final state matches expectation"
      : `Expected ${expectation.expectedFinalState}, actual ${replayResult.finalState}`,
    comparisonStatus: matched ? "matched" : "mismatched"
  };
};

// ─── batch runner ───────────────────────────────────────────────────────────

export const runBatchCaseReplay = (
  command: RunBatchCaseReplayCommand,
  store: AuditEventStorePort
): Result<BatchCaseReplayResult, never> => {
  const expectationMap = new Map(command.expectations.map(e => [e.caseId, e]));
  const entries: BatchCaseReplayEntry[] = [];
  const completedIds: string[] = [];
  const failedIds: string[] = [];

  for (const caseId of command.caseIds) {
    const replayResult = runCaseReplay(
      { caseId, replayReason: command.replayReason, traceId: command.traceId, replayRequestedAt: command.replayRequestedAt },
      store
    );

    if (replayResult.ok) {
      completedIds.push(caseId);
      entries.push({
        caseId,
        replayResult: replayResult.value,
        replayError: null,
        comparison: buildComparison(caseId, replayResult.value, expectationMap.get(caseId))
      });
    } else {
      failedIds.push(caseId);
      entries.push({
        caseId,
        replayResult: null,
        replayError: replayResult.error,
        comparison: buildComparison(caseId, null, expectationMap.get(caseId))
      });
    }
  }

  return ok({
    batchReplayId: command.batchReplayId,
    requestedCaseIds: command.caseIds,
    completedCaseIds: completedIds,
    failedCaseIds: failedIds,
    totalCases: command.caseIds.length,
    successfulCases: completedIds.length,
    failedCases: failedIds.length,
    caseResults: entries,
    summary: `Batch replay [${command.batchReplayId}]: ${completedIds.length}/${command.caseIds.length} succeeded, ${failedIds.length} failed`
  });
};

// ─── baseline snapshot builder ──────────────────────────────────────────────

export const buildReplayBaselineSnapshot = (
  snapshotId: string,
  batchResult: BatchCaseReplayResult
): ReplayBaselineSnapshot => {
  const comparisons = batchResult.caseResults
    .map(e => e.comparison)
    .filter((c): c is CaseReconstructionComparison => c != null);

  const matchedCases = comparisons.filter(c => c.comparisonStatus === "matched").length;
  const mismatchedCases = comparisons.filter(c => c.comparisonStatus === "mismatched").length;
  const incompleteCases = comparisons.filter(c => c.comparisonStatus === "incomplete").length;
  const failedCases = comparisons.filter(c => c.comparisonStatus === "failed").length;

  const overallStatus: ReplayBaselineOverallStatus =
    (mismatchedCases > 0 || failedCases > 0) ? "failed"
    : incompleteCases > 0 ? "passed_with_notice"
    : "passed";

  return {
    snapshotId,
    caseCount: comparisons.length,
    matchedCases, mismatchedCases, incompleteCases, failedCases,
    comparisonResults: comparisons,
    overallStatus,
    snapshotSummary: `Replay baseline [${snapshotId}]: ${matchedCases} matched, ${mismatchedCases} mismatched, ${incompleteCases} incomplete, ${failedCases} failed, status=${overallStatus}`
  };
};

// ─── batch consistency helper ───────────────────────────────────────────────

export type BatchReplayConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const assertBatchReplayConsistency = (
  batch: BatchCaseReplayResult,
  snapshot: ReplayBaselineSnapshot
): BatchReplayConsistencyResult => {
  const violations: string[] = [];

  if (batch.totalCases !== batch.successfulCases + batch.failedCases) {
    violations.push(`total ${batch.totalCases} != successful ${batch.successfulCases} + failed ${batch.failedCases}`);
  }

  const failedSet = new Set(batch.failedCaseIds);
  for (const id of batch.completedCaseIds) {
    if (failedSet.has(id)) violations.push(`caseId ${id} in both completed and failed`);
  }

  if (snapshot.caseCount !== snapshot.matchedCases + snapshot.mismatchedCases + snapshot.incompleteCases + snapshot.failedCases) {
    violations.push("snapshot counts don't sum to caseCount");
  }

  for (const c of snapshot.comparisonResults) {
    if (c.comparisonStatus === "matched" && c.hasDifference) {
      violations.push(`${c.caseId}: matched but hasDifference=true`);
    }
    if (c.comparisonStatus === "mismatched" && !c.hasDifference) {
      violations.push(`${c.caseId}: mismatched but hasDifference=false`);
    }
  }

  if (snapshot.overallStatus === "passed" && (snapshot.mismatchedCases > 0 || snapshot.failedCases > 0)) {
    violations.push("snapshot passed but has mismatched or failed cases");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};
