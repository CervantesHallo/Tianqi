import type { Result } from "@tianqi/shared";
import { ok } from "@tianqi/shared";

// ─── metric record ──────────────────────────────────────────────────────────

export type MetricType = "counter" | "gauge" | "histogram";

export type MetricRecord = {
  readonly metricName: string;
  readonly metricType: MetricType;
  readonly value: number;
  readonly unit: string;
  readonly tags: Record<string, string>;
  readonly recordedAt: string;
  readonly traceId: string;
  readonly caseId: string | null;
};

// ─── port ───────────────────────────────────────────────────────────────────

export type MetricsPortError = {
  readonly code: string;
  readonly type: "metrics_port_unavailable" | "metrics_record_invalid";
  readonly message: string;
};

export type MetricsPort = {
  record(metric: MetricRecord): Result<void, MetricsPortError>;
  getRecorded(): readonly MetricRecord[];
};

// ─── in-memory implementation ───────────────────────────────────────────────

export const createInMemoryMetricsPort = (): MetricsPort => {
  const records: MetricRecord[] = [];

  return {
    record(metric) {
      records.push(metric);
      return ok(undefined);
    },
    getRecorded() {
      return records;
    }
  };
};

// ─── metric builders ────────────────────────────────────────────────────────

export const buildCounterMetric = (
  name: string, traceId: string, tags: Record<string, string>, caseId?: string
): MetricRecord => ({
  metricName: name, metricType: "counter", value: 1, unit: "count",
  tags, recordedAt: new Date().toISOString(), traceId, caseId: caseId ?? null
});

export const buildLatencyMetric = (
  name: string, durationMs: number, traceId: string, tags: Record<string, string>, caseId?: string
): MetricRecord => ({
  metricName: name, metricType: "histogram", value: durationMs, unit: "ms",
  tags, recordedAt: new Date().toISOString(), traceId, caseId: caseId ?? null
});
