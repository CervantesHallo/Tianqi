import type {
  AuditEventSinkPort,
  CommandResultStorePort,
  MetricsSinkPort,
  SinkFailureRecoveryStorePort
} from "@tianqi/ports";
import type { CommandResultReference } from "@tianqi/shared";

import { dependencyFailureError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import { validateCommandResultSnapshotSchemaVersion } from "./command-result-snapshot-schema.js";
import type {
  CommandResultQueryObservability,
  CommandResultQueryResult,
  ResolvedCommandResultSnapshot
} from "./command-result-query-model.js";
import { projectCommandResultQueryToMetrics } from "./query-observation-metrics-projection.js";
import {
  createRecoveryRecordAppendedAuditEvent,
  createMetricsSinkFailureRecoveryContext,
  toOpenSinkFailureRecoveryRecord
} from "./sink-failure-recovery.js";

type CommandResultQueryCoreResult =
  | {
      readonly status: "found";
      readonly snapshot: ResolvedCommandResultSnapshot;
      readonly observability: CommandResultQueryObservability;
    }
  | {
      readonly status: "missing";
      readonly reference: CommandResultReference;
      readonly observability: CommandResultQueryObservability;
    }
  | {
      readonly status: "unavailable";
      readonly reference: CommandResultReference;
      readonly observability: CommandResultQueryObservability;
      readonly error: ApplicationError;
    };

export class CommandResultQueryHandler {
  private readonly commandResultStore: CommandResultStorePort;
  private readonly metricsSink: MetricsSinkPort;
  private readonly sinkFailureRecoveryStore: SinkFailureRecoveryStorePort;
  private readonly auditEventSink: AuditEventSinkPort;

  public constructor(
    commandResultStore: CommandResultStorePort,
    metricsSink: MetricsSinkPort,
    sinkFailureRecoveryStore: SinkFailureRecoveryStorePort,
    auditEventSink: AuditEventSinkPort
  ) {
    this.commandResultStore = commandResultStore;
    this.metricsSink = metricsSink;
    this.sinkFailureRecoveryStore = sinkFailureRecoveryStore;
    this.auditEventSink = auditEventSink;
  }

  public async getCommandResultByReference(
    reference: CommandResultReference
  ): Promise<CommandResultQueryResult> {
    const lookup = await this.commandResultStore.getByReference(reference);
    if (!lookup.ok) {
      const result: CommandResultQueryCoreResult = {
        status: "unavailable",
        reference,
        observability: {
          validation: "not_performed",
          versionMismatch: false,
          snapshotMissing: false,
          fallbackApplied: false
        },
        error: dependencyFailureError("Failed to load command result by reference", {
          reference,
          message: lookup.error.message
        })
      };
      return this.attachMetricsSink(result);
    }

    if (lookup.value.status === "missing") {
      const result: CommandResultQueryCoreResult = {
        status: "missing",
        reference,
        observability: {
          validation: "not_performed",
          versionMismatch: false,
          snapshotMissing: true,
          fallbackApplied: false
        }
      };
      return this.attachMetricsSink(result);
    }

    const snapshot = lookup.value.snapshot;
    const version = validateCommandResultSnapshotSchemaVersion(snapshot.schemaVersion);
    if (!version.ok) {
      const validation =
        version.error.code === "TQ-APP-007" ? "missing_version" : "unsupported_version";
      const result: CommandResultQueryCoreResult = {
        status: "unavailable",
        reference,
        observability: {
          validation,
          versionMismatch: validation === "unsupported_version",
          snapshotMissing: false,
          fallbackApplied: false
        },
        error: version.error
      };
      return this.attachMetricsSink(result);
    }

    const resolvedSnapshotBase = {
      schemaVersion: version.value,
      reference: snapshot.reference,
      commandName: snapshot.commandName,
      riskCase: snapshot.riskCase,
      events: snapshot.events,
      processing: snapshot.processing
    };
    const result: CommandResultQueryCoreResult = {
      status: "found",
      observability: {
        validation: "passed",
        versionMismatch: false,
        snapshotMissing: false,
        fallbackApplied: false
      },
      snapshot: {
        ...resolvedSnapshotBase,
        ...(snapshot.transition ? { transition: snapshot.transition } : {}),
        ...(snapshot.compensation ? { compensation: snapshot.compensation } : {})
      }
    };
    return this.attachMetricsSink(result);
  }

  private async attachMetricsSink(
    result: CommandResultQueryCoreResult
  ): Promise<CommandResultQueryResult> {
    const sinkAttemptedAt = new Date().toISOString();
    const resultReference = result.status === "found" ? result.snapshot.reference : result.reference;
    const projection = projectCommandResultQueryToMetrics({
      status: result.status,
      observability: result.observability
    });
    const sinkCall = await this.metricsSink.record({
      metricName: projection.metricName,
      labels: projection.labels,
      value: projection.value
    });

    if (sinkCall.ok) {
      return {
        ...result,
        metricsSink: { status: "succeeded", retryEligibility: "not_applicable" }
      };
    }

    const recoveryContext = createMetricsSinkFailureRecoveryContext({
      resultReference,
      failedAt: sinkAttemptedAt
    });
    const recoveryAppend = await this.sinkFailureRecoveryStore.append(
      toOpenSinkFailureRecoveryRecord(recoveryContext)
    );
    const recovery = recoveryAppend.ok
      ? await (async () => {
          const auditEvent = createRecoveryRecordAppendedAuditEvent(recoveryContext);
          const auditSink = await this.auditEventSink.append({
            eventType: auditEvent.eventType,
            occurredAt: auditEvent.occurredAt,
            traceId: auditEvent.traceId,
            payload: {
              eventKind: auditEvent.eventKind,
              recoveryReference: auditEvent.recoveryReference,
              ...(auditEvent.beforeStatus ? { beforeStatus: auditEvent.beforeStatus } : {}),
              afterStatus: auditEvent.afterStatus,
              sinkKind: auditEvent.sinkKind,
              resultReference: auditEvent.resultReference,
              ...(auditEvent.caseId ? { caseId: auditEvent.caseId } : {}),
              ...(auditEvent.note ? { note: auditEvent.note } : {})
            }
          });
          return {
            ...recoveryContext,
            recoveryRecord: { status: "persisted" as const },
            auditEvents: [auditEvent],
            auditSink: auditSink.ok
              ? ({ status: "succeeded" } as const)
              : ({ status: "failed", errorSummary: auditSink.error.message } as const)
          };
        })()
      : {
          ...recoveryContext,
          recoveryRecord: {
            status: "persist_failed" as const,
            errorSummary: recoveryAppend.error.message
          },
          auditEvents: [],
          auditSink: { status: "not_attempted" as const }
        };

    return {
      ...result,
      metricsSink: {
        status: "failed",
        retryEligibility: recovery.retryEligibility,
        errorSummary: sinkCall.error.message,
        recovery
      }
    };
  }
}
