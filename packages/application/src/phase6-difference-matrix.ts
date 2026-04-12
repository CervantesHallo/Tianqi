import { ok } from "@tianqi/shared";
import { startTraceContext, deriveChildTraceContext } from "./trace-context.js";
import { createInMemoryMetricsPort, buildCounterMetric, buildLatencyMetric } from "./metrics-port.js";
import { runBenchmark, validateObservabilityConsistency } from "./benchmark-harness.js";
import type { BenchmarkScenario } from "./benchmark-harness.js";
import type { OrchestrationPorts } from "./orchestration-ports.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import { runCaseReplay } from "./case-replay-handler.js";
import { runPhase6FaultDrill } from "./fault-drill.js";

// ─── core fields ────────────────────────────────────────────────────────────

export const PHASE6_BASELINE_CORE_FIELDS = [
  "tracePropagationStatus", "metricRecordingStatus", "benchmarkStatus",
  "drillStatus", "overallStatus", "traceSpanCount", "metricCount",
  "avgDurationMs", "handledAsExpectedCount", "degradedButContinuedCount",
  "failedUnexpectedlyCount"
] as const;

export type Phase6CoreField = (typeof PHASE6_BASELINE_CORE_FIELDS)[number];

export const PHASE6_BLOCKING_DRIFT_FIELDS = new Set<string>([
  "tracePropagationStatus", "metricRecordingStatus", "benchmarkStatus",
  "drillStatus", "failedUnexpectedlyCount", "overallStatus"
]);

export const PHASE6_NOTICE_DRIFT_FIELDS = new Set<string>([
  "avgDurationMs", "degradedButContinuedCount", "traceSpanCount", "metricCount"
]);

// ─── scenario types ─────────────────────────────────────────────────────────

export type Phase6ScenarioBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioGroup: "observability" | "fault_drill";
  readonly expectedFields: Record<string, string>;
};

export type Phase6ScenarioSnapshot = {
  readonly scenarioId: string;
  readonly scenarioGroup: "observability" | "fault_drill";
  readonly fields: Record<string, string>;
};

// ─── difference report ──────────────────────────────────────────────────────

export type Phase6DifferenceReport = {
  readonly reportId: string;
  readonly scenarioId: string;
  readonly matched: boolean;
  readonly matchedFields: readonly string[];
  readonly mismatchedFields: readonly string[];
  readonly differenceSummaries: readonly string[];
  readonly consistencyStatus: "consistent" | "drifted";
  readonly reportSummary: string;
};

export const classifyPhase6FieldDrift = (field: string): "blocking" | "notice" =>
  PHASE6_BLOCKING_DRIFT_FIELDS.has(field) ? "blocking" : "notice";

const buildReport = (
  reportId: string, baseline: Phase6ScenarioBaseline, snapshot: Phase6ScenarioSnapshot
): Phase6DifferenceReport => {
  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const differenceSummaries: string[] = [];
  for (const field of PHASE6_BASELINE_CORE_FIELDS) {
    const expected = baseline.expectedFields[field];
    if (expected === undefined) continue;
    const actual = snapshot.fields[field];
    if (actual === expected) matchedFields.push(field);
    else { mismatchedFields.push(field); differenceSummaries.push(`${field}: expected=${expected}, actual=${actual ?? "undefined"}`); }
  }
  const matched = mismatchedFields.length === 0;
  return { reportId, scenarioId: baseline.scenarioId, matched, matchedFields, mismatchedFields, differenceSummaries, consistencyStatus: matched ? "consistent" : "drifted", reportSummary: matched ? `${baseline.scenarioId}: all matched` : `${baseline.scenarioId}: ${mismatchedFields.length} drifted` };
};

// ─── scenario baselines ─────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";

export const PHASE6_OBSERVABILITY_BASELINES: readonly Phase6ScenarioBaseline[] = [
  { scenarioId: "T1", scenarioName: "trace_propagation_stable", scenarioGroup: "observability", expectedFields: { tracePropagationStatus: "pass" } },
  { scenarioId: "T2", scenarioName: "metrics_recording_stable", scenarioGroup: "observability", expectedFields: { metricRecordingStatus: "pass" } },
  { scenarioId: "T3", scenarioName: "orchestration_benchmark_normal", scenarioGroup: "observability", expectedFields: { benchmarkStatus: "pass" } },
  { scenarioId: "T4", scenarioName: "replay_benchmark_normal", scenarioGroup: "observability", expectedFields: { benchmarkStatus: "pass" } },
  { scenarioId: "T5", scenarioName: "observability_consistency_clean", scenarioGroup: "observability", expectedFields: { overallStatus: "pass" } }
];

