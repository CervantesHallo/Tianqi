import type { SinkRecoveryReferenceId } from "@tianqi/shared";

import type { MarkSinkFailureManuallyResolvedResult } from "./sink-failure-recovery-record-model.js";
import type { SinkFailureRecoveryQueryResultWithDiagnostics } from "./sink-failure-recovery-record-model.js";
import type { RetryEligibility, SinkFailureRecoveryView } from "./sink-failure-recovery.js";

export const RECOVERY_DISPLAY_VIEW_VERSION = "1.0.0" as const;

export type RecoveryDisplayRecordStatus = "open" | "manually_resolved" | "none";

export const RECOVERY_DISPLAY_MAIN_OUTCOMES = [
  "append_success",
  "append_failed",
  "manual_resolved",
  "manual_resolve_failed",
  "query_found",
  "query_missing",
  "query_unavailable"
] as const;

export type RecoveryDisplayMainOutcome =
  (typeof RECOVERY_DISPLAY_MAIN_OUTCOMES)[number];

export type RecoveryDiagnosticsSummary = {
  readonly hasRecoveryRecord: boolean;
  readonly recordStatus: RecoveryDisplayRecordStatus;
  readonly retryEligibility: RetryEligibility;
  readonly hasNote: boolean;
  readonly latestSinkStatus: "succeeded" | "failed" | "not_attempted" | "none";
  readonly queryOutcome: "found" | "missing" | "unavailable" | "not_applicable";
  readonly manualInterventionRequired: boolean;
  readonly needsAttention: boolean;
};

export type RecoveryDisplayView = {
  readonly viewVersion: typeof RECOVERY_DISPLAY_VIEW_VERSION;
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly sinkKind: "audit" | "metrics" | "none";
  readonly recordStatus: RecoveryDisplayRecordStatus;
  readonly retryEligibility: RetryEligibility;
  readonly mainOutcome: RecoveryDisplayMainOutcome;
  readonly auditSinkStatus?: "succeeded" | "failed" | "not_attempted";
  readonly metricsSinkStatus?: "succeeded" | "failed" | "not_attempted";
  readonly hasNote: boolean;
  readonly diagnosticsSummary: RecoveryDiagnosticsSummary;
  readonly timestamps: {
    readonly recordCreatedAt?: string;
    readonly observedAt?: string;
  };
};

// Diagnostics summary follows RecoveryDisplayView versioning in current phase.
// No independent diagnostics version is introduced to avoid premature split.
export const RECOVERY_DISPLAY_CORE_FIELDS = [
  "viewVersion",
  "recoveryReference",
  "sinkKind",
  "recordStatus",
  "retryEligibility",
  "mainOutcome",
  "hasNote",
  "diagnosticsSummary",
  "timestamps"
] as const;

export const RECOVERY_DISPLAY_COMPATIBILITY_POLICY = {
  addField: "allowed_if_optional_or_defaulted",
  removeField: "forbidden_in_phase1",
  renameField: "forbidden_in_phase1",
  semanticChange: "requires_view_version_bump"
} as const;

export const assertRecoveryDisplayViewCompatibility = (view: RecoveryDisplayView): void => {
  if (view.viewVersion !== RECOVERY_DISPLAY_VIEW_VERSION) {
    throw new Error("RecoveryDisplayView viewVersion mismatch");
  }
  for (const field of RECOVERY_DISPLAY_CORE_FIELDS) {
    if (view[field] === undefined) {
      throw new Error(`RecoveryDisplayView missing core field: ${field}`);
    }
  }
  if (!RECOVERY_DISPLAY_MAIN_OUTCOMES.includes(view.mainOutcome)) {
    throw new Error("RecoveryDisplayView mainOutcome out of allowed domain");
  }
};

type RecoveryAttentionInput = {
  readonly mainOutcome: RecoveryDisplayMainOutcome;
  readonly hasRecoveryRecord: boolean;
  readonly recordStatus: RecoveryDisplayRecordStatus;
  readonly retryEligibility: RetryEligibility;
  readonly queryOutcome: RecoveryDiagnosticsSummary["queryOutcome"];
  readonly manualInterventionRequired: boolean;
};

const isManualInterventionRequiredSource = (value: string | undefined): boolean =>
  value === "MarkCompensationManualInterventionRequiredCommand";

