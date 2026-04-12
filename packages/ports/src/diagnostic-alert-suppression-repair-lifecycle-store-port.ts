import type { Result } from "@tianqi/shared";

export type StoredDiagnosticAlertSuppressionStateRepairLifecycle = {
  readonly repairStatus:
    | "not_repaired"
    | "repair_failed_retryable"
    | "repair_failed_manual_confirmation_required"
    | "manually_confirmed"
    | "repaired";
  readonly repairAttempts: number;
  readonly lastRepairOutcome?: "repaired" | "failed" | "noop" | "manually_confirmed";
  readonly manualConfirmation: boolean;
  readonly lastReason?: string;
  readonly lastAttemptedAt?: string;
  readonly lastRepairedAt?: string;
  readonly targetSuppressionKey: string;
  readonly schemaVersionBefore?: string;
  readonly schemaVersionAfter?: string;
  readonly canRetry: boolean;
  readonly canConfirmManually: boolean;
};

export type StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot = {
  readonly schemaVersion?: string;
  readonly suppressionKey: string;
  readonly currentLifecycle: StoredDiagnosticAlertSuppressionStateRepairLifecycle;
  readonly previousLifecycle?: StoredDiagnosticAlertSuppressionStateRepairLifecycle;
  readonly lastCommandRecordId?: string;
  readonly updatedAt: string;
};

export type DiagnosticAlertSuppressionStateRepairLifecycleStoreLookup =
  | { readonly status: "found"; readonly slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot }
  | { readonly status: "missing" };

export type DiagnosticAlertSuppressionStateRepairLifecycleStoreError = {
  readonly message: string;
};

export type DiagnosticAlertSuppressionStateRepairLifecycleStorePort = {
  put(slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot): Promise<
    Result<void, DiagnosticAlertSuppressionStateRepairLifecycleStoreError>
  >;
  getBySuppressionKey(
    suppressionKey: string
  ): Promise<
    Result<
      DiagnosticAlertSuppressionStateRepairLifecycleStoreLookup,
      DiagnosticAlertSuppressionStateRepairLifecycleStoreError
    >
  >;
};