export const PHASE6_FAULT_DRILL_BASELINES: readonly Phase6ScenarioBaseline[] = [
  { scenarioId: "F1", scenarioName: "orchestration_timeout_handled", scenarioGroup: "fault_drill", expectedFields: { drillStatus: "handled_as_expected" } },
  { scenarioId: "F2", scenarioName: "orchestration_partial_write_degraded", scenarioGroup: "fault_drill", expectedFields: { drillStatus: "degraded_but_continued" } },
  { scenarioId: "F3", scenarioName: "replay_ooo_handled", scenarioGroup: "fault_drill", expectedFields: { drillStatus: "handled_as_expected" } },
  { scenarioId: "F4", scenarioName: "replay_duplicate_handled", scenarioGroup: "fault_drill", expectedFields: { drillStatus: "handled_as_expected" } },
  { scenarioId: "F5", scenarioName: "drill_baseline_snapshot_stable", scenarioGroup: "fault_drill", expectedFields: { failedUnexpectedlyCount: "0" } }
];

// ─── matrix + acceptance types ──────────────────────────────────────────────

export type Phase6MatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase6ObservabilityDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly observabilityScenarioReports: readonly Phase6DifferenceReport[];
  readonly faultDrillScenarioReports: readonly Phase6DifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly coreFieldDriftSummary: readonly string[];
  readonly overallStatus: Phase6MatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase6AcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly string[];
  readonly observabilityScenarioIds: readonly string[];
  readonly faultDrillScenarioIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase6MatrixOverallStatus;
  readonly keyDriftFindings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

// ─── scenario executors ─────────────────────────────────────────────────────

const stdPorts = (): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok({ caseId: "rc-m", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL", configVersion: "1.0.0", createdAt: T }) },
  liquidationCaseRepository: { loadCase: () => ok(null) },
  policyConfig: { getActivePolicyConfig: () => ok({ configVersion: "1.0.0", rankingPolicyName: "v1", rankingPolicyVersion: "1.0.0", fundWaterfallPolicyName: "v1", fundWaterfallPolicyVersion: "1.0.0", candidateSelectionPolicyName: "v1", candidateSelectionPolicyVersion: "1.0.0" }) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
    executeRanking: () => ok({ rankedCount: 5, summary: "ok" }),
    executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "ok" })
  },
  audit: { publishAuditEvent: () => ok(undefined) }
});

