// Phase 9 / Step 4 — 自有测试（惯例 L 修订版基础设施 ≤6 it）：
//   1. 身份与工厂签名
//   2. 多实例独立性
//   3. healthCheck 反映 entryCount 与 lifecycle
//   4. shutdown 后调用任何方法返回 TQ-INF-023
// 实际 4 it（remaining 2 slots 留作未来按需扩展）

import { describe, expect, it } from "vitest";

import { createDeadLetterId, createSagaId } from "@tianqi/ports";

import { createInMemoryDeadLetterStore } from "./dead-letter-store-memory.js";

const buildEntry = (id: string, sagaId: string) => ({
  entryId: createDeadLetterId(id),
  sagaId: createSagaId(sagaId),
  stepName: "step-default",
  status: "pending" as const,
  enqueuedAt: "2026-04-26T00:00:00.000Z",
  attemptCount: 1,
  compensationContext: { kind: "test" },
  failureChain: ["test_reason"],
  correlationId: null,
  traceId: null,
  lastAttemptAt: null,
  processedAt: null,
  processedBy: null,
  processingNotes: null
});

describe("dead-letter-store-memory: standalone tests", () => {
  it("test_factory_returns_adapter_with_expected_identity_fields", () => {
    const adapter = createInMemoryDeadLetterStore();
    expect(adapter.adapterName).toBe("dead-letter-store-memory");
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.shutdown).toBe("function");
    expect(typeof adapter.healthCheck).toBe("function");
    expect(typeof adapter.enqueue).toBe("function");
    expect(typeof adapter.load).toBe("function");
    expect(typeof adapter.listPending).toBe("function");
    expect(typeof adapter.listBySaga).toBe("function");
    expect(typeof adapter.markAsProcessed).toBe("function");
  });

  it("test_two_independent_instances_do_not_share_state", async () => {
    const a = createInMemoryDeadLetterStore();
    const b = createInMemoryDeadLetterStore();
    await Promise.all([a.init(), b.init()]);
    try {
      const entry = buildEntry("dlq-iso", "saga-iso");
      await a.enqueue(entry);
      const loaded = await b.load(entry.entryId);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.value).toBeNull();
      }
    } finally {
      await Promise.all([a.shutdown(), b.shutdown()]);
    }
  });

  it("test_health_check_reflects_lifecycle_and_entry_count", async () => {
    const adapter = createInMemoryDeadLetterStore();
    const beforeInit = await adapter.healthCheck();
    expect(beforeInit.healthy).toBe(false);
    expect(beforeInit.details["lifecycle"]).toBe("created");
    await adapter.init();
    const afterInit = await adapter.healthCheck();
    expect(afterInit.healthy).toBe(true);
    expect(afterInit.details["lifecycle"]).toBe("running");
    expect(afterInit.details["entryCount"]).toBe(0);
    await adapter.enqueue(buildEntry("dlq-hc-1", "saga-hc-1"));
    await adapter.enqueue(buildEntry("dlq-hc-2", "saga-hc-2"));
    const afterEnqueue = await adapter.healthCheck();
    expect(afterEnqueue.details["entryCount"]).toBe(2);
    await adapter.shutdown();
    const afterShutdown = await adapter.healthCheck();
    expect(afterShutdown.healthy).toBe(false);
    expect(afterShutdown.details["lifecycle"]).toBe("shut_down");
  });

  it("test_all_operations_after_shutdown_return_TQ_INF_023_error", async () => {
    const adapter = createInMemoryDeadLetterStore();
    await adapter.init();
    await adapter.shutdown();
    const sagaId = createSagaId("saga-test-shut");
    const entryId = createDeadLetterId("dlq-shut");
    const enq = await adapter.enqueue(buildEntry("dlq-shut", "saga-test-shut"));
    const load = await adapter.load(entryId);
    const list = await adapter.listPending();
    const listSaga = await adapter.listBySaga(sagaId);
    const mark = await adapter.markAsProcessed(entryId, "ops-1");
    for (const result of [enq, load, list, listSaga, mark]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("TQ-INF-023");
      }
    }
  });
});
