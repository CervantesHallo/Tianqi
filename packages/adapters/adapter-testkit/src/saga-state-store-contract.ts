// Phase 9 / Step 3 — defineSagaStateStoreContractTests：基础契约套件。
//
// 覆盖范围（《§4.5》接口纯度部分；进程恢复 / 跨实例可见性 / 并发 save
// 由 definePersistentSagaStateStoreContractTests 单独承担）：
//   - 类别 1 save/load 基础（≥3 it）
//   - 类别 2 upsert 语义（≥3 it）
//   - 类别 3 listIncomplete 过滤正确性（≥3 it）
//   - 类别 4 AdapterFoundation 集成（≥3 it）
//
// 实际 12 it（精确符合下限）。每 it 命名遵循三段式（《§20.3》）。
//
// 设计裁决（详见 docs/decisions/0002 Step 3 段）：
//   - 不引入 SagaStateStoreContractProbe（裁决 5）—— save/load/listIncomplete
//     接口本身已足够支撑契约断言（克制 > 堆砌）

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  AdapterFoundation,
  PersistedCompensationEntry,
  PersistedSagaState,
  PersistedSagaStateOverallStatus,
  SagaStateStorePort,
  SagaStepStatusSnapshot
} from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";
import type { SagaId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

export type SagaStateStoreAdapterUnderTest = SagaStateStorePort & AdapterFoundation;

export type SagaStateStoreAdapterFactory<
  T extends SagaStateStoreAdapterUnderTest = SagaStateStoreAdapterUnderTest
> = () => T | Promise<T>;

export type SagaStateStoreContractOptions = Readonly<Record<string, never>>;

const ISO_NOW = "2026-04-26T00:00:00.000Z";
const ISO_LATER = "2026-04-26T00:00:01.000Z";

const buildStepStatuses = (
  count: number,
  initialStatus:
    | "pending"
    | "executing"
    | "succeeded"
    | "failed"
    | "compensating"
    | "compensated"
    | "compensation_failed"
    | "dead_lettered" = "pending"
): SagaStepStatusSnapshot[] =>
  Array.from({ length: count }, (_, idx) => ({
    name: `step-${idx + 1}`,
    status: initialStatus,
    failureReason: null
  }));

const buildSampleState = (
  sagaIdSuffix: string,
  overrides: Partial<PersistedSagaState> = {}
): PersistedSagaState => ({
  sagaId: overrides.sagaId ?? createSagaId(`saga-${sagaIdSuffix}`),
  sagaStartedAt: overrides.sagaStartedAt ?? ISO_NOW,
  lastUpdatedAt: overrides.lastUpdatedAt ?? ISO_NOW,
  currentStepIndex: overrides.currentStepIndex ?? 0,
  totalSteps: overrides.totalSteps ?? 3,
  stepStatuses: overrides.stepStatuses ?? buildStepStatuses(3, "pending"),
  compensationContexts: overrides.compensationContexts ?? [],
  overallStatus: overrides.overallStatus ?? "in_progress",
  correlationId: overrides.correlationId ?? null,
  traceId: overrides.traceId ?? null
});

function assertOk<T, E>(
  result: { ok: true; value: T } | { ok: false; error: E },
  label: string
): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(`expected ${label} to succeed but got error`);
  }
}

export const defineSagaStateStoreContractTests = <
  T extends SagaStateStoreAdapterUnderTest = SagaStateStoreAdapterUnderTest