const execObservabilityScenarios = (): Phase6ScenarioSnapshot[] => {
  const snaps: Phase6ScenarioSnapshot[] = [];

  // T1: trace propagation
  (() => {
    const root = startTraceContext("t1-tr", "test", "trace_check", { startedAt: T });
    const child = deriveChildTraceContext(root, "test", "child", T);
    const ok = root.traceId === child.traceId && child.parentSpanId === root.spanId;
    snaps.push({ scenarioId: "T1", scenarioGroup: "observability", fields: { tracePropagationStatus: ok ? "pass" : "fail" } });
  })();

  // T2: metrics recording
  (() => {
    const port = createInMemoryMetricsPort();
    port.record(buildCounterMetric("test.counter", "t2-tr", { module: "test" }));
    port.record(buildLatencyMetric("test.latency", 5, "t2-tr", { module: "test" }));
    const ok = port.getRecorded().length === 2;
    snaps.push({ scenarioId: "T2", scenarioGroup: "observability", fields: { metricRecordingStatus: ok ? "pass" : "fail" } });
  })();

  // T3: orchestration benchmark
  (() => {
    const scenario: BenchmarkScenario<boolean> = {
      scenarioName: "orch_bench", iterations: 5, setup: () => {},
      run: () => {
        const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
        const r = executeRiskCaseOrchestration({ orchestrationId: `t3-${Math.random()}`, caseId: "rc-m", requestId: `r-${Math.random()}`, triggeredBy: "bench", triggeredAt: T }, stdPorts(), idem, rep);
        return r.ok;
      }
    };
    const result = runBenchmark("t3-bench", scenario, v => v === true);
    snaps.push({ scenarioId: "T3", scenarioGroup: "observability", fields: { benchmarkStatus: result.failureCount === 0 ? "pass" : "fail", avgDurationMs: String(result.avgDurationMs) } });
  })();

  // T4: replay benchmark
  (() => {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", "orch-t4", "c-t4", T, {}));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-t4", "c-t4", T, {}));
    const scenario: BenchmarkScenario<boolean> = {
      scenarioName: "replay_bench", iterations: 5, setup: () => {},
      run: () => { const r = runCaseReplay({ caseId: "c-t4", replayReason: "bench", traceId: "t4-tr", replayRequestedAt: T }, store); return r.ok; }
    };
    const result = runBenchmark("t4-bench", scenario, v => v === true);
    snaps.push({ scenarioId: "T4", scenarioGroup: "observability", fields: { benchmarkStatus: result.failureCount === 0 ? "pass" : "fail", avgDurationMs: String(result.avgDurationMs) } });
  })();

  // T5: observability consistency
  (() => {
    const traces = [startTraceContext("t5-tr", "test", "check", { startedAt: T })];
    const metrics = [buildCounterMetric("test", "t5-tr", { module: "test" })];
    const benchmarks = [{ benchmarkId: "b", scenarioName: "s", iterations: 1, successCount: 1, failureCount: 0, totalDurationMs: 1, avgDurationMs: 1, minDurationMs: 1, maxDurationMs: 1, summary: "ok" }];
    const c = validateObservabilityConsistency(traces, metrics, benchmarks);
    snaps.push({ scenarioId: "T5", scenarioGroup: "observability", fields: { overallStatus: c.consistent ? "pass" : "fail" } });
  })();

  return snaps;
};

const execFaultDrillScenarios = (runId: string): Phase6ScenarioSnapshot[] => {
  const snaps: Phase6ScenarioSnapshot[] = [];
  const { results, snapshot } = runPhase6FaultDrill(`${runId}-drill`);

  const of1 = results.find(r => r.scenarioId === "O-F1");
  snaps.push({ scenarioId: "F1", scenarioGroup: "fault_drill", fields: { drillStatus: of1?.drillStatus ?? "missing" } });

  const of3 = results.find(r => r.scenarioId === "O-F3");
  snaps.push({ scenarioId: "F2", scenarioGroup: "fault_drill", fields: { drillStatus: of3?.drillStatus ?? "missing" } });

  const rf1 = results.find(r => r.scenarioId === "R-F1");
  snaps.push({ scenarioId: "F3", scenarioGroup: "fault_drill", fields: { drillStatus: rf1?.drillStatus ?? "missing" } });

  const rf2 = results.find(r => r.scenarioId === "R-F2");
  snaps.push({ scenarioId: "F4", scenarioGroup: "fault_drill", fields: { drillStatus: rf2?.drillStatus ?? "missing" } });

  snaps.push({ scenarioId: "F5", scenarioGroup: "fault_drill", fields: { failedUnexpectedlyCount: String(snapshot.failedUnexpectedlyCount) } });

  return snaps;
};

// ─── runner ─────────────────────────────────────────────────────────────────

