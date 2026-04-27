// Phase 9 / Step 10 — liquidation-saga 单元测试（裁决 7：unit ≤8）。
//
// 8 个 unit it 覆盖：工厂签名 / happy path 5 step 全部执行 / fetch-mark-price
// 失败 vacuous / submit-close-orders 失败触发 cancelOrder 反向补偿 /
// release-margin 失败触发反向 lockMargin / settle-fund-transfer 失败触发
// 反向 transferFund / 多 step 失败链式继续 / Engine 错误转译为 SagaPortError。
//
// Mock 策略：5 业务 Engine 全部 mock（可控制每个 Engine 调用的 ok/err 返回）；
// Saga 基础设施用真实 in-memory adapter（dead-letter-store-memory +
// saga-state-store-memory + 简单 in-memory AuditSink）以便观察 audit 事件
// 与死信入队。

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";
import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";

import type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort,
  CalculateMarginRequest,
  CalculateMarginResponse,
  CancelOrderRequest,
  CancelOrderResponse,
  ClosePositionRequest,
  ClosePositionResponse,
  AdjustPositionRequest,
  AdjustPositionResponse,
  OpenPositionRequest,
  OpenPositionResponse,
  QueryFundBalanceRequest,
  QueryFundBalanceResponse,
  QueryFundLedgerRequest,
  QueryFundLedgerResponse,
  QueryFundingRateRequest,
  QueryFundingRateResponse,
  QueryMarginBalanceRequest,
  QueryMarginBalanceResponse,
  QueryMarkPriceBatchRequest,
  QueryMarkPriceBatchResponse,
  QueryMarkPriceRequest,
  QueryMarkPriceResponse,
  QueryOrderRequest,
  QueryOrderResponse,
  QueryPositionRequest,
  QueryPositionResponse,
  QueryTradesRequest,
  QueryTradesResponse,
  QueryTransferStatusRequest,
  QueryTransferStatusResponse,
  ListActiveOrdersRequest,
  ListActiveOrdersResponse,
  ListOpenPositionsRequest,
  ListOpenPositionsResponse,
  LockMarginRequest,
  LockMarginResponse,
  ReleaseMarginRequest,
  ReleaseMarginResponse,
  PlaceOrderRequest,
  PlaceOrderResponse,
  TransferFundRequest,
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

// ============================================================
// Engine Mock 工厂（每个 Engine 默认成功响应；可注入 failure 控制行为）
// ============================================================

type MockMarkPrice = MarkPriceEnginePort & {
  failureMode: { method: "queryMarkPrice"; error: MarkPriceEnginePortError } | null;
  callLog: string[];
};

const createMockMarkPriceEngine = (): MockMarkPrice => {
  const callLog: string[] = [];
  const engine: MockMarkPrice = {
    failureMode: null,
    callLog,
    async queryMarkPrice(_req: QueryMarkPriceRequest) {
      callLog.push("queryMarkPrice");
      if (engine.failureMode?.method === "queryMarkPrice") {
        return err(engine.failureMode.error);
      }
      return ok({
        symbol: "BTC-USDT",
        markPrice: createMarkPriceValue(50_000),
        queriedAt: new Date().toISOString()
      } satisfies QueryMarkPriceResponse);
    },
    async queryMarkPriceBatch(_req: QueryMarkPriceBatchRequest) {
      return ok({ prices: [], queriedAt: new Date().toISOString() } satisfies QueryMarkPriceBatchResponse);
    },
    async queryFundingRate(_req: QueryFundingRateRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used in unit tests",
        context: {}
      } as MarkPriceEnginePortError) as unknown as Result<QueryFundingRateResponse, MarkPriceEnginePortError>;
    }
  };
  return engine;
};

type MockPosition = PositionEnginePort & {
  failureMode: {
    method: "listOpenPositions" | "openPosition";
    error: PositionEnginePortError;
  } | null;
  callLog: string[];
  positionsResponse: ListOpenPositionsResponse;
  reopenedPositions: OpenPositionRequest[];
};

