// Phase 9 / Step 9 — saga-manual-intervention 单元测试（裁决 7：unit ≤8）。
//
// 8 个 unit it 覆盖：工厂签名 / 双签名校验 / entry 不存在 / entry 已处理 /
// requested 致命失败（裁决 6 III）/ markAsProcessed 致命失败 / applied 降级
// 失败 / 完整成功路径 7 类审计事件 + 双签名 payload 验证。
//
// Mock 策略：本测试用 mock ports（可控制 load / append / markAsProcessed
// 失败行为）；集成测试 saga-manual-intervention.integration.test.ts 用真
// 实 dead-letter-store-memory 验证完整流程。两者互补。

import { describe, expect, it } from "vitest";

import { err, ok } from "@tianqi/shared";

import type {
  AuditEventRecord,
  AuditEventSinkPort,
  DeadLetterEntry,
  DeadLetterId,
  DeadLetterStoreError,
  DeadLetterStorePort
} from "@tianqi/ports";
import { createCorrelationId, createDeadLetterId, createSagaId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import {
  MANUAL_INTERVENTION_AUDIT_EVENT_TYPES,
  createSagaManualIntervention,
  toSagaError,
  type ManualInterventionDegradedFailureEvent
} from "./saga-manual-intervention.js";

// ============================================================
// Mock Ports
// ============================================================

type MockDeadLetterStore = DeadLetterStorePort & {
  entries: Map<DeadLetterId, DeadLetterEntry>;
  loadFailure: boolean;
  markFailure: boolean;
};

const createMockDeadLetterStore = (): MockDeadLetterStore => {
  const entries = new Map<DeadLetterId, DeadLetterEntry>();
  const store: MockDeadLetterStore = {
    entries,
    loadFailure: false,
    markFailure: false,
    async enqueue(entry) {
      entries.set(entry.entryId, entry);
      return ok(undefined);
    },
    async load(entryId) {
      if (store.loadFailure) {
        return err({ message: "synthetic load failure" } as DeadLetterStoreError);
      }
      return ok(entries.get(entryId) ?? null);
    },
    async listPending() {
      return ok([]);
    },
    async listBySaga(_sagaId) {
      return ok([]);
    },
    async markAsProcessed(entryId, processedBy, processingNotes) {
      if (store.markFailure) {
        return err({ message: "synthetic mark failure" } as DeadLetterStoreError);
      }
      const existing = entries.get(entryId);
      if (existing !== undefined) {
        entries.set(entryId, {
          ...existing,
          status: "processed",
          processedAt: new Date().toISOString(),
          processedBy,
          processingNotes: processingNotes ?? null
        });
      }
      return ok(undefined);
    }
  };
  return store;
};

type MockAuditSink = AuditEventSinkPort & {
  events: AuditEventRecord[];
  failOnEventType: string | null;
};

const createMockAuditSink = (): MockAuditSink => {
  const events: AuditEventRecord[] = [];
  const sink: MockAuditSink = {
    events,
    failOnEventType: null,
    async append(event) {
      if (sink.failOnEventType !== null && event.eventType === sink.failOnEventType) {
        return err({ message: `synthetic audit failure for ${event.eventType}` });
      }
      events.push(event);
      return ok(undefined);
    }
  };
  return sink;
};

// ============================================================
// Common helpers
// ============================================================

const buildPendingEntry = (entryId: string, sagaIdSuffix = "test"): DeadLetterEntry => ({
  entryId: createDeadLetterId(entryId),
  sagaId: createSagaId(`saga-${sagaIdSuffix}`),
  stepName: "lock-margin",
  status: "pending",
  enqueuedAt: "2026-04-27T00:00:00.000Z",
  attemptCount: 1,
  compensationContext: { kind: "test", lockId: "lock-001" },
  failureChain: ["compensation_unlock_unreachable"],
  correlationId: createCorrelationId(`corr-${sagaIdSuffix}`),
  traceId: createTraceId(`trace-${sagaIdSuffix}`),
  lastAttemptAt: "2026-04-27T00:00:00.000Z",
  processedAt: null,
  processedBy: null,
  processingNotes: null
});

// ============================================================
// Tests
// ============================================================

describe("saga-manual-intervention: unit tests", () => {
  it("test_factory_returns_intervention_with_processDeadLetter_method", () => {
    const intervention = createSagaManualIntervention({
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    expect(typeof intervention.processDeadLetter).toBe("function");
  });

  it("test_processDeadLetter_rejects_when_requestedBy_equals_approvedBy", async () => {
    // 裁决 3 简化 B 双签名校验第一道关卡：同一标识不能既请求又审批
    const deadLetterStore = createMockDeadLetterStore();
    const auditSink = createMockAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    await deadLetterStore.enqueue(buildPendingEntry("dlq-001"));

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-001"),
      requestedBy: "ops-alice",
      approvedBy: "ops-alice"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-SAG-005");
      expect(result.error.reason).toBe("requestor_and_approver_must_differ");
    }
    // 双签名失败前置——零审计事件触发；零 markAsProcessed 调用
    expect(auditSink.events.length).toBe(0);
    expect(deadLetterStore.entries.get(createDeadLetterId("dlq-001"))?.status).toBe(
      "pending"
    );
  });

  it("test_processDeadLetter_returns_entry_not_found_when_load_returns_null", async () => {
    const intervention = createSagaManualIntervention({
      deadLetterStore: createMockDeadLetterStore(),
      auditEventSink: createMockAuditSink()
    });
    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-missing"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe("dead_letter_entry_not_found");
    }
  });

  it("test_processDeadLetter_returns_already_processed_for_non_pending_entry", async () => {
    // 幂等保护：本模块不允许重复处理；保双重审计"一次操作"语义
    const deadLetterStore = createMockDeadLetterStore();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: createMockAuditSink()
    });
    const entry = buildPendingEntry("dlq-already");
    await deadLetterStore.enqueue({
      ...entry,
      status: "processed",
      processedAt: "2026-04-26T00:00:00.000Z",
      processedBy: "ops-charlie",
      processingNotes: "previously handled"
    });

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-already"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe("dead_letter_entry_already_processed");
    }
  });

  it("test_processDeadLetter_aborts_when_requested_audit_event_fails_fatal", async () => {
    // 裁决 6 III 致命级失败：requested 事件失败 → 操作未授权 → 不调
    // markAsProcessed 不发 applied 事件
    const deadLetterStore = createMockDeadLetterStore();
    const auditSink = createMockAuditSink();
    auditSink.failOnEventType = MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED;
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    await deadLetterStore.enqueue(buildPendingEntry("dlq-002"));

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-002"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe("audit_request_event_failed");
    }
    // 关键不变量：致命失败时 entry 状态不变 + 零 audit 事件持久化
    expect(auditSink.events.length).toBe(0);
    expect(deadLetterStore.entries.get(createDeadLetterId("dlq-002"))?.status).toBe(
      "pending"
    );
  });

  it("test_processDeadLetter_returns_mark_as_processed_failure_as_fatal", async () => {
    // 裁决 6 III 致命级：markAsProcessed 失败 → 返回 err；APPLIED 事件不
    // 触发（saga 状态不一致防止）
    const deadLetterStore = createMockDeadLetterStore();
    deadLetterStore.markFailure = true;
    const auditSink = createMockAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    await deadLetterStore.enqueue(buildPendingEntry("dlq-003"));

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-003"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe("dead_letter_mark_as_processed_failed");
    }
    // REQUESTED 事件已触发（在 markAsProcessed 之前）；APPLIED 未触发
    expect(auditSink.events.length).toBe(1);
    expect(auditSink.events[0]?.eventType).toBe(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED
    );
  });

  it("test_processDeadLetter_treats_applied_audit_failure_as_degraded_and_returns_ok", async () => {
    // 裁决 6 III 降级级：APPLIED 事件失败 → onDegradedFailure 触发 +
    // appliedAuditWritten=false + 仍返回 ok（状态已变更不应回滚）
    const deadLetterStore = createMockDeadLetterStore();
    const auditSink = createMockAuditSink();
    auditSink.failOnEventType = MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.APPLIED;
    const degradedEvents: ManualInterventionDegradedFailureEvent[] = [];
    const intervention = createSagaManualIntervention(
      {
        deadLetterStore,
        auditEventSink: auditSink
      },
      {
        onDegradedFailure: event => degradedEvents.push(event)
      }
    );
    await deadLetterStore.enqueue(buildPendingEntry("dlq-004"));

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-004"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.appliedAuditWritten).toBe(false);
      expect(typeof result.value.processedAt).toBe("string");
    }
    // entry 状态已变更（markAsProcessed 已成功调用）
    expect(deadLetterStore.entries.get(createDeadLetterId("dlq-004"))?.status).toBe(
      "processed"
    );
    // REQUESTED 1 个 + APPLIED 0 个（失败未持久化）= 1 个 audit 事件
    expect(auditSink.events.length).toBe(1);
    // onDegradedFailure 被触发 1 次
    expect(degradedEvents.length).toBe(1);
    expect(degradedEvents[0]?.kind).toBe("applied-audit-append-failed");
    expect(degradedEvents[0]?.entryId).toBe(createDeadLetterId("dlq-004"));
  });

  it("test_processDeadLetter_happy_path_emits_double_audit_with_double_signature_payload", async () => {
    // 完整成功路径：双重审计落地证明
    //   - 双签名（裁决 3 简化 B）：requestedBy/approvedBy 通过 + 同步写
    //     入两个 audit 事件 payload
    //   - 双事件（裁决 3 A）：REQUESTED + APPLIED 各 1 次按时序
    //   - markAsProcessed 调用 processedBy = approvedBy（审批人是事实
    //     操作责任人）
    //   - toSagaError helper round-trip 验证
    const deadLetterStore = createMockDeadLetterStore();
    const auditSink = createMockAuditSink();
    const intervention = createSagaManualIntervention({
      deadLetterStore,
      auditEventSink: auditSink
    });
    await deadLetterStore.enqueue(buildPendingEntry("dlq-happy", "happy"));

    const result = await intervention.processDeadLetter({
      entryId: createDeadLetterId("dlq-happy"),
      requestedBy: "ops-alice",
      approvedBy: "ops-bob",
      processingNotes: "manual unlock confirmed via downstream API"
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entryId).toBe(createDeadLetterId("dlq-happy"));
      expect(result.value.appliedAuditWritten).toBe(true);
      expect(typeof result.value.processedAt).toBe("string");
    }
    // 双事件按时序：REQUESTED → APPLIED
    expect(auditSink.events.length).toBe(2);
    expect(auditSink.events[0]?.eventType).toBe(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.REQUESTED
    );
    expect(auditSink.events[1]?.eventType).toBe(
      MANUAL_INTERVENTION_AUDIT_EVENT_TYPES.APPLIED
    );
    // REQUESTED payload 含双签名信息
    const requestedPayload = auditSink.events[0]?.payload as Record<string, unknown>;
    expect(requestedPayload.requestedBy).toBe("ops-alice");
    expect(requestedPayload.approvedBy).toBe("ops-bob");
    expect(requestedPayload.entryId).toBe(createDeadLetterId("dlq-happy"));
    expect(requestedPayload.sagaId).toBe(createSagaId("saga-happy"));
    expect(requestedPayload.stepName).toBe("lock-margin");
    // APPLIED payload 含 processedAt + processingNotes（冗余双签名供独立查询）
    const appliedPayload = auditSink.events[1]?.payload as Record<string, unknown>;
    expect(appliedPayload.requestedBy).toBe("ops-alice");
    expect(appliedPayload.approvedBy).toBe("ops-bob");
    expect(appliedPayload.processingNotes).toBe(
      "manual unlock confirmed via downstream API"
    );
    expect(typeof appliedPayload.processedAt).toBe("string");
    // markAsProcessed processedBy = approvedBy（审批人责任原则）
    const markedEntry = deadLetterStore.entries.get(createDeadLetterId("dlq-happy"));
    expect(markedEntry?.status).toBe("processed");
    expect(markedEntry?.processedBy).toBe("ops-bob");
    expect(markedEntry?.processingNotes).toBe(
      "manual unlock confirmed via downstream API"
    );

    // toSagaError helper round-trip：构造一个 ManualInterventionError 转
    // 化为 SagaError class 验证与 contracts 错误码工厂一致
    const dummyError = {
      code: "TQ-SAG-005" as const,
      entryId: createDeadLetterId("dlq-happy"),
      reason: "test_reason",
      message: "test message"
    };
    const sagaError = toSagaError(dummyError);
    expect(sagaError.code).toBe("TQ-SAG-005");
    expect(sagaError.context).toEqual({
      entryId: "dlq-happy",
      reason: "test_reason"
    });
  });
});
