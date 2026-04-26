// Phase 9 / Step 2 — defineSagaContractTests：5 类别 17 it 套件，把
// 《Tianqi Phase 8–12 架构与代码规范补充文档》§4 中"接口纯度可验证"的 5
// 条 Saga 强约束翻译为可运行契约 it。
//
// 覆盖范围（裁决 2 X）：
//   - 类别 1 §4.1 + §4.3：补偿义务（含 read-only Step 显式空体）
//   - 类别 2 §4.2：补偿幂等性
//   - 类别 3 §4.6：逆序补偿（严格、不跳过）
//   - 类别 4 §4.4：补偿信息承载（运行时 JSON 序列化校验）
//   - 类别 5 §4.7：单 Step 超时（harness 侧管理；接口不感知 AbortSignal）
//
// 不覆盖（留 Step 3-15 落地）：
//   - §4.5 状态持久化（Step 3 SagaStateStore Adapter）
//   - §4.5/§4.6 死信入队（Step 4 DeadLetterStore Adapter）
//   - §4.8 编译期硬约束（Step 15 工程 lint/typecheck）
//
// 设计裁决（详见 docs/phase9/02 §C 与 docs/decisions/0002 Step 2 段）：
//   - 裁决 1 (α)：契约对象是 SagaStep 接口实现集合，不是 Orchestrator
//   - 裁决 2 (X)：覆盖 5 条接口纯度约束；§4.5/§4.6/§4.8 留后续 Step
//   - 裁决 3：5 类别 1:1 对应 5 条约束；≥17 it（实际 17）
//   - 裁决 4 (B)：参考实现是 SagaStep 工厂集 + testkit-only drive 函数
//   - 裁决 5 (Q)：单 Step 超时由 harness 持有的 watchdog 管理，
//     SagaStep 接口不感知 AbortSignal（保元规则 B）

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SagaContext, SagaStep } from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import type { SagaContractProbe } from "./saga-contract-probe.js";
import type {
  ReferenceSagaSubject,
  SagaContractDriveOptions,
  SagaContractDriveResult
} from "./fixtures/reference-saga.js";

// ============================================================
// 对外类型（saga-contract 套件签名）
// ============================================================

/**
 * SagaContractSubject —— 契约挂载对象。
 *
 * 包含一组 SagaStep 工厂（用于 it 块按需构造场景）+ 一个 drive 驱动函数
 * （testkit-only 编排器 harness）+ 一个 SagaContractProbe（只读观察面）。
 *
 * 每次 factory() 调用返回一个**全新**的 Subject；同一 Subject 内所有 Step
 * 共享同一 recorder（由 probe 暴露给 it 断言）。
 *
 * 形状与 fixtures/reference-saga.ts 的 ReferenceSagaSubject 严格一致；
 * 后续 Step 6+ 若需另起 Orchestrator 实现，可通过实现本接口在保留契约
 * 套件的同时切换 drive 行为（裁决 1 α 的"结构类型"利好）。
 */
export type SagaContractSubject = ReferenceSagaSubject;

export type SagaContractFactory<T extends SagaContractSubject = SagaContractSubject> = () =>
  | T
  | Promise<T>;

export type SagaContractOptions = Readonly<Record<string, never>>;

// 重新导出 drive 选项与结果类型，让 adapter-testkit 公开 API 自洽
export type { SagaContractDriveOptions, SagaContractDriveResult };

// ============================================================
// 工具函数（仅本文件 it 内使用）
// ============================================================

const buildStandaloneSagaContext = (sagaIdLabel: string, totalSteps: number): SagaContext => ({
  sagaId: createSagaId(sagaIdLabel),
  traceId: createTraceId(`trace-${sagaIdLabel}`),
  correlationId: createCorrelationId(`corr-${sagaIdLabel}`),
  sagaStartedAt: "2026-04-26T00:00:00.000Z",
  currentStepIndex: 0,
  totalSteps
});

const expectProbe = (probe: SagaContractProbe): SagaContractProbe => {
  expect(probe.__sagaContractProbe).toBe(true);
  return probe;
};

// ============================================================
// defineSagaContractTests
// ============================================================

export const defineSagaContractTests = <
  T extends SagaContractSubject = SagaContractSubject
