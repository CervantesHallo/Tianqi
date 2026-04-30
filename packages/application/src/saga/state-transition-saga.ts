// Phase 9 / Step 13 — StateTransitionSaga（Sprint H 模板纪律极限考验战）。
//
// Sprint H 第四战，业务复杂度可能比 Step 12 InsuranceFund 更低（无业务
// Engine 实际消费 / 仅状态字段变更 + 审计触发）。这是 Sprint H 模板纪律
// 的**极限考验**：当业务复杂度低到"可能不需要业务 Engine 调用"时，模
// 板一致性是否仍然守得住。
//
// 本模块**严格复用 Step 10/11/12 锁定的 Sprint H 模板** —— 8 项工程组成
// 1:1 对齐：模块文件结构 / Ports 类型形态 / Options 类型形态 / Input 字
// 段集 / SagaStep 集合粒度 / §6.5 错误转译 helper / 测试三件套 / 编排器
// 透明性。即使本 Saga 实际消费 Engine 数最少（按 preconditionChecks 列
// 表动态决定 0-N 个），Ports 注入 5 业务 Engine 字段冗余被显式接受为模
// 板一致性代价（裁决 2 R5 严守不允许 β 精简版）。
//
// 设计裁决（详见 docs/decisions/0002 Step 13 段 + docs/phase9/13）：
//   - 裁决 1 (4 step 紧凑)：validate-current-state / validate-precondition
//     / persist-new-state / record-transition-completion —— 与 Step 12
//     紧凑模式一致；前置校验作为独立 step 让"业务前置条件不满足"有清
//     晰失败点
//   - 裁决 2 (γ 类型别名)：`StateTransitionSagaPorts = LiquidationSagaPorts`
//     （与 Step 11/12 同模式）—— **R5 严守不允许 β 精简版**；Sprint H
//     模板纪律极限考验通过
//   - 裁决 3 (StateTransitionInput 7 字段 + Output 5 字段)：caseId /
//     targetAction / currentExpectedState / reason / actor / configVersion /
//     preconditionChecks? —— 一旦发布即冻结
//   - 裁决 4 (A domain 层消费)：消费 domain 层既有 CaseState / TransitionAction
//     enum + 在 step 2 内部用 stateTransitionRules 数据表达合法性校验；
//     不修改 domain 层任何代码（《§4.8》编译期硬约束精神延续）
//   - 裁决 5：0 错误码新增（**惯例 K 第 15 次实战 R3 下限严守**——状态
//     转换非法 / 前置不匹配 / Engine 校验失败都通过 TQ-SAG-002 + reason
//     moniker 表达）
//   - 裁决 6：unit ≤8 + 集成 ≤4 + contract 17（一行挂载）
//   - 裁决 7：不拆两阶段（Sprint H 模板已被 Step 11/12 100% 双向验证）
//
// 业务流程（4 step 紧凑模式严格顺序）：
//
//   1. validate-current-state         无 Engine 调用            noop（输入合法性 + 状态机合法性校验）
//   2. validate-precondition          按 preconditionChecks 调  noop（动态消费 0-N 个 Engine）
//   3. persist-new-state              无 Engine 调用            revert-to-previous-state（状态写入 + audit；compensate 反向 audit）
//   4. record-transition-completion   无 Engine 调用            noop（终态留痕）
//
// **关键设计认知**：
//   StateTransitionSaga 不持有 RiskCase 实例（domain 层 RiskCaseStateMachine
//   class 需要 RiskCase 实例 + TransitionAction，而本 Saga 通过 Input 接
//   收 caseId + currentExpectedState + targetAction 三元组，不依赖 case
//   repository）。状态机合法性校验通过 stateTransitionRules 数据表达
//   （从 domain 层 transitionRules 派生但本 Saga 内部独立维护副本——避
//   免修改 domain 层 export 表面；元规则 B 严守）。
//
//   "持久化新状态"通过 audit 事件 saga.step.execute.outcome 含 newState
//   payload 让运维侧 audit event store 重建状态机历史；本 Saga 不直接调
//   用 case repository（Phase 1-7 没有此 Port，本 Step 不能新建）。
//
// 编排器透明性：本模块通过 createSagaOrchestrator 调用，不修改 saga-
// orchestrator.ts；git diff 验证 zero（与 Step 9-12 模式一致；元规则 F
// 跨 5 个 Step 落地）。
//
// §6.5 转译纪律延续：Engine 错误（含 HTTP 状态 / 网络异常文本）严禁泄
// 漏到 SagaPortError；step.execute 内部调用 Engine 后，仅取 error.code +
// 领域级 message moniker 包装为 SagaPortError；context 字段不透出。

