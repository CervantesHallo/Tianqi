import {
  ADLCase,
  CaseState,
  LiquidationCase,
  LiquidationCaseState,
  LiquidationCaseTransitionAction,
  RiskCase,
  RiskCaseType,
  resolveStageForState
} from "@tianqi/domain";
import type {
  ADLCaseRepositoryPort,
  CoordinationMetricsObservationRecord,
  CoordinationMetricsSinkPort,
  CoordinationResultStorePort,
  LiquidationCaseRepositoryPort,
  RiskCaseRepositoryPort,
  StoredRiskCaseCoordinationResult
} from "@tianqi/ports";
import {
  createADLCaseId,
  createConfigVersion,
  createLiquidationCaseId,
  createRiskCaseId,
  createTraceId,
  err,
  ok
} from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { CoordinationResultQueryHandler } from "./coordination-result-query-handler.js";
import { CoordinationResultDiagnosticQueryHandler } from "./coordination-result-diagnostic-query-handler.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import { CoordinationResultRepairCommandHandler } from "./coordination-result-repair-command-handler.js";
import { mapCoordinationResultViewToStoredRecord } from "./coordination-result-persistence-mapper.js";
import { CoreCaseFlowCommandHandler } from "./core-case-flow-command-handler.js";

class FakeRiskCaseRepository implements RiskCaseRepositoryPort {
  public readonly store = new Map<string, RiskCase>();

  public async getById(caseId: ReturnType<typeof createRiskCaseId>) {
    return ok(this.store.get(caseId) ?? null);
  }

  public async save(riskCase: RiskCase) {
    this.store.set(riskCase.id, riskCase);
    return ok(undefined);
  }
}

class FakeLiquidationCaseRepository implements LiquidationCaseRepositoryPort {
  public readonly store = new Map<string, LiquidationCase>();

  public async getById(caseId: ReturnType<typeof createLiquidationCaseId>) {
    return ok(this.store.get(caseId) ?? null);
  }

  public async listBySourceRiskCaseId(sourceRiskCaseId: ReturnType<typeof createRiskCaseId>) {
    return ok([...this.store.values()].filter((item) => item.sourceRiskCaseId === sourceRiskCaseId));
  }

  public async save(liquidationCase: LiquidationCase) {
    this.store.set(liquidationCase.id, liquidationCase);
    return ok(undefined);
  }
}

class FakeADLCaseRepository implements ADLCaseRepositoryPort {
  public readonly store = new Map<string, ADLCase>();

  public async getById(caseId: ReturnType<typeof createADLCaseId>) {
    return ok(this.store.get(caseId) ?? null);
  }

  public async listBySourceRiskCaseId(sourceRiskCaseId: ReturnType<typeof createRiskCaseId>) {
    return ok([...this.store.values()].filter((item) => item.sourceRiskCaseId === sourceRiskCaseId));
  }

  public async save(adlCase: ADLCase) {
    this.store.set(adlCase.id, adlCase);
    return ok(undefined);
  }
}

class FakeCoordinationResultStore implements CoordinationResultStorePort {
  public readonly byFact = new Map<string, StoredRiskCaseCoordinationResult>();

  public failPut = false;

  public async put(record: StoredRiskCaseCoordinationResult) {
    if (this.failPut) {
      return err({ message: "put failed intentionally" });
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

class FakeCoordinationMetricsSink implements CoordinationMetricsSinkPort {
  public readonly records: CoordinationMetricsObservationRecord[] = [];

  public async record(observation: CoordinationMetricsObservationRecord) {
    this.records.push(observation);
    return ok(undefined);
  }
}

const createRiskCaseAtState = (caseId: string, state: CaseState): RiskCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const riskCase = RiskCase.rehydrate({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    state,
    stage: resolveStageForState(state),
    configVersion: createConfigVersion(1),
    createdAt,
    updatedAt: createdAt
  });
  if (!riskCase.ok) {
    throw new Error("failed to seed risk case");
  }
  return riskCase.value;
};

const createLiquidationCaseAtState = (
  caseId: string,
  sourceRiskCaseId: string,
  state: LiquidationCaseState
): LiquidationCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const liquidationCase = LiquidationCase.rehydrate({
    id: createLiquidationCaseId(caseId),
    sourceRiskCaseId: createRiskCaseId(sourceRiskCaseId),
    traceId: createTraceId(`trace-${caseId}`),
    configVersion: createConfigVersion(1),
    state,
    createdAt,
    updatedAt: new Date("2026-03-25T00:00:01.000Z")
  });
  if (!liquidationCase.ok) {
    throw new Error("failed to seed liquidation case");
  }
  return liquidationCase.value;
};

describe("CoordinationResultRepairCommandHandler", () => {
  it("repairs missing persisted read-view from registry source", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-400",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-400",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Classified",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-400",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "repair-source",
        relatedCaseType: "LiquidationCase",
        relatedCaseId: "liq-case-400",
        context: {
          arbitration_decision: "applied",
          signal_category: "normal"
        },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });

    const result = await repairHandler.handle({
      factKey: "risk-case-400|LiquidationCase|liq-case-400|2026-03-25T00:00:02.000Z",
      reason: "repair missing persisted view",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("repaired");
      expect(result.observation.repairSucceeded).toBe(true);
      expect(result.observation.persistenceWriteSucceeded).toBe(true);
    }
    expect(store.byFact.size).toBe(1);
    expect(metrics.records.some((item) => item.scope === "repair" && item.repairSucceeded)).toBe(true);
  });