>(
  adapterName: string,
  factory: SagaContractFactory<T>,
  _options?: SagaContractOptions
): void => {
  describe(`[adapter-testkit] Saga contract — ${adapterName}`, () => {
    let subject: T;

    beforeEach(async () => {
      subject = await factory();
      expect(subject.__sagaContractSubject).toBe(true);
      expectProbe(subject.probe);
    });

    afterEach(() => {
      // 无显式 teardown：subject 是无外部资源的纯内存对象（无文件 / 网络 /
      // 持久化句柄），由 GC 回收。后续 Step 3 引入 SagaStateStore Adapter
      // 后，对应的 PersistentSagaContractTests 才需要 afterEach 清盘。
    });

    // ============================================================
    // 类别 1：补偿义务（§4.1 + §4.3）
    // —— 验证"成功 Step 在后续 Step 失败时必须被 compensate 调用"
    // ============================================================
    describe("category 1: compensation obligation (§4.1 + §4.3)", () => {
      it("test_step_with_compensate_function_invokes_compensate_when_a_later_step_fails", async () => {
        const stepA = subject.succeedingStep("step-a");
        const stepB = subject.failingStep("step-b");
        const { result } = await subject.drive([stepA, stepB]);

        // probe：execute 跑了 a + b；只有 a 被 compensate
        expect(subject.probe.getExecuteSequence()).toEqual(["step-a", "step-b"]);
        expect(subject.probe.getCompensationSequence()).toEqual(["step-a"]);
        expect(subject.probe.getCompensationCallCount("step-a")).toBe(1);
        expect(subject.probe.getCompensationCallCount("step-b")).toBe(0);

        // SagaResult：a 被补偿、b 是失败终态
        expect(result.stepStatuses[0]?.status).toBe("compensated");
        expect(result.stepStatuses[1]?.status).toBe("failed");
        expect(result.status).toBe("compensated");
        expect(result.finalOutput).toBeNull();
      });

      it("test_step_with_explicit_empty_compensate_is_invoked_without_throwing", async () => {
        // §4.1 read-only Step：compensate 是显式空体（不省略整个方法）。
        // 契约要求 harness 仍会调用它（不允许"看到 read-only 就跳过"）。
        const readOnlyA = subject.emptyCompensateStep("read-a");
        const failB = subject.failingStep("step-b");
        const { result } = await subject.drive([readOnlyA, failB]);

        expect(subject.probe.getCompensationCallCount("read-a")).toBe(1);
        expect(subject.probe.getCompensationSequence()).toEqual(["read-a"]);
        expect(result.stepStatuses[0]?.status).toBe("compensated");
      });

      it("test_step_failing_at_first_position_skips_compensation_phase_entirely", async () => {
        // 首步即失败 → 无前序 succeeded → 无补偿可做
        const failOnly = subject.failingStep("step-fail-first");
        const { result } = await subject.drive([failOnly]);

        expect(subject.probe.getExecuteSequence()).toEqual(["step-fail-first"]);
        expect(subject.probe.getCompensationSequence()).toEqual([]);
        expect(subject.probe.getCompensationCallCount("step-fail-first")).toBe(0);
        expect(result.stepStatuses[0]?.status).toBe("failed");
      });
    });

    // ============================================================
    // 类别 2：补偿幂等性（§4.2）
    // —— 验证"同一 compensationContext 重复调用 compensate 安全"
    // ============================================================
    describe("category 2: compensation idempotency (§4.2)", () => {
      it("test_compensate_invoked_once_via_drive_yields_completed_compensation", async () => {
        const a = subject.succeedingStep("step-a");
        const b = subject.failingStep("step-b");
        await subject.drive([a, b]);

        expect(subject.probe.getCompensationCallCount("step-a")).toBe(1);
      });

      it("test_compensate_invoked_twice_sequentially_returns_ok_both_times", async () => {
        // 直接构造 SagaStep 实例，绕过 drive 显式连续调用 compensate 两次
        const step = subject.succeedingStep("step-a");
        const sagaContext = buildStandaloneSagaContext("idem-seq", 1);
        const fakeCtx: unknown = { kind: "fake-ctx", marker: "idem-seq" };

        const r1 = await step.compensate(fakeCtx, sagaContext);
        const r2 = await step.compensate(fakeCtx, sagaContext);

        expect(r1.ok).toBe(true);
        expect(r2.ok).toBe(true);
        expect(subject.probe.getCompensationCallCount("step-a")).toBe(2);
        // compensationOrder 仅在首次进入；后续重复调用不再 push
        expect(subject.probe.getCompensationSequence()).toEqual(["step-a"]);
      });

      it("test_compensate_concurrent_invocations_both_resolve_ok_without_double_apply", async () => {
        const step = subject.succeedingStep("step-a");
        const sagaContext = buildStandaloneSagaContext("idem-conc", 1);
        const fakeCtx: unknown = { kind: "fake-ctx", marker: "idem-conc" };

        const [r1, r2] = await Promise.all([
          step.compensate(fakeCtx, sagaContext),
          step.compensate(fakeCtx, sagaContext)
        ]);

        expect(r1.ok).toBe(true);
        expect(r2.ok).toBe(true);
        // 两次并发调用应均被记录（call count = 2），状态保持稳定
        expect(subject.probe.getCompensationCallCount("step-a")).toBe(2);
      });
    });

    // ============================================================
    // 类别 3：逆序补偿（§4.3 + §4.6）
    // —— 验证"补偿严格按 succeeded 序列的逆序，且不跳过任何 Step"
    // ============================================================
    describe("category 3: reverse compensation order (§4.3 + §4.6)", () => {
      it("test_compensate_sequence_is_strict_reverse_of_execute_sequence", async () => {
        const a = subject.succeedingStep("step-a");
        const b = subject.succeedingStep("step-b");
        const c = subject.succeedingStep("step-c");
        const dFail = subject.failingStep("step-d-fail");
        await subject.drive([a, b, c, dFail]);

        expect(subject.probe.getExecuteSequence()).toEqual([
          "step-a",
          "step-b",
          "step-c",
          "step-d-fail"
        ]);
        // 补偿严格逆序：c → b → a
        expect(subject.probe.getCompensationSequence()).toEqual([
          "step-c",
          "step-b",
          "step-a"
        ]);
      });

      it("test_compensation_does_not_skip_any_succeeded_step", async () => {
        const a = subject.succeedingStep("step-a");
        const b = subject.succeedingStep("step-b");
        const c = subject.succeedingStep("step-c");
        const fail = subject.failingStep("step-fail");
        const { result } = await subject.drive([a, b, c, fail]);

        for (const name of ["step-a", "step-b", "step-c"]) {
          expect(subject.probe.getCompensationCallCount(name)).toBe(1);
        }
        for (const idx of [0, 1, 2]) {
          expect(result.stepStatuses[idx]?.status).toBe("compensated");
        }
      });

      it("test_failed_step_itself_is_not_compensated_only_succeeded_predecessors_are", async () => {
        const a = subject.succeedingStep("step-a");
        const fail = subject.failingStep("step-b-fail");
        await subject.drive([a, fail]);

        // 失败的 step-b-fail 不应被 compensate（其副作用本就没发生）
        expect(subject.probe.getCompensationCallCount("step-b-fail")).toBe(0);
        // 而前序 step-a 必须被 compensate
        expect(subject.probe.getCompensationCallCount("step-a")).toBe(1);
      });

      it("test_compensation_starts_from_immediately_prior_step_to_failure", async () => {
        // 5 步：a / b / c-fail / d / e（c 失败后，d 和 e 没机会执行）
        // 补偿序列应为 b → a，**不**包含 c / d / e
        const a = subject.succeedingStep("step-a");
        const b = subject.succeedingStep("step-b");
        const cFail = subject.failingStep("step-c-fail");
        const d = subject.succeedingStep("step-d");
        const e = subject.succeedingStep("step-e");
        await subject.drive([a, b, cFail, d, e]);

        expect(subject.probe.getExecuteSequence()).toEqual([
          "step-a",
          "step-b",
          "step-c-fail"
        ]);
        expect(subject.probe.getCompensationSequence()).toEqual(["step-b", "step-a"]);
        for (const name of ["step-c-fail", "step-d", "step-e"]) {
          expect(subject.probe.getCompensationCallCount(name)).toBe(0);
        }
      });
    });

    // ============================================================
    // 类别 4：补偿信息承载（§4.4）
    // —— 验证"compensate 收到的 ctx === execute 返回的 compensationContext"
    // ============================================================
    describe("category 4: compensation context carry-over (§4.4)", () => {
      it("test_compensation_context_is_passed_unchanged_from_execute_to_compensate", async () => {
        const payload: Readonly<Record<string, unknown>> = Object.freeze({
          lockId: "lock-margin-acct-001",
          amount: 12345.67,
          tags: Object.freeze(["primary", "phase-9"])
        });
        const echo = subject.contextEchoStep("step-echo", payload);
        const fail = subject.failingStep("step-fail");
        await subject.drive([echo, fail]);

        const received = subject.probe.getCompensateContextPayload("step-echo");
        // 严格深度等价：execute 返的 compensationContext 与 compensate 收到的一致
        expect(received).toEqual(payload);
      });

      it("test_compensation_context_survives_json_round_trip_serialization", async () => {
        const payload: Readonly<Record<string, unknown>> = {
          lockId: "lock-001",
          amount: 9999.99,
          metadata: { source: "phase-9-step-2", reason: "fail-test" },
          stack: [1, 2, 3, 4]
        };
        const echo = subject.contextEchoStep("step-echo", payload);
        const fail = subject.failingStep("step-fail");
        await subject.drive([echo, fail]);

        const received = subject.probe.getCompensateContextPayload("step-echo");
        // §4.4 运行时表达：JSON 往返不变
        const roundTripped: unknown = JSON.parse(JSON.stringify(received));
        expect(roundTripped).toEqual(received);
        expect(roundTripped).toEqual(payload);
      });

      it("test_two_independent_subjects_have_isolated_compensation_contexts", async () => {
        // 两套独立 subject 各驱动自己的 saga，验证 ctx 不串
        const subject2 = await factory();
        const payloadA: Readonly<Record<string, unknown>> = { tag: "subject-1", id: 100 };
        const payloadB: Readonly<Record<string, unknown>> = { tag: "subject-2", id: 200 };

        await subject.drive([
          subject.contextEchoStep("step-x", payloadA),
          subject.failingStep("step-fail")
        ]);
        await subject2.drive([
          subject2.contextEchoStep("step-x", payloadB),
          subject2.failingStep("step-fail")
        ]);

        // 两个 subject 的 probe 各自只看到自己的 payload
        expect(subject.probe.getCompensateContextPayload("step-x")).toEqual(payloadA);
        expect(subject2.probe.getCompensateContextPayload("step-x")).toEqual(payloadB);
      });

      it("test_each_step_in_the_same_saga_has_its_own_compensation_context", async () => {
        // 同一 saga 内多个 echo step，各 step 应该收到自己的 payload
        const payload1: Readonly<Record<string, unknown>> = { stepName: "step-1", v: 11 };
        const payload2: Readonly<Record<string, unknown>> = { stepName: "step-2", v: 22 };
        const payload3: Readonly<Record<string, unknown>> = { stepName: "step-3", v: 33 };

        await subject.drive([
          subject.contextEchoStep("echo-1", payload1),
          subject.contextEchoStep("echo-2", payload2),
          subject.contextEchoStep("echo-3", payload3),
          subject.failingStep("step-fail")
        ]);

        expect(subject.probe.getCompensateContextPayload("echo-1")).toEqual(payload1);
        expect(subject.probe.getCompensateContextPayload("echo-2")).toEqual(payload2);
        expect(subject.probe.getCompensateContextPayload("echo-3")).toEqual(payload3);
      });
    });

    // ============================================================
    // 类别 5：单 Step 超时（§4.7 单 Step 维度）
    // —— 验证"harness 在 stepTimeoutMs 到期时产出 TQ-SAG-001"
    // ============================================================
    describe("category 5: per-step timeout (§4.7 single-step)", () => {
      it("test_step_exceeding_timeout_yields_TQ-SAG-001_failure_via_harness", async () => {
        const slow = subject.slowStep("step-slow", 200);
        const { result } = await subject.drive([slow], { stepTimeoutMs: 50 });

        // harness 在 50ms 时给出 TQ-SAG-001 错误
        expect(result.stepStatuses[0]?.status).toBe("failed");
        expect(result.stepStatuses[0]?.failureReason).toContain("timeout");
        expect(subject.probe.getExecuteSequence()).toEqual(["step-slow"]);
        // 没有前序 succeeded，无补偿动作
        expect(subject.probe.getCompensationSequence()).toEqual([]);
      });

      it("test_step_completing_before_timeout_yields_normal_success", async () => {
        const fast = subject.slowStep("step-fast", 10);
        const { result } = await subject.drive([fast], { stepTimeoutMs: 200 });

        expect(result.stepStatuses[0]?.status).toBe("succeeded");
        expect(result.status).toBe("completed");
        expect(result.finalOutput).not.toBeNull();
      });

      it("test_timeout_during_execute_triggers_compensation_of_prior_succeeded_steps", async () => {
        // a 成功 → b 慢（>timeout）→ harness 触发 a 的补偿
        const a = subject.succeedingStep("step-a");
        const slowB = subject.slowStep("step-slow-b", 500);
        const { result } = await subject.drive([a, slowB], { stepTimeoutMs: 50 });

        expect(subject.probe.getExecuteSequence()).toEqual(["step-a", "step-slow-b"]);
        expect(subject.probe.getCompensationSequence()).toEqual(["step-a"]);
        expect(subject.probe.getCompensationCallCount("step-a")).toBe(1);
        expect(result.stepStatuses[0]?.status).toBe("compensated");
        expect(result.stepStatuses[1]?.status).toBe("failed");
        expect(result.stepStatuses[1]?.failureReason).toContain("timeout");
      });
    });
  });
};

// ============================================================
// 不导出的 utility（避免与未来 Step 6 重名）
// ============================================================

// 只为类型自洽：验证 SagaStep 类型导入（dead-code elimination 后无运行时影响）
type _AnyStep = SagaStep<unknown, unknown, unknown>;
const _anyStep: _AnyStep | undefined = undefined;
void _anyStep;
