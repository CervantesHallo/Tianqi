import type { CoordinationResultReadObservation } from "./coordination-result-observation.js";
import type { CoordinationResultRepairStatus } from "./coordination-result-repair-status.js";
import type {
  CoordinationResultDiagnosticRiskLevel,
  CoordinationResultManualActionHint
} from "./coordination-result-diagnostic-assessment.js";
import type { CoordinationDiagnosticAssessmentRulesVersion } from "./coordination-result-diagnostic-assessment-rules.js";

export type CoordinationReadViewStatus = "persisted" | "fallback_only" | "missing";
export type CoordinationValidationStatus = "passed" | "failed" | "not_performed";

export type CoordinationResultDiagnosticView = {
  readonly factKey: string;
  readonly riskCaseId?: string;
  readonly subcaseType?: "LiquidationCase" | "ADLCase";
  readonly subcaseId?: string;
  readonly currentReadViewStatus: CoordinationReadViewStatus;
  readonly validationStatus: CoordinationValidationStatus;
  readonly lastQueryObservation?: CoordinationResultReadObservation;
  readonly lastPersistenceObservation?: CoordinationResultReadObservation;
  readonly lastRepairObservation?: CoordinationResultReadObservation;
  readonly repairStatus: CoordinationResultRepairStatus;
  readonly repairAttempts: number;
  readonly lastRepairOutcome?: "repaired" | "already_persisted" | "failed" | "manually_confirmed";
  readonly manualConfirmation: boolean;
  readonly assessmentRulesVersion: CoordinationDiagnosticAssessmentRulesVersion;
  readonly riskLevel: CoordinationResultDiagnosticRiskLevel;
  readonly manualActionHint: CoordinationResultManualActionHint;
  readonly riskReason: string;
  readonly actionHintReason: string;
  readonly diagnosticSummary: string;
};
