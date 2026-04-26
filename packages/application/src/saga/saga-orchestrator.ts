// Phase 9 / Step 6 — SagaOrchestrator 核心实现 + Step 7 补偿引擎增强。
//
// 把《§4》8 条 Saga 强约束（Sprint F 已落 §4.1-§4.7）从纸面规约变成
// "运行时可执行编排器"。本文件是 Phase 9 至今最重的单文件；接口签名
// 在第一阶段 DRAFT 经用户审视后冻结（元规则 B 自此对 SagaOrchestrator /
// SagaOrchestratorPorts / SagaOrchestratorOptions / runSaga 全部生效）。
//
// 设计裁决（详见 docs/decisions/0002 Step 6 段 + docs/phase9/06）：
//   - 裁决 1 (γ)：γ 工厂闭包 createSagaOrchestrator(ports, options?)
//   - 裁决 2 (A)：每次 stepStatus 变化都 persist（6 类触发点）
//   - 裁决 3 (修订版 7 类)：saga.started / saga.step.execute.outcome /
//     saga.compensation.started / saga.step.compensate.outcome /
//     saga.dead_letter.enqueued / saga.completed / saga.timed_out（仅声明）
//   - 裁决 4 (α)：与 Phase 4 OrchestrationSagaState 完全独立新建
//   - 裁决 5（分级）：state save 致命 / dead-letter / audit 降级
//   - 裁决 6 (Step 7-9 钩子)：runCompensationPhase / withStepTimeout +
//     defaultStepTimeoutMs / Step 9 不在编排器接口暴露
//   - 裁决 7：单元测试 ≤10 + 一行挂载 defineSagaContractTests
//
// Step 7 增强（详见 docs/decisions/0002 Step 7 段 + docs/phase9/07）：
//   - 裁决 1 (β)：链式继续——单 step compensate 失败不阻断后续 step 补偿
//   - 裁决 2 (C)：双重幂等保护——编排器侧 stepStatus 检查 + step 自身契约
//   - 裁决 3 (X)：不扩展 PersistedSagaState（stepStatuses 已含 8 值终态语义）
//   - 裁决 4：0 错误码新增（惯例 K 第 9 次实战）
//   - 裁决 5：unit test 10→12（新增不变量 2 + 不变量 5 专项）
//
// 5 不变量（运行时层面的强约束，每条对应 §4 协议层条款）：
//   - 不变量 1（§4.3）：补偿调用顺序严格逆序 stepIndex N-1, N-2, ..., 0
//   - 不变量 2（§4.2）：仅 stepStatus === "succeeded" 的 step 被调用 compensate
//   - 不变量 3（§4.5）：compensation_failed 的 step 必入死信
//   - 不变量 4（§4.5）：每次 stepStatus 变化都 persist
//   - 不变量 5（链式继续 + §4.6）：单点 compensate 失败不阻断后续 step 补偿尝试
//
// §6.5 转译纪律延续：state 持久化失败时返回 SagaPortError；message 是
// 领域级摘要（"saga state persistence failed"）；cause 字段携带原始
// SagaStateStoreError 仅供编排器内部审计/调用方诊断，外部 SagaResult 不
// 透出 cause（与 Sprint F Adapter 一致）。

import { setTimeout as scheduleTimer, clearTimeout as clearScheduledTimer } from "node:timers";

import { err, ok } from "@tianqi/shared";
import type { Result, TraceId } from "@tianqi/shared";

import type {
  AuditEventRecord,
  AuditEventSinkPort,
  CorrelationId,
  DeadLetterEntry,
  DeadLetterId,
  DeadLetterStorePort,
  PersistedCompensationEntry,
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaContext,
  SagaId,
  SagaInvocation,
  SagaPortError,
  SagaResult,
  SagaResultStatus,
  SagaStateStorePort,
  SagaStep,
  SagaStepStatus,
  SagaStepStatusSnapshot
} from "@tianqi/ports";
import { createDeadLetterId } from "@tianqi/ports";

