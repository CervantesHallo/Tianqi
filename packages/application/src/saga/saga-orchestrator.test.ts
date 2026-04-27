// Phase 9 / Step 6 + Step 7 + Step 8 — saga-orchestrator 单元测试。
//
// Step 6 起 10 it：工厂签名 / 零步快路径 / persist 触发点 / 逆序补偿 /
// 死信入队 / 状态致命 / 死信降级 / 审计降级 / 7 类审计事件 /
// compensationContext 透传。
//
// Step 7 增量（裁决 5：上限放宽 ≤10 → ≤12）：新增 2 个不变量专项 it。
//   - 不变量 2 专项 it（§4.2 双重幂等保护）：直接验证
//     isStepEligibleForCompensation 8 状态枚举完备性
//   - 不变量 5 专项 it（§4.6 链式继续）：3 step 中 2 个 compensate 失败 →
//     全部入死信 + partially_compensated + 不变量 1/3/5 联动验证
//   - 既有 it 4 升级（不变量 1 增强）：2 step 反向 → 4 step 严格逆序
//
// Step 8 增量（≤12 → ≤16）：新增 4 个超时专项 it。
//   - it 13 单步超时（裁决 1 α）：slowStep 自然耗时 50ms + stepTimeout
//     5ms → TQ-SAG-001 触发 + 进入补偿 + 终态 compensated
//   - it 14 整体 saga 超时 vacuous（裁决 3 R）：sagaTimeout 5ms + 首步
//     slowStep → 整体超时触发 + 终态 timed_out + saga.timed_out 审计事件
//   - it 15 整体 saga 超时含补偿（裁决 3 R）：1 succeeded step + 第 2 步
//     超时整体预算 → 进入补偿 + 终态 compensated（含 timed_out 标记）
//   - it 16 effectiveStepTimeoutMs 混合（裁决 2 B+C）：3 step 中 sagaTimeout
//     比 stepTimeout 紧 → 末步超时由 sagaTimeout 触发而非 stepTimeout
//
// 时序刻意拉开 fast/slow 比例 ≥1:10（KI-P8-003 缓解）：step 自然耗时
// ≥50ms，超时配 ≤5ms 或 ≥500ms，避免与 step 自然耗时形成竞态。
//
// Mock 策略：本测试用 mock ports（可控制 save / append / enqueue 失败行
// 为）；契约测试 saga-orchestrator.contract.test.ts 用真实 in-memory 适
// 配器驱动 Step 2 17 契约 it。两者互补。

import { setTimeout as scheduleTimer } from "node:timers";

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
  SagaStepExecution,
  SagaStepStatus,
  SagaStepStatusSnapshot
} from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";

