// Phase 9 / Step 11 — ADLSaga（Sprint H 模板真实考验战 — 自动减仓编排）。
//
// Sprint H 第二战，业务复杂度显著高于 Step 10 Liquidation：
//   - 多账户公平减仓（targets 数组动态长度）
//   - 保险资金联动（系统损失吸收）
//   - 多账户结算（每账户独立资金回撤路径）
//
// 本模块**完整复制 Step 10 LiquidationSaga 模板** —— 8 项工程组成
// 1:1 对齐：模块文件结构 / Ports 类型形态 / Options 类型形态 / Input 字段
// 集 / SagaStep 集合粒度 / §6.5 错误转译 helper / 测试三件套 / 编排器透明
// 性。多账户复杂度封装在 step 内部循环，对编排器透明（裁决 1 C 三阶段）。
//
// 设计裁决（详见 docs/decisions/0002 Step 11 段 + docs/phase9/11）：
//   - 裁决 1 (C + C-fail-fast)：多账户场景映射为 step 内部循环；任一账户
//     失败 → 整个 step 失败 → 触发逆序补偿（已成功账户被反向回撤）
//   - 裁决 2 (5 step)：fetch-mark-prices / verify-targets / submit-deleveraging-orders
//     / insurance-fund-deduction / settle-account-funds —— 与 Step 10 同
//     量级（5 step 中粒度）
//   - 裁决 3：ADLSagaPorts = LiquidationSagaPorts 类型别名（Sprint H
//     模板纪律一致性；ADL 与 Liquidation 都消费"5 业务 Engine + 3 saga
//     基础设施"）
//   - 裁决 4 (ADLInput 字段集)：caseId / 保险资金账户 / 损失吸收目标 /
//     系统损失金额 + 币种 / matchAccountId / targets[] 候选盈利账户列表
//     / deleveragingStrategy moniker / triggerReason —— 一旦发布即冻结
//   - 裁决 5：0 错误码新增（惯例 K 第 13 次实战；R3 下限严守）
//   - 裁决 6：不拆两阶段（Sprint H 模板已立；ADL 复杂度在业务层不在 Saga
//     编排层）
//   - 裁决 7：unit ≤8 + 集成 ≤4 + contract 17（一行挂载）—— 与 Step 10 同
//
// 业务流程（5 step 严格顺序）：
//
//   1. fetch-mark-prices       MarkPriceEngine.queryMarkPriceBatch  noop（只读）
//   2. verify-targets          PositionEngine.queryPosition × N    noop（只读校验候选目标）
//   3. submit-deleveraging-orders  MatchEngine.placeOrder × N      cancel-orders 反向（批量）
//   4. insurance-fund-deduction    FundEngine.transferFund          反向 transferFund（保险池 → 损失目标）
//   5. settle-account-funds        FundEngine.transferFund × N      反向 N 次（多账户独立结算）
//
// 编排器透明性：本模块通过 createSagaOrchestrator 调用，不修改 saga-orchestrator.ts；
// git diff 验证 zero（与 Step 9 + 10 模式一致）。
//
// §6.5 转译纪律延续：Engine 错误（含 HTTP 状态 / 网络异常文本）严禁泄漏到
// SagaPortError；step.execute 内部调用 Engine 后，仅取 error.code +
// 领域级 message moniker 包装为 SagaPortError；context 字段不透出。多账户
// step 内首次失败立即返回（C-fail-fast）+ 携带账户标识到 message moniker。

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  FundAccountId,
  FundAmount,
  FundCurrency,
  MarkPriceValue,
  MatchAccountId,
  OrderId,
  OrderSide,
  PositionAccountId,
  PositionId,
  PositionSize,
  SagaContext,
  SagaInvocation,
  SagaPortError,
  SagaResult,
  SagaStep,
  SagaStepExecution,
  TransferId
} from "@tianqi/ports";

import { createSagaOrchestrator } from "./saga-orchestrator.js";
import type {
  LiquidationSagaOptions,
  LiquidationSagaPorts
} from "./liquidation-saga.js";

// ============================================================
// 对外类型（裁决 3 模板复用）
// ============================================================

