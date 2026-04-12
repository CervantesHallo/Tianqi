import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import type { AuditEventStorePort } from "./audit-event-store.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import { runCaseReplay } from "./case-replay-handler.js";
import {
  runBatchCaseReplay,
  buildReplayBaselineSnapshot
} from "./batch-case-replay.js";

// ─── core fields ────────────────────────────────────────────────────────────

export const PHASE5_REPLAY_BASELINE_CORE_FIELDS = [
  "reconstructionStatus",
  "finalState",
  "eventCount",
  "comparisonStatus",
  "hasDifference",
  "matchedCases",
  "mismatchedCases",
  "incompleteCases",
  "failedCases"
] as const;

export type Phase5ReplayCoreField = (typeof PHASE5_REPLAY_BASELINE_CORE_FIELDS)[number];

export const PHASE5_BLOCKING_DRIFT_FIELDS = new Set<string>([
  "reconstructionStatus", "finalState", "comparisonStatus",
  "hasDifference", "failedCases", "incompleteCases"
]);

export const PHASE5_NOTICE_DRIFT_FIELDS = new Set<string>([
  "eventCount", "matchedCases", "mismatchedCases"
]);

// ─── scenario baseline ─────────────────────────────────────────────────────

export type Phase5ScenarioExpectedBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioGroup: "single_case" | "batch_replay";
  readonly expectedFields: Record<string, string>;
};

export type Phase5ScenarioFieldSnapshot = {
  readonly scenarioId: string;
  readonly scenarioGroup: "single_case" | "batch_replay";
  readonly fields: Record<string, string>;
};

// ─── difference report ──────────────────────────────────────────────────────

export type Phase5ReplayDifferenceReport = {
  readonly reportId: string;
  readonly scenarioId: string;
  readonly matched: boolean;
  readonly matchedFields: readonly string[];
  readonly mismatchedFields: readonly string[];
  readonly differenceSummaries: readonly string[];
  readonly consistencyStatus: "consistent" | "drifted";
  readonly reportSummary: string;
};

export const classifyReplayFieldDrift = (field: string): "blocking" | "notice" =>
  PHASE5_BLOCKING_DRIFT_FIELDS.has(field) ? "blocking" : "notice";

const buildReport = (
  reportId: string,
  baseline: Phase5ScenarioExpectedBaseline,
  snapshot: Phase5ScenarioFieldSnapshot
): Phase5ReplayDifferenceReport => {
  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const differenceSummaries: string[] = [];

  for (const field of PHASE5_REPLAY_BASELINE_CORE_FIELDS) {
    const expected = baseline.expectedFields[field];
    if (expected === undefined) continue;
    const actual = snapshot.fields[field];
    if (actual === expected) matchedFields.push(field);
    else { mismatchedFields.push(field); differenceSummaries.push(`${field}: expected=${expected}, actual=${actual ?? "undefined"}`); }
  }

  const matched = mismatchedFields.length === 0;
  return {
    reportId, scenarioId: baseline.scenarioId, matched, matchedFields, mismatchedFields, differenceSummaries,
    consistencyStatus: matched ? "consistent" : "drifted",
    reportSummary: matched ? `${baseline.scenarioId}: all fields matched` : `${baseline.scenarioId}: ${mismatchedFields.length} field(s) drifted`
  };
};

// ─── scenario baselines ─────────────────────────────────────────────────────

export const PHASE5_SINGLE_CASE_SCENARIO_BASELINES: readonly Phase5ScenarioExpectedBaseline[] = [
  { scenarioId: "S1", scenarioName: "complete_event_stream_replay_success", scenarioGroup: "single_case", expectedFields: { reconstructionStatus: "succeeded", finalState: "orchestration_completed", eventCount: "3" } },
  { scenarioId: "S2", scenarioName: "missing_started_event_incomplete", scenarioGroup: "single_case", expectedFields: { reconstructionStatus: "error", finalState: "error" } },
  { scenarioId: "S3", scenarioName: "no_events_for_case_failed", scenarioGroup: "single_case", expectedFields: { reconstructionStatus: "error", finalState: "error" } },
  { scenarioId: "S4", scenarioName: "event_version_missing_failed", scenarioGroup: "single_case", expectedFields: { reconstructionStatus: "error", finalState: "error" } },
  { scenarioId: "S5", scenarioName: "final_state_matches_expectation", scenarioGroup: "single_case", expectedFields: { reconstructionStatus: "succeeded", finalState: "orchestration_completed" } }
];

