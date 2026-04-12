import type {
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  StoredDiagnosticAlertSuppressionRepairCommandRecord,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot,
  DiagnosticAlertSuppressionStorePort,
  StoredDiagnosticAlertSuppressionState,
  CoordinationDiagnosticHistoryStorePort,
  StoredCoordinationDiagnosticHistorySlot,
  CoordinationResultStorePort,
  StoredRiskCaseCoordinationResult
} from "@tianqi/ports";
import { ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { DiagnosticAlertSuppressionRegistry } from "./coordination-diagnostic-alert-suppression.js";
import { DiagnosticAlertSuppressionStateRepairLifecycleRegistry } from "./diagnostic-alert-suppression-state-repair-lifecycle-registry.js";
import { CoordinationResultDiagnosticHistoryRegistry } from "./coordination-result-diagnostic-history-registry.js";
import { CoordinationResultDiagnosticQueryHandler } from "./coordination-result-diagnostic-query-handler.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import { CoordinationResultRepairCommandHandler } from "./coordination-result-repair-command-handler.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import { COORDINATION_DIAGNOSTIC_RULES_VERSION } from "./coordination-result-diagnostic-assessment-rules.js";
import { COORDINATION_RESULT_STORE_SCHEMA_VERSION } from "./coordination-result-store-schema.js";

class FakeCoordinationResultStore implements CoordinationResultStorePort {
  public readonly byFact = new Map<string, StoredRiskCaseCoordinationResult>();
  public failPut = false;

  public async put(record: StoredRiskCaseCoordinationResult) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "put failed intentionally" }
      };
    }
    this.byFact.set(record.factKey, record);
    return ok(undefined);
  }

  public async getByFactKey(factKey: string) {
    const record = this.byFact.get(factKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }

  public async getLatestByRiskCaseAndSubcase(input: {
    readonly riskCaseId: string;
    readonly subcaseType: "LiquidationCase" | "ADLCase";
    readonly subcaseId: string;
  }) {
    let latest: StoredRiskCaseCoordinationResult | null = null;
    for (const record of this.byFact.values()) {
      if (
        record.riskCaseId === input.riskCaseId &&
        record.subcaseType === input.subcaseType &&
        record.subcaseId === input.subcaseId &&
        (!latest || new Date(record.occurredAt).getTime() >= new Date(latest.occurredAt).getTime())
      ) {
        latest = record;
      }
    }
    return ok(latest ? { status: "found" as const, record: latest } : { status: "missing" as const });
  }
}

class FakeCoordinationDiagnosticHistoryStore implements CoordinationDiagnosticHistoryStorePort {
  public readonly byFact = new Map<string, StoredCoordinationDiagnosticHistorySlot>();
  public failGet = false;
  public failPut = false;