const DEFAULT_STEP_TIMEOUT_MS = 5_000;

// ============================================================
// AUDIT_EVENT_TYPES —— 7 类审计事件类型（裁决 3 修订版）
// ============================================================
//
// 元规则 B 在审计层级：本 Step 锁定 7 个 eventType 字符串。后续 Step 7-9 /
// Phase 10+ 新增类型必须经 ADR-0002 修订流程；既有 7 类的字符串永久冻结。
//
// SAGA_TIMED_OUT 仅声明事件类型不触发——Step 8 整体超时实施时**直接消
// 费已声明类型**，不扩展事件命名空间。
//
// 设计意图：审计事件类型是领域事件分类，自带语义优于 payload 字段过滤；
// execute / compensate 阶段在事件类型层面分离让运维 / 审计可按事件类型
// 分组查询，无需 payload.phase 过滤。
export const AUDIT_EVENT_TYPES = {
  SAGA_STARTED: "saga.started",
  SAGA_STEP_EXECUTE_OUTCOME: "saga.step.execute.outcome",
  SAGA_COMPENSATION_STARTED: "saga.compensation.started",
  SAGA_STEP_COMPENSATE_OUTCOME: "saga.step.compensate.outcome",
  SAGA_DEAD_LETTER_ENQUEUED: "saga.dead_letter.enqueued",
  SAGA_COMPLETED: "saga.completed",
  /** 声明类型；本 Step 不触发；Step 8 整体超时实施时触发。 */
  SAGA_TIMED_OUT: "saga.timed_out"
} as const;

export type SagaAuditEventType =
  (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];

// ============================================================
// 对外类型
// ============================================================

export type SagaOrchestratorPorts = {
  readonly sagaStateStore: SagaStateStorePort;
  readonly deadLetterStore: DeadLetterStorePort;
  readonly auditEventSink: AuditEventSinkPort;
};

/**
 * 降级失败事件载荷（裁决 5 实施细节）。当 dead-letter 入队 / audit append
 * 失败时编排器调用 onDegradedFailure 回调（如配置）。saga 不中止。
 */
export type SagaDegradedFailureEvent =
  | {
      readonly kind: "dead-letter-enqueue-failed";
      readonly sagaId: SagaId;
      readonly stepName: string;
      readonly reason: string;
    }
  | {
      readonly kind: "audit-append-failed";
      readonly eventType: SagaAuditEventType;
      readonly reason: string;
    };

export type SagaOrchestratorOptions = {
  /**
   * 单 Step 默认超时（毫秒）。每个 step.execute / step.compensate 调用
   * 用此超时包装。Step 8 watchdog 实施时增强本字段语义，不破坏接口。
   * 默认 5_000。
   */
  readonly defaultStepTimeoutMs?: number;
  /**
   * 调用方提供的"当前时刻"获取器。便于测试注入 fake clock。
   * 默认 () => new Date()。
   */
  readonly clock?: () => Date;
  /**
   * 调用方提供的 deadLetterId 生成器。便于测试注入确定性 id。
   * 默认 dlq-<timestamp>-<counter>。
   */
  readonly generateDeadLetterId?: () => DeadLetterId;
  /**
   * 降级失败回调（实施细节，第二阶段引入）。
   *
   * 当 dead-letter 入队失败 / audit append 失败时被调用（裁决 5 降级
   * 模式）。**不**为致命级失败（state save 失败）调用——那走 err 返回值。
   *
   * 默认 undefined（静默降级）。生产部署应注入指向运维告警系统的回调；
   * 测试场景可注入收集器验证降级行为。
   *
   * 与 DRAFT 草案的差异：草案使用 console.warn 直接降级日志；实施时改
   * 为可选回调，理由：
   *   - 不依赖 node global console（ESLint env 不识别）
   *   - 可测试（测试通过 callback 收集事件而非 spy console）
   *   - 解耦（生产可绑定到 metrics / 告警系统而非 stdout）
   *   - 元规则 B 兼容（新增可选字段，既有字段不变）
   */
  readonly onDegradedFailure?: (event: SagaDegradedFailureEvent) => void;
};

