// Phase 9 / Step 1 — SagaPort 类型契约（Saga 编排骨架的"输入端"）
//
// 本文件定义 Tianqi 应用层 Saga 编排器（Step 6 起在 application 包实现）所
// **消费**的契约：业务方实现 SagaStep<TInput, TOutput, TCompensationContext>；
// 编排器按顺序执行 execute、失败时逆序补偿（《§4.6》）、超时控制、补偿失败
// 入死信队列（《§4.5》，Step 4 落地）。
//
// 本文件**只承载类型**，不承载任何运行能力（设计裁决 2 选 B：SagaPort 是
// 类型契约而非运行 Port）。运行能力由应用层 SagaOrchestrator 提供。
//
// 设计裁决一览（详见 docs/decisions/0002-phase-9-saga-orchestration.md）：
//   - 裁决 1 (α)：SagaStep 是结构化类型契约 — 与既有 *Port 风格一致；
//                结构类型让 class / factory / object 字面量都能实现。
//                （TypeScript 在本仓库以 `type X = { ... }` 表达，与
//                ESLint consistent-type-definitions: type 规则一致；概念
//                上仍是 "interface contract"，仅是关键字选择。）
//   - 裁决 2 (B)：SagaPort 是类型契约而非运行 Port — 单职责。
//   - 裁决 3 (X)：execute 返回 { output, compensationContext } —
//                编译期强制声明补偿所需信息，对齐《§4.4》。
//   - 裁决 4 (M)：SagaStepStatus 一次性定义完整 8 值 —
//                避免后续 Step 因增删值破坏元规则 B（签名兼容）。
//
// 本 Step **不**实现任何运行算法、不引入死信结构、不引入具体业务 Saga。

import type { Brand, IdempotencyKey, Result, TraceId } from "@tianqi/shared";
import type { SagaErrorCode } from "@tianqi/contracts";

// ============================================================
// 1. Brand 类型 —— Saga 维度的强类型标识
// ============================================================

/**
 * Saga 实例唯一标识。一个 SagaId 对应一次完整的"前向 + 补偿"生命周期，
 * 与案件标识（RiskCaseId / LiquidationCaseId / ADLCaseId）正交：同一个案件
 * 可能在不同时刻发起多次 saga（每次新的 saga 拿一个新的 SagaId）。
 */
export type SagaId = Brand<string, "SagaId">;

/**
 * 跨进程关联标识。一个 correlationId 可串联多个 saga / 命令 / 事件，
 * 用于审计追责链与分布式追踪。
 *
 * 与 TraceId 的区别：TraceId 是单次请求的链路 id（一次 HTTP 调用一个），
 * CorrelationId 是更高层的业务关联 id（一个用户主动作或系统决策可以跨多
 * 个 trace、多个 saga）。
 */
export type CorrelationId = Brand<string, "CorrelationId">;

/**
 * 构造 SagaId。空字符串 / 全空白会抛错（与 createTraceId 等姐妹工厂一致）。
 */
export const createSagaId = (value: string): SagaId => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("SagaId must be a non-empty string");
  }
  return normalized as SagaId;
};

/**
 * 构造 CorrelationId。空字符串 / 全空白会抛错。
 */
export const createCorrelationId = (value: string): CorrelationId => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error("CorrelationId must be a non-empty string");
  }
  return normalized as CorrelationId;
};

// ============================================================
// 2. SagaContext —— 不可变运行时上下文
// ============================================================

/**
 * Step 在 execute / compensate 时收到的运行时上下文。
 *
 * 全字段 readonly；不含可变指针；对齐《§4.4》"不依赖进程变量"。
 * 编排器为每个 Step 调用构造一个**新的** SagaContext（不共享引用），
 * 这样可补偿语义在序列化场景下也成立（譬如 saga 中断后从持久化态恢复）。
 */
export type SagaContext = {
  readonly sagaId: SagaId;
  readonly traceId: TraceId;
  readonly correlationId: CorrelationId;
  /** 整个 saga 启动时间（ISO-8601 UTC，与全仓时间格式一致）。 */
  readonly sagaStartedAt: string;
  /**
   * 当前推进到第几个 Step（0-based）。
   * 前向阶段：0 → totalSteps - 1 单调递增。
   * 补偿阶段：从已执行最高位反向递减。
   */
  readonly currentStepIndex: number;
  /** Saga 总 Step 数；编排开始后即固定。 */
  readonly totalSteps: number;
}

// ============================================================
// 3. SagaCompensationContext —— 类型语义标记
// ============================================================

