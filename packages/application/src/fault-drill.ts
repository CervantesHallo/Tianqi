import { ok, err } from "@tianqi/shared";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView } from "./orchestration-ports.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import { runCaseReplay } from "./case-replay-handler.js";
import { startTraceContext, deriveChildTraceContext } from "./trace-context.js";
import { createInMemoryMetricsPort, buildCounterMetric } from "./metrics-port.js";
import { strategyExecutionFailed, portUnavailable } from "./orchestration-error.js";

// ─── fault injection model ──────────────────────────────────────────────────

export type FaultType = "timeout" | "duplicate_message" | "out_of_order_message" | "partial_write_success";

export type FaultInjectionScenario = {
  readonly faultId: string;
  readonly faultType: FaultType;
  readonly targetModule: string;
  readonly targetAction: string;
  readonly activationRule: string;
  readonly description: string;
};

// ─── drill result ───────────────────────────────────────────────────────────

export type FaultDrillStatus = "handled_as_expected" | "degraded_but_continued" | "failed_unexpectedly";

export type FaultDrillResult = {
  readonly drillRunId: string;
  readonly scenarioId: string;
  readonly targetPath: string;
  readonly faultType: FaultType;
  readonly drillStatus: FaultDrillStatus;
  readonly observedOutcome: string;
  readonly traceSpanCount: number;
  readonly metricCount: number;
  readonly durationMs: number;
  readonly summary: string;
};

// ─── baseline snapshot ──────────────────────────────────────────────────────

export type FaultDrillBaselineOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase6FaultDrillBaselineSnapshot = {
  readonly snapshotId: string;
  readonly scenarioCount: number;
  readonly handledAsExpectedCount: number;
  readonly degradedButContinuedCount: number;
  readonly failedUnexpectedlyCount: number;
  readonly results: readonly FaultDrillResult[];
  readonly overallStatus: FaultDrillBaselineOverallStatus;
  readonly summary: string;
};

// ─── scenario baselines ─────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";
const RC: RiskCaseView = { caseId: "rc-drill", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL", configVersion: "1.0.0", createdAt: T };
const CFG: ActivePolicyConfigView = {
  configVersion: "1.0.0", rankingPolicyName: "v1", rankingPolicyVersion: "1.0.0",
  fundWaterfallPolicyName: "v1", fundWaterfallPolicyVersion: "1.0.0",
  candidateSelectionPolicyName: "v1", candidateSelectionPolicyVersion: "1.0.0"
};

export const PHASE6_ORCHESTRATION_FAULT_SCENARIOS: readonly FaultInjectionScenario[] = [
  { faultId: "O-F1", faultType: "timeout", targetModule: "strategyExecution", targetAction: "executeRanking", activationRule: "always", description: "Strategy execution timeout during ranking" },
  { faultId: "O-F2", faultType: "duplicate_message", targetModule: "orchestrator", targetAction: "execute", activationRule: "same_request_id", description: "Duplicate orchestration request" },
  { faultId: "O-F3", faultType: "partial_write_success", targetModule: "audit", targetAction: "publishAuditEvent", activationRule: "always", description: "Partial audit publish failure" },
  { faultId: "O-F4", faultType: "timeout", targetModule: "strategyExecution", targetAction: "executeFundWaterfall", activationRule: "after_selection_success", description: "Compensation-required path under timeout fault" }
];

export const PHASE6_REPLAY_FAULT_SCENARIOS: readonly FaultInjectionScenario[] = [
  { faultId: "R-F1", faultType: "out_of_order_message", targetModule: "eventStore", targetAction: "listByCaseId", activationRule: "always", description: "Replay with out-of-order event sequence" },
  { faultId: "R-F2", faultType: "duplicate_message", targetModule: "replayer", targetAction: "runCaseReplay", activationRule: "same_case_id", description: "Duplicate replay request" },
  { faultId: "R-F3", faultType: "partial_write_success", targetModule: "eventStore", targetAction: "append", activationRule: "skip_middle", description: "Partial event append visibility" },
  { faultId: "R-F4", faultType: "out_of_order_message", targetModule: "replayer", targetAction: "validateConsistency", activationRule: "malformed_stream", description: "Replay consistency failure under malformed stream" }
];

// ─── orchestration drill executors ──────────────────────────────────────────

const stdPorts = (): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok(RC) },
  liquidationCaseRepository: { loadCase: () => ok(null) },
  policyConfig: { getActivePolicyConfig: () => ok(CFG) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
    executeRanking: () => ok({ rankedCount: 5, summary: "ok" }),
    executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "ok" })
  },
  audit: { publishAuditEvent: () => ok(undefined) }
});