  public async put(slot: StoredCoordinationDiagnosticHistorySlot) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "history put failed intentionally" }
      };
    }
    this.byFact.set(slot.factKey, slot);
    return ok(undefined);
  }

  public async getByFactKey(factKey: string) {
    if (this.failGet) {
      return {
        ok: false as const,
        error: { message: "history get failed intentionally" }
      };
    }
    const slot = this.byFact.get(factKey);
    return ok(slot ? { status: "found" as const, slot } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionStore implements DiagnosticAlertSuppressionStorePort {
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionState>();
  public failGet = false;
  public failPut = false;

  public async put(state: StoredDiagnosticAlertSuppressionState) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "suppression put failed intentionally" }
      };
    }
    this.byKey.set(state.suppressionKey, state);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    if (this.failGet) {
      return {
        ok: false as const,
        error: { message: "suppression get failed intentionally" }
      };
    }
    const state = this.byKey.get(suppressionKey);
    return ok(state ? { status: "found" as const, state } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairLifecycleStore
  implements DiagnosticAlertSuppressionStateRepairLifecycleStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot>();
  public failGet = false;
  public failPut = false;

  public async put(slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "suppression repair lifecycle put failed intentionally" }
      };
    }
    this.byKey.set(slot.suppressionKey, slot);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    if (this.failGet) {
      return {
        ok: false as const,
        error: { message: "suppression repair lifecycle get failed intentionally" }
      };
    }
    const slot = this.byKey.get(suppressionKey);
    return ok(slot ? { status: "found" as const, slot } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairCommandRecordStore
  implements DiagnosticAlertSuppressionRepairCommandRecordStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionRepairCommandRecord>();

  public async put(record: StoredDiagnosticAlertSuppressionRepairCommandRecord) {
    this.byKey.set(record.suppressionKey, record);
    return ok(undefined);
  }

  public async getLatestBySuppressionKey(suppressionKey: string) {
    const record = this.byKey.get(suppressionKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }
}

describe("CoordinationResultDiagnosticQueryHandler", () => {
  it("returns not found when no diagnostic signal exists", async () => {
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: new CoordinationResultRegistry(),
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry()
    });

    const result = await handler.handle({ factKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-003");
    }
  });

  it("shows fallback_only and manual confirmation in diagnostic view", async () => {
    const factKey = "risk-case-500|ADLCase|adl-case-500|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-500",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-500",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-500",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "fallback-only",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-500",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    store.failPut = true;
    const observationRegistry = new CoordinationResultObservationRegistry();
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationObservationRegistry: observationRegistry
    });

    const failed = await repairHandler.handle({
      factKey,
      reason: "make failed status",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.record.repairStatus).toBe("repair_failed_retryable");
    }
    const confirmed = await repairHandler.handleConfirmManually({
      factKey,
      reason: "manual confirm",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(confirmed.success).toBe(true);

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: store,
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairHandler.getRepairRecordRegistry()
    });

    const result = await handler.handle({ factKey });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.view.currentReadViewStatus).toBe("fallback_only");
      expect(result.view.repairStatus).toBe("manually_confirmed");
      expect(result.view.manualConfirmation).toBe(true);
      expect(result.view.repairAttempts).toBe(1);
      expect(result.view.assessmentRulesVersion).toBe(COORDINATION_DIAGNOSTIC_RULES_VERSION);
      expect(result.view.riskLevel).toBe("medium");
      expect(result.view.manualActionHint).toBe("retry_repair_recommended");
    }
  });

  it("shows low risk and no action for persisted + repaired", async () => {
    const factKey = "risk-case-501|ADLCase|adl-case-501|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-501",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-501",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-501",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "low-risk",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-501",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    await store.put({
      schemaVersion: COORDINATION_RESULT_STORE_SCHEMA_VERSION,
      factKey,
      riskCaseId: "risk-case-501",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-501",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-501",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "low-risk",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-501",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const observationRegistry = new CoordinationResultObservationRegistry();
    observationRegistry.record({
      scope: "query",
      factKey,
      riskCaseId: "risk-case-501",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-501",
      storeReadHit: true,
      registryFallbackUsed: false,
      validationPassed: true,
      validationFailed: false,
      persistenceWriteSucceeded: false,
      persistenceWriteFailed: false,
      repairAttempted: false,
      repairSucceeded: false,
      repairFailed: false
    });
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationObservationRegistry: observationRegistry
    });
    await repairHandler.handle({
      factKey,
      reason: "repaired noop",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: store,
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairHandler.getRepairRecordRegistry()
    });
    const result = await handler.handle({ factKey });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.view.currentReadViewStatus).toBe("persisted");
      expect(result.view.validationStatus).toBe("passed");
      expect(result.view.repairStatus).toBe("repaired");
      expect(result.view.assessmentRulesVersion).toBe(COORDINATION_DIAGNOSTIC_RULES_VERSION);
      expect(result.view.riskLevel).toBe("low");
      expect(result.view.manualActionHint).toBe("no_action_needed");
    }
  });

  it("shows high risk when validation conflict exists even with retryable repair", async () => {
    const factKey = "risk-case-502|LiquidationCase|liq-case-502|2026-03-25T00:00:02.000Z";
    const observationRegistry = new CoordinationResultObservationRegistry();
    observationRegistry.record({
      scope: "query",
      factKey,
      riskCaseId: "risk-case-502",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-502",
      storeReadHit: true,
      registryFallbackUsed: false,
      validationPassed: false,
      validationFailed: true,
      persistenceWriteSucceeded: false,
      persistenceWriteFailed: false,
      repairAttempted: false,
      repairSucceeded: false,
      repairFailed: false
    });
    const repairRegistry = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationObservationRegistry: observationRegistry
    }).getRepairRecordRegistry();
    repairRegistry.transitionRepairState({
      factKey,
      to: "repair_failed_retryable",
      outcome: "failed",
      repairAttempts: 2,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:04.000Z",
      lastErrorCode: "TQ-APP-004"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairRegistry
    });
    const result = await handler.handle({ factKey });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.view.validationStatus).toBe("failed");
      expect(result.view.repairStatus).toBe("repair_failed_retryable");
      expect(result.view.assessmentRulesVersion).toBe(COORDINATION_DIAGNOSTIC_RULES_VERSION);
      expect(result.view.riskLevel).toBe("high");
      expect(result.view.manualActionHint).toBe("investigate_validation_conflict");
    }
  });

  it("shows medium persistence investigation hint when read-view is fallback-only", async () => {
    const factKey = "risk-case-503|ADLCase|adl-case-503|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-503",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-503",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-503",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "persistence-failed",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-503",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const observationRegistry = new CoordinationResultObservationRegistry();
    observationRegistry.record({
      scope: "persistence",
      factKey,
      riskCaseId: "risk-case-503",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-503",
      storeReadHit: false,
      registryFallbackUsed: true,
      validationPassed: true,
      validationFailed: false,
      persistenceWriteSucceeded: false,
      persistenceWriteFailed: true,
      repairAttempted: true,
      repairSucceeded: false,
      repairFailed: true
    });
    const repairRegistry = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationObservationRegistry: observationRegistry
    }).getRepairRecordRegistry();
    repairRegistry.transitionRepairState({
      factKey,
      to: "repair_failed_retryable",
      outcome: "failed",
      repairAttempts: 1,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:03.000Z",
      lastErrorCode: "TQ-APP-004"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairRegistry
    });
    const result = await handler.handle({ factKey });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.view.currentReadViewStatus).toBe("fallback_only");
      expect(result.view.assessmentRulesVersion).toBe(COORDINATION_DIAGNOSTIC_RULES_VERSION);
      expect(result.view.riskLevel).toBe("medium");
      expect(result.view.manualActionHint).toBe("investigate_persistence_failure");
    }
  });

  it("returns historyAvailable=false when comparison requested but no historical slot", async () => {
    const factKey = "risk-case-504|ADLCase|adl-case-504|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-504",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-504",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-504",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "history-missing",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-504",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });

    const historyRegistry = new CoordinationResultDiagnosticHistoryRegistry();
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryRegistry: historyRegistry
    });

    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.historySource).toBe("unavailable");
      expect(result.historyAvailable).toBe(false);
      expect(result.readAlert).toBeUndefined();
      expect(result.alertSuppression).toBeUndefined();
      expect(result.comparisonResult).toBeUndefined();
    }
  });

  it("returns info alert and emitted suppression on passed replay validation", async () => {
    const factKey = "risk-case-504b|ADLCase|adl-case-504b|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-504b",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-504b",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-504b",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "passed-replay",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-504b",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore
    });

    const baseline = await handler.handle({ factKey });
    expect(baseline.success).toBe(true);
    if (baseline.success) {
      historyStore.byFact.set(factKey, {
        schemaVersion: "1.0.0",
        factKey,
        currentResult: {
          assessmentRulesVersion: baseline.view.assessmentRulesVersion,
          riskLevel: baseline.view.riskLevel,
          manualActionHint: baseline.view.manualActionHint,
          validationStatus: baseline.view.validationStatus,
          repairStatus: baseline.view.repairStatus,
          currentReadViewStatus: baseline.view.currentReadViewStatus
        },
        previousResult: {
          assessmentRulesVersion: baseline.view.assessmentRulesVersion,
          riskLevel: baseline.view.riskLevel,
          manualActionHint: baseline.view.manualActionHint,
          validationStatus: baseline.view.validationStatus,
          repairStatus: baseline.view.repairStatus,
          currentReadViewStatus: baseline.view.currentReadViewStatus
        },
        updatedAt: "2026-03-25T00:00:03.000Z"
      });
    }

    const compared = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(compared.success).toBe(true);
    if (compared.success) {
      expect(compared.historyReplayValidation?.status).toBe("passed");
      expect(compared.readAlert?.severity).toBe("info");
      expect(compared.alertSuppression?.status).toBe("emitted");
      expect(compared.alertSuppression?.repeatCount).toBe(1);
      expect(compared.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(compared.alertSuppressionPersistence?.continuityStatus).toBe("notice");
      expect(compared.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
      expect(compared.alertSuppressionPersistence?.stateRepairStatus).toBe("not_attempted");
      expect(compared.suppressionStateRepair?.repairStatus).toBe("not_repaired");
    }
  });

  it("returns comparison result when historical slot exists", async () => {
    const factKey = "risk-case-505|ADLCase|adl-case-505|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-505",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-505",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-505",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "comparison",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-505",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });

    const observationRegistry = new CoordinationResultObservationRegistry();
    const historyRegistry = new CoordinationResultDiagnosticHistoryRegistry();
    const repairRegistry = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationObservationRegistry: observationRegistry
    }).getRepairRecordRegistry();

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairRegistry,
      diagnosticHistoryRegistry: historyRegistry
    });

    const baseline = await handler.handle({ factKey });
    expect(baseline.success).toBe(true);

    repairRegistry.transitionRepairState({
      factKey,
      to: "repair_failed_retryable",
      outcome: "failed",
      repairAttempts: 2,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:03.000Z",
      lastErrorCode: "TQ-APP-004"
    });

    const compared = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(compared.success).toBe(true);
    if (compared.success) {
      expect(compared.historySource).toBe("in_memory_fallback");
      expect(compared.historyAvailable).toBe(true);
      expect(compared.historyReplayValidation?.status).toBe("notice");
      expect(compared.operationalHint).toBe("inspect_snapshot_conflict");
      expect(compared.readAlert?.severity).toBe("warning");
      expect(compared.readAlert?.requiresAttention).toBe(true);
      expect(compared.alertSuppression?.status).toBe("emitted");
      expect(compared.alertSuppression?.repeatCount).toBe(1);
      expect(compared.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(compared.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
      expect(compared.comparisonResult?.hasDifference).toBe(true);
      expect(compared.comparisonResult?.statusChanged).toBe(true);
      expect(compared.comparisonResult?.manualActionHintChanged).toBe(false);
    }
  });

  it("fails when historical result version is incompatible for comparison", async () => {
    const factKey = "risk-case-506|ADLCase|adl-case-506|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-506",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-506",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-506",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "history-incompatible",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-506",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });

    const historyRegistry = new CoordinationResultDiagnosticHistoryRegistry();
    historyRegistry.record({
      factKey,
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      assessmentRulesVersion: "8.8.8",
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      riskReason: "legacy",
      actionHintReason: "legacy",
      diagnosticSummary: "legacy"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryRegistry: historyRegistry
    });

    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-008");
    }
  });

  it("keeps comparison readable with notice when historical version is explicitly supported", async () => {
    const factKey = "risk-case-507|ADLCase|adl-case-507|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-507",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-507",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-507",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "history-notice",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-507",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });

    const historyRegistry = new CoordinationResultDiagnosticHistoryRegistry();
    historyRegistry.record({
      factKey,
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      assessmentRulesVersion: "0.9.0",
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      riskReason: "legacy-supported",
      actionHintReason: "legacy-supported",
      diagnosticSummary: "legacy-supported"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryRegistry: historyRegistry
    });

    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.historySource).toBe("in_memory_fallback");
      expect(result.readCompatibility).toBe("compatible_read");
      expect(result.compatibilityReason).toContain("historical comparison read with notice");
      expect(result.historyReplayValidation?.status).toBe("notice");
      expect(result.operationalHint).toBe("inspect_snapshot_conflict");
      expect(result.readAlert?.severity).toBe("warning");
      expect(result.alertSuppression?.status).toBe("emitted");
      expect(result.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(result.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
      expect(result.historyAvailable).toBe(true);
      expect(result.comparisonResult).toBeDefined();
    }
  });

  it("persists diagnostic history slot and rotates current/previous", async () => {
    const factKey = "risk-case-508|ADLCase|adl-case-508|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-508",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-508",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-508",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "persist-history",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-508",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const observationRegistry = new CoordinationResultObservationRegistry();
    const repairRegistry = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationObservationRegistry: observationRegistry
    }).getRepairRecordRegistry();
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairRegistry,
      diagnosticHistoryStore: historyStore
    });

    const first = await handler.handle({ factKey });
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.view.riskLevel).toBe("medium");
    }
    const firstSlot = historyStore.byFact.get(factKey);
    expect(firstSlot).toBeDefined();
    expect(firstSlot?.previousResult).toBeUndefined();

    repairRegistry.transitionRepairState({
      factKey,
      to: "repair_failed_retryable",
      outcome: "failed",
      repairAttempts: 2,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:03.000Z",
      lastErrorCode: "TQ-APP-004"
    });
    const second = await handler.handle({ factKey });
    expect(second.success).toBe(true);
    const secondSlot = historyStore.byFact.get(factKey);
    expect(secondSlot).toBeDefined();
    expect(secondSlot?.previousResult).toBeDefined();
    expect(secondSlot?.currentResult.riskLevel).toBe("medium");
    expect(secondSlot?.previousResult?.riskLevel).toBe("medium");
  });

  it("uses persisted history source and returns comparison for includeHistoryComparison", async () => {
    const factKey = "risk-case-509|ADLCase|adl-case-509|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-509",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-509",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-509",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "persisted-comparison",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-509",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        validationStatus: "passed",
        repairStatus: "repaired",
        currentReadViewStatus: "persisted"
      },
      previousResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "medium",
        manualActionHint: "retry_repair_recommended",
        validationStatus: "passed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore
    });

    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.historySource).toBe("persisted");
      expect(result.historyAvailable).toBe(true);
      expect(result.comparisonResult?.hasDifference).toBe(true);
      expect(result.historyConsistency?.status).toBe("notice");
      expect(result.historyReplayValidation?.status).toBe("notice");
      expect(result.historyConflictAttribution?.conflictField).toBe("riskLevel");
      expect(result.operationalHint).toBe("inspect_snapshot_conflict");
      expect(result.readAlert?.severity).toBe("warning");
      expect(result.alertSuppression?.status).toBe("emitted");
      expect(result.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(result.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
    }
  });

  it("returns consistency notice when persisted current conflicts with live current", async () => {
    const factKey = "risk-case-510|ADLCase|adl-case-510|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-510",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-510",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-510",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "consistency-notice",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-510",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.historyConsistency?.status).toBe("notice");
      expect(result.historyNotice).toContain("persisted history consistency notice");
      expect(result.historyReplayValidation?.status).toBe("notice");
      expect(result.historyConflictAttribution?.conflictField).toBe("riskLevel");
      expect(result.operationalHint).toBe("inspect_snapshot_conflict");
      expect(result.readAlert?.severity).toBe("warning");
      expect(result.alertSuppression?.status).toBe("emitted");
      expect(result.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(result.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
      expect(result.historyComparisonNotice).toContain("persisted history consistency notice");
    }
  });

  it("deduplicates repeated alert for same factKey+reasonCategory", async () => {
    const factKey = "risk-case-512|ADLCase|adl-case-512|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-512",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-512",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-512",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "dedup",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-512",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const suppressionRegistry = new DiagnosticAlertSuppressionRegistry();
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRegistry: suppressionRegistry
    });

    const first = await handler.handle({ factKey, includeHistoryComparison: true });
    const second = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.alertSuppression?.status).toBe("emitted");
      expect(second.alertSuppression?.status).toBe("deduplicated");
      expect(second.alertSuppression?.repeatCount).toBe(2);
      expect(second.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(second.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
      expect(second.operationalHint).toBe(first.operationalHint);
      expect(second.readAlert?.severity).toBe(first.readAlert?.severity);
    }
  });

  it("does not deduplicate when reasonCategory differs under same factKey", async () => {
    const factKey = "risk-case-513|ADLCase|adl-case-513|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-513",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-513",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-513",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "reason-change",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-513",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const suppressionRegistry = new DiagnosticAlertSuppressionRegistry();
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRegistry: suppressionRegistry
    });

    const first = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.alertSuppression?.status).toBe("emitted");
      expect(first.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(first.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
    }

    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "0.9.0",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        validationStatus: "passed",
        repairStatus: "repaired",
        currentReadViewStatus: "persisted"
      },
      updatedAt: "2026-03-25T00:00:04.000Z"
    });

    const second = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.historyReplayValidation?.reasonCategory).toBe("version_mismatch");
      expect(second.alertSuppression?.status).toBe("emitted");
      expect(second.alertSuppression?.repeatCount).toBe(1);
      expect(second.alertSuppressionPersistence?.source).toBe("in_memory_only");
      expect(second.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
    }
  });

  it("uses persisted suppression store for cross-session repeatCount continuity", async () => {
    const factKey = "risk-case-514|ADLCase|adl-case-514|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-514",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-514",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-514",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "suppression-persisted",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-514",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const suppressionStore = new FakeDiagnosticAlertSuppressionStore();

    const firstHandler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore
    });
    const first = await firstHandler.handle({ factKey, includeHistoryComparison: true });
    expect(first.success).toBe(true);
    if (first.success) {
      expect(first.alertSuppression?.status).toBe("emitted");
      expect(first.alertSuppressionPersistence?.source).toBe("persisted");
      expect(first.alertSuppressionPersistence?.writeStatus).toBe("written");
      expect(first.alertSuppressionPersistence?.stateReadCompatibility).toBe("state_missing");
    }

    const secondHandler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore
    });
    const second = await secondHandler.handle({ factKey, includeHistoryComparison: true });
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.alertSuppression?.status).toBe("deduplicated");
      expect(second.alertSuppression?.repeatCount).toBe(2);
      expect(second.alertSuppressionPersistence?.source).toBe("persisted");
      expect(second.alertSuppressionPersistence?.continuityStatus).toBe("passed");
      expect(second.alertSuppressionPersistence?.isRepeatCountContinuous).toBe(true);
      expect(second.alertSuppressionPersistence?.stateReadCompatibility).toBe("compatible_read");
      expect(second.suppressionStateRepair?.repairStatus).toBe("repaired");
      expect(second.suppressionStateRepair?.repairAttempts).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns persisted_with_fallback when persisted suppression continuity fails", async () => {
    const factKey = "risk-case-515|ADLCase|adl-case-515|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-515",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-515",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-515",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "suppression-continuity-fail",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-515",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const suppressionStore = new FakeDiagnosticAlertSuppressionStore();
    const mismatchedState = {
      schemaVersion: "1.0.0",
      suppressionKey: `${factKey}|version_mismatch`,
      factKey,
      reasonCategory: "current_snapshot_conflict",
      severity: "warning" as const,
      triggerSource: "replay_validation" as const,
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 5,
      lastStatus: "deduplicated" as const
    };
    suppressionStore.byKey.set(`${factKey}|current_snapshot_conflict`, mismatchedState);
    suppressionStore.byKey.set(`${factKey}|status_field_conflict`, {
      ...mismatchedState,
      reasonCategory: "status_field_conflict"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.alertSuppressionPersistence?.source).toBe("persisted_with_fallback");
      expect(result.alertSuppressionPersistence?.continuityStatus).toBe("failed");
      expect(result.alertSuppressionPersistence?.continuityReasonCategory).toBe("suppression_key_mismatch");
      expect(result.alertSuppressionPersistence?.stateReadCompatibility).toBe("compatible_read");
      expect(result.alertSuppressionPersistence?.stateRepairRecommended).toBe(true);
      expect(result.suppressionStateRepair?.repairStatus).toBe("repair_failed_manual_confirmation_required");
      expect(result.suppressionStateRepair?.canConfirmManually).toBe(true);
    }
  });

  it("returns compatible_with_notice when persisted suppression state is readable old version", async () => {
    const factKey = "risk-case-516|ADLCase|adl-case-516|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-516",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-516",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-516",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "suppression-old-version",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-516",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const suppressionStore = new FakeDiagnosticAlertSuppressionStore();
    suppressionStore.byKey.set(`${factKey}|current_snapshot_conflict`, {
      schemaVersion: "0.9.0",
      suppressionKey: `${factKey}|current_snapshot_conflict`,
      factKey,
      reasonCategory: "current_snapshot_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 1,
      lastStatus: "emitted"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.alertSuppressionPersistence?.source).toBe("persisted");
      expect(result.alertSuppressionPersistence?.stateReadCompatibility).toBe("compatible_with_notice");
      expect(result.alertSuppressionPersistence?.stateRepairAvailable).toBe(true);
      expect(result.alertSuppressionPersistence?.stateRepairRecommended).toBe(true);
      expect(result.suppressionStateRepair?.repairStatus).toBe("repaired");
    }
  });

  it("fails when persisted history slot schema version is missing", async () => {
    const factKey = "risk-case-511|ADLCase|adl-case-511|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-511",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-511",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-511",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "missing-schema",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-511",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        validationStatus: "passed",
        repairStatus: "repaired",
        currentReadViewStatus: "persisted"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-007");
    }
  });

  it("reads persisted suppression repair lifecycle slot with continuity passed", async () => {
    const factKey = "risk-case-517|ADLCase|adl-case-517|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-517",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-517",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-517",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "lifecycle-persisted-read",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-517",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    lifecycleStore.byKey.set(`${factKey}|current_snapshot_conflict`, {
      schemaVersion: "1.0.0",
      suppressionKey: `${factKey}|current_snapshot_conflict`,
      currentLifecycle: {
        repairStatus: "manually_confirmed",
        repairAttempts: 2,
        lastRepairOutcome: "manually_confirmed",
        manualConfirmation: true,
        lastReason: "manual takeover",
        lastAttemptedAt: "2026-03-25T00:00:03.000Z",
        targetSuppressionKey: `${factKey}|current_snapshot_conflict`,
        canRetry: true,
        canConfirmManually: false
      },
      previousLifecycle: {
        repairStatus: "repair_failed_manual_confirmation_required",
        repairAttempts: 1,
        lastRepairOutcome: "failed",
        manualConfirmation: false,
        lastReason: "semantic conflict",
        lastAttemptedAt: "2026-03-25T00:00:02.000Z",
        targetSuppressionKey: `${factKey}|current_snapshot_conflict`,
        canRetry: false,
        canConfirmManually: true
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepair?.repairStatus).toBe("manually_confirmed");
      expect(result.suppressionStateRepairPersistence?.source).toBe("persisted");
      expect(result.suppressionStateRepairPersistence?.continuityStatus).toBe("passed");
      expect(result.suppressionStateRepairPersistence?.historyAvailable).toBe(true);
      expect(result.suppressionStateRepairPersistence?.previousLifecycleAvailable).toBe(true);
    }
  });

  it("returns in_memory_only lifecycle persistence when lifecycle slot is missing", async () => {
    const factKey = "risk-case-518|ADLCase|adl-case-518|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-518",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-518",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-518",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "lifecycle-slot-missing",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-518",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: new FakeDiagnosticAlertSuppressionRepairLifecycleStore()
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairPersistence?.source).toBe("in_memory_only");
      expect(result.suppressionStateRepairPersistence?.continuityStatus).toBe("notice");
    }
  });

  it("returns persisted_with_fallback when persisted lifecycle attempts regress", async () => {
    const factKey = "risk-case-519|ADLCase|adl-case-519|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-519",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-519",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-519",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "lifecycle-attempt-regress",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-519",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleRegistry = new DiagnosticAlertSuppressionStateRepairLifecycleRegistry();
    lifecycleRegistry.setState({
      targetSuppressionKey: `${factKey}|current_snapshot_conflict`,
      repairStatus: "repair_failed_retryable",
      repairAttempts: 4,
      manualConfirmation: false,
      lastUpdatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    lifecycleStore.byKey.set(`${factKey}|current_snapshot_conflict`, {
      schemaVersion: "1.0.0",
      suppressionKey: `${factKey}|current_snapshot_conflict`,
      currentLifecycle: {
        repairStatus: "repair_failed_retryable",
        repairAttempts: 2,
        manualConfirmation: false,
        targetSuppressionKey: `${factKey}|current_snapshot_conflict`,
        canRetry: true,
        canConfirmManually: true
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleRegistry: lifecycleRegistry,
      alertSuppressionRepairLifecycleStore: lifecycleStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairPersistence?.source).toBe("persisted_with_fallback");
      expect(result.suppressionStateRepairPersistence?.continuityStatus).toBe("failed");
      expect(result.suppressionStateRepairPersistence?.continuityReasonCategory).toBe("attempts_regressed");
    }
  });

  it("returns command link passed when latest command record matches lifecycle slot", async () => {
    const factKey = "risk-case-520|ADLCase|adl-case-520|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-520",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-520",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-520",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "command-link-pass",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-520",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    const suppressionKey = `${factKey}|current_snapshot_conflict`;
    lifecycleStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      currentLifecycle: {
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: true,
        lastAttemptedAt: "2026-03-25T00:00:03.000Z",
        lastRepairedAt: "2026-03-25T00:00:03.000Z",
        targetSuppressionKey: suppressionKey,
        canRetry: false,
        canConfirmManually: false
      },
      lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    commandStore.byKey.set(suppressionKey, {
      commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      commandType: "retry",
      suppressionKey,
      triggeredAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator",
      outcome: "repaired",
      outcomeReason: "ok",
      resultingRepairStatus: "repaired",
      linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: commandStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus).toBe("passed");
      expect(result.suppressionStateRepairCommandLink?.lastCommandType).toBe("retry");
      expect(result.suppressionStateRepairCommandLink?.lastCommandOutcome).toBe("repaired");
    }
  });

  it("returns command-link missing_record when lifecycle references absent record", async () => {
    const factKey = "risk-case-521|ADLCase|adl-case-521|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-521",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-521",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-521",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "command-link-missing",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-521",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const suppressionKey = `${factKey}|current_snapshot_conflict`;
    lifecycleStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      currentLifecycle: {
        repairStatus: "repair_failed_retryable",
        repairAttempts: 1,
        lastRepairOutcome: "failed",
        manualConfirmation: false,
        lastAttemptedAt: "2026-03-25T00:00:03.000Z",
        targetSuppressionKey: suppressionKey,
        canRetry: true,
        canConfirmManually: true
      },
      lastCommandRecordId: "missing-record-id",
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: new FakeDiagnosticAlertSuppressionRepairCommandRecordStore()
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus).toBe("missing_record");
    }
  });

  it("returns command-link status_mismatch when resulting status mismatches lifecycle", async () => {
    const factKey = "risk-case-522|ADLCase|adl-case-522|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-522",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-522",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-522",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "command-link-status-mismatch",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-522",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    const suppressionKey = `${factKey}|current_snapshot_conflict`;
    lifecycleStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      currentLifecycle: {
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: true,
        lastAttemptedAt: "2026-03-25T00:00:03.000Z",
        lastRepairedAt: "2026-03-25T00:00:03.000Z",
        targetSuppressionKey: suppressionKey,
        canRetry: false,
        canConfirmManually: false
      },
      lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    commandStore.byKey.set(suppressionKey, {
      commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      commandType: "retry",
      suppressionKey,
      triggeredAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator",
      outcome: "repaired",
      outcomeReason: "ok",
      resultingRepairStatus: "manually_confirmed",
      linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: commandStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus).toBe("status_mismatch");
    }
  });

  it("returns command-link key_mismatch when command suppressionKey mismatches lifecycle key", async () => {
    const factKey = "risk-case-523|ADLCase|adl-case-523|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-523",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-523",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-523",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "command-link-key-mismatch",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-523",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "investigate_validation_conflict",
        validationStatus: "failed",
        repairStatus: "repair_failed_retryable",
        currentReadViewStatus: "fallback_only"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    const suppressionKey = `${factKey}|current_snapshot_conflict`;
    lifecycleStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      currentLifecycle: {
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: true,
        lastAttemptedAt: "2026-03-25T00:00:03.000Z",
        lastRepairedAt: "2026-03-25T00:00:03.000Z",
        targetSuppressionKey: suppressionKey,
        canRetry: false,
        canConfirmManually: false
      },
      lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      updatedAt: "2026-03-25T00:00:03.000Z"
    });
    commandStore.byKey.set(suppressionKey, {
      commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
      commandType: "retry",
      suppressionKey: `${factKey}|status_field_conflict`,
      triggeredAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator",
      outcome: "repaired",
      outcomeReason: "ok",
      resultingRepairStatus: "repaired",
      linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
    });
    const handler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: new FakeCoordinationResultStore(),
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: new CoordinationResultObservationRegistry(),
      repairRecordRegistry: new CoordinationResultRepairCommandHandler({
        coordinationResultRegistry: registry,
        coordinationResultStore: new FakeCoordinationResultStore()
      }).getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: commandStore
    });
    const result = await handler.handle({ factKey, includeHistoryComparison: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus).toBe("key_mismatch");
    }
  });
});