import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  FundAccountId,
  FundCurrency,
  MarginAccountId,
  MarginCurrency,
  PositionAccountId,
  SagaContext,
  SagaInvocation,
  SagaPortError,
  SagaResult,
  SagaStep,
  SagaStepExecution
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
 * StateTransitionSagaPorts：复用 LiquidationSagaPorts 类型（裁决 2 γ）。
 *
 * **R5 严守不允许 β 精简版** —— 即使 StateTransitionSaga 实际消费 Engine
 * 数最少（按 preconditionChecks 动态决定 0-N 个），Sprint H 模板纪律一
 * 致性优先于"精简优化"；mock Engine 字段冗余被显式接受为模板代价。
 *
 * 元规则 B：StateTransitionSagaPorts 类型别名一旦发布即冻结。
 */
export type StateTransitionSagaPorts = LiquidationSagaPorts;

/**
 * StateTransitionSagaOptions：复用 LiquidationSagaOptions 类型。
 */
export type StateTransitionSagaOptions = LiquidationSagaOptions;

/**
 * 业务前置校验项（按业务场景动态决定）。
 *
 * 调用方在 Input.preconditionChecks 中按 kind 列出待校验业务前置条件；
 * step 2 validate-precondition 按列表顺序逐个调用对应 Engine 校验；任
 * 一失败立即整个 step 失败（与 Step 11 ADL C-fail-fast 同模式）。
 *
 * 三种支持的 kind（一旦发布即冻结）：
 *   - "position-closed": 校验某账户某 symbol 持仓已平仓（size === 0）
 *   - "margin-released": 校验某账户保证金已释放（lockedMargin === 0）
 *   - "fund-settled": 校验某账户资金已结算（参考金额已转账完毕）
 *
 * 后续业务扩展通过 ADR-0002 修订流程引入新 kind；不在 Saga 内部硬编码
 * "kind 字符串字面量是穷举的"——SagaStep 内部用 if-elseif 处理已知
 * kind，未知 kind 跳过（不阻塞流程；运维侧通过 audit event 发现未知 kind）。
 */
export type PreconditionCheck =
  | {
      readonly kind: "position-closed";
      readonly accountId: PositionAccountId;
      readonly symbol: string;
    }
  | {
      readonly kind: "margin-released";
      readonly accountId: MarginAccountId;
      readonly currency: MarginCurrency;
    }
  | {
      readonly kind: "fund-settled";
      readonly accountId: FundAccountId;
      readonly currency: FundCurrency;
      /** 期望可用余额（>= 此值视为已结算；通常为 0 或最小阈值） */
      readonly expectedMinimumAvailableBalance: number;
    };

/**
 * StateTransition Saga 业务输入（裁决 3 锁定字段集）。
 *
 * 字段一旦发布即冻结（元规则 B）。
 *
 * **三元组语义**（domain 层既有模式延续）：
 *   - caseId：业务案件标识
 *   - currentExpectedState：调用方观察到的当前状态（乐观锁）
 *   - targetAction：触发的转换动作（domain 层 TransitionAction 字符串）
 *
 * preconditionChecks 是可选业务前置校验列表；空数组 / undefined 时 step
 * 2 validate-precondition 直接 noop（不消费 Engine）。
 */
