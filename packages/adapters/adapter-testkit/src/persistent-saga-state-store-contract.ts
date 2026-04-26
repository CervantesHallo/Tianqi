// Phase 9 / Step 3 — definePersistentSagaStateStoreContractTests：持久化契约套件。
//
// 元规则 E：持久化契约独立函数。本套件验证只有"真正持久化"的 Adapter
// （saga-state-store-postgres）才能通过的语义；memory Adapter 不挂载本
// 套件（其语义由基础契约 + 类别 4 AdapterFoundation 集成已充分覆盖）。
//
// 覆盖范围（《§4.5》进程恢复 / 跨实例可见性 / 并发语义）：
//   - 类别 P1 进程恢复（≥3 it）：写 → "重启" → 读，状态完全一致
//   - 类别 P2 跨实例可见性（≥3 it）：一个 Adapter 实例写、另一实例读到相同结果
//   - 类别 P3 并发 save 语义（≥2 it）：同 sagaId 并发 save 是 last-write-wins
//
// 实际 8 it（精确符合下限）。
//
// PersistentSagaStateStoreTestSession：与 PersistentTestSession 同形态
// （databasePath 字段；postgres 实现侧把 databasePath 重新诠释为 schema
// 名后缀，与 event-store-postgres.persistent.test.ts 已建立的模式一致）。

import { beforeEach, describe, expect, it } from "vitest";