/**
 * 补偿上下文的类型语义标记。
 *
 * 编译期标记为 `unknown`：TypeScript 无法静态证明任意类型可序列化，
 * 强行约束（譬如 Record<string, unknown>）反而会牺牲合理用例（数组、原
 * 始值）。
 *
 * 运行时序列化约束由 Step 2 契约测试 (defineSagaContractTests) 强制：
 *   - JSON.stringify(ctx) 不抛错
 *   - JSON.parse(JSON.stringify(ctx)) 与 ctx 深度相等
 * 从而保证补偿不依赖进程内存（《§4.4》）。
 *
 * Step 作者应为自己的 Step 选择具体形状（典型：`Readonly<Record<string, unknown>>`），
 * 在 Step 名 + JSDoc 中说明字段语义。该类型的存在让代码搜索可以 grep
 * "SagaCompensationContext" 找到本文件的规范说明。
 */
export type SagaCompensationContext = unknown;

// ============================================================
// 4. SagaStepExecution —— execute 成功的返回信封
// ============================================================

/**
 * SagaStep.execute 成功时的返回信封。
 *
 * 设计裁决 3 (X)：把"业务输出"与"补偿上下文"显式分离。这样编译期就强
 * 制 Step 作者声明补偿所需的最小信息集，而不是任由 compensate 翻 saga
 * 全局上下文（违反《§4.4》）。
 *
 * compensationContext 应保持小而完整：
 *   - 小：只装补偿必需字段（如已锁的资源 id、已划转的金额、已下的订单号）；
 *   - 完整：补偿不再依赖任何进程内存或外部上下文，仅凭本字段即可执行。
 */
export type SagaStepExecution<TOutput, TCompensationContext> = {
  readonly output: TOutput;
  readonly compensationContext: TCompensationContext;
}

// ============================================================
// 5. SagaStep —— 核心接口契约
// ============================================================

/**
 * SagaStep<TInput, TOutput, TCompensationContext>
 *
 * 业务方实现的最小单元。SagaOrchestrator（Step 6）按顺序调用 execute；
 * 若任一步失败且其前序已存在 succeeded 的可补偿步，则对它们**逆序**调用
 * compensate（《§4.6》）。
 *
 * 类型参数：
 *   - TInput：本 Step 接收的输入（由前一 Step 的 output + saga 初始字段聚合）
 *   - TOutput：本 Step 的业务输出（流向下一 Step 的 TInput 与最终 SagaResult）
 *   - TCompensationContext：execute 写、compensate 读的补偿上下文（必须可序列化）
 *
 * 强约束（部分由签名表达，部分由 Step 2 契约测试强制）：
 *   - execute 必须幂等（《§4.1》）：同一 input 重复调用产出相同 output + compensationContext
 *   - compensate 必须幂等（《§4.2》）：同一 compensationContext 重复调用结果一致
 *     （包括"已补偿过"也应安全返回 ok）
 *   - execute / compensate 必须配对（《§4.3》）：每个有副作用的 execute 都必须配
 *     可执行的 compensate
 *   - compensationContext 不依赖进程内存（《§4.4》）：序列化往返后仍能驱动补偿
 *   - 无副作用 Step（纯读 / 校验）的 compensate 允许空实现，但**必须显式声明**
 *     （即返回 ok 的同步分支，不可省略整个方法）（《§4.1》留痕）
 *
 * §6.5 在 Saga 层延续：execute / compensate 失败时返回 SagaPortError，
 * error.message 必须是领域级摘要（如 "margin lock acquisition failed"），
 * **严禁原文携带下游异常信息**（如 "ECONNRESET" / "HTTP 503 ..." / SQL 异常文本）。
 */
export type SagaStep<TInput, TOutput, TCompensationContext> = {
  /**
   * Step 在所属 Saga 内的唯一名。kebab-case；建议 "<动作>-<对象>" 形式：
   *   - "lock-margin-account"
   *   - "transfer-insurance-fund"
   *   - "place-deleveraging-order"
   *
   * 用于审计、日志、死信记录、SagaResult.stepStatuses。SagaOrchestrator
   * 会在 saga 启动前断言 step 名两两不重。
   */
  readonly name: string;

  /**
   * 可选幂等键计算器。若提供，编排器在 execute 前用 IdempotencyPort 查重
   * （《§12.3》）。计算结果应稳定：对相同 input 必产出相同 IdempotencyKey。
   *
   * 不提供则 Step 默认不做幂等保护（适用于"自然幂等读"的 Step，譬如 query-*）。
   */
  readonly idempotencyKey?: (input: TInput) => IdempotencyKey;

  /**
   * 前向执行。
   *
   * 成功：返回 SagaStepExecution（output + compensationContext）；
   * 失败：返回 SagaPortError，error.code ∈ TQ-SAG-* 白名单。
   *
   * 失败语义（参见 SagaErrorCode 命名空间）：
   *   - TQ-SAG-001 SAGA_STEP_TIMEOUT：执行超时
   *   - TQ-SAG-002 SAGA_STEP_EXECUTION_FAILED：业务逻辑失败 / 下游不可用 / 校验失败
   */
  execute(
    input: TInput,
    sagaContext: SagaContext
  ): Promise<Result<SagaStepExecution<TOutput, TCompensationContext>, SagaPortError>>;

  /**
   * 补偿执行。
   *
   * 成功：返回 ok(void)；
   * 失败：返回 SagaPortError；编排器据此入死信队列（Step 4 落地）。
   *
   * 失败语义：
   *   - TQ-SAG-001 SAGA_STEP_TIMEOUT：补偿超时
   *   - TQ-SAG-003 SAGA_STEP_COMPENSATION_FAILED：补偿失败 → 触发死信（《§4.5》）
   *
   * 幂等性约束（《§4.2》）：
   *   - 同一 compensationContext 重复调用必须等价
   *   - "已补偿"的资源再次补偿应安全返回 ok（不应当作失败）
   */
  compensate(
    compensationContext: TCompensationContext,
    sagaContext: SagaContext
  ): Promise<Result<void, SagaPortError>>;
}

