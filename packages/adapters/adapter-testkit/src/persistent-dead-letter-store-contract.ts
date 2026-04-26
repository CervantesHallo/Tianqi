// Phase 9 / Step 4 — definePersistentDeadLetterStoreContractTests：持久化契约。
//
// 元规则 E（持久化契约独立函数，第三次实战）。本套件验证只有"真正持久
// 化"的 Adapter（dead-letter-store-postgres）才能通过的语义；memory
// Adapter 不挂载本套件。
//
// 覆盖范围（《§4.6》进程恢复 / 跨实例可见性 / 状态变更跨重启一致性）：
//   - 类别 P1 跨重启恢复（≥3 it）
//   - 类别 P2 跨实例可见性（≥3 it）
//   - 类别 P3 状态变更跨重启一致性（≥2 it）
//
// 实际 8 it（每类别精确符合下限）。
//
// PersistentDeadLetterStoreTestSession：与 PersistentTestSession /
// PersistentSagaStateStoreTestSession 同形态（databasePath 字段；postgres
// 实现侧把 databasePath 重新诠释为 schema 名后缀，与既有持久化 Adapter
// 模式一致）。

import { beforeEach, describe, expect, it } from "vitest";

import type { DeadLetterEntry } from "@tianqi/ports";
import { createDeadLetterId, createSagaId } from "@tianqi/ports";

import type { DeadLetterStoreAdapterUnderTest } from "./dead-letter-store-contract.js";

export type PersistentDeadLetterStoreTestSession = Readonly<{
  databasePath: string;
}>;

export type PersistentDeadLetterStoreAdapterFactory<
  T extends DeadLetterStoreAdapterUnderTest = DeadLetterStoreAdapterUnderTest
> = (session: PersistentDeadLetterStoreTestSession) => T | Promise<T>;

export type PersistentDeadLetterStoreContractOptions = Readonly<{
  scratchDirectory: string;
}>;

const ISO_NOW = "2026-04-26T00:00:00.000Z";
const ISO_LATER = "2026-04-26T00:00:01.000Z";

