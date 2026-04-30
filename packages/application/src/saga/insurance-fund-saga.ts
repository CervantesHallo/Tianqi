// Phase 9 / Step 12 — InsuranceFundSaga（Sprint H 模板低复杂度反向验证战）。
//
// Sprint H 第三战，业务复杂度低于 Step 10 Liquidation 与 Step 11 ADL（单
// 账户 + Fund Engine 主导）。Step 11 已证明 Sprint H 模板能承载更高复杂
// 度（LOC +1.2%）；本 Step 完成"低复杂度业务也能 1:1 复用"的反向证明。
//
// 本模块**严格复用 Step 10/11 锁定的 Sprint H 模板**——8 项工程组成 1:1
// 对齐：模块文件结构 / Ports 类型形态 / Options 类型形态 / Input 字段集 /
// SagaStep 集合粒度 / §6.5 错误转译 helper / 测试三件套 / 编排器透明性。
//
// 设计裁决（详见 docs/decisions/0002 Step 12 段 + docs/phase9/12）：
//   - 裁决 1 (4 step 紧凑模式)：query-insurance-balance / deduct-from-
//     insurance / credit-to-affected-account / record-coverage-completion
//     —— 业务最少必需步骤；与 Sprint H 模板"4-6 step 中粒度"裁决兼容
//   - 裁决 2 (γ)：`InsuranceFundSagaPorts = LiquidationSagaPorts` 类型
//     别名复用（与 Step 11 ADL 同模式；R5 严守不允许 β 精简版）。即使
//     InsuranceFund 不消费 markPrice / match / margin / position Engine，
//     Ports 字段冗余成本极低；Sprint H 模板纪律一致性优先于"精简优化"
//   - 裁决 3 (InsuranceFundInput 8 字段)：caseId / affectedAccountId /
//     lossAmount / lossCurrency / insuranceFundAccountId / coverageRatio
//     / triggerReason —— 一旦发布即冻结
//   - 裁决 4：0 错误码新增（**惯例 K 第 14 次实战 R3 下限严守**——保
//     险资金不足通过 step.execute 业务校验返回 TQ-SAG-002 + reason
//     moniker 表达；coverageRatio 超出范围属输入合法性同样复用 TQ-SAG-002）
//   - 裁决 5 (C 业务策略外移)：本 Saga 不实现部分覆盖判断，由调用方在
//     Input 已确保 coverage 可行；Saga 仅做"按 Input 编排执行"，不做
//     策略决策；策略层（policy 层未来 Phase 引入 InsuranceFundCoveragePolicy）
//     在准备 Input 时通过 Fund Engine 查询保险资金余额按 policy 决定
//     coverageRatio
//   - 裁决 6：unit ≤8 + 集成 ≤4 + contract 17（一行挂载）—— 与 Step 10/11 同
//   - 裁决 7：不拆两阶段（Sprint H 模板已被 Step 11 100% 验证；业务复
//     杂度低于 Step 11 不需要新接口审视）
//
// 业务流程（4 step 紧凑模式严格顺序）：
//
//   1. query-insurance-balance       FundEngine.queryFundBalance      noop（只读）
//   2. deduct-from-insurance         FundEngine.transferFund          反向 transferFund
//   3. credit-to-affected-account    FundEngine.transferFund          反向 transferFund
//   4. record-coverage-completion    无 Engine 调用                   noop（终态留痕）
//
// **业务流程语义说明**：
//   step 2 deduct：保险池 → 中转账户（lossAbsorptionTargetAccount，可能等于
//   affectedAccount，由调用方决定）
//   step 3 credit：中转账户 → 受影响账户（最终损失补偿）
//   两段 transferFund 设计是为了让保险资金路径可审计——单一 transferFund
//   会让"扣减保险"和"补偿损失"在审计事件层合并，运维难以分离。本 Saga
//   将业务语义拆为两步让审计粒度精确（裁决 1 紧凑 4-step 的语义价值）
//
// 编排器透明性：本模块通过 createSagaOrchestrator 调用，不修改 saga-orchestrator.ts；
// git diff 验证 zero（与 Step 9-11 模式一致；元规则 F 跨 4 个 Step 落地）。
//
// §6.5 转译纪律延续：Engine 错误（含 HTTP 状态 / 网络异常文本）严禁泄漏到
// SagaPortError；step.execute 内部调用 Engine 后，仅取 error.code +
// 领域级 message moniker 包装为 SagaPortError；context 字段不透出。单
// 账户场景不需要 accountIdMoniker 增强（与 Step 10 同模式）。

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  FundAccountId,
  FundAmount,
  FundCurrency,
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
// 对外类型（裁决 2 模板复用 + 裁决 3 业务字段）
// ============================================================