// ============================================================
// 6. SagaStepStatus —— 完整 8 值状态枚举（裁决 4 M）
// ============================================================

/**
 * Step 在 saga 生命周期内的状态。本枚举一次性定义齐全（裁决 4 M），
 * 避免后续 Step 因增删值破坏元规则 B（签名兼容）。
 *
 * 状态进入条件（严格单向，不可回退）：
 *   - "pending"：初始态。Step 已注册但未被调度。
 *     进入：saga 启动时所有 Step 均为 pending。
 *     退出：被编排器选中调用 execute 时 → "executing"。
 *
 *   - "executing"：execute 进行中。
 *     进入：仅来自 "pending"。
 *     退出："succeeded"（execute ok）或 "failed"（execute err）。
 *
 *   - "succeeded"：execute 成功完成。
 *     进入：仅来自 "executing"。
 *     退出：仅当 saga 触发整体补偿且本 Step 在补偿计划中时 → "compensating"；
 *          否则保持 succeeded 终态。
 *
 *   - "failed"：execute 失败（包括超时）。
 *     进入：仅来自 "executing"。
 *     退出：终态。**触发整体补偿路径**（若 saga 含已 succeeded 的可补偿前序 Step），
 *          但本 Step 自身保持 failed（失败的 Step 自己无须补偿——它的副作用本就没发生）。
 *
 *   - "compensating"：compensate 进行中。
 *     进入：仅来自 "succeeded"（仅在整体补偿路径触发时）。
 *     退出："compensated"（compensate ok）或 "compensation_failed"（compensate err）。
 *
 *   - "compensated"：compensate 成功完成。
 *     进入：仅来自 "compensating"。
 *     退出：终态。
 *
 *   - "compensation_failed"：compensate 失败。
 *     进入：仅来自 "compensating"。
 *     退出：仅 → "dead_lettered"（必须入死信队列，《§4.5》）。
 *
 *   - "dead_lettered"：已入死信队列。终态。
 *     进入：仅来自 "compensation_failed"。
 *     退出：无（终态；后续运维介入由独立流程处理，与 saga 编排解耦）。
 *
 * 终态：succeeded（保持）/ failed / compensated / dead_lettered。
 * 中间态：pending / executing / compensating / compensation_failed（短暂中转）。
 *
 * 不可回退：本枚举不支持任何"回滚到 pending / 重做 executing"的语义；
 * 重试 / 重做由 SagaOrchestrator 在更高层次（譬如新的 SagaId）实现。
 */
export type SagaStepStatus =
  | "pending"
  | "executing"
  | "succeeded"
  | "failed"
  | "compensating"
  | "compensated"
  | "compensation_failed"
  | "dead_lettered";

// ============================================================
// 7. SagaResultStatus —— Saga 整体结果状态
// ============================================================

/**
 * Saga 整体完成后的状态聚合。
 *
 * 命名说明（重要，元规则 B 一致性）：
 *   故意避开 "SagaStatus"，因为 packages/application 的 Phase 4 编排骨架
 *   已存在 OrchestrationSagaState.sagaStatus 类型 SagaStatus（值集
 *   "started" | "in_progress" | "completed" | "failed" | "compensation_required"），
 *   语义混合 step 与 saga 两层。Phase 9 SagaPort 层用 "SagaResultStatus"
 *   明确指代"saga 整体结果"，与 Phase 4 应用层 saga 骨架解耦。
 *   未来读者通过 grep "SagaResultStatus" 即知是 Phase 9 Port 层的整体结果，
 *   通过 grep "SagaStatus" 即知是 Phase 4 应用层的中间态。
 *
 * 状态语义：
 *   - "completed"：全部 Step 都达到 "succeeded" 终态，无补偿。
 *   - "compensated"：触发补偿路径，且全部需补偿 Step 都达到 "compensated" 终态。
 *   - "partially_compensated"：触发补偿路径，但至少一个 Step 进入 "dead_lettered"。
 *     运维介入；finalOutput 必为 null。
 *   - "timed_out"：编排器整体超时（SagaInvocation.sagaTimeoutMs）被中断。
 *     部分 Step 状态可能停在 "executing" 或 "compensating"。finalOutput 必为 null。
 */