const execOrchDrill = (scenario: FaultInjectionScenario, runId: string): FaultDrillResult => {
  const trace = startTraceContext(`${runId}-tr`, "drill", `fault_${scenario.faultId}`, { caseId: "rc-drill", startedAt: T });
  const metrics = createInMemoryMetricsPort();
  const start = Date.now();
  let status: FaultDrillStatus;
  let outcome: string;
  const children = [deriveChildTraceContext(trace, "drill", "execute", T)];

  if (scenario.faultId === "O-F1") {
    const ports: OrchestrationPorts = { ...stdPorts(), strategyExecution: { ...stdPorts().strategyExecution, executeRanking: () => err(strategyExecutionFailed("ranking", "timeout")) } };
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const r = executeRiskCaseOrchestration({ orchestrationId: `${runId}-o`, caseId: "rc-drill", requestId: `${runId}-r`, triggeredBy: "drill", triggeredAt: T }, ports, idem, rep);
    metrics.record(buildCounterMetric("drill.orchestration.fault", trace.traceId, { faultId: scenario.faultId }, "rc-drill"));
    if (r.ok && (r.value.resultStatus === "compensation_required" || r.value.resultStatus === "failed")) { status = "handled_as_expected"; outcome = r.value.resultStatus; }
    else { status = "failed_unexpectedly"; outcome = r.ok ? r.value.resultStatus : r.error.type; }
  } else if (scenario.faultId === "O-F2") {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    executeRiskCaseOrchestration({ orchestrationId: `${runId}-o1`, caseId: "rc-drill", requestId: `${runId}-dup`, triggeredBy: "drill", triggeredAt: T }, stdPorts(), idem, rep);
    const r2 = executeRiskCaseOrchestration({ orchestrationId: `${runId}-o2`, caseId: "rc-drill", requestId: `${runId}-dup`, triggeredBy: "drill", triggeredAt: T }, stdPorts(), idem, rep);
    metrics.record(buildCounterMetric("drill.orchestration.duplicate", trace.traceId, { faultId: scenario.faultId }, "rc-drill"));
    if (r2.ok && r2.value.idempotencyStatus === "replayed_same_result") { status = "handled_as_expected"; outcome = "replayed_same_result"; }
    else { status = "failed_unexpectedly"; outcome = r2.ok ? r2.value.idempotencyStatus : r2.error.type; }
  } else if (scenario.faultId === "O-F3") {
    const ports: OrchestrationPorts = { ...stdPorts(), audit: { publishAuditEvent: () => err(portUnavailable("audit", "partial failure")) } };
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const r = executeRiskCaseOrchestration({ orchestrationId: `${runId}-o`, caseId: "rc-drill", requestId: `${runId}-r3`, triggeredBy: "drill", triggeredAt: T }, ports, idem, rep);
    metrics.record(buildCounterMetric("drill.orchestration.partial_audit", trace.traceId, { faultId: scenario.faultId }, "rc-drill"));
    if (r.ok && r.value.resultStatus === "succeeded") { status = "degraded_but_continued"; outcome = "succeeded_with_audit_degradation"; }
    else { status = "failed_unexpectedly"; outcome = r.ok ? r.value.resultStatus : r.error.type; }
  } else {
    const ports: OrchestrationPorts = { ...stdPorts(), strategyExecution: {
      ...stdPorts().strategyExecution,
      executeFundWaterfall: () => err(strategyExecutionFailed("fund_waterfall", "timeout"))
    } };
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const r = executeRiskCaseOrchestration({ orchestrationId: `${runId}-o`, caseId: "rc-drill", requestId: `${runId}-r4`, triggeredBy: "drill", triggeredAt: T }, ports, idem, rep);
    metrics.record(buildCounterMetric("drill.orchestration.comp_fault", trace.traceId, { faultId: scenario.faultId }, "rc-drill"));
    if (r.ok && r.value.resultStatus === "compensation_required") { status = "handled_as_expected"; outcome = "compensation_required"; }
    else { status = "failed_unexpectedly"; outcome = r.ok ? r.value.resultStatus : r.error.type; }
  }

  return { drillRunId: runId, scenarioId: scenario.faultId, targetPath: "orchestration", faultType: scenario.faultType, drillStatus: status, observedOutcome: outcome, traceSpanCount: children.length + 1, metricCount: metrics.getRecorded().length, durationMs: Date.now() - start, summary: `${scenario.faultId}: ${status} (${outcome})` };
};

