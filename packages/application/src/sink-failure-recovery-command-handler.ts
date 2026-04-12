import type { AuditEventSinkPort, SinkFailureRecoveryStorePort } from "@tianqi/ports";

import {
  dependencyFailureError,
  invalidApplicationCommandError,
  resourceNotFoundError
} from "./application-error.js";
import type { MarkSinkFailureManuallyResolvedCommand } from "./mark-sink-failure-manually-resolved-command.js";
import {
  createRecoveryRecordChangedAuditEvent,
  RECOVERY_RECORD_AUDIT_EVENT_KINDS
} from "./recovery-record-audit-event.js";
import type { MarkSinkFailureManuallyResolvedResult } from "./sink-failure-recovery-record-model.js";
import { toSinkFailureRecoveryRecordView } from "./sink-failure-recovery-record-model.js";

export class SinkFailureRecoveryCommandHandler {
  private readonly sinkFailureRecoveryStore: SinkFailureRecoveryStorePort;
  private readonly auditEventSink: AuditEventSinkPort;

  public constructor(
    sinkFailureRecoveryStore: SinkFailureRecoveryStorePort,
    auditEventSink: AuditEventSinkPort
  ) {
    this.sinkFailureRecoveryStore = sinkFailureRecoveryStore;
    this.auditEventSink = auditEventSink;
  }

  public async markManuallyResolved(
    command: MarkSinkFailureManuallyResolvedCommand
  ): Promise<MarkSinkFailureManuallyResolvedResult> {
    const normalizedNote = command.note?.trim();
    if (command.note !== undefined && normalizedNote?.length === 0) {
      return {
        success: false,
        state: "invalid_transition",
        auditEvents: [],
        auditSink: { status: "not_attempted" },
        error: invalidApplicationCommandError("Manual resolution note must be non-empty when provided", {
          recoveryReference: command.recoveryReference
        })
      };
    }

    const lookup = await this.sinkFailureRecoveryStore.getByRecoveryReference(command.recoveryReference);
    if (!lookup.ok) {
      return {
        success: false,
        state: "unavailable",
        auditEvents: [],
        auditSink: { status: "not_attempted" },
        error: dependencyFailureError("Failed to query recovery record before manual resolution", {
          recoveryReference: command.recoveryReference,
          message: lookup.error.message
        })
      };
    }

    if (lookup.value.status === "missing") {
      return {
        success: false,
        state: "missing",
        auditEvents: [],
        auditSink: { status: "not_attempted" },
        error: resourceNotFoundError("Recovery record not found for manual resolution", {
          recoveryReference: command.recoveryReference
        })
      };
    }

    if (lookup.value.record.status !== "open") {
      return {
        success: false,
        state: "invalid_transition",
        auditEvents: [],
        auditSink: { status: "not_attempted" },
        error: invalidApplicationCommandError("Recovery record is not open for manual resolution", {
          recoveryReference: command.recoveryReference,
          currentStatus: lookup.value.record.status
        })
      };
    }

    const resolvedAt = new Date().toISOString();
    const updatedRecord = {
      ...lookup.value.record,
      status: "manually_resolved" as const,
      traceId: command.traceId,
      ...(normalizedNote ? { note: normalizedNote } : {})
    };

    const appended = await this.sinkFailureRecoveryStore.append(updatedRecord);
    if (!appended.ok) {
      return {
        success: false,
        state: "unavailable",
        auditEvents: [],
        auditSink: { status: "not_attempted" },
        error: dependencyFailureError("Failed to persist manual resolution for recovery record", {
          recoveryReference: command.recoveryReference,
          message: appended.error.message
        })
      };
    }

    const auditEvent = createRecoveryRecordChangedAuditEvent({
      eventKind: RECOVERY_RECORD_AUDIT_EVENT_KINDS.RecoveryRecordManuallyResolved,
      recoveryReference: updatedRecord.recoveryReference,
      beforeStatus: "open",
      afterStatus: "manually_resolved",
      sinkKind: updatedRecord.sinkKind,
      resultReference: updatedRecord.resultReference,
      ...(updatedRecord.caseId ? { caseId: updatedRecord.caseId } : {}),
      traceId: command.traceId,
      occurredAt: resolvedAt,
      ...(normalizedNote ? { note: normalizedNote } : {})
    });
    const auditEvents = [auditEvent] as const;
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
      success: true,
      record: toSinkFailureRecoveryRecordView(updatedRecord),
      auditEvents,
      auditSink: auditSink.ok
        ? { status: "succeeded" }
        : { status: "failed", errorSummary: auditSink.error.message }
    };
  }
}
