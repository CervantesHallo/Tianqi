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
  TransitionAction,
  resolveStageForState
} from "@tianqi/domain";
import type {
  ADLCaseRepositoryPort,
  LiquidationCaseRepositoryPort,
  RiskCaseRepositoryPort
} from "@tianqi/ports";
import {
  createADLCaseId,
  createConfigVersion,
  createIdempotencyKey,
  createLiquidationCaseId,
  createRiskCaseId,
  createTraceId,
  ok
} from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { CoreCaseFlowCommandHandler } from "./core-case-flow-command-handler.js";
import { RiskCaseResolutionAction } from "./risk-case-resolution-action.js";

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

  public async save(liquidationCase: LiquidationCase) {
    this.store.set(liquidationCase.id, liquidationCase);
    return ok(undefined);
  }

  public async listBySourceRiskCaseId(sourceRiskCaseId: ReturnType<typeof createRiskCaseId>) {
    const items = [...this.store.values()].filter(
      (liquidationCase) => liquidationCase.sourceRiskCaseId === sourceRiskCaseId
    );
    return ok(items);
  }
}

class FakeADLCaseRepository implements ADLCaseRepositoryPort {
  public readonly store = new Map<string, ADLCase>();

  public async getById(caseId: ReturnType<typeof createADLCaseId>) {
    return ok(this.store.get(caseId) ?? null);
  }

  public async save(adlCase: ADLCase) {
    this.store.set(adlCase.id, adlCase);
    return ok(undefined);
  }

  public async listBySourceRiskCaseId(sourceRiskCaseId: ReturnType<typeof createRiskCaseId>) {
    const items = [...this.store.values()].filter((adlCase) => adlCase.sourceRiskCaseId === sourceRiskCaseId);
    return ok(items);
  }
}

const createSeedRiskCase = (caseId: string): RiskCase => {
  const created = RiskCase.create({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    configVersion: createConfigVersion(1),
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    traceId: createTraceId(`trace-${caseId}-create`)
  });
  if (!created.ok) {
    throw new Error("failed to create seed risk case");
  }
  return created.value.riskCase;
};

const createSeedRiskCaseAtState = (caseId: string, state: CaseState): RiskCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const rehydrated = RiskCase.rehydrate({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    state,
    stage: resolveStageForState(state),
    configVersion: createConfigVersion(1),
    createdAt,
    updatedAt: createdAt
  });
  if (!rehydrated.ok) {
    throw new Error("failed to create seed risk case at state");
  }
  return rehydrated.value;
};

const createSeedRiskCaseAtStateWithUpdatedAt = (
  caseId: string,
  state: CaseState,
  updatedAtIso: string
): RiskCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const updatedAt = new Date(updatedAtIso);
  const rehydrated = RiskCase.rehydrate({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    state,
    stage: resolveStageForState(state),
    configVersion: createConfigVersion(1),
    createdAt,
    updatedAt
  });
  if (!rehydrated.ok) {
    throw new Error("failed to create seed risk case at state with custom updatedAt");
  }
  return rehydrated.value;
};

const createSeedLiquidationCaseAtState = (
  caseId: string,
  sourceRiskCaseId: string,
  state: LiquidationCaseState
): LiquidationCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const rehydrated = LiquidationCase.rehydrate({
    id: createLiquidationCaseId(caseId),
    sourceRiskCaseId: createRiskCaseId(sourceRiskCaseId),
    traceId: createTraceId(`trace-${caseId}-seed`),
    configVersion: createConfigVersion(1),
    state,
    createdAt,
    updatedAt: new Date("2026-03-25T00:00:01.000Z")
  });
  if (!rehydrated.ok) {
    throw new Error("failed to create seed liquidation case at state");
  }
  return rehydrated.value;
};

const createSeedAdlCaseAtState = (caseId: string, sourceRiskCaseId: string, state: ADLCaseState): ADLCase => {
  const createdAt = new Date("2026-03-25T00:00:00.000Z");
  const rehydrated = ADLCase.rehydrate({
    id: createADLCaseId(caseId),
    sourceRiskCaseId: createRiskCaseId(sourceRiskCaseId),
    traceId: createTraceId(`trace-${caseId}-seed`),
    configVersion: createConfigVersion(1),
    state,
    createdAt,
    updatedAt: new Date("2026-03-25T00:00:01.000Z")
  });
  if (!rehydrated.ok) {
    throw new Error("failed to create seed adl case at state");
  }
  return rehydrated.value;
};

