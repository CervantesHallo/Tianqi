// Phase 9 / Step 12 — insurance-fund-saga 单元测试（裁决 6：unit ≤8）。
//
// 8 个 unit it 覆盖：工厂签名 / happy path 4 step / query-balance 失败
// vacuous / deduct 失败 self 不补偿 / credit 失败反向 deduct / record-completion
// 失败终态 partial / 不同 coverageRatio / 三账户独立路径。
//
// Mock 策略：FundEngine 重点 mock（含 queryFundBalance + transferFund 多
// 次调用）；其他 4 业务 Engine（margin/position/match/markPrice）注入
// minimal mock（Sprint H 模板纪律——单账户场景接受这个 mock 冗余作为
// 模板一致性代价；裁决 2 R5 严守）；Saga 基础设施用真实 in-memory adapter。

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
  QueryFundBalanceRequest,
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
  createTransferId
} from "@tianqi/ports";

import { createInsuranceFundSaga, type InsuranceFundInput } from "./insurance-fund-saga.js";

// ============================================================
// Mock 5 Engine（FundEngine 重点 mock；其他 4 Engine minimal mock 接受
// 模板一致性代价）
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

type MockFund = FundEnginePort & {
  failureMode: {
    method: "queryFundBalance" | "transferFund";
    failOnTransferIndex?: number;
    error: FundEnginePortError;
  } | null;
  queryCount: number;
  transferCount: number;
  transfers: TransferFundRequest[];
  observedBalance: number;
};