export type SagaOrchestrator = {
  /**
   * 启动一个 saga 并推进到终态。
   *
   * 失败处理（裁决 5 分级模式）：
   *   - state save 失败 → **致命**：返回 err(SagaPortError code=TQ-SAG-002
   *     message="saga state persistence failed")，saga 中止
   *   - step.execute 业务失败 → 业务层（触发补偿路径）
   *   - step.compensate 失败 → 业务层（标记 dead_lettered + DLQ enqueue）
   *   - dead letter enqueue 失败 → **降级**：log + 继续
   *   - audit append 失败 → **降级**：log + 继续
   */
  runSaga<TOutput>(
    invocation: SagaInvocation<unknown>,
    steps: ReadonlyArray<SagaStep<unknown, unknown, unknown>>
  ): Promise<Result<SagaResult<TOutput>, SagaPortError>>;
};

// ============================================================
// 默认 generateDeadLetterId（可被 options 覆盖）
// ============================================================

let defaultDlqIdCounter = 0;

const defaultGenerateDeadLetterId = (): DeadLetterId => {
  defaultDlqIdCounter += 1;
  return createDeadLetterId(`dlq-${Date.now()}-${defaultDlqIdCounter}`);
};

// ============================================================
// Step 7 增强：补偿引擎私有 helper（文件级、纯函数、零状态）
// ============================================================
//
// 这两个 helper 把 5 不变量中"哪个 step 该补"与"全部补完后整体什么状态"
// 两个判定从 runCompensationPhase 主循环抽离，独立成型函数。读者翻开
// runCompensationPhase 时一眼看出"哪条不变量在哪一行守护"。
//
// 不引入新接口签名（元规则 B 严守）；不暴露给外部消费者（不通过 src/
// index.ts re-export；与 createSagaOrchestrator 同文件局部使用）。

/**
 * 不变量 2（§4.2 双重幂等保护编排器侧）：判定一个 step 是否仍处于
 * 可补偿态。仅 "succeeded" 返回 true。
 *
 * 设计要义：
 *   - 同一 step 不会被本编排器的 runCompensationPhase 内重复调用 compensate
 *     （主循环遍历一次 succeeded 数组）
 *   - 但崩溃恢复（Phase 10+ 责任）从 PersistedSagaState 重新装载
 *     stepStatuses 后，可能遇到 status === "compensated" 已完成的 step；
 *     此 helper 让恢复路径未来无需修改主循环逻辑——只需改 compensate
 *     入口判定数据源（运行时 succeeded 数组 → 持久化 stepStatuses 字段）
 *   - 与 §4.2 step 自身契约幂等组成"双重保护"：编排器侧守门 + step
 *     自身能够安全应对意外重调（譬如部署 / 回滚误触发）
 *
 * 接受 SagaStepStatus 而不是 SagaStepStatusSnapshot，因为编排器侧本身
 * 已经持有 status 字段；调用方提供哪种形式都不破坏判定纯度。
 *
 * **本 helper 通过 src/index.ts 导出**：
 *   - Step 7 unit test 不变量 2 专项 it 直接调用验证 8 状态枚举完备性
 *   - Phase 10+ 崩溃恢复 API 实现时复用相同判定语义（避免逻辑重复）
 *   元规则 B 自此对本签名永久冻结。
 */
export const isStepEligibleForCompensation = (status: SagaStepStatus): boolean =>
  status === "succeeded";