describe("CoreCaseFlowCommandHandler", () => {
  it("RiskCase legal transition succeeds and returns audit record", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-001", createSeedRiskCase("risk-case-001"));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionRiskCase({
      traceId: "trace-risk-transition",
      idempotencyKey: createIdempotencyKey("idem-risk-transition"),
      caseId: "risk-case-001",
      action: TransitionAction.StartValidation,
      reason: "start minimal review",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.caseView.caseType).toBe("RiskCase");
      expect(result.transition?.beforeState).toBe("Detected");
      expect(result.transition?.afterState).toBe("Validating");
      expect(result.linkage.riskCaseId).toBe("risk-case-001");
      expect(result.auditRecords[0]?.caseType).toBe("RiskCase");
      expect(result.auditRecords[0]?.beforeState).toBe("Detected");
      expect(result.auditRecords[0]?.afterState).toBe("Validating");
    }
  });

  it("RiskCase illegal transition fails with structured error", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-002", createSeedRiskCase("risk-case-002"));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionRiskCase({
      traceId: "trace-risk-illegal",
      idempotencyKey: createIdempotencyKey("idem-risk-illegal"),
      caseId: "risk-case-002",
      action: TransitionAction.Close,
      reason: "invalid direct close",
      triggeredBy: "manual",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-DOM-002");
      expect(result.operation).toBe("transition");
    }
  });

  it("creates LiquidationCase from classified RiskCase with linkage audit", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-001", createSeedRiskCaseAtState("risk-case-source-001", CaseState.Classified));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateLiquidationCaseFromRiskCase({
      traceId: "trace-liq-create",
      liquidationCaseId: "liq-case-001",
      riskCaseId: "risk-case-source-001",
      reason: "derive liquidation from classified risk",
      triggeredBy: "manual",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.caseView.caseType).toBe("LiquidationCase");
      expect(result.caseView.state).toBe("Initiated");
      expect(result.linkage.riskCaseId).toBe("risk-case-source-001");
      expect(result.linkage.derivedCaseId).toBe("liq-case-001");
      expect(result.auditRecords).toHaveLength(2);
      expect(result.auditRecords[0]?.relatedCaseId).toBe("risk-case-source-001");
      expect(result.auditRecords[1]?.caseType).toBe("RiskCase");
    }
  });

  it("rejects creating LiquidationCase when source RiskCase is missing", async () => {
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(),
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateLiquidationCaseFromRiskCase({
      traceId: "trace-liq-create-missing-risk",
      liquidationCaseId: "liq-case-missing-risk",
      riskCaseId: "risk-case-not-found",
      reason: "should fail",
      triggeredBy: "system",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-003");
    }
  });

  it("rejects creating ADLCase when source RiskCase state is not allowed", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-101", createSeedRiskCaseAtState("risk-case-source-101", CaseState.Detected));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateADLCaseFromRiskCase({
      traceId: "trace-adl-create-state-blocked",
      adlCaseId: "adl-case-001",
      riskCaseId: "risk-case-source-101",
      reason: "should fail due to risk state",
      triggeredBy: "manual",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-002");
      expect(result.error.reason).toContain("does not allow deriving");
    }
  });

  it("rejects creating LiquidationCase when source RiskCase is already closed", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-closed", createSeedRiskCaseAtState("risk-case-source-closed", CaseState.Closed));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateLiquidationCaseFromRiskCase({
      traceId: "trace-liq-create-closed-risk",
      liquidationCaseId: "liq-case-closed-risk",
      riskCaseId: "risk-case-source-closed",
      reason: "closed risk case should not derive",
      triggeredBy: "manual",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-002");
    }
  });

  it("legacy create command still enforces source RiskCase consistency", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-legacy", createSeedRiskCaseAtState("risk-case-source-legacy", CaseState.Closed));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateADLCase({
      traceId: "trace-legacy-adl-create",
      adlCaseId: "adl-case-legacy-closed",
      sourceRiskCaseId: "risk-case-source-legacy",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-002");
    }
  });

  it("LiquidationCase legal transition succeeds and returns linkage audit record", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-002", createSeedRiskCaseAtState("risk-case-source-002", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    const created = LiquidationCase.create({
      id: createLiquidationCaseId("liq-case-002"),
      sourceRiskCaseId: createRiskCaseId("risk-case-source-002"),
      traceId: createTraceId("trace-liq-seed"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    if (!created.ok) {
      throw new Error("failed to seed liquidation case");
    }
    liqRepo.store.set("liq-case-002", created.value);

    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionLiquidationCase({
      traceId: "trace-liq-transition",
      liquidationCaseId: "liq-case-002",
      action: LiquidationCaseTransitionAction.StartProgress,
      reason: "begin liquidation execution",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.beforeState).toBe("Initiated");
      expect(result.transition?.afterState).toBe("InProgress");
      expect(result.linkage.riskCaseId).toBe("risk-case-source-002");
      expect(result.auditRecords[0]?.caseType).toBe("LiquidationCase");
      expect(result.auditRecords[0]?.relatedCaseId).toBe("risk-case-source-002");
    }
  });

  it("rejects LiquidationCase transition when parent RiskCase is closed", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-003", createSeedRiskCaseAtState("risk-case-source-003", CaseState.Closed));
    const liqRepo = new FakeLiquidationCaseRepository();
    const created = LiquidationCase.create({
      id: createLiquidationCaseId("liq-case-003"),
      sourceRiskCaseId: createRiskCaseId("risk-case-source-003"),
      traceId: createTraceId("trace-liq-illegal-seed"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    if (!created.ok) {
      throw new Error("failed to seed liquidation case");
    }
    liqRepo.store.set("liq-case-003", created.value);

    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionLiquidationCase({
      traceId: "trace-liq-illegal",
      liquidationCaseId: "liq-case-003",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "cannot complete directly",
      triggeredBy: "manual",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-002");
      expect(result.error.reason).toContain("inconsistent");
    }
  });

  it("creates ADLCase from classified RiskCase with linkage audit", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-102", createSeedRiskCaseAtState("risk-case-source-102", CaseState.Classified));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCreateADLCaseFromRiskCase({
      traceId: "trace-adl-create",
      adlCaseId: "adl-case-001",
      riskCaseId: "risk-case-source-102",
      reason: "derive adl from classified risk",
      triggeredBy: "manual",
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.caseView.caseType).toBe("ADLCase");
      expect(result.caseView.state).toBe("Initiated");
      expect(result.linkage.riskCaseId).toBe("risk-case-source-102");
      expect(result.auditRecords[0]?.relatedCaseType).toBe("RiskCase");
    }
  });

  it("ADLCase legal transition succeeds and returns linkage audit record", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-103", createSeedRiskCaseAtState("risk-case-source-103", CaseState.Classified));
    const adlRepo = new FakeADLCaseRepository();
    const created = ADLCase.create({
      id: createADLCaseId("adl-case-002"),
      sourceRiskCaseId: createRiskCaseId("risk-case-source-103"),
      traceId: createTraceId("trace-adl-seed"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    if (!created.ok) {
      throw new Error("failed to seed adl case");
    }
    adlRepo.store.set("adl-case-002", created.value);

    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleTransitionADLCase({
      traceId: "trace-adl-transition",
      adlCaseId: "adl-case-002",
      action: ADLCaseTransitionAction.Queue,
      reason: "queue for adl",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.beforeState).toBe("Initiated");
      expect(result.transition?.afterState).toBe("Queued");
      expect(result.auditRecords[0]?.caseType).toBe("ADLCase");
      expect(result.auditRecords[0]?.relatedCaseId).toBe("risk-case-source-103");
    }
  });

  it("ADLCase illegal transition fails with domain error", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-104", createSeedRiskCaseAtState("risk-case-source-104", CaseState.Classified));
    const adlRepo = new FakeADLCaseRepository();
    const created = ADLCase.create({
      id: createADLCaseId("adl-case-003"),
      sourceRiskCaseId: createRiskCaseId("risk-case-source-104"),
      traceId: createTraceId("trace-adl-illegal-seed"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    if (!created.ok) {
      throw new Error("failed to seed adl case");
    }
    adlRepo.store.set("adl-case-003", created.value);

    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleTransitionADLCase({
      traceId: "trace-adl-illegal",
      adlCaseId: "adl-case-003",
      action: ADLCaseTransitionAction.Execute,
      reason: "cannot execute directly",
      triggeredBy: "manual",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-DOM-002");
    }
  });

  it("LiquidationCase -> Completed triggers minimal RiskCase resolution action", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-200", createSeedRiskCaseAtState("risk-case-source-200", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-200",
      createSeedLiquidationCaseAtState("liq-case-200", "risk-case-source-200", LiquidationCaseState.InProgress)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionLiquidationCase({
      traceId: "trace-liq-completed-coordinate",
      liquidationCaseId: "liq-case-200",
      action: LiquidationCaseTransitionAction.Complete,
      reason: "liquidation completed, coordinate risk case",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.afterState).toBe("Completed");
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseResolvedAfterSubcaseCompletion
      );
      expect(result.resolution?.signalCategory).toBe("normal");
      expect(result.resolution?.decision).toBe("applied");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(true);
      expect(result.resolution?.afterState).toBe("Closed");
      expect(result.auditRecords).toHaveLength(2);
      expect(result.auditRecords[1]?.caseType).toBe("RiskCase");
      expect(result.auditRecords[1]?.relatedCaseType).toBe("LiquidationCase");
    }
  });

  it("LiquidationCase -> Failed triggers RiskCase manual intervention coordination", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-201", createSeedRiskCaseAtState("risk-case-source-201", CaseState.Liquidating));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-201",
      createSeedLiquidationCaseAtState("liq-case-201", "risk-case-source-201", LiquidationCaseState.Initiated)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleTransitionLiquidationCase({
      traceId: "trace-liq-failed-coordinate",
      liquidationCaseId: "liq-case-201",
      action: LiquidationCaseTransitionAction.Fail,
      reason: "liquidation failed and requires manual intervention",
      triggeredBy: "manual",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.afterState).toBe("Failed");
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure
      );
      expect(result.resolution?.afterState).toBe("ManualInterventionRequired");
      expect(result.auditRecords[1]?.relatedCaseId).toBe("liq-case-201");
    }
  });

  it("ADLCase -> Executed triggers minimal RiskCase resolution action", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-202", createSeedRiskCaseAtState("risk-case-source-202", CaseState.Settling));
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set("adl-case-202", createSeedAdlCaseAtState("adl-case-202", "risk-case-source-202", ADLCaseState.Queued));
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleTransitionADLCase({
      traceId: "trace-adl-executed-coordinate",
      adlCaseId: "adl-case-202",
      action: ADLCaseTransitionAction.Execute,
      reason: "adl executed and coordinate risk closure",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.afterState).toBe("Executed");
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseResolvedAfterSubcaseCompletion
      );
      expect(result.resolution?.afterState).toBe("Closed");
      expect(result.auditRecords[1]?.relatedCaseType).toBe("ADLCase");
    }
  });

  it("ADLCase -> Failed triggers RiskCase manual intervention coordination", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-203", createSeedRiskCaseAtState("risk-case-source-203", CaseState.EvaluatingADL));
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-203",
      createSeedAdlCaseAtState("adl-case-203", "risk-case-source-203", ADLCaseState.Initiated)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleTransitionADLCase({
      traceId: "trace-adl-failed-coordinate",
      adlCaseId: "adl-case-203",
      action: ADLCaseTransitionAction.Fail,
      reason: "adl failed and requires manual intervention",
      triggeredBy: "manual",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition?.afterState).toBe("Failed");
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure
      );
      expect(result.resolution?.afterState).toBe("ManualInterventionRequired");
    }
  });

  it("rejects coordination when subcase is not terminal", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-204", createSeedRiskCaseAtState("risk-case-source-204", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-204",
      createSeedLiquidationCaseAtState("liq-case-204", "risk-case-source-204", LiquidationCaseState.InProgress)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-non-terminal",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-204",
      reason: "should reject non-terminal coordination",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.operation).toBe("coordinate");
      expect(result.error.code).toBe("TQ-APP-002");
      expect(result.error.reason).toContain("terminal");
    }
  });

  it("rejects coordination when source RiskCase is missing", async () => {
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-205",
      createSeedLiquidationCaseAtState("liq-case-205", "risk-case-source-missing", LiquidationCaseState.Completed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(),
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-missing-risk",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-205",
      reason: "source risk case should exist",
      triggeredBy: "system",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-003");
    }
  });

  it("degrades to under-review when completion signal cannot directly close current RiskCase state", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-206", createSeedRiskCaseAtState("risk-case-source-206", CaseState.Detected));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-206",
      createSeedLiquidationCaseAtState("liq-case-206", "risk-case-source-206", LiquidationCaseState.Completed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-risk-state-conflict",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-206",
      reason: "detected state should not accept completion coordination",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseUnderReviewAfterSubcaseCompletion
      );
      expect(result.resolution?.decision).toBe("deferred");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(false);
      expect(result.resolution?.beforeState).toBe("Detected");
      expect(result.resolution?.afterState).toBe("Detected");
    }
  });

  it("rejects repeated lower-priority completion signal when RiskCase is already closed", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-207", createSeedRiskCaseAtState("risk-case-source-207", CaseState.Closed));
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-207",
      createSeedAdlCaseAtState("adl-case-207", "risk-case-source-207", ADLCaseState.Executed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-repeat",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-207",
      reason: "already coordinated",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.decision).toBe("duplicate");
      expect(result.resolution?.arbitrationRule).toContain("deduplicated");
      expect(result.resolution?.selectedPriority).toBe(2);
      expect(result.resolution?.afterState).toBe("Closed");
    }
  });

  it("keeps RiskCase under-review when other active subcase exists", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-208", createSeedRiskCaseAtState("risk-case-source-208", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-208-trigger",
      createSeedLiquidationCaseAtState("liq-case-208-trigger", "risk-case-source-208", LiquidationCaseState.Completed)
    );
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-208-active",
      createSeedAdlCaseAtState("adl-case-208-active", "risk-case-source-208", ADLCaseState.Queued)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-active-sibling",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-208-trigger",
      reason: "active sibling should block close",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.decision).toBe("deferred");
      expect(result.resolution?.hasOtherActiveSubcases).toBe(true);
      expect(result.resolution?.arbitrationRule).toBe("active_subcase_blocks_direct_close");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(false);
      expect(result.auditRecords[0]?.context?.other_active_subcase_exists).toBe("true");
    }
  });

  it("selects conservative manual-intervention action when terminal signals conflict", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-209", createSeedRiskCaseAtState("risk-case-source-209", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-209-success",
      createSeedLiquidationCaseAtState("liq-case-209-success", "risk-case-source-209", LiquidationCaseState.Completed)
    );
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-209-failed",
      createSeedAdlCaseAtState("adl-case-209-failed", "risk-case-source-209", ADLCaseState.Failed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-conflict-priority",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-209-success",
      reason: "conflicting terminal signals should prefer manual intervention",
      triggeredBy: "system",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.action).toBe(
        RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure
      );
      expect(result.resolution?.decision).toBe("applied");
      expect(result.resolution?.conflictDetected).toBe(true);
      expect(result.resolution?.selectedPriority).toBe(3);
      expect(result.resolution?.afterState).toBe("ManualInterventionRequired");
      expect(result.auditRecords[0]?.context?.conflict_detected).toBe("true");
    }
  });

  it("allows close when multiple terminal-success signals exist without conflict", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-210", createSeedRiskCaseAtState("risk-case-source-210", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-210-success",
      createSeedLiquidationCaseAtState("liq-case-210-success", "risk-case-source-210", LiquidationCaseState.Completed)
    );
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-210-success",
      createSeedAdlCaseAtState("adl-case-210-success", "risk-case-source-210", ADLCaseState.Executed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-multi-success",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-210-success",
      reason: "all terminal-success signals should allow close",
      triggeredBy: "system",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:02.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.decision).toBe("applied");
      expect(result.resolution?.hasOtherSubcases).toBe(true);
      expect(result.resolution?.conflictDetected).toBe(false);
      expect(result.resolution?.afterState).toBe("Closed");
      expect(result.resolution?.arbitrationRule).toBe("all_subcases_terminal_success_and_close_allowed");
    }
  });

  it("deduplicates replayed equivalent terminal signal", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set(
      "risk-case-source-211",
      createSeedRiskCaseAtStateWithUpdatedAt("risk-case-source-211", CaseState.Closed, "2026-03-25T00:00:01.000Z")
    );
    const adlRepo = new FakeADLCaseRepository();
    adlRepo.store.set(
      "adl-case-211",
      createSeedAdlCaseAtState("adl-case-211", "risk-case-source-211", ADLCaseState.Executed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-duplicate-replay",
      subcaseType: "ADLCase",
      subcaseId: "adl-case-211",
      reason: "same terminal fact replayed",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.signalCategory).toBe("duplicate");
      expect(result.resolution?.decision).toBe("duplicate");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(false);
      expect(result.auditRecords[0]?.context?.signal_category).toBe("duplicate");
    }
  });

  it("ignores late lower-priority terminal signal", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set(
      "risk-case-source-212",
      createSeedRiskCaseAtStateWithUpdatedAt("risk-case-source-212", CaseState.Closed, "2026-03-25T00:00:05.000Z")
    );
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-212",
      createSeedLiquidationCaseAtState("liq-case-212", "risk-case-source-212", LiquidationCaseState.Completed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-late-ignored",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-212",
      reason: "late low priority signal",
      triggeredBy: "system",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.signalCategory).toBe("late");
      expect(result.resolution?.decision).toBe("ignored");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(false);
      expect(result.resolution?.arbitrationRule).toBe("late_lower_priority_signal_ignored");
    }
  });

  it("allows late higher-priority conservative escalation signal", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set(
      "risk-case-source-213",
      createSeedRiskCaseAtStateWithUpdatedAt("risk-case-source-213", CaseState.Liquidating, "2026-03-25T00:00:05.000Z")
    );
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-213",
      createSeedLiquidationCaseAtState("liq-case-213", "risk-case-source-213", LiquidationCaseState.Failed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-late-escalation",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-213",
      reason: "late but conservative escalation",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.signalCategory).toBe("late");
      expect(result.resolution?.decision).toBe("applied");
      expect(result.resolution?.afterState).toBe("ManualInterventionRequired");
      expect(result.resolution?.arbitrationRule).toBe(
        "late_higher_priority_conservative_escalation_allowed"
      );
    }
  });

  it("rejects replayed completion signal when replay boundary disallows state override", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-214", createSeedRiskCaseAtState("risk-case-source-214", CaseState.Classified));
    const liqRepo = new FakeLiquidationCaseRepository();
    liqRepo.store.set(
      "liq-case-214",
      createSeedLiquidationCaseAtState("liq-case-214", "risk-case-source-214", LiquidationCaseState.Completed)
    );
    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: liqRepo,
      adlCaseRepository: new FakeADLCaseRepository()
    });

    const result = await handler.handleCoordinateRiskCaseAfterSubcaseTerminal({
      traceId: "trace-coordinate-replay-rejected",
      subcaseType: "LiquidationCase",
      subcaseId: "liq-case-214",
      reason: "replay completion should be stable",
      triggeredBy: "manual",
      configVersion: 1,
      coordinatedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.resolution?.signalCategory).toBe("replayed");
      expect(result.resolution?.decision).toBe("rejected");
      expect(result.resolution?.riskCaseTransitionApplied).toBe(false);
      expect(result.auditRecords[0]?.context?.signal_category).toBe("replayed");
      expect(result.auditRecords[0]?.context?.arbitration_decision).toBe("rejected");
    }
  });

  it("does not expose mutable Date objects in linkage result models", async () => {
    const riskRepo = new FakeRiskCaseRepository();
    riskRepo.store.set("risk-case-source-105", createSeedRiskCaseAtState("risk-case-source-105", CaseState.Classified));
    const adlRepo = new FakeADLCaseRepository();
    const created = ADLCase.create({
      id: createADLCaseId("adl-case-004"),
      sourceRiskCaseId: createRiskCaseId("risk-case-source-105"),
      traceId: createTraceId("trace-adl-shape-seed"),
      configVersion: createConfigVersion(1),
      createdAt: new Date("2026-03-25T00:00:00.000Z")
    });
    if (!created.ok) {
      throw new Error("failed to seed adl case");
    }
    adlRepo.store.set("adl-case-004", created.value);

    const handler = new CoreCaseFlowCommandHandler({
      riskCaseRepository: riskRepo,
      liquidationCaseRepository: new FakeLiquidationCaseRepository(),
      adlCaseRepository: adlRepo
    });

    const result = await handler.handleTransitionADLCase({
      traceId: "trace-adl-shape",
      adlCaseId: "adl-case-004",
      action: ADLCaseTransitionAction.Queue,
      reason: "shape check",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.caseView.createdAt).toBe("string");
      expect(result.caseView.createdAt).not.toBeInstanceOf(Date);
      expect(typeof result.auditRecords[0]?.occurredAt).toBe("string");
      expect(result.auditRecords[0]?.occurredAt).not.toBeInstanceOf(Date);
      expect(result.linkage.consistencyChecks[0]?.passed).toBe(true);
    }
  });
});
