// Phase 9 / Step 13 — state-transition-saga 集成测试（裁决 6：集成 ≤4）。
//
// 4 个集成 it 用真实 Saga 基础设施 + minimal mock 5 业务 Engine：
//   1. 完整业务流程持久化（PersistedSagaState 4 step + 多前置校验 Engine
//      实际消费）
//   2. 状态机非法转换 → step 1 失败 + audit 事件链路完整
//   3. 多 case 隔离（同时跑 2 个 StateTransition case）
//   4. SagaManualIntervention 衔接（Sprint G + H 模板协同；与 Step 10-12 同
//      模式）

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
  createMarginAccountId,
  createMarginAmount,
  createMarginCurrency,
  createPositionAccountId,
  createPositionSize
} from "@tianqi/ports";

import {
  createStateTransitionSaga,
  type PreconditionCheck,
  type StateTransitionInput
} from "./state-transition-saga.js";
import { createSagaManualIntervention } from "./saga-manual-intervention.js";

// ============================================================
// Minimal mock 5 Engines（接受冗余作为 Sprint H 模板纪律代价；裁决 2 R5）
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

const buildMockPosition = (size = 0, posId: string | null = null, failOnQuery = false): PositionEnginePort => ({
  async queryPosition(req) {
    if (failOnQuery) {
      return err({
        code: "TQ-INF-013",
        message: "position engine unreachable",
        context: {}
      } as PositionEnginePortError);
    }
    return ok({
      accountId: req.accountId,
      symbol: req.symbol,
      positionId: posId === null ? null : (posId as unknown as ReturnType<typeof import("@tianqi/ports").createPositionId>),
      side: size === 0 ? null : "long",
      size: createPositionSize(size),
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

const buildMockMargin = (lockedMargin = 0): MarginEnginePort => ({
  async calculateMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<CalculateMarginResponse, MarginEnginePortError>;
  },
  async lockMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<LockMarginResponse, MarginEnginePortError>;
  },
  async releaseMargin(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<ReleaseMarginResponse, MarginEnginePortError>;
  },
  async queryMarginBalance(req) {
    return ok({
      accountId: req.accountId,
      currency: req.currency,
      availableMargin: createMarginAmount(10_000),
      lockedMargin: createMarginAmount(lockedMargin),
      totalMargin: createMarginAmount(10_000 + lockedMargin),
      queriedAt: new Date().toISOString()
    } satisfies QueryMarginBalanceResponse);
  }
});

const buildMockFund = (availableBalance = 5_000): FundEnginePort => ({
  async queryFundBalance(req) {
    return ok({
      accountId: req.accountId,
      currency: req.currency,
      totalBalance: createFundAmount(availableBalance),
      availableBalance: createFundAmount(availableBalance),
      frozenBalance: createFundAmount(0),
      queriedAt: new Date().toISOString()
    } satisfies QueryFundBalanceResponse);
  },
  async queryFundLedger(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundLedgerResponse, FundEnginePortError>;
  },
  async transferFund(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<TransferFundResponse, FundEnginePortError>;
  },
  async queryTransferStatus(_req) {
    return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryTransferStatusResponse, FundEnginePortError>;
  }
});

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

const buildInput = (
  caseSuffix: string,
  currentExpectedState = "Settling",
  targetAction = "Close",
  preconditionChecks?: ReadonlyArray<PreconditionCheck>
): StateTransitionInput => ({
  caseId: "case-st-" + caseSuffix,
  targetAction,
  currentExpectedState,
  reason: "settled_state_transition",
  actor: "ops-system",
  configVersion: "v1.0",
  ...(preconditionChecks !== undefined && { preconditionChecks })
});

// ============================================================
// Tests
// ============================================================

describe("state-transition-saga: integration tests", () => {
  it("test_full_business_flow_with_3_precondition_checks_persists_4_steps", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createStateTransitionSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMockPosition(0, null), // 已平仓
      match: buildMinimalMatch(),
      margin: buildMockMargin(0), // 保证金已释放
      fund: buildMockFund(5_000) // 资金已结算
    });

    const checks: ReadonlyArray<PreconditionCheck> = [
      {
        kind: "position-closed",
        accountId: createPositionAccountId("acct-pos"),
        symbol: "BTC-USDT"
      },
      {
        kind: "margin-released",
        accountId: createMarginAccountId("acct-margin"),
        currency: createMarginCurrency("USDT")
      },
      {
        kind: "fund-settled",
        accountId: createFundAccountId("acct-fund"),
        currency: createFundCurrency("USDT"),
        expectedMinimumAvailableBalance: 0
      }
    ];
    const result = await saga.runForCase(buildInput("happy", "Settling", "Close", checks));
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

    // 4 saga.step.execute.outcome (succeeded) audit 事件
    const stepOutcomes = auditSink.events.filter(
      e => e.eventType === "saga.step.execute.outcome"
    );
    expect(stepOutcomes.length).toBe(4);
  });

  it("test_illegal_state_transition_fails_at_step_1_with_full_audit_chain", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createStateTransitionSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMockPosition(),
      match: buildMinimalMatch(),
      margin: buildMockMargin(),
      fund: buildMockFund()
    });

    // Detected → Close 非法（应当 StartValidation）
    const result = await saga.runForCase(buildInput("illegal", "Detected", "Close"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[0]?.failureReason).toContain("transition_rule_not_found");
    }

    // audit 事件链路完整
    const eventTypes = auditSink.events.map(e => e.eventType);
    expect(eventTypes).toContain("saga.started");
    expect(eventTypes).toContain("saga.step.execute.outcome");
    expect(eventTypes).toContain("saga.completed");
  });

  it("test_two_concurrent_state_transitions_isolated_by_sagaId", async () => {
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const saga = createStateTransitionSaga({
      sagaStateStore,
      deadLetterStore,
      auditEventSink: auditSink,
      markPrice: buildMinimalMarkPrice(),
      position: buildMockPosition(),
      match: buildMinimalMatch(),
      margin: buildMockMargin(),
      fund: buildMockFund()
    });
    const [resultA, resultB] = await Promise.all([
      saga.runForCase(buildInput("a", "Detected", "StartValidation")),
      saga.runForCase(buildInput("b", "Validating", "Classify"))
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

  it("test_sprint_g_h_template_synergy_state_transition_dead_letter_processed_by_manual_intervention", async () => {
    // Sprint G + Sprint H 模板协同（与 Step 10-12 集成测试同模式）：
    // 通过制造一个会导致 dead_lettered 的场景验证 SagaManualIntervention 衔接
    // 因为 state-transition-saga 实际很难产生 dead_lettered（只有 step 内部
    // 业务校验失败 / engine 失败，没有需要反向的写操作；所以此 it 直接验证
    // SagaManualIntervention 接口可用性，使用一个 mock 死信记录
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();

    // 手动注入一个 mock 死信记录验证 Sprint G+H 模板协同性
    // （模拟 state-transition saga 在某种边界场景产生死信）
    const { createDeadLetterId, createSagaId, createCorrelationId } = await import("@tianqi/ports");
    const { createTraceId } = await import("@tianqi/shared");
    const entryId = createDeadLetterId("dlq-st-synergy-001");
    await deadLetterStore.enqueue({
      entryId,
      sagaId: createSagaId("saga-st-synergy"),
      stepName: "persist-new-state",
      status: "pending",
      enqueuedAt: new Date().toISOString(),
      attemptCount: 1,
      compensationContext: { kind: "revert-to-previous-state", previousState: "Detected" },
      failureChain: ["state_persistence_failed"],
      correlationId: createCorrelationId("corr-st-synergy"),
      traceId: createTraceId("trace-st-synergy"),
      lastAttemptAt: new Date().toISOString(),
      processedAt: null,
      processedBy: null,
      processingNotes: null
    });

    // Sprint G Step 9 SagaManualIntervention 通用接口处理 StateTransition 死信
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const interventionResult = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "manual state revert confirmed"
    });
    expect(interventionResult.ok).toBe(true);

    // 双重审计事件触发（与 Step 10-12 集成测试同模式）
    const interventionEvents = auditSink.events.filter(
      e =>
        e.eventType === "saga.manual_intervention.requested" ||
        e.eventType === "saga.manual_intervention.applied"
    );
    expect(interventionEvents.length).toBe(2);
  });
});
