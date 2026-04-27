// Phase 9 / Step 10 — liquidation-saga 集成测试（裁决 7：集成 ≤4）。
//
// 4 个集成 it 用真实 Saga 基础设施 + minimal mock 5 业务 Engine：
//   1. 完整业务流程持久化（PersistedSagaState 含全部 5 step + completed
//      终态）
//   2. 死信入队全程审计事件序列（验证 compensate 失败 → dead-letter +
//      audit）
//   3. 多 case 隔离（同时跑 2 个 case，PersistedSagaState 与 audit 事
//      件按 sagaId 独立）
//   4. SagaManualIntervention 衔接（死信入队后 Step 9 接口可处理 LiquidationSaga
//      产生的死信——Sprint G + Sprint H 模板协同证据）

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";
import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";

import type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort,
  CalculateMarginResponse,
  CancelOrderResponse,
  ClosePositionResponse,
  AdjustPositionResponse,
  OpenPositionResponse,
  QueryFundBalanceResponse,
  QueryFundLedgerResponse,
  QueryFundingRateResponse,
  QueryMarginBalanceResponse,
  QueryMarkPriceBatchResponse,
  QueryMarkPriceResponse,
  QueryOrderResponse,
  QueryPositionResponse,
  QueryTradesResponse,
  QueryTransferStatusResponse,
  ListActiveOrdersResponse,
  ListOpenPositionsResponse,
  LockMarginRequest,
  LockMarginResponse,
  ReleaseMarginResponse,
  PlaceOrderResponse,
  TransferFundResponse,
  FundEnginePort,
  FundEnginePortError,
  MarginEnginePort,
  MarginEnginePortError,
  MarkPriceEnginePort,
  MarkPriceEnginePortError,
  MatchEnginePort,
  MatchEnginePortError,
  PositionEnginePort,
  PositionEnginePortError
} from "@tianqi/ports";
import {
  createFundAccountId,
  createFundAmount,
  createFundCurrency,
  createMarginAccountId,
  createMarginAmount,
  createMarginCurrency,
  createMarginLockId,
  createMarkPriceValue,
  createMatchAccountId,
  createOrderId,
  createPositionAccountId,
  createPositionId,
  createPositionSize,
  createTransferId
} from "@tianqi/ports";

import { createLiquidationSaga, type LiquidationInput } from "./liquidation-saga.js";
import { createSagaManualIntervention } from "./saga-manual-intervention.js";

// ============================================================
// Minimal mock 5 Engines（默认成功；可注入失败模式）
// ============================================================

const buildMockMarkPrice = (failOnQuery = false): MarkPriceEnginePort => ({
  async queryMarkPrice(_req) {
    if (failOnQuery) {
      return err({
        code: "TQ-INF-013",
        message: "mark price unreachable",
        context: {}
      } as MarkPriceEnginePortError);
    }
    return ok({
      symbol: "BTC-USDT",
      markPrice: createMarkPriceValue(50_000),
      queriedAt: new Date().toISOString()
    } satisfies QueryMarkPriceResponse);
  },
  async queryMarkPriceBatch(_req) {
    return ok({ prices: [], queriedAt: new Date().toISOString() } satisfies QueryMarkPriceBatchResponse);
  },
  async queryFundingRate(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryFundingRateResponse, MarkPriceEnginePortError>;
  }
});

const buildMockPosition = (): PositionEnginePort => ({
  async queryPosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<QueryPositionResponse, PositionEnginePortError>;
  },
  async openPosition(req) {
    return ok({
      positionId: createPositionId("pos-reopened"),
      accountId: req.accountId,
      symbol: req.symbol,
      side: req.side,
      size: req.size,
      openedAt: new Date().toISOString()
    } satisfies OpenPositionResponse);
  },
  async adjustPosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<AdjustPositionResponse, PositionEnginePortError>;
  },
  async closePosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<ClosePositionResponse, PositionEnginePortError>;
  },
  async listOpenPositions(req) {
    return ok({
      accountId: req.accountId,
      positions: [
        {
          positionId: createPositionId("pos-001"),
          symbol: "BTC-USDT",
          side: "long",
          size: createPositionSize(0.5)
        }
      ],
      queriedAt: new Date().toISOString()
    } satisfies ListOpenPositionsResponse);
  }
});

