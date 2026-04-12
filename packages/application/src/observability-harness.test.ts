import { describe, expect, it } from "vitest";
import { ok } from "@tianqi/shared";
import { startTraceContext, deriveChildTraceContext, buildTraceContextSummary } from "./trace-context.js";
import { createInMemoryMetricsPort, buildCounterMetric, buildLatencyMetric } from "./metrics-port.js";
import type { MetricRecord } from "./metrics-port.js";
import { runBenchmark, validateObservabilityConsistency } from "./benchmark-harness.js";
import type { BenchmarkScenario } from "./benchmark-harness.js";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView } from "./orchestration-ports.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import { runCaseReplay } from "./case-replay-handler.js";

const T = "2026-03-25T00:00:00.000Z";

// ─── tracing ────────────────────────────────────────────────────────────────

describe("TraceContext: creation and propagation", () => {
  it("creates root trace with all fields", () => {
    const root = startTraceContext("tr-1", "orchestrator", "execute", { caseId: "c1", requestId: "r1", startedAt: T });
    expect(root.traceId).toBe("tr-1");
    expect(root.parentSpanId).toBeNull();
    expect(root.caseId).toBe("c1");
    expect(root.module).toBe("orchestrator");
    expect(root.action).toBe("execute");
  });

  it("derives child with parent reference", () => {
    const root = startTraceContext("tr-2", "orchestrator", "execute", { startedAt: T });
    const child = deriveChildTraceContext(root, "saga", "load_case", T);
    expect(child.traceId).toBe("tr-2");
    expect(child.parentSpanId).toBe(root.spanId);
    expect(child.module).toBe("saga");
    expect(child.spanId).not.toBe(root.spanId);
  });

  it("builds trace summary", () => {
    const root = startTraceContext("tr-3", "orchestrator", "start", { startedAt: T });
    const c1 = deriveChildTraceContext(root, "saga", "step_1", T);
    const c2 = deriveChildTraceContext(root, "saga", "step_2", T);
    const summary = buildTraceContextSummary(root, [c1, c2]);
    expect(summary.traceId).toBe("tr-3");
    expect(summary.totalSpans).toBe(3);
    expect(summary.modules).toContain("orchestrator");
    expect(summary.modules).toContain("saga");
    expect(summary.actions).toEqual(["start", "step_1", "step_2"]);
  });
});

// ─── metrics ────────────────────────────────────────────────────────────────

describe("MetricsPort: in-memory", () => {
  it("records and retrieves metrics", () => {
    const port = createInMemoryMetricsPort();
    const metric = buildCounterMetric("orchestration.request", "tr-1", { module: "orchestrator" }, "c1");
    const r = port.record(metric);
    expect(r.ok).toBe(true);
    expect(port.getRecorded().length).toBe(1);
    expect(port.getRecorded()[0]!.metricName).toBe("orchestration.request");
  });

  it("counter metric has correct fields", () => {
    const m = buildCounterMetric("test.counter", "tr-x", { action: "test" });
    expect(m.metricType).toBe("counter");
    expect(m.value).toBe(1);
    expect(m.unit).toBe("count");
  });

  it("latency metric has correct fields", () => {
    const m = buildLatencyMetric("test.latency", 42.5, "tr-x", { step: "load" }, "c1");
    expect(m.metricType).toBe("histogram");
    expect(m.value).toBe(42.5);
    expect(m.unit).toBe("ms");
    expect(m.caseId).toBe("c1");
  });
});

// ─── Phase 4 orchestration with trace + metrics ─────────────────────────────