export const evaluateRecoveryNeedsAttention = (input: RecoveryAttentionInput): boolean => {
  if (input.queryOutcome === "unavailable") {
    return true;
  }
  if (input.manualInterventionRequired) {
    return true;
  }
  if (input.mainOutcome === "append_failed" && !input.hasRecoveryRecord) {
    return true;
  }
  if (input.mainOutcome === "manual_resolve_failed") {
    return true;
  }
  if (input.recordStatus === "open" && input.retryEligibility !== "not_applicable") {
    return true;
  }
  return false;
};

const buildDiagnosticsSummary = (input: {
  readonly mainOutcome: RecoveryDisplayMainOutcome;
  readonly hasRecoveryRecord: boolean;
  readonly recordStatus: RecoveryDisplayRecordStatus;
  readonly retryEligibility: RetryEligibility;
  readonly hasNote: boolean;
  readonly latestSinkStatus: RecoveryDiagnosticsSummary["latestSinkStatus"];
  readonly queryOutcome: RecoveryDiagnosticsSummary["queryOutcome"];
  readonly manualInterventionRequired: boolean;
}): RecoveryDiagnosticsSummary => ({
  hasRecoveryRecord: input.hasRecoveryRecord,
  recordStatus: input.recordStatus,
  retryEligibility: input.retryEligibility,
  hasNote: input.hasNote,
  latestSinkStatus: input.latestSinkStatus,
  queryOutcome: input.queryOutcome,
  manualInterventionRequired: input.manualInterventionRequired,
  needsAttention: evaluateRecoveryNeedsAttention({
    mainOutcome: input.mainOutcome,
    hasRecoveryRecord: input.hasRecoveryRecord,
    recordStatus: input.recordStatus,
    retryEligibility: input.retryEligibility,
    queryOutcome: input.queryOutcome,
    manualInterventionRequired: input.manualInterventionRequired
  })
});

export const mapRecoveryAppendToDisplayView = (recovery: SinkFailureRecoveryView): RecoveryDisplayView => {
  const appendSucceeded = recovery.recoveryRecord.status === "persisted";
  const recordStatus: RecoveryDisplayRecordStatus = appendSucceeded ? "open" : "none";
  const retryEligibility: RetryEligibility = appendSucceeded ? recovery.retryEligibility : "not_applicable";
  const hasRecoveryRecord = appendSucceeded;
  const hasNote = false;
  const sourceCommandName =
    recovery.recoveryReference.sinkKind === "audit"
      ? recovery.recoveryReference.sourceCommandName
      : undefined;
  const manualInterventionRequired = isManualInterventionRequiredSource(sourceCommandName);
  const mainOutcome: RecoveryDisplayMainOutcome = appendSucceeded ? "append_success" : "append_failed";
  const diagnosticsSummary = buildDiagnosticsSummary({
    mainOutcome,
    hasRecoveryRecord,
    recordStatus,
    retryEligibility,
    hasNote,
    latestSinkStatus: recovery.auditSink.status,
    queryOutcome: "not_applicable",
    manualInterventionRequired
  });

  return {
    viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
    recoveryReference: recovery.recoveryReference.recoveryId,
    sinkKind: recovery.sinkKind,
    recordStatus,
    retryEligibility,
    mainOutcome,
    auditSinkStatus: recovery.auditSink.status,
    hasNote,
    diagnosticsSummary,
    timestamps: {
      ...(appendSucceeded ? { recordCreatedAt: recovery.recoveryReference.failedAt } : {}),
      observedAt: recovery.recoveryReference.failedAt
    }
  };
};