const createMockPositionEngine = (): MockPosition => {
  const callLog: string[] = [];
  const reopenedPositions: OpenPositionRequest[] = [];
  const engine: MockPosition = {
    failureMode: null,
    callLog,
    reopenedPositions,
    positionsResponse: {
      accountId: createPositionAccountId("acct-pos-001"),
      positions: [
        {
          positionId: createPositionId("pos-001"),
          symbol: "BTC-USDT",
          side: "long",
          size: createPositionSize(0.5)
        }
      ],
      queriedAt: new Date().toISOString()
    },
    async queryPosition(_req: QueryPositionRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as PositionEnginePortError) as unknown as Result<QueryPositionResponse, PositionEnginePortError>;
    },
    async openPosition(req: OpenPositionRequest) {
      callLog.push("openPosition");
      reopenedPositions.push(req);
      if (engine.failureMode?.method === "openPosition") {
        return err(engine.failureMode.error);
      }
      return ok({
        positionId: createPositionId("pos-reopened-001"),
        accountId: req.accountId,
        symbol: req.symbol,
        side: req.side,
        size: req.size,
        openedAt: new Date().toISOString()
      } satisfies OpenPositionResponse);
    },
    async adjustPosition(_req: AdjustPositionRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as PositionEnginePortError) as unknown as Result<AdjustPositionResponse, PositionEnginePortError>;
    },
    async closePosition(_req: ClosePositionRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as PositionEnginePortError) as unknown as Result<ClosePositionResponse, PositionEnginePortError>;
    },
    async listOpenPositions(_req: ListOpenPositionsRequest) {
      callLog.push("listOpenPositions");
      if (engine.failureMode?.method === "listOpenPositions") {
        return err(engine.failureMode.error);
      }
      return ok(engine.positionsResponse);
    }
  };
  return engine;
};

type MockMatch = MatchEnginePort & {
  failureMode: { method: "placeOrder" | "cancelOrder"; error: MatchEnginePortError } | null;
  callLog: string[];
  cancelledOrderIds: string[];
};

const createMockMatchEngine = (): MockMatch => {
  const callLog: string[] = [];
  const cancelledOrderIds: string[] = [];
  const engine: MockMatch = {
    failureMode: null,
    callLog,
    cancelledOrderIds,
    async placeOrder(_req: PlaceOrderRequest) {
      callLog.push("placeOrder");
      if (engine.failureMode?.method === "placeOrder") {
        return err(engine.failureMode.error);
      }
      return ok({
        orderId: createOrderId("ord-001"),
        status: "filled",
        placedAt: new Date().toISOString()
      } satisfies PlaceOrderResponse);
    },
    async cancelOrder(req: CancelOrderRequest) {
      callLog.push("cancelOrder");
      cancelledOrderIds.push(req.orderId as unknown as string);
      if (engine.failureMode?.method === "cancelOrder") {
        return err(engine.failureMode.error);
      }
      return ok({
        orderId: req.orderId,
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      } satisfies CancelOrderResponse);
    },
    async queryOrder(_req: QueryOrderRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as MatchEnginePortError) as unknown as Result<QueryOrderResponse, MatchEnginePortError>;
    },
    async listActiveOrders(_req: ListActiveOrdersRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as MatchEnginePortError) as unknown as Result<ListActiveOrdersResponse, MatchEnginePortError>;
    },
    async queryTrades(_req: QueryTradesRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as MatchEnginePortError) as unknown as Result<QueryTradesResponse, MatchEnginePortError>;
    }
  };
  return engine;
};

type MockMargin = MarginEnginePort & {
  failureMode: { method: "releaseMargin" | "lockMargin"; error: MarginEnginePortError } | null;
  callLog: string[];
  relocked: LockMarginRequest[];
};

const createMockMarginEngine = (): MockMargin => {
  const callLog: string[] = [];
  const relocked: LockMarginRequest[] = [];
  const engine: MockMargin = {
    failureMode: null,
    callLog,
    relocked,
    async calculateMargin(_req: CalculateMarginRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as MarginEnginePortError) as unknown as Result<CalculateMarginResponse, MarginEnginePortError>;
    },
    async lockMargin(req: LockMarginRequest) {
      callLog.push("lockMargin");
      relocked.push(req);
      if (engine.failureMode?.method === "lockMargin") {
        return err(engine.failureMode.error);
      }
      return ok({
        lockId: createMarginLockId("lock-relock-001"),
        lockedAmount: req.amount,
        currency: req.currency,
        lockedAt: new Date().toISOString()
      } satisfies LockMarginResponse);
    },
    async releaseMargin(req: ReleaseMarginRequest) {
      callLog.push("releaseMargin");
      if (engine.failureMode?.method === "releaseMargin") {
        return err(engine.failureMode.error);
      }
      return ok({
        lockId: req.lockId,
        releasedAmount: createMarginAmount(1_000),
        releasedAt: new Date().toISOString()
      } satisfies ReleaseMarginResponse);
    },
    async queryMarginBalance(_req: QueryMarginBalanceRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as MarginEnginePortError) as unknown as Result<QueryMarginBalanceResponse, MarginEnginePortError>;
    }
  };
  return engine;
};