describe("Phase 4 orchestration: trace + metrics integration", () => {
  const CASE_VIEW: RiskCaseView = { caseId: "c1", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL", configVersion: "1.0.0", createdAt: T };
  const ACTIVE_CONFIG: ActivePolicyConfigView = {
    configVersion: "1.0.0", rankingPolicyName: "v1", rankingPolicyVersion: "1.0.0",
    fundWaterfallPolicyName: "v1", fundWaterfallPolicyVersion: "1.0.0",
    candidateSelectionPolicyName: "v1", candidateSelectionPolicyVersion: "1.0.0"
  };

  it("orchestration path can be traced and metered", () => {
    const metricsPort = createInMemoryMetricsPort();
    const traceRoot = startTraceContext("orch-tr-1", "orchestrator", "execute_risk_case", { caseId: "c1", requestId: "r1", startedAt: T });
    const children = [
      deriveChildTraceContext(traceRoot, "saga", "load_case", T),
      deriveChildTraceContext(traceRoot, "saga", "resolve_bundle", T),
      deriveChildTraceContext(traceRoot, "saga", "finalize", T)
    ];

    const ports: OrchestrationPorts = {
      caseRepository: { loadCase: () => ok(CASE_VIEW) },
      liquidationCaseRepository: { loadCase: () => ok(null) },
      policyConfig: { getActivePolicyConfig: () => ok(ACTIVE_CONFIG) },
      policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies" }) },
      strategyExecution: {
        executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
        executeRanking: () => ok({ rankedCount: 5, summary: "ok" }),
        executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "ok" })
      },
      audit: { publishAuditEvent: () => ok(undefined) }
    };

    const idem = createOrchestrationIdempotencyRegistry();
    const replay = createOrchestrationResultReplayRegistry();
    const result = executeRiskCaseOrchestration(
      { orchestrationId: "orch-1", caseId: "c1", requestId: "r1", triggeredBy: "test", triggeredAt: T },
      ports, idem, replay
    );
    expect(result.ok).toBe(true);

    metricsPort.record(buildCounterMetric("orchestration.request", traceRoot.traceId, { module: "orchestrator" }, "c1"));
    metricsPort.record(buildCounterMetric("orchestration.success", traceRoot.traceId, { module: "orchestrator" }, "c1"));
    metricsPort.record(buildLatencyMetric("orchestration.duration", 12.5, traceRoot.traceId, { module: "orchestrator" }, "c1"));

    expect(metricsPort.getRecorded().length).toBe(3);
    for (const m of metricsPort.getRecorded()) {
      expect(m.traceId).toBe("orch-tr-1");
      expect(m.caseId).toBe("c1");
    }

    const summary = buildTraceContextSummary(traceRoot, children);
    expect(summary.traceId).toBe("orch-tr-1");
    expect(summary.totalSpans).toBe(4);
  });
});

// ─── Phase 5 replay with trace + metrics ────────────────────────────────────

describe("Phase 5 replay: trace + metrics integration", () => {
  it("replay path can be traced and metered", () => {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", "orch-rp", "c-rp", T, {}));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", "orch-rp", "c-rp", T, { step: "load" }));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-rp", "c-rp", T, {}));

    const metricsPort = createInMemoryMetricsPort();
    const traceRoot = startTraceContext("replay-tr-1", "replayer", "replay_case", { caseId: "c-rp", startedAt: T });
    const children = [
      deriveChildTraceContext(traceRoot, "replayer", "load_events", T),
      deriveChildTraceContext(traceRoot, "replayer", "reconstruct", T)
    ];

    const result = runCaseReplay({ caseId: "c-rp", replayReason: "test", traceId: "replay-tr-1", replayRequestedAt: T }, store);
    expect(result.ok).toBe(true);

    metricsPort.record(buildCounterMetric("replay.request", traceRoot.traceId, { module: "replayer" }, "c-rp"));
    metricsPort.record(buildCounterMetric("replay.success", traceRoot.traceId, { module: "replayer" }, "c-rp"));
    metricsPort.record(buildLatencyMetric("reconstruction.duration", 3.2, traceRoot.traceId, { module: "replayer" }, "c-rp"));

    expect(metricsPort.getRecorded().length).toBe(3);
    for (const m of metricsPort.getRecorded()) {
      expect(m.traceId).toBe("replay-tr-1");
    }

    const summary = buildTraceContextSummary(traceRoot, children);
    expect(summary.totalSpans).toBe(3);
    expect(summary.modules).toContain("replayer");
  });
});

// ─── benchmark harness ──────────────────────────────────────────────────────

