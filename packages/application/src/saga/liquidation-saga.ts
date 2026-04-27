// Phase 9 / Step 10 — LiquidationSaga（Sprint H 启程战 — 第一个业务 Saga）。
//
// Sprint H 性质与 Sprint F-G 完全不同——不构建基础设施或编排器，而是把
// Sprint G 锁定的 SagaOrchestrator + Phase 8 5 业务 Engine 编排成第一个
// 具体业务 Saga。Phase 9 真正"为业务而做"的开始；本模块的工程模板将
// 被 Step 11-13（ADL / InsuranceFund / StateTransition）复制 3 次。
//
// 设计裁决（详见 docs/decisions/0002 Step 10 段 + docs/phase9/10）：
//   - 裁决 1 (α)：模块归属 packages/application/src/saga/liquidation-saga.ts
//     与 saga-orchestrator.ts / saga-manual-intervention.ts 同目录平级
//   - 裁决 2 (B)：中粒度 5 个 SagaStep——每个外部 Engine 调用一个 step；
//     补偿语义清晰（Engine 调用失败 → 反向调用同 Engine）
//   - 裁决 3 (X)：直接注入 8 Port（3 saga 基础设施 + 5 业务 Engine）；
//     与 Step 6 SagaOrchestratorPorts 3 个对照，业务 Saga 注入更多 Port
//     是合理的——业务流程"运行时"直接消费 Adapter 是其本职
//   - 裁决 4 (I)：工厂闭包 createLiquidationSaga(ports, options?) +
//     runForCase 单方法（与 SagaOrchestrator / SagaManualIntervention
//     风格一致）
//   - 裁决 5 (LiquidationInput 字段集)：caseId / 4 brand 账户 ID（margin
//     /position/match/fund）/ symbol / currency / marginLockId /
//     fundDestinationAccountId / fundAmount / closeOrderQuantity /
//     closeOrderSide / triggerReason ——一旦发布即冻结（元规则 B）
//   - 裁决 6：死信处置消费既有 SagaManualIntervention（Step 9 通用），
//     不引入业务专属机制（克制）
//   - 裁决 7：unit ≤8 + 集成 ≤4 + contract 17（一行挂载 defineSagaContractTests）
//
// 业务流程（5 step 严格顺序）：
//
//   1. fetch-mark-price       MarkPriceEngine.queryMarkPrice  compensate: noop（只读）
//   2. list-open-positions    PositionEngine.listOpenPositions compensate: noop（只读）
//   3. submit-close-orders    MatchEngine.placeOrder            compensate: cancelOrder 反向
//   4. release-margin         MarginEngine.releaseMargin       compensate: lockMargin 反向
//   5. settle-fund-transfer   FundEngine.transferFund          compensate: transferFund 反向
//
// 编排器透明性（Sprint G Step 9 模式延续）：本模块**消费** SagaOrchestrator
// 工厂创建编排器实例；不修改 saga-orchestrator.ts 内部代码。grep 验证：
// docs/phase9/10 §B.6。
//
// §6.5 转译纪律延续：Engine 错误（含 HTTP 状态 / 网络异常文本）严禁泄漏到
// SagaPortError；step.execute 内部调用 Engine 后，仅取 error.code +
// 领域级 message moniker 包装为 SagaPortError；context 字段不透出。

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  AuditEventSinkPort,
  DeadLetterId,
  DeadLetterStorePort,
  FundAccountId,
  FundAmount,
  FundCurrency,
  FundEnginePort,
  MarginAccountId,
  MarginAmount,
  MarginCurrency,
  MarginEnginePort,
  MarginLockId,
  MarkPriceEnginePort,
  MatchAccountId,
  MatchEnginePort,
  OrderId,
  OrderSide,
  PositionAccountId,
  PositionEnginePort,
  PositionId,
  SagaContext,
  SagaInvocation,
  SagaPortError,
  SagaResult,
  SagaStateStorePort,
  SagaStep,
  SagaStepExecution
} from "@tianqi/ports";

