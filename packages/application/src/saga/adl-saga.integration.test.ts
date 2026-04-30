// Phase 9 / Step 11 — adl-saga 集成测试（裁决 7：集成 ≤4）。
//
// 4 个集成 it 用真实 Saga 基础设施 + minimal mock 5 业务 Engine：
//   1. 完整业务流程持久化（PersistedSagaState 5 step + 多账户循环）
//   2. 多账户死信入队（多账户 compensate 失败时单 step 入死信而非每账户
//      一笔——多账户复杂度封装在 step 内部对编排器透明）
//   3. 多 case 隔离（同时跑 2 个 ADL case，PersistedSagaState 与 audit 事
//      件按 sagaId 独立）
//   4. SagaManualIntervention 衔接（Sprint G + H 模板协同；多账户死信
//      由 Step 9 通用接口处理）

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";
import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";

import type {
  AuditEventRecord,
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
  createMarkPriceValue,
  createMatchAccountId,
  createOrderId,
  createPositionAccountId,
  createPositionId,
  createPositionSize,
  createTransferId
} from "@tianqi/ports";

import { createADLSaga, type ADLInput, type DeleveragingTarget } from "./adl-saga.js";
import { createSagaManualIntervention } from "./saga-manual-intervention.js";

// ============================================================
// Minimal mock 5 Engines
// ============================================================

const buildMockMarkPrice = (): MarkPriceEnginePort => ({
  async queryMarkPrice(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryMarkPriceResponse, MarkPriceEnginePortError>;
  },
  async queryMarkPriceBatch(req) {
    return ok({
      prices: req.symbols.map(symbol => ({
        symbol,
        markPrice: createMarkPriceValue(50_000)
      })),
      queriedAt: new Date().toISOString()
    } satisfies QueryMarkPriceBatchResponse);
  },
  async queryFundingRate(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryFundingRateResponse, MarkPriceEnginePortError>;
  }
});

const buildMockPosition = (): PositionEnginePort => ({
  async queryPosition(req) {
    return ok({
      accountId: req.accountId,
      symbol: req.symbol,
      positionId: createPositionId("pos-verified"),
      side: "long",
      size: createPositionSize(0.5),
      queriedAt: new Date().toISOString()
    } satisfies QueryPositionResponse);
  },
  async openPosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<OpenPositionResponse, PositionEnginePortError>;
  },
  async adjustPosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<AdjustPositionResponse, PositionEnginePortError>;
  },
  async closePosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<ClosePositionResponse, PositionEnginePortError>;
  },
  async listOpenPositions(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<ListOpenPositionsResponse, PositionEnginePortError>;
  }
});

const buildMockMatch = (cancelFailIndex?: number): MatchEnginePort & {
  placeCount: number;
  cancelCount: number;
} => {
  const engine: MatchEnginePort & { placeCount: number; cancelCount: number } = {
    placeCount: 0,
    cancelCount: 0,
    async placeOrder(_req) {
      const idx = engine.placeCount;
      engine.placeCount += 1;
      return ok({
        orderId: createOrderId("ord-adl-int-" + idx),
        status: "filled",
        placedAt: new Date().toISOString()
      } satisfies PlaceOrderResponse);
    },
    async cancelOrder(req) {
      const idx = engine.cancelCount;
      engine.cancelCount += 1;
      if (cancelFailIndex !== undefined && idx === cancelFailIndex) {
        return err({
          code: "TQ-INF-013",
          message: "match unreachable on cancel",
          context: {}
        } as MatchEnginePortError);
      }
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
  return engine;
};

const buildMockMargin = (): MarginEnginePort => ({
  async calculateMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<CalculateMarginResponse, MarginEnginePortError>;
  },
  async lockMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<LockMarginResponse, MarginEnginePortError>;
  },
  async releaseMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<ReleaseMarginResponse, MarginEnginePortError>;
  },
  async queryMarginBalance(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<QueryMarginBalanceResponse, MarginEnginePortError>;
  }
});