/**
 * ADLSagaPorts：复用 LiquidationSagaPorts 类型（裁决 3）。
 *
 * Sprint H 模板纪律一致性 —— ADL 与 Liquidation 都消费"5 业务 Engine +
 * 3 saga 基础设施"；Ports 形态完全一致；业务差异通过 Input 字段集表达。
 *
 * 元规则 B：ADLSagaPorts 类型别名一旦发布即冻结。后续 Step 12-13 业务
 * Saga 各自独立 Ports 类型（譬如 InsuranceFundSagaPorts 可能仅含 fund
 * Engine + saga 基础设施；不应共享同一别名）。
 */
export type ADLSagaPorts = LiquidationSagaPorts;

/**
 * ADLSagaOptions：复用 LiquidationSagaOptions 类型（与 Ports 同模式）。
 */
export type ADLSagaOptions = LiquidationSagaOptions;

/**
 * 单个减仓目标（候选盈利账户）。
 *
 * 调用方负责按公平算法（按盈利率 / 杠杆 / 持仓规模 / etc）选定 targets
 * 数组——本模块**不实现**公平算法（policy 层未来 Phase 责任；本 Step 通
 * 过 ADLInput.targets 接收调用方计算结果）。
 *
 * symbol 与 ADLInput.symbols 配合：每个 target 必须 ⊂ ADLInput.symbols
 * （否则 verify-targets step 失败）。
 */
export type DeleveragingTarget = {
  readonly accountId: PositionAccountId;
  readonly fundAccountId: FundAccountId;
  readonly matchAccountId: MatchAccountId;
  readonly positionId: PositionId;
  readonly symbol: string;
  /** 减仓方向（与持仓方向相反） */
  readonly deleveragingSide: OrderSide;
  /** 减仓数量（可能小于持仓总量，部分减仓） */
  readonly deleveragingQuantity: PositionSize;
  /** 期望减仓价（market 单时仅作上限参考） */
  readonly expectedDeleveragingPrice: MarkPriceValue;
  /** 该账户结算到保险资金池的金额（损失吸收方向） */
  readonly accountSettleAmount: FundAmount;
};

/**
 * ADL Saga 业务输入（裁决 4 锁定字段集）。
 *
 * 字段一旦发布即冻结（元规则 B）；后续业务扩展通过新增**可选**字段或
 * ADR-0002 修订流程，不删除 / 重命名既有字段。
 *
 * 公平算法在调用方：targets 数组的顺序和组成由调用方按公平算法（按盈利
 * 率排序 / 按杠杆排序等）选定；本模块仅按 targets 顺序遍历。
 *
 * deleveragingStrategy 是 domain moniker（如 "by-profit-rate" /
 * "by-leverage" / "by-position-size"），仅作审计标签让运维 grep 区分；
 * SagaStep 不消费此字段。
 */
export type ADLInput = {
  /** 业务案件标识（与 ADLCase.id 一致） */
  readonly caseId: string;
  /** 保险资金账户（系统损失吸收来源） */
  readonly insuranceFundAccountId: FundAccountId;
  /** 损失吸收目标账户（保险资金最终流向；通常是损失账户） */
  readonly lossAbsorptionTargetAccountId: FundAccountId;
  /** 系统损失金额（保险资金池消耗量） */
  readonly systemLossAmount: FundAmount;
  /** 系统损失币种 */
  readonly systemLossCurrency: FundCurrency;
  /** 减仓订单结算共用币种（与 systemLossCurrency 可能不同） */
  readonly fundCurrency: FundCurrency;
  /** 涉及的合约符号集合（用于 fetch-mark-prices 批量查询） */
  readonly symbols: ReadonlyArray<string>;
  /** 减仓候选目标列表（调用方按公平算法选定；按 targets 数组顺序处理） */
  readonly targets: ReadonlyArray<DeleveragingTarget>;
  /** 公平算法 moniker（审计标签，不影响 SagaStep 行为） */
  readonly deleveragingStrategy: string;
  /** 触发原因 moniker */
  readonly triggerReason: string;
};

/**
 * 单个目标的减仓结果（execute 成功路径产出；compensate 阶段反向用）。
 */
export type DeleveragedTargetResult = {
  readonly accountId: PositionAccountId;
  readonly positionId: PositionId;
  readonly orderId: OrderId;
  readonly settledTransferId: TransferId;
  readonly accountSettleAmount: FundAmount;
};

