// Phase 9 / Step 6 — SagaOrchestrator 核心实现。
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
  // runCompensationPhase —— Step 7 钩子（私有）
  // 严格逆序补偿已 succeeded 的 step；compensate 失败 → dead_lettered +
  // DLQ enqueue + saga.step.compensate.outcome (failed) + saga.dead_letter.enqueued。
  // Step 7 增强补偿幂等保证时仅扩展本方法。
  // ============================================================
  const runCompensationPhase = async (
    state: InternalSagaState,
    steps: ReadonlyArray<SagaStep<unknown, unknown, unknown>>,
    succeeded: ReadonlyArray<{ idx: number; compensationContext: unknown }>
  ): Promise<Result<void, SagaPortError>> => {
    state.overallStatus = "compensating";
    const persistEntry = await persist(state);
    if (!persistEntry.ok) return persistEntry;

    const failedStepName = state.stepStatuses[state.currentStepIndex]?.name ?? "<unknown>";
    await auditAppend(AUDIT_EVENT_TYPES.SAGA_COMPENSATION_STARTED, state, {
      failedStepName,
      succeededStepNames: succeeded.map(s => steps[s.idx]!.name)
    });

    let allCompensated = true;
    for (let j = succeeded.length - 1; j >= 0; j -= 1) {
      const entry = succeeded[j]!;
      const step = steps[entry.idx]!;

      // Persist: status → compensating
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
        allCompensated = false;
        const failureReason = compResult.error.message;
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
      }
    }

    state.overallStatus = allCompensated ? "compensated" : "partially_compensated";
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