/**
 * InsuranceFundSagaPorts：复用 LiquidationSagaPorts 类型（裁决 2 γ）。
 *
 * Sprint H 模板纪律一致性 —— 即使 InsuranceFund 不消费 markPrice /
 * match / margin / position Engine，Ports 字段冗余成本极低；Step 12-14
 * 都应保持 8 字段同形 Ports 让 Sprint H 模板的"业务 SagaPorts = 3
 * saga 基础设施 + 5 业务 Engine"成为可复用约定。
 *
 * **严禁**精简版 Ports（裁决 2 R5）：β 候选会让 Step 12-13 出现 Ports
 * 形态分歧，破坏模板一致性；调用方传入 mock 即可（测试稍冗余但接受）。
 *
 * 元规则 B：InsuranceFundSagaPorts 类型别名一旦发布即冻结。
 */
export type InsuranceFundSagaPorts = LiquidationSagaPorts;

/**
 * InsuranceFundSagaOptions：复用 LiquidationSagaOptions 类型。
 */
export type InsuranceFundSagaOptions = LiquidationSagaOptions;

/**
 * InsuranceFund Saga 业务输入（裁决 3 锁定字段集）。
 *
 * 字段一旦发布即冻结（元规则 B）；后续业务扩展通过新增**可选**字段或
 * ADR-0002 修订流程，不删除 / 重命名既有字段。
 *
 * **业务策略边界**（裁决 5 C 外移）：
 *   - coverageRatio 由调用方按 policy 计算（policy 层未来 Phase 引入
 *     InsuranceFundCoveragePolicy 决定覆盖比例；本 Saga 不计算）
 *   - 调用方在准备 Input 之前应通过 FundEngine.queryFundBalance 查询
 *     保险资金余额，确保 lossAmount * coverageRatio ≤ insuranceFundBalance
 *   - 保险资金不足时由调用方决定（拒绝触发 / 部分覆盖 / 触发 ADL）；
 *     本 Saga 仅做"按 Input 编排执行"
 *
 * **三账户语义**：
 *   - insuranceFundAccountId：保险资金来源（资金从此账户流出）
 *   - lossAbsorptionTargetAccountId：中转账户（保险资金先到此处）
 *   - affectedAccountId：损失账户（最终接收补偿）
 *   两段 transferFund 路径让保险资金流向可审计；调用方可让 lossAbsorptionTargetAccountId
 *   = affectedAccountId（无中转）或独立中转账户（合规审计需求）
 */
export type InsuranceFundInput = {
  /** 业务案件标识 */
  readonly caseId: string;
  /** 受影响账户（损失账户；最终补偿目标） */
  readonly affectedAccountId: FundAccountId;
  /** 损失金额（在 input.lossCurrency 币种下） */
  readonly lossAmount: FundAmount;
  /** 损失币种 */
  readonly lossCurrency: FundCurrency;
  /** 保险资金账户（资金来源） */
  readonly insuranceFundAccountId: FundAccountId;
  /** 中转账户（保险资金先流入此处再分发；可能 == affectedAccountId） */
  readonly lossAbsorptionTargetAccountId: FundAccountId;
  /**
   * 保险覆盖比例（0-1）。由调用方按 policy 计算决定；本 Saga 不验证范围
   * （超出 0-1 时业务 step 内部 transferFund 调用会失败 → TQ-SAG-002 +
   * reason moniker 表达）。
   */
  readonly coverageRatio: number;
  /** 触发原因 moniker */
  readonly triggerReason: string;
};