export type StateTransitionInput = {
  /** 业务案件标识 */
  readonly caseId: string;
  /** 触发的转换动作（来自 domain 层 TransitionAction enum 字符串） */
  readonly targetAction: string;
  /** 调用方观察到的当前状态（来自 domain 层 CaseState enum 字符串；乐观锁） */
  readonly currentExpectedState: string;
  /** 转换原因 moniker（domain 层 transitionGuard 校验非空） */
  readonly reason: string;
  /** 触发者标识（运维操作员 / 业务系统标识） */
  readonly actor: string;
  /** 配置版本（domain 层 transitionGuard 校验匹配） */
  readonly configVersion: string;
  /**
   * 业务前置校验列表（可选）；空 / undefined 时 step 2 noop。每项按
   * kind 调用对应 Engine 校验；C-fail-fast 任一失败立即 step 失败。
   */
  readonly preconditionChecks?: ReadonlyArray<PreconditionCheck>;
};

/**
 * StateTransition Saga 业务输出（runSaga 成功时返回）。
 */
export type StateTransitionOutput = {
  readonly caseId: string;
  /** 转换前状态（与 input.currentExpectedState 一致） */
  readonly previousState: string;
  /** 转换后状态（由 stateTransitionRules 决定） */
  readonly newState: string;
  /** 实际转换时刻（ISO-8601） */
  readonly transitionedAt: string;
  /** 实际执行的前置校验数（preconditionChecks.length；0 表示无校验） */
  readonly preconditionCheckCount: number;
};

export type StateTransitionSaga = {
  /**
   * 启动一次 StateTransition Saga 并推进到终态。
   *
   * 失败模式：
   *   - 状态转换非法（input.currentExpectedState + targetAction 在
   *     stateTransitionRules 内无对应规则）→ step 1 失败 → vacuous
   *     "compensated"
   *   - 业务前置校验失败（任一 PreconditionCheck Engine 调用失败 / 业
   *     务条件不满足）→ step 2 失败 → step 1 noop 反向（vacuous）
   *   - persist-new-state 失败（罕见；audit append 失败的降级路径不属
   *     此分支）→ step 2 noop 反向 + step 1 noop 反向
   */
  runForCase(
    input: StateTransitionInput
  ): Promise<Result<SagaResult<StateTransitionOutput>, SagaPortError>>;
};

// ============================================================
// 内部
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

type StepCtx = {
  readonly input: StateTransitionInput;
  readonly idempotencyKey: string;
};

// ============================================================
// 状态机合法转换规则（裁决 4 A domain 层消费）
//
// **本数据结构是 domain 层 transitionRules 的 Saga 侧副本**——不修改
// domain 层 export 表面；元规则 B 严守。如果未来 domain 层 transitionRules
// 变化，需要通过 ADR-0002 修订流程同步更新本副本（运维侧通过 unit it
// 检测漂移）。
//
// 与 domain 层 transition-action.ts + risk-case-state-machine.ts 一致。
// ============================================================

const stateTransitionRules: Readonly<Record<string, ReadonlyArray<{
  action: string;
  nextState: string;
}>>> = {
  Detected: [{ action: "StartValidation", nextState: "Validating" }],
  Validating: [{ action: "Classify", nextState: "Classified" }],
  Classified: [
    { action: "Close", nextState: "Closed" },
    { action: "StartLiquidation", nextState: "Liquidating" }
  ],
  Liquidating: [{ action: "StartFundAbsorption", nextState: "FundAbsorbing" }],
  FundAbsorbing: [{ action: "StartAdlEvaluation", nextState: "EvaluatingADL" }],
  EvaluatingADL: [{ action: "StartAdlPlanning", nextState: "PlanningADL" }],
  PlanningADL: [{ action: "StartAdlExecution", nextState: "ExecutingADL" }],
  ExecutingADL: [{ action: "Settle", nextState: "Settling" }],
  Settling: [{ action: "Close", nextState: "Closed" }]
};

/**
 * 终态转换规则（任意非终态可触发；与 domain 层 terminalTransitionRules
 * 一致）。
 */
const TERMINAL_TRANSITION_RULES: ReadonlyArray<{ action: string; nextState: string }> = [
  { action: "Fail", nextState: "Failed" },
  { action: "RequestManualIntervention", nextState: "ManualInterventionRequired" }
];

