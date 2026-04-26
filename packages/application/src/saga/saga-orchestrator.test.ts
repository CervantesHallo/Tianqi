// Phase 9 / Step 6 — saga-orchestrator 单元测试（裁决 7：≤10 业务 Engine
// 风格）。10 it 覆盖：工厂签名 / 零步快路径 / persist 触发点 / 逆序补偿 /
// 死信入队 / 状态致命 / 死信降级 / 审计降级 / 7 类审计事件 / compensationContext
// 透传。
//
// Mock 策略：本测试用 mock ports（可控制 save / append / enqueue 失败行
// 为）；契约测试 saga-orchestrator.contract.test.ts 用真实 in-memory 适
// 配器驱动 Step 2 17 契约 it。两者互补。

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";
import { createTraceId } from "@tianqi/shared";

import type {
  AuditEventRecord,
  AuditEventSinkPort,
  DeadLetterEntry,
  DeadLetterStorePort,
  PersistedSagaState,
  SagaContext,
  SagaInvocation,
  SagaPortError,
  SagaStateStoreError,
  SagaStateStorePort,
  SagaStep,
  SagaStepExecution
} from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";

import {
  AUDIT_EVENT_TYPES,
  createSagaOrchestrator,
  type SagaDegradedFailureEvent
} from "./saga-orchestrator.js";

// ============================================================
// Mock Ports
// ============================================================

type MockSagaStateStore = SagaStateStorePort & {
  saves: PersistedSagaState[];
  saveFailureMode?: { failOnNthCall: number; error: SagaStateStoreError };
};

const createMockSagaStateStore = (): MockSagaStateStore => {
  const saves: PersistedSagaState[] = [];
  const store: MockSagaStateStore = {
    saves,
    async save(state) {
      saves.push(state);
      const failure = store.saveFailureMode;
      if (failure && saves.length === failure.failOnNthCall) {
        return err(failure.error);
      }
      return ok(undefined);
    },
    async load(_sagaId) {
      return ok(null);
    },
    async listIncomplete() {
      return ok([]);
    },
    async delete(_sagaId) {
      return ok(undefined);
    }
  };
  return store;
};

type MockDeadLetterStore = DeadLetterStorePort & {
  enqueued: DeadLetterEntry[];
  enqueueFailure: boolean;
};

const createMockDeadLetterStore = (): MockDeadLetterStore => {
  const enqueued: DeadLetterEntry[] = [];
  const store: MockDeadLetterStore = {
    enqueued,
    enqueueFailure: false,
    async enqueue(entry) {
      if (store.enqueueFailure) {
        return err({ message: "synthetic dead-letter store failure" });
      }
      enqueued.push(entry);
      return ok(undefined);
    },
    async load(_id) {
      return ok(null);
    },
    async listPending() {
      return ok([]);
    },
    async listBySaga(_sagaId) {
      return ok([]);
    },
    async markAsProcessed(_id, _processedBy, _notes) {
      return ok(undefined);
    }
  };
  return store;
};

type MockAuditSink = AuditEventSinkPort & {
  events: AuditEventRecord[];
  appendFailure: boolean;
};

const createMockAuditSink = (): MockAuditSink => {
  const events: AuditEventRecord[] = [];
  const sink: MockAuditSink = {
    events,
    appendFailure: false,
    async append(event) {
      if (sink.appendFailure) {
        return err({ message: "synthetic audit sink failure" });
      }
      events.push(event);
      return ok(undefined);
    }
  };
  return sink;
};

// ============================================================
// Step factories（本地最小集；不复制全部 Step 2 fixtures——只构造 unit
// 测试需要的形态）
// ============================================================

type AnyStep = SagaStep<unknown, unknown, unknown>;

const buildSucceedingStep = (
  name: string,
  recorder: { executes: string[]; compensates: string[] }
): AnyStep => ({
  name,
  async execute(input, _ctx) {
    recorder.executes.push(name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, input },
      compensationContext: { kind: "succeeding", stepName: name, capturedInput: input }
    };
    return ok(exec);
  },
  async compensate(_ctx, _sagaContext) {
    recorder.compensates.push(name);
    return ok(undefined);
  }
});

const buildFailingExecuteStep = (
  name: string,
  reason: string,
  recorder: { executes: string[]; compensates: string[] }
): AnyStep => ({
  name,
  async execute(_input, sagaContext: SagaContext) {
    recorder.executes.push(name);
    const error: SagaPortError = {
      code: "TQ-SAG-002",
      sagaId: sagaContext.sagaId,
      stepName: name,
      message: reason
    };
    return err(error);
  },
  async compensate(_ctx, _sagaContext) {
    recorder.compensates.push(name);
    return ok(undefined);
  }
});

const buildFailingCompensateStep = (
  name: string,
  recorder: { executes: string[]; compensates: string[] }
): AnyStep => ({
  name,
  async execute(input, _ctx) {
    recorder.executes.push(name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, input },
      compensationContext: { kind: "fails-on-compensate", stepName: name }
    };
    return ok(exec);
  },
  async compensate(_ctx, sagaContext: SagaContext) {
    recorder.compensates.push(name);
    return err({
      code: "TQ-SAG-003",
      sagaId: sagaContext.sagaId,
      stepName: name,
      message: "synthetic compensate failure"
    });
  }
});

