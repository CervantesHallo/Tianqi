import type { Result } from "@tianqi/shared";

export type StoredDiagnosticAlertSuppressionState = {
  readonly schemaVersion?: string;
  readonly suppressionKey: string;
  readonly factKey: string;
  readonly reasonCategory: string;
  readonly severity: "info" | "warning" | "critical";
  readonly triggerSource: "replay_validation" | "history_slot_consistency";
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly repeatCount: number;
  readonly lastStatus: "emitted" | "deduplicated" | "suppressed_with_notice";
};

export type DiagnosticAlertSuppressionStoreLookup =
  | {
      readonly status: "found";
      readonly state: StoredDiagnosticAlertSuppressionState;
    }
  | {
      readonly status: "missing";
    };

export type DiagnosticAlertSuppressionStoreError = {
  readonly message: string;
};

export type DiagnosticAlertSuppressionStorePort = {
  put(state: StoredDiagnosticAlertSuppressionState): Promise<Result<void, DiagnosticAlertSuppressionStoreError>>;
  getBySuppressionKey(suppressionKey: string): Promise<Result<DiagnosticAlertSuppressionStoreLookup, DiagnosticAlertSuppressionStoreError>>;
};
