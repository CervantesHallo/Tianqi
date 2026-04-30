// Phase 9 / Step 11 — adl-saga 单元测试（裁决 7：unit ≤8）。
//
// 8 个 unit it 覆盖：工厂签名 / happy path 5 step（多账户全部成功）/
// 空 targets vacuous / verify-targets 失败（多账户循环 C-fail-fast）/
// submit-deleveraging-orders 失败 + 后续无补偿（首批已下单 step 失败时
// 自身不补偿）/ insurance-fund-deduction 失败 → 反向 cancelOrders 多账户
// / settle-account-funds 失败 → 反向 insurance + cancelOrders / 补偿过
// 程中 cancelOrder 失败 → dead_lettered + partially_compensated。
//
// Mock 策略：5 业务 Engine 全部 mock；Saga 基础设施用真实 in-memory
// adapter；与 Step 10 模板对齐。

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
  CancelOrderRequest,
  CancelOrderResponse,
  ClosePositionResponse,
  AdjustPositionResponse,
  OpenPositionResponse,
  QueryFundBalanceResponse,
  QueryFundLedgerResponse,
  QueryFundingRateResponse,
  QueryMarginBalanceResponse,
  QueryMarkPriceBatchRequest,
  QueryMarkPriceBatchResponse,
  QueryMarkPriceResponse,
  QueryOrderResponse,
  QueryPositionRequest,
  QueryPositionResponse,
  QueryTradesResponse,
  QueryTransferStatusResponse,
  ListActiveOrdersResponse,
  ListOpenPositionsResponse,
  LockMarginResponse,
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
  createMarkPriceValue,
  createMatchAccountId,
  createOrderId,
  createPositionAccountId,
  createPositionId,
  createPositionSize,
  createTransferId
} from "@tianqi/ports";

import { createADLSaga, type ADLInput, type DeleveragingTarget } from "./adl-saga.js";

// ============================================================
// Mock 5 Engine（默认全部成功；可注入 failure 控制行为）
// ============================================================

type MockMarkPrice = MarkPriceEnginePort & {
  failureMode: { method: "queryMarkPriceBatch"; error: MarkPriceEnginePortError } | null;
  callLog: string[];
};

const createMockMarkPriceEngine = (): MockMarkPrice => {
  const callLog: string[] = [];
  const engine: MockMarkPrice = {
    failureMode: null,
    callLog,
    async queryMarkPrice(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarkPriceEnginePortError) as unknown as Result<QueryMarkPriceResponse, MarkPriceEnginePortError>;
    },
    async queryMarkPriceBatch(req: QueryMarkPriceBatchRequest) {
      callLog.push("queryMarkPriceBatch");
      if (engine.failureMode?.method === "queryMarkPriceBatch") {
        return err(engine.failureMode.error);
      }
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
  };
  return engine;
};

type MockPosition = PositionEnginePort & {
  failureMode: {
    method: "queryPosition";
    failOnAccountSuffix?: string; // 失败时仅匹配特定 accountId 后缀
    error: PositionEnginePortError;
  } | null;
  callLog: string[];
};