const TERMINAL_STATES: ReadonlySet<string> = new Set(["Closed", "Failed", "ManualInterventionRequired"]);

/**
 * 校验状态转换合法性 + 返回 nextState（裁决 4 A domain 层消费）。
 *
 * 不修改 domain 层任何代码；纯函数逻辑由 domain 层 transitionRules 数据
 * 派生。返回 null 表示非法转换。
 */
const resolveTargetState = (
  currentState: string,
  targetAction: string
): string | null => {
  if (TERMINAL_STATES.has(currentState)) {
    return null; // domain 层 terminal state 不允许任何转换
  }
  const rules = stateTransitionRules[currentState];
  if (rules !== undefined) {
    for (const rule of rules) {
      if (rule.action === targetAction) return rule.nextState;
    }
  }
  // 终态转换（任意非终态都可触发）
  for (const rule of TERMINAL_TRANSITION_RULES) {
    if (rule.action === targetAction) return rule.nextState;
  }
  return null;
};

// ============================================================
// 错误转译（§6.5 纪律延续；与 Step 10/12 translateEngineError 同模式）
// ============================================================

const translateEngineError = (
  engineError: { readonly code: string; readonly message: string },
  sagaId: SagaInvocation<unknown>["sagaId"],
  stepName: string,
  precheckKindMoniker?: string
): SagaPortError => ({
  code: "TQ-SAG-002",
  sagaId,
  stepName,
  message:
    precheckKindMoniker !== undefined
      ? `${stepName} engine call failed for ${precheckKindMoniker}: ${engineError.code}`
      : `${stepName} engine call failed: ${engineError.code}`,
  cause: { engineCode: engineError.code, engineMessage: engineError.message }
});

const buildBusinessError = (
  sagaId: SagaInvocation<unknown>["sagaId"],
  stepName: string,
  reason: string
): SagaPortError => ({
  code: "TQ-SAG-002",
  sagaId,
  stepName,
  message: `${stepName} business validation failed: ${reason}`
});

// ============================================================
// 4 SagaStep 工厂（紧凑模式；与 Step 10-12 模板对齐）
// ============================================================

/**
 * Step 1: validate-current-state（输入合法性 + 状态机转换合法性）。
 *
 * 验证：
 *   1. currentExpectedState 是 CaseState 合法值
 *   2. targetAction + currentExpectedState 组合在 stateTransitionRules
 *      或 TERMINAL_TRANSITION_RULES 内有对应规则
 *
 * 失败模式：reason moniker 表达：
 *   - "current_state_terminal": 当前状态是终态不允许转换
 *   - "transition_rule_not_found": 找不到对应转换规则
 *
 * compensate noop（只读）。
 */
