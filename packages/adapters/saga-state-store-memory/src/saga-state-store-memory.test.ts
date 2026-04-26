// Phase 9 / Step 3 — 自有测试（惯例 L 修订版基础设施 ≤6 it）：
//   1. 身份与工厂签名
//   2. 多实例独立性（与 postgres "多实例共享同一表" 形成对比）
//   3. healthCheck 反映 sagaCount 与 lifecycle
//   4. shutdown 后 init 抛错（lifecycle 不可逆性）
// 实际 4 it（remaining 2 slots 留作未来按需扩展，不堆砌冗余测试）

import { describe, expect, it } from "vitest";

import { createSagaId } from "@tianqi/ports";

import { createInMemorySagaStateStore } from "./saga-state-store-memory.js";

describe("saga-state-store-memory: standalone tests", () => {
  it("test_factory_returns_adapter_with_expected_identity_fields", () => {
    const adapter = createInMemorySagaStateStore();
    expect(adapter.adapterName).toBe("saga-state-store-memory");
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.shutdown).toBe("function");
    expect(typeof adapter.healthCheck).toBe("function");
    expect(typeof adapter.save).toBe("function");
    expect(typeof adapter.load).toBe("function");
    expect(typeof adapter.listIncomplete).toBe("function");
    expect(typeof adapter.delete).toBe("function");
  });

  it("test_two_independent_instances_do_not_share_state", async () => {
    // memory 多实例语义条款 3：每个 createInMemorySagaStateStore() 是独立 Map
    const a = createInMemorySagaStateStore();
    const b = createInMemorySagaStateStore();
    await Promise.all([a.init(), b.init()]);
    try {
      const sagaId = createSagaId("saga-iso");
      await a.save({
        sagaId,
        sagaStartedAt: "2026-04-26T00:00:00.000Z",
        lastUpdatedAt: "2026-04-26T00:00:00.000Z",
        currentStepIndex: 0,
        totalSteps: 1,
        stepStatuses: [{ name: "step-1", status: "pending", failureReason: null }],
        compensationContexts: [],
        overallStatus: "in_progress",
        correlationId: null,
        traceId: null
      });
      const loaded = await b.load(sagaId);
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.value).toBeNull();
      }
    } finally {
      await Promise.all([a.shutdown(), b.shutdown()]);
    }
  });

  it("test_health_check_reflects_lifecycle_and_saga_count", async () => {
    const adapter = createInMemorySagaStateStore();
    const beforeInit = await adapter.healthCheck();
    expect(beforeInit.healthy).toBe(false);
    expect(beforeInit.details["lifecycle"]).toBe("created");
    await adapter.init();
    const afterInit = await adapter.healthCheck();
    expect(afterInit.healthy).toBe(true);
    expect(afterInit.details["lifecycle"]).toBe("running");
    expect(afterInit.details["sagaCount"]).toBe(0);
    await adapter.save({
      sagaId: createSagaId("saga-hc-1"),
      sagaStartedAt: "2026-04-26T00:00:00.000Z",
      lastUpdatedAt: "2026-04-26T00:00:00.000Z",
      currentStepIndex: 0,
      totalSteps: 1,
      stepStatuses: [{ name: "step-1", status: "pending", failureReason: null }],
      compensationContexts: [],
      overallStatus: "in_progress",
      correlationId: null,
      traceId: null
    });
    const afterSave = await adapter.healthCheck();
    expect(afterSave.details["sagaCount"]).toBe(1);
    await adapter.shutdown();
    const afterShutdown = await adapter.healthCheck();
    expect(afterShutdown.healthy).toBe(false);
    expect(afterShutdown.details["lifecycle"]).toBe("shut_down");
  });

  it("test_init_after_shutdown_is_silent_no_op_lifecycle_stays_terminal", async () => {
    // 与 event-store-memory 同模式：shut_down 是终态；init() 后调用静默 no-op
    // 但 lifecycle 保持 shut_down。要复用 adapter 必须重新 createInMemorySagaStateStore()。
    const adapter = createInMemorySagaStateStore();
    await adapter.init();
    await adapter.shutdown();
    await adapter.init(); // 不抛错；但 lifecycle 仍 shut_down
    const status = await adapter.healthCheck();
    expect(status.healthy).toBe(false);
    expect(status.details["lifecycle"]).toBe("shut_down");
    // save 仍受 TQ-INF-020 守卫
    const result = await adapter.save({
      sagaId: createSagaId("saga-test"),
      sagaStartedAt: "2026-04-26T00:00:00.000Z",
      lastUpdatedAt: "2026-04-26T00:00:00.000Z",
      currentStepIndex: 0,
      totalSteps: 1,
      stepStatuses: [{ name: "step-1", status: "pending", failureReason: null }],
      compensationContexts: [],
      overallStatus: "in_progress",
      correlationId: null,
      traceId: null
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("TQ-INF-020");
    }
  });
});
