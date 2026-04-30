// Phase 9 / Step 13 — state-transition-saga 单元测试（裁决 6：unit ≤8）。
//
// 8 个 unit it 覆盖：工厂签名 / happy path（无前置校验）/ happy path（含
// preconditionChecks 多 Engine 实际消费）/ 状态转换非法（state machine
// 拒绝）/ 终态状态不可转换 / position-closed 校验失败 / margin-released
// 校验失败 / 配置版本不匹配 reason 校验。
//
// Mock 策略：3 业务 Engine（position/margin/fund）部分 mock + 2 minimal
// mock Engine（markPrice/match）；Saga 基础设施用真实 in-memory adapter。
// 接受 minimal mock 字段冗余作为 Sprint H 模板纪律代价（裁决 2 R5）。

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
  QueryMarginBalanceRequest,
  QueryMarginBalanceResponse,
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
  createPositionId,
  createPositionSize
} from "@tianqi/ports";

import {
  createStateTransitionSaga,
  type PreconditionCheck,
  type StateTransitionInput
} from "./state-transition-saga.js";

// ============================================================
// Mock 5 Engine（3 业务 Engine 重点 mock + 2 minimal mock）
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

type MockPosition = PositionEnginePort & {
  positionSize: number;
  positionId: string | null;
  callCount: number;
  failOnQuery: boolean;
};

