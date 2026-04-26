// Phase 9 / Step 2 — defineSagaContractTests 的参考实现：SagaStep 工厂集 +
// 最小 Orchestrator harness。
//
// **严格 testkit-only**（元规则 F 防护）：
//   - 本文件不通过 src/index.ts re-export，不出现在 package.json exports
//   - 其他包不得 import @tianqi/adapter-testkit/dist/fixtures/reference-saga.js
//   - 此 harness 不是 Step 6 SagaOrchestrator，不可被生产 saga 使用
//   - harness 实现刻意保持小（单一职责：驱动 SagaStep 数组完成
//     execute → compensate 的契约验证），不实现持久化、不实现死信入队、不
//     实现整体超时
//
// 设计裁决（详见 docs/phase9/02 §C）：
//   - 裁决 4 (B)：参考实现暴露 SagaStep 工厂 + drive 驱动函数；
//     drive 是 testkit 工具，非产品级编排器
//   - 裁决 5 (Q)：单 Step 超时由 harness 用 Promise.race 管理，
//     SagaStep 接口不感知 AbortSignal（保元规则 B）
//
// 工厂行为概要（详见各工厂 JSDoc）：
//   - succeedingStep：execute 与 compensate 都 ok；记录 sequence + count
//   - failingStep：execute 返回 TQ-SAG-002 err；compensate 仍 ok（防止"失败 Step
//     被错误地当作 succeeded 而触发逆序补偿"——通过 harness 流程隔离）
//   - slowStep：execute 等待 delayMs；compensate 立即 ok
//   - succeedingStepWithFailingCompensate：execute ok；compensate 返回 TQ-SAG-003 err
//   - emptyCompensateStep：execute ok；compensate 是显式空体（《§4.1》"无副作用 Step
//     的 compensate 允许空实现，但必须显式声明"）—— testkit 仍记录 call
//     count 用于 probe 观察
//   - contextEchoStep：execute 把 caller 提供的 payload 同时作为 output 与
//     compensationContext 返回；compensate 记录收到的 ctx 到 probe；用于
//     《§4.4》上下文承载断言

import {
  setTimeout as scheduleTimer,
  clearTimeout as clearScheduledTimer
} from "node:timers";

import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type {
  SagaContext,
  SagaPortError,
  SagaResult,
  SagaResultStatus,
  SagaStep,
  SagaStepExecution,
  SagaStepStatus,
  SagaStepStatusSnapshot
} from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import type { SagaContractProbe } from "../saga-contract-probe.js";

// ============================================================
// Recorder：单个 Subject 内所有 Step 共享的可变记录器
// ============================================================

type Recorder = {
  executeOrder: string[];
  compensationOrder: string[];
  compensationCalls: Map<string, number>;
  compensationContexts: Map<string, unknown>;
};

const createRecorder = (): Recorder => ({
  executeOrder: [],
  compensationOrder: [],
  compensationCalls: new Map(),
  compensationContexts: new Map()
});

// 把 recorder 包成 SagaContractProbe 只读视图。每次 getXxx 返回独立副本，
// 保证 probe 消费者无法通过返回值 mutate recorder 内部状态。
const createProbeForRecorder = (recorder: Recorder): SagaContractProbe => ({
  __sagaContractProbe: true,
  getExecuteSequence: () => [...recorder.executeOrder],
  getCompensationSequence: () => [...recorder.compensationOrder],
  getCompensationCallCount: stepName => recorder.compensationCalls.get(stepName) ?? 0,
  getCompensateContextPayload: stepName => recorder.compensationContexts.get(stepName)
});

// ============================================================
// Step 工厂集（每个工厂关闭于 recorder，所属 Subject 共享）
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

const recordExecute = (recorder: Recorder, name: string): void => {
  recorder.executeOrder.push(name);
};

