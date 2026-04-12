import type { CommandResultQueryObservability } from "./command-result-query-model.js";

export type QueryObservationMetricLabels = {
  readonly outcome: "found" | "missing" | "unavailable";
  readonly validation: "passed" | "missing_version" | "unsupported_version" | "not_performed";
  readonly versionMismatch: "true" | "false";
  readonly snapshotMissing: "true" | "false";
  readonly fallbackApplied: "true" | "false";
};

export type ObservabilityMetricsProjection = {
  readonly metricName: "tianqi_command_result_query_total";
  readonly labels: QueryObservationMetricLabels;
  readonly value: 1;
};

export type QueryObservationMetricSource = {
  readonly status: "found" | "missing" | "unavailable";
  readonly observability: CommandResultQueryObservability;
};

export const projectCommandResultQueryToMetrics = (
  result: QueryObservationMetricSource
): ObservabilityMetricsProjection => ({
  metricName: "tianqi_command_result_query_total",
  labels: {
    outcome: result.status,
    validation: result.observability.validation,
    versionMismatch: result.observability.versionMismatch ? "true" : "false",
    snapshotMissing: result.observability.snapshotMissing ? "true" : "false",
    fallbackApplied: result.observability.fallbackApplied ? "true" : "false"
  },
  value: 1
});