export const PHASE5_BATCH_REPLAY_SCENARIO_BASELINES: readonly Phase5ScenarioExpectedBaseline[] = [
  { scenarioId: "B1", scenarioName: "all_cases_matched", scenarioGroup: "batch_replay", expectedFields: { matchedCases: "2", mismatchedCases: "0", failedCases: "0", incompleteCases: "0" } },
  { scenarioId: "B2", scenarioName: "one_mismatch_others_success", scenarioGroup: "batch_replay", expectedFields: { matchedCases: "1", mismatchedCases: "1", failedCases: "0" } },
  { scenarioId: "B3", scenarioName: "one_incomplete_others_success", scenarioGroup: "batch_replay", expectedFields: { matchedCases: "1", incompleteCases: "1", failedCases: "0" } },
  { scenarioId: "B4", scenarioName: "one_failed_batch_continues", scenarioGroup: "batch_replay", expectedFields: { matchedCases: "1", failedCases: "1" } },
  { scenarioId: "B5", scenarioName: "empty_batch_zero_cases", scenarioGroup: "batch_replay", expectedFields: { matchedCases: "0", failedCases: "0" } }
];

// ─── matrix + acceptance types ──────────────────────────────────────────────

export type Phase5MatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase5ReplayDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly singleCaseScenarioReports: readonly Phase5ReplayDifferenceReport[];
  readonly batchReplayScenarioReports: readonly Phase5ReplayDifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly coreFieldDriftSummary: readonly string[];
  readonly overallStatus: Phase5MatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase5ReplayAcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly string[];
  readonly singleCaseScenarioIds: readonly string[];
  readonly batchReplayScenarioIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase5MatrixOverallStatus;
  readonly keyDriftFindings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

// ─── helpers ────────────────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";

const seedCompleteCase = (store: AuditEventStorePort, caseId: string): void => {
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", `orch-${caseId}`, caseId, T, {}));
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", `orch-${caseId}`, caseId, T, { step: "load" }));
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", `orch-${caseId}`, caseId, T, {}));
};

const seedIncompleteCase = (store: AuditEventStorePort, caseId: string): void => {
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", `orch-${caseId}`, caseId, T, {}));
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", `orch-${caseId}`, caseId, T, { step: "load" }));
};

const captureSingleReplay = (
  id: string, store: AuditEventStorePort, caseId: string
): Phase5ScenarioFieldSnapshot => {
  const r = runCaseReplay({ caseId, replayReason: "matrix", traceId: id, replayRequestedAt: T }, store);
  if (!r.ok) return { scenarioId: id, scenarioGroup: "single_case", fields: { reconstructionStatus: "error", finalState: "error", eventCount: "0" } };
  return {
    scenarioId: id, scenarioGroup: "single_case",
    fields: { reconstructionStatus: r.value.reconstructionStatus, finalState: r.value.finalState, eventCount: String(r.value.eventCount) }
  };
};

// ─── scenario executors ─────────────────────────────────────────────────────

const execSingleCaseScenarios = (_runId: string): Phase5ScenarioFieldSnapshot[] => {
  const snaps: Phase5ScenarioFieldSnapshot[] = [];

  // S1: complete event stream
  (() => { const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "s1-case"); snaps.push(captureSingleReplay("S1", s, "s1-case")); })();

  // S2: missing started event (only step completed → consistency fail)
  (() => {
    const s = createInMemoryAuditEventStore();
    s.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-s2", "s2-case", T, {}));
    snaps.push(captureSingleReplay("S2", s, "s2-case"));
  })();

  // S3: no events for this caseId → replay_input_invalid error
  (() => {
    const s = createInMemoryAuditEventStore();
    snaps.push(captureSingleReplay("S3", s, "s3-nonexistent"));
  })();

  // S4: event version missing
  (() => {
    const s = createInMemoryAuditEventStore();
    s.append({ eventId: "s4-e1", eventType: "RiskCaseOrchestrationStarted", eventVersion: "", traceId: "tr", caseId: "s4-case", occurredAt: T, producer: "test", payload: {}, metadata: {} });
    snaps.push(captureSingleReplay("S4", s, "s4-case"));
  })();

  // S5: finalState matches expectation (same as S1 but verifies finalState field)
  (() => { const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "s5-case"); snaps.push(captureSingleReplay("S5", s, "s5-case")); })();

  return snaps;
};

