// Phase 9 / Step 6 — saga-orchestrator 契约挂载测试。

import { setTimeout as scheduleTimer } from "node:timers";
//
// 一行挂载 Step 2 的 defineSagaContractTests，验证真实 SagaOrchestrator
// 驱动 SagaStep 时仍满足 Sprint F 17 个契约 it（§4 5 条接口纯度约束）。
//
// 这是本 Step 对 Step 2 契约可重用性的关键证明：契约不是被参考实现"骗
// 过"的——任何真实编排器（包括本 Step 的 createSagaOrchestrator）都必
// 须通过同样的 17 it。
//
// 元规则 F 防护：本测试**不**导入 fixtures/reference-saga.ts；本地复制
// step 工厂 + recorder + probe 模式（约 200 LOC）。这样：
//   - 不违反 Adapter 独立（fixtures 是 testkit-only）
//   - 不依赖 testkit 内部实现细节
//   - 让 Step 2 锁定的 SagaContractSubject 形状与本编排器解耦验证
//
// In-memory adapters：用 @tianqi/saga-state-store-memory + @tianqi/dead-letter-store-memory
// + 本文件内联 noop AuditEventSinkPort（AuditEventSinkPort 是 Phase 8 既
// 有 Port，无独立 memory 实现包）。

import { ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import { createTraceId } from "@tianqi/shared";

import {
  defineSagaContractTests,
  type SagaContractDriveOptions,
  type SagaContractDriveResult,
  type SagaContractProbe,
  type SagaContractSubject
} from "@tianqi/adapter-testkit";
import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";
import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";
import type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort,
  SagaContext,
  SagaInvocation,
  SagaPortError,
  SagaStep,
  SagaStepExecution
} from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";

import { createSagaOrchestrator } from "./saga-orchestrator.js";

// ============================================================
// Recorder + Probe（本地复制，与 fixtures/reference-saga.ts 等价）
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

const createProbe = (recorder: Recorder): SagaContractProbe => ({
  __sagaContractProbe: true,
  getExecuteSequence: () => [...recorder.executeOrder],
  getCompensationSequence: () => [...recorder.compensationOrder],
  getCompensationCallCount: name => recorder.compensationCalls.get(name) ?? 0,
  getCompensateContextPayload: name => recorder.compensationContexts.get(name)
});

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

// ============================================================
// Step 工厂（本地复制 6 个工厂；与 reference-saga.ts 行为等价）
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

const buildSucceedingStep = (recorder: Recorder, name: string): AnyStep => ({
  name,
  async execute(input: unknown, _ctx: SagaContext) {
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

const buildFailingStep = (recorder: Recorder, name: string, reason: string): AnyStep => ({
  name,
  async execute(_input: unknown, sagaContext: SagaContext) {
    recordExecute(recorder, name);
    const error: SagaPortError = {
      code: "TQ-SAG-002",
      sagaId: sagaContext.sagaId,
      stepName: name,
      message: reason
    };
    return { ok: false, error };
  },
  async compensate(compensationContext: unknown, _sagaContext: SagaContext) {
    recordCompensate(recorder, name, compensationContext);
    return ok(undefined);
  }
});

const buildSlowStep = (recorder: Recorder, name: string, delayMs: number): AnyStep => ({
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
    return { ok: false, error };
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
    // §4.1 显式空体 + testkit 仍记录 call count
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
// Noop AuditEventSink（契约测试不验证 audit 流向；只验编排器对 SagaStep
// 的契约满足度。AuditEventSinkPort 是 Phase 8 Port，无 in-memory 包）
// ============================================================

const createNoopAuditSink = (): AuditEventSinkPort => ({
  async append(_event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>> {
    return ok(undefined);
  }
});

// ============================================================
// SagaContractSubject 实现：把 SagaOrchestrator 包装成 Subject 形状
// ============================================================

let driveCounter = 0;

const createSagaOrchestratorContractSubject = (): SagaContractSubject => {
  const recorder = createRecorder();
  const probe = createProbe(recorder);

  const drive = async (
    steps: ReadonlyArray<AnyStep>,
    options?: SagaContractDriveOptions
  ): Promise<SagaContractDriveResult> => {
    driveCounter += 1;
    const stamp = `${Date.now()}-${driveCounter}`;
    // 每次 drive 用一对全新的 in-memory adapters（隔离 saga 间状态）
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    try {
      // defaultStepTimeoutMs 取自 SagaContractDriveOptions.stepTimeoutMs；
      // 兜底 1000ms（与 fixtures/reference-saga.ts drive 默认一致）
      const orchestrator = createSagaOrchestrator(
        {
          sagaStateStore,
          deadLetterStore,
          auditEventSink: createNoopAuditSink()
        },
        {
          defaultStepTimeoutMs: options?.stepTimeoutMs ?? 1000
        }
      );
      const invocation: SagaInvocation<unknown> = {
        sagaId: createSagaId(`saga-contract-${stamp}`),
        traceId: createTraceId(`trace-contract-${stamp}`),
        correlationId: createCorrelationId(`corr-contract-${stamp}`),
        initialInput: undefined,
        sagaTimeoutMs: 60_000
      };
      const result = await orchestrator.runSaga<unknown>(invocation, steps);
      if (!result.ok) {
        // in-memory adapters 不应失败；若失败抛错让契约 it 显式失败
        throw new Error(
          `[saga-orchestrator contract] runSaga unexpectedly returned err: ${result.error.message}`
        );
      }
      return { result: result.value };
    } finally {
      await sagaStateStore.shutdown();
      await deadLetterStore.shutdown();
    }
  };

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

// ============================================================
// 一行挂载 Step 2 的 17 契约 it
// ============================================================

defineSagaContractTests("saga-orchestrator", () =>
  createSagaOrchestratorContractSubject()
);
