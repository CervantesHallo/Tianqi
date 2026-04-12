import type { ApplicationError } from "./application-error.js";
import type { DiagnosticAlertSuppressionPersistence, DiagnosticAlertSuppressionResult } from "./coordination-diagnostic-alert-suppression.js";
import type { DiagnosticReadAlert, DiagnosticReplayOperationalHint } from "./coordination-diagnostic-replay-operational-assessment.js";
import type { CoordinationDiagnosticComparison } from "./coordination-result-diagnostic-history-comparison.js";
import type { CoordinationDiagnosticResultReadCompatibilityStatus } from "./coordination-result-diagnostic-read-compatibility.js";
import type { DiagnosticHistorySlotConsistencyResult } from "./coordination-diagnostic-history-slot-consistency.js";
import type {
  DiagnosticHistoryConflictAttribution,
  DiagnosticHistoryReplayValidationResult
} from "./coordination-diagnostic-history-replay-validation.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

export type CoordinationResultDiagnosticQueryResult =
  | {
      readonly success: true;
      readonly view: CoordinationResultDiagnosticView;
      readonly readCompatibility: CoordinationDiagnosticResultReadCompatibilityStatus;
      readonly compatibilityReason: string;
      readonly historySource?: "persisted" | "in_memory_fallback" | "unavailable";
      readonly comparisonResult?: CoordinationDiagnosticComparison;
      readonly historyAvailable?: boolean;
      readonly historyConsistency?: DiagnosticHistorySlotConsistencyResult;
      readonly historyNotice?: string;
      readonly historyReplayValidation?: DiagnosticHistoryReplayValidationResult;
      readonly historyConflictAttribution?: DiagnosticHistoryConflictAttribution;
      readonly historyComparisonNotice?: string;
      readonly operationalHint?: DiagnosticReplayOperationalHint;
      readonly operationalHintReason?: string;
      readonly readAlert?: DiagnosticReadAlert;
      readonly alertSuppression?: DiagnosticAlertSuppressionResult;
      readonly alertSuppressionPersistence?: DiagnosticAlertSuppressionPersistence;
      readonly suppressionStateRepair?: DiagnosticAlertSuppressionPersistence["suppressionStateRepair"];
      readonly suppressionStateRepairPersistence?: DiagnosticAlertSuppressionPersistence["suppressionStateRepairPersistence"];
      readonly suppressionStateRepairCommandLink?: {
        readonly lastCommandType?: "repair" | "confirm" | "retry";
        readonly lastCommandOutcome?: "repaired" | "failed" | "noop" | "manually_confirmed";
        readonly lastCommandTriggeredAt?: string;
        readonly commandLinkConsistencyStatus: "passed" | "missing_record" | "status_mismatch" | "key_mismatch" | "timeline_invalid";
        readonly commandLinkConsistencyReason: string;
      };
    }
  | {
      readonly success: false;
      readonly error: ApplicationError;
    };
