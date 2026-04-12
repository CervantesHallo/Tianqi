import type {
  StoredCoordinationDiagnosticHistorySlot,
  StoredCoordinationDiagnosticResultSnapshot
} from "@tianqi/ports";

import { COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION } from "./coordination-diagnostic-history-slot-schema.js";
import { COORDINATION_DIAGNOSTIC_RULES_VERSION } from "./coordination-result-diagnostic-assessment-rules.js";
import type { CoordinationDiagnosticAssessmentRulesVersion } from "./coordination-result-diagnostic-assessment-rules.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

const mapViewToStoredSnapshot = (view: CoordinationResultDiagnosticView): StoredCoordinationDiagnosticResultSnapshot => ({
  provenance: "live_diagnostic_query",
  assessmentRulesVersion: view.assessmentRulesVersion,
  riskLevel: view.riskLevel,
  manualActionHint: view.manualActionHint,
  validationStatus: view.validationStatus,
  repairStatus: view.repairStatus,
  currentReadViewStatus: view.currentReadViewStatus
});

const toAssessmentRulesVersion = (value: string | undefined): CoordinationDiagnosticAssessmentRulesVersion =>
  typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value) ? (value as CoordinationDiagnosticAssessmentRulesVersion) : COORDINATION_DIAGNOSTIC_RULES_VERSION;

const mapStoredSnapshotToView = (input: {
  readonly factKey: string;
  readonly snapshot: StoredCoordinationDiagnosticResultSnapshot;
  readonly sourceLabel: string;
}): CoordinationResultDiagnosticView => ({
  factKey: input.factKey,
  currentReadViewStatus: input.snapshot.currentReadViewStatus,
  validationStatus: input.snapshot.validationStatus,
  repairStatus: input.snapshot.repairStatus,
  repairAttempts: 0,
  manualConfirmation: false,
  assessmentRulesVersion: toAssessmentRulesVersion(input.snapshot.assessmentRulesVersion),
  riskLevel: input.snapshot.riskLevel,
  manualActionHint: input.snapshot.manualActionHint,
  riskReason: `loaded from ${input.sourceLabel}`,
  actionHintReason: `loaded from ${input.sourceLabel}`,
  diagnosticSummary: `loaded from ${input.sourceLabel}`
});

export const createNextDiagnosticHistorySlot = (input: {
  readonly factKey: string;
  readonly existingSlot?: StoredCoordinationDiagnosticHistorySlot;
  readonly currentView: CoordinationResultDiagnosticView;
  readonly updatedAt: string;
}): StoredCoordinationDiagnosticHistorySlot => ({
  schemaVersion: COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION,
  factKey: input.factKey,
  currentResult: mapViewToStoredSnapshot(input.currentView),
  ...(input.existingSlot
    ? {
        previousResult: {
          ...input.existingSlot.currentResult,
          provenance: "persisted_history_rotation"
        }
      }
    : {}),
  updatedAt: input.updatedAt
});

export const mapStoredDiagnosticHistoryCurrentToView = (
  factKey: string,
  snapshot: StoredCoordinationDiagnosticResultSnapshot
): CoordinationResultDiagnosticView => mapStoredSnapshotToView({ factKey, snapshot, sourceLabel: "persisted_history_current" });

export const mapStoredDiagnosticHistoryPreviousToView = (
  factKey: string,
  snapshot: StoredCoordinationDiagnosticResultSnapshot
): CoordinationResultDiagnosticView => mapStoredSnapshotToView({ factKey, snapshot, sourceLabel: "persisted_history_previous" });