const buildMockMatch = (): MatchEnginePort & { cancelledOrderIds: string[] } => {
  const cancelledOrderIds: string[] = [];
  return {
    cancelledOrderIds,
    async placeOrder(_req) {
      return ok({
        orderId: createOrderId("ord-001"),
        status: "filled",
        placedAt: new Date().toISOString()
      } satisfies PlaceOrderResponse);
    },
    async cancelOrder(req) {
      cancelledOrderIds.push(req.orderId as unknown as string);
      return ok({
        orderId: req.orderId,
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      } satisfies CancelOrderResponse);
    },
    async queryOrder(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MatchEnginePortError) as unknown as Result<QueryOrderResponse, MatchEnginePortError>;
    },
    async listActiveOrders(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MatchEnginePortError) as unknown as Result<ListActiveOrdersResponse, MatchEnginePortError>;
    },
    async queryTrades(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MatchEnginePortError) as unknown as Result<QueryTradesResponse, MatchEnginePortError>;
    }
  };
};

const buildMockMargin = (failOnRelease = false, failOnLock = false): MarginEnginePort & { relocked: LockMarginRequest[] } => {
  const relocked: LockMarginRequest[] = [];
  return {
    relocked,
    async calculateMargin(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<CalculateMarginResponse, MarginEnginePortError>;
    },
    async lockMargin(req) {
      relocked.push(req);
      if (failOnLock) {
        return err({ code: "TQ-INF-014", message: "margin lock retries exhausted", context: {} } as MarginEnginePortError);
      }
      return ok({
        lockId: createMarginLockId("lock-relocked"),
        lockedAmount: req.amount,
        currency: req.currency,
        lockedAt: new Date().toISOString()
      } satisfies LockMarginResponse);
    },
    async releaseMargin(req) {
      if (failOnRelease) {
        return err({ code: "TQ-INF-013", message: "margin engine unreachable", context: {} } as MarginEnginePortError);
      }
      return ok({
        lockId: req.lockId,
        releasedAmount: createMarginAmount(1_000),
        releasedAt: new Date().toISOString()
      } satisfies ReleaseMarginResponse);
    },
    async queryMarginBalance(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<QueryMarginBalanceResponse, MarginEnginePortError>;
    }
  };
};

const buildMockFund = (failOnFirstTransfer = false): FundEnginePort & { transferCount: number } => {
  let transferCount = 0;
  const engine: FundEnginePort & { transferCount: number } = {
    transferCount: 0,
    async queryFundBalance(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundBalanceResponse, FundEnginePortError>;
    },
    async queryFundLedger(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundLedgerResponse, FundEnginePortError>;
    },
    async transferFund(_req) {
      transferCount += 1;
      engine.transferCount = transferCount;
      if (failOnFirstTransfer && transferCount === 1) {
        return err({ code: "TQ-INF-013", message: "fund engine unreachable", context: {} } as FundEnginePortError);
      }
      return ok({
        transferId: createTransferId("trans-" + transferCount),
        status: "completed",
        transferredAt: new Date().toISOString()
      } satisfies TransferFundResponse);
    },
    async queryTransferStatus(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryTransferStatusResponse, FundEnginePortError>;
    }
  };
  return engine;
};

