// Phase 9 / Step 4 — defineDeadLetterStoreContractTests：基础契约套件。
//
// 覆盖范围（《§4.6》接口部分；进程恢复 / 跨实例可见性 / 状态变更跨重启
// 一致性由 definePersistentDeadLetterStoreContractTests 单独承担）：
//   - 类别 1 enqueue/load 基础（≥3 it）
//   - 类别 2 listPending 过滤正确性（≥3 it）
//   - 类别 3 listBySaga 查询语义（≥2 it）
//   - 类别 4 markAsProcessed 状态变更（≥3 it）
//   - 类别 5 AdapterFoundation 集成（≥3 it）
//
// 实际 14 it（每类别精确符合下限）。每 it 命名遵循三段式（《§20.3》）。
//
// 设计裁决（详见 docs/decisions/0002 Step 4 段）：
//   - 不引入 DeadLetterStoreContractProbe（与 Step 3 同思路）：5 方法接
//     口本身已足够支撑契约断言（克制 > 堆砌）

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  AdapterFoundation,
  DeadLetterEntry,
  DeadLetterStorePort
} from "@tianqi/ports";
import { createDeadLetterId, createSagaId } from "@tianqi/ports";

export type DeadLetterStoreAdapterUnderTest = DeadLetterStorePort & AdapterFoundation;

export type DeadLetterStoreAdapterFactory<
  T extends DeadLetterStoreAdapterUnderTest = DeadLetterStoreAdapterUnderTest
> = () => T | Promise<T>;

export type DeadLetterStoreContractOptions = Readonly<Record<string, never>>;

const ISO_NOW = "2026-04-26T00:00:00.000Z";
const ISO_LATER = "2026-04-26T00:00:01.000Z";

const buildSampleEntry = (
  entryIdSuffix: string,
  overrides: Partial<DeadLetterEntry> = {}
): DeadLetterEntry => ({
  entryId: overrides.entryId ?? createDeadLetterId(`dlq-${entryIdSuffix}`),
  sagaId: overrides.sagaId ?? createSagaId(`saga-${entryIdSuffix}`),
  stepName: overrides.stepName ?? "step-default",
  status: overrides.status ?? "pending",
  enqueuedAt: overrides.enqueuedAt ?? ISO_NOW,
  attemptCount: overrides.attemptCount ?? 1,
  compensationContext: overrides.compensationContext ?? { kind: "default" },
  failureChain: overrides.failureChain ?? ["compensation_unreachable"],
  correlationId: overrides.correlationId ?? null,
  traceId: overrides.traceId ?? null,
  lastAttemptAt: overrides.lastAttemptAt ?? null,
  processedAt: overrides.processedAt ?? null,
  processedBy: overrides.processedBy ?? null,
  processingNotes: overrides.processingNotes ?? null
});

function assertOk<T, E>(
  result: { ok: true; value: T } | { ok: false; error: E },
  label: string
): asserts result is { ok: true; value: T } {
  if (!result.ok) {
    throw new Error(`expected ${label} to succeed but got error`);
  }
}

export const defineDeadLetterStoreContractTests = <
  T extends DeadLetterStoreAdapterUnderTest = DeadLetterStoreAdapterUnderTest