describe("BenchmarkHarness: execution", () => {
  it("B1: orchestration benchmark runs and produces result", () => {
    const scenario: BenchmarkScenario<boolean> = {
      scenarioName: "orchestration_path",
      iterations: 10,
      setup: () => {},
      run: () => {
        const ports: OrchestrationPorts = {
          caseRepository: { loadCase: () => ok({ caseId: "c1", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL", configVersion: "1.0.0", createdAt: T }) },
          liquidationCaseRepository: { loadCase: () => ok(null) },
          policyConfig: { getActivePolicyConfig: () => ok({ configVersion: "1.0.0", rankingPolicyName: "v1", rankingPolicyVersion: "1.0.0", fundWaterfallPolicyName: "v1", fundWaterfallPolicyVersion: "1.0.0", candidateSelectionPolicyName: "v1", candidateSelectionPolicyVersion: "1.0.0" }) },
          policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3" }) },
          strategyExecution: {
            executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
            executeRanking: () => ok({ rankedCount: 5, summary: "ok" }),
            executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "ok" })
          },
          audit: { publishAuditEvent: () => ok(undefined) }
        };
        const idem = createOrchestrationIdempotencyRegistry();
        const replay = createOrchestrationResultReplayRegistry();
        const r = executeRiskCaseOrchestration(
          { orchestrationId: `bench-${Math.random()}`, caseId: "c1", requestId: `r-${Math.random()}`, triggeredBy: "bench", triggeredAt: T },
          ports, idem, replay
        );
        return r.ok;
      }
    };

    const result = runBenchmark("b1-orch", scenario, v => v === true);
    expect(result.successCount).toBe(10);
    expect(result.failureCount).toBe(0);
    expect(result.avgDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.summary).toContain("10/10");
  });

  it("B2: replay benchmark runs and produces result", () => {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", "orch-b2", "c-b2", T, {}));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-b2", "c-b2", T, {}));

    const scenario: BenchmarkScenario<boolean> = {
      scenarioName: "replay_path",
      iterations: 10,
      setup: () => {},
      run: () => {
        const r = runCaseReplay({ caseId: "c-b2", replayReason: "bench", traceId: "bench-tr", replayRequestedAt: T }, store);
        return r.ok;
      }
    };

    const result = runBenchmark("b2-replay", scenario, v => v === true);
    expect(result.successCount).toBe(10);
    expect(result.failureCount).toBe(0);
    expect(result.summary).toContain("replay_path");
  });

  it("benchmark captures failures without swallowing them", () => {
    let callCount = 0;
    const scenario: BenchmarkScenario<boolean> = {
      scenarioName: "fail_scenario",
      iterations: 5,
      setup: () => { callCount = 0; },
      run: () => { callCount++; return callCount <= 2; }
    };

    const result = runBenchmark("b-fail", scenario, v => v === true);
    expect(result.successCount).toBe(2);
    expect(result.failureCount).toBe(3);
    expect(result.iterations).toBe(5);
  });
});

// ─── observability consistency ──────────────────────────────────────────────

describe("ObservabilityConsistency: validation", () => {
  it("clean data is consistent", () => {
    const traces = [startTraceContext("tr-c", "mod", "act", { startedAt: T })];
    const metrics: MetricRecord[] = [buildCounterMetric("test", "tr-c", { module: "mod" })];
    const benchmarks = [{ benchmarkId: "b", scenarioName: "s", iterations: 5, successCount: 5, failureCount: 0, totalDurationMs: 10, avgDurationMs: 2, minDurationMs: 1, maxDurationMs: 3, summary: "ok" }];

    const c = validateObservabilityConsistency(traces, metrics, benchmarks);
    expect(c.consistent).toBe(true);
    expect(c.checkedInvariants).toBe(5);
  });

  it("missing traceId in trace context is a violation", () => {
    const traces = [{ ...startTraceContext("", "mod", "act", { startedAt: T }), traceId: "" }];
    const c = validateObservabilityConsistency(traces, [], []);
    expect(c.consistent).toBe(false);
    expect(c.violations.some(v => v.includes("traceId"))).toBe(true);
  });

  it("metric traceId not in trace contexts is a violation", () => {
    const traces = [startTraceContext("tr-a", "mod", "act", { startedAt: T })];
    const metrics: MetricRecord[] = [buildCounterMetric("test", "tr-unknown", { module: "mod" })];
    const c = validateObservabilityConsistency(traces, metrics, []);
    expect(c.consistent).toBe(false);
  });

  it("benchmark success+failure != iterations is a violation", () => {
    const benchmarks = [{ benchmarkId: "b", scenarioName: "s", iterations: 5, successCount: 3, failureCount: 1, totalDurationMs: 10, avgDurationMs: 2, minDurationMs: 1, maxDurationMs: 3, summary: "ok" }];
    const c = validateObservabilityConsistency([], [], benchmarks);
    expect(c.consistent).toBe(false);
  });
});