// ─── replay drill executors ─────────────────────────────────────────────────

const seedCompleteCase = (caseId: string) => {
  const store = createInMemoryAuditEventStore();
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", `orch-${caseId}`, caseId, T, {}));
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", `orch-${caseId}`, caseId, T, { step: "load" }));
  store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", `orch-${caseId}`, caseId, T, {}));
  return store;
};

const execReplayDrill = (scenario: FaultInjectionScenario, runId: string): FaultDrillResult => {
  const trace = startTraceContext(`${runId}-tr`, "drill", `fault_${scenario.faultId}`, { caseId: "rp-drill", startedAt: T });
  const metrics = createInMemoryMetricsPort();
  const start = Date.now();
  let status: FaultDrillStatus;
  let outcome: string;
  const children = [deriveChildTraceContext(trace, "drill", "execute", T)];

  if (scenario.faultId === "R-F1") {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-rf1", "rf1-case", T, {}));
    const r = runCaseReplay({ caseId: "rf1-case", replayReason: "drill", traceId: trace.traceId, replayRequestedAt: T }, store);
    metrics.record(buildCounterMetric("drill.replay.ooo", trace.traceId, { faultId: scenario.faultId }, "rf1-case"));
    if (!r.ok && r.error.type === "replay_consistency_failed") { status = "handled_as_expected"; outcome = "consistency_rejected_ooo"; }
    else { status = "failed_unexpectedly"; outcome = r.ok ? "unexpected_success" : r.error.type; }
  } else if (scenario.faultId === "R-F2") {
    const store = seedCompleteCase("rf2-case");
    const r1 = runCaseReplay({ caseId: "rf2-case", replayReason: "drill", traceId: trace.traceId, replayRequestedAt: T }, store);
    const r2 = runCaseReplay({ caseId: "rf2-case", replayReason: "drill-dup", traceId: trace.traceId, replayRequestedAt: T }, store);
    metrics.record(buildCounterMetric("drill.replay.duplicate", trace.traceId, { faultId: scenario.faultId }, "rf2-case"));
    if (r1.ok && r2.ok && r1.value.finalState === r2.value.finalState) { status = "handled_as_expected"; outcome = "duplicate_replay_idempotent"; }
    else { status = "failed_unexpectedly"; outcome = "duplicate_replay_diverged"; }
  } else if (scenario.faultId === "R-F3") {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", "orch-rf3", "rf3-case", T, {}));
    const r = runCaseReplay({ caseId: "rf3-case", replayReason: "drill", traceId: trace.traceId, replayRequestedAt: T }, store);
    metrics.record(buildCounterMetric("drill.replay.partial", trace.traceId, { faultId: scenario.faultId }, "rf3-case"));
    if (r.ok && r.value.reconstructionStatus === "incomplete") { status = "degraded_but_continued"; outcome = "incomplete_due_to_partial_visibility"; }
    else { status = "failed_unexpectedly"; outcome = r.ok ? r.value.reconstructionStatus : r.error.type; }
  } else {
    const store = createInMemoryAuditEventStore();
    store.append({ eventId: "rf4-e1", eventType: "RiskCaseOrchestrationStarted", eventVersion: "", traceId: "tr", caseId: "rf4-case", occurredAt: T, producer: "test", payload: {}, metadata: {} });
    const r = runCaseReplay({ caseId: "rf4-case", replayReason: "drill", traceId: trace.traceId, replayRequestedAt: T }, store);
    metrics.record(buildCounterMetric("drill.replay.malformed", trace.traceId, { faultId: scenario.faultId }, "rf4-case"));
    if (!r.ok) { status = "handled_as_expected"; outcome = `rejected: ${r.error.type}`; }
    else { status = "failed_unexpectedly"; outcome = "unexpected_success_on_malformed"; }
  }

  return { drillRunId: runId, scenarioId: scenario.faultId, targetPath: "replay", faultType: scenario.faultType, drillStatus: status, observedOutcome: outcome, traceSpanCount: children.length + 1, metricCount: metrics.getRecorded().length, durationMs: Date.now() - start, summary: `${scenario.faultId}: ${status} (${outcome})` };
};

