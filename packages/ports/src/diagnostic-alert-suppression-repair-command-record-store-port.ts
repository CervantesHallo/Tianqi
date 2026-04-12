import type { Result } from "@tianqi/shared";

export type DiagnosticAlertSuppressionRepairCommandType = "repair" | "confirm" | "retry";

export type DiagnosticAlertSuppressionRepairCommandOutcome =
  | "repaired"
  | "failed"
  | "noop"
  | "manually_confirmed";

export type StoredDiagnosticAlertSuppressionRepairCommandRecord = {
  readonly commandRecordId: string;
  readonly commandType: DiagnosticAlertSuppressionRepairCommandType;
  readonly suppressionKey: string;
  readonly triggeredAt: string;
  readonly triggeredBy: string;
  readonly outcome: DiagnosticAlertSuppressionRepairCommandOutcome;
  readonly outcomeReason: string;
  readonly resultingRepairStatus:
    | "not_repaired"
    | "repair_failed_retryable"
    | "repair_failed_manual_confirmation_required"
    | "manually_confirmed"
    | "repaired";
  readonly schemaVersionBefore?: string;
  readonly schemaVersionAfter?: string;
  readonly linkedLifecycleVersion: string;
};

export type DiagnosticAlertSuppressionRepairCommandRecordStoreLookup =
  | { readonly status: "found"; readonly record: StoredDiagnosticAlertSuppressionRepairCommandRecord }
  | { readonly status: "missing" };

export type DiagnosticAlertSuppressionRepairCommandRecordStoreError = {
  readonly message: string;
};

export type DiagnosticAlertSuppressionRepairCommandRecordStorePort = {
  put(record: StoredDiagnosticAlertSuppressionRepairCommandRecord): Promise<
    Result<void, DiagnosticAlertSuppressionRepairCommandRecordStoreError>
  >;
  getLatestBySuppressionKey(
    suppressionKey: string
  ): Promise<
    Result<
      DiagnosticAlertSuppressionRepairCommandRecordStoreLookup,
      DiagnosticAlertSuppressionRepairCommandRecordStoreError
    >
  >;
};