import {
  createSagaOrchestrator,
  type SagaDegradedFailureEvent
} from "./saga-orchestrator.js";

// ============================================================
// 对外类型
// ============================================================

export type LiquidationSagaPorts = {
  // Saga 基础设施（Sprint F + Step 6 已就位）
  readonly sagaStateStore: SagaStateStorePort;
  readonly deadLetterStore: DeadLetterStorePort;
  readonly auditEventSink: AuditEventSinkPort;
  // 5 业务 Engine（Phase 8 Sprint E 已就位）
  readonly margin: MarginEnginePort;
  readonly position: PositionEnginePort;
  readonly match: MatchEnginePort;
  readonly markPrice: MarkPriceEnginePort;
  readonly fund: FundEnginePort;
};

export type LiquidationSagaOptions = {
  readonly defaultStepTimeoutMs?: number;
  readonly defaultSagaTimeoutMs?: number;
  readonly clock?: () => Date;
  readonly generateDeadLetterId?: () => DeadLetterId;
  readonly onDegradedFailure?: (event: SagaDegradedFailureEvent) => void;
};

/**
 * Liquidation Saga 业务输入（裁决 5 锁定字段集）。
 *
 * 字段一旦发布即冻结（元规则 B）；后续业务扩展通过新增**可选**字段或
 * ADR-0002 修订流程，不删除/重命名既有字段。
 *
 * 4 个 brand 账户 ID（margin/position/match/fund）：业务系统通常将所有
 * 这些映射到同一物理账户，但 brand 类型独立保护——LiquidationInput 不
 * 替业务做"统一账户"假设，由调用方负责把同一物理账户映射到 4 个 brand
 * 类型实例（这是 Phase 8 Sprint E 多 Engine Port 设计的延续）。
 */
export type LiquidationInput = {
  /** 业务案件标识（与 LiquidationCase.id 一致；用于审计追踪） */
  readonly caseId: string;
  /** 保证金账户标识（MarginEngine.releaseMargin 入参） */
  readonly marginAccountId: MarginAccountId;
  /** 持仓账户标识（PositionEngine.listOpenPositions 入参） */
  readonly positionAccountId: PositionAccountId;
  /** 撮合账户标识（MatchEngine.placeOrder 入参） */
  readonly matchAccountId: MatchAccountId;
  /** 资金账户标识（FundEngine.transferFund 源账户） */
  readonly fundSourceAccountId: FundAccountId;
  /** 标的合约符号（fetch-mark-price + place-order 共用） */
  readonly symbol: string;
  /** 保证金币种 */
  readonly marginCurrency: MarginCurrency;
  /** 资金币种（与 marginCurrency 可能相同也可能不同——业务决定） */
  readonly fundCurrency: FundCurrency;
  /** 待释放的保证金锁 ID（来自前序 lockMargin 调用） */
  readonly marginLockId: MarginLockId;
  /** 资金清算目标账户（保险资金池或损失账户） */
  readonly fundDestinationAccountId: FundAccountId;
  /** 资金清算金额（FundEngine.transferFund 入参） */
  readonly fundAmount: FundAmount;
  /** 平仓订单方向（与现有持仓方向相反） */
  readonly closeOrderSide: OrderSide;
  /** 平仓订单数量（与现有持仓 size 一致） */
  readonly closeOrderQuantity: number;
  /** 触发原因 domain moniker（如 "margin_below_maintenance" / "forced_close"） */
  readonly triggerReason: string;
};

/**
 * Liquidation Saga 业务输出（runSaga 成功时返回）。
 *
 * 含每个 step 的关键产出便于调用方做后续审计或衍生操作；不包含全部 Engine
 * 响应字段（可在 audit event payload 内查询）。
 */