/**
 * 不变量 5（链式继续 + §4.6）：根据补偿循环结束后的 stepStatuses 计算
 * Saga 整体的补偿终态。
 *
 * 判定规则（与 PersistedSagaStateOverallStatus 6 值集对齐）：
 *   - 任一 step 状态为 "dead_lettered" → "partially_compensated"
 *     （至少一次 compensate 失败被记入死信）
 *   - 否则 → "compensated"
 *     （含 vacuous 情形：无 succeeded step 触发补偿，循环未执行）
 *
 * 不返回 in_progress / completed / compensating / timed_out 这 4 类——本函
 * 数仅在补偿阶段结束（runCompensationPhase 主循环结束）时被调用。这种
 * 限定在类型层面无法表达，由调用上下文保证。
 *
 * 设计要义：
 *   - 替代原 Step 6 实现里的局部 boolean `allCompensated` 计算——把判定
 *     从"循环局部副作用"提升为"基于持久化 stepStatuses 的纯函数"
 *   - 让聚合判定与补偿循环解耦：未来若 runCompensationPhase 多次调用
 *     （崩溃恢复重入），聚合逻辑仍正确
 *
 * **本 helper 通过 src/index.ts 导出**：
 *   - Step 7 unit test 不变量 5 专项 it 直接调用验证 8 状态枚举聚合行为
 *   - Phase 10+ 崩溃恢复 API 实现时复用相同聚合语义
 *   元规则 B 自此对本签名永久冻结。
 */
export const aggregateCompensationOutcome = (
  stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>
): "compensated" | "partially_compensated" => {
  for (const snapshot of stepStatuses) {
    if (snapshot.status === "dead_lettered") {
      return "partially_compensated";
    }
  }
  return "compensated";
};

// ============================================================
// createSagaOrchestrator —— γ 工厂闭包
// ============================================================