import {
  AUDIT_EVENT_TYPES,
  aggregateCompensationOutcome,
  createSagaOrchestrator,
  isStepEligibleForCompensation,
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

// Step 8 — slowStep 工厂（natural delay >> timeout 触发 TQ-SAG-001）
const buildSlowStep = (
  name: string,
  delayMs: number,
  recorder: { executes: string[]; compensates: string[] }
): AnyStep => ({
  name,
  async execute(input, _ctx) {
    recorder.executes.push(name);
    await new Promise<void>(resolve => {
      scheduleTimer(resolve, delayMs);
    });
    const exec: SagaStepExecution<unknown, unknown> = {
      output: { stepName: name, input },
      compensationContext: { kind: "slow", stepName: name }
    };
    return ok(exec);
  },
  async compensate(_ctx, _sagaContext) {
    recorder.compensates.push(name);
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
    // Step 7 增强不变量 1（§4.3 严格逆序）：4 succeeded step 后第 5 step 失败，
    // 验证补偿调用顺序严格按 stepIndex 降序 4→3→2→1（中间不跳过任何 step；
    // 失败 step 自身不补偿）。Step 6 原 it 仅 2 step 反向，无法区分"严格逆序"
    // 与"巧合反向"——4 step 是判定不变量 1 的最小可信场景。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const steps = [
      buildSucceedingStep("step-a", recorder),
      buildSucceedingStep("step-b", recorder),
      buildSucceedingStep("step-c", recorder),
      buildSucceedingStep("step-d", recorder),
      buildFailingExecuteStep("step-e-fail", "synthetic execute failure", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c4"), steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated");
      expect(result.value.finalOutput).toBeNull();
    }
    expect(recorder.executes).toEqual([
      "step-a",
      "step-b",
      "step-c",
      "step-d",
      "step-e-fail"
    ]);
    // 不变量 1（§4.3）：严格逆序 d → c → b → a；失败 step 自身不补偿
    expect(recorder.compensates).toEqual(["step-d", "step-c", "step-b", "step-a"]);
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

  // ============================================================
  // Step 7 不变量专项 it
  // ============================================================

  it("test_isStepEligibleForCompensation_returns_true_only_for_succeeded_status", () => {
    // 不变量 2 专项（§4.2 双重幂等保护编排器侧）：直接对 isStepEligibleForCompensation
    // 进行 8 状态枚举完备性测试。这是双重保护的"编排器侧守门"——单点失误不会让
    // 已 compensate 的 step 被再次调用 compensate（避免对已撤销资源重复回滚导致
    // 资金/持仓不一致）。
    //
    // 8 状态语义参考 saga-port.ts SagaStepStatus（§6 段 274-282）。
    const allStatuses: SagaStepStatus[] = [
      "pending",
      "executing",
      "succeeded",
      "failed",
      "compensating",
      "compensated",
      "compensation_failed",
      "dead_lettered"
    ];
    for (const status of allStatuses) {
      const eligible = isStepEligibleForCompensation(status);
      if (status === "succeeded") {
        expect(eligible).toBe(true);
      } else {
        // 任何非 succeeded 都拒绝补偿调用：避免重复 compensate（已 compensated /
        // 已 dead_lettered）；避免错误时机调用（pending / executing）；避免对
        // 失败 execute 的 step 调 compensate（failed——按 §4.3 失败 step 自身
        // 不补偿）；避免重入 compensating 中态。
        expect(eligible).toBe(false);
      }
    }

    // aggregateCompensationOutcome 同样测 8 状态聚合（不变量 5 基础判定）：
    // 仅 dead_lettered 触发 partially_compensated；其他全部聚合为 compensated。
    const buildSnapshot = (status: SagaStepStatus): SagaStepStatusSnapshot => ({
      name: `step-${status}`,
      status,
      failureReason: null
    });
    expect(aggregateCompensationOutcome([])).toBe("compensated");
    expect(aggregateCompensationOutcome([buildSnapshot("compensated")])).toBe(
      "compensated"
    );
    expect(aggregateCompensationOutcome([buildSnapshot("dead_lettered")])).toBe(
      "partially_compensated"
    );
    expect(
      aggregateCompensationOutcome([
        buildSnapshot("compensated"),
        buildSnapshot("dead_lettered"),
        buildSnapshot("compensated")
      ])
    ).toBe("partially_compensated");
  });

  it("test_runSaga_with_chained_compensation_failures_continues_to_completion_with_partially_compensated", async () => {
    // 不变量 5 专项（链式继续 + §4.6）：3 succeeded step 中前 2 个 compensate
    // 失败 + 第 3 个 compensate 成功。验证：
    //   1. 链式继续——前 2 失败不阻断第 3 step 补偿尝试
    //   2. 全部 2 个失败 step 入死信（不变量 3 联动）
    //   3. 终态 partially_compensated（不变量 5 聚合）
    //   4. 严格逆序 step-c → step-b → step-a（不变量 1 联动）
    //   5. saga.step.compensate.outcome 触发 3 次（每个 compensate 1 次）
    //   6. saga.dead_letter.enqueued 触发 2 次（每个失败 1 次）
    //
    // 这是"两次连续 compensate 失败 + 第三步成功"场景——风险点 §E 提及
    // 的关键场景；本 it 验证 audit 事件序列正确性。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const deadLetterStore = createMockDeadLetterStore();
    const auditSink = createMockAuditSink();
    const orchestrator = createSagaOrchestrator({
      sagaStateStore: createMockSagaStateStore(),
      deadLetterStore,
      auditEventSink: auditSink
    });
    const steps = [
      buildSucceedingStep("step-a", recorder), // compensate succeeds
      buildFailingCompensateStep("step-b-bad-compensate", recorder),
      buildFailingCompensateStep("step-c-bad-compensate", recorder),
      buildFailingExecuteStep("step-d-fail", "trigger compensation", recorder)
    ];
    const result = await orchestrator.runSaga(buildInvocation("c12"), steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 不变量 5：终态 partially_compensated（任一 dead_lettered 即降级）
      expect(result.value.status).toBe("partially_compensated");
      expect(result.value.finalOutput).toBeNull();
      // step-a 应 compensated（compensate 成功）；step-b/c 应 dead_lettered
      const statusByName = new Map(
        result.value.stepStatuses.map(s => [s.name, s.status])
      );
      expect(statusByName.get("step-a")).toBe("compensated");
      expect(statusByName.get("step-b-bad-compensate")).toBe("dead_lettered");
      expect(statusByName.get("step-c-bad-compensate")).toBe("dead_lettered");
      expect(statusByName.get("step-d-fail")).toBe("failed");
    }

    // 不变量 1（严格逆序）+ 不变量 5（链式继续）：
    // compensate 触发顺序 c → b → a，链式继续不在 c 失败处中止
    expect(recorder.compensates).toEqual([
      "step-c-bad-compensate",
      "step-b-bad-compensate",
      "step-a"
    ]);

    // 不变量 3（§4.5 死信入队）：2 个失败 step 全部入死信
    expect(deadLetterStore.enqueued.length).toBe(2);
    const dlqStepNames = deadLetterStore.enqueued.map(e => e.stepName);
    expect(dlqStepNames).toContain("step-b-bad-compensate");
    expect(dlqStepNames).toContain("step-c-bad-compensate");

    // 审计事件正确性（每个 compensate 1 个 outcome；每个失败 1 个 dead_letter）
    const compensateOutcomes = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_STEP_COMPENSATE_OUTCOME
    );
    expect(compensateOutcomes.length).toBe(3);
    const dlqEnqueued = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_DEAD_LETTER_ENQUEUED
    );
    expect(dlqEnqueued.length).toBe(2);
  });

  // ============================================================
  // Step 8 超时专项 it（裁决 1-6 行为验证）
  //
  // 时序刻意拉开 fast/slow 比例 ≥1:10（KI-P8-003 缓解）：step 自然耗时
  // ≥50ms，超时配 ≤5ms 或 ≥500ms。
  // ============================================================

  it("test_runSaga_with_step_timeout_triggers_TQ_SAG_001_and_compensation", async () => {
    // 裁决 1（α）单步超时机制：slowStep 自然耗时 50ms + defaultStepTimeoutMs
    // 5ms → withStepTimeout 触发 TQ-SAG-001 → step status "failed" + 进入
    // 补偿 + 终态聚合（无 succeeded → "compensated" vacuous）。
    //
    // 验证 saga.timed_out 事件**不触发**（裁决 4 III：单步超时不触发该
    // 事件，仅整体超时触发；不变量 5 兼容性）。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore: createMockDeadLetterStore(),
        auditEventSink: auditSink
      },
      { defaultStepTimeoutMs: 5 }
    );
    const steps = [buildSlowStep("step-slow", 50, recorder)];
    const result = await orchestrator.runSaga(buildInvocation("c13"), steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("compensated"); // vacuous（裁决 3 R）
      expect(result.value.stepStatuses[0]?.status).toBe("failed");
      expect(result.value.stepStatuses[0]?.failureReason).toBe(
        "step exceeded timeout budget"
      );
    }

    // saga.timed_out 不触发（裁决 4 III）
    const timedOutEvents = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_TIMED_OUT
    );
    expect(timedOutEvents.length).toBe(0);
    // saga.step.execute.outcome 触发 1 次（failed）
    const executeOutcomes = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_STEP_EXECUTE_OUTCOME
    );
    expect(executeOutcomes.length).toBe(1);
  });

  it("test_runSaga_with_overall_saga_timeout_vacuous_emits_saga_timed_out", async () => {
    // 裁决 2 (B+C) + 裁决 3 (R vacuous) + 裁决 4 (III) + 裁决 5 + 裁决 6：
    // defaultSagaTimeoutMs 5ms + 首步 slowStep 自然耗时 50ms → forward
    // 阶段单步 effectiveStepTimeoutMs = min(5000, 5 - elapsed) ≈ 5ms →
    // step 内部 setTimeout race → TQ-SAG-001 触发 → 同时 elapsed >= 5ms
    // → overallTimedOut = true → 终态 timed_out (vacuous，无 succeeded
    // 可补偿) + saga.timed_out 审计事件 1 次（含 4 个 payload 字段全集）。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore: createMockDeadLetterStore(),
        auditEventSink: auditSink
      },
      { defaultSagaTimeoutMs: 5, defaultStepTimeoutMs: 5_000 }
    );
    const steps = [buildSlowStep("step-slow", 50, recorder)];
    // 显式覆盖 invocation.sagaTimeoutMs 为 0 让 options 生效
    const invocation: SagaInvocation<unknown> = {
      ...buildInvocation("c14"),
      sagaTimeoutMs: 0
    };
    const result = await orchestrator.runSaga(invocation, steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 裁决 3 R vacuous：无 succeeded → "timed_out"
      expect(result.value.status).toBe("timed_out");
      expect(result.value.finalOutput).toBeNull();
      expect(result.value.stepStatuses[0]?.status).toBe("failed");
    }

    // saga.timed_out 触发 1 次（裁决 4 III）
    const timedOutEvents = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_TIMED_OUT
    );
    expect(timedOutEvents.length).toBe(1);
    const payload = timedOutEvents[0]?.payload as Record<string, unknown>;
    // payload 4 字段冻结（元规则 B 在审计层级）
    expect(payload.lastExecutingStepName).toBe("step-slow");
    expect(typeof payload.elapsedMs).toBe("number");
    expect(payload.configuredSagaTimeoutMs).toBe(5);
    expect(payload.errorCode).toBe("TQ-SAG-004");
  });

  it("test_runSaga_with_overall_timeout_after_first_step_succeeds_compensates_and_emits_saga_timed_out", async () => {
    // 裁决 3 (R 含补偿)：1 succeeded step + 第 2 步因 sagaTimeout 耗光
    // 触发整体超时 → 进入 runCompensationPhase 补偿第 1 步（不变量 1+2+5
    // 兼容性证据）→ 终态 "compensated"（含 succeeded + 全部 compensated）
    // + saga.timed_out 审计事件 1 次。
    //
    // 时序设计：sagaTimeout 30ms；step-a fast (5ms)；step-b slow (200ms
    // 自然耗时 + effectiveStepTimeout 是 25ms 还剩) → step-b 单步超时
    // 同时 elapsed >= sagaTimeout → overallTimedOut = true。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    const deadLetterStore = createMockDeadLetterStore();
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore,
        auditEventSink: auditSink
      },
      { defaultSagaTimeoutMs: 30, defaultStepTimeoutMs: 5_000 }
    );
    const steps = [
      buildSlowStep("step-a-fast", 5, recorder),
      buildSlowStep("step-b-slow", 200, recorder)
    ];
    const invocation: SagaInvocation<unknown> = {
      ...buildInvocation("c15"),
      sagaTimeoutMs: 0
    };
    const result = await orchestrator.runSaga(invocation, steps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 裁决 3 R：有 succeeded + 全部 compensated → "compensated"
      expect(result.value.status).toBe("compensated");
      // 不变量 1（严格逆序）：补偿仅触发 step-a-fast
      expect(result.value.stepStatuses[0]?.status).toBe("compensated");
      expect(result.value.stepStatuses[1]?.status).toBe("failed");
    }
    // 不变量 1 联动：compensate 调用顺序仅 step-a-fast（step-b-slow 不补偿）
    expect(recorder.compensates).toEqual(["step-a-fast"]);
    // 不变量 3 兼容：补偿成功不入死信
    expect(deadLetterStore.enqueued.length).toBe(0);

    // saga.timed_out 触发 1 次
    const timedOutEvents = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_TIMED_OUT
    );
    expect(timedOutEvents.length).toBe(1);
    expect(
      (timedOutEvents[0]?.payload as Record<string, unknown>).lastExecutingStepName
    ).toBe("step-b-slow");
  });

  it("test_effectiveStepTimeoutMs_clamps_to_remaining_saga_budget", async () => {
    // 裁决 2 B+C 混合：sagaTimeout 紧 (40ms) + stepTimeout 松 (5_000ms) →
    // step-a 自然耗时 30ms 顺利完成；step-b 启动时 elapsed ≈ 30ms，
    // effectiveStepTimeoutMs = min(5_000, 40 - 30) ≈ 10ms；step-b 自然耗
    // 时 200ms → withStepTimeout 在 10ms 而非 5_000ms 触发 TQ-SAG-001。
    //
    // 这验证 stepTimeout 不会"借走"sagaTimeout 之外的时间——effective
    // 计算让单步预算被 sagaTimeout 钳制。
    const recorder = { executes: [] as string[], compensates: [] as string[] };
    const auditSink = createMockAuditSink();
    const orchestrator = createSagaOrchestrator(
      {
        sagaStateStore: createMockSagaStateStore(),
        deadLetterStore: createMockDeadLetterStore(),
        auditEventSink: auditSink
      },
      { defaultSagaTimeoutMs: 40, defaultStepTimeoutMs: 5_000 }
    );
    const steps = [
      buildSlowStep("step-a", 30, recorder),
      buildSlowStep("step-b", 200, recorder)
    ];
    const invocation: SagaInvocation<unknown> = {
      ...buildInvocation("c16"),
      sagaTimeoutMs: 0
    };
    const startedAt = Date.now();
    const result = await orchestrator.runSaga(invocation, steps);
    const elapsed = Date.now() - startedAt;
    expect(result.ok).toBe(true);
    // 实际耗时应远小于 stepTimeout 5_000ms；预期 ≤200ms（含 step-a 30ms +
    // step-b clamp 至 ~10ms 后立即超时 + 补偿耗时）
    expect(elapsed).toBeLessThan(500);
    if (result.ok) {
      // step-b 因 sagaTimeout clamp 而非 stepTimeout 触发超时
      expect(result.value.stepStatuses[1]?.status).toBe("failed");
      expect(result.value.stepStatuses[1]?.failureReason).toBe(
        "step exceeded timeout budget"
      );
    }

    // 整体超时确实触发（saga.timed_out 1 次）
    const timedOutEvents = auditSink.events.filter(
      e => e.eventType === AUDIT_EVENT_TYPES.SAGA_TIMED_OUT
    );
    expect(timedOutEvents.length).toBe(1);
  });
});