export const mapManualResolveToDisplayView = (input: {
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly result: MarkSinkFailureManuallyResolvedResult;
}): RecoveryDisplayView => {
  if (!input.result.success) {
    const diagnosticsSummary = buildDiagnosticsSummary({
      mainOutcome: "manual_resolve_failed",
      hasRecoveryRecord: false,
      recordStatus: "none",
      retryEligibility: "not_applicable",
      hasNote: false,
      latestSinkStatus: input.result.auditSink.status,
      queryOutcome: "not_applicable",
      manualInterventionRequired: false
    });
    return {
      viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
      recoveryReference: input.recoveryReference,
      sinkKind: "none",
      recordStatus: "none",
      retryEligibility: "not_applicable",
      mainOutcome: "manual_resolve_failed",
      auditSinkStatus: input.result.auditSink.status,
      hasNote: false,
      diagnosticsSummary,
      timestamps: {}
    };
  }

  const manualInterventionRequired = isManualInterventionRequiredSource(
    input.result.record.sourceCommandName
  );
  const diagnosticsSummary = buildDiagnosticsSummary({
    mainOutcome: "manual_resolved",
    hasRecoveryRecord: true,
    recordStatus: input.result.record.status,
    retryEligibility: input.result.record.retryEligibility,
    hasNote: input.result.record.note !== undefined,
    latestSinkStatus: input.result.auditSink.status,
    queryOutcome: "not_applicable",
    manualInterventionRequired
  });
  return {
    viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
    recoveryReference: input.result.record.recoveryReference,
    sinkKind: input.result.record.sinkKind,
    recordStatus: input.result.record.status,
    retryEligibility: input.result.record.retryEligibility,
    mainOutcome: "manual_resolved",
    auditSinkStatus: input.result.auditSink.status,
    hasNote: input.result.record.note !== undefined,
    diagnosticsSummary,
    timestamps: {
      recordCreatedAt: input.result.record.createdAt,
      ...(input.result.auditEvents[0]?.occurredAt
        ? { observedAt: input.result.auditEvents[0].occurredAt }
        : {})
    }
  };
};

export const mapRecoveryQueryToDisplayView = (
  result: SinkFailureRecoveryQueryResultWithDiagnostics
): RecoveryDisplayView => {
  if (result.status === "found") {
    const manualInterventionRequired = isManualInterventionRequiredSource(
      result.record.sourceCommandName
    );
    const diagnosticsSummary = buildDiagnosticsSummary({
      mainOutcome: "query_found",
      hasRecoveryRecord: true,
      recordStatus: result.record.status,
      retryEligibility: result.record.retryEligibility,
      hasNote: result.record.note !== undefined,
      latestSinkStatus: result.metricsSink.status,
      queryOutcome: result.diagnostics.outcome,
      manualInterventionRequired
    });
    return {
      viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
      recoveryReference: result.record.recoveryReference,
      sinkKind: result.record.sinkKind,
      recordStatus: result.record.status,
      retryEligibility: result.record.retryEligibility,
      mainOutcome: "query_found",
      metricsSinkStatus: result.metricsSink.status,
      hasNote: result.record.note !== undefined,
      diagnosticsSummary,
      timestamps: {
        recordCreatedAt: result.record.createdAt
      }
    };
  }

  if (result.status === "missing") {
    const diagnosticsSummary = buildDiagnosticsSummary({
      mainOutcome: "query_missing",
      hasRecoveryRecord: false,
      recordStatus: "none",
      retryEligibility: "not_applicable",
      hasNote: false,
      latestSinkStatus: result.metricsSink.status,
      queryOutcome: result.diagnostics.outcome,
      manualInterventionRequired: false
    });
    return {
      viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
      recoveryReference: result.recoveryReference,
      sinkKind: "none",
      recordStatus: "none",
      retryEligibility: "not_applicable",
      mainOutcome: "query_missing",
      metricsSinkStatus: result.metricsSink.status,
      hasNote: false,
      diagnosticsSummary,
      timestamps: {}
    };
  }

  const diagnosticsSummary = buildDiagnosticsSummary({
    mainOutcome: "query_unavailable",
    hasRecoveryRecord: false,
    recordStatus: "none",
    retryEligibility: "not_applicable",
    hasNote: false,
    latestSinkStatus: result.metricsSink.status,
    queryOutcome: result.diagnostics.outcome,
    manualInterventionRequired: false
  });
  return {
    viewVersion: RECOVERY_DISPLAY_VIEW_VERSION,
    recoveryReference: result.recoveryReference,
    sinkKind: "none",
    recordStatus: "none",
    retryEligibility: "not_applicable",
    mainOutcome: "query_unavailable",
    metricsSinkStatus: result.metricsSink.status,
    hasNote: false,
    diagnosticsSummary,
    timestamps: {}
  };
};