// ─── drill runner ───────────────────────────────────────────────────────────

export const runPhase6FaultDrill = (drillRunId: string): {
  readonly results: readonly FaultDrillResult[];
  readonly snapshot: Phase6FaultDrillBaselineSnapshot;
} => {
  const orchResults = PHASE6_ORCHESTRATION_FAULT_SCENARIOS.map(s => execOrchDrill(s, `${drillRunId}-${s.faultId}`));
  const replayResults = PHASE6_REPLAY_FAULT_SCENARIOS.map(s => execReplayDrill(s, `${drillRunId}-${s.faultId}`));
  const allResults = [...orchResults, ...replayResults];
  return { results: allResults, snapshot: buildFaultDrillBaselineSnapshot(`${drillRunId}-snap`, allResults) };
};

// ─── snapshot builder ───────────────────────────────────────────────────────

export const buildFaultDrillBaselineSnapshot = (
  snapshotId: string,
  results: readonly FaultDrillResult[]
): Phase6FaultDrillBaselineSnapshot => {
  const handled = results.filter(r => r.drillStatus === "handled_as_expected").length;
  const degraded = results.filter(r => r.drillStatus === "degraded_but_continued").length;
  const failed = results.filter(r => r.drillStatus === "failed_unexpectedly").length;

  const overallStatus: FaultDrillBaselineOverallStatus =
    failed > 0 ? "failed" : degraded > 0 ? "passed_with_notice" : "passed";

  return {
    snapshotId, scenarioCount: results.length,
    handledAsExpectedCount: handled, degradedButContinuedCount: degraded, failedUnexpectedlyCount: failed,
    results, overallStatus,
    summary: `Fault drill [${snapshotId}]: ${handled} handled, ${degraded} degraded, ${failed} failed, status=${overallStatus}`
  };
};

// ─── consistency helper ─────────────────────────────────────────────────────

export type FaultDrillConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const validateFaultDrillConsistency = (
  snapshot: Phase6FaultDrillBaselineSnapshot
): FaultDrillConsistencyResult => {
  const violations: string[] = [];

  if (snapshot.scenarioCount !== snapshot.handledAsExpectedCount + snapshot.degradedButContinuedCount + snapshot.failedUnexpectedlyCount) {
    violations.push("scenario count != handled + degraded + failed");
  }

  for (const r of snapshot.results) {
    if (r.traceSpanCount === 0) violations.push(`${r.scenarioId}: trace span count is 0`);
    if (r.metricCount === 0) violations.push(`${r.scenarioId}: metric count is 0`);
  }

  const dupScenario = snapshot.results.find(r => r.faultType === "duplicate_message" && r.targetPath === "orchestration");
  if (dupScenario && dupScenario.drillStatus !== "handled_as_expected") {
    violations.push("duplicate_message on orchestration should be handled_as_expected via idempotency");
  }

  const oooScenario = snapshot.results.find(r => r.faultType === "out_of_order_message" && r.targetPath === "replay");
  if (oooScenario && oooScenario.drillStatus === "failed_unexpectedly") {
    violations.push("out_of_order_message on replay should be structurally identified, not failed_unexpectedly");
  }

  if (snapshot.overallStatus === "passed" && snapshot.failedUnexpectedlyCount > 0) {
    violations.push("overallStatus passed but has failed_unexpectedly results");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};