>(
  adapterName: string,
  factory: SagaStateStoreAdapterFactory<T>,
  _options?: SagaStateStoreContractOptions
): void => {
  describe(`[adapter-testkit] SagaStateStore contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.shutdown();
    });

    // ============================================================
    // 类别 1：save / load 基础
    // ============================================================
    describe("category 1: save and load", () => {
      it("test_saved_state_can_be_loaded_with_full_field_fidelity", async () => {
        const state = buildSampleState("c1-1", {
          correlationId: createCorrelationId("corr-c1-1"),
          traceId: createTraceId("trace-c1-1"),
          stepStatuses: [
            { name: "step-1", status: "succeeded", failureReason: null },
            { name: "step-2", status: "pending", failureReason: null }
          ],
          totalSteps: 2,
          currentStepIndex: 1,
          compensationContexts: [
            { stepName: "step-1", compensationContext: { lockId: "L-001" } }
          ]
        });
        const saveResult = await adapter.save(state);
        assertOk(saveResult, "save");

        const loadResult = await adapter.load(state.sagaId);
        assertOk(loadResult, "load");
        expect(loadResult.value).not.toBeNull();
        expect(loadResult.value).toEqual(state);
      });

      it("test_load_returns_null_for_unknown_saga_id", async () => {
        const unknownId = createSagaId("saga-not-saved");
        const result = await adapter.load(unknownId);
        assertOk(result, "load");
        expect(result.value).toBeNull();
      });

      it("test_save_is_atomic_partial_field_updates_do_not_leak", async () => {
        // 同 sagaId 第一次 save 含 traceId；第二次 save 同 sagaId 但
        // traceId=null。load 必须严格反映"第二次 save 全字段"，不允许保
        // 留第一次的 traceId。
        const sagaId = createSagaId("saga-c1-3");
        const initial = buildSampleState("ignored", {
          sagaId,
          traceId: createTraceId("trace-initial"),
          correlationId: createCorrelationId("corr-initial")
        });
        await adapter.save(initial);
        const updated: PersistedSagaState = {
          ...initial,
          traceId: null,
          correlationId: null,
          lastUpdatedAt: ISO_LATER
        };
        await adapter.save(updated);
        const loaded = await adapter.load(sagaId);
        assertOk(loaded, "load");
        expect(loaded.value).toEqual(updated);
        expect(loaded.value?.traceId).toBeNull();
        expect(loaded.value?.correlationId).toBeNull();
      });
    });

    // ============================================================
    // 类别 2：upsert 语义
    // ============================================================
    describe("category 2: upsert semantics", () => {
      it("test_save_with_existing_saga_id_overwrites_in_last_write_wins", async () => {
        const sagaId = createSagaId("saga-c2-1");
        const v1 = buildSampleState("ignored", {
          sagaId,
          currentStepIndex: 0,
          stepStatuses: buildStepStatuses(3, "pending"),
          overallStatus: "in_progress"
        });
        await adapter.save(v1);
        const v2: PersistedSagaState = {
          ...v1,
          currentStepIndex: 2,
          lastUpdatedAt: ISO_LATER,
          stepStatuses: [
            { name: "step-1", status: "succeeded", failureReason: null },
            { name: "step-2", status: "succeeded", failureReason: null },
            { name: "step-3", status: "executing", failureReason: null }
          ]
        };
        await adapter.save(v2);
        const loaded = await adapter.load(sagaId);
        assertOk(loaded, "load");
        expect(loaded.value).toEqual(v2);
      });

      it("test_save_repeated_with_identical_payload_is_idempotent_no_observable_drift", async () => {
        const sagaId = createSagaId("saga-c2-2");
        const state = buildSampleState("ignored", { sagaId });
        for (let i = 0; i < 3; i += 1) {
          await adapter.save(state);
        }
        const loaded = await adapter.load(sagaId);
        assertOk(loaded, "load");
        expect(loaded.value).toEqual(state);
      });

      it("test_save_updates_compensation_contexts_array_completely_replacing_previous", async () => {
        const sagaId = createSagaId("saga-c2-3");
        const v1 = buildSampleState("ignored", {
          sagaId,
          compensationContexts: [
            { stepName: "step-1", compensationContext: { lockId: "L-1" } }
          ]
        });
        await adapter.save(v1);
        const replacedContexts: PersistedCompensationEntry[] = [
          { stepName: "step-1", compensationContext: { lockId: "L-1-new" } },
          { stepName: "step-2", compensationContext: { lockId: "L-2" } }
        ];
        const v2: PersistedSagaState = { ...v1, compensationContexts: replacedContexts };
        await adapter.save(v2);
        const loaded = await adapter.load(sagaId);
        assertOk(loaded, "load");
        expect(loaded.value?.compensationContexts).toEqual(replacedContexts);
      });
    });

    // ============================================================
    // 类别 3：listIncomplete 过滤正确性
    // ============================================================
    describe("category 3: listIncomplete filtering", () => {
      it("test_listIncomplete_returns_only_in_progress_or_compensating_states", async () => {
        const ids: SagaId[] = [];
        const statuses: PersistedSagaStateOverallStatus[] = [
          "in_progress",
          "compensating",
          "completed",
          "compensated",
          "partially_compensated",
          "timed_out"
        ];
        for (const status of statuses) {
          const sagaId = createSagaId(`saga-c3-1-${status}`);
          ids.push(sagaId);
          await adapter.save(buildSampleState("ignored", { sagaId, overallStatus: status }));
        }
        const result = await adapter.listIncomplete();
        assertOk(result, "listIncomplete");
        const returnedStatuses = result.value.map(s => s.overallStatus).sort();
        expect(returnedStatuses).toEqual(["compensating", "in_progress"]);
      });

      it("test_listIncomplete_returns_empty_array_when_no_saga_persisted", async () => {
        const result = await adapter.listIncomplete();
        assertOk(result, "listIncomplete");
        expect(result.value).toEqual([]);
      });

      it("test_listIncomplete_returns_full_state_objects_not_truncated_views", async () => {
        const sagaId = createSagaId("saga-c3-3");
        const fullState = buildSampleState("ignored", {
          sagaId,
          overallStatus: "in_progress",
          correlationId: createCorrelationId("corr-c3-3"),
          traceId: createTraceId("trace-c3-3"),
          compensationContexts: [
            { stepName: "step-1", compensationContext: { kind: "x" } }
          ]
        });
        await adapter.save(fullState);
        const result = await adapter.listIncomplete();
        assertOk(result, "listIncomplete");
        const found = result.value.find(s => s.sagaId === sagaId);
        expect(found).toEqual(fullState);
      });
    });

    // ============================================================
    // 类别 4：AdapterFoundation 集成
    // ============================================================
    describe("category 4: AdapterFoundation integration", () => {
      it("test_health_check_reports_healthy_after_init", async () => {
        const status = await adapter.healthCheck();
        expect(status.healthy).toBe(true);
        expect(status.adapterName).toBe(adapter.adapterName);
      });

      it("test_health_check_does_not_throw_even_after_shutdown", async () => {
        await adapter.shutdown();
        const status = await adapter.healthCheck();
        // 元规则 I：healthCheck 不抛错；shutdown 后仍可返回（healthy: false）
        expect(status.adapterName).toBe(adapter.adapterName);
        expect(typeof status.healthy).toBe("boolean");
        // re-init for afterEach shutdown
        await adapter.init();
      });

      it("test_save_after_shutdown_returns_TQ_INF_020_error", async () => {
        await adapter.shutdown();
        const state = buildSampleState("c4-3");
        const result = await adapter.save(state);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain("TQ-INF-020");
        }
        // re-init for afterEach
        await adapter.init();
      });

      it("test_init_is_idempotent_calling_twice_does_not_corrupt_state", async () => {
        // adapter 已被 beforeEach init 一次；再次调用不应抛错且不破坏既有数据
        await adapter.init();
        const sagaId = createSagaId("saga-c4-4");
        const state = buildSampleState("ignored", { sagaId });
        await adapter.save(state);
        await adapter.init(); // 第三次（仍幂等）
        const loaded = await adapter.load(sagaId);
        assertOk(loaded, "load");
        expect(loaded.value).toEqual(state);
      });
    });
  });
};
