import type { RecoveryQueryDiagnostics } from "./sink-failure-recovery-record-model.js";

export type RecoveryQueryMetricLabels = {
  readonly outcome: "found" | "missing" | "unavailable";
  readonly statusCategory: "open" | "manually_resolved" | "none";
  readonly retryEligibilityCategory: "eligible_for_retry" | "manual_repair_only" | "not_applicable";
  readonly hasNote: "true" | "false";
  readonly fallbackApplied: "true" | "false";
};

export type RecoveryQueryMetricsProjection = {
  readonly metricName: "tianqi_recovery_query_total";
  readonly labels: RecoveryQueryMetricLabels;
  readonly value: 1;
};

export const projectRecoveryQueryToMetrics = (
  diagnostics: RecoveryQueryDiagnostics
): RecoveryQueryMetricsProjection => ({
  metricName: "tianqi_recovery_query_total",
  labels: {
    outcome: diagnostics.outcome,
    statusCategory: diagnostics.statusCategory,
    retryEligibilityCategory: diagnostics.retryEligibilityCategory,
    hasNote: diagnostics.hasNote ? "true" : "false",
    fallbackApplied: diagnostics.fallbackApplied ? "true" : "false"
  },
  value: 1
});
