import type { DiagnosticAlertSuppressionPersistence, DiagnosticAlertSuppressionResult } from "./coordination-diagnostic-alert-suppression.js";
import type { DiagnosticReadAlert } from "./coordination-diagnostic-replay-operational-assessment.js";
import type { CoordinationDiagnosticComparison } from "./coordination-result-diagnostic-history-comparison.js";
import type { DiagnosticHistorySlotConsistencyResult } from "./coordination-diagnostic-history-slot-consistency.js";
import type {
  DiagnosticHistoryConflictAttribution,
  DiagnosticHistoryReplayValidationResult
} from "./coordination-diagnostic-history-replay-validation.js";

export type CoreCaseDiagnosticAggregateExplanationStatus =
  | "fully_explained"
  | "partially_explained"
  | "attention_required"
  | "inconsistent";

export type CoreCaseDiagnosticAggregateView = {
  readonly factKey: string;
  readonly riskCaseId?: string;
  readonly subcaseType?: "LiquidationCase" | "ADLCase";
  readonly subcaseId?: string;
  readonly currentReadViewStatus: "persisted" | "fallback_only" | "missing";
  readonly validationStatus: "passed" | "failed" | "not_performed";
  readonly riskLevel: "low" | "medium" | "high";
  readonly manualActionHint:
    | "no_action_needed"
    | "retry_repair_recommended"
    | "manual_confirmation_recommended"
    | "investigate_validation_conflict"
    | "investigate_missing_read_view"
    | "investigate_persistence_failure";
  readonly riskReason: string;
  readonly actionHintReason: string;
  readonly assessmentRulesVersion: string;

  readonly historySource?: "persisted" | "in_memory_fallback" | "unavailable";
  readonly historyAvailable?: boolean;
  readonly historyConsistency?: DiagnosticHistorySlotConsistencyResult;
  readonly historyReplayValidation?: DiagnosticHistoryReplayValidationResult;
  readonly historyConflictAttribution?: DiagnosticHistoryConflictAttribution;
  readonly historyComparisonNotice?: string;
  readonly comparisonResult?: CoordinationDiagnosticComparison;

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

  readonly aggregateSummary: string;
  readonly primaryReason: string;
  readonly secondaryReason?: string;
  readonly recommendedNextStep: string;
  readonly requiresAttention: boolean;
  readonly requiresRepairAction: boolean;
  readonly requiresManualReview: boolean;
  readonly isCrossSessionConsistent: boolean;
  readonly explanationStatus: CoreCaseDiagnosticAggregateExplanationStatus;
};