export type LiquidationOutput = {
  readonly markPrice: number;
  readonly observedPositionIds: ReadonlyArray<PositionId>;
  readonly closedOrderId: OrderId;
  readonly releasedMarginAmount: MarginAmount;
  readonly fundTransferId: string;
};

export type LiquidationSaga = {
  /**
   * 启动一次 Liquidation Saga 并推进到终态。
   *
   * 失败模式：
   *   - 任一 step.execute 失败 → 触发逆序补偿（Step 7 链式继续）；终态
   *     映射 compensated / partially_compensated（Step 7 aggregate）
   *   - 整体超时（如 options.defaultSagaTimeoutMs > 0 且耗光） → Step 8
   *     触发 saga.timed_out + 终态映射
   *   - SagaStateStore.save 致命失败 → err(TQ-SAG-002)
   */
  runForCase(
    input: LiquidationInput
  ): Promise<Result<SagaResult<LiquidationOutput>, SagaPortError>>;
};

// ============================================================
// 内部：业务 step 执行的中间产物（在 SagaStep 之间通过 input 链式传递）
//
// 每个 step.execute 接收"前一 step 的 output"作为 input；通过 SagaStep
// 类型参数显式表达类型流转，但本模块为简化用 unknown 上下文 + step 内部
// 显式 cast（与 saga-orchestrator.contract.test.ts 风格一致——业务 Saga
// step 集合是局部组装，不需要 SagaStep 全泛型展开）。
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

// ============================================================
// 错误转译（§6.5 纪律延续）
// ============================================================
//
// 把 5 业务 Engine 各自的 *EnginePortError（含 code / message / context）
// 转译为 SagaPortError（code / sagaId / stepName / message / cause?）。
// **严禁原文携带**：HTTP 状态 / 网络异常文本 / 下游 SQL 异常。
// engineError.code 已是领域 moniker（TQ-INF-* / TQ-CON-*），但 SagaPortError
// 的 code 限定 TQ-SAG-*——此处统一映射为 TQ-SAG-002 SAGA_STEP_EXECUTION_FAILED
// （惯例 K"仅必需"——业务 Saga 不引入业务专属 saga 错误码；R3 下限）。
const translateEngineError = (
  engineError: { readonly code: string; readonly message: string },
  sagaId: SagaInvocation<unknown>["sagaId"],
  stepName: string
): SagaPortError => ({
  code: "TQ-SAG-002",
  sagaId,
  stepName,
  message: `${stepName} engine call failed: ${engineError.code}`,
  cause: { engineCode: engineError.code, engineMessage: engineError.message }
});

// ============================================================
// 5 SagaStep 工厂（每个 step 独立函数；显式 execute / compensate / name）
//
// 命名约定：build<StepName>Step(ports, input, sagaId)。
// compensationContext 必须可序列化（《§4.4》）；本模块用 plain object。
//
// 每个 step.execute 仅做"业务请求 → Engine 调用 → 响应解析"三步翻译——
// 不实现重试 / 超时 / 熔断（Engine 已封装；Saga Orchestrator 已封装）。
// ============================================================

type StepCtx = {
  readonly input: LiquidationInput;
  readonly idempotencyKey: string;
};

/**
 * Step 1: fetch-mark-price。
 *
 * 拉取标的合约的标记价（只读操作；compensate noop）。
 * compensate 显式声明（非省略；G12 要求）。
 */
const buildFetchMarkPriceStep = (
  ports: LiquidationSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "fetch-mark-price",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.markPrice.queryMarkPrice({
      symbol: ctx.input.symbol,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "fetch-mark-price"));
    }
    const exec: SagaStepExecution<{ markPrice: number }, { kind: "noop"; stepName: string }> = {
      output: { markPrice: result.value.markPrice as unknown as number },
      compensationContext: { kind: "noop", stepName: "fetch-mark-price" }
    };
    return ok(exec);
  },
  // 只读 step；compensate 显式 noop（《§4.1》read-only Step 显式空体）
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 2: list-open-positions。
 *
 * 查询当前账户的持仓列表（只读操作；compensate noop）。
 * 输出 positions[] 供后续 submit-close-orders 使用。
 */
