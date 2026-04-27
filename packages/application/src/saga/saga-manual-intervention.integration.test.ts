// Phase 9 / Step 9 — saga-manual-intervention 集成测试（裁决 7：集成 ≤4）。
//
// 4 个集成 it 用真实 dead-letter-store-memory adapter + 简单 in-memory
// AuditEventSink 验证：
//   1. 完整 happy path（enqueue → processDeadLetter → 验证 entry 状态 +
//      双 audit 事件）
//   2. 重复处理被拦截（enqueue → process 1 次成功 → 第 2 次拒绝
//      "dead_letter_entry_already_processed"）
//   3. 多 saga 隔离（同时 enqueue 两笔不同 sagaId 的死信，独立处理互不
//      影响）
//   4. listPending 与 process 配合（enqueue → listPending 看到 1 笔 →
//      process → listPending 看到 0 笔）
//
// 与 unit 测试的覆盖边界：
//   - unit 测试用 mock ports 验证编排器侧流程控制 + 失败模式
//   - 集成测试用真实 dead-letter-store-memory 验证与 Sprint F Adapter
//     接口的实际兼容性（譬如 markAsProcessed 自身幂等覆写 vs Step 9 模
//     块层面拒绝重复处理的语义协调）

import { describe, expect, it } from "vitest";

import { ok, err } from "@tianqi/shared";
import { createTraceId } from "@tianqi/shared";

import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";
import type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort,
  DeadLetterEntry
} from "@tianqi/ports";
import {
  createCorrelationId,
  createDeadLetterId,
  createSagaId
} from "@tianqi/ports";
import type { Result } from "@tianqi/shared";

import {
  MANUAL_INTERVENTION_AUDIT_EVENT_TYPES,
  createSagaManualIntervention
} from "./saga-manual-intervention.js";

// ============================================================
// In-memory AuditEventSink（最简实现，集成测试专用）
// ============================================================

