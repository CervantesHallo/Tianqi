import type { SinkFailureRecoveryRecordStatus } from "@tianqi/ports";
import type { CommandResultReference, SinkRecoveryReferenceId } from "@tianqi/shared";

export const RECOVERY_RECORD_AUDIT_EVENT_KINDS = {
  RecoveryRecordAppended: "RecoveryRecordAppended",
  RecoveryRecordManuallyResolved: "RecoveryRecordManuallyResolved"
} as const;

export type RecoveryRecordAuditEventKind =
  (typeof RECOVERY_RECORD_AUDIT_EVENT_KINDS)[keyof typeof RECOVERY_RECORD_AUDIT_EVENT_KINDS];

export type RecoveryRecordChangedAuditEvent = {
  readonly eventType: "RecoveryRecordChanged";
  readonly eventKind: RecoveryRecordAuditEventKind;
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly beforeStatus?: SinkFailureRecoveryRecordStatus;
  readonly afterStatus: SinkFailureRecoveryRecordStatus;
  readonly sinkKind: "audit" | "metrics";
  readonly resultReference: CommandResultReference;
  readonly caseId?: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly note?: string;
};

export const createRecoveryRecordChangedAuditEvent = (input: {
  readonly eventKind: RecoveryRecordAuditEventKind;
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly beforeStatus?: SinkFailureRecoveryRecordStatus;
  readonly afterStatus: SinkFailureRecoveryRecordStatus;
  readonly sinkKind: "audit" | "metrics";
  readonly resultReference: CommandResultReference;
  readonly caseId?: string;
  readonly traceId: string;
  readonly occurredAt: string;
  readonly note?: string;
}): RecoveryRecordChangedAuditEvent => ({
  eventType: "RecoveryRecordChanged",
  eventKind: input.eventKind,
  recoveryReference: input.recoveryReference,
  ...(input.beforeStatus ? { beforeStatus: input.beforeStatus } : {}),
  afterStatus: input.afterStatus,
  sinkKind: input.sinkKind,
  resultReference: input.resultReference,
  ...(input.caseId ? { caseId: input.caseId } : {}),
  traceId: input.traceId,
  occurredAt: input.occurredAt,
  ...(input.note ? { note: input.note } : {})
});
