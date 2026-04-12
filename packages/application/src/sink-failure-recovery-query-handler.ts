import type { MetricsSinkPort, SinkFailureRecoveryStorePort } from "@tianqi/ports";
import type { SinkRecoveryReferenceId } from "@tianqi/shared";

import { dependencyFailureError } from "./application-error.js";
import { projectRecoveryQueryToMetrics } from "./recovery-query-diagnostics-metrics-projection.js";
import type {
  RecoveryQueryDiagnostics,
  SinkFailureRecoveryQueryResultWithDiagnostics
} from "./sink-failure-recovery-record-model.js";
import { toSinkFailureRecoveryRecordView } from "./sink-failure-recovery-record-model.js";

export class SinkFailureRecoveryQueryHandler {
  private readonly sinkFailureRecoveryStore: SinkFailureRecoveryStorePort;
  private readonly metricsSink: MetricsSinkPort;

  public constructor(
    sinkFailureRecoveryStore: SinkFailureRecoveryStorePort,
    metricsSink: MetricsSinkPort
  ) {
    this.sinkFailureRecoveryStore = sinkFailureRecoveryStore;
    this.metricsSink = metricsSink;
  }

  public async getByRecoveryReference(
    recoveryReference: SinkRecoveryReferenceId
  ): Promise<SinkFailureRecoveryQueryResultWithDiagnostics> {
    const lookup = await this.sinkFailureRecoveryStore.getByRecoveryReference(recoveryReference);
    if (!lookup.ok) {
      const result: SinkFailureRecoveryQueryResultWithDiagnostics = {
        status: "unavailable",
        recoveryReference,
        diagnostics: {
          outcome: "unavailable",
          statusCategory: "none",
          retryEligibilityCategory: "not_applicable",
          hasNote: false,
          storeAccessed: true,
          fallbackApplied: false
        },
        metricsSink: { status: "not_attempted" },
        error: dependencyFailureError("Failed to query sink failure recovery record", {
          recoveryReference,
          message: lookup.error.message
        })
      };
      return this.attachMetricsSink(result);
    }

    if (lookup.value.status === "missing") {
      const result: SinkFailureRecoveryQueryResultWithDiagnostics = {
        status: "missing",
        recoveryReference,
        diagnostics: {
          outcome: "missing",
          statusCategory: "none",
          retryEligibilityCategory: "not_applicable",
          hasNote: false,
          storeAccessed: true,
          fallbackApplied: false
        },
        metricsSink: { status: "not_attempted" }
      };
      return this.attachMetricsSink(result);
    }

    const record = toSinkFailureRecoveryRecordView(lookup.value.record);
    const diagnostics: RecoveryQueryDiagnostics = {
      outcome: "found",
      statusCategory: record.status,
      retryEligibilityCategory: record.retryEligibility,
      hasNote: record.note !== undefined,
      storeAccessed: true,
      fallbackApplied: false
    };
    const result: SinkFailureRecoveryQueryResultWithDiagnostics = {
      status: "found",
      record,
      diagnostics,
      metricsSink: { status: "not_attempted" }
    };
    return this.attachMetricsSink(result);
  }

  private async attachMetricsSink(
    result: SinkFailureRecoveryQueryResultWithDiagnostics
  ): Promise<SinkFailureRecoveryQueryResultWithDiagnostics> {
    const projection = projectRecoveryQueryToMetrics(result.diagnostics);
    const sinkCall = await this.metricsSink.record({
      metricName: projection.metricName,
      labels: projection.labels,
      value: projection.value
    });
    return sinkCall.ok
      ? {
          ...result,
          metricsSink: { status: "succeeded" }
        }
      : {
          ...result,
          metricsSink: { status: "failed", errorSummary: sinkCall.error.message }
        };
  }
}
