import type {
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  DiagnosticAlertSuppressionStorePort,
  CoordinationDiagnosticHistoryStorePort,
  CoordinationResultStorePort
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import {
  applyDiagnosticAlertSuppressionWithPersistence,
  DiagnosticAlertSuppressionRegistry
} from "./coordination-diagnostic-alert-suppression.js";
import {
  DiagnosticAlertSuppressionStateRepairLifecycleRegistry
} from "./diagnostic-alert-suppression-state-repair-lifecycle-registry.js";
import {
  validateSuppressionRepairLifecycleCommandLink
} from "./diagnostic-alert-suppression-repair-command-link-consistency.js";
import {
  dependencyFailureError,
  invalidApplicationCommandError,
  resourceNotFoundError,
  snapshotVersionMissingError,
  snapshotVersionUnsupportedError
} from "./application-error.js";
import { buildCoordinationDiagnosticAssessment } from "./coordination-result-diagnostic-assessment.js";
import {
  buildDiagnosticReadAlert,
  buildDiagnosticReplayOperationalHint
} from "./coordination-diagnostic-replay-operational-assessment.js";
import {
  createNextDiagnosticHistorySlot,
  mapStoredDiagnosticHistoryCurrentToView,
  mapStoredDiagnosticHistoryPreviousToView
} from "./coordination-diagnostic-history-slot-mapper.js";
import {
  COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION
} from "./coordination-diagnostic-history-slot-schema.js";
import {
  validateDiagnosticHistorySlotConsistency
} from "./coordination-diagnostic-history-slot-consistency.js";
import type { DiagnosticHistorySlotConsistencyResult } from "./coordination-diagnostic-history-slot-consistency.js";
import { compareCoordinationDiagnosticViews } from "./coordination-result-diagnostic-history-comparison.js";
import { CoordinationResultDiagnosticHistoryRegistry } from "./coordination-result-diagnostic-history-registry.js";
import {
  evaluateCoordinationDiagnosticResultReadCompatibility
} from "./coordination-result-diagnostic-read-compatibility.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import { CoordinationResultRepairRecordRegistry } from "./coordination-result-repair-record-registry.js";
import type { GetCoordinationResultDiagnosticViewQuery } from "./get-coordination-result-diagnostic-view-query.js";

type CoordinationResultDiagnosticQueryHandlerDependencies = {
  readonly coordinationResultStore: CoordinationResultStorePort;
  readonly coordinationResultRegistry: CoordinationResultRegistry;
  readonly coordinationObservationRegistry: CoordinationResultObservationRegistry;
  readonly repairRecordRegistry: CoordinationResultRepairRecordRegistry;
  readonly diagnosticHistoryStore?: CoordinationDiagnosticHistoryStorePort;
  readonly diagnosticHistoryRegistry?: CoordinationResultDiagnosticHistoryRegistry;
  readonly alertSuppressionRegistry?: DiagnosticAlertSuppressionRegistry;
  readonly alertSuppressionStore?: DiagnosticAlertSuppressionStorePort;
  readonly alertSuppressionRepairLifecycleRegistry?: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  readonly alertSuppressionRepairLifecycleStore?: DiagnosticAlertSuppressionStateRepairLifecycleStorePort;
  readonly alertSuppressionRepairCommandRecordStore?: DiagnosticAlertSuppressionRepairCommandRecordStorePort;
};

export class CoordinationResultDiagnosticQueryHandler {
  private readonly coordinationResultStore: CoordinationResultStorePort;
  private readonly coordinationResultRegistry: CoordinationResultRegistry;
  private readonly coordinationObservationRegistry: CoordinationResultObservationRegistry;
  private readonly repairRecordRegistry: CoordinationResultRepairRecordRegistry;
  private readonly diagnosticHistoryStore: CoordinationDiagnosticHistoryStorePort | undefined;
  private readonly diagnosticHistoryRegistry: CoordinationResultDiagnosticHistoryRegistry;
  private readonly alertSuppressionRegistry: DiagnosticAlertSuppressionRegistry;
  private readonly alertSuppressionStore: DiagnosticAlertSuppressionStorePort | undefined;
  private readonly alertSuppressionRepairLifecycleRegistry: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  private readonly alertSuppressionRepairLifecycleStore: DiagnosticAlertSuppressionStateRepairLifecycleStorePort | undefined;
  private readonly alertSuppressionRepairCommandRecordStore: DiagnosticAlertSuppressionRepairCommandRecordStorePort | undefined;

  public constructor(dependencies: CoordinationResultDiagnosticQueryHandlerDependencies) {
    this.coordinationResultStore = dependencies.coordinationResultStore;
    this.coordinationResultRegistry = dependencies.coordinationResultRegistry;
    this.coordinationObservationRegistry = dependencies.coordinationObservationRegistry;
    this.repairRecordRegistry = dependencies.repairRecordRegistry;
    this.diagnosticHistoryStore = dependencies.diagnosticHistoryStore;
    this.diagnosticHistoryRegistry =
      dependencies.diagnosticHistoryRegistry ?? new CoordinationResultDiagnosticHistoryRegistry();
    this.alertSuppressionRegistry = dependencies.alertSuppressionRegistry ?? new DiagnosticAlertSuppressionRegistry();
    this.alertSuppressionStore = dependencies.alertSuppressionStore;
    this.alertSuppressionRepairLifecycleRegistry =
      dependencies.alertSuppressionRepairLifecycleRegistry ?? new DiagnosticAlertSuppressionStateRepairLifecycleRegistry();
    this.alertSuppressionRepairLifecycleStore = dependencies.alertSuppressionRepairLifecycleStore;
    this.alertSuppressionRepairCommandRecordStore = dependencies.alertSuppressionRepairCommandRecordStore;
  }

  public async handle(query: GetCoordinationResultDiagnosticViewQuery): Promise<CoordinationResultDiagnosticQueryResult> {
    if (query.factKey.trim().length === 0) {
      return {
        success: false,
        error: invalidApplicationCommandError("GetCoordinationResultDiagnosticViewQuery.factKey must be non-empty")
      };
    }

    const storeLookup = await this.coordinationResultStore.getByFactKey(query.factKey);
    if (!storeLookup.ok) {
      return {
        success: false,
        error: dependencyFailureError("Failed to load persisted coordination result for diagnostic query", {
          factKey: query.factKey,
          message: storeLookup.error.message
        })
      };
    }

    const registryView = this.coordinationResultRegistry.getByFactKey(query.factKey);
    const observationSnapshot = this.coordinationObservationRegistry.getByFactKey(query.factKey);
    const repairState = this.repairRecordRegistry.getRepairStateByFactKey(query.factKey);

    const hasAnySignal =
      storeLookup.value.status === "found" || registryView !== null || observationSnapshot !== null || repairState.repairAttempts > 0;
    if (!hasAnySignal) {
      return {
        success: false,
        error: resourceNotFoundError("Coordination diagnostic view not found for factKey", {
          factKey: query.factKey
        })
      };
    }

    const currentReadViewStatus: CoordinationResultDiagnosticView["currentReadViewStatus"] =
      storeLookup.value.status === "found" ? "persisted" : registryView ? "fallback_only" : "missing";

    const validationFailed =
      observationSnapshot?.lastQueryObservation?.validationFailed ||
      observationSnapshot?.lastPersistenceObservation?.validationFailed ||
      observationSnapshot?.lastRepairObservation?.validationFailed ||
      false;
    const validationPassed =
      observationSnapshot?.lastQueryObservation?.validationPassed ||
      observationSnapshot?.lastPersistenceObservation?.validationPassed ||
      observationSnapshot?.lastRepairObservation?.validationPassed ||
      false;
    const validationStatus: CoordinationResultDiagnosticView["validationStatus"] = validationFailed
      ? "failed"
      : validationPassed
        ? "passed"
        : "not_performed";

    const riskCaseId =
      (storeLookup.value.status === "found" ? storeLookup.value.record.riskCaseId : undefined) ??
      registryView?.riskCaseId ??
      observationSnapshot?.lastQueryObservation?.riskCaseId ??
      observationSnapshot?.lastPersistenceObservation?.riskCaseId ??
      observationSnapshot?.lastRepairObservation?.riskCaseId;
    const subcaseType =
      (storeLookup.value.status === "found" ? storeLookup.value.record.subcaseType : undefined) ??
      registryView?.subcaseType ??
      observationSnapshot?.lastQueryObservation?.subcaseType ??
      observationSnapshot?.lastPersistenceObservation?.subcaseType ??
      observationSnapshot?.lastRepairObservation?.subcaseType;
    const subcaseId =
      (storeLookup.value.status === "found" ? storeLookup.value.record.subcaseId : undefined) ??
      registryView?.subcaseId ??
      observationSnapshot?.lastQueryObservation?.subcaseId ??
      observationSnapshot?.lastPersistenceObservation?.subcaseId ??
      observationSnapshot?.lastRepairObservation?.subcaseId;

    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus,
      validationStatus,
      repairStatus: repairState.repairStatus,
      manualConfirmation: repairState.manualConfirmation,
      ...(observationSnapshot?.lastQueryObservation
        ? { lastQueryObservation: observationSnapshot.lastQueryObservation }
        : {}),
      ...(observationSnapshot?.lastPersistenceObservation
        ? { lastPersistenceObservation: observationSnapshot.lastPersistenceObservation }
        : {}),
      ...(observationSnapshot?.lastRepairObservation
        ? { lastRepairObservation: observationSnapshot.lastRepairObservation }
        : {})
    });
    const summary = `read=${currentReadViewStatus}; validation=${validationStatus}; repair=${repairState.repairStatus}; attempts=${repairState.repairAttempts}; rules=${assessment.assessmentRulesVersion}; risk=${assessment.riskLevel}; hint=${assessment.manualActionHint}; manual=${repairState.manualConfirmation ? "yes" : "no"}`;

    const currentView: CoordinationResultDiagnosticView = {
      factKey: query.factKey,
      ...(riskCaseId ? { riskCaseId } : {}),
      ...(subcaseType ? { subcaseType } : {}),
      ...(subcaseId ? { subcaseId } : {}),
      currentReadViewStatus,
      validationStatus,
      ...(observationSnapshot?.lastQueryObservation ? { lastQueryObservation: observationSnapshot.lastQueryObservation } : {}),
      ...(observationSnapshot?.lastPersistenceObservation
        ? { lastPersistenceObservation: observationSnapshot.lastPersistenceObservation }
        : {}),
      ...(observationSnapshot?.lastRepairObservation ? { lastRepairObservation: observationSnapshot.lastRepairObservation } : {}),
      repairStatus: repairState.repairStatus,
      repairAttempts: repairState.repairAttempts,
      ...(repairState.lastRepairOutcome ? { lastRepairOutcome: repairState.lastRepairOutcome } : {}),
      manualConfirmation: repairState.manualConfirmation,
      assessmentRulesVersion: assessment.assessmentRulesVersion,
      riskLevel: assessment.riskLevel,
      manualActionHint: assessment.manualActionHint,
      riskReason: assessment.riskReason,
      actionHintReason: assessment.actionHintReason,
      diagnosticSummary: summary
    };

    const compatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: currentView.assessmentRulesVersion
    });
    if (compatibility.status === "missing_version") {
      return {
        success: false,
        error: snapshotVersionMissingError("Diagnostic result is missing assessmentRulesVersion", {
          factKey: query.factKey
        })
      };
    }
    if (compatibility.status === "incompatible_version") {
      return {
        success: false,
        error: snapshotVersionUnsupportedError("Diagnostic result version is not compatible for current read path", {
          factKey: query.factKey,
          version: compatibility.storedVersion ?? "unknown"
        })
      };
    }

    let historySource: "persisted" | "in_memory_fallback" | "unavailable" | undefined;
    let historicalView = null as CoordinationResultDiagnosticView | null;
    let historyConsistency: DiagnosticHistorySlotConsistencyResult | undefined;
    let historyNotice: string | undefined;
    let historyReplayValidation: DiagnosticHistorySlotConsistencyResult["replayValidation"] | undefined;
    let historyConflictAttribution: DiagnosticHistorySlotConsistencyResult["conflictAttribution"] | undefined;
    if (query.includeHistoryComparison) {
      const persistedHistory = await this.lookupPersistedHistory(query.factKey, currentView);
      if (!persistedHistory.ok) {
        return {
          success: false,
          error: persistedHistory.error
        };
      }

      if (persistedHistory.value.status === "found") {
        historySource = "persisted";
        historicalView = persistedHistory.value.previousView;
        historyConsistency = persistedHistory.value.consistency;
        historyReplayValidation = persistedHistory.value.consistency.replayValidation;
        historyConflictAttribution = persistedHistory.value.consistency.conflictAttribution;
        historyNotice =
          historyConsistency.status === "notice" ? `persisted history consistency notice: ${historyConsistency.reason}` : undefined;
      } else {
        historicalView = this.diagnosticHistoryRegistry.getLatestByFactKey(query.factKey);
        historySource = historicalView ? "in_memory_fallback" : "unavailable";
        if (historySource === "in_memory_fallback") {
          historyNotice = "persisted history slot unavailable, in-memory fallback used";
          historyReplayValidation = {
            status: "notice",
            reasonCategory: "current_snapshot_conflict",
            reason: "Persisted history slot unavailable, in-memory fallback used"
          };
        }
      }
    }
    let historyCompatibilityNotice: string | undefined;
    if (query.includeHistoryComparison && historicalView) {
      const previousCompatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
        assessmentRulesVersion: historicalView.assessmentRulesVersion
      });
      if (previousCompatibility.status === "missing_version") {
        return {
          success: false,
          error: snapshotVersionMissingError("Historical diagnostic result is missing assessmentRulesVersion", {
            factKey: query.factKey
          })
        };
      }
      if (previousCompatibility.status === "incompatible_version") {
        return {
          success: false,
          error: snapshotVersionUnsupportedError("Historical diagnostic result version is incompatible for comparison", {
            factKey: query.factKey,
            version: previousCompatibility.storedVersion ?? "unknown"
          })
        };
      }
      if (previousCompatibility.status === "compatible_with_notice") {
        historyCompatibilityNotice = `historical comparison read with notice: ${previousCompatibility.reason}`;
      }
    }

    const comparisonResult =
      query.includeHistoryComparison && historicalView
        ? compareCoordinationDiagnosticViews({
            current: currentView,
            historical: historicalView
          })
        : undefined;

    const operationalAssessment =
      historyReplayValidation ?? historyConsistency?.replayValidation
        ? buildDiagnosticReplayOperationalHint(historyReplayValidation ?? historyConsistency!.replayValidation)
        : undefined;
    const readAlert =
      historyReplayValidation ?? historyConsistency?.replayValidation
        ? buildDiagnosticReadAlert({
            replayValidation: historyReplayValidation ?? historyConsistency!.replayValidation,
            operationalHint: operationalAssessment!.operationalHint,
            triggerSource: "replay_validation"
          })
        : undefined;
    const alertSuppressionResult =
      readAlert && (historyReplayValidation ?? historyConsistency?.replayValidation)
        ? await applyDiagnosticAlertSuppressionWithPersistence({
            factKey: query.factKey,
            replayValidation: historyReplayValidation ?? historyConsistency!.replayValidation,
            alert: readAlert,
            registry: this.alertSuppressionRegistry,
            lifecycleRegistry: this.alertSuppressionRepairLifecycleRegistry,
            ...(this.alertSuppressionRepairLifecycleStore
              ? { lifecycleStore: this.alertSuppressionRepairLifecycleStore }
              : {}),
            ...(this.alertSuppressionStore ? { store: this.alertSuppressionStore } : {})
          })
        : undefined;
    const suppressionStateRepairCommandLink = await this.lookupSuppressionStateRepairCommandLink(
      alertSuppressionResult?.suppression.suppressionKey
    );

    this.diagnosticHistoryRegistry.record(currentView);
    await this.persistDiagnosticHistorySlot(query.factKey, currentView);

    return {
      success: true,
      view: currentView,
      readCompatibility: compatibility.status,
      compatibilityReason: [compatibility.reason, historyCompatibilityNotice, historyNotice]
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .join("; "),
      ...(query.includeHistoryComparison ? { historySource: historySource ?? "unavailable" } : {}),
      ...(query.includeHistoryComparison ? { historyAvailable: historicalView !== null } : {}),
      ...(historyConsistency ? { historyConsistency } : {}),
      ...(historyNotice ? { historyNotice } : {}),
      ...(historyReplayValidation ? { historyReplayValidation } : {}),
      ...(historyConflictAttribution ? { historyConflictAttribution } : {}),
      ...(historyNotice ? { historyComparisonNotice: historyNotice } : {}),
      ...(operationalAssessment ? { operationalHint: operationalAssessment.operationalHint } : {}),
      ...(operationalAssessment ? { operationalHintReason: operationalAssessment.operationalHintReason } : {}),
      ...(readAlert ? { readAlert } : {}),
      ...(alertSuppressionResult ? { alertSuppression: alertSuppressionResult.suppression } : {}),
      ...(alertSuppressionResult ? { alertSuppressionPersistence: alertSuppressionResult.persistence } : {}),
      ...(alertSuppressionResult
        ? {
            suppressionStateRepair: alertSuppressionResult.persistence.suppressionStateRepair
          }
        : {}),
      ...(alertSuppressionResult
        ? {
            suppressionStateRepairPersistence: alertSuppressionResult.persistence.suppressionStateRepairPersistence
          }
        : {}),
      ...(suppressionStateRepairCommandLink ? { suppressionStateRepairCommandLink } : {}),
      ...(comparisonResult ? { comparisonResult } : {})
    };
  }

  private async lookupSuppressionStateRepairCommandLink(
    suppressionKey: string | undefined
  ): Promise<
    | {
        readonly lastCommandType?: "repair" | "confirm" | "retry";
        readonly lastCommandOutcome?: "repaired" | "failed" | "noop" | "manually_confirmed";
        readonly lastCommandTriggeredAt?: string;
        readonly commandLinkConsistencyStatus: "passed" | "missing_record" | "status_mismatch" | "key_mismatch" | "timeline_invalid";
        readonly commandLinkConsistencyReason: string;
      }
    | undefined
  > {
    if (!suppressionKey || !this.alertSuppressionRepairLifecycleStore) {
      return undefined;
    }
    const slotLoaded = await this.alertSuppressionRepairLifecycleStore.getBySuppressionKey(suppressionKey);
    if (!slotLoaded.ok || slotLoaded.value.status === "missing") {
      return {
        commandLinkConsistencyStatus: "missing_record",
        commandLinkConsistencyReason: "suppression repair lifecycle slot is missing for command link"
      };
    }
    let latestRecord:
      | import("@tianqi/ports").StoredDiagnosticAlertSuppressionRepairCommandRecord
      | undefined;
    if (this.alertSuppressionRepairCommandRecordStore) {
      const loaded = await this.alertSuppressionRepairCommandRecordStore.getLatestBySuppressionKey(suppressionKey);
      if (loaded.ok && loaded.value.status === "found") {
        latestRecord = loaded.value.record;
      }
    }
    const consistency = validateSuppressionRepairLifecycleCommandLink({
      slot: slotLoaded.value.slot,
      ...(latestRecord ? { latestRecord } : {})
    });
    if (!consistency.ok) {
      return {
        ...(latestRecord ? { lastCommandType: latestRecord.commandType } : {}),
        ...(latestRecord ? { lastCommandOutcome: latestRecord.outcome } : {}),
        ...(latestRecord ? { lastCommandTriggeredAt: latestRecord.triggeredAt } : {}),
        commandLinkConsistencyStatus: "missing_record",
        commandLinkConsistencyReason: consistency.error.message
      };
    }
    return {
      ...(latestRecord ? { lastCommandType: latestRecord.commandType } : {}),
      ...(latestRecord ? { lastCommandOutcome: latestRecord.outcome } : {}),
      ...(latestRecord ? { lastCommandTriggeredAt: latestRecord.triggeredAt } : {}),
      commandLinkConsistencyStatus: consistency.value.status,
      commandLinkConsistencyReason: consistency.value.reason
    };
  }

  private async lookupPersistedHistory(
    factKey: string,
    currentView: CoordinationResultDiagnosticView
  ): Promise<
    Result<
      | { readonly status: "missing" }
      | {
          readonly status: "found";
          readonly previousView: CoordinationResultDiagnosticView | null;
          readonly consistency: DiagnosticHistorySlotConsistencyResult;
        },
      ReturnType<typeof dependencyFailureError> | ReturnType<typeof snapshotVersionMissingError> | ReturnType<typeof snapshotVersionUnsupportedError>
    >
  > {
    if (!this.diagnosticHistoryStore) {
      return ok({ status: "missing" });
    }

    const loaded = await this.diagnosticHistoryStore.getByFactKey(factKey);
    if (!loaded.ok) {
      return err(
        dependencyFailureError("Failed to load persisted diagnostic history slot", {
          factKey,
          message: loaded.error.message
        })
      );
    }
    if (loaded.value.status === "missing") {
      return ok({ status: "missing" });
    }

    const slot = loaded.value.slot;
    if (!slot.schemaVersion || slot.schemaVersion.trim().length === 0) {
      return err(
        snapshotVersionMissingError("Persisted diagnostic history slot schemaVersion is missing", {
          factKey
        })
      );
    }
    if (slot.schemaVersion !== COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION) {
      return err(
        snapshotVersionUnsupportedError("Persisted diagnostic history slot schemaVersion is unsupported", {
          factKey,
          schemaVersion: slot.schemaVersion
        })
      );
    }

    const persistedCurrentView = mapStoredDiagnosticHistoryCurrentToView(factKey, slot.currentResult);
    const persistedPreviousView = slot.previousResult
      ? mapStoredDiagnosticHistoryPreviousToView(factKey, slot.previousResult)
      : undefined;
    const consistency = validateDiagnosticHistorySlotConsistency({
      requestedFactKey: factKey,
      slotFactKey: slot.factKey,
      slotSchemaVersion: slot.schemaVersion,
      currentView,
      persistedCurrentView,
      ...(persistedPreviousView ? { persistedPreviousView } : {}),
      fallbackUsed: false
    });
    if (!consistency.ok) {
      return err(consistency.error);
    }

    return ok({
      status: "found",
      previousView: persistedPreviousView ?? null,
      consistency: consistency.value
    });
  }

  private async persistDiagnosticHistorySlot(
    factKey: string,
    currentView: CoordinationResultDiagnosticView
  ): Promise<
    Result<
      { readonly status: "persisted" | "not_configured" },
      ReturnType<typeof dependencyFailureError>
    >
  > {
    if (!this.diagnosticHistoryStore) {
      return ok({ status: "not_configured" });
    }
    const existing = await this.diagnosticHistoryStore.getByFactKey(factKey);
    if (!existing.ok) {
      return err(
        dependencyFailureError("Failed to load existing diagnostic history slot before write", {
          factKey,
          message: existing.error.message
        })
      );
    }

    const next = createNextDiagnosticHistorySlot({
      factKey,
      currentView,
      ...(existing.value.status === "found" ? { existingSlot: existing.value.slot } : {}),
      updatedAt: new Date().toISOString()
    });
    const persisted = await this.diagnosticHistoryStore.put(next);
    if (!persisted.ok) {
      return err(
        dependencyFailureError("Failed to persist diagnostic history slot", {
          factKey,
          message: persisted.error.message
        })
      );
    }

    return ok({ status: "persisted" });
  }
}