>(
  adapterName: string,
  factory: DeadLetterStoreAdapterFactory<T>,
  _options?: DeadLetterStoreContractOptions
): void => {
  describe(`[adapter-testkit] DeadLetterStore contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.shutdown();
    });

    // ============================================================
    // 类别 1：enqueue / load 基础
    // ============================================================
    describe("category 1: enqueue and load", () => {
      it("test_enqueued_entry_can_be_loaded_with_full_field_fidelity", async () => {
        const entry = buildSampleEntry("c1-1", {
          attemptCount: 3,
          lastAttemptAt: ISO_NOW,
          compensationContext: { lockId: "L-001", amount: 9999 },
          failureChain: [
            "compensation_failed_due_to_unreachable_downstream",
            "circuit_breaker_open",
            "downstream_health_degraded"
          ]
        });
        const enqueueResult = await adapter.enqueue(entry);
        assertOk(enqueueResult, "enqueue");

        const loadResult = await adapter.load(entry.entryId);
        assertOk(loadResult, "load");
        expect(loadResult.value).not.toBeNull();
        expect(loadResult.value).toEqual(entry);
      });

      it("test_load_returns_null_for_unknown_entry_id", async () => {
        const unknownId = createDeadLetterId("dlq-not-enqueued");
        const result = await adapter.load(unknownId);
        assertOk(result, "load");
        expect(result.value).toBeNull();
      });

      it("test_failure_chain_is_preserved_as_array_in_order", async () => {
        const entry = buildSampleEntry("c1-3", {
          failureChain: ["proximate_cause", "intermediate_cause", "root_cause"]
        });
        await adapter.enqueue(entry);
        const loaded = await adapter.load(entry.entryId);
        assertOk(loaded, "load");
        // §6.5 转译纪律延续：failureChain 是 domain moniker 链，按顺序保留
        expect(loaded.value?.failureChain).toEqual([
          "proximate_cause",
          "intermediate_cause",
          "root_cause"
        ]);
      });
    });

    // ============================================================
    // 类别 2：listPending 过滤正确性
    // ============================================================
    describe("category 2: listPending filtering", () => {
      it("test_listPending_returns_only_pending_entries", async () => {
        // pending + processed + archived 各 1
        await adapter.enqueue(
          buildSampleEntry("c2-1-pending", { status: "pending" })
        );
        await adapter.enqueue(
          buildSampleEntry("c2-1-processed", {
            status: "processed",
            processedAt: ISO_LATER,
            processedBy: "ops-1"
          })
        );
        await adapter.enqueue(
          buildSampleEntry("c2-1-archived", { status: "archived" })
        );
        const result = await adapter.listPending();
        assertOk(result, "listPending");
        const ids = result.value.map(e => e.entryId);
        expect(ids).toContain(createDeadLetterId("dlq-c2-1-pending"));
        expect(ids).not.toContain(createDeadLetterId("dlq-c2-1-processed"));
        expect(ids).not.toContain(createDeadLetterId("dlq-c2-1-archived"));
      });

      it("test_listPending_returns_empty_array_when_no_pending_entries", async () => {
        // 仅有 processed 状态
        await adapter.enqueue(
          buildSampleEntry("c2-2", {
            status: "processed",
            processedAt: ISO_NOW,
            processedBy: "ops-1"
          })
        );
        const result = await adapter.listPending();
        assertOk(result, "listPending");
        expect(result.value).toEqual([]);
      });

      it("test_listPending_returns_full_entry_objects_not_truncated_views", async () => {
        const entry = buildSampleEntry("c2-3", {
          attemptCount: 5,
          compensationContext: { lockId: "L-c2-3", complex: { nested: true } },
          failureChain: ["a", "b", "c"]
        });
        await adapter.enqueue(entry);
        const result = await adapter.listPending();
        assertOk(result, "listPending");
        const found = result.value.find(e => e.entryId === entry.entryId);
        expect(found).toEqual(entry);
      });
    });

    // ============================================================
    // 类别 3：listBySaga 查询语义
    // ============================================================
    describe("category 3: listBySaga query", () => {
      it("test_listBySaga_returns_all_entries_regardless_of_status", async () => {
        const sagaId = createSagaId("saga-c3-1");
        await adapter.enqueue(
          buildSampleEntry("c3-1-a", { sagaId, status: "pending" })
        );
        await adapter.enqueue(
          buildSampleEntry("c3-1-b", {
            sagaId,
            status: "processed",
            processedAt: ISO_LATER,
            processedBy: "ops-1"
          })
        );
        await adapter.enqueue(
          buildSampleEntry("c3-1-c", { sagaId, status: "archived" })
        );
        const result = await adapter.listBySaga(sagaId);
        assertOk(result, "listBySaga");
        const statuses = result.value.map(e => e.status).sort();
        expect(statuses).toEqual(["archived", "pending", "processed"]);
      });

      it("test_listBySaga_returns_empty_array_when_no_entries_for_saga", async () => {
        const sagaId = createSagaId("saga-c3-2-empty");
        const result = await adapter.listBySaga(sagaId);
        assertOk(result, "listBySaga");
        expect(result.value).toEqual([]);
      });
    });

    // ============================================================
    // 类别 4：markAsProcessed 状态变更
    // ============================================================
    describe("category 4: markAsProcessed state transition", () => {
      it("test_markAsProcessed_changes_pending_entry_to_processed_state_with_metadata", async () => {
        const entry = buildSampleEntry("c4-1");
        await adapter.enqueue(entry);
        const result = await adapter.markAsProcessed(
          entry.entryId,
          "ops-alice",
          "verified manually unlock succeeded via downstream check"
        );
        assertOk(result, "markAsProcessed");

        const loaded = await adapter.load(entry.entryId);
        assertOk(loaded, "load");
        expect(loaded.value?.status).toBe("processed");
        expect(loaded.value?.processedBy).toBe("ops-alice");
        expect(loaded.value?.processingNotes).toBe(
          "verified manually unlock succeeded via downstream check"
        );
        expect(loaded.value?.processedAt).not.toBeNull();
      });

      it("test_markAsProcessed_without_notes_records_null_processingNotes", async () => {
        const entry = buildSampleEntry("c4-2");
        await adapter.enqueue(entry);
        const result = await adapter.markAsProcessed(entry.entryId, "ops-bob");
        assertOk(result, "markAsProcessed");
        const loaded = await adapter.load(entry.entryId);
        assertOk(loaded, "load");
        expect(loaded.value?.processingNotes).toBeNull();
        expect(loaded.value?.processedBy).toBe("ops-bob");
      });

      it("test_markAsProcessed_for_unknown_entry_id_is_idempotent_no_op", async () => {
        const unknownId = createDeadLetterId("dlq-c4-3-unknown");
        const result = await adapter.markAsProcessed(unknownId, "ops-1");
        // 幂等：未知 entryId 不抛错，返回 ok
        assertOk(result, "markAsProcessed-unknown");
      });
    });

    // ============================================================
    // 类别 5：AdapterFoundation 集成
    // ============================================================
    describe("category 5: AdapterFoundation integration", () => {
      it("test_health_check_reports_healthy_after_init", async () => {
        const status = await adapter.healthCheck();
        expect(status.healthy).toBe(true);
        expect(status.adapterName).toBe(adapter.adapterName);
      });

      it("test_health_check_does_not_throw_even_after_shutdown", async () => {
        await adapter.shutdown();
        const status = await adapter.healthCheck();
        // 元规则 I：healthCheck 不抛错；shutdown 后 healthy=false
        expect(status.adapterName).toBe(adapter.adapterName);
        expect(typeof status.healthy).toBe("boolean");
        // re-init for afterEach（与 Step 3 同模式：init 后 shut_down 静默 no-op）
        await adapter.init();
      });

      it("test_enqueue_after_shutdown_returns_TQ_INF_023_error", async () => {
        await adapter.shutdown();
        const entry = buildSampleEntry("c5-3");
        const result = await adapter.enqueue(entry);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.message).toContain("TQ-INF-023");
        }
        // re-init for afterEach
        await adapter.init();
      });
    });
  });
};