const createMockFundEngine = (): MockFund => {
  const transfers: TransferFundRequest[] = [];
  const engine: MockFund = {
    failureMode: null,
    queryCount: 0,
    transferCount: 0,
    transfers,
    observedBalance: 100_000,
    async queryFundBalance(req: QueryFundBalanceRequest) {
      engine.queryCount += 1;
      if (engine.failureMode?.method === "queryFundBalance") {
        return err(engine.failureMode.error);
      }
      return ok({
        accountId: req.accountId,
        currency: req.currency,
        totalBalance: createFundAmount(engine.observedBalance),
        availableBalance: createFundAmount(engine.observedBalance),
        frozenBalance: createFundAmount(0),
        queriedAt: new Date().toISOString()
      } satisfies QueryFundBalanceResponse);
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
          engine.failureMode.failOnTransferIndex === undefined ||
          engine.failureMode.failOnTransferIndex === idx
        ) {
          return err(engine.failureMode.error);
        }
      }
      return ok({
        transferId: createTransferId("trans-if-" + idx),
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

const buildInput = (caseSuffix: string, coverageRatio = 0.8): InsuranceFundInput => ({
  caseId: "case-if-" + caseSuffix,
  affectedAccountId: createFundAccountId("acct-affected-" + caseSuffix),
  lossAmount: createFundAmount(1_000),
  lossCurrency: createFundCurrency("USDT"),
  insuranceFundAccountId: createFundAccountId("insurance-fund-" + caseSuffix),
  lossAbsorptionTargetAccountId: createFundAccountId("loss-absorber-" + caseSuffix),
  coverageRatio,
  triggerReason: "insurance_coverage_triggered"
});

type FullPorts = Parameters<typeof createInsuranceFundSaga>[0] & {
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
    markPrice: buildMinimalMarkPrice(),
    position: buildMinimalPosition(),
    match: buildMinimalMatch(),
    margin: buildMinimalMargin(),
    fund: createMockFundEngine()
  };
};

// ============================================================
// Tests
// ============================================================

describe("insurance-fund-saga: unit tests", () => {
  it("test_factory_returns_saga_with_runForCase_method", async () => {
    const ports = await buildPorts();
    const saga = createInsuranceFundSaga(ports);
    expect(typeof saga.runForCase).toBe("function");
  });

  it("test_runForCase_happy_path_executes_all_4_steps_with_dual_transfer", async () => {
    // Happy path：4 step 严格顺序；FundEngine 调用 1 query + 2 transferFund
    // （deduct + credit；step 4 不调用 Engine）
    const ports = await buildPorts();
    const saga = createInsuranceFundSaga(ports);
    const result = await saga.runForCase(buildInput("happy"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      const stepNames = result.value.stepStatuses.map(s => s.name);
      expect(stepNames).toEqual([
        "query-insurance-balance",
        "deduct-from-insurance",
        "credit-to-affected-account",
        "record-coverage-completion"
      ]);
      result.value.stepStatuses.forEach(s => {
        expect(s.status).toBe("succeeded");
      });
    }
    // FundEngine 调用证据：1 queryFundBalance + 2 transferFund
    expect(ports.fund.queryCount).toBe(1);
    expect(ports.fund.transferCount).toBe(2);
    // 两段 transferFund：deduct（保险池→中转）+ credit（中转→受影响）
    expect(ports.fund.transfers[0]?.fromAccountId).toBe(
      createFundAccountId("insurance-fund-happy")
    );
    expect(ports.fund.transfers[0]?.toAccountId).toBe(
      createFundAccountId("loss-absorber-happy")
    );
    expect(ports.fund.transfers[1]?.fromAccountId).toBe(
      createFundAccountId("loss-absorber-happy")
    );
    expect(ports.fund.transfers[1]?.toAccountId).toBe(
      createFundAccountId("acct-affected-happy")
    );
  });

  it("test_runForCase_with_query_balance_failure_results_in_compensated_vacuous", async () => {
    // step 1 query-insurance-balance 失败 → 无 succeeded → vacuous
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "queryFundBalance",
      error: { code: "TQ-INF-013", message: "fund engine unreachable", context: {} }
    };
    const saga = createInsuranceFundSaga(ports);
    const result = await saga.runForCase(buildInput("query-fail"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous
      expect(result.value.stepStatuses[0]?.status).toBe("failed");
    }
    // step 2/3 未触发——transferFund 调用 0 次
    expect(ports.fund.transferCount).toBe(0);
  });

  it("test_runForCase_with_deduct_failure_does_not_invoke_self_compensate", async () => {
    // 《§4.3》失败 step 自身不补偿——step 2 deduct 失败 → step 1 noop
    // 反向；step 2 自身不调反向 transferFund
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      failOnTransferIndex: 0, // 首次 transferFund (step 2 deduct) 失败
      error: { code: "TQ-INF-013", message: "fund engine unreachable", context: {} }
    };
    const saga = createInsuranceFundSaga(ports);
    const result = await saga.runForCase(buildInput("deduct-fail"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous
      expect(result.value.stepStatuses[1]?.status).toBe("failed");
      expect(result.value.stepStatuses[2]?.status).toBe("pending");
    }
    // transferFund 仅 1 次（deduct 失败；自身不补偿；step 3 credit 未触发）
    expect(ports.fund.transferCount).toBe(1);
  });

  it("test_runForCase_with_credit_failure_triggers_reverse_deduct", async () => {
    // step 3 credit-to-affected 失败 → 严格逆序补偿 step 2 反向 transferFund
    // （中转账户 → 保险池；金额一致）
    const ports = await buildPorts();
    ports.fund.failureMode = {
      method: "transferFund",
      failOnTransferIndex: 1, // step 3 credit (idx 1) 失败
      error: { code: "TQ-INF-013", message: "fund engine unreachable", context: {} }
    };
    const saga = createInsuranceFundSaga(ports);
    const result = await saga.runForCase(buildInput("credit-fail"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[1]?.status).toBe("compensated"); // step 2 反向
      expect(result.value.stepStatuses[2]?.status).toBe("failed");
    }
    // transferFund 调用证据：1 deduct + 1 credit（fail）+ 1 reverse-deduct = 3
    expect(ports.fund.transferCount).toBe(3);
    // 反向调用方向：中转 → 保险池
    expect(ports.fund.transfers[2]?.fromAccountId).toBe(
      createFundAccountId("loss-absorber-credit-fail")
    );
    expect(ports.fund.transfers[2]?.toAccountId).toBe(
      createFundAccountId("insurance-fund-credit-fail")
    );
  });

  it("test_runForCase_with_compensation_failure_enqueues_dead_letter_partial_compensated", async () => {
    // step 3 失败触发 step 2 反向；反向 transferFund 也失败 → step 2
    // dead_lettered + saga 终态 partially_compensated
    const ports = await buildPorts();
    let callIndex = 0;
    const originalTransfer = ports.fund.transferFund.bind(ports.fund);
    ports.fund.transferFund = async (req) => {
      const idx = callIndex;
      callIndex += 1;
      if (idx === 1 || idx === 2) {
        // step 3 credit (idx 1) + step 2 反向 (idx 2) 都失败
        return err({
          code: "TQ-INF-014",
          message: "fund retries exhausted",
          context: {}
        } as FundEnginePortError);
      }
      return originalTransfer(req);
    };
    const saga = createInsuranceFundSaga(ports);
    const result = await saga.runForCase(buildInput("comp-fail"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.stepStatuses[1]?.status).toBe("dead_lettered");
    }
    // 死信入队 1 笔（step 2 反向失败）
    const dlqList = await ports.deadLetterStore.listPending();
    expect(dlqList.ok).toBe(true);
    if (dlqList.ok) {
      expect(dlqList.value.length).toBe(1);
      expect(dlqList.value[0]?.stepName).toBe("deduct-from-insurance");
    }
  });

  it("test_runForCase_with_different_coverage_ratios_applies_correct_amount", async () => {
    // 不同 coverageRatio 验证：lossAmount * coverageRatio 是实际转账金额
    // 由调用方在 Input 决定（裁决 5 C 业务策略外移；本 Saga 不计算）
    const portsHalf = await buildPorts();
    const sagaHalf = createInsuranceFundSaga(portsHalf);
    const resultHalf = await sagaHalf.runForCase(buildInput("half", 0.5));
    expect(resultHalf.ok).toBe(true);
    // lossAmount 1000 * 0.5 = 500
    expect(portsHalf.fund.transfers[0]?.amount).toBe(500);
    expect(portsHalf.fund.transfers[1]?.amount).toBe(500);

    const portsFull = await buildPorts();
    const sagaFull = createInsuranceFundSaga(portsFull);
    const resultFull = await sagaFull.runForCase(buildInput("full", 1.0));
    expect(resultFull.ok).toBe(true);
    // lossAmount 1000 * 1.0 = 1000
    expect(portsFull.fund.transfers[0]?.amount).toBe(1000);
    expect(portsFull.fund.transfers[1]?.amount).toBe(1000);
  });

  it("test_three_account_path_documented_in_transferFund_calls", async () => {
    // 三账户路径证据：保险资金账户 → 中转账户 → 受影响账户
    // 两段 transferFund 让保险资金路径在 audit 层可分离查询
    const ports = await buildPorts();
    const saga = createInsuranceFundSaga(ports);
    const input = buildInput("three-acct", 0.7);
    const result = await saga.runForCase(input);
    expect(result.ok).toBe(true);

    // step 2 deduct: insurance → lossAbsorptionTarget
    expect(ports.fund.transfers[0]?.fromAccountId).toBe(input.insuranceFundAccountId);
    expect(ports.fund.transfers[0]?.toAccountId).toBe(input.lossAbsorptionTargetAccountId);

    // step 3 credit: lossAbsorptionTarget → affectedAccount
    expect(ports.fund.transfers[1]?.fromAccountId).toBe(input.lossAbsorptionTargetAccountId);
    expect(ports.fund.transfers[1]?.toAccountId).toBe(input.affectedAccountId);

    // 两段金额一致（保险资金已扣减后转发）
    expect(ports.fund.transfers[0]?.amount).toBe(ports.fund.transfers[1]?.amount);
    expect(ports.fund.transfers[0]?.amount).toBe(700); // 1000 * 0.7
  });
});