const buildMockFund = (failOnTransferIndex?: number): FundEnginePort & {
  transferCount: number;
} => {
  const engine: FundEnginePort & { transferCount: number } = {
    transferCount: 0,
    async queryFundBalance(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundBalanceResponse, FundEnginePortError>;
    },
    async queryFundLedger(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundLedgerResponse, FundEnginePortError>;
    },
    async transferFund(_req) {
      const idx = engine.transferCount;
      engine.transferCount += 1;
      if (failOnTransferIndex !== undefined && idx === failOnTransferIndex) {
        return err({
          code: "TQ-INF-013",
          message: "fund engine unreachable",
          context: {}
        } as FundEnginePortError);
      }
      return ok({
        transferId: createTransferId("trans-adl-int-" + idx),
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
    async append(event) {
      events.push(event);
      return ok(undefined);
    }
  };
};

// ============================================================
// Helpers
// ============================================================

const buildTarget = (suffix: string): DeleveragingTarget => ({
  accountId: createPositionAccountId("acct-pos-" + suffix),
  fundAccountId: createFundAccountId("acct-fund-" + suffix),
  matchAccountId: createMatchAccountId("acct-match-" + suffix),
  positionId: createPositionId("pos-" + suffix),
  symbol: "BTC-USDT",
  deleveragingSide: "sell",
  deleveragingQuantity: createPositionSize(0.3),
  expectedDeleveragingPrice: createMarkPriceValue(50_000),
  accountSettleAmount: createFundAmount(500)
});

const buildInput = (
  caseSuffix: string,
  targets: ReadonlyArray<DeleveragingTarget>
): ADLInput => ({
  caseId: "case-adl-" + caseSuffix,
  insuranceFundAccountId: createFundAccountId("insurance-fund"),
  lossAbsorptionTargetAccountId: createFundAccountId("loss-absorber-" + caseSuffix),
  systemLossAmount: createFundAmount(1_000),
  systemLossCurrency: createFundCurrency("USDT"),
  fundCurrency: createFundCurrency("USDT"),
  symbols: ["BTC-USDT"],
  targets,
  deleveragingStrategy: "by-profit-rate",
  triggerReason: "system_loss_triggered_adl"
});

// ============================================================
// Tests
// ============================================================

describe("adl-saga: integration tests (real memory adapter + multi-account)", () => {
  it("test_full_business_flow_with_multi_account_loops_persists_5_steps", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const match = buildMockMatch();
    const fund = buildMockFund();
    const saga = createADLSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match,
      margin: buildMockMargin(),
      fund
    });
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("happy", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      expect(result.value.stepStatuses.length).toBe(5);
    }

    // 真实 adapter 状态可见性
    const incomplete = await sagaStateStore.listIncomplete();
    expect(incomplete.ok).toBe(true);
    if (incomplete.ok) {
      expect(incomplete.value.length).toBe(0);
    }

    // 多账户循环证据：3 placeOrder + 4 transferFund（1 insurance + 3 settle）
    expect(match.placeCount).toBe(3);
    expect(fund.transferCount).toBe(4);

    // 5 saga.step.execute.outcome (succeeded) audit 事件
    const stepOutcomes = auditSink.events.filter(
      e => e.eventType === "saga.step.execute.outcome"
    );
    expect(stepOutcomes.length).toBe(5);
  });

  it("test_multi_account_compensation_dead_letters_at_step_level_not_per_account", async () => {
    // 多账户复杂度封装在 step 内部对编排器透明：cancelOrder 在反向第二
    // 个账户失败时，整个 step 进入 dead_lettered（**1 笔死信**而非每账户
    // 一笔）—— 多账户复杂度对编排器透明性证据
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const match = buildMockMatch(1); // 反向 cancelOrder 第二次失败
    const fund = buildMockFund(0); // step 4 insurance 失败触发补偿
    const saga = createADLSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match,
      margin: buildMockMargin(),
      fund
    });
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("multi-comp", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
    }

    // 死信入队 1 笔（step 3 反向失败一次记 1 笔；多账户对编排器透明）
    const dlqList = await deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (dlqList.ok) {
      expect(dlqList.value.length).toBe(1);
      expect(dlqList.value[0]?.stepName).toBe("submit-deleveraging-orders");
    }

    // audit 事件链路完整
    const eventTypes = auditSink.events.map(e => e.eventType);
    expect(eventTypes).toContain("saga.compensation.started");
    expect(eventTypes).toContain("saga.dead_letter.enqueued");
  });

  it("test_two_concurrent_adl_cases_isolated_by_sagaId", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createADLSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match: buildMockMatch(),
      margin: buildMockMargin(),
      fund: buildMockFund()
    });
    const targetsA = [buildTarget("a1"), buildTarget("a2")];
    const targetsB = [buildTarget("b1"), buildTarget("b2"), buildTarget("b3")];
    const [resultA, resultB] = await Promise.all([
      saga.runForCase(buildInput("a", targetsA)),
      saga.runForCase(buildInput("b", targetsB))
    ]);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.value.sagaId).not.toBe(resultB.value.sagaId);
      expect(resultA.value.status).toBe("completed");
      expect(resultB.value.status).toBe("completed");
      const sagaIdA = resultA.value.sagaId as unknown as string;
      const sagaIdB = resultB.value.sagaId as unknown as string;
      const aEvents = auditSink.events.filter(
        e => (e.payload as Record<string, unknown>).sagaId === sagaIdA
      );
      const bEvents = auditSink.events.filter(
        e => (e.payload as Record<string, unknown>).sagaId === sagaIdB
      );
      expect(aEvents.length).toBeGreaterThanOrEqual(2);
      expect(bEvents.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("test_sprint_g_h_template_synergy_adl_dead_letter_processed_by_manual_intervention", async () => {
    // Sprint G + Sprint H 模板协同（与 Step 10 集成测试 it 4 同模式）：
    // ADL Saga 多账户 compensate 失败产生死信 → SagaManualIntervention 处理
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createADLSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMockMarkPrice(),
      position: buildMockPosition(),
      match: buildMockMatch(0), // 反向首个 cancelOrder 失败
      margin: buildMockMargin(),
      fund: buildMockFund(0) // step 4 失败触发补偿
    });
    const targets = [buildTarget("syn-1"), buildTarget("syn-2")];
    const sagaResult = await saga.runForCase(buildInput("synergy", targets));
    expect(sagaResult.ok).toBe(true);

    // ADL 产生的死信
    const dlqList = await deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (!dlqList.ok || dlqList.value.length === 0) return;
    const entryId = dlqList.value[0]!.entryId;

    // Sprint G Step 9 SagaManualIntervention 通用接口处理 ADL 死信
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const interventionResult = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "manual ADL multi-account cancel re-confirmed"
    });
    expect(interventionResult.ok).toBe(true);

    // 双重审计事件触发（与 Step 10 集成 it 4 同模式）
    const interventionEvents = auditSink.events.filter(
      e =>
        e.eventType === "saga.manual_intervention.requested" ||
        e.eventType === "saga.manual_intervention.applied"
    );
    expect(interventionEvents.length).toBe(2);
  });
});