const execBatchScenarios = (runId: string): Phase5ScenarioFieldSnapshot[] => {
  const snaps: Phase5ScenarioFieldSnapshot[] = [];

  // B1: all matched
  (() => {
    const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "b1-a"); seedCompleteCase(s, "b1-b");
    const r = runBatchCaseReplay({ batchReplayId: `${runId}-B1`, caseIds: ["b1-a", "b1-b"], expectations: [{ caseId: "b1-a", expectedFinalState: "orchestration_completed" }, { caseId: "b1-b", expectedFinalState: "orchestration_completed" }], replayReason: "matrix", traceId: "B1", replayRequestedAt: T }, s);
    if (!r.ok) { snaps.push({ scenarioId: "B1", scenarioGroup: "batch_replay", fields: {} }); return; }
    const snap = buildReplayBaselineSnapshot(`${runId}-B1-snap`, r.value);
    snaps.push({ scenarioId: "B1", scenarioGroup: "batch_replay", fields: { matchedCases: String(snap.matchedCases), mismatchedCases: String(snap.mismatchedCases), failedCases: String(snap.failedCases), incompleteCases: String(snap.incompleteCases) } });
  })();

  // B2: one mismatch
  (() => {
    const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "b2-a"); seedCompleteCase(s, "b2-b");
    const r = runBatchCaseReplay({ batchReplayId: `${runId}-B2`, caseIds: ["b2-a", "b2-b"], expectations: [{ caseId: "b2-a", expectedFinalState: "orchestration_completed" }, { caseId: "b2-b", expectedFinalState: "wrong_state" }], replayReason: "matrix", traceId: "B2", replayRequestedAt: T }, s);
    if (!r.ok) { snaps.push({ scenarioId: "B2", scenarioGroup: "batch_replay", fields: {} }); return; }
    const snap = buildReplayBaselineSnapshot(`${runId}-B2-snap`, r.value);
    snaps.push({ scenarioId: "B2", scenarioGroup: "batch_replay", fields: { matchedCases: String(snap.matchedCases), mismatchedCases: String(snap.mismatchedCases), failedCases: String(snap.failedCases) } });
  })();

  // B3: one incomplete
  (() => {
    const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "b3-a"); seedIncompleteCase(s, "b3-b");
    const r = runBatchCaseReplay({ batchReplayId: `${runId}-B3`, caseIds: ["b3-a", "b3-b"], expectations: [{ caseId: "b3-a", expectedFinalState: "orchestration_completed" }], replayReason: "matrix", traceId: "B3", replayRequestedAt: T }, s);
    if (!r.ok) { snaps.push({ scenarioId: "B3", scenarioGroup: "batch_replay", fields: {} }); return; }
    const snap = buildReplayBaselineSnapshot(`${runId}-B3-snap`, r.value);
    snaps.push({ scenarioId: "B3", scenarioGroup: "batch_replay", fields: { matchedCases: String(snap.matchedCases), incompleteCases: String(snap.incompleteCases), failedCases: String(snap.failedCases) } });
  })();

  // B4: one failed (missing case)
  (() => {
    const s = createInMemoryAuditEventStore(); seedCompleteCase(s, "b4-a");
    const r = runBatchCaseReplay({ batchReplayId: `${runId}-B4`, caseIds: ["b4-a", "b4-missing"], expectations: [{ caseId: "b4-a", expectedFinalState: "orchestration_completed" }], replayReason: "matrix", traceId: "B4", replayRequestedAt: T }, s);
    if (!r.ok) { snaps.push({ scenarioId: "B4", scenarioGroup: "batch_replay", fields: {} }); return; }
    const snap = buildReplayBaselineSnapshot(`${runId}-B4-snap`, r.value);
    snaps.push({ scenarioId: "B4", scenarioGroup: "batch_replay", fields: { matchedCases: String(snap.matchedCases), failedCases: String(snap.failedCases) } });
  })();

  // B5: empty batch
  (() => {
    const s = createInMemoryAuditEventStore();
    const r = runBatchCaseReplay({ batchReplayId: `${runId}-B5`, caseIds: [], expectations: [], replayReason: "matrix", traceId: "B5", replayRequestedAt: T }, s);
    if (!r.ok) { snaps.push({ scenarioId: "B5", scenarioGroup: "batch_replay", fields: {} }); return; }
    const snap = buildReplayBaselineSnapshot(`${runId}-B5-snap`, r.value);
    snaps.push({ scenarioId: "B5", scenarioGroup: "batch_replay", fields: { matchedCases: String(snap.matchedCases), failedCases: String(snap.failedCases) } });
  })();

  return snaps;
};

// ─── runner ─────────────────────────────────────────────────────────────────