const recordCompensate = (recorder: Recorder, name: string, ctx: unknown): void => {
  const prev = recorder.compensationCalls.get(name) ?? 0;
  const next = prev + 1;
  recorder.compensationCalls.set(name, next);
  if (next === 1) {
    recorder.compensationOrder.push(name);
    recorder.compensationContexts.set(name, ctx);
  }
};

const buildSucceedingStep = (recorder: Recorder, name: string): AnyStep => ({
  name,
  async execute(input: unknown, _sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, capturedInput: input },
      compensationContext: { kind: "succeeding", stepName: name, capturedInput: input }
    };
    return ok(exec);
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

const buildFailingStep = (
  recorder: Recorder,
  name: string,
  reason: string
): AnyStep => ({
  name,
  async execute(_input: unknown, sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const error: SagaPortError = {
      code: "TQ-SAG-002",
      sagaId: sagaContext.sagaId,
      stepName: name,
      message: reason
    };
    return err(error);
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    // 即使被误调用也记录（用于"失败 Step 不应被补偿"的 negative-evidence 断言）。
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

const buildSlowStep = (
  recorder: Recorder,
  name: string,
  delayMs: number
): AnyStep => ({
  name,
  async execute(input: unknown, _sagaContext: SagaContext) {
    recordExecute(recorder, name);
    await new Promise<void>(resolve => {
      scheduleTimer(resolve, delayMs);
    });
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, capturedInput: input },
      compensationContext: { kind: "slow", stepName: name }
    };
    return ok(exec);
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

const buildSucceedingStepWithFailingCompensate = (
  recorder: Recorder,
  name: string
): AnyStep => ({
  name,
  async execute(input: unknown, _sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, capturedInput: input },
      compensationContext: { kind: "fails-on-compensate", stepName: name }
    };
    return ok(exec);
  },
  async compensate(compensationContext: unknown, sagaContext: SagaContext) {
    recordCompensate(recorder, name, compensationContext);
    const error: SagaPortError = {
      code: "TQ-SAG-003",
      sagaId: sagaContext.sagaId,
      stepName: name,
      message: "synthetic compensate failure"
    };
    return err(error);
  }
});

const buildEmptyCompensateStep = (recorder: Recorder, name: string): AnyStep => ({
  name,
  async execute(input: unknown, _sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, capturedInput: input },
      compensationContext: { kind: "no-op", stepName: name }
    };
    return ok(exec);
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    // §4.1 显式空体：无副作用 Step 的 compensate 仍必须存在。
    // testkit 仍记录 call count 让 probe 验证它"被调用过"（不是被跳过）。
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

const buildContextEchoStep = (
  recorder: Recorder,
  name: string,
  contextPayload: Readonly<Record<string, unknown>>
): AnyStep => ({
  name,
  async execute(input: unknown, _sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, capturedInput: input, payload: contextPayload },
      compensationContext: contextPayload
    };
    return ok(exec);
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

// ============================================================
// 最小 Orchestrator harness（drive）
// ============================================================

export type SagaContractDriveOptions = {
  /**
   * 单 Step 超时（毫秒）。harness 用 Promise.race 把 step.execute /
   * step.compensate 包成超时受控的 task；超时即产出 TQ-SAG-001 错误。
   *
   * 默认 1000。设小（如 50）模拟超时；设大（如 5000）模拟正常运行。
   */
  readonly stepTimeoutMs?: number;
};

export type SagaContractDriveResult = {
  readonly result: SagaResult<unknown>;
};

// 用 Promise.race 在 stepTimeoutMs 内决定 task 是 ok / err 还是 timeout。
// 超时时产出 TQ-SAG-001。task 本身不会被 abort（《§4.7》单 Step 超时由
// 编排器侧管理；Step 1 接口不引入 AbortSignal——元规则 B）；超时之后 task
// 仍然在后台运行，但 harness 不再消费其结果（GC 友好；测试场景下不会泄漏
// 资源）。
const runWithTimeout = async <T>(
  task: () => Promise<Result<T, SagaPortError>>,
  timeoutMs: number,
  sagaId: ReturnType<typeof createSagaId>,
  stepName: string
): Promise<Result<T, SagaPortError>> => {
  let timer: ReturnType<typeof scheduleTimer> | undefined;
  const timeoutPromise = new Promise<Result<T, SagaPortError>>(resolve => {
    timer = scheduleTimer(() => {
      const timeoutErr: SagaPortError = {
        code: "TQ-SAG-001",
        sagaId,
        stepName,
        message: "step exceeded timeout budget"
      };
      resolve(err(timeoutErr));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(), timeoutPromise]);
  } finally {
    if (timer !== undefined) clearScheduledTimer(timer);
  }
};

// 非 monotonic 唯一 id 生成器（仅用于 testkit 内部 saga id 区分）。
let driveCounter = 0;

// drive 不持有 recorder 引用——recorder 已被各 step 工厂闭包捕获；drive 的
// 唯一职责是按顺序调度 step.execute / step.compensate（含超时控制）+ 汇总
// SagaResult。这一隔离让 drive 可被未来 Step 6 的 SagaOrchestrator 直接替
// 换而无需触碰 recorder 设计。
const drive =
  async (
    steps: ReadonlyArray<AnyStep>,
    options?: SagaContractDriveOptions
  ): Promise<SagaContractDriveResult> => {
    const stepTimeoutMs = options?.stepTimeoutMs ?? 1000;
    driveCounter += 1;
    const stamp = `${Date.now()}-${driveCounter}`;
    const sagaId = createSagaId(`saga-test-${stamp}`);
    const traceId = createTraceId(`trace-test-${stamp}`);
    const correlationId = createCorrelationId(`corr-test-${stamp}`);
    const sagaStartedAt = new Date().toISOString();

    const stepStatuses: SagaStepStatusSnapshot[] = steps.map(s => ({
      name: s.name,
      status: "pending" as SagaStepStatus,
      failureReason: null
    }));

    type SucceededEntry = {
      readonly idx: number;
      readonly compensationContext: unknown;
    };
    const succeeded: SucceededEntry[] = [];
    let firstFailureIdx = -1;
    let currentInput: unknown = undefined;
    let lastOutput: unknown = null;

    // 前向阶段
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]!;
      stepStatuses[i] = { ...stepStatuses[i]!, status: "executing" };
      const sagaContext: SagaContext = {
        sagaId,
        traceId,
        correlationId,
        sagaStartedAt,
        currentStepIndex: i,
        totalSteps: steps.length
      };
      const execResult = await runWithTimeout(
        () => step.execute(currentInput, sagaContext),
        stepTimeoutMs,
        sagaId,
        step.name
      );
      if (!execResult.ok) {
        stepStatuses[i] = {
          ...stepStatuses[i]!,
          status: "failed",
          failureReason: execResult.error.message
        };
        firstFailureIdx = i;
        break;
      }
      succeeded.push({ idx: i, compensationContext: execResult.value.compensationContext });
      stepStatuses[i] = { ...stepStatuses[i]!, status: "succeeded" };
      currentInput = execResult.value.output;
      lastOutput = execResult.value.output;
    }

    // 补偿阶段
    let sagaResultStatus: SagaResultStatus = "completed";
    let finalOutput: unknown = null;

    if (firstFailureIdx >= 0) {
      // 失败：逆序补偿已 succeeded 的 Step
      let allCompensated = true;
      for (let j = succeeded.length - 1; j >= 0; j -= 1) {
        const entry = succeeded[j]!;
        const step = steps[entry.idx]!;
        stepStatuses[entry.idx] = { ...stepStatuses[entry.idx]!, status: "compensating" };
        const sagaContext: SagaContext = {
          sagaId,
          traceId,
          correlationId,
          sagaStartedAt,
          currentStepIndex: entry.idx,
          totalSteps: steps.length
        };
        const compResult = await runWithTimeout(
          () => step.compensate(entry.compensationContext, sagaContext),
          stepTimeoutMs,
          sagaId,
          step.name
        );
        if (!compResult.ok) {
          allCompensated = false;
          // 《§4.5》补偿失败 → 死信。harness 把状态直接置为 "dead_lettered"
          // （SagaStepStatus 枚举的终态），不在中间停留 "compensation_failed"。
          // Step 4 的 DeadLetterStore Adapter 会承担"实际入队"行为；本 harness
          // 仅生成对应状态供 SagaResult 反映。
          stepStatuses[entry.idx] = {
            ...stepStatuses[entry.idx]!,
            status: "dead_lettered",
            failureReason: compResult.error.message
          };
        } else {
          stepStatuses[entry.idx] = { ...stepStatuses[entry.idx]!, status: "compensated" };
        }
      }
      // 失败但无可补偿 Step（首步即失败）：按 SagaResultStatus 现有 4 值最贴近
      // 的语义是 "compensated"（vacuously true：0 of 0 succeeded steps compensated）。
      // 《§4》语义一致性由 stepStatuses 承担——用 stepStatuses[0].status === "failed"
      // 即可观察"saga 因首步失败而中止"。SagaResult.status 是高层归类；契约测试
      // 主要通过 stepStatuses + probe 做断言，不在此 edge case 上纠缠。
      sagaResultStatus = allCompensated ? "compensated" : "partially_compensated";
    } else {
      // 全部成功
      sagaResultStatus = "completed";
      finalOutput = lastOutput;
    }

    return {
      result: {
        sagaId,
        status: sagaResultStatus,
        stepStatuses,
        finalOutput,
        completedAt: new Date().toISOString()
      }
    };
  };

// ============================================================
// 对外 SagaContractSubject 接口（供 saga-contract.ts 与自测共享）
// ============================================================

export type ReferenceSagaSubject = {
  readonly __sagaContractSubject: true;
  /** 总是成功的 Step。compensate 返回 ok。*/
  readonly succeedingStep: (name: string) => AnyStep;
  /** execute 必失败（TQ-SAG-002）的 Step。compensate 即使被误调用也 ok。 */
  readonly failingStep: (name: string, reason?: string) => AnyStep;
  /** execute 等待 delayMs 后才 ok 的 Step（用于触发 harness 的 stepTimeoutMs）。 */
  readonly slowStep: (name: string, delayMs: number) => AnyStep;
  /** execute 成功，但 compensate 必失败（TQ-SAG-003）的 Step。 */
  readonly succeedingStepWithFailingCompensate: (name: string) => AnyStep;
  /** execute 成功，compensate 显式空实现（《§4.1》read-only Step 模式）。 */
  readonly emptyCompensateStep: (name: string) => AnyStep;
  /** execute 把 caller 提供的 payload 作为 output 与 compensationContext 返回。 */
  readonly contextEchoStep: (
    name: string,
    payload: Readonly<Record<string, unknown>>
  ) => AnyStep;
  /** 驱动 step 数组完成 saga 编排。返回 SagaResult。 */
  readonly drive: (
    steps: ReadonlyArray<AnyStep>,
    options?: SagaContractDriveOptions
  ) => Promise<SagaContractDriveResult>;
  /** 只读观察面（共享 recorder）。 */
  readonly probe: SagaContractProbe;
};

export const createReferenceSagaSubject = (): ReferenceSagaSubject => {
  const recorder = createRecorder();
  const probe = createProbeForRecorder(recorder);
  return {
    __sagaContractSubject: true,
    succeedingStep: name => buildSucceedingStep(recorder, name),
    failingStep: (name, reason = "synthetic execute failure") =>
      buildFailingStep(recorder, name, reason),
    slowStep: (name, delayMs) => buildSlowStep(recorder, name, delayMs),
    succeedingStepWithFailingCompensate: name =>
      buildSucceedingStepWithFailingCompensate(recorder, name),
    emptyCompensateStep: name => buildEmptyCompensateStep(recorder, name),
    contextEchoStep: (name, payload) => buildContextEchoStep(recorder, name, payload),
    drive,
    probe
  };
};
