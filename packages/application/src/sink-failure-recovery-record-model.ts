import type {
  SinkFailureRecoveryRecord,
  SinkFailureRecoveryRecordStatus
} from "@tianqi/ports";
import type {
  CommandResultReference,
  SinkRecoveryReferenceId
} from "@tianqi/shared";

import type { ApplicationError } from "./application-error.js";
import type { RecoverySinkInvocationStatus } from "./recovery-sink-invocation-status.js";
import type { RecoveryRecordChangedAuditEvent } from "./recovery-record-audit-event.js";
import type { RetryEligibility, SinkFailureCategory } from "./sink-failure-recovery.js";

export type SinkFailureRecoveryRecordView = {
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly sinkKind: "audit" | "metrics";
  readonly retryEligibility: Exclude<RetryEligibility, "not_applicable">;
  readonly failureCategory: SinkFailureCategory;
  readonly resultReference: CommandResultReference;
  readonly caseId?: string;
  readonly sourceCommandName?: string;
  readonly sourceQueryName?: string;
  readonly traceId: string;
  readonly createdAt: string;
  readonly status: SinkFailureRecoveryRecordStatus;
  readonly note?: string;
};

export type SinkFailureRecoveryQueryResult =
  | { readonly status: "found"; readonly record: SinkFailureRecoveryRecordView }
  | { readonly status: "missing"; readonly recoveryReference: SinkRecoveryReferenceId }
  | {
      readonly status: "unavailable";
      readonly recoveryReference: SinkRecoveryReferenceId;
      readonly error: ApplicationError;
    };

export type RecoveryQueryDiagnostics = {
  readonly outcome: "found" | "missing" | "unavailable";
  readonly statusCategory: "open" | "manually_resolved" | "none";
  readonly retryEligibilityCategory: "eligible_for_retry" | "manual_repair_only" | "not_applicable";
  readonly hasNote: boolean;
  readonly storeAccessed: true;
  readonly fallbackApplied: false;
};

export type SinkFailureRecoveryQueryResultWithDiagnostics =
  | {
      readonly status: "found";
      readonly record: SinkFailureRecoveryRecordView;
      readonly diagnostics: RecoveryQueryDiagnostics;
      readonly metricsSink: RecoverySinkInvocationStatus;
    }
  | {
      readonly status: "missing";
      readonly recoveryReference: SinkRecoveryReferenceId;
      readonly diagnostics: RecoveryQueryDiagnostics;
      readonly metricsSink: RecoverySinkInvocationStatus;
    }
  | {
      readonly status: "unavailable";
      readonly recoveryReference: SinkRecoveryReferenceId;
      readonly diagnostics: RecoveryQueryDiagnostics;
      readonly metricsSink: RecoverySinkInvocationStatus;
      readonly error: ApplicationError;
    };

export type MarkSinkFailureManuallyResolvedResult =
  | {
      readonly success: true;
      readonly record: SinkFailureRecoveryRecordView;
      readonly auditEvents: readonly RecoveryRecordChangedAuditEvent[];
      readonly auditSink: RecoverySinkInvocationStatus;
    }
  | {
      readonly success: false;
      readonly state: "missing" | "invalid_transition" | "unavailable";
      readonly error: ApplicationError;
      readonly auditEvents: readonly [];
      readonly auditSink: RecoverySinkInvocationStatus;
    };

export const toSinkFailureRecoveryRecordView = (
  record: SinkFailureRecoveryRecord
): SinkFailureRecoveryRecordView => ({
  recoveryReference: record.recoveryReference,
  sinkKind: record.sinkKind,
  retryEligibility: record.retryEligibility,
  failureCategory: record.failureCategory,
  resultReference: record.resultReference,
  ...(record.caseId ? { caseId: record.caseId } : {}),
  ...(record.sourceCommandName ? { sourceCommandName: record.sourceCommandName } : {}),
  ...(record.sourceQueryName ? { sourceQueryName: record.sourceQueryName } : {}),
  traceId: record.traceId,
  createdAt: record.createdAt,
  status: record.status,
  ...(record.note ? { note: record.note } : {})
});