type MockFund = FundEnginePort & {
  failureMode: { method: "transferFund"; transferIndex: number; error: FundEnginePortError } | null;
  callLog: string[];
  transfers: TransferFundRequest[];
};

const createMockFundEngine = (): MockFund => {
  const callLog: string[] = [];
  const transfers: TransferFundRequest[] = [];
  const engine: MockFund = {
    failureMode: null,
    callLog,
    transfers,
    async queryFundBalance(_req: QueryFundBalanceRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as FundEnginePortError) as unknown as Result<QueryFundBalanceResponse, FundEnginePortError>;
    },
    async queryFundLedger(_req: QueryFundLedgerRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as FundEnginePortError) as unknown as Result<QueryFundLedgerResponse, FundEnginePortError>;
    },
    async transferFund(req: TransferFundRequest) {
      callLog.push("transferFund");
      const index = transfers.length;
      transfers.push(req);
      if (
        engine.failureMode?.method === "transferFund" &&
        engine.failureMode.transferIndex === index
      ) {
        return err(engine.failureMode.error);
      }
      return ok({
        transferId: createTransferId("trans-" + (index + 1)),
        status: "completed",
        transferredAt: new Date().toISOString()
      } satisfies TransferFundResponse);
    },
    async queryTransferStatus(_req: QueryTransferStatusRequest) {
      return err({
        code: "TQ-INF-017",
        message: "not used",
        context: {}
      } as FundEnginePortError) as unknown as Result<QueryTransferStatusResponse, FundEnginePortError>;
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

// ============================================================
// Common helpers
// ============================================================

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

type FullPorts = Parameters<typeof createLiquidationSaga>[0] & {
  markPrice: MockMarkPrice;
  position: MockPosition;
  match: MockMatch;
  margin: MockMargin;
  fund: MockFund;
};

const buildPorts = async (): Promise<FullPorts> => {
  const sagaStateStore = createInMemorySagaStateStore();
  const deadLetterStore = createInMemoryDeadLetterStore();
  await sagaStateStore.init();
  await deadLetterStore.init();
  return {
    sagaStateStore,
    deadLetterStore,
    auditEventSink: createInMemoryAuditSink(),
    markPrice: createMockMarkPriceEngine(),
    position: createMockPositionEngine(),
    match: createMockMatchEngine(),
    margin: createMockMarginEngine(),
    fund: createMockFundEngine()
  };
};

// ============================================================
// Tests
// ============================================================

describe("liquidation-saga: unit tests", () => {
  it("test_factory_returns_saga_with_runForCase_method", async () => {
    const ports = await buildPorts();
    const saga = createLiquidationSaga(ports);
    expect(typeof saga.runForCase).toBe("function");
  });

  it("test_runForCase_happy_path_executes_all_5_steps_in_order", async () => {
    // Happy path：5 business steps 严格顺序执行；每个 Engine 调用 1 次 + 0 反向
    const ports = await buildPorts();
    const saga = createLiquidationSaga(ports);

    const result = await saga.runForCase(buildInput("happy"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      // 全部 5 step 状态为 succeeded
      const stepNames = result.value.stepStatuses.map(s => s.name);
      expect(stepNames).toEqual([
        "fetch-mark-price",
        "list-open-positions",
        "submit-close-orders",
        "release-margin",
        "settle-fund-transfer"
      ]);
      result.value.stepStatuses.forEach(s => {
        expect(s.status).toBe("succeeded");
      });
    }
    // Engine 调用顺序验证（business 流程图证据）
    expect(ports.markPrice.callLog).toEqual(["queryMarkPrice"]);
    expect(ports.position.callLog).toEqual(["listOpenPositions"]);
    expect(ports.match.callLog).toEqual(["placeOrder"]); // 无反向
    expect(ports.margin.callLog).toEqual(["releaseMargin"]); // 无反向
    expect(ports.fund.callLog).toEqual(["transferFund"]); // 无反向
  });

  it("test_runForCase_with_first_step_failure_results_in_compensated_vacuous", async () => {
    // 首步 fetch-mark-price 失败 → 无 succeeded step 可补偿 → 终态 compensated vacuous
    const ports = await buildPorts();
    ports.markPrice.failureMode = {
      method: "queryMarkPrice",
      error: { code: "TQ-INF-013", message: "mark price unreachable", context: {} }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("first-fail"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous
      expect(result.value.stepStatuses[0]?.status).toBe("failed");
    }
    // 后续 step 未触发
    expect(ports.position.callLog).toEqual([]);
    expect(ports.match.callLog).toEqual([]);
  });

  it("test_runForCase_with_submit_close_orders_failure_triggers_no_compensation_for_readonly_steps", async () => {
    // submit-close-orders 失败 → 反向补偿 list-positions（noop）+ fetch-mark-price（noop）；
    // step 3 自身不补偿（《§4.3》失败 step 自身不补偿）
    const ports = await buildPorts();
    ports.match.failureMode = {
      method: "placeOrder",
      error: { code: "TQ-INF-013", message: "match engine unreachable", context: {} }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("step3-fail"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[0]?.status).toBe("compensated");
      expect(result.value.stepStatuses[1]?.status).toBe("compensated");
      expect(result.value.stepStatuses[2]?.status).toBe("failed");
      expect(result.value.stepStatuses[3]?.status).toBe("pending");
      expect(result.value.stepStatuses[4]?.status).toBe("pending");
    }
    // Step 3 自身 cancelOrder 不被调用（execute 失败时 step 自己不补偿）
    expect(ports.match.cancelledOrderIds).toEqual([]);
  });

  it("test_runForCase_with_release_margin_failure_triggers_cancel_order_compensation", async () => {
    // step 4 release-margin 失败 → 严格逆序补偿：step 3 submit-close-orders 反向 cancelOrder
    const ports = await buildPorts();
    ports.margin.failureMode = {
      method: "releaseMargin",
      error: { code: "TQ-INF-013", message: "margin engine unreachable", context: {} }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("step4-fail"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // step 3 已补偿
      expect(result.value.stepStatuses[3]?.status).toBe("failed");
      expect(result.value.stepStatuses[4]?.status).toBe("pending");
    }
    // step 3 反向 cancelOrder 被调用 1 次（不变量 1 严格逆序）
    expect(ports.match.cancelledOrderIds).toEqual(["ord-001"]);
  });

  it("test_runForCase_with_settle_fund_failure_triggers_full_reverse_chain", async () => {
    // 第 5 步 settle-fund-transfer 失败 → 严格逆序补偿：
    //   step 4 release-margin 反向 lockMargin
    //   step 3 submit-close-orders 反向 cancelOrder
    //   step 1/2 noop
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      transferIndex: 0, // 首次 transferFund 调用失败
      error: { code: "TQ-INF-013", message: "fund engine unreachable", context: {} }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("step5-fail"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[3]?.status).toBe("compensated"); // margin
      expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // match
      expect(result.value.stepStatuses[4]?.status).toBe("failed");
    }
    // 反向调用证据（不变量 1 严格逆序：margin lock → match cancel）
    expect(ports.margin.relocked.length).toBe(1);
    expect(ports.match.cancelledOrderIds).toEqual(["ord-001"]);
  });

  it("test_runForCase_with_compensation_failure_enqueues_dead_letter_partial_compensated", async () => {
    // step 5 失败 + step 4 反向 lockMargin 也失败 → step 4 进入 dead_lettered；
    // step 3 反向 cancelOrder 仍执行（链式继续）；终态 partially_compensated
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      transferIndex: 0,
      error: { code: "TQ-INF-013", message: "fund unreachable", context: {} }
    };
    ports.margin.failureMode = {
      method: "lockMargin", // 反向补偿失败
      error: { code: "TQ-INF-014", message: "margin retries exhausted", context: {} }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("comp-fail"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.stepStatuses[3]?.status).toBe("dead_lettered"); // margin 反向失败
      expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // match cancel 仍成功
    }
    // 死信入队 1 次（margin 反向失败）
    const dlqList = await ports.deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (dlqList.ok) {
      expect(dlqList.value.length).toBe(1);
      expect(dlqList.value[0]?.stepName).toBe("release-margin");
    }
  });

  it("test_engine_error_translation_to_TQ_SAG_002_with_domain_message", async () => {
    // §6.5 转译纪律延续证据：Engine error code 翻译为 SagaPortError TQ-SAG-002
    // + message moniker（不携带 raw HTTP/网络异常）；audit event 记录 failed
    const ports = await buildPorts();
    ports.position.failureMode = {
      method: "listOpenPositions",
      error: {
        code: "TQ-INF-015",
        message: "circuit breaker open for position-engine",
        context: { circuitState: "open" }
      }
    };
    const saga = createLiquidationSaga(ports);
    const result = await saga.runForCase(buildInput("translate"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // 无 succeeded 可补偿
      const failedStep = result.value.stepStatuses[1];
      expect(failedStep?.status).toBe("failed");
      // failureReason 是领域级 message，不含 raw context
      expect(failedStep?.failureReason).toContain("TQ-INF-015");
      expect(failedStep?.failureReason).toContain("list-open-positions");
    }
  });
});