const createMockPositionEngine = (): MockPosition => {
  const callLog: string[] = [];
  const engine: MockPosition = {
    failureMode: null,
    callLog,
    async queryPosition(req: QueryPositionRequest) {
      callLog.push("queryPosition:" + (req.accountId as unknown as string));
      const fm = engine.failureMode;
      if (fm?.method === "queryPosition") {
        const acctStr = req.accountId as unknown as string;
        if (fm.failOnAccountSuffix === undefined || acctStr.endsWith(fm.failOnAccountSuffix)) {
          return err(fm.error);
        }
      }
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
  };
  return engine;
};

type MockMatch = MatchEnginePort & {
  failureMode: {
    method: "placeOrder" | "cancelOrder";
    failOnIndex?: number;
    error: MatchEnginePortError;
  } | null;
  placeCallCount: number;
  cancelCallCount: number;
  cancelledOrderIds: string[];
};

const createMockMatchEngine = (): MockMatch => {
  const cancelledOrderIds: string[] = [];
  const engine: MockMatch = {
    failureMode: null,
    placeCallCount: 0,
    cancelCallCount: 0,
    cancelledOrderIds,
    async placeOrder(_req: PlaceOrderRequest) {
      const idx = engine.placeCallCount;
      engine.placeCallCount += 1;
      if (engine.failureMode?.method === "placeOrder") {
        if (
          engine.failureMode.failOnIndex === undefined ||
          engine.failureMode.failOnIndex === idx
        ) {
          return err(engine.failureMode.error);
        }
      }
      return ok({
        orderId: createOrderId("ord-adl-" + idx),
        status: "filled",
        placedAt: new Date().toISOString()
      } satisfies PlaceOrderResponse);
    },
    async cancelOrder(req: CancelOrderRequest) {
      const idx = engine.cancelCallCount;
      engine.cancelCallCount += 1;
      cancelledOrderIds.push(req.orderId as unknown as string);
      if (engine.failureMode?.method === "cancelOrder") {
        if (
          engine.failureMode.failOnIndex === undefined ||
          engine.failureMode.failOnIndex === idx
        ) {
          return err(engine.failureMode.error);
        }
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

type MockMargin = MarginEnginePort;

const createMockMarginEngine = (): MockMargin => ({
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

type MockFund = FundEnginePort & {
  failureMode: { method: "transferFund"; failOnIndex?: number; error: FundEnginePortError } | null;
  transferCount: number;
  transfers: TransferFundRequest[];
};

const createMockFundEngine = (): MockFund => {
  const transfers: TransferFundRequest[] = [];
  const engine: MockFund = {
    failureMode: null,
    transferCount: 0,
    transfers,
    async queryFundBalance(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundBalanceResponse, FundEnginePortError>;
    },
    async queryFundLedger(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as FundEnginePortError) as unknown as Result<QueryFundLedgerResponse, FundEnginePortError>;
    },
    async transferFund(req: TransferFundRequest) {
      const idx = engine.transferCount;
      engine.transferCount += 1;
      transfers.push(req);
      if (engine.failureMode?.method === "transferFund") {
        if (
          engine.failureMode.failOnIndex === undefined ||
          engine.failureMode.failOnIndex === idx
        ) {
          return err(engine.failureMode.error);
        }
      }
      return ok({
        transferId: createTransferId("trans-adl-" + idx),
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

// ============================================================
// Common helpers
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

const buildInput = (caseSuffix: string, targets: ReadonlyArray<DeleveragingTarget>): ADLInput => ({
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

type FullPorts = Parameters<typeof createADLSaga>[0] & {
  markPrice: MockMarkPrice;
  position: MockPosition;
  match: MockMatch;
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

describe("adl-saga: unit tests", () => {
  it("test_factory_returns_saga_with_runForCase_method", async () => {
    const ports = await buildPorts();
    const saga = createADLSaga(ports);
    expect(typeof saga.runForCase).toBe("function");
  });

  it("test_runForCase_happy_path_executes_all_5_steps_with_multi_account_loops", async () => {
    // Happy path：3 个 targets，5 step 严格顺序，多账户循环全部成功
    const ports = await buildPorts();
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("happy", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      const stepNames = result.value.stepStatuses.map(s => s.name);
      expect(stepNames).toEqual([
        "fetch-mark-prices",
        "verify-targets",
        "submit-deleveraging-orders",
        "insurance-fund-deduction",
        "settle-account-funds"
      ]);
      result.value.stepStatuses.forEach(s => {
        expect(s.status).toBe("succeeded");
      });
    }
    // 多账户循环证据：position 调用 3 次（verify-targets）；match.placeOrder
    // 调用 3 次（submit-deleveraging-orders）；fund.transferFund 调用 4
    // 次（1 insurance + 3 settle-account-funds）
    expect(ports.position.callLog.length).toBe(3);
    expect(ports.match.placeCallCount).toBe(3);
    expect(ports.fund.transferCount).toBe(4);
  });

  it("test_runForCase_with_empty_targets_completes_with_zero_loops", async () => {
    // targets 空数组 → ok 返回 + 多账户循环 0 次（裁决 5：targets 为空
    // 是合法业务输入，不是错误）
    const ports = await buildPorts();
    const saga = createADLSaga(ports);
    const result = await saga.runForCase(buildInput("empty", []));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
    }
    // 多账户循环 0 次（verify-targets / placeOrder / settle-account-funds
    // 都未调用任何账户）
    expect(ports.position.callLog.length).toBe(0);
    expect(ports.match.placeCallCount).toBe(0);
    // insurance-fund-deduction 仍执行（单笔，与 targets 无关）
    expect(ports.fund.transferCount).toBe(1);
  });

  it("test_verify_targets_fail_fast_aborts_on_first_account_failure", async () => {
    // C-fail-fast：verify-targets 第二个 target 失败 → 立即整个 step 失败
    // → 无后续 step 触发；第三 target 不被调用
    const ports = await buildPorts();
    ports.position.failureMode = {
      method: "queryPosition",
      failOnAccountSuffix: "-b",
      error: {
        code: "TQ-INF-013",
        message: "position engine unreachable",
        context: {}
      }
    };
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("verify-fail", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous（仅 step 1 succeeded）
      expect(result.value.stepStatuses[1]?.status).toBe("failed");
      // multi-account moniker 证据：failureReason 含失败账户标识（accountId
      // suffix "-b"）；message 实际形态 "verify-targets engine call failed
      // for acct-pos-b: TQ-INF-013"——buildTarget 用的是 suffix="b"，
      // accountId 实际为 "acct-pos-b"
      expect(result.value.stepStatuses[1]?.failureReason).toContain("acct-pos-b");
    }
    // 多账户循环 C-fail-fast 证据：仅 a + b 被调用（c 未被调用）
    expect(ports.position.callLog.length).toBe(2);
    expect(ports.match.placeCallCount).toBe(0); // step 3 未触发
  });

  it("test_submit_deleveraging_orders_failure_does_not_invoke_self_compensate", async () => {
    // 《§4.3》失败 step 自身不补偿——submit-deleveraging-orders 第二个
    // target placeOrder 失败 → step 自身不调 cancelOrder（虽然第一个 target
    // 已成功下单——execute 失败路径无 compensationContext 持久化，没有反
    // 向数据可用）
    const ports = await buildPorts();
    ports.match.failureMode = {
      method: "placeOrder",
      failOnIndex: 1, // 第二次调用失败
      error: {
        code: "TQ-INF-013",
        message: "match engine unreachable",
        context: {}
      }
    };
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("place-fail", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous（前序 1+2 noop）
      expect(result.value.stepStatuses[2]?.status).toBe("failed");
    }
    // step 3 自身的 cancelOrder 不被调用（failed step 不补偿）
    expect(ports.match.cancelCallCount).toBe(0);
  });

  it("test_insurance_fund_failure_triggers_reverse_cancel_orders_for_all_accounts", async () => {
    // step 4 insurance-fund-deduction 失败 → 严格逆序补偿 step 3 反向
    // cancelOrder × 3 个账户（多账户 compensate 内部循环证据）
    const ports = await buildPorts();
    // step 4 是首个 transferFund 调用（idx 0）失败
    ports.fund.failureMode = {
      method: "transferFund",
      failOnIndex: 0,
      error: {
        code: "TQ-INF-013",
        message: "fund engine unreachable",
        context: {}
      }
    };
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("insurance-fail", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // step 3 反向
      expect(result.value.stepStatuses[3]?.status).toBe("failed"); // step 4 self-failed
    }
    // step 3 反向 cancelOrder 调用 3 次（多账户 compensate 内部循环）
    expect(ports.match.cancelCallCount).toBe(3);
    expect(ports.match.cancelledOrderIds.length).toBe(3);
  });

  it("test_settle_account_funds_failure_triggers_reverse_insurance_and_orders", async () => {
    // step 5 settle-account-funds 第二 target 失败（idx 2 = insurance 1
    // + settle 第 1 个）→ 严格逆序补偿：
    //   step 4 insurance 反向 transferFund
    //   step 3 cancelOrders × 3 反向
    //   step 1/2 noop
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      failOnIndex: 2, // insurance(0) + settle-a(1) 成功；settle-b(2) 失败
      error: {
        code: "TQ-INF-013",
        message: "fund engine unreachable",
        context: {}
      }
    };
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("settle-fail", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[2]?.status).toBe("compensated"); // step 3 反向
      expect(result.value.stepStatuses[3]?.status).toBe("compensated"); // step 4 反向
      expect(result.value.stepStatuses[4]?.status).toBe("failed"); // step 5 self-failed
    }
    // step 3 反向 cancelOrder × 3 + step 4 反向 + step 5 自身 settle 部分
    // 已成功（idx 1 a 成功；idx 2 b 失败；idx 3 c 未触发）—— step 5 自
    // 身 failed 不补偿；不变量 1 严格逆序：先 step 4 再 step 3
    expect(ports.match.cancelCallCount).toBe(3);
  });

  it("test_compensation_failure_enqueues_dead_letter_partial_compensated", async () => {
    // step 4 失败触发 step 3 反向 cancelOrder；cancelOrder 第二次失败
    // → step 3 dead_lettered + saga 终态 partially_compensated
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      failOnIndex: 0,
      error: { code: "TQ-INF-013", message: "fund unreachable", context: {} }
    };
    ports.match.failureMode = {
      method: "cancelOrder",
      failOnIndex: 1, // 反向 cancelOrder 第二次失败
      error: {
        code: "TQ-INF-014",
        message: "match retries exhausted",
        context: {}
      }
    };
    const saga = createADLSaga(ports);
    const targets = [buildTarget("a"), buildTarget("b"), buildTarget("c")];
    const result = await saga.runForCase(buildInput("comp-fail", targets));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.stepStatuses[2]?.status).toBe("dead_lettered"); // step 3 反向失败
    }
    // 死信入队 1 笔（step 3 反向失败）
    const dlqList = await ports.deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (dlqList.ok) {
      expect(dlqList.value.length).toBe(1);
      expect(dlqList.value[0]?.stepName).toBe("submit-deleveraging-orders");
    }
  });
});
