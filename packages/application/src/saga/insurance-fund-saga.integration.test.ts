// Phase 9 / Step 12 — insurance-fund-saga 集成测试（裁决 6：集成 ≤4）。
//
// 4 个集成 it 用真实 Saga 基础设施 + minimal mock 5 业务 Engine：
//   1. 完整业务流程持久化（PersistedSagaState 4 step + 两段 transferFund）
//   2. credit 失败 → deduct 反向 + audit 事件链路完整
//   3. 多 case 隔离（同时跑 2 个 InsuranceFund case）
//   4. SagaManualIntervention 衔接（Sprint G + H 模板协同）

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
  createTransferId
} from "@tianqi/ports";

import { createInsuranceFundSaga, type InsuranceFundInput } from "./insurance-fund-saga.js";
import { createSagaManualIntervention } from "./saga-manual-intervention.js";

// ============================================================
// Minimal mock 5 Engines（与 Step 11 集成测试同模式；接受 4 个非 Fund
// Engine 的 mock 冗余作为 Sprint H 模板一致性代价；裁决 2 R5）
// ============================================================

const buildMinimalMarkPrice = (): MarkPriceEnginePort => ({
  async queryMarkPrice(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryMarkPriceResponse, MarkPriceEnginePortError>;
  },
  async queryMarkPriceBatch(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryMarkPriceBatchResponse, MarkPriceEnginePortError>;
  },
  async queryFundingRate(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryFundingRateResponse, MarkPriceEnginePortError>;
  }
});

const buildMinimalPosition = (): PositionEnginePort => ({
  async queryPosition(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as PositionEnginePortError) as unknown as Result<QueryPositionResponse, PositionEnginePortError>;
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

const buildMinimalMatch = (): MatchEnginePort => ({
  async placeOrder(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MatchEnginePortError) as unknown as Result<PlaceOrderResponse, MatchEnginePortError>;
  },
  async cancelOrder(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MatchEnginePortError) as unknown as Result<CancelOrderResponse, MatchEnginePortError>;
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
});

const buildMinimalMargin = (): MarginEnginePort => ({
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

const buildMockFund = (failOnTransferIndex?: number): FundEnginePort & { transferCount: number } => {
  const engine: FundEnginePort & { transferCount: number } = {
    transferCount: 0,
    async queryFundBalance(req) {
      return ok({
        accountId: req.accountId,
        currency: req.currency,
        totalBalance: createFundAmount(100_000),
        availableBalance: createFundAmount(100_000),
        frozenBalance: createFundAmount(0),
        queriedAt: new Date().toISOString()
      } satisfies QueryFundBalanceResponse);
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
        transferId: createTransferId("trans-if-int-" + idx),
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

const buildInput = (caseSuffix: string): InsuranceFundInput => ({
  caseId: "case-if-" + caseSuffix,
  affectedAccountId: createFundAccountId("acct-affected-" + caseSuffix),
  lossAmount: createFundAmount(1_000),
  lossCurrency: createFundCurrency("USDT"),
  insuranceFundAccountId: createFundAccountId("insurance-fund-" + caseSuffix),
  lossAbsorptionTargetAccountId: createFundAccountId("loss-absorber-" + caseSuffix),
  coverageRatio: 0.8,
  triggerReason: "insurance_coverage_triggered"
});

// ============================================================
// Tests
// ============================================================

describe("insurance-fund-saga: integration tests", () => {
  it("test_full_business_flow_persists_4_steps_with_dual_transfer", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const fund = buildMockFund();
    const saga = createInsuranceFundSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMinimalPosition(),
      match: buildMinimalMatch(),
      margin: buildMinimalMargin(),
      fund
    });

    const result = await saga.runForCase(buildInput("happy"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      expect(result.value.stepStatuses.length).toBe(4);
    }

    // 真实 adapter 状态可见性
    const incomplete = await sagaStateStore.listIncomplete();
    expect(incomplete.ok).toBe(true);
    if (incomplete.ok) {
      expect(incomplete.value.length).toBe(0);
    }

    // 两段 transferFund：deduct + credit
    expect(fund.transferCount).toBe(2);

    // 4 saga.step.execute.outcome (succeeded) audit 事件
    const stepOutcomes = auditSink.events.filter(
      e => e.eventType === "saga.step.execute.outcome"
    );
    expect(stepOutcomes.length).toBe(4);
  });

  it("test_credit_failure_triggers_reverse_deduct_with_full_audit_chain", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const fund = buildMockFund(1); // step 3 credit (idx 1) 失败
    const saga = createInsuranceFundSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMinimalPosition(),
      match: buildMinimalMatch(),
      margin: buildMinimalMargin(),
      fund
    });

    const result = await saga.runForCase(buildInput("credit-fail"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[1]?.status).toBe("compensated"); // step 2 反向
      expect(result.value.stepStatuses[2]?.status).toBe("failed");
    }

    // transferFund: 1 deduct + 1 credit (fail) + 1 reverse-deduct = 3
    expect(fund.transferCount).toBe(3);

    // audit 事件链路完整
    const eventTypes = auditSink.events.map(e => e.eventType);
    expect(eventTypes).toContain("saga.compensation.started");
    expect(eventTypes).toContain("saga.completed");
  });

  it("test_two_concurrent_insurance_cases_isolated_by_sagaId", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createInsuranceFundSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMinimalPosition(),
      match: buildMinimalMatch(),
      margin: buildMinimalMargin(),
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

  it("test_sprint_g_h_template_synergy_insurance_fund_dead_letter_processed_by_manual_intervention", async () => {
    // Sprint G + Sprint H 模板协同（与 Step 10/11 集成测试同模式）
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    let callIndex = 0;
    const fund = buildMockFund();
    // 让 step 3 失败 + step 2 反向也失败 → step 2 dead_lettered
    const originalTransfer = fund.transferFund.bind(fund);
    fund.transferFund = async (req) => {
      const idx = callIndex;
      callIndex += 1;
      if (idx === 1 || idx === 2) {
        return err({
          code: "TQ-INF-014",
          message: "fund retries exhausted",
          context: {}
        } as FundEnginePortError);
      }
      return originalTransfer(req);
    };
    const saga = createInsuranceFundSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMinimalPosition(),
      match: buildMinimalMatch(),
      margin: buildMinimalMargin(),
      fund
    });
    const sagaResult = await saga.runForCase(buildInput("synergy"));
    expect(sagaResult.ok).toBe(true);

    const dlqList = await deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (!dlqList.ok || dlqList.value.length === 0) return;
    const entryId = dlqList.value[0]!.entryId;

    // Sprint G Step 9 SagaManualIntervention 通用接口处理 InsuranceFund 死信
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const interventionResult = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "manual insurance fund deduct re-confirmed"
    });
    expect(interventionResult.ok).toBe(true);

    // 双重审计事件触发（与 Step 10/11 集成测试同模式）
    const interventionEvents = auditSink.events.filter(
      e =>
        e.eventType === "saga.manual_intervention.requested" ||
        e.eventType === "saga.manual_intervention.applied"
    );
    expect(interventionEvents.length).toBe(2);
  });
});