const createInMemoryAuditSink = (): AuditEventSinkPort & { events: AuditEventRecord[] } => {
  const events: AuditEventRecord[] = [];
  return {
    events,
    async append(event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>> {
      events.push(event);
      return ok(undefined);
    }
  };
};

const buildInput = (caseSuffix: string): LiquidationInput => ({
  caseId: "case-" + caseSuffix,
  marginAccountId: createMarginAccountId("acct-margin-" + caseSuffix),
  positionAccountId: createPositionAccountId("acct-pos-" + caseSuffix),
  matchAccountId: createMatchAccountId("acct-match-" + caseSuffix),
  fundSourceAccountId: createFundAccountId("acct-fund-src-" + caseSuffix),
  symbol: "BTC-USDT",
  marginCurrency: createMarginCurrency("USDT"),
  fundCurrency: createFundCurrency("USDT"),
  marginLockId: createMarginLockId("lock-" + caseSuffix),
  fundDestinationAccountId: createFundAccountId("acct-fund-dest-" + caseSuffix),
  fundAmount: createFundAmount(1_000),
  closeOrderSide: "sell",
  closeOrderQuantity: 0.5,
  triggerReason: "margin_below_maintenance"
});

// ============================================================
// Tests
// ============================================================

describe("liquidation-saga: integration tests", () => {
  it("test_full_business_flow_persists_5_steps_completed", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createLiquidationSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match: buildMockMatch(),
      margin: buildMockMargin(),
      fund: buildMockFund()
    });

    const result = await saga.runForCase(buildInput("happy"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      expect(result.value.stepStatuses.length).toBe(5);
    }

    // PersistedSagaState 真实 adapter 状态最终为 completed
    const incomplete = await sagaStateStore.listIncomplete();
    expect(incomplete.ok).toBe(true);
    if (incomplete.ok) {
      // listIncomplete 不返回终态 saga；completed 不在列表
      expect(incomplete.value.length).toBe(0);
    }

    // 5 个 saga.step.execute.outcome (succeeded) audit 事件
    const stepOutcomes = auditSink.events.filter(
      e => e.eventType === "saga.step.execute.outcome"
    );
    expect(stepOutcomes.length).toBe(5);
  });

  it("test_compensation_failure_enqueues_dead_letter_with_full_audit_chain", async () => {
    // step 5 失败 + step 4 反向 lockMargin 失败 → step 4 进入 dead_lettered
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const match = buildMockMatch();
    const margin = buildMockMargin(false, true); // lockMargin 反向失败
    const saga = createLiquidationSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match,
      margin,
      fund: buildMockFund(true) // 首次 transferFund 失败触发补偿
    });

    const result = await saga.runForCase(buildInput("comp"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
    }

    // 死信入队 1 笔（margin reverse lock 失败）
    const dlqList = await deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (dlqList.ok) {
      expect(dlqList.value.length).toBe(1);
      expect(dlqList.value[0]?.stepName).toBe("release-margin");
    }

    // audit 事件链路完整
    const eventTypes = auditSink.events.map(e => e.eventType);
    expect(eventTypes).toContain("saga.compensation.started");
    expect(eventTypes).toContain("saga.dead_letter.enqueued");
    // saga.timed_out 不触发（裁决 4 III）
    expect(eventTypes).not.toContain("saga.timed_out");

    // step 3 反向 cancelOrder 仍执行（链式继续证据）
    expect(match.cancelledOrderIds).toEqual(["ord-001"]);
  });

  it("test_two_concurrent_cases_isolated_by_sagaId_in_persistence_and_audit", async () => {
    // 多 case 隔离：同时跑 2 个 case，PersistedSagaState + audit 事件
    // 按 sagaId 独立可见
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createLiquidationSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match: buildMockMatch(),
      margin: buildMockMargin(),
      fund: buildMockFund()
    });

    const [resultA, resultB] = await Promise.all([
      saga.runForCase(buildInput("a")),
      saga.runForCase(buildInput("b"))
    ]);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.value.sagaId).not.toBe(resultB.value.sagaId);
      expect(resultA.value.status).toBe("completed");
      expect(resultB.value.status).toBe("completed");
    }

    // 双 saga audit 事件按 sagaId 独立分组
    if (resultA.ok && resultB.ok) {
      const sagaIdA = resultA.value.sagaId as unknown as string;
      const sagaIdB = resultB.value.sagaId as unknown as string;
      const aEvents = auditSink.events.filter(
        e => (e.payload as Record<string, unknown>).sagaId === sagaIdA
      );
      const bEvents = auditSink.events.filter(
        e => (e.payload as Record<string, unknown>).sagaId === sagaIdB
      );
      expect(aEvents.length).toBeGreaterThan(0);
      expect(bEvents.length).toBeGreaterThan(0);
      // 各自至少含 saga.started + saga.completed 2 个事件
      expect(aEvents.length).toBeGreaterThanOrEqual(2);
      expect(bEvents.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("test_sprint_g_h_template_synergy_dead_letter_processed_by_manual_intervention", async () => {
    // Sprint G + Sprint H 模板协同证据：LiquidationSaga 产生死信 → Step 9
    // SagaManualIntervention 处理死信 → entry 状态 processed + 双重审计事件
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createLiquidationSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match: buildMockMatch(),
      margin: buildMockMargin(false, true),
      fund: buildMockFund(true)
    });

    const sagaResult = await saga.runForCase(buildInput("synergy"));
    expect(sagaResult.ok).toBe(true);

    // Sprint H 产生的死信
    const dlqList = await deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (!dlqList.ok || dlqList.value.length === 0) return;
    const entryId = dlqList.value[0]!.entryId;

    // Sprint G Step 9 SagaManualIntervention 处理同一死信
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const interventionResult = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "manual margin re-lock confirmed via downstream API"
    });
    expect(interventionResult.ok).toBe(true);

    // entry 状态 processed
    const finalEntry = await deadLetterStore.load(entryId);
    if (finalEntry.ok && finalEntry.value !== null) {
      expect(finalEntry.value.status).toBe("processed");
      expect(finalEntry.value.processedBy).toBe("ops-bob");
    }

    // Sprint G 双重审计事件触发（REQUESTED + APPLIED）
    const interventionEvents = auditSink.events.filter(
      e =>
        e.eventType === "saga.manual_intervention.requested" ||
        e.eventType === "saga.manual_intervention.applied"
    );
    expect(interventionEvents.length).toBe(2);
  });
});