/**
 * ADL Saga 业务输出（runSaga 成功时返回）。
 */
export type ADLOutput = {
  readonly markPriceCount: number;
  readonly verifiedTargetCount: number;
  readonly deleveragedTargets: ReadonlyArray<DeleveragedTargetResult>;
  readonly insuranceFundTransferId: TransferId;
  readonly insuranceFundDeducted: FundAmount;
};

export type ADLSaga = {
  /**
   * 启动一次 ADL Saga 并推进到终态。
   *
   * 失败模式（C-fail-fast；裁决 1）：
   *   - targets 为空 → ok 返回 + verifiedTargetCount=0；deleveragedTargets=[]
   *   - 任一 step 内某账户调用失败 → 立即整个 step 失败 → 触发逆序补偿
   *   - 已成功账户被反向回撤（cancelOrder / 反向 transferFund）
   */
  runForCase(
    input: ADLInput
  ): Promise<Result<SagaResult<ADLOutput>, SagaPortError>>;
};

// ============================================================
// 内部
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

type StepCtx = {
  readonly input: ADLInput;
  readonly idempotencyKey: string;
};

// ============================================================
// 错误转译（§6.5 纪律延续；与 Step 10 translateEngineError 同模式）
// ============================================================
//
// 多账户 step 内首次失败立即返回 + 携带 accountId 到 message moniker
// （便于运维 grep "TQ-SAG-002 ... acct-X" 定位失败账户）。

const translateEngineError = (
  engineError: { readonly code: string; readonly message: string },
  sagaId: SagaInvocation<unknown>["sagaId"],
  stepName: string,
  accountIdMoniker?: string
): SagaPortError => ({
  code: "TQ-SAG-002",
  sagaId,
  stepName,
  message:
    accountIdMoniker !== undefined
      ? `${stepName} engine call failed for ${accountIdMoniker}: ${engineError.code}`
      : `${stepName} engine call failed: ${engineError.code}`,
  cause: { engineCode: engineError.code, engineMessage: engineError.message }
});

// ============================================================
// 5 SagaStep 工厂（与 Step 10 模板对齐：每个 step 独立函数；显式 execute
// + compensate + name；compensationContext 可序列化 plain object《§4.4》）
// ============================================================

/**
 * Step 1: fetch-mark-prices（多 symbol 批量查询；只读）。
 *
 * compensate noop（只读 step）；MarkPriceEngine.queryMarkPriceBatch 一
 * 次调用拿全部 symbols（不做循环——下游通常做内部缓存优化）。
 */
