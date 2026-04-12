import type { SinkFailureRecoveryRecord } from "@tianqi/ports";
import {
  createSinkRecoveryReferenceId,
  type CommandResultReference,
  type SinkRecoveryReferenceId
} from "@tianqi/shared";
import {
  createRecoveryRecordChangedAuditEvent,
  RECOVERY_RECORD_AUDIT_EVENT_KINDS,
  type RecoveryRecordChangedAuditEvent
} from "./recovery-record-audit-event.js";
import type { RecoverySinkInvocationStatus } from "./recovery-sink-invocation-status.js";

export type RetryEligibility = "eligible_for_retry" | "manual_repair_only" | "not_applicable";

export type SinkFailureCategory = "sink_dependency_failure";

type SinkFailureRecoveryReferenceBase = {
  readonly recoveryId: SinkRecoveryReferenceId;
  readonly failedAt: string;
  readonly traceId: string;
  readonly failureCategory: SinkFailureCategory;
  readonly retryEligibility: Exclude<RetryEligibility, "not_applicable">;
};

export type AuditSinkFailureRecoveryReference = SinkFailureRecoveryReferenceBase & {
  readonly sinkKind: "audit";
  readonly sourceCommandName: string;
  readonly caseId: string;
  readonly resultReference: CommandResultReference;
};

export type MetricsSinkFailureRecoveryReference = SinkFailureRecoveryReferenceBase & {
  readonly sinkKind: "metrics";
  readonly sourceQueryName: "CommandResultQueryHandler.getCommandResultByReference";
  readonly resultReference: CommandResultReference;
};

export type SinkFailureRecoveryReference =
  | AuditSinkFailureRecoveryReference
  | MetricsSinkFailureRecoveryReference;

export type SinkFailureRecoveryContext = {
  readonly sinkKind: SinkFailureRecoveryReference["sinkKind"];
  readonly retryEligibility: Exclude<RetryEligibility, "not_applicable">;
  readonly recoveryReference: SinkFailureRecoveryReference;
};

export type SinkFailureRecoveryRecordPersistence =
  | { readonly status: "persisted" }
  | { readonly status: "persist_failed"; readonly errorSummary: string };

export type SinkFailureRecoveryView = SinkFailureRecoveryContext & {
  readonly recoveryRecord: SinkFailureRecoveryRecordPersistence;
  readonly auditEvents: readonly RecoveryRecordChangedAuditEvent[];
  readonly auditSink: RecoverySinkInvocationStatus;
};

export const createAuditSinkFailureRecoveryContext = (input: {
  readonly sourceCommandName: string;
  readonly caseId: string;
  readonly resultReference: CommandResultReference;
  readonly failedAt: string;
  readonly traceId: string;
}): SinkFailureRecoveryContext => {
  const recoveryReference: AuditSinkFailureRecoveryReference = {
    sinkKind: "audit",
    sourceCommandName: input.sourceCommandName,
    caseId: input.caseId,
    resultReference: input.resultReference,
    failedAt: input.failedAt,
    traceId: input.traceId,
    failureCategory: "sink_dependency_failure",
    retryEligibility: "eligible_for_retry",
    recoveryId: createSinkRecoveryReferenceId(
      `audit:${input.sourceCommandName}:${input.resultReference}:${input.failedAt}`
    )
  };
  return {
    sinkKind: "audit",
    retryEligibility: "eligible_for_retry",
    recoveryReference
  };
};

export const createMetricsSinkFailureRecoveryContext = (input: {
  readonly resultReference: CommandResultReference;
  readonly failedAt: string;
}): SinkFailureRecoveryContext => {
  const sourceQueryName = "CommandResultQueryHandler.getCommandResultByReference" as const;
  const traceId = `query:${input.resultReference}`;
  const recoveryReference: MetricsSinkFailureRecoveryReference = {
    sinkKind: "metrics",
    sourceQueryName,
    resultReference: input.resultReference,
    failedAt: input.failedAt,
    traceId,
    failureCategory: "sink_dependency_failure",
    retryEligibility: "eligible_for_retry",
    recoveryId: createSinkRecoveryReferenceId(
      `metrics:${sourceQueryName}:${input.resultReference}:${input.failedAt}`
    )
  };
  return {
    sinkKind: "metrics",
    retryEligibility: "eligible_for_retry",
    recoveryReference
  };
};

export const toOpenSinkFailureRecoveryRecord = (
  context: SinkFailureRecoveryContext
): SinkFailureRecoveryRecord =>
  context.recoveryReference.sinkKind === "audit"
    ? {
        recoveryReference: context.recoveryReference.recoveryId,
        sinkKind: context.recoveryReference.sinkKind,
        retryEligibility: context.retryEligibility,
        failureCategory: context.recoveryReference.failureCategory,
        resultReference: context.recoveryReference.resultReference,
        caseId: context.recoveryReference.caseId,
        sourceCommandName: context.recoveryReference.sourceCommandName,
        traceId: context.recoveryReference.traceId,
        createdAt: context.recoveryReference.failedAt,
        status: "open"
      }
    : {
        recoveryReference: context.recoveryReference.recoveryId,
        sinkKind: context.recoveryReference.sinkKind,
        retryEligibility: context.retryEligibility,
        failureCategory: context.recoveryReference.failureCategory,
        resultReference: context.recoveryReference.resultReference,
        sourceQueryName: context.recoveryReference.sourceQueryName,
        traceId: context.recoveryReference.traceId,
        createdAt: context.recoveryReference.failedAt,
        status: "open"
      };

export const createRecoveryRecordAppendedAuditEvent = (
  context: SinkFailureRecoveryContext
): RecoveryRecordChangedAuditEvent =>
  createRecoveryRecordChangedAuditEvent({
    eventKind: RECOVERY_RECORD_AUDIT_EVENT_KINDS.RecoveryRecordAppended,
    recoveryReference: context.recoveryReference.recoveryId,
    afterStatus: "open",
    sinkKind: context.recoveryReference.sinkKind,
    resultReference: context.recoveryReference.resultReference,
    ...(context.recoveryReference.sinkKind === "audit"
      ? { caseId: context.recoveryReference.caseId }
      : {}),
    traceId: context.recoveryReference.traceId,
    occurredAt: context.recoveryReference.failedAt
  });
