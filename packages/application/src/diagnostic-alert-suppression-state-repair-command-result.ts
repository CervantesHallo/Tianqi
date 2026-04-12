import type { ApplicationError } from "./application-error.js";
import type { DiagnosticAlertSuppressionStateReadCompatibility } from "./diagnostic-alert-suppression-state-read-compatibility.js";
import type { DiagnosticAlertSuppressionStateRepairLifecycleState, DiagnosticAlertSuppressionStateRepairStatus } from "./diagnostic-alert-suppression-state-repair-lifecycle.js";

export type DiagnosticAlertSuppressionStateRepairRecord = {
  readonly commandRecordId?: string;
  readonly commandType?: "repair" | "confirm" | "retry";
  readonly suppressionKey: string;
  readonly outcome: "repaired" | "failed" | "noop" | "manually_confirmed";
  readonly reason: string;
  readonly repairedAt: string;
  readonly triggeredBy: string;
  readonly compatibilityBefore: DiagnosticAlertSuppressionStateReadCompatibility;
  readonly compatibilityAfter?: DiagnosticAlertSuppressionStateReadCompatibility;
  readonly repairAvailable: boolean;
  readonly repairRecommended: boolean;
  readonly repairedSchemaVersion?: string;
  readonly repairStatus: DiagnosticAlertSuppressionStateRepairStatus;
  readonly repairAttempts: number;
  readonly lastRepairOutcome: "repaired" | "failed" | "noop" | "manually_confirmed";
  readonly manualConfirmation: boolean;
  readonly lastReason?: string;
  readonly lastAttemptedAt?: string;
  readonly lastRepairedAt?: string;
  readonly targetSuppressionKey: string;
  readonly schemaVersionBefore?: string;
  readonly schemaVersionAfter?: string;
  readonly lifecycleState: DiagnosticAlertSuppressionStateRepairLifecycleState;
};

export type DiagnosticAlertSuppressionStateRepairCommandResult =
  | {
      readonly success: true;
      readonly record: DiagnosticAlertSuppressionStateRepairRecord;
    }
  | {
      readonly success: false;
      readonly error: ApplicationError;
      readonly record: DiagnosticAlertSuppressionStateRepairRecord;
    };