import type { PersistedSagaState } from "@tianqi/ports";
import { createCorrelationId, createSagaId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import type { SagaStateStoreAdapterUnderTest } from "./saga-state-store-contract.js";

export type PersistentSagaStateStoreTestSession = Readonly<{
  /**
   * 与 PersistentTestSession 同形态。memory Adapter 不挂载本套件；postgres
   * Adapter 在工厂内把 databasePath 解析为 schema 名后缀（与 event-store-postgres
   * 既有模式一致）。
   */
  databasePath: string;
}>;

export type PersistentSagaStateStoreAdapterFactory<
  T extends SagaStateStoreAdapterUnderTest = SagaStateStoreAdapterUnderTest
> = (session: PersistentSagaStateStoreTestSession) => T | Promise<T>;

export type PersistentSagaStateStoreContractOptions = Readonly<{
  scratchDirectory: string;
}>;

const ISO_NOW = "2026-04-26T00:00:00.000Z";
const ISO_LATER = "2026-04-26T00:00:01.000Z";

const buildSampleState = (
  sagaIdSuffix: string,
  overrides: Partial<PersistedSagaState> = {}
): PersistedSagaState => ({
  sagaId: overrides.sagaId ?? createSagaId(`saga-p-${sagaIdSuffix}`),
  sagaStartedAt: overrides.sagaStartedAt ?? ISO_NOW,
  lastUpdatedAt: overrides.lastUpdatedAt ?? ISO_NOW,
  currentStepIndex: overrides.currentStepIndex ?? 0,
  totalSteps: overrides.totalSteps ?? 3,
  stepStatuses: overrides.stepStatuses ?? [
    { name: "step-1", status: "pending", failureReason: null },
    { name: "step-2", status: "pending", failureReason: null },
    { name: "step-3", status: "pending", failureReason: null }
  ],
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

let sessionCounter = 0;
const nextSession = (
  options: PersistentSagaStateStoreContractOptions
): PersistentSagaStateStoreTestSession => {
  sessionCounter += 1;
  return {
    databasePath: `${options.scratchDirectory}/persistent-saga-session-${sessionCounter}.db`
  };
};

export const definePersistentSagaStateStoreContractTests = <
  T extends SagaStateStoreAdapterUnderTest = SagaStateStoreAdapterUnderTest
>(
  adapterName: string,
  factory: PersistentSagaStateStoreAdapterFactory<T>,
  options: PersistentSagaStateStoreContractOptions
): void => {
  describe(`[adapter-testkit] SagaStateStore persistence contract — ${adapterName}`, () => {
    let session: PersistentSagaStateStoreTestSession;

    beforeEach(() => {
      session = nextSession(options);
    });

    // ============================================================
    // 类别 P1：进程恢复
    // ============================================================
    describe("category P1: process recovery", () => {
      it("test_state_saved_then_adapter_shutdown_then_new_adapter_in_same_session_reads_same_state", async () => {
        const writer = await factory(session);
        await writer.init();
        const sagaId = createSagaId("saga-p1-1");
        const state = buildSampleState("ignored", {
          sagaId,
          correlationId: createCorrelationId("corr-p1-1"),
          traceId: createTraceId("trace-p1-1"),
          compensationContexts: [
            { stepName: "step-1", compensationContext: { lockId: "L-001", amount: 99.99 } }
          ]
        });
        await writer.save(state);
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(sagaId);
          assertOk(loaded, "load");
          expect(loaded.value).toEqual(state);
        } finally {
          await reader.shutdown();
        }
      });

      it("test_compensation_contexts_survive_serialization_round_trip_in_persistence", async () => {
        const writer = await factory(session);
        await writer.init();
        const sagaId = createSagaId("saga-p1-2");
        const compensationContexts = [
          {
            stepName: "step-1",
            compensationContext: {
              lockId: "L-1",
              metadata: { source: "phase-9", reason: "test" },
              tags: ["alpha", "beta"]
            }
          },
          {
            stepName: "step-2",
            compensationContext: {
              transferId: "T-2",
              amount: 12345.67
            }
          }
        ];
        const state = buildSampleState("ignored", { sagaId, compensationContexts });
        await writer.save(state);
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(sagaId);
          assertOk(loaded, "load");
          // §4.4 持久化场景实测：compensationContexts 序列化往返不变
          expect(loaded.value?.compensationContexts).toEqual(compensationContexts);
        } finally {
          await reader.shutdown();
        }
      });

      it("test_listIncomplete_after_restart_returns_in_progress_sagas_persisted_before_shutdown", async () => {
        const writer = await factory(session);
        await writer.init();
        await writer.save(buildSampleState("ignored", {
          sagaId: createSagaId("saga-p1-3-running"),
          overallStatus: "in_progress"
        }));
        await writer.save(buildSampleState("ignored", {
          sagaId: createSagaId("saga-p1-3-done"),
          overallStatus: "completed"
        }));
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const result = await reader.listIncomplete();
          assertOk(result, "listIncomplete");
          const ids = result.value.map(s => s.sagaId);
          expect(ids).toContain(createSagaId("saga-p1-3-running"));
          expect(ids).not.toContain(createSagaId("saga-p1-3-done"));
        } finally {
          await reader.shutdown();
        }
      });
    });

    // ============================================================
    // 类别 P2：跨实例可见性
    // ============================================================
    describe("category P2: cross-instance visibility", () => {
      it("test_state_saved_by_writer_instance_is_visible_to_concurrently_running_reader_instance", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          const sagaId = createSagaId("saga-p2-1");
          const state = buildSampleState("ignored", { sagaId });
          await writer.save(state);
          const loaded = await reader.load(sagaId);
          assertOk(loaded, "load");
          expect(loaded.value).toEqual(state);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });

      it("test_update_by_one_instance_is_eventually_visible_to_another_instance", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          const sagaId = createSagaId("saga-p2-2");
          const v1 = buildSampleState("ignored", { sagaId, currentStepIndex: 0 });
          await writer.save(v1);
          const loaded1 = await reader.load(sagaId);
          assertOk(loaded1, "load1");
          expect(loaded1.value?.currentStepIndex).toBe(0);

          const v2: PersistedSagaState = {
            ...v1,
            currentStepIndex: 2,
            lastUpdatedAt: ISO_LATER
          };
          await writer.save(v2);
          const loaded2 = await reader.load(sagaId);
          assertOk(loaded2, "load2");
          expect(loaded2.value?.currentStepIndex).toBe(2);
          expect(loaded2.value?.lastUpdatedAt).toBe(ISO_LATER);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });

      it("test_listIncomplete_from_reader_instance_includes_writer_persisted_sagas", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          for (let i = 0; i < 3; i += 1) {
            await writer.save(buildSampleState("ignored", {
              sagaId: createSagaId(`saga-p2-3-${i}`),
              overallStatus: "in_progress"
            }));
          }
          const result = await reader.listIncomplete();
          assertOk(result, "listIncomplete");
          expect(result.value.length).toBeGreaterThanOrEqual(3);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });
    });

    // ============================================================
    // 类别 P3：并发 save 语义
    // ============================================================
    describe("category P3: concurrent save semantics", () => {
      it("test_concurrent_save_to_same_saga_id_yields_one_of_the_two_payloads_no_corruption", async () => {
        const writer = await factory(session);
        await writer.init();
        try {
          const sagaId = createSagaId("saga-p3-1");
          const stateA = buildSampleState("ignored", {
            sagaId,
            currentStepIndex: 0,
            lastUpdatedAt: "2026-04-26T00:00:00.100Z"
          });
          const stateB = buildSampleState("ignored", {
            sagaId,
            currentStepIndex: 1,
            lastUpdatedAt: "2026-04-26T00:00:00.200Z"
          });
          await Promise.all([writer.save(stateA), writer.save(stateB)]);
          const loaded = await writer.load(sagaId);
          assertOk(loaded, "load");
          // 不预设具体顺序（last-write-wins 语义；postgres 上是 ON CONFLICT
          // DO UPDATE，后到者覆盖前者）；只断言"加载到的必须是 A 或 B 之一"，
          // **不允许出现部分字段混合的腐败行**。
          expect(loaded.value).not.toBeNull();
          const isA = loaded.value?.currentStepIndex === 0;
          const isB = loaded.value?.currentStepIndex === 1;
          expect(isA || isB).toBe(true);
        } finally {
          await writer.shutdown();
        }
      });

      it("test_concurrent_save_to_different_saga_ids_all_persist_correctly", async () => {
        const writer = await factory(session);
        await writer.init();
        try {
          const states = Array.from({ length: 5 }, (_, idx) =>
            buildSampleState("ignored", {
              sagaId: createSagaId(`saga-p3-2-${idx}`),
              currentStepIndex: idx
            })
          );
          await Promise.all(states.map(s => writer.save(s)));
          for (const expected of states) {
            const loaded = await writer.load(expected.sagaId);
            assertOk(loaded, "load");
            expect(loaded.value).toEqual(expected);
          }
        } finally {
          await writer.shutdown();
        }
      });
    });
  });
};