export const runPhase6DifferenceMatrix = (
  matrixRunId: string
): { readonly matrix: Phase6ObservabilityDifferenceMatrix; readonly acceptanceInput: Phase6AcceptanceInputSnapshot } => {
  const obsSnaps = execObservabilityScenarios();
  const drillSnaps = execFaultDrillScenarios(matrixRunId);

  const obsReports = PHASE6_OBSERVABILITY_BASELINES.map((b, i) => buildReport(`${matrixRunId}-${b.scenarioId}`, b, obsSnaps[i]!));
  const drillReports = PHASE6_FAULT_DRILL_BASELINES.map((b, i) => buildReport(`${matrixRunId}-${b.scenarioId}`, b, drillSnaps[i]!));

  const allReports = [...obsReports, ...drillReports];
  const matchedCount = allReports.filter(r => r.matched).length;
  const mismatchedCount = allReports.length - matchedCount;

  const coreFieldDriftSummary: string[] = [];
  for (const r of allReports) for (const s of r.differenceSummaries) coreFieldDriftSummary.push(`${r.scenarioId}: ${s}`);

  const hasBlocking = allReports.some(r => r.mismatchedFields.some(f => classifyPhase6FieldDrift(f) === "blocking"));
  const hasNotice = allReports.some(r => r.mismatchedFields.some(f => classifyPhase6FieldDrift(f) === "notice"));
  const overallStatus: Phase6MatrixOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  const matrix: Phase6ObservabilityDifferenceMatrix = {
    matrixRunId, observabilityScenarioReports: obsReports, faultDrillScenarioReports: drillReports,
    totalScenarios: allReports.length, matchedScenarios: matchedCount, mismatchedScenarios: mismatchedCount,
    coreFieldDriftSummary, overallStatus,
    matrixSummary: `Phase 6 matrix [${matrixRunId}]: ${matchedCount}/${allReports.length} matched, status=${overallStatus}`
  };

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const r of allReports) for (const f of r.mismatchedFields) {
    const label = `${r.scenarioId}: ${f} drifted`;
    if (classifyPhase6FieldDrift(f) === "blocking") blockingIssues.push(label); else nonBlockingNotices.push(label);
  }

  const recommendedNextActions: string[] = [];
  if (overallStatus === "passed") recommendedNextActions.push("Proceed to Phase 6 acceptance gate (Step 4)");
  else if (overallStatus === "passed_with_notice") { recommendedNextActions.push("Review notice-level drift"); recommendedNextActions.push("Proceed to Phase 6 acceptance gate with documented notices"); }
  else { recommendedNextActions.push("Resolve blocking drift before proceeding"); }

  const acceptanceInput: Phase6AcceptanceInputSnapshot = {
    baselineCoreFields: [...PHASE6_BASELINE_CORE_FIELDS],
    observabilityScenarioIds: obsReports.map(r => r.scenarioId),
    faultDrillScenarioIds: drillReports.map(r => r.scenarioId),
    differenceMatrixOverallStatus: overallStatus,
    keyDriftFindings: coreFieldDriftSummary, blockingIssues, nonBlockingNotices, recommendedNextActions
  };

  return { matrix, acceptanceInput };
};

// ─── consistency helper ─────────────────────────────────────────────────────

export type Phase6BaselineConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const assertPhase6BaselineConsistency = (
  matrix: Phase6ObservabilityDifferenceMatrix
): Phase6BaselineConsistencyResult => {
  const violations: string[] = [];
  const allReports = [...matrix.observabilityScenarioReports, ...matrix.faultDrillScenarioReports];

  if (matrix.totalScenarios !== allReports.length) violations.push(`totalScenarios ${matrix.totalScenarios} != report count ${allReports.length}`);
  if (matrix.matchedScenarios + matrix.mismatchedScenarios !== matrix.totalScenarios) violations.push("matched + mismatched != total");

  const actualMatched = allReports.filter(r => r.matched).length;
  if (actualMatched !== matrix.matchedScenarios) violations.push(`matchedScenarios ${matrix.matchedScenarios} != actual ${actualMatched}`);

  for (const r of allReports) {
    if (r.matched && r.mismatchedFields.length > 0) violations.push(`${r.scenarioId}: matched but has mismatchedFields`);
    if (!r.matched && r.mismatchedFields.length === 0) violations.push(`${r.scenarioId}: not-matched but no mismatchedFields`);
  }

  if (matrix.overallStatus === "passed" && matrix.mismatchedScenarios > 0) violations.push("passed but has mismatched");

  const obsIds = new Set(matrix.observabilityScenarioReports.map(r => r.scenarioId));
  const drillIds = new Set(matrix.faultDrillScenarioReports.map(r => r.scenarioId));
  if (obsIds.size < 5) violations.push(`observability scenarios < 5: ${obsIds.size}`);
  if (drillIds.size < 5) violations.push(`fault drill scenarios < 5: ${drillIds.size}`);

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};
