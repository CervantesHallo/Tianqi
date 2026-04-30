// Phase 9 / Step 12 — insurance-fund-saga 契约挂载测试。
//
// 一行挂载 Step 2 的 defineSagaContractTests，验证 InsuranceFundSaga
// 内部使用的 SagaOrchestrator 配置（在 Sprint H 业务模块内组装）仍满足
// Sprint F 17 个契约 it（§4 5 条接口纯度约束）。
//
// 这是 Phase 9 **第三次在业务 Saga 上挂载 Sprint F 契约**——证明业务
// 模板从 Step 10/11 复制到 Step 12 后（业务复杂度更低，4 step 紧凑模
// 式，单账户场景）契约仍守住。**Sprint H 模板"双向可复用性"反向验
// 证**：高复杂度（Step 11 ADL 多账户）+ 低复杂度（Step 12 InsuranceFund
// 4 step 紧凑单账户）两端都守住，模板才真正可复用。
//
// 元规则 F 防护：本测试**不**导入 fixtures/reference-saga.ts；本地复制
// step 工厂 + recorder + probe 模式（约 200 LOC）。这样：
//   - 不违反 Adapter 独立（fixtures 是 testkit-only）
//   - 不依赖 testkit 内部实现细节
//   - 让 Step 2 锁定的 SagaContractSubject 形状与本业务 Saga 解耦验证
//
// In-memory adapters：用 @tianqi/saga-state-store-memory + @tianqi/dead-letter-store-memory
// + 内联 noop AuditEventSinkPort（与 saga-orchestrator.contract.test.ts
// 同模式）。

import { setTimeout as scheduleTimer } from "node:timers";

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
// Recorder + Probe（本地复制 saga-orchestrator.contract.test.ts 模式）
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
// Step 工厂（本地复制 6 个；与 reference-saga.ts 行为等价）
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
// Noop AuditEventSink
// ============================================================

const createNoopAuditSink = (): AuditEventSinkPort => ({
  async append(_event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>> {
    return ok(undefined);
  }
});

// ============================================================
// SagaContractSubject 实现：业务 Saga 内部 SagaOrchestrator 配置驱动契约
//
// 关键证据：本 driver 使用与 InsuranceFundSaga 内部组装编排器相同的
// createSagaOrchestrator 调用 + 相同的 in-memory 持久化基础设施。当
// InsuranceFundSaga 通过 SagaOrchestrator 调度业务 step（4 step 紧凑模
// 式，单账户场景）时，编排器仍满足 Sprint F 17 契约 it——业务复杂度
// 低于 Step 10/11 同样契约不破，证明 Sprint H 模板对低复杂度业务也
// 完全可复用。
// ============================================================

let driveCounter = 0;

const createInsuranceFundSagaContractSubject = (): SagaContractSubject => {
  const recorder = createRecorder();
  const probe = createProbe(recorder);

  const drive = async (
    steps: ReadonlyArray<AnyStep>,
    options?: SagaContractDriveOptions
  ): Promise<SagaContractDriveResult> => {
    driveCounter += 1;
    const stamp = `${Date.now()}-${driveCounter}`;
    const sagaStateStore = createInMemorySagaStateStore();
    const deadLetterStore = createInMemoryDeadLetterStore();
    await sagaStateStore.init();
    await deadLetterStore.init();
    try {
      // 与 LiquidationSaga 内部组装编排器相同的 createSagaOrchestrator 调
      // 用形态——验证业务 Saga 模板使用 SagaOrchestrator 时仍守 17 契约
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
        sagaId: createSagaId(`saga-insurance-fund-contract-${stamp}`),
        traceId: createTraceId(`trace-insurance-fund-contract-${stamp}`),
        correlationId: createCorrelationId(`corr-insurance-fund-contract-${stamp}`),
        initialInput: undefined,
        sagaTimeoutMs: 60_000
      };
      const result = await orchestrator.runSaga<unknown>(invocation, steps);
      if (!result.ok) {
        throw new Error(
          `[insurance-fund-saga contract] runSaga unexpectedly returned err: ${result.error.message}`
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
// 一行挂载 Step 2 的 17 契约 it（Phase 9 第三次在业务 Saga 上挂载；
// Step 12 是 Sprint H 模板"低复杂度业务"反向可复用性的关键证据）
// ============================================================

defineSagaContractTests("insurance-fund-saga", () =>
  createInsuranceFundSagaContractSubject()
);