const buildValidateCurrentStateStep = (
  _ports: StateTransitionSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "validate-current-state",
  async execute(_input, sagaContext: SagaContext) {
    const { currentExpectedState, targetAction } = ctx.input;
    const targetState = resolveTargetState(currentExpectedState, targetAction);
    if (targetState === null) {
      const reason = TERMINAL_STATES.has(currentExpectedState)
        ? "current_state_terminal"
        : "transition_rule_not_found";
      return err(buildBusinessError(sagaContext.sagaId, "validate-current-state", reason));
    }
    const exec: SagaStepExecution<
      { previousState: string; targetState: string },
      { kind: "noop"; stepName: string }
    > = {
      output: { previousState: currentExpectedState, targetState },
      compensationContext: { kind: "noop", stepName: "validate-current-state" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 2: validate-precondition（业务前置校验；按 preconditionChecks 列
 * 表动态消费 0-N 个业务 Engine）。
 *
 * 三种支持的 kind：
 *   - "position-closed": PositionEngine.queryPosition + verify size === 0
 *   - "margin-released": MarginEngine.queryMarginBalance + verify lockedMargin === 0
 *   - "fund-settled": FundEngine.queryFundBalance + verify availableBalance
 *     >= expectedMinimumAvailableBalance
 *
 * C-fail-fast：任一校验失败立即整个 step 失败（与 Step 11 ADL 同模式）。
 *
 * compensate noop（只读校验，无副作用需要回滚）。
 */
const buildValidatePreconditionStep = (
  ports: StateTransitionSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "validate-precondition",
  async execute(_input, sagaContext: SagaContext) {
    const checks = ctx.input.preconditionChecks ?? [];
    let executedCount = 0;
    for (const check of checks) {
      if (check.kind === "position-closed") {
        const result = await ports.position.queryPosition({
          accountId: check.accountId,
          symbol: check.symbol,
          traceId: sagaContext.traceId
        });
        if (!result.ok) {
          return err(
            translateEngineError(
              result.error,
              sagaContext.sagaId,
              "validate-precondition",
              `position-closed:${String(check.accountId)}`
            )
          );
        }
        // 业务校验：positionId === null OR size === 0 视为已平仓
        const responseValue = result.value;
        const positionSize = responseValue.size as unknown as number;
        if (responseValue.positionId !== null && positionSize !== 0) {
          return err(
            buildBusinessError(
              sagaContext.sagaId,
              "validate-precondition",
              `position_not_closed:${String(check.accountId)}`
            )
          );
        }
      } else if (check.kind === "margin-released") {
        const result = await ports.margin.queryMarginBalance({
          accountId: check.accountId,
          currency: check.currency,
          traceId: sagaContext.traceId
        });
        if (!result.ok) {
          return err(
            translateEngineError(
              result.error,
              sagaContext.sagaId,
              "validate-precondition",
              `margin-released:${String(check.accountId)}`
            )
          );
        }
        const lockedMargin = result.value.lockedMargin as unknown as number;
        if (lockedMargin !== 0) {
          return err(
            buildBusinessError(
              sagaContext.sagaId,
              "validate-precondition",
              `margin_not_released:${String(check.accountId)}`
            )
          );
        }
      } else if (check.kind === "fund-settled") {
        const result = await ports.fund.queryFundBalance({
          accountId: check.accountId,
          currency: check.currency,
          traceId: sagaContext.traceId
        });
        if (!result.ok) {
          return err(
            translateEngineError(
              result.error,
              sagaContext.sagaId,
              "validate-precondition",
              `fund-settled:${String(check.accountId)}`
            )
          );
        }
        const availableBalance = result.value.availableBalance as unknown as number;
        if (availableBalance < check.expectedMinimumAvailableBalance) {
          return err(
            buildBusinessError(
              sagaContext.sagaId,
              "validate-precondition",
              `fund_not_settled:${String(check.accountId)}`
            )
          );
        }
      }
      // 未知 kind 跳过（防御性；新 kind 通过 ADR 修订流程引入）
      executedCount += 1;
    }
    const exec: SagaStepExecution<
      { executedCheckCount: number },
      { kind: "noop"; stepName: string }
    > = {
      output: { executedCheckCount: executedCount },
      compensationContext: { kind: "noop", stepName: "validate-precondition" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

/**
 * Step 3: persist-new-state（状态写入 + audit 触发）。
 *
 * 设计认知：本 Saga 不直接调用 case repository（Phase 1-7 没有此 Port，
 * 本 Step 不能新建——元规则 B 严守）；状态变更通过 audit 事件 saga.step.execute.outcome
 * 含 newState payload 让运维侧 audit event store 重建状态机历史。
 *
 * compensate revert-to-previous-state：触发反向 audit 事件（compensate
 * 调用编排器的 audit 写——audit "step compensate outcome" 含 previousState
 * + revertReason payload，运维侧据此知道状态被回滚）。
 *
 * 这一步的"状态变更副作用"实际上是 audit 事件本身——audit append 失败
 * 已由编排器降级处理（onDegradedFailure），本 Saga 不重试。
 */
const buildPersistNewStateStep = (
  _ports: StateTransitionSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "persist-new-state",
  async execute(input, sagaContext: SagaContext) {
    // input 来自 step 1 的 output：{ previousState, targetState }
    const prev = input as { previousState: string; targetState: string } | undefined;
    if (prev === undefined) {
      return err(
        buildBusinessError(
          sagaContext.sagaId,
          "persist-new-state",
          "missing_previous_state_input"
        )
      );
    }
    const transitionedAt = new Date().toISOString();
    const exec: SagaStepExecution<
      { previousState: string; newState: string; transitionedAt: string },
      {
        kind: "revert-to-previous-state";
        previousState: string;
        targetState: string;
        revertReason: string;
      }
    > = {
      output: {
        previousState: prev.previousState,
        newState: prev.targetState,
        transitionedAt
      },
      compensationContext: {
        kind: "revert-to-previous-state",
        previousState: prev.previousState,
        targetState: prev.targetState,
        revertReason: ctx.input.reason
      }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    // 反向: audit event 已由编排器自动写入（saga.step.compensate.outcome）
    // 本 Saga 不需要主动调任何 Engine 反向；状态变更通过 audit 历史可溯源
    // compensationContext 含 previousState 让 audit event payload 携带（编排器处理）
    return ok(undefined);
  }
});

/**
 * Step 4: record-transition-completion（终态留痕；无 Engine 调用）。
 *
 * 仅 audit 留痕"状态转换完成"。设计意图与 Step 12 record-coverage-completion
 * 一致——让 audit 事件 saga.step.execute.outcome 中含本 step 名称，运
 * 维通过 grep "record-transition-completion" 即知 saga 已业务完成（vs
 * 早期失败终态）。
 *
 * compensate noop（无副作用）。
 */
const buildRecordTransitionCompletionStep = (
  _ports: StateTransitionSagaPorts,
  ctx: StepCtx
): AnyStep => ({
  name: "record-transition-completion",
  async execute(input, _sagaContext: SagaContext) {
    const prev = input as
      | { previousState: string; newState: string; transitionedAt: string }
      | undefined;
    const exec: SagaStepExecution<
      {
        caseId: string;
        previousState: string;
        newState: string;
        transitionedAt: string;
      },
      { kind: "noop"; stepName: string }
    > = {
      output: {
        caseId: ctx.input.caseId,
        previousState: prev?.previousState ?? ctx.input.currentExpectedState,
        newState: prev?.newState ?? "<unknown>",
        transitionedAt: prev?.transitionedAt ?? new Date().toISOString()
      },
      compensationContext: { kind: "noop", stepName: "record-transition-completion" }
    };
    return ok(exec);
  },
  async compensate(_compensationContext, _sagaContext) {
    return ok(undefined);
  }
});

// ============================================================
// 工厂闭包（与 Step 10-12 同模式）
// ============================================================

let invocationCounter = 0;
const generateInvocationStamp = (): string => {
  invocationCounter += 1;
  return `${Date.now()}-${invocationCounter}`;
};

export const createStateTransitionSaga = (
  ports: StateTransitionSagaPorts,
  options: StateTransitionSagaOptions = {}
): StateTransitionSaga => {
  // 内部组装 SagaOrchestrator（与 Step 10-12 同模式：消费而非修改；编
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
    input: StateTransitionInput
  ): Promise<Result<SagaResult<StateTransitionOutput>, SagaPortError>> => {
    const stamp = generateInvocationStamp();
    const idempotencyKey = `state-transition:${input.caseId}:${stamp}`;

    const ctx: StepCtx = { input, idempotencyKey };

    // 4 业务 step 严格顺序构造（业务流程图详见 docs/phase9/13 §D）
    const steps: ReadonlyArray<AnyStep> = [
      buildValidateCurrentStateStep(ports, ctx),
      buildValidatePreconditionStep(ports, ctx),
      buildPersistNewStateStep(ports, ctx),
      buildRecordTransitionCompletionStep(ports, ctx)
    ];

    const invocation: SagaInvocation<unknown> = {
      sagaId: ("state-transition-saga-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["sagaId"],
      traceId: ("trace-state-transition-" + input.caseId + "-" + stamp) as SagaInvocation<unknown>["traceId"],
      correlationId: ("corr-state-transition-" + input.caseId) as SagaInvocation<unknown>["correlationId"],
      initialInput: undefined,
      sagaTimeoutMs: 0
    };

    return orchestrator.runSaga<StateTransitionOutput>(invocation, steps);
  };

  return { runForCase };
};