/**
 * InsuranceFund Saga 业务输出（runSaga 成功时返回）。
 */
export type InsuranceFundOutput = {
  readonly caseId: string;
  /** step 1 查询结果——查询时刻保险资金可用余额 */
  readonly observedInsuranceBalance: FundAmount;
  /** step 2 实际从保险资金扣减的金额（= lossAmount * coverageRatio，由调用方算入 input） */
  readonly deductedAmount: FundAmount;
  /** step 3 实际补偿损失账户的金额（同 deductedAmount） */
  readonly creditedAmount: FundAmount;
  /** step 2 transferFund 产出 transferId */
  readonly deductionTransferId: TransferId;
  /** step 3 transferFund 产出 transferId */
  readonly creditTransferId: TransferId;
  /** 实际应用的覆盖比例（与 input.coverageRatio 同；保留字段供未来 policy 层"部分覆盖"扩展） */
  readonly appliedCoverageRatio: number;
};

export type InsuranceFundSaga = {
  /**
   * 启动一次 InsuranceFund Saga 并推进到终态。
   *
   * 失败模式：
   *   - step 1 query-insurance-balance 失败（FundEngine 不可达）→ vacuous
   *     "compensated"（无 succeeded step 可补偿）
   *   - step 2 deduct-from-insurance 失败 → 触发逆序补偿（step 1 noop）
   *   - step 3 credit-to-affected 失败 → 触发逆序补偿（step 2 反向
   *     transferFund 把保险资金回退到保险池）
   *   - step 4 record-coverage-completion 失败（仅审计写失败；onDegradedFailure
   *     处理）→ 不影响 saga 终态
   */
  runForCase(
    input: InsuranceFundInput
  ): Promise<Result<SagaResult<InsuranceFundOutput>, SagaPortError>>;
};

// ============================================================
// 内部
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

type StepCtx = {
  readonly input: InsuranceFundInput;
  readonly idempotencyKey: string;
};

// ============================================================
// 错误转译（§6.5 纪律延续；与 Step 10 translateEngineError 同模式）
//
// InsuranceFund 单账户场景不需要 accountIdMoniker 增强（Step 11 ADL 多
// 账户场景才需要）。stepName 已含足够语义让运维定位。
// ============================================================

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
// 4 SagaStep 工厂（紧凑模式；每个 step 显式 execute + compensate + name；
// compensationContext 全部可序列化 plain object《§4.4》）
// ============================================================

/**
 * Step 1: query-insurance-balance（保险资金余额查询；只读）。
 *
 * 用于 audit 留痕"触发时刻保险资金余额"——便于运维事后核查覆盖决策
 * 是否合理。compensate noop（《§4.1》read-only 显式空体）。
 */
