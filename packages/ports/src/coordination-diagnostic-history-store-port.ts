import type { Result } from "@tianqi/shared";

export type StoredCoordinationDiagnosticResultSnapshot = {
  readonly provenance?: "live_diagnostic_query" | "persisted_history_rotation";
  readonly assessmentRulesVersion?: string;
  readonly riskLevel: "low" | "medium" | "high";
  readonly manualActionHint:
    | "no_action_needed"
    | "retry_repair_recommended"
    | "manual_confirmation_recommended"
    | "investigate_validation_conflict"
    | "investigate_missing_read_view"
    | "investigate_persistence_failure";
  readonly validationStatus: "passed" | "failed" | "not_performed";
  readonly repairStatus:
    | "not_repaired"
    | "repair_failed_retryable"
    | "repair_failed_manual_confirmation_required"
    | "manually_confirmed"
    | "repaired";
  readonly currentReadViewStatus: "persisted" | "fallback_only" | "missing";
};

export type StoredCoordinationDiagnosticHistorySlot = {
  readonly schemaVersion?: string;
  readonly factKey: string;
  readonly currentResult: StoredCoordinationDiagnosticResultSnapshot;
  readonly previousResult?: StoredCoordinationDiagnosticResultSnapshot;
  readonly updatedAt: string;
};

export type CoordinationDiagnosticHistoryStoreLookup =
  | { readonly status: "found"; readonly slot: StoredCoordinationDiagnosticHistorySlot }
  | { readonly status: "missing" };

export type CoordinationDiagnosticHistoryStoreError = {
  readonly message: string;
};

export type CoordinationDiagnosticHistoryStorePort = {
  put(slot: StoredCoordinationDiagnosticHistorySlot): Promise<Result<void, CoordinationDiagnosticHistoryStoreError>>;
  getByFactKey(
    factKey: string
  ): Promise<Result<CoordinationDiagnosticHistoryStoreLookup, CoordinationDiagnosticHistoryStoreError>>;
};