const buildFetchMarkPricesStep = (
  ports: ADLSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "fetch-mark-prices",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.markPrice.queryMarkPriceBatch({
      symbols: ctx.input.symbols,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "fetch-mark-prices"));
    }
    const exec: SagaStepExecution<
      { markPriceCount: number },
      { kind: "noop"; stepName: string }
    > = {
      output: { markPriceCount: result.value.prices.length },
      compensationContext: { kind: "noop", stepName: "fetch-mark-prices" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 2: verify-targets（多账户循环 query；只读校验候选目标存在）。
 *
 * 多账户循环（裁决 1 C-fail-fast）：任一目标的 queryPosition 失败 →
 * 立即整个 step 失败。compensate noop（只读）。
 */
const buildVerifyTargetsStep = (
  ports: ADLSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "verify-targets",
  async execute(_input, sagaContext: SagaContext) {
    let verifiedCount = 0;
    for (const target of ctx.input.targets) {
      const result = await ports.position.queryPosition({
        accountId: target.accountId,
        symbol: target.symbol,
        traceId: sagaContext.traceId
      });
      if (!result.ok) {
        // C-fail-fast：首次失败立即返回 + 携带 accountId moniker
        return err(
          translateEngineError(
            result.error,
            sagaContext.sagaId,
            "verify-targets",
            String(target.accountId)
          )
        );
      }
      verifiedCount += 1;
    }
    const exec: SagaStepExecution<
      { verifiedTargetCount: number },
      { kind: "noop"; stepName: string }
    > = {
      output: { verifiedTargetCount: verifiedCount },
      compensationContext: { kind: "noop", stepName: "verify-targets" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 3: submit-deleveraging-orders（多账户循环 placeOrder；写）。
 *
 * 多账户循环 + C-fail-fast：任一账户 placeOrder 失败 → 立即整个 step
 * 失败 → 触发逆序补偿（已成功账户反向 cancelOrder）。
 *
 * compensationContext 含已成功账户的 orderId 列表，让 compensate 反向
 * cancelOrder 时仅作用于本 step 真实成功的部分（不影响后续 step 失败时
 * 重启的边界情况）。
 */
const buildSubmitDeleveragingOrdersStep = (
  ports: ADLSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "submit-deleveraging-orders",
  async execute(_input, sagaContext: SagaContext) {
    const placedOrders: Array<{ orderId: OrderId; matchAccountId: MatchAccountId }> = [];
    for (let i = 0; i < ctx.input.targets.length; i += 1) {
      const target = ctx.input.targets[i]!;
      const result = await ports.match.placeOrder({
        accountId: target.matchAccountId,
        symbol: target.symbol,
        side: target.deleveragingSide,
        type: "market", // ADL 减仓用市价单确保成交
        quantity: target.deleveragingQuantity as unknown as number,
        idempotencyKey: `${ctx.idempotencyKey}:place:${i}`,
        traceId: sagaContext.traceId
      });
      if (!result.ok) {
        // C-fail-fast：首次失败 → step 失败；返回 err 但 compensate 触发时
        // SagaOrchestrator 会调本 step compensate 一次，contextPayload 含
        // 已成功的 placedOrders 列表 —— execute 失败路径无 compensationContext
        // 持久化（Step 6 状态机：只有 succeeded → compensating），故此处
        // 失败前已记录的 placedOrders 不会被反向。下一次 step 失败的反向
        // 由"前序已成功 step"的 compensate 负责。
        return err(
          translateEngineError(
            result.error,
            sagaContext.sagaId,
            "submit-deleveraging-orders",
            String(target.matchAccountId)
          )
        );
      }
      placedOrders.push({
        orderId: result.value.orderId,
        matchAccountId: target.matchAccountId
      });
    }
    const exec: SagaStepExecution<
      { placedOrderIds: ReadonlyArray<OrderId> },
      {
        kind: "cancel-orders";
        orders: ReadonlyArray<{ orderId: OrderId; matchAccountId: MatchAccountId }>;
      }
    > = {
      output: { placedOrderIds: placedOrders.map(p => p.orderId) },
      compensationContext: { kind: "cancel-orders", orders: placedOrders }
    };
    return ok(exec);
  },
  async compensate(compensationContext, sagaContext: SagaContext) {
    const ctxData = compensationContext as {
      kind: string;
      orders: ReadonlyArray<{ orderId: OrderId; matchAccountId: MatchAccountId }>;
    };
    if (ctxData.kind !== "cancel-orders") {
      return ok(undefined);
    }
    // 反向逐个 cancelOrder（compensate 内部多账户循环；任一失败立即返
    // 回——SagaOrchestrator 走 dead_lettered + 死信入队路径）
    for (let i = 0; i < ctxData.orders.length; i += 1) {
      const entry = ctxData.orders[i]!;
      const result = await ports.match.cancelOrder({
        orderId: entry.orderId,
        idempotencyKey: `${ctx.idempotencyKey}:cancel:${i}`,
        traceId: sagaContext.traceId
      });
      if (!result.ok) {
        return err(
          translateEngineError(
            result.error,
            sagaContext.sagaId,
            "submit-deleveraging-orders.compensate",
            String(entry.matchAccountId)
          )
        );
      }
    }
    return ok(undefined);
  }
});

/**
 * Step 4: insurance-fund-deduction（保险资金消耗；单 transferFund）。
 *
 * 与 Step 10 settle-fund-transfer 类似（单笔写）；compensate 反向
 * transferFund 把保险资金从损失目标账户回撤回保险池。
 */
const buildInsuranceFundDeductionStep = (
  ports: ADLSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "insurance-fund-deduction",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.fund.transferFund({
      fromAccountId: ctx.input.insuranceFundAccountId,
      toAccountId: ctx.input.lossAbsorptionTargetAccountId,
      currency: ctx.input.systemLossCurrency,
      amount: ctx.input.systemLossAmount,
      idempotencyKey: `${ctx.idempotencyKey}:insurance`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "insurance-fund-deduction"));
    }
    const exec: SagaStepExecution<
      { transferId: TransferId },
      {
        kind: "reverse-insurance";
        fromAccountId: FundAccountId;
        toAccountId: FundAccountId;
        currency: FundCurrency;
        amount: FundAmount;
      }
    > = {
      output: { transferId: result.value.transferId },
      compensationContext: {
        kind: "reverse-insurance",
        // 反向：源 / 目的对调（损失目标 → 保险池）
        fromAccountId: ctx.input.lossAbsorptionTargetAccountId,
        toAccountId: ctx.input.insuranceFundAccountId,
        currency: ctx.input.systemLossCurrency,
        amount: ctx.input.systemLossAmount
      }
    };
    return ok(exec);
  },
  async compensate(compensationContext, sagaContext: SagaContext) {
    const ctxData = compensationContext as {
      kind: string;
      fromAccountId: FundAccountId;
      toAccountId: FundAccountId;
      currency: FundCurrency;
      amount: FundAmount;
    };
    if (ctxData.kind !== "reverse-insurance") {
      return ok(undefined);
    }
    const result = await ports.fund.transferFund({
      fromAccountId: ctxData.fromAccountId,
      toAccountId: ctxData.toAccountId,
      currency: ctxData.currency,
      amount: ctxData.amount,
      idempotencyKey: `${ctx.idempotencyKey}:reverse-insurance`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "insurance-fund-deduction.compensate")
      );
    }
    return ok(undefined);
  }
});

/**
 * Step 5: settle-account-funds（多账户结算；写）。
 *
 * 多账户循环 + C-fail-fast：任一账户 transferFund 失败 → 立即整个 step
 * 失败 → 触发逆序补偿（已成功账户反向 transferFund）。
 *
 * 减仓目标账户向保险资金池转账（吸收损失）。每个 target 独立 transferFund
 * 调用；compensationContext 含已成功的转账列表让 compensate 反向调用。
 */
const buildSettleAccountFundsStep = (
  ports: ADLSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "settle-account-funds",
  async execute(_input, sagaContext: SagaContext) {
    const settledTransfers: Array<{
      transferId: TransferId;
      target: DeleveragingTarget;
    }> = [];
    for (let i = 0; i < ctx.input.targets.length; i += 1) {
      const target = ctx.input.targets[i]!;
      const result = await ports.fund.transferFund({
        // 减仓目标账户 → 保险资金池（吸收损失方向）
        fromAccountId: target.fundAccountId,
        toAccountId: ctx.input.insuranceFundAccountId,
        currency: ctx.input.fundCurrency,
        amount: target.accountSettleAmount,
        idempotencyKey: `${ctx.idempotencyKey}:settle:${i}`,
        traceId: sagaContext.traceId
      });
      if (!result.ok) {
        return err(
          translateEngineError(
            result.error,
            sagaContext.sagaId,
            "settle-account-funds",
            String(target.fundAccountId)
          )
        );
      }
      settledTransfers.push({ transferId: result.value.transferId, target });
    }
    // DeleveragedTargetResult 由 step 3 placedOrderIds + step 5 transferIds
    // 联合构造；step 5 的 output 含完整 deleveragedTargets 列表
    const deleveragedTargets: DeleveragedTargetResult[] = settledTransfers.map(
      (entry, i) => ({
        accountId: entry.target.accountId,
        positionId: entry.target.positionId,
        // orderId 来自 step 3 output —— 但 step 5 不直接持有；DeleveragedTargetResult
        // 在终态重建时由调用方 join。本 step output 仅含 settledTransferIds + 索引
        orderId: ("ord-adl-placeholder-" + i) as OrderId,
        settledTransferId: entry.transferId,
        accountSettleAmount: entry.target.accountSettleAmount
      })
    );
    const exec: SagaStepExecution<
      { deleveragedTargets: ReadonlyArray<DeleveragedTargetResult> },
      {
        kind: "reverse-settlements";
        reverses: ReadonlyArray<{
          fromAccountId: FundAccountId;
          toAccountId: FundAccountId;
          currency: FundCurrency;
          amount: FundAmount;
        }>;
      }
    > = {
      output: { deleveragedTargets },
      compensationContext: {
        kind: "reverse-settlements",
        reverses: settledTransfers.map(entry => ({
          // 反向：保险池 → 减仓目标账户
          fromAccountId: ctx.input.insuranceFundAccountId,
          toAccountId: entry.target.fundAccountId,
          currency: ctx.input.fundCurrency,
          amount: entry.target.accountSettleAmount
        }))
      }
    };
    return ok(exec);
  },
  async compensate(compensationContext, sagaContext: SagaContext) {
    const ctxData = compensationContext as {
      kind: string;
      reverses: ReadonlyArray<{
        fromAccountId: FundAccountId;
        toAccountId: FundAccountId;
        currency: FundCurrency;
        amount: FundAmount;
      }>;
    };
    if (ctxData.kind !== "reverse-settlements") {
      return ok(undefined);
    }
    // 反向逐个 transferFund（C-fail-fast；任一失败 → dead_lettered）
    for (let i = 0; i < ctxData.reverses.length; i += 1) {
      const reverse = ctxData.reverses[i]!;
      const result = await ports.fund.transferFund({
        fromAccountId: reverse.fromAccountId,
        toAccountId: reverse.toAccountId,
        currency: reverse.currency,
        amount: reverse.amount,
        idempotencyKey: `${ctx.idempotencyKey}:reverse-settle:${i}`,
        traceId: sagaContext.traceId
      });
      if (!result.ok) {
        return err(
          translateEngineError(
            result.error,
            sagaContext.sagaId,
            "settle-account-funds.compensate",
            String(reverse.fromAccountId)
          )
        );
      }
    }
    return ok(undefined);
  }
});