const buildListPositionsStep = (
  ports: LiquidationSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "list-open-positions",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.position.listOpenPositions({
      accountId: ctx.input.positionAccountId,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "list-open-positions"));
    }
    const positionIds = result.value.positions.map(p => p.positionId);
    const exec: SagaStepExecution<
      { positionIds: ReadonlyArray<PositionId> },
      { kind: "noop"; stepName: string }
    > = {
      output: { positionIds },
      compensationContext: { kind: "noop", stepName: "list-open-positions" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 3: submit-close-orders。
 *
 * 提交平仓订单（写操作；compensate cancelOrder 反向）。
 * **关键**：此步是"对资金/持仓产生外部副作用"的第一步——补偿正确性最重要。
 *
 * compensationContext 含订单 ID 让 cancelOrder 反向调用幂等可重试。
 */
const buildSubmitCloseOrdersStep = (
  ports: LiquidationSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "submit-close-orders",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.match.placeOrder({
      accountId: ctx.input.matchAccountId,
      symbol: ctx.input.symbol,
      side: ctx.input.closeOrderSide,
      type: "market", // 强平用市价单确保成交
      quantity: ctx.input.closeOrderQuantity,
      idempotencyKey: `${ctx.idempotencyKey}:close-order`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "submit-close-orders"));
    }
    const exec: SagaStepExecution<
      { orderId: OrderId },
      { kind: "cancel-order"; orderId: OrderId }
    > = {
      output: { orderId: result.value.orderId },
      compensationContext: {
        kind: "cancel-order",
        orderId: result.value.orderId
      }
    };
    return ok(exec);
  },
  async compensate(compensationContext, sagaContext: SagaContext) {
    const ctxData = compensationContext as { kind: string; orderId: OrderId };
    if (ctxData.kind !== "cancel-order") {
      return ok(undefined); // 防御性：上下文格式异常时静默跳过
    }
    const result = await ports.match.cancelOrder({
      orderId: ctxData.orderId,
      idempotencyKey: `${ctx.idempotencyKey}:cancel-${ctxData.orderId}`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "submit-close-orders.compensate")
      );
    }
    return ok(undefined);
  }
});

/**
 * Step 4: release-margin。
 *
 * 释放保证金锁定（写操作；compensate lockMargin 反向重新锁定）。
 * compensationContext 含 lockId / amount / currency 让 lockMargin 反向重建。
 */
const buildReleaseMarginStep = (
  ports: LiquidationSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "release-margin",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.margin.releaseMargin({
      lockId: ctx.input.marginLockId,
      idempotencyKey: `${ctx.idempotencyKey}:release-margin`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "release-margin"));
    }
    const exec: SagaStepExecution<
      { releasedAmount: MarginAmount },
      {
        kind: "relock-margin";
        accountId: MarginAccountId;
        currency: MarginCurrency;
        amount: MarginAmount;
      }
    > = {
      output: { releasedAmount: result.value.releasedAmount },
      compensationContext: {
        kind: "relock-margin",
        accountId: ctx.input.marginAccountId,
        currency: ctx.input.marginCurrency,
        amount: result.value.releasedAmount
      }
    };
    return ok(exec);
  },
  async compensate(compensationContext, sagaContext: SagaContext) {
    const ctxData = compensationContext as {
      kind: string;
      accountId: MarginAccountId;
      currency: MarginCurrency;
      amount: MarginAmount;
    };
    if (ctxData.kind !== "relock-margin") {
      return ok(undefined);
    }
    const result = await ports.margin.lockMargin({
      accountId: ctxData.accountId,
      currency: ctxData.currency,
      amount: ctxData.amount,
      idempotencyKey: `${ctx.idempotencyKey}:relock-margin`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "release-margin.compensate")
      );
    }
    return ok(undefined);
  }
});

