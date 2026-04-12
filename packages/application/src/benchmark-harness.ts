// Minimal benchmark harness for critical path performance baselines.
// Single-process, single-machine; designed for regression comparison.

export type BenchmarkScenario<T> = {
  readonly scenarioName: string;
  readonly iterations: number;
  readonly setup: () => void;
  readonly run: () => T;
};

export type BenchmarkResult = {
  readonly benchmarkId: string;
  readonly scenarioName: string;
  readonly iterations: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly totalDurationMs: number;
  readonly avgDurationMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  readonly summary: string;
};

export const runBenchmark = <T>(
  benchmarkId: string,
  scenario: BenchmarkScenario<T>,
  validateResult?: (result: T) => boolean
): BenchmarkResult => {
  scenario.setup();

  const durations: number[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < scenario.iterations; i++) {
    const start = Date.now();
    try {
      const result = scenario.run();
      const elapsed = Date.now() - start;
      durations.push(elapsed);
      if (validateResult && !validateResult(result)) failureCount++;
      else successCount++;
    } catch {
      durations.push(Date.now() - start);
      failureCount++;
    }
  }

  const totalDurationMs = durations.reduce((a, b) => a + b, 0);
  const avgDurationMs = durations.length > 0 ? totalDurationMs / durations.length : 0;
  const sorted = [...durations].sort((a, b) => a - b);
  const minDurationMs = sorted[0] ?? 0;
  const maxDurationMs = sorted[sorted.length - 1] ?? 0;

  return {
    benchmarkId,
    scenarioName: scenario.scenarioName,
    iterations: scenario.iterations,
    successCount,
    failureCount,
    totalDurationMs: Math.round(totalDurationMs * 100) / 100,
    avgDurationMs: Math.round(avgDurationMs * 100) / 100,
    minDurationMs: Math.round(minDurationMs * 100) / 100,
    maxDurationMs: Math.round(maxDurationMs * 100) / 100,
    summary: `Benchmark [${benchmarkId}] ${scenario.scenarioName}: ${successCount}/${scenario.iterations} succeeded, avg=${Math.round(avgDurationMs * 100) / 100}ms`
  };
};

// ─── observability consistency ──────────────────────────────────────────────

import type { MetricRecord } from "./metrics-port.js";
import type { TraceContext } from "./trace-context.js";

export type ObservabilityConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const validateObservabilityConsistency = (
  traceContexts: readonly TraceContext[],
  metrics: readonly MetricRecord[],
  benchmarks: readonly BenchmarkResult[]
): ObservabilityConsistencyResult => {
  const violations: string[] = [];

  for (const tc of traceContexts) {
    if (!tc.traceId || tc.traceId.length === 0) violations.push(`Trace context missing traceId: spanId=${tc.spanId}`);
  }

  for (const m of metrics) {
    if (!m.traceId || m.traceId.length === 0) violations.push(`Metric ${m.metricName} missing traceId`);
  }

  const traceIds = new Set(traceContexts.map(t => t.traceId));
  for (const m of metrics) {
    if (m.traceId && traceIds.size > 0 && !traceIds.has(m.traceId)) {
      violations.push(`Metric ${m.metricName} traceId ${m.traceId} not found in trace contexts`);
    }
  }

  for (const b of benchmarks) {
    if (b.successCount + b.failureCount !== b.iterations) {
      violations.push(`Benchmark ${b.benchmarkId}: success ${b.successCount} + failure ${b.failureCount} != iterations ${b.iterations}`);
    }
  }

  for (const b of benchmarks) {
    if (b.failureCount > 0 && b.summary.includes("0 failed")) {
      violations.push(`Benchmark ${b.benchmarkId}: failures hidden in summary`);
    }
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 5 };
};
