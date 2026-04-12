import {
  ADLCase,
  ADLCaseState,
  ADLCaseTransitionAction,
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
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
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

  public failRead = false;

  public async put(record: StoredRiskCaseCoordinationResult) {
    if (this.failPut) {
      return err({ message: "put failed intentionally" });
    }
    this.byFact.set(record.factKey, record);
    return ok(undefined);
  }

  public async getByFactKey(factKey: string) {
    if (this.failRead) {
      return err({ message: "read failed intentionally" });
    }
    const record = this.byFact.get(factKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }

  public async getLatestByRiskCaseAndSubcase(input: {
    readonly riskCaseId: string;
    readonly subcaseType: "LiquidationCase" | "ADLCase";
    readonly subcaseId: string;
  }) {
    if (this.failRead) {
      return err({ message: "read failed intentionally" });
    }
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

  public fail = false;

  public async record(observation: CoordinationMetricsObservationRecord) {
    this.records.push(observation);
    if (this.fail) {
      return err({ message: "metrics sink failed intentionally" });
    }
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

const createRiskCaseAtStateWithUpdatedAt = (caseId: string, state: CaseState, updatedAtIso: string): RiskCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const riskCase = RiskCase.rehydrate({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    state,
    stage: resolveStageForState(state),
    configVersion: createConfigVersion(1),
    createdAt,
    updatedAt: new Date(updatedAtIso)
  });
  if (!riskCase.ok) {
    throw new Error("failed to seed risk case with custom updatedAt");
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

const createAdlCaseAtState = (caseId: string, sourceRiskCaseId: string, state: ADLCaseState): ADLCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const adlCase = ADLCase.rehydrate({
    id: createADLCaseId(caseId),
    sourceRiskCaseId: createRiskCaseId(sourceRiskCaseId),
    traceId: createTraceId(`trace-${caseId}`),
    configVersion: createConfigVersion(1),
    state,
    createdAt,
    updatedAt: new Date("2026-03-25T00:00:01.000Z")
  });
  if (!adlCase.ok) {
    throw new Error("failed to seed adl case");
  }
  return adlCase.value;
};

describe("CoordinationResultQueryHandler", () => {
  it("reads stable coordination view from auto coordination path", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set("risk-case-300", createRiskCaseAtState("risk-case-300", CaseState.Classified));
    liqRepo.store.set(
      "liq-case-300",
      createLiquidationCaseAtState("liq-case-300", "risk-case-300", LiquidationCaseState.InProgress)
    );
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });
    const transition = await commandHandler.handleTransitionLiquidationCase({
      traceId: "trace-auto-query",
      liquidationCaseId: "liq-case-300",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "auto coordination read view",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(transition.success).toBe(true);
    expect(store.byFact.size).toBe(1);
    const persisted = [...store.byFact.values()][0];
    if (!persisted) {
      throw new Error("expected persisted coordination record");
    }
    expect(persisted.schemaVersion).toBe("1.0.0");
    expect(persisted.subcaseType).toBe("LiquidationCase");
    expect(persisted.decision).toBe("applied");

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-300",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-300"
    });

    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.view.signalCategory).toBe("normal");
      expect(queried.view.decision).toBe("applied");
      expect(queried.view.resolutionAction).toBe("MarkRiskCaseResolvedAfterSubcaseCompletion");
      expect(queried.view.afterState).toBe("Closed");
      expect(queried.view.auditRecordSummary.context?.signal_category).toBe("normal");
      expect(queried.observation.storeReadHit).toBe(true);
      expect(queried.observation.validationPassed).toBe(true);
      expect(queried.metricsSink.status).toBe("succeeded");
    }
    expect(metrics.records.some((item) => item.scope === "persistence" && item.persistenceWriteSucceeded)).toBe(true);
  });

  it("keeps equivalent read view across auto and explicit coordination paths", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const riskRepo = new FakeRiskCaseRepository();
    const adlRepo = new FakeADLCaseRepository();
    riskRepo.store.set("risk-case-301", createRiskCaseAtState("risk-case-301", CaseState.Settling));
    adlRepo.store.set("adl-case-301", createAdlCaseAtState("adl-case-301", "risk-case-301", ADLCaseState.Queued));
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo,
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });

    const autoResult = await commandHandler.handleTransitionADLCase({
      traceId: "trace-auto-consistency",
      adlCaseId: "adl-case-301",
      action: ADLCaseTransitionAction.Execute,
      reason: "auto consistency baseline",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(autoResult.success).toBe(true);

    const explicitResult = await commandHandler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-explicit-consistency",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-301",
      reason: "explicit replay consistency",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(explicitResult.success).toBe(true);
    if (explicitResult.success) {
      expect(explicitResult.resolution?.decision).toBe("duplicate");
      expect(explicitResult.resolution?.signalCategory).toBe("duplicate");
    }
    expect(store.byFact.size).toBe(1);
    const persisted = [...store.byFact.values()][0];
    if (!persisted) {
      throw new Error("expected persisted coordination record");
    }
    expect(persisted.decision).toBe("applied");

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-301",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-301"
    });

    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.view.decision).toBe("applied");
      expect(queried.view.afterState).toBe("Closed");
      expect(queried.view.sourceCommandPath).toBe("subcase_transition_auto_coordination");
    }
  });

  it("writes explicit coordination result into persistence boundary", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const riskRepo = new FakeRiskCaseRepository();
    const adlRepo = new FakeADLCaseRepository();
    riskRepo.store.set("risk-case-311", createRiskCaseAtState("risk-case-311", CaseState.Classified));
    adlRepo.store.set("adl-case-311", createAdlCaseAtState("adl-case-311", "risk-case-311", ADLCaseState.Executed));
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo,
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });

    const explicitResult = await commandHandler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-explicit-store",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-311",
      reason: "explicit persisted",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(explicitResult.success).toBe(true);
    expect(store.byFact.size).toBe(1);
    const persisted = [...store.byFact.values()][0];
    if (!persisted) {
      throw new Error("expected persisted coordination record");
    }
    expect(persisted.sourceCommandPath).toBe("explicit_coordination_command");
  });

  it("keeps late signal read semantics stable", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set(
      "risk-case-302",
      createRiskCaseAtStateWithUpdatedAt("risk-case-302", CaseState.Closed, "2026-03-25T00:00:05.000Z")
    );
    liqRepo.store.set(
      "liq-case-302",
      createLiquidationCaseAtState("liq-case-302", "risk-case-302", LiquidationCaseState.Completed)
    );
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });

    const explicitResult = await commandHandler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-late-stable",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-302",
      reason: "late low-priority signal",
      triggeredBy: "system",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:01.000Z"
    });
    expect(explicitResult.success).toBe(true);
    if (explicitResult.success) {
      expect(explicitResult.resolution?.signalCategory).toBe("late");
      expect(explicitResult.resolution?.decision).toBe("ignored");
    }

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-302",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-302"
    });
    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.view.signalCategory).toBe("late");
      expect(queried.view.decision).toBe("ignored");
      expect(queried.view.auditRecordSummary.context?.arbitration_decision).toBe("ignored");
      expect(queried.observation.storeReadHit).toBe(true);
    }
  });

  it("returns structured not-found error when read view is missing", async () => {
    const store = new FakeCoordinationResultStore();
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: store
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-missing",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-missing"
    });

    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-003");
    }
  });

  it("does not require caller to assemble view for non-coordination create path", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-303", createRiskCaseAtState("risk-case-303", CaseState.Classified));
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const created = await commandHandler.handleCreateADLCaseFromRiskCase({
      traceId: "trace-create-no-coordination-view",
      adlCaseId: "adl-case-303",
      riskCaseId: "risk-case-303",
      reason: "create only",
      triggeredBy: "manual",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });
    expect(created.success).toBe(true);

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-303",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-303"
    });

    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-003");
    }
  });

  it("returns structured error when persistence write fails on coordination path", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    store.failPut = true;
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set("risk-case-304", createRiskCaseAtState("risk-case-304", CaseState.Classified));
    liqRepo.store.set(
      "liq-case-304",
      createLiquidationCaseAtState("liq-case-304", "risk-case-304", LiquidationCaseState.InProgress)
    );
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry,
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });

    const result = await commandHandler.handleTransitionLiquidationCase({
      traceId: "trace-persistence-write-failed",
      liquidationCaseId: "liq-case-304",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "write failure",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.operation).toBe("coordinate");
      expect(result.error.code).toBe("TQ-APP-004");
    }
    expect(metrics.records.some((item) => item.scope === "persistence" && item.persistenceWriteFailed)).toBe(true);
  });

  it("falls back to registry when persistence misses but registry has current view", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const riskRepo = new FakeRiskCaseRepository();
    const liqRepo = new FakeLiquidationCaseRepository();
    riskRepo.store.set("risk-case-305", createRiskCaseAtState("risk-case-305", CaseState.Classified));
    liqRepo.store.set(
      "liq-case-305",
      createLiquidationCaseAtState("liq-case-305", "risk-case-305", LiquidationCaseState.InProgress)
    );
    const commandHandler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository(),
      coordinationResultRegistry: registry
    });
    const transition = await commandHandler.handleTransitionLiquidationCase({
      traceId: "trace-fallback-registry",
      liquidationCaseId: "liq-case-305",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "registry fallback",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(transition.success).toBe(true);

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-305",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-305"
    });

    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.view.decision).toBe("applied");
      expect(queried.observation.registryFallbackUsed).toBe(true);
    }
  });

  it("prefers persisted record when persistence and registry both exist", async () => {
    const registry = new CoordinationResultRegistry();
    const store = new FakeCoordinationResultStore();
    const readView = {
      riskCaseId: "risk-case-306",
      subcaseType: "ADLCase" as const,
      subcaseId: "adl-case-306",
      signalCategory: "normal" as const,
      decision: "applied" as const,
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-306",
        caseType: "RiskCase" as const,
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "persisted preferred",
        relatedCaseType: "ADLCase" as const,
        relatedCaseId: "adl-case-306",
        context: {
          arbitration_decision: "applied",
          signal_category: "normal"
        },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command" as const
    };
    registry.record({
      ...readView,
      sourceCommandPath: "subcase_transition_auto_coordination"
    });
    await store.put(mapCoordinationResultViewToStoredRecord(readView));

    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationResultStore: store
    });
    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-306",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-306"
    });

    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.view.sourceCommandPath).toBe("explicit_coordination_command");
    }
  });

  it("returns structured error when persisted schema version is missing", async () => {
    const store = new FakeCoordinationResultStore();
    await store.put({
      ...(mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-307",
        subcaseType: "LiquidationCase",
        subcaseId: "liq-case-307",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Classified",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-307",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "schema missing",
          relatedCaseType: "LiquidationCase",
          relatedCaseId: "liq-case-307",
          context: {
            arbitration_decision: "applied",
            signal_category: "normal"
          },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "subcase_transition_auto_coordination"
      }) as unknown as { schemaVersion: string }),
      schemaVersion: ""
    } as StoredRiskCaseCoordinationResult);
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: store
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-307",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-307"
    });
    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-007");
    }
  });

  it("returns structured error when replay validation finds audit-summary conflict", async () => {
    const store = new FakeCoordinationResultStore();
    const metrics = new FakeCoordinationMetricsSink();
    await store.put(
      mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-308",
        subcaseType: "LiquidationCase",
        subcaseId: "liq-case-308",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Classified",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-308",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "conflict",
          relatedCaseType: "LiquidationCase",
          relatedCaseId: "liq-case-308",
          context: {
            arbitration_decision: "rejected",
            signal_category: "normal"
          },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      })
    );
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: store,
      coordinationMetricsSink: metrics
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-308",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-308"
    });
    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-002");
      expect(queried.observation.validationFailed).toBe(true);
      expect(queried.metricsSink.status).toBe("succeeded");
    }
  });

  it("returns structured error when persisted schema version is unknown", async () => {
    const store = new FakeCoordinationResultStore();
    await store.put({
      ...mapCoordinationResultViewToStoredRecord({
        riskCaseId: "risk-case-310",
        subcaseType: "ADLCase",
        subcaseId: "adl-case-310",
        signalCategory: "normal",
        decision: "applied",
        resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
        beforeState: "Settling",
        afterState: "Closed",
        conflictDetected: false,
        hasOtherActiveSubcases: false,
        selectedPriority: 2,
        auditRecordSummary: {
          auditId: "audit-310",
          caseType: "RiskCase",
          action: "CoordinateRiskCaseAfterSubcaseTerminal",
          reason: "schema unknown",
          relatedCaseType: "ADLCase",
          relatedCaseId: "adl-case-310",
          context: {
            arbitration_decision: "applied",
            signal_category: "normal"
          },
          occurredAt: "2026-03-25T00:00:02.000Z"
        },
        occurredAt: "2026-03-25T00:00:02.000Z",
        sourceCommandPath: "explicit_coordination_command"
      }),
      schemaVersion: "2.0.0"
    });
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: store
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-310",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-310"
    });
    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-008");
    }
  });

  it("returns structured error when persistence read fails", async () => {
    const store = new FakeCoordinationResultStore();
    store.failRead = true;
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: new CoordinationResultRegistry(),
      coordinationResultStore: store
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-309",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-309"
    });
    expect(queried.success).toBe(false);
    if (!queried.success) {
      expect(queried.error.code).toBe("TQ-APP-004");
    }
  });

  it("does not override query result when metrics sink fails", async () => {
    const registry = new CoordinationResultRegistry();
    const metrics = new FakeCoordinationMetricsSink();
    metrics.fail = true;
    registry.record({
      riskCaseId: "risk-case-312",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-312",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-312",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "sink failed",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-case-312",
        context: {
          arbitration_decision: "applied",
          signal_category: "normal"
        },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });
    const queryHandler = new CoordinationResultQueryHandler({
      coordinationResultRegistry: registry,
      coordinationMetricsSink: metrics
    });

    const queried = await queryHandler.handle({
      riskCaseId: "risk-case-312",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-312"
    });

    expect(queried.success).toBe(true);
    if (queried.success) {
      expect(queried.metricsSink.status).toBe("failed");
      expect(queried.observation.registryFallbackUsed).toBe(true);
    }
  });
});