export const runPhase5ReplayDifferenceMatrix = (
  matrixRunId: string
): { readonly matrix: Phase5ReplayDifferenceMatrix; readonly acceptanceInput: Phase5ReplayAcceptanceInputSnapshot } => {
  const scSnaps = execSingleCaseScenarios(matrixRunId);
  const btSnaps = execBatchScenarios(matrixRunId);

  const scReports = PHASE5_SINGLE_CASE_SCENARIO_BASELINES.map((b, i) =>
    buildReport(`${matrixRunId}-${b.scenarioId}`, b, scSnaps[i]!));
  const btReports = PHASE5_BATCH_REPLAY_SCENARIO_BASELINES.map((b, i) =>
    buildReport(`${matrixRunId}-${b.scenarioId}`, b, btSnaps[i]!));

  const allReports = [...scReports, ...btReports];
  const matchedCount = allReports.filter(r => r.matched).length;
  const mismatchedCount = allReports.length - matchedCount;

  const coreFieldDriftSummary: string[] = [];
  for (const r of allReports) for (const s of r.differenceSummaries) coreFieldDriftSummary.push(`${r.scenarioId}: ${s}`);

  const hasBlocking = allReports.some(r => r.mismatchedFields.some(f => classifyReplayFieldDrift(f) === "blocking"));
  const hasNotice = allReports.some(r => r.mismatchedFields.some(f => classifyReplayFieldDrift(f) === "notice"));
  const overallStatus: Phase5MatrixOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  const matrix: Phase5ReplayDifferenceMatrix = {
    matrixRunId, singleCaseScenarioReports: scReports, batchReplayScenarioReports: btReports,
    totalScenarios: allReports.length, matchedScenarios: matchedCount, mismatchedScenarios: mismatchedCount,
    coreFieldDriftSummary, overallStatus,
    matrixSummary: `Phase 5 replay matrix [${matrixRunId}]: ${matchedCount}/${allReports.length} matched, status=${overallStatus}`
  };

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const r of allReports) for (const f of r.mismatchedFields) {
    const label = `${r.scenarioId}: ${f} drifted`;
    if (classifyReplayFieldDrift(f) === "blocking") blockingIssues.push(label); else nonBlockingNotices.push(label);
  }

  const recommendedNextActions: string[] = [];
  if (overallStatus === "passed") recommendedNextActions.push("Proceed to Phase 5 acceptance gate (Step 4)");
  else if (overallStatus === "passed_with_notice") { recommendedNextActions.push("Review notice-level drift"); recommendedNextActions.push("Proceed to Phase 5 acceptance gate with documented notices"); }
  else { recommendedNextActions.push("Resolve blocking drift before proceeding"); recommendedNextActions.push("Re-run difference matrix after fixes"); }

  const acceptanceInput: Phase5ReplayAcceptanceInputSnapshot = {
    baselineCoreFields: [...PHASE5_REPLAY_BASELINE_CORE_FIELDS],
    singleCaseScenarioIds: scReports.map(r => r.scenarioId),
    batchReplayScenarioIds: btReports.map(r => r.scenarioId),
    differenceMatrixOverallStatus: overallStatus,
    keyDriftFindings: coreFieldDriftSummary,
    blockingIssues, nonBlockingNotices, recommendedNextActions
  };

  return { matrix, acceptanceInput };
};

// ─── consistency helper ─────────────────────────────────────────────────────

export type Phase5ReplayBaselineConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const assertPhase5ReplayBaselineConsistency = (
  matrix: Phase5ReplayDifferenceMatrix
): Phase5ReplayBaselineConsistencyResult => {
  const violations: string[] = [];
  const allReports = [...matrix.singleCaseScenarioReports, ...matrix.batchReplayScenarioReports];

  if (matrix.totalScenarios !== allReports.length) violations.push(`totalScenarios ${matrix.totalScenarios} != report count ${allReports.length}`);
  if (matrix.matchedScenarios + matrix.mismatchedScenarios !== matrix.totalScenarios) violations.push("matched + mismatched != total");

  const actualMatched = allReports.filter(r => r.matched).length;
  if (actualMatched !== matrix.matchedScenarios) violations.push(`matchedScenarios ${matrix.matchedScenarios} != actual ${actualMatched}`);

  for (const r of allReports) {
    if (r.matched && r.mismatchedFields.length > 0) violations.push(`${r.scenarioId}: matched but has mismatchedFields`);
    if (!r.matched && r.mismatchedFields.length === 0) violations.push(`${r.scenarioId}: not-matched but no mismatchedFields`);
  }

  if (matrix.overallStatus === "passed" && matrix.mismatchedScenarios > 0) violations.push("passed but has mismatched");

  const scIds = new Set(matrix.singleCaseScenarioReports.map(r => r.scenarioId));
  const btIds = new Set(matrix.batchReplayScenarioReports.map(r => r.scenarioId));
  if (scIds.size < 5) violations.push(`single-case scenarios < 5: ${scIds.size}`);
  if (btIds.size < 5) violations.push(`batch scenarios < 5: ${btIds.size}`);

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};
