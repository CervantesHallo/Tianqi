import type { Result } from "@tianqi/shared";

export type MetricsProjectionRecord = {
  readonly metricName: string;
  readonly labels: Record<string, string>;
  readonly value: number;
};

export type MetricsSinkError = {
  readonly message: string;
};

export type MetricsSinkPort = {
  record(metric: MetricsProjectionRecord): Promise<Result<void, MetricsSinkError>>;
};