const createInMemoryAuditSink = (): AuditEventSinkPort & {
  events: AuditEventRecord[];
} => {
  const events: AuditEventRecord[] = [];
  return {
    events,
    async append(event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>> {
      events.push(event);
      return ok(undefined);
    }
  };
};

// ============================================================
// Helpers
// ============================================================

const buildEntry = (entryId: string, sagaIdSuffix: string): DeadLetterEntry => ({
  entryId: createDeadLetterId(entryId),
  sagaId: createSagaId(`saga-${sagaIdSuffix}`),
  stepName: "lock-margin",
  status: "pending",
  enqueuedAt: new Date().toISOString(),
  attemptCount: 1,
  compensationContext: { kind: "test", lockId: `lock-${sagaIdSuffix}` },
  failureChain: ["compensation_unlock_unreachable"],
  correlationId: createCorrelationId(`corr-${sagaIdSuffix}`),
  traceId: createTraceId(`trace-${sagaIdSuffix}`),
  lastAttemptAt: new Date().toISOString(),
  processedAt: null,
  processedBy: null,
  processingNotes: null
});

// ============================================================
// Tests
// ============================================================

describe("saga-manual-intervention: integration tests (real memory adapter)", () => {
  it("test_full_happy_path_persists_processed_status_and_emits_double_audit", async () => {
    const deadLetterStore = createInMemoryDeadLetterStore();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const entryId = createDeadLetterId("dlq-int-001");
    await deadLetterStore.enqueue(buildEntry("dlq-int-001", "int-001"));

    const result = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "integration test happy path"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.appliedAuditWritten).toBe(true);
    }

    // 真实 adapter 状态变更可见性（save → load 配对）
    const loadResult = await deadLetterStore.load(entryId);
    expect(loadResult.ok).toBe(true);
    if (loadResult.ok && loadResult.value !== null) {
      expect(loadResult.value.status).toBe("processed");
      expect(loadResult.value.processedBy).toBe("ops-bob");
      expect(loadResult.value.processingNotes).toBe("integration test happy path");
    }

    // 双事件按时序
    expect(auditSink.events.length).toBe(2);
    expect(auditSink.events[0]?.eventType).toBe(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED
    );
    expect(auditSink.events[1]?.eventType).toBe(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.APPLIED
    );
  });

  it("test_repeat_processing_rejected_after_first_success", async () => {
    // 幂等保护：本模块层面拒绝重复处理（保双重审计"一次操作"语义）；
    // DeadLetterStore.markAsProcessed 自身幂等覆写但 Step 9 模块层面拒绝
    const deadLetterStore = createInMemoryDeadLetterStore();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const entryId = createDeadLetterId("dlq-int-002");
    await deadLetterStore.enqueue(buildEntry("dlq-int-002", "int-002"));

    const first = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });
    expect(first.ok).toBe(true);

    const second = await intervention.processDeadLetter({
      entryId,
      requestedBy: "ops-charlie",
      approvedBy: "ops-david"
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.reason).toBe("dead_letter_entry_already_processed");
    }

    // 第二次未触发审计事件 + 未篡改 processedBy
    expect(auditSink.events.length).toBe(2); // 仅第一次的 REQUESTED + APPLIED
    const loadResult = await deadLetterStore.load(entryId);
    if (loadResult.ok && loadResult.value !== null) {
      expect(loadResult.value.processedBy).toBe("ops-bob");
    }
  });

  it("test_multiple_saga_dead_letters_processed_independently", async () => {
    // 多 saga 隔离：同时 enqueue 两笔不同 sagaId 的死信，独立处理互不影响
    const deadLetterStore = createInMemoryDeadLetterStore();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    const entryA = createDeadLetterId("dlq-multi-a");
    const entryB = createDeadLetterId("dlq-multi-b");
    await deadLetterStore.enqueue(buildEntry("dlq-multi-a", "multi-a"));
    await deadLetterStore.enqueue(buildEntry("dlq-multi-b", "multi-b"));

    const resultA = await intervention.processDeadLetter({
      entryId: entryA,
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "saga A handled"
    });
    const resultB = await intervention.processDeadLetter({
      entryId: entryB,
      requestedBy: "ops-charlie",
      approvedBy: "ops-david",
      processingNotes: "saga B handled"
    });
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);

    // 双 entry 独立 processed 状态
    const loadA = await deadLetterStore.load(entryA);
    const loadB = await deadLetterStore.load(entryB);
    if (loadA.ok && loadA.value !== null) {
      expect(loadA.value.processedBy).toBe("ops-bob");
      expect(loadA.value.processingNotes).toBe("saga A handled");
    }
    if (loadB.ok && loadB.value !== null) {
      expect(loadB.value.processedBy).toBe("ops-david");
      expect(loadB.value.processingNotes).toBe("saga B handled");
    }
    // 4 个 audit 事件（每个 entry 2 个）
    expect(auditSink.events.length).toBe(4);
  });

  it("test_listPending_and_process_workflow_drains_pending_queue", async () => {
    // listPending 与 process 配合的运维真实场景：
    //   enqueue 2 笔 → listPending 看到 2 笔 → process 1 笔 →
    //   listPending 看到 1 笔 → process 第 2 笔 → listPending 空
    const deadLetterStore = createInMemoryDeadLetterStore();
    await deadLetterStore.init();
    const auditSink = createInMemoryAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    await deadLetterStore.enqueue(buildEntry("dlq-q-001", "q-001"));
    await deadLetterStore.enqueue(buildEntry("dlq-q-002", "q-002"));

    const beforeProcess = await deadLetterStore.listPending();
    expect(beforeProcess.ok).toBe(true);
    if (beforeProcess.ok) {
      expect(beforeProcess.value.length).toBe(2);
    }

    await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-q-001"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });

    const afterFirst = await deadLetterStore.listPending();
    if (afterFirst.ok) {
      expect(afterFirst.value.length).toBe(1);
      expect(afterFirst.value[0]?.entryId).toBe(createDeadLetterId("dlq-q-002"));
    }

    await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-q-002"),
      requestedBy: "ops-charlie",
      approvedBy: "ops-david"
    });

    const afterSecond = await deadLetterStore.listPending();
    if (afterSecond.ok) {
      expect(afterSecond.value.length).toBe(0);
    }
  });
});

// 防止 unused import 提示
void err;