const buildSampleEntry = (
  entryIdSuffix: string,
  overrides: Partial<DeadLetterEntry> = {}
): DeadLetterEntry => ({
  entryId: overrides.entryId ?? createDeadLetterId(`dlq-p-${entryIdSuffix}`),
  sagaId: overrides.sagaId ?? createSagaId(`saga-p-${entryIdSuffix}`),
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

let sessionCounter = 0;
const nextSession = (
  options: PersistentDeadLetterStoreContractOptions
): PersistentDeadLetterStoreTestSession => {
  sessionCounter += 1;
  return {
    databasePath: `${options.scratchDirectory}/persistent-dlq-session-${sessionCounter}.db`
  };
};

export const definePersistentDeadLetterStoreContractTests = <
  T extends DeadLetterStoreAdapterUnderTest = DeadLetterStoreAdapterUnderTest
>(
  adapterName: string,
  factory: PersistentDeadLetterStoreAdapterFactory<T>,
  options: PersistentDeadLetterStoreContractOptions
): void => {
  describe(`[adapter-testkit] DeadLetterStore persistence contract — ${adapterName}`, () => {
    let session: PersistentDeadLetterStoreTestSession;

    beforeEach(() => {
      session = nextSession(options);
    });

    // ============================================================
    // 类别 P1：跨重启恢复
    // ============================================================
    describe("category P1: cross-restart recovery", () => {
      it("test_entry_enqueued_then_adapter_shutdown_then_new_adapter_in_same_session_reads_same_entry", async () => {
        const writer = await factory(session);
        await writer.init();
        const entry = buildSampleEntry("p1-1", {
          attemptCount: 3,
          compensationContext: { lockId: "L-p1-1", amount: 99.99 },
          failureChain: ["proximate", "intermediate", "root"]
        });
        await writer.enqueue(entry);
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(entry.entryId);
          assertOk(loaded, "load");
          expect(loaded.value).toEqual(entry);
        } finally {
          await reader.shutdown();
        }
      });

      it("test_failure_chain_array_survives_serialization_round_trip", async () => {
        const writer = await factory(session);
        await writer.init();
        const failureChain = [
          "compensation_failed_unreachable_downstream",
          "circuit_breaker_open_after_threshold",
          "downstream_health_degraded_for_minutes"
        ];
        const entry = buildSampleEntry("p1-2", { failureChain });
        await writer.enqueue(entry);
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(entry.entryId);
          assertOk(loaded, "load");
          // 数组顺序与内容必须严格一致
          expect(loaded.value?.failureChain).toEqual(failureChain);
        } finally {
          await reader.shutdown();
        }
      });

      it("test_listPending_after_restart_returns_pending_entries_persisted_before_shutdown", async () => {
        const writer = await factory(session);
        await writer.init();
        await writer.enqueue(buildSampleEntry("p1-3-pending"));
        await writer.enqueue(
          buildSampleEntry("p1-3-processed", {
            status: "processed",
            processedAt: ISO_LATER,
            processedBy: "ops-1"
          })
        );
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const result = await reader.listPending();
          assertOk(result, "listPending");
          const ids = result.value.map(e => e.entryId);
          expect(ids).toContain(createDeadLetterId("dlq-p-p1-3-pending"));
          expect(ids).not.toContain(createDeadLetterId("dlq-p-p1-3-processed"));
        } finally {
          await reader.shutdown();
        }
      });
    });

    // ============================================================
    // 类别 P2：跨实例可见性
    // ============================================================
    describe("category P2: cross-instance visibility", () => {
      it("test_entry_enqueued_by_writer_instance_is_visible_to_concurrently_running_reader_instance", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          const entry = buildSampleEntry("p2-1");
          await writer.enqueue(entry);
          const loaded = await reader.load(entry.entryId);
          assertOk(loaded, "load");
          expect(loaded.value).toEqual(entry);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });

      it("test_listBySaga_from_reader_includes_entries_enqueued_by_writer", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          const sagaId = createSagaId("saga-p2-2-shared");
          for (let i = 0; i < 3; i += 1) {
            await writer.enqueue(
              buildSampleEntry(`p2-2-${i}`, { sagaId })
            );
          }
          const result = await reader.listBySaga(sagaId);
          assertOk(result, "listBySaga");
          expect(result.value.length).toBe(3);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });

      it("test_listPending_from_reader_includes_writer_persisted_pending_entries", async () => {
        const writer = await factory(session);
        const reader = await factory(session);
        await Promise.all([writer.init(), reader.init()]);
        try {
          for (let i = 0; i < 3; i += 1) {
            await writer.enqueue(
              buildSampleEntry(`p2-3-${i}`, { status: "pending" })
            );
          }
          const result = await reader.listPending();
          assertOk(result, "listPending");
          expect(result.value.length).toBeGreaterThanOrEqual(3);
        } finally {
          await Promise.all([writer.shutdown(), reader.shutdown()]);
        }
      });
    });

    // ============================================================
    // 类别 P3：状态变更跨重启一致性
    // ============================================================
    describe("category P3: state transition cross-restart consistency", () => {
      it("test_markAsProcessed_persists_through_shutdown_and_reload", async () => {
        const writer = await factory(session);
        await writer.init();
        const entry = buildSampleEntry("p3-1");
        await writer.enqueue(entry);
        await writer.markAsProcessed(
          entry.entryId,
          "ops-restart-test",
          "verified safe to mark processed"
        );
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(entry.entryId);
          assertOk(loaded, "load");
          expect(loaded.value?.status).toBe("processed");
          expect(loaded.value?.processedBy).toBe("ops-restart-test");
          expect(loaded.value?.processingNotes).toBe(
            "verified safe to mark processed"
          );
          expect(loaded.value?.processedAt).not.toBeNull();
          // listPending 重启后**不**应包含已处理记录
          const pending = await reader.listPending();
          assertOk(pending, "listPending");
          expect(pending.value.find(e => e.entryId === entry.entryId)).toBeUndefined();
        } finally {
          await reader.shutdown();
        }
      });

      it("test_processedAt_iso_8601_timestamp_survives_round_trip_with_field_fidelity", async () => {
        const writer = await factory(session);
        await writer.init();
        const entry = buildSampleEntry("p3-2");
        await writer.enqueue(entry);
        const beforeProcess = Date.now();
        await writer.markAsProcessed(entry.entryId, "ops-tz");
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        try {
          const loaded = await reader.load(entry.entryId);
          assertOk(loaded, "load");
          expect(loaded.value?.processedAt).toMatch(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/
          );
          // 时间戳应在 markAsProcessed 调用之后
          const processedAtMs = new Date(loaded.value!.processedAt!).getTime();
          expect(processedAtMs).toBeGreaterThanOrEqual(beforeProcess);
        } finally {
          await reader.shutdown();
        }
      });
    });
  });
};
