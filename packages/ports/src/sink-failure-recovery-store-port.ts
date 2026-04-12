import type {
  CommandResultReference,
  Result,
  SinkRecoveryReferenceId
} from "@tianqi/shared";

export type SinkFailureRecoveryRecordStatus = "open" | "manually_resolved";

export type SinkFailureRecoveryRecord = {
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly sinkKind: "audit" | "metrics";
  readonly retryEligibility: "eligible_for_retry" | "manual_repair_only";
  readonly failureCategory: "sink_dependency_failure";
  readonly resultReference: CommandResultReference;
  readonly caseId?: string;
  readonly sourceCommandName?: string;
  readonly sourceQueryName?: string;
  readonly traceId: string;
  readonly createdAt: string;
  readonly status: SinkFailureRecoveryRecordStatus;
  readonly note?: string;
};

export type SinkFailureRecoveryAppendOutcome = {
  readonly status: "appended";
};

export type SinkFailureRecoveryLookup =
  | { readonly status: "found"; readonly record: SinkFailureRecoveryRecord }
  | { readonly status: "missing" };

export type SinkFailureRecoveryStoreError = {
  readonly message: string;
};

export type SinkFailureRecoveryStorePort = {
  append(
    record: SinkFailureRecoveryRecord
  ): Promise<Result<SinkFailureRecoveryAppendOutcome, SinkFailureRecoveryStoreError>>;
  getByRecoveryReference(
    recoveryReference: SinkRecoveryReferenceId
  ): Promise<Result<SinkFailureRecoveryLookup, SinkFailureRecoveryStoreError>>;
};