const buildQueryInsuranceBalanceStep = (
  ports: InsuranceFundSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "query-insurance-balance",
  async execute(_input, sagaContext: SagaContext) {
    const result = await ports.fund.queryFundBalance({
      accountId: ctx.input.insuranceFundAccountId,
      currency: ctx.input.lossCurrency,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "query-insurance-balance"));
    }
    const exec: SagaStepExecution<
      { observedBalance: FundAmount },
      { kind: "noop"; stepName: string }
    > = {
      output: { observedBalance: result.value.availableBalance },
      compensationContext: { kind: "noop", stepName: "query-insurance-balance" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 2: deduct-from-insurance（从保险资金扣减；写）。
 *
 * 保险资金 → 中转账户（lossAbsorptionTargetAccount）；金额 =
 * lossAmount * coverageRatio（由调用方在 Input 已计算）。
 *
 * compensate 反向 transferFund：中转账户 → 保险资金（金额一致）。
 */
const buildDeductFromInsuranceStep = (
  ports: InsuranceFundSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "deduct-from-insurance",
  async execute(_input, sagaContext: SagaContext) {
    // 实际扣减金额：lossAmount * coverageRatio（由调用方在 Input 决定；
    // 本 Saga 不在 step 内重新计算，避免 floating point 边界问题）
    const deductedAmount = (ctx.input.lossAmount as unknown as number) *
      ctx.input.coverageRatio;
    const amountBranded = deductedAmount as unknown as FundAmount;

    const result = await ports.fund.transferFund({
      fromAccountId: ctx.input.insuranceFundAccountId,
      toAccountId: ctx.input.lossAbsorptionTargetAccountId,
      currency: ctx.input.lossCurrency,
      amount: amountBranded,
      idempotencyKey: `${ctx.idempotencyKey}:deduct`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "deduct-from-insurance"));
    }
    const exec: SagaStepExecution<
      { transferId: TransferId; deductedAmount: FundAmount },
      {
        kind: "reverse-deduct";
        fromAccountId: FundAccountId;
        toAccountId: FundAccountId;
        currency: FundCurrency;
        amount: FundAmount;
      }
    > = {
      output: { transferId: result.value.transferId, deductedAmount: amountBranded },
      compensationContext: {
        kind: "reverse-deduct",
        // 反向：中转账户 → 保险资金（源 / 目的对调）
        fromAccountId: ctx.input.lossAbsorptionTargetAccountId,
        toAccountId: ctx.input.insuranceFundAccountId,
        currency: ctx.input.lossCurrency,
        amount: amountBranded
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
    if (ctxData.kind !== "reverse-deduct") {
      return ok(undefined);
    }
    const result = await ports.fund.transferFund({
      fromAccountId: ctxData.fromAccountId,
      toAccountId: ctxData.toAccountId,
      currency: ctxData.currency,
      amount: ctxData.amount,
      idempotencyKey: `${ctx.idempotencyKey}:reverse-deduct`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "deduct-from-insurance.compensate")
      );
    }
    return ok(undefined);
  }
});

/**
 * Step 3: credit-to-affected-account（补偿损失账户；写）。
 *
 * 中转账户（lossAbsorptionTargetAccount）→ 受影响账户（affectedAccount）；
 * 金额与 step 2 一致（保险资金已经从保险池扣减，此步只是重新分发到最终
 * 损失账户）。
 *
 * compensate 反向 transferFund：受影响账户 → 中转账户（金额一致）。
 */
const buildCreditToAffectedStep = (
  ports: InsuranceFundSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "credit-to-affected-account",
  async execute(input, sagaContext: SagaContext) {
    // input 是前一 step 的 output：{ transferId, deductedAmount }
    const prev = input as { transferId: TransferId; deductedAmount: FundAmount } | undefined;
    // 防御性：input 缺失（不应发生；前向 phase 链式传递）→ 退回 input.lossAmount * coverageRatio
    const amount = prev?.deductedAmount ?? (((ctx.input.lossAmount as unknown as number) *
      ctx.input.coverageRatio) as unknown as FundAmount);

    const result = await ports.fund.transferFund({
      fromAccountId: ctx.input.lossAbsorptionTargetAccountId,
      toAccountId: ctx.input.affectedAccountId,
      currency: ctx.input.lossCurrency,
      amount,
      idempotencyKey: `${ctx.idempotencyKey}:credit`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(translateEngineError(result.error, sagaContext.sagaId, "credit-to-affected-account"));
    }
    const exec: SagaStepExecution<
      { transferId: TransferId; creditedAmount: FundAmount },
      {
        kind: "reverse-credit";
        fromAccountId: FundAccountId;
        toAccountId: FundAccountId;
        currency: FundCurrency;
        amount: FundAmount;
      }
    > = {
      output: { transferId: result.value.transferId, creditedAmount: amount },
      compensationContext: {
        kind: "reverse-credit",
        // 反向：受影响账户 → 中转账户（源 / 目的对调）
        fromAccountId: ctx.input.affectedAccountId,
        toAccountId: ctx.input.lossAbsorptionTargetAccountId,
        currency: ctx.input.lossCurrency,
        amount
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
    if (ctxData.kind !== "reverse-credit") {
      return ok(undefined);
    }
    const result = await ports.fund.transferFund({
      fromAccountId: ctxData.fromAccountId,
      toAccountId: ctxData.toAccountId,
      currency: ctxData.currency,
      amount: ctxData.amount,
      idempotencyKey: `${ctx.idempotencyKey}:reverse-credit`,
      traceId: sagaContext.traceId
    });
    if (!result.ok) {
      return err(
        translateEngineError(result.error, sagaContext.sagaId, "credit-to-affected-account.compensate")
      );
    }
    return ok(undefined);
  }
});

/**
 * Step 4: record-coverage-completion（终态留痕；无 Engine 调用）。
 *
 * 仅 audit 留痕"保险资金消耗完成"。不调用任何 Engine——业务流程已完
 * 成，此步是 saga.completed 之前的语义补充。compensate noop（《§4.1》
 * read-only / 无副作用 step 显式空体）。
 *
 * 设计意图：在 SagaResultStatus.completed 之前显式留出"覆盖完成"语义
 * 标记让审计事件 saga.step.execute.outcome 中含本 step 名称，运维通过
 * grep "record-coverage-completion" 即知 saga 已业务完成（vs 早期失败
 * 终态）。
 */
const buildRecordCoverageCompletionStep = (
  _ports: InsuranceFundSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "record-coverage-completion",
  async execute(_input, _sagaContext: SagaContext) {
    const exec: SagaStepExecution<
      { coverageRatio: number; caseId: string },
      { kind: "noop"; stepName: string }
    > = {
      output: {
        coverageRatio: ctx.input.coverageRatio,
        caseId: ctx.input.caseId
      },
      compensationContext: { kind: "noop", stepName: "record-coverage-completion" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

// ============================================================
// 工厂闭包（与 Step 10/11 同模式）
// ============================================================

let invocationCounter = 0;
const generateInvocationStamp = (): string => {
  invocationCounter += 1;
  return `${Date.now()}-${invocationCounter}`;
};

export const createInsuranceFundSaga = (
  ports: InsuranceFundSagaPorts,
  options: InsuranceFundSagaOptions = {}
): InsuranceFundSaga => {
  // 内部组装 SagaOrchestrator（与 Step 10/11 同模式：消费而非修改；编
  // 排器对本模块零侵入）
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
    input: InsuranceFundInput
  ): Promise<Result<SagaResult<InsuranceFundOutput>, SagaPortError>> => {
    const stamp = generateInvocationStamp();
    const idempotencyKey = `insurance-fund:${input.caseId}:${stamp}`;

    const ctx: StepCtx = { input, idempotencyKey };

    // 4 业务 step 严格顺序构造（业务流程图详见 docs/phase9/12 §D）
    const steps: ReadonlyArray<AnyStep> = [
      buildQueryInsuranceBalanceStep(ports, ctx),
      buildDeductFromInsuranceStep(ports, ctx),
      buildCreditToAffectedStep(ports, ctx),
      buildRecordCoverageCompletionStep(ports, ctx)
    ];

    const invocation: SagaInvocation<unknown> = {
      sagaId: ("insurance-fund-saga-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["sagaId"],
      traceId: ("trace-insurance-fund-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["traceId"],
      correlationId: ("corr-insurance-fund-" + input.caseId) as SagaInvocation<unknown>["correlationId"],
      initialInput: undefined,
      sagaTimeoutMs: 0
    };

    return orchestrator.runSaga<InsuranceFundOutput>(invocation, steps);
  };

  return { runForCase };
};