export type SagaResultStatus =
  | "completed"
  | "compensated"
  | "partially_compensated"
  | "timed_out";

// ============================================================
// 8. SagaStepStatusSnapshot —— SagaResult 内的 Step 终态快照
// ============================================================

/**
 * SagaResult.stepStatuses 内单项。
 * 含 stepName + 终态 + 失败原因（若有）。即使 saga timed_out / partially_compensated，
 * 本字段仍必须包含**全部** Step（按编排顺序），不允许遗漏。
 */
export type SagaStepStatusSnapshot = {
  readonly name: string;
  readonly status: SagaStepStatus;
  /**
   * 仅 status 为 failed / compensation_failed / dead_lettered 时非空；
   * 其余情况为 null。
   *
   * 内容：领域级摘要（《§6.5》），譬如 "margin lock acquisition failed"。
   * 严禁原文携带下游异常文本（《§6.5》纪律延续到 Saga 层）。
   */
  readonly failureReason: string | null;
}

// ============================================================
// 9. SagaResult —— Saga 完成快照
// ============================================================

/**
 * Saga 整体完成后的不可变快照。SagaOrchestrator（Step 6）返回此结构；
 * 应用层消费 / 审计入存。
 */
export type SagaResult<TOutput> = {
  readonly sagaId: SagaId;
  readonly status: SagaResultStatus;
  /**
   * 每个 Step 的最终状态（按编排顺序，长度等于 SagaContext.totalSteps）。
   */
  readonly stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>;
  /**
   * 仅 status === "completed" 时非空；其余三种状态一律为 null。
   * 这避免半成品输出泄露给消费方（《§13.2》"通知与报表可以最终一致，但
   * 核心状态使用强一致语义"）。
   */
  readonly finalOutput: TOutput | null;
  /** Saga 完成时间（ISO-8601 UTC）。 */
  readonly completedAt: string;
}

// ============================================================
// 10. SagaInvocation —— 启动 saga 的请求载荷
// ============================================================

/**
 * 调用方启动 saga 时提供的请求载荷。SagaOrchestrator（Step 6）消费此结构
 * 构造 SagaContext + 启动调度循环。
 *
 * 与 SagaContext 的边界：
 *   - SagaInvocation 是"外部请求"——前置存在；应用层在调用编排器前构造。
 *   - SagaContext 是"运行时投影"——编排器为每个 Step 调用重新构造。
 */
export type SagaInvocation<TInitialInput> = {
  readonly sagaId: SagaId;
  readonly traceId: TraceId;
  readonly correlationId: CorrelationId;
  readonly initialInput: TInitialInput;
  /**
   * Saga 整体超时（毫秒）。编排器超过此时长后强制中断，最终
   * SagaResult.status === "timed_out"。
   *
   * Step 内部的 execute / compensate 各自的 RPC 超时由各 Adapter 的
   * 五件套（Phase 8 已落地）自行管理；本字段只控制"整个 saga 在编排器
   * 视角下的总耗时上限"，不与 Step 内 timeout 叠加。
   */
  readonly sagaTimeoutMs: number;
}

// ============================================================
// 11. SagaPortError —— 错误信封
// ============================================================

/**
 * SagaStep.execute / SagaStep.compensate 失败时返回的错误形状。
 *
 * §6.5 纪律延续到 Saga 层：
 *   - code 限定为 TQ-SAG-* 字面量联合（编译期保证；本类型 alias 自
 *     contracts 包的 SagaErrorCode 以保持单一真理源）
 *   - message 是领域级摘要（如 "margin lock acquisition failed"），
 *     **严禁原文携带下游异常文本**（如 "ECONNRESET" / "HTTP 503 Service Unavailable"
 *     / SQL 异常）。Step 实现若需保留下游异常用于审计，应放入 cause。
 *   - cause 类型为 unknown，仅由编排器内部审计入存使用；
 *     **外部 SagaResult / SagaStepStatusSnapshot 不透出 cause**，
 *     这与 Phase 8 Adapter 错误转译纪律（基座 → PortError 时不透出 raw cause）一致。
 */
export type SagaPortError = {
  readonly code: SagaErrorCode;
  readonly sagaId: SagaId;
  readonly stepName: string;
  readonly message: string;
  readonly cause?: unknown;
}