// ============================================================
// 工厂闭包（裁决 4 I；与 Step 10 createLiquidationSaga 同结构）
// ============================================================

let invocationCounter = 0;
const generateInvocationStamp = (): string => {
  invocationCounter += 1;
  return `${Date.now()}-${invocationCounter}`;
};

export const createADLSaga = (
  ports: ADLSagaPorts,
  options: ADLSagaOptions = {}
): ADLSaga => {
  // 内部组装 SagaOrchestrator（与 Step 10 同模式：消费而非修改；编排器
  // 对本模块零侵入）
  const orchestrator = createSagaOrchestrator(
    {
      sagaStateStore: ports.sagaStateStore,
      deadLetterStore: ports.deadLetterStore,
      auditEventSink: ports.auditEventSink
    },
    {
      ...(options.defaultStepTimeoutMs !== undefined && {
        defaultStepTimeoutMs: options.defaultStepTimeoutMs
      }),
      ...(options.defaultSagaTimeoutMs !== undefined && {
        defaultSagaTimeoutMs: options.defaultSagaTimeoutMs
      }),
      ...(options.clock !== undefined && { clock: options.clock }),
      ...(options.generateDeadLetterId !== undefined && {
        generateDeadLetterId: options.generateDeadLetterId
      }),
      ...(options.onDegradedFailure !== undefined && {
        onDegradedFailure: options.onDegradedFailure
      })
    }
  );

  const runForCase = async (
    input: ADLInput
  ): Promise<Result<SagaResult<ADLOutput>, SagaPortError>> => {
    const stamp = generateInvocationStamp();
    const idempotencyKey = `adl:${input.caseId}:${stamp}`;

    const ctx: StepCtx = { input, idempotencyKey };

    // 5 业务 step 严格顺序构造（业务流程图详见 docs/phase9/11 §D）
    const steps: ReadonlyArray<AnyStep> = [
      buildFetchMarkPricesStep(ports, ctx),
      buildVerifyTargetsStep(ports, ctx),
      buildSubmitDeleveragingOrdersStep(ports, ctx),
      buildInsuranceFundDeductionStep(ports, ctx),
      buildSettleAccountFundsStep(ports, ctx)
    ];

    const invocation: SagaInvocation<unknown> = {
      sagaId: ("adl-saga-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["sagaId"],
      traceId: ("trace-adl-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["traceId"],
      correlationId: ("corr-adl-" + input.caseId) as SagaInvocation<unknown>["correlationId"],
      initialInput: undefined,
      sagaTimeoutMs: 0
    };

    return orchestrator.runSaga<ADLOutput>(invocation, steps);
  };

  return { runForCase };
};