/**
 * Step 5: settle-fund-transfer。
 *
 * 资金清算（写操作；compensate transferFund 反向调用）。
 * compensationContext 含 from/to/amount 让反向 transfer 重建。
 */
const buildSettleFundTransferStep = (
  ports: LiquidationSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "settle-fund-transfer",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.fund.transferFund({
      fromAccountId: ctx.input.fundSourceAccountId,
      toAccountId: ctx.input.fundDestinationAccountId,
      currency: ctx.input.fundCurrency,
      amount: ctx.input.fundAmount,
      idempotencyKey: `${ctx.idempotencyKey}:settle-fund`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "settle-fund-transfer"));
    }
    const exec: SagaStepExecution<
      { transferId: string },
      {
        kind: "reverse-transfer";
        fromAccountId: FundAccountId;
        toAccountId: FundAccountId;
        currency: FundCurrency;
        amount: FundAmount;
      }
    > = {
      output: { transferId: result.value.transferId as unknown as string },
      compensationContext: {
        kind: "reverse-transfer",
        // 反向：源 / 目的对调
        fromAccountId: ctx.input.fundDestinationAccountId,
        toAccountId: ctx.input.fundSourceAccountId,
        currency: ctx.input.fundCurrency,
        amount: ctx.input.fundAmount
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
    if (ctxData.kind !== "reverse-transfer") {
      return ok(undefined);
    }
    const result = await ports.fund.transferFund({
      fromAccountId: ctxData.fromAccountId,
      toAccountId: ctxData.toAccountId,
      currency: ctxData.currency,
      amount: ctxData.amount,
      idempotencyKey: `${ctx.idempotencyKey}:reverse-fund`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "settle-fund-transfer.compensate")
      );
    }
    return ok(undefined);
  }
});

// ============================================================
// 工厂闭包（裁决 4 I）
// ============================================================

let invocationCounter = 0;
const generateInvocationStamp = (): string => {
  invocationCounter += 1;
  return `${Date.now()}-${invocationCounter}`;
};

export const createLiquidationSaga = (
  ports: LiquidationSagaPorts,
  options: LiquidationSagaOptions = {}
): LiquidationSaga => {
  // 内部组装 SagaOrchestrator（消费而非修改；编排器对本模块零侵入）
  // exactOptionalPropertyTypes 严格模式：用 spread 仅展开实际定义的字段；
  // SagaOrchestratorOptions 各字段是 readonly，构造时一次性给定（不能后置赋值）
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
    input: LiquidationInput
  ): Promise<Result<SagaResult<LiquidationOutput>, SagaPortError>> => {
    const stamp = generateInvocationStamp();
    const idempotencyKey = `liquidation:${input.caseId}:${stamp}`;

    const ctx: StepCtx = { input, idempotencyKey };

    // 5 业务 step 严格顺序构造（业务流程图详见 docs/phase9/10 §D）
    const steps: ReadonlyArray<AnyStep> = [
      buildFetchMarkPriceStep(ports, ctx),
      buildListPositionsStep(ports, ctx),
      buildSubmitCloseOrdersStep(ports, ctx),
      buildReleaseMarginStep(ports, ctx),
      buildSettleFundTransferStep(ports, ctx)
    ];

    const invocation: SagaInvocation<unknown> = {
      sagaId: ("liquidation-saga-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["sagaId"],
      traceId: ("trace-liquidation-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["traceId"],
      correlationId: ("corr-liquidation-" + input.caseId) as SagaInvocation<unknown>["correlationId"],
      initialInput: undefined,
      // 默认 0 表示无 saga 级整体超时；options.defaultSagaTimeoutMs 优先级见 Step 8
      sagaTimeoutMs: 0
    };

    return orchestrator.runSaga<LiquidationOutput>(invocation, steps);
  };

  return { runForCase };
};