const buildContextEchoStep = (
  name: string,
  payload: Readonly<Record<string, unknown>>,
  recorder: { executes: string[]; compensates: string[]; receivedCtx: Map<string, unknown> }
): AnyStep => ({
  name,
  async execute(input, _ctx) {
    recorder.executes.push(name);
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, input, payload },
      compensationContext: payload
    };
    return ok(exec);
  },
  async compensate(ctx, _sagaContext) {
    recorder.compensates.push(name);
    recorder.receivedCtx.set(name, ctx);
    return ok(undefined);
  }
});

// ============================================================
// Common helpers
// ============================================================

const buildInvocation = (suffix: string): SagaInvocation<unknown> => ({
  sagaId: createSagaId(`saga-unit-${suffix}`),
  traceId: createTraceId(`trace-unit-${suffix}`),
  correlationId: createCorrelationId(`corr-unit-${suffix}`),
  initialInput: undefined,
  sagaTimeoutMs: 60_000
});

// ============================================================
// Tests
// ============================================================

describe("saga-orchestrator: unit tests", () => {

  it("test_factory_returns_orchestrator_with_runSaga_method", () => {
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    expect(typeof orchestrator.runSaga).toBe("function");
  });

  it("test_runSaga_with_zero_steps_returns_completed_immediately", async () => {
    const sagaStateStore = createMockSagaStateStore();
    const orchestrator = createSagaOrchestrator({
      sagaStateStore,
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const result = await orchestrator.runSaga(buildInvocation("c2"), []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
      expect(result.value.stepStatuses).toEqual([]);
      expect(result.value.finalOutput).toBeNull();
    }
    // 仅 saga 启动时 + saga 完成时 = 2 次 persist
    expect(sagaStateStore.saves.length).toBe(2);
  });

  it("test_runSaga_with_all_succeeding_steps_persists_intermediate_state_for_each_step", async () => {
    const sagaStateStore = createMockSagaStateStore();
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const orchestrator = createSagaOrchestrator({
      sagaStateStore,
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const steps = [
      buildSucceedingStep("step-a", recorder),
      buildSucceedingStep("step-b", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c3"), steps);
    expect(result.ok).toBe(true);
    expect(recorder.executes).toEqual(["step-a", "step-b"]);
    expect(recorder.compensates).toEqual([]);
    // 触发点：1 启动 + 2 执行前 + 2 执行后 + 1 完成 = 6 次 persist
    expect(sagaStateStore.saves.length).toBe(6);
    // 终态行
    const final = sagaStateStore.saves[sagaStateStore.saves.length - 1]!;
    expect(final.overallStatus).toBe("completed");
    expect(final.stepStatuses[0]?.status).toBe("succeeded");
    expect(final.stepStatuses[1]?.status).toBe("succeeded");
  });

  it("test_runSaga_with_failing_step_triggers_compensation_in_strict_reverse_order", async () => {
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const steps = [
      buildSucceedingStep("step-a", recorder),
      buildSucceedingStep("step-b", recorder),
      buildFailingExecuteStep("step-c-fail", "synthetic execute failure", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c4"), steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.finalOutput).toBeNull();
    }
    expect(recorder.executes).toEqual(["step-a", "step-b", "step-c-fail"]);
    // 严格逆序补偿：b → a；失败 step 自身不补偿
    expect(recorder.compensates).toEqual(["step-b", "step-a"]);
  });

  it("test_runSaga_with_compensation_failure_enqueues_dead_letter_and_marks_status", async () => {
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const deadLetterStore = createMockDeadLetterStore();
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore,
      auditEventSink: createMockAuditSink()
    });
    const steps = [
      buildFailingCompensateStep("step-a-bad-compensate", recorder),
      buildFailingExecuteStep("step-b-fail", "trigger compensation", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c5"), steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.stepStatuses[0]?.status).toBe("dead_lettered");
    }
    expect(deadLetterStore.enqueued.length).toBe(1);
    const dlqEntry = deadLetterStore.enqueued[0]!;
    expect(dlqEntry.stepName).toBe("step-a-bad-compensate");
    expect(dlqEntry.failureChain[0]).toContain("synthetic compensate failure");
  });

  it("test_runSaga_with_persistence_save_failure_returns_TQ_SAG_002_immediately", async () => {
    const sagaStateStore = createMockSagaStateStore();
    sagaStateStore.saveFailureMode = {
      failOnNthCall: 1, // 启动时第一次 save 即失败
      error: { message: "TQ-INF-009: Postgres unreachable" }
    };
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const orchestrator = createSagaOrchestrator({
      sagaStateStore,
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const steps = [buildSucceedingStep("step-never-runs", recorder)];
    const result = await orchestrator.runSaga(buildInvocation("c6"), steps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-SAG-002");
      expect(result.error.message).toBe("saga state persistence failed");
      expect(result.error.stepName).toBe("<saga-state-persistence>");
    }
    // step.execute 不应被调用（save 失败前置）
    expect(recorder.executes).toEqual([]);
  });

  it("test_runSaga_with_dead_letter_enqueue_failure_invokes_onDegradedFailure_but_continues", async () => {
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const deadLetterStore = createMockDeadLetterStore();
    deadLetterStore.enqueueFailure = true;
    const degradedEvents: SagaDegradedFailureEvent[] = [];
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore,
        auditEventSink: createMockAuditSink()
      },
      {
        onDegradedFailure: event => degradedEvents.push(event)
      }
    );
    const steps = [
      buildFailingCompensateStep("step-a-bad-compensate", recorder),
      buildFailingExecuteStep("step-b-fail", "trigger compensation", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c7"), steps);
    // 降级：DLQ 入队失败但 saga 仍完成
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.stepStatuses[0]?.status).toBe("dead_lettered");
    }
    expect(deadLetterStore.enqueued.length).toBe(0); // 入队失败
    const dlqDegraded = degradedEvents.filter(
      e => e.kind === "dead-letter-enqueue-failed"
    );
    expect(dlqDegraded.length).toBe(1);
    if (dlqDegraded[0]?.kind === "dead-letter-enqueue-failed") {
      expect(dlqDegraded[0].stepName).toBe("step-a-bad-compensate");
      expect(dlqDegraded[0].reason).toContain("synthetic dead-letter store failure");
    }
  });

  it("test_runSaga_with_audit_append_failure_invokes_onDegradedFailure_but_continues", async () => {
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    auditSink.appendFailure = true;
    const degradedEvents: SagaDegradedFailureEvent[] = [];
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore: createMockDeadLetterStore(),
        auditEventSink: auditSink
      },
      {
        onDegradedFailure: event => degradedEvents.push(event)
      }
    );
    const steps = [buildSucceedingStep("step-a", recorder)];
    const result = await orchestrator.runSaga(buildInvocation("c8"), steps);
    // 降级：audit append 失败但 saga 完成
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
    }
    expect(auditSink.events.length).toBe(0); // 全部失败
    const auditDegraded = degradedEvents.filter(
      e => e.kind === "audit-append-failed"
    );
    // 共 saga.started + saga.step.execute.outcome (succeeded) + saga.completed
    // = 3 个 audit append 调用全部失败 = 3 个降级事件
    expect(auditDegraded.length).toBe(3);
    if (auditDegraded[0]?.kind === "audit-append-failed") {
      expect(auditDegraded[0].reason).toContain("synthetic audit sink failure");
    }
  });

  it("test_runSaga_emits_correct_audit_event_types_at_each_phase", async () => {
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: auditSink
    });
    const steps = [
      buildSucceedingStep("step-a", recorder),
      buildFailingExecuteStep("step-b-fail", "trigger compensation", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c9"), steps);
    expect(result.ok).toBe(true);

    const eventTypes = auditSink.events.map(e => e.eventType);
    // 预期事件序列：
    //   saga.started
    //   saga.step.execute.outcome (a succeeded)
    //   saga.step.execute.outcome (b failed)
    //   saga.compensation.started
    //   saga.step.compensate.outcome (a succeeded)
    //   saga.completed
    expect(eventTypes).toEqual([
      AUDIT_EVENT_TYPES.SAGA_STARTED,
      AUDIT_EVENT_TYPES.SAGA_STEP_EXECUTE_OUTCOME,
      AUDIT_EVENT_TYPES.SAGA_STEP_EXECUTE_OUTCOME,
      AUDIT_EVENT_TYPES.SAGA_COMPENSATION_STARTED,
      AUDIT_EVENT_TYPES.SAGA_STEP_COMPENSATE_OUTCOME,
      AUDIT_EVENT_TYPES.SAGA_COMPLETED
    ]);
    // saga.timed_out 类型本 Step 不触发（Step 8 触发）
    expect(eventTypes).not.toContain(AUDIT_EVENT_TYPES.SAGA_TIMED_OUT);
  });

  it("test_runSaga_passes_compensationContext_unchanged_from_execute_to_compensate", async () => {
    const payload: Readonly<Record<string, unknown>> = Object.freeze({
      lockId: "lock-001",
      amount: 9999.99,
      tags: Object.freeze(["primary", "phase-9"])
    });
    const recorder = {
      executes: [] as string[],
      compensates: [] as string[],
      receivedCtx: new Map<string, unknown>()
    };
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const steps = [
      buildContextEchoStep("step-echo", payload, recorder),
      buildFailingExecuteStep("step-fail", "trigger compensation", {
        executes: recorder.executes,
        compensates: recorder.compensates
      })
    ];
    const result = await orchestrator.runSaga(buildInvocation("c10"), steps);
    expect(result.ok).toBe(true);
    // compensate 收到的 ctx 严格等于 execute 返回的 compensationContext（即 payload）
    expect(recorder.receivedCtx.get("step-echo")).toEqual(payload);
  });
});
