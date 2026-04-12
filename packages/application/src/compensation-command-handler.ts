import type {
  AuditEventSinkPort,
  CompensationRecordMutationPort,
  CompensationRecordStorePort,
  SinkFailureRecoveryStorePort
} from "@tianqi/ports";

import { dependencyFailureError, invalidApplicationCommandError, resourceNotFoundError } from "./application-error.js";
import { createCompensationStatusChangedAuditEvent } from "./compensation-audit-event.js";
import type {
  MarkCompensationManualInterventionRequiredCommand,
  ResolveCompensationCommand
} from "./compensation-command.js";
import type { CompensationCommandResult } from "./compensation-command-result.js";
import { canTransitionCompensationStatus, COMPENSATION_STATUSES } from "./compensation-state.js";
import {
  createRecoveryRecordAppendedAuditEvent,
  createAuditSinkFailureRecoveryContext,
  toOpenSinkFailureRecoveryRecord
} from "./sink-failure-recovery.js";

type CompensationCommandHandlerDependencies = {
  readonly compensationQueryStore: CompensationRecordStorePort;
  readonly compensationMutationStore: CompensationRecordMutationPort;
  readonly auditEventSink: AuditEventSinkPort;
  readonly sinkFailureRecoveryStore: SinkFailureRecoveryStorePort;
};

export class CompensationCommandHandler {
  private readonly compensationQueryStore: CompensationRecordStorePort;
  private readonly compensationMutationStore: CompensationRecordMutationPort;
  private readonly auditEventSink: AuditEventSinkPort;
  private readonly sinkFailureRecoveryStore: SinkFailureRecoveryStorePort;

  public constructor(dependencies: CompensationCommandHandlerDependencies) {
    this.compensationQueryStore = dependencies.compensationQueryStore;
    this.compensationMutationStore = dependencies.compensationMutationStore;
    this.auditEventSink = dependencies.auditEventSink;
    this.sinkFailureRecoveryStore = dependencies.sinkFailureRecoveryStore;
  }

  public async resolveCompensation(
    command: ResolveCompensationCommand
  ): Promise<CompensationCommandResult> {
    // This command only confirms a single compensation record is resolved.
    // It does not run any automatic retry workflow in current phase.
    return this.changeStatus(command, COMPENSATION_STATUSES.Resolved, "ResolveCompensationCommand");
  }

  public async markManualInterventionRequired(
    command: MarkCompensationManualInterventionRequiredCommand
  ): Promise<CompensationCommandResult> {
    // This command only escalates the record to manual intervention marker.
    // It does not integrate with a real ticket/work-order system in current phase.
    return this.changeStatus(
      command,
      COMPENSATION_STATUSES.ManualInterventionRequired,
      "MarkCompensationManualInterventionRequiredCommand"
    );
  }

  private async changeStatus(
    command: {
      readonly resultReference: ResolveCompensationCommand["resultReference"];
      readonly reason: string;
      readonly traceId: string;
    },
    targetStatus: "resolved" | "manual_intervention_required",
    commandName: string
  ): Promise<CompensationCommandResult> {
    const normalizedReason = command.reason.trim();
    if (normalizedReason.length === 0) {
      return {
        success: false,
        state: "invalid_transition",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: invalidApplicationCommandError("Compensation command reason must be non-empty", {
          commandName
        })
      };
    }

    const lookup = await this.compensationQueryStore.getOne({
      by: "reference",
      resultReference: command.resultReference
    });
    if (!lookup.ok) {
      return {
        success: false,
        state: "unavailable",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: dependencyFailureError("Failed to load compensation record before mutation", {
          commandName,
          reference: command.resultReference,
          message: lookup.error.message
        })
      };
    }

    if (lookup.value.status === "missing") {
      return {
        success: false,
        state: "missing",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: resourceNotFoundError("Compensation record not found", {
          commandName,
          reference: command.resultReference
        })
      };
    }

    const current = lookup.value.record;
    if (!canTransitionCompensationStatus(current.status, targetStatus)) {
      return {
        success: false,
        state: "invalid_transition",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: invalidApplicationCommandError("Illegal compensation status transition", {
          commandName,
          fromStatus: current.status,
          toStatus: targetStatus
        })
      };
    }

    const mutated = await this.compensationMutationStore.updateOne({
      resultReference: command.resultReference,
      targetStatus,
      reason: normalizedReason,
      traceId: command.traceId
    });
    if (!mutated.ok) {
      return {
        success: false,
        state: "unavailable",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: dependencyFailureError("Failed to mutate compensation record", {
          commandName,
          reference: command.resultReference,
          message: mutated.error.message
        })
      };
    }

    if (mutated.value.status === "missing") {
      return {
        success: false,
        state: "missing",
        auditEvents: [],
        auditSink: { status: "not_attempted", retryEligibility: "not_applicable" },
        error: resourceNotFoundError("Compensation record missing during mutation", {
          commandName,
          reference: command.resultReference
        })
      };
    }

    const auditEvent = createCompensationStatusChangedAuditEvent({
      resultReference: command.resultReference,
      caseId: mutated.value.record.caseId,
      commandName,
      beforeStatus: current.status,
      afterStatus: mutated.value.record.status,
      reason: normalizedReason,
      traceId: command.traceId,
      occurredAt: mutated.value.record.updatedAt
    });
    const auditEvents = [auditEvent] as const;

    const auditSinkCall = await this.auditEventSink.append({
      eventType: auditEvent.eventType,
      occurredAt: auditEvent.occurredAt,
      traceId: auditEvent.traceId,
      payload: {
        resultReference: auditEvent.resultReference,
        caseId: auditEvent.caseId,
        commandName: auditEvent.commandName,
        beforeStatus: auditEvent.beforeStatus,
        afterStatus: auditEvent.afterStatus,
        reason: auditEvent.reason
      }
    });

    if (auditSinkCall.ok) {
      return {
        success: true,
        auditEvents,
        auditSink: { status: "succeeded", retryEligibility: "not_applicable" },
        transition: {
          fromStatus: current.status,
          toStatus: mutated.value.record.status
        },
        record: {
          commandName: mutated.value.record.commandName,
          caseId: mutated.value.record.caseId,
          status: mutated.value.record.status,
          reason: mutated.value.record.reason,
          ...(mutated.value.record.resultReference
            ? { resultReference: mutated.value.record.resultReference }
            : {}),
          updatedAt: mutated.value.record.updatedAt
        }
      };
    }

    const recoveryContext = createAuditSinkFailureRecoveryContext({
      sourceCommandName: commandName,
      caseId: mutated.value.record.caseId,
      resultReference: command.resultReference,
      failedAt: auditEvent.occurredAt,
      traceId: command.traceId
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
      success: true,
      auditEvents,
      auditSink: {
        status: "failed",
        retryEligibility: recovery.retryEligibility,
        errorSummary: auditSinkCall.error.message,
        recovery
      },
      transition: {
        fromStatus: current.status,
        toStatus: mutated.value.record.status
      },
      record: {
        commandName: mutated.value.record.commandName,
        caseId: mutated.value.record.caseId,
        status: mutated.value.record.status,
        reason: mutated.value.record.reason,
        ...(mutated.value.record.resultReference
          ? { resultReference: mutated.value.record.resultReference }
          : {}),
        updatedAt: mutated.value.record.updatedAt
      }
    };
  }
}