const createMockPositionEngine = (positionSize = 0, positionId: string | null = null): MockPosition => {
  const engine: MockPosition = {
    positionSize,
    positionId,
    callCount: 0,
    failOnQuery: false,
    async queryPosition(req: QueryPositionRequest) {
      engine.callCount += 1;
      if (engine.failOnQuery) {
        return err({
          code: "TQ-INF-013",
          message: "position engine unreachable",
          context: {}
        } as PositionEnginePortError);
      }
      return ok({
        accountId: req.accountId,
        symbol: req.symbol,
        positionId: engine.positionId === null ? null : createPositionId(engine.positionId),
        side: engine.positionSize === 0 ? null : "long",
        size: createPositionSize(engine.positionSize),
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

type MockMargin = MarginEnginePort & {
  lockedMargin: number;
  callCount: number;
};

const createMockMarginEngine = (lockedMargin = 0): MockMargin => {
  const engine: MockMargin = {
    lockedMargin,
    callCount: 0,
    async calculateMargin(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<CalculateMarginResponse, MarginEnginePortError>;
    },
    async lockMargin(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<LockMarginResponse, MarginEnginePortError>;
    },
    async releaseMargin(_req) {
      return err({ code: "TQ-INF-017", message: "n/a", context: {} } as MarginEnginePortError) as unknown as Result<ReleaseMarginResponse, MarginEnginePortError>;
    },
    async queryMarginBalance(req: QueryMarginBalanceRequest) {
      engine.callCount += 1;
      return ok({
        accountId: req.accountId,
        currency: req.currency,
        availableMargin: createMarginAmount(10_000),
        lockedMargin: createMarginAmount(engine.lockedMargin),
        totalMargin: createMarginAmount(10_000 + engine.lockedMargin),
        queriedAt: new Date().toISOString()
      } satisfies QueryMarginBalanceResponse);
    }
  };
  return engine;
};

type MockFund = FundEnginePort & {
  availableBalance: number;
  callCount: number;
};

const createMockFundEngine = (availableBalance = 0): MockFund => {
  const engine: MockFund = {
    availableBalance,
    callCount: 0,
    async queryFundBalance(req: QueryFundBalanceRequest) {
      engine.callCount += 1;
      return ok({
        accountId: req.accountId,
        currency: req.currency,
        totalBalance: createFundAmount(engine.availableBalance),
        availableBalance: createFundAmount(engine.availableBalance),
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

type FullPorts = Parameters<typeof createStateTransitionSaga>[0] & {
  position: MockPosition;
  margin: MockMargin;
  fund: MockFund;
};

const buildPorts = async (
  positionSize = 0,
  positionId: string | null = null,
  lockedMargin = 0,
  fundBalance = 0
): Promise<FullPorts> => {
  const sagaStateStore = createInMemorySagaStateStore();
  const deadLetterStore = createInMemoryDeadLetterStore();
  await sagaStateStore.init();
  await deadLetterStore.init();
  return {
    sagaStateStore,
    deadLetterStore,
    auditEventSink: createInMemoryAuditSink(),
    markPrice: buildMinimalMarkPrice(),
    position: createMockPositionEngine(positionSize, positionId),
    match: buildMinimalMatch(),
    margin: createMockMarginEngine(lockedMargin),
    fund: createMockFundEngine(fundBalance)
  };
};

// ============================================================
// Tests
// ============================================================

describe("state-transition-saga: unit tests", () => {
  it("test_factory_returns_saga_with_runForCase_method", async () => {
    const ports = await buildPorts();
    const saga = createStateTransitionSaga(ports);
    expect(typeof saga.runForCase).toBe("function");
  });

  it("test_runForCase_happy_path_no_precondition_executes_all_4_steps", async () => {
    // Happy path 无前置校验：4 step 严格顺序；无业务 Engine 调用
    // （preconditionChecks 空 → step 2 noop）
    const ports = await buildPorts();
    const saga = createStateTransitionSaga(ports);
    const result = await saga.runForCase(buildInput("happy"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      const stepNames = result.value.stepStatuses.map(s => s.name);
      expect(stepNames).toEqual([
        "validate-current-state",
        "validate-precondition",
        "persist-new-state",
        "record-transition-completion"
      ]);
      result.value.stepStatuses.forEach(s => {
        expect(s.status).toBe("succeeded");
      });
    }
    // 无 Engine 调用（preconditionChecks 空）
    expect(ports.position.callCount).toBe(0);
    expect(ports.margin.callCount).toBe(0);
    expect(ports.fund.callCount).toBe(0);
  });

  it("test_runForCase_happy_path_with_3_precondition_checks_invokes_all_engines", async () => {
    // Happy path 含前置校验：3 个 PreconditionCheck → step 2 实际消费 3
    // 个业务 Engine（position-closed / margin-released / fund-settled）
    // —— **R6 Engine 实际消费证据**
    const ports = await buildPorts(0, null, 0, 5_000); // 全部满足前置校验
    const saga = createStateTransitionSaga(ports);
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
    const result = await saga.runForCase(buildInput("preflight", "Settling", "Close", checks));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
    }
    // 3 个业务 Engine 全部被调用 1 次（满足 R6）
    expect(ports.position.callCount).toBe(1);
    expect(ports.margin.callCount).toBe(1);
    expect(ports.fund.callCount).toBe(1);
  });

  it("test_runForCase_with_illegal_state_transition_fails_at_step_1", async () => {
    // 状态转换非法：currentExpectedState=Detected + targetAction=Close
    // 在 stateTransitionRules 内无对应规则 → step 1 失败 → vacuous
    const ports = await buildPorts();
    const saga = createStateTransitionSaga(ports);
    const result = await saga.runForCase(buildInput("illegal", "Detected", "Close"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous
      expect(result.value.stepStatuses[0]?.status).toBe("failed");
      expect(result.value.stepStatuses[0]?.failureReason).toContain("transition_rule_not_found");
    }
    // 后续 step 未触发
    expect(ports.position.callCount).toBe(0);
  });

  it("test_runForCase_with_terminal_state_rejects_at_step_1", async () => {
    // 终态状态不可转换：currentExpectedState=Closed + targetAction=任何
    // → resolveTargetState 返回 null → step 1 失败 reason="current_state_terminal"
    const ports = await buildPorts();
    const saga = createStateTransitionSaga(ports);
    const result = await saga.runForCase(buildInput("terminal", "Closed", "StartValidation"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[0]?.failureReason).toContain("current_state_terminal");
    }
  });

  it("test_runForCase_with_position_not_closed_fails_at_step_2", async () => {
    // position-closed 校验失败：positionSize > 0 → step 2 业务校验失败
    // → reason "position_not_closed:..." moniker
    const ports = await buildPorts(0.5, "pos-001"); // 持仓未平
    const saga = createStateTransitionSaga(ports);
    const checks: ReadonlyArray<PreconditionCheck> = [
      {
        kind: "position-closed",
        accountId: createPositionAccountId("acct-pos-still-open"),
        symbol: "BTC-USDT"
      }
    ];
    const result = await saga.runForCase(buildInput("pos-fail", "Settling", "Close", checks));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // step 2 失败 + step 1 noop 反向
      expect(result.value.stepStatuses[1]?.status).toBe("failed");
      expect(result.value.stepStatuses[1]?.failureReason).toContain("position_not_closed");
    }
    expect(ports.position.callCount).toBe(1);
  });

  it("test_runForCase_with_margin_not_released_fails_at_step_2", async () => {
    // margin-released 校验失败：lockedMargin > 0 → step 2 业务校验失败
    const ports = await buildPorts(0, null, 1_000); // 保证金未释放
    const saga = createStateTransitionSaga(ports);
    const checks: ReadonlyArray<PreconditionCheck> = [
      {
        kind: "margin-released",
        accountId: createMarginAccountId("acct-margin-still-locked"),
        currency: createMarginCurrency("USDT")
      }
    ];
    const result = await saga.runForCase(buildInput("margin-fail", "Settling", "Close", checks));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.stepStatuses[1]?.failureReason).toContain("margin_not_released");
    }
    expect(ports.margin.callCount).toBe(1);
  });

  it("test_runForCase_with_engine_unreachable_translates_to_TQ_SAG_002", async () => {
    // §6.5 转译纪律证据：Engine 错误 → SagaPortError TQ-SAG-002 + 领
    // 域级 message moniker（含 precheckKind:accountId 标识）
    const ports = await buildPorts();
    ports.position.failOnQuery = true;
    const saga = createStateTransitionSaga(ports);
    const checks: ReadonlyArray<PreconditionCheck> = [
      {
        kind: "position-closed",
        accountId: createPositionAccountId("acct-engine-down"),
        symbol: "BTC-USDT"
      }
    ];
    const result = await saga.runForCase(buildInput("engine-down", "Settling", "Close", checks));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      const failedStep = result.value.stepStatuses[1];
      expect(failedStep?.status).toBe("failed");
      // failureReason 含 TQ-INF-013 + position-closed moniker
      expect(failedStep?.failureReason).toContain("TQ-INF-013");
      expect(failedStep?.failureReason).toContain("position-closed");
    }
  });
});