  it("repairs after persistence write failure from write path", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    store.failPut = true;
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set("risk-case-401", createRiskCaseAtState("risk-case-401", CaseState.Classified));
    liqRepo.store.set(
      "liq-case-401",
      createLiquidationCaseAtState("liq-case-401", "risk-case-401", LiquidationCaseState.InProgress)
    );
    const flow = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });
    const transition = await flow.handleTransitionLiquidationCase({
      traceId: "trace-repair-after-write-fail",
      liquidationCaseId: "liq-case-401",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "write failed before repair",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(transition.success).toBe(false);

    store.failPut = false;
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });
    const repaired = await repairHandler.handle({
      riskCaseId: "risk-case-401",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-401",
      occurredAt: "2026-03-25T00:00:02.000Z",
      reason: "repair after failed persistence",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.record.outcome).toBe("repaired");
    }
    expect(store.byFact.size).toBe(1);

    const query = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const queried = await query.handle({
      riskCaseId: "risk-case-401",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-401"
    });
    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.observation.storeReadHit).toBe(true);
    }
  });

  it("returns failure when repair source is missing", async () => {
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: new FakeCoordinationResultStore()
    });

    const result = await repairHandler.handle({
      factKey: "risk-case-402|ADLCase|adl-case-402|2026-03-25T00:00:02.000Z",
      reason: "missing source",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-003");
      expect(result.observation.repairFailed).toBe(true);
    }
  });

  it("blocks repair when existing stored schema version is incompatible", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-403",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-403",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-403",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "schema incompatible",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-403",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    await store.put({
      ...mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-403",
        subcaseType: "ADLCase",
        subcaseId: "adl-case-403",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Settling",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-403",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "schema incompatible",
          relatedCaseType: "ADLCase",
          relatedCaseId: "adl-case-403",
          context: { arbitration_decision: "applied", signal_category: "normal" },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      }),
      schemaVersion: "9.9.9"
    });
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const result = await repairHandler.handle({
      factKey: "risk-case-403|ADLCase|adl-case-403|2026-03-25T00:00:02.000Z",
      reason: "schema blocked",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-008");
    }
  });

  it("blocks repair when replay validation detects conflict", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-404",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-404",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Classified",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-404",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "conflict",
        relatedCaseType: "LiquidationCase",
        relatedCaseId: "liq-case-404",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    await store.put(
      mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-404",
        subcaseType: "LiquidationCase",
        subcaseId: "liq-case-404",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Classified",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-404",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "conflict",
          relatedCaseType: "LiquidationCase",
          relatedCaseId: "liq-case-404",
          context: { arbitration_decision: "rejected", signal_category: "normal" },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      })
    );
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const result = await repairHandler.handle({
      factKey: "risk-case-404|LiquidationCase|liq-case-404|2026-03-25T00:00:02.000Z",
      reason: "validation conflict",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-002");
    }
  });

  it("returns already_persisted noop for idempotent repair", async () => {
    const registry = new CoordinationResultRegistry();
    const readView = {
      riskCaseId: "risk-case-405",
      subcaseType: "ADLCase" as const,
      subcaseId: "adl-case-405",
      signalCategory: "normal" as const,
      decision: "applied" as const,
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-405",
        caseType: "RiskCase" as const,
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "idempotent",
        relatedCaseType: "ADLCase" as const,
        relatedCaseId: "adl-case-405",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command" as const
    };
    registry.record(readView);
    const store = new FakeCoordinationResultStore();
    await store.put(mapCoordinationResultViewToStoredRecord(readView));
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });

    const result = await repairHandler.handle({
      factKey: "risk-case-405|ADLCase|adl-case-405|2026-03-25T00:00:02.000Z",
      reason: "idempotent repair",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("already_persisted");
      expect(result.observation.repairSucceeded).toBe(true);
      expect(result.observation.persistenceWriteSucceeded).toBe(false);
    }
  });

  it("repair does not mutate business fact state", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-406", createRiskCaseAtState("risk-case-406", CaseState.Closed));
    const beforeState = riskRepo.store.get("risk-case-406")?.state;
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-406",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-406",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-406",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "boundary",
        relatedCaseType: "LiquidationCase",
        relatedCaseId: "liq-case-406",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: new FakeCoordinationResultStore()
    });
    const result = await repairHandler.handle({
      factKey: "risk-case-406|LiquidationCase|liq-case-406|2026-03-25T00:00:02.000Z",
      reason: "boundary no business mutation",
      repairedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(true);
    expect(riskRepo.store.get("risk-case-406")?.state).toBe(beforeState);
  });

  it("marks failed repair as retryable and allows retry to reach repaired", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-407",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-407",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Classified",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-407",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "retryable",
        relatedCaseType: "LiquidationCase",
        relatedCaseId: "liq-case-407",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    store.failPut = true;
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const first = await repairHandler.handle({
      factKey: "risk-case-407|LiquidationCase|liq-case-407|2026-03-25T00:00:02.000Z",
      reason: "first fail",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(first.success).toBe(false);
    if (!first.success) {
      expect(first.record.repairStatus).toBe("repair_failed_retryable");
      expect(first.record.repairAttempts).toBe(1);
    }

    store.failPut = false;
    const retried = await repairHandler.handleRetry({
      factKey: "risk-case-407|LiquidationCase|liq-case-407|2026-03-25T00:00:02.000Z",
      reason: "retry success",
      retriedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "manual"
    });
    expect(retried.success).toBe(true);
    if (retried.success) {
      expect(retried.record.repairStatus).toBe("repaired");
      expect(retried.record.repairAttempts).toBe(2);
      expect(retried.record.commandType).toBe("retry");
    }
  });

  it("supports manual confirmation for failed repair and exposes status", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-408",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-408",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-408",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "manual confirmation",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-408",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    await store.put(
      mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-408",
        subcaseType: "ADLCase",
        subcaseId: "adl-case-408",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Settling",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-408",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "manual confirmation",
          relatedCaseType: "ADLCase",
          relatedCaseId: "adl-case-408",
          context: { arbitration_decision: "rejected", signal_category: "normal" },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      })
    );
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const failed = await repairHandler.handle({
      factKey: "risk-case-408|ADLCase|adl-case-408|2026-03-25T00:00:02.000Z",
      reason: "cause manual status",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.record.repairStatus).toBe("repair_failed_manual_confirmation_required");
    }

    const confirmed = await repairHandler.handleConfirmManually({
      factKey: "risk-case-408|ADLCase|adl-case-408|2026-03-25T00:00:02.000Z",
      reason: "manual confirmed",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(confirmed.success).toBe(true);
    if (confirmed.success) {
      expect(confirmed.record.repairStatus).toBe("manually_confirmed");
      expect(confirmed.record.outcome).toBe("manually_confirmed");
      expect(confirmed.record.manualConfirmation).toBe(true);
    }
  });

  it("blocks manual confirmation when status is repaired", async () => {
    const registry = new CoordinationResultRegistry();
    const readView = {
      riskCaseId: "risk-case-409",
      subcaseType: "ADLCase" as const,
      subcaseId: "adl-case-409",
      signalCategory: "normal" as const,
      decision: "applied" as const,
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-409",
        caseType: "RiskCase" as const,
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "repaired",
        relatedCaseType: "ADLCase" as const,
        relatedCaseId: "adl-case-409",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command" as const
    };
    registry.record(readView);
    const store = new FakeCoordinationResultStore();
    await store.put(mapCoordinationResultViewToStoredRecord(readView));
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const repaired = await repairHandler.handle({
      factKey: "risk-case-409|ADLCase|adl-case-409|2026-03-25T00:00:02.000Z",
      reason: "noop repaired",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(repaired.success).toBe(true);

    const confirm = await repairHandler.handleConfirmManually({
      factKey: "risk-case-409|ADLCase|adl-case-409|2026-03-25T00:00:02.000Z",
      reason: "invalid confirm",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(confirm.success).toBe(false);
    if (!confirm.success) {
      expect(confirm.error.code).toBe("TQ-APP-002");
    }
  });

  it("blocks retry when status is non-retryable", async () => {
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-412",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-412",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-412",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "non-retryable",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-412",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    await store.put(
      mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-412",
        subcaseType: "ADLCase",
        subcaseId: "adl-case-412",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Settling",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-412",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "non-retryable",
          relatedCaseType: "ADLCase",
          relatedCaseId: "adl-case-412",
          context: { arbitration_decision: "rejected", signal_category: "normal" },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      })
    );
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const failed = await repairHandler.handle({
      factKey: "risk-case-412|ADLCase|adl-case-412|2026-03-25T00:00:02.000Z",
      reason: "become manual required",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.record.repairStatus).toBe("repair_failed_manual_confirmation_required");
    }

    const retried = await repairHandler.handleRetry({
      factKey: "risk-case-412|ADLCase|adl-case-412|2026-03-25T00:00:02.000Z",
      reason: "blocked retry",
      retriedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "manual"
    });
    expect(retried.success).toBe(false);
    if (!retried.success) {
      expect(retried.error.code).toBe("TQ-APP-002");
    }
  });

  it("aggregates query/persistence/repair observations into diagnostic view", async () => {
    const observationRegistry = new CoordinationResultObservationRegistry();
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set("risk-case-410", createRiskCaseAtState("risk-case-410", CaseState.Classified));
    liqRepo.store.set(
      "liq-case-410",
      createLiquidationCaseAtState("liq-case-410", "risk-case-410", LiquidationCaseState.InProgress)
    );
    const flow = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics,
      coordinationObservationRegistry: observationRegistry
    });
    const transitioned = await flow.handleTransitionLiquidationCase({
      traceId: "trace-diagnostic-view",
      liquidationCaseId: "liq-case-410",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "diagnostic base",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(transitioned.success).toBe(true);

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationObservationRegistry: observationRegistry
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-410",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-410"
    });
    expect(queried.success).toBe(true);

    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationObservationRegistry: observationRegistry
    });
    const repaired = await repairHandler.handle({
      factKey: "risk-case-410|LiquidationCase|liq-case-410|2026-03-25T00:00:02.000Z",
      reason: "diagnostic repair noop",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(repaired.success).toBe(true);

    const diagnostic = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: store,
      coordinationResultRegistry: registry,
      coordinationObservationRegistry: observationRegistry,
      repairRecordRegistry: repairHandler.getRepairRecordRegistry()
    });
    const diag = await diagnostic.handle({
      factKey: "risk-case-410|LiquidationCase|liq-case-410|2026-03-25T00:00:02.000Z"
    });
    expect(diag.success).toBe(true);
    if (diag.success) {
      expect(diag.view.currentReadViewStatus).toBe("persisted");
      expect(diag.view.repairStatus).toBe("repaired");
      expect(diag.view.repairAttempts).toBe(1);
      expect(diag.view.lastQueryObservation?.scope).toBe("query");
      expect(diag.view.lastPersistenceObservation?.scope).toBe("persistence");
      expect(diag.view.lastRepairObservation?.scope).toBe("repair");
    }
  });

  it("allows retry after manually_confirmed status", async () => {
    const factKey = "risk-case-411|LiquidationCase|liq-case-411|2026-03-25T00:00:02.000Z";
    const registry = new CoordinationResultRegistry();
    registry.record({
      riskCaseId: "risk-case-411",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-411",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Classified",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-411",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "manual then retry",
        relatedCaseType: "LiquidationCase",
        relatedCaseId: "liq-case-411",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const store = new FakeCoordinationResultStore();
    store.failPut = true;
    const repairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const failed = await repairHandler.handle({
      factKey,
      reason: "first fail",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(failed.success).toBe(false);
    if (!failed.success) {
      expect(failed.record.repairStatus).toBe("repair_failed_retryable");
    }
    const confirmed = await repairHandler.handleConfirmManually({
      factKey,
      reason: "confirmed before retry",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(confirmed.success).toBe(true);
    if (confirmed.success) {
      expect(confirmed.record.repairStatus).toBe("manually_confirmed");
    }

    store.failPut = false;
    const retried = await repairHandler.handleRetry({
      factKey,
      reason: "retry after manual confirmation",
      retriedAt: "2026-03-25T00:00:05.000Z",
      triggeredBy: "manual"
    });
    expect(retried.success).toBe(true);
    if (retried.success) {
      expect(retried.record.repairStatus).toBe("repaired");
      expect(retried.record.commandType).toBe("retry");
    }
  });
});