export const createSagaOrchestrator = (
  ports: SagaOrchestratorPorts,
  options: SagaOrchestratorOptions = {}
): SagaOrchestrator => {
  const stepTimeoutMs = options.defaultStepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS;
  const clock = options.clock ?? ((): Date => new Date());
  const generateDeadLetterId =
    options.generateDeadLetterId ?? defaultGenerateDeadLetterId;
  const onDegradedFailure = options.onDegradedFailure;

  // ============================================================
  // 内部状态形状：1:1 映射 PersistedSagaState
  // ============================================================
  type InternalSagaState = {
    sagaId: SagaId;
    sagaStartedAt: string;
    lastUpdatedAt: string;
    currentStepIndex: number;
    totalSteps: number;
    stepStatuses: SagaStepStatusSnapshot[];
    compensationContexts: PersistedCompensationEntry[];
    overallStatus: PersistedSagaStateOverallStatus;
    correlationId: CorrelationId;
    traceId: TraceId;
  };

  const buildSnapshot = (state: InternalSagaState): PersistedSagaState => ({
    sagaId: state.sagaId,
    sagaStartedAt: state.sagaStartedAt,
    lastUpdatedAt: state.lastUpdatedAt,
    currentStepIndex: state.currentStepIndex,
    totalSteps: state.totalSteps,
    stepStatuses: state.stepStatuses.slice(),
    compensationContexts: state.compensationContexts.slice(),
    overallStatus: state.overallStatus,
    correlationId: state.correlationId,
    traceId: state.traceId
  });

  // ============================================================
  // persist —— 致命级失败处理（裁决 5）
  // ============================================================
  const persist = async (
    state: InternalSagaState
  ): Promise<Result<void, SagaPortError>> => {
    state.lastUpdatedAt = clock().toISOString();
    const result = await ports.sagaStateStore.save(buildSnapshot(state));
    if (!result.ok) {
      return err({
        code: "TQ-SAG-002",
        sagaId: state.sagaId,
        stepName: "<saga-state-persistence>",
        message: "saga state persistence failed",
        cause: result.error
      });
    }
    return ok(undefined);
  };

  // ============================================================
  // auditAppend —— 降级级失败处理（裁决 5）
  // ============================================================
  const auditAppend = async (
    eventType: SagaAuditEventType,
    state: InternalSagaState,
    payload: Record<string, unknown>
  ): Promise<void> => {
    const event: AuditEventRecord = {
      eventType,
      occurredAt: clock().toISOString(),
      traceId: state.traceId,
      payload: { sagaId: state.sagaId, ...payload }
    };
    try {
      const result = await ports.auditEventSink.append(event);
      if (!result.ok) {
        // 降级：通过 onDegradedFailure 回调通知；不重试 / 不影响 saga 推进
        onDegradedFailure?.({
          kind: "audit-append-failed",
          eventType,
          reason: result.error.message
        });
      }
    } catch (cause) {
      onDegradedFailure?.({
        kind: "audit-append-failed",
        eventType,
        reason: cause instanceof Error ? cause.name : "unknown_failure"
      });
    }
  };

  const buildSagaContextForStep = (
    state: InternalSagaState,
    stepIndex: number
  ): SagaContext => ({
    sagaId: state.sagaId,
    traceId: state.traceId,
    correlationId: state.correlationId,
    sagaStartedAt: state.sagaStartedAt,
    currentStepIndex: stepIndex,
    totalSteps: state.totalSteps
  });

  // ============================================================
  // withStepTimeout —— Step 8 钩子（私有）
  // 超时即产出 TQ-SAG-001。task 本身不被 abort（与 Step 1 接口不含
  // AbortSignal 一致；元规则 B）。Step 8 增强 watchdog 时仅扩展本方法。
  // ============================================================
  const withStepTimeout = async <T>(
    task: () => Promise<Result<T, SagaPortError>>,
    sagaId: SagaId,
    stepName: string
  ): Promise<Result<T, SagaPortError>> => {
    let timer: ReturnType<typeof scheduleTimer> | undefined;
    const timeoutPromise = new Promise<Result<T, SagaPortError>>(resolve => {
      timer = scheduleTimer(() => {
        resolve(
          err({
            code: "TQ-SAG-001",
            sagaId,
            stepName,
            message: "step exceeded timeout budget"
          })
        );
      }, stepTimeoutMs);
    });
    try {
      return await Promise.race([task(), timeoutPromise]);
    } finally {
      if (timer !== undefined) clearScheduledTimer(timer);
    }
  };

  // ============================================================
  // tryEnqueueDeadLetter —— 降级级失败处理（裁决 5）
  // 死信入队失败时 log 降级 + 继续；不影响 stepStatus（已是 dead_lettered）
  // ============================================================
  const tryEnqueueDeadLetter = async (
    state: InternalSagaState,
    step: SagaStep<unknown, unknown, unknown>,
    compensationContext: unknown,
    failureReason: string,
    attemptCount: number
  ): Promise<{ entryId: DeadLetterId; enqueued: boolean }> => {
    const entryId = generateDeadLetterId();
    const now = clock().toISOString();
    const entry: DeadLetterEntry = {
      entryId,
      sagaId: state.sagaId,
      stepName: step.name,
      status: "pending",
      enqueuedAt: now,
      attemptCount,
      compensationContext,
      failureChain: [failureReason],
      correlationId: state.correlationId,
      traceId: state.traceId,
      lastAttemptAt: now,
      processedAt: null,
      processedBy: null,
      processingNotes: null
    };
    try {
      const result = await ports.deadLetterStore.enqueue(entry);
      if (!result.ok) {
        onDegradedFailure?.({
          kind: "dead-letter-enqueue-failed",
          sagaId: state.sagaId,
          stepName: step.name,
          reason: result.error.message
        });
        return { entryId, enqueued: false };
      }
      return { entryId, enqueued: true };
    } catch (cause) {
      onDegradedFailure?.({
        kind: "dead-letter-enqueue-failed",
        sagaId: state.sagaId,
        stepName: step.name,
        reason: cause instanceof Error ? cause.name : "unknown_failure"
      });
      return { entryId, enqueued: false };
    }
  };

  // ============================================================
  // runCompensationPhase —— Step 7 增强：5 不变量在运行时层面被严格守住
  //
  // 不变量映射（与 docs/phase9/07 §D 一一对应）：
  //   - 不变量 1（§4.3 严格逆序）→ for j = succeeded.length - 1; j >= 0; j -= 1
  //   - 不变量 2（§4.2 双重幂等保护）→ isStepEligibleForCompensation 守门
  //   - 不变量 3（§4.5 死信入队）→ compResult 失败必触发 tryEnqueueDeadLetter
  //   - 不变量 4（§4.5 stepStatus 持久化）→ 每次 status 变化都 await persist
  //   - 不变量 5（链式继续 + §4.6）→ compResult 失败时不 break，循环继续
  //
  // Step 7 增强 vs Step 6 原实现的关键差异：
  //   - 引入 isStepEligibleForCompensation 守门（双重保护编排器侧）
  //   - 终态聚合改用 aggregateCompensationOutcome 纯函数（基于持久化
  //     stepStatuses 字段，而非循环局部 boolean），与崩溃恢复路径前向兼容
  //   - 5 个不变量在代码注释里显式标注，新增维护者一目了然
  //
  // 接口签名零变化（元规则 B 严守）；与 Step 6 调用方完全兼容。
  // ============================================================
  const runCompensationPhase = async (
    state: InternalSagaState,
    steps: ReadonlyArray<SagaStep<unknown, unknown, unknown>>,
    succeeded: ReadonlyArray<{ idx: number; compensationContext: unknown }>
  ): Promise<Result<void, SagaPortError>> => {
    // 不变量 4：进入补偿阶段必先 persist overallStatus → compensating
    state.overallStatus = "compensating";
    const persistEntry = await persist(state);
    if (!persistEntry.ok) return persistEntry;

    const failedStepName = state.stepStatuses[state.currentStepIndex]?.name ?? "<unknown>";
    await auditAppend(AUDIT_EVENT_TYPES.SAGA_COMPENSATION_STARTED, state, {
      failedStepName,
      succeededStepNames: succeeded.map(s => steps[s.idx]!.name)
    });

    // 不变量 1（§4.3 严格逆序）：从 succeeded 数组末尾往头部遍历。succeeded
    // 数组在 forward phase 按 stepIndex 升序 push，逆序遍历等价于按 stepIndex
    // 严格降序（N-1, N-2, ..., 0）。中间不跳过任何 succeeded step。
    for (let j = succeeded.length - 1; j >= 0; j -= 1) {
      const entry = succeeded[j]!;
      const step = steps[entry.idx]!;
      const currentStatus = state.stepStatuses[entry.idx]!.status;

      // 不变量 2（§4.2 双重幂等保护编排器侧）：仅 "succeeded" 状态的 step
      // 才被调用 compensate。理论上 succeeded 数组只含 forward phase 中
      // succeeded 的 step，此守门是冗余防御——但与 §4.2 step 自身契约幂等
      // 形成双重保护，未来崩溃恢复（Phase 10+）从 PersistedSagaState 装载
      // stepStatuses 直接复用本主循环时此守门是必要的。
      if (!isStepEligibleForCompensation(currentStatus)) {
        // 跳过：无 audit 触发（不是新事件，仅是恢复场景的状态确认）；
        // 不入死信（既有终态保留）。不变量 5 隐含表达：跳过不阻断后续。
        continue;
      }

      // 不变量 4：status → "compensating" 必先 persist
      state.stepStatuses[entry.idx] = {
        ...state.stepStatuses[entry.idx]!,
        status: "compensating"
      };
      const persistC1 = await persist(state);
      if (!persistC1.ok) return persistC1;

      const sagaContext = buildSagaContextForStep(state, entry.idx);
      const compResult = await withStepTimeout(
        () => step.compensate(entry.compensationContext, sagaContext),
        state.sagaId,
        step.name
      );

      if (compResult.ok) {
        // 不变量 4：status → "compensated" 必先 persist
        state.stepStatuses[entry.idx] = {
          ...state.stepStatuses[entry.idx]!,
          status: "compensated"
        };
        const persistC2 = await persist(state);
        if (!persistC2.ok) return persistC2;
        await auditAppend(AUDIT_EVENT_TYPES.SAGA_STEP_COMPENSATE_OUTCOME, state, {
          stepName: step.name,
          stepIndex: entry.idx,
          outcome: "succeeded"
        });
      } else {
        const failureReason = compResult.error.message;
        // 不变量 3（§4.5 死信入队）+ 不变量 4（持久化）：
        // status → "dead_lettered" 必先 persist；后续必触发 enqueue
        state.stepStatuses[entry.idx] = {
          ...state.stepStatuses[entry.idx]!,
          status: "dead_lettered",
          failureReason
        };
        const persistC2 = await persist(state);
        if (!persistC2.ok) return persistC2;
        await auditAppend(AUDIT_EVENT_TYPES.SAGA_STEP_COMPENSATE_OUTCOME, state, {
          stepName: step.name,
          stepIndex: entry.idx,
          outcome: "failed",
          failureReason
        });

        const dlqResult = await tryEnqueueDeadLetter(
          state,
          step,
          entry.compensationContext,
          failureReason,
          1
        );
        if (dlqResult.enqueued) {
          await auditAppend(AUDIT_EVENT_TYPES.SAGA_DEAD_LETTER_ENQUEUED, state, {
            stepName: step.name,
            deadLetterEntryId: dlqResult.entryId,
            failureChain: [failureReason]
          });
        }
        // 不变量 5（链式继续）：compensate 失败后**不 break**，循环继续到 j=0
      }
    }

    // 不变量 5（链式继续聚合终态）：根据补偿循环结束后的持久化
    // stepStatuses 计算 saga 整体状态。任一 dead_lettered →
    // partially_compensated；否则 compensated。
    state.overallStatus = aggregateCompensationOutcome(state.stepStatuses);
    return ok(undefined);
  };

  // ============================================================
  // runSaga —— 公开 API
  // ============================================================
  const runSaga = async <TOutput>(
    invocation: SagaInvocation<unknown>,
    steps: ReadonlyArray<SagaStep<unknown, unknown, unknown>>
  ): Promise<Result<SagaResult<TOutput>, SagaPortError>> => {
    const sagaStartedAt = clock().toISOString();

    const state: InternalSagaState = {
      sagaId: invocation.sagaId,
      sagaStartedAt,
      lastUpdatedAt: sagaStartedAt,
      currentStepIndex: 0,
      totalSteps: steps.length,
      stepStatuses: steps.map(s => ({
        name: s.name,
        status: "pending" as SagaStepStatus,
        failureReason: null
      })),
      compensationContexts: [],
      overallStatus: "in_progress",
      correlationId: invocation.correlationId,
      traceId: invocation.traceId
    };

    // Persist 触发点 1：saga 启动时
    const initPersist = await persist(state);
    if (!initPersist.ok) return initPersist;

    await auditAppend(AUDIT_EVENT_TYPES.SAGA_STARTED, state, {
      totalSteps: state.totalSteps,
      sagaStartedAt
    });

    // ============================================================
    // FORWARD PHASE
    // ============================================================
    const succeeded: Array<{ idx: number; compensationContext: unknown }> = [];
    let firstFailureIdx = -1;
    let currentInput: unknown = invocation.initialInput;
    let lastOutput: unknown = null;

    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]!;
      state.currentStepIndex = i;

      // Persist 触发点 2：step.execute 启动前（pending → executing）
      state.stepStatuses[i] = { ...state.stepStatuses[i]!, status: "executing" };
      const persistF1 = await persist(state);
      if (!persistF1.ok) return persistF1;

      const sagaContext = buildSagaContextForStep(state, i);
      const execResult = await withStepTimeout(
        () => step.execute(currentInput, sagaContext),
        state.sagaId,
        step.name
      );

      if (execResult.ok) {
        succeeded.push({
          idx: i,
          compensationContext: execResult.value.compensationContext
        });
        state.stepStatuses[i] = { ...state.stepStatuses[i]!, status: "succeeded" };
        state.compensationContexts.push({
          stepName: step.name,
          compensationContext: execResult.value.compensationContext
        });
        // Persist 触发点 3：step.execute 完成后（executing → succeeded）
        const persistF2 = await persist(state);
        if (!persistF2.ok) return persistF2;
        await auditAppend(AUDIT_EVENT_TYPES.SAGA_STEP_EXECUTE_OUTCOME, state, {
          stepName: step.name,
          stepIndex: i,
          outcome: "succeeded"
        });
        currentInput = execResult.value.output;
        lastOutput = execResult.value.output;
      } else {
        const failureReason = execResult.error.message;
        state.stepStatuses[i] = {
          ...state.stepStatuses[i]!,
          status: "failed",
          failureReason
        };
        // Persist 触发点 3：step.execute 完成后（executing → failed）
        const persistF2 = await persist(state);
        if (!persistF2.ok) return persistF2;
        await auditAppend(AUDIT_EVENT_TYPES.SAGA_STEP_EXECUTE_OUTCOME, state, {
          stepName: step.name,
          stepIndex: i,
          outcome: "failed",
          failureReason
        });
        firstFailureIdx = i;
        break;
      }
    }

    // ============================================================
    // COMPENSATION PHASE（仅在前向失败时）
    // ============================================================
    if (firstFailureIdx >= 0) {
      if (succeeded.length === 0) {
        // 首步即失败 → 无前序 succeeded → 无补偿可做。
        // overallStatus 取 "compensated"（vacuous：0 of 0 compensated；与
        // Step 2 reference-saga.ts harness 一致；SagaResultStatus 4 值
        // 集合不含"failed"独立值，"compensated"是最贴近的语义类别）。
        state.overallStatus = "compensated";
      } else {
        const compResult = await runCompensationPhase(state, steps, succeeded);
        if (!compResult.ok) return compResult;
      }
    } else {
      state.overallStatus = "completed";
    }

    // Persist 触发点 6：saga 完成时
    const finalPersist = await persist(state);
    if (!finalPersist.ok) return finalPersist;

    // PersistedSagaStateOverallStatus（6 值）→ SagaResultStatus（4 值）映射
    let sagaResultStatus: SagaResultStatus;
    switch (state.overallStatus) {
      case "completed":
        sagaResultStatus = "completed";
        break;
      case "compensated":
        sagaResultStatus = "compensated";
        break;
      case "partially_compensated":
        sagaResultStatus = "partially_compensated";
        break;
      case "timed_out":
        // Step 8 整体超时实施时进入此分支；本 Step 不会到达此处
        sagaResultStatus = "timed_out";
        break;
      default:
        // in_progress / compensating 不应出现在终态——防御性 fallback
        sagaResultStatus = "completed";
        break;
    }

    const finalOutput =
      sagaResultStatus === "completed" ? (lastOutput as TOutput) : null;

    await auditAppend(AUDIT_EVENT_TYPES.SAGA_COMPLETED, state, {
      overallStatus: sagaResultStatus,
      completedAt: state.lastUpdatedAt,
      stepStatusesSummary: state.stepStatuses.map(s => ({
        name: s.name,
        status: s.status
      }))
    });

    const sagaResult: SagaResult<TOutput> = {
      sagaId: state.sagaId,
      status: sagaResultStatus,
      stepStatuses: state.stepStatuses.slice(),
      finalOutput,
      completedAt: state.lastUpdatedAt
    };

    return ok(sagaResult);
  };

  return { runSaga };
};
