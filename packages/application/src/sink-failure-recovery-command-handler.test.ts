import type {
  AuditEventSinkPort,
  SinkFailureRecoveryRecord,
  SinkFailureRecoveryStorePort
} from "@tianqi/ports";
import {
  createCommandResultReference,
  createSinkRecoveryReferenceId,
  err,
  ok
} from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { SinkFailureRecoveryCommandHandler } from "./sink-failure-recovery-command-handler.js";

class FakeSinkFailureRecoveryStore implements SinkFailureRecoveryStorePort {
  public readonly records = new Map<string, SinkFailureRecoveryRecord>();
  public appendCalls = 0;
  public failLookup = false;
  public failAppend = false;

  public async append(record: SinkFailureRecoveryRecord) {
    this.appendCalls += 1;
    if (this.failAppend) {
      return err({ message: "append unavailable" });
    }
    this.records.set(record.recoveryReference, record);
    return ok({ status: "appended" as const });
  }

  public async getByRecoveryReference(recoveryReference: SinkFailureRecoveryRecord["recoveryReference"]) {
    if (this.failLookup) {
      return err({ message: "lookup unavailable" });
    }
    const record = this.records.get(recoveryReference);
    if (!record) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, record });
  }
}

class FakeAuditEventSink implements AuditEventSinkPort {
  public calls = 0;
  public fail = false;

  public async append() {
    this.calls += 1;
    if (this.fail) {
      return err({ message: "recovery audit sink failed" });
    }
    return ok(undefined);
  }
}

const seedOpenRecoveryRecord = (
  recoveryReference: ReturnType<typeof createSinkRecoveryReferenceId>
): SinkFailureRecoveryRecord => ({
  recoveryReference,
  sinkKind: "audit",
  retryEligibility: "eligible_for_retry",
  failureCategory: "sink_dependency_failure",
  sourceCommandName: "ResolveCompensationCommand",
  caseId: "case-recovery-001",
  resultReference: createCommandResultReference("result-ref-recovery-001"),
  traceId: "trace-sink-failure-001",
  createdAt: "2026-03-25T00:00:00.000Z",
  status: "open"
});

describe("SinkFailureRecoveryCommandHandler", () => {
  it("marks single recovery record as manually_resolved", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-ref-open");
    const store = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    store.records.set(recoveryReference, seedOpenRecoveryRecord(recoveryReference));
    const handler = new SinkFailureRecoveryCommandHandler(store, auditSink);

    const result = await handler.markManuallyResolved({
      recoveryReference,
      traceId: "trace-manual-resolved-001",
      note: "manual repair completed"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.recoveryReference).toBe(recoveryReference);
      expect(result.record.status).toBe("manually_resolved");
      expect(result.record.note).toBe("manual repair completed");
      expect(result.record.traceId).toBe("trace-manual-resolved-001");
      expect(result.auditEvents).toHaveLength(1);
      expect(result.auditEvents[0]?.eventType).toBe("RecoveryRecordChanged");
      expect(result.auditEvents[0]?.eventKind).toBe("RecoveryRecordManuallyResolved");
      expect(result.auditEvents[0]?.beforeStatus).toBe("open");
      expect(result.auditEvents[0]?.afterStatus).toBe("manually_resolved");
      expect(result.auditSink.status).toBe("succeeded");
    }
    expect(store.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(1);
  });

  it("returns missing when recovery record does not exist", async () => {
    const store = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    const handler = new SinkFailureRecoveryCommandHandler(store, auditSink);
    const recoveryReference = createSinkRecoveryReferenceId("recovery-ref-missing");

    const result = await handler.markManuallyResolved({
      recoveryReference,
      traceId: "trace-manual-missing-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state).toBe("missing");
      expect(result.error.code).toBe("TQ-APP-003");
      expect(result.auditEvents).toHaveLength(0);
      expect(result.auditSink.status).toBe("not_attempted");
    }
    expect(store.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("returns unavailable when append dependency fails", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-ref-append-fail");
    const store = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    store.records.set(recoveryReference, seedOpenRecoveryRecord(recoveryReference));
    store.failAppend = true;
    const handler = new SinkFailureRecoveryCommandHandler(store, auditSink);

    const result = await handler.markManuallyResolved({
      recoveryReference,
      traceId: "trace-manual-unavailable-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state).toBe("unavailable");
      expect(result.error.code).toBe("TQ-APP-004");
      expect(result.auditEvents).toHaveLength(0);
      expect(result.auditSink.status).toBe("not_attempted");
    }
    expect(store.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(0);
  });

  it("keeps manual resolve success while exposing audit sink failure", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-ref-audit-fail");
    const store = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    auditSink.fail = true;
    store.records.set(recoveryReference, seedOpenRecoveryRecord(recoveryReference));
    const handler = new SinkFailureRecoveryCommandHandler(store, auditSink);

    const result = await handler.markManuallyResolved({
      recoveryReference,
      traceId: "trace-manual-audit-fail-001"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.status).toBe("manually_resolved");
      expect(result.auditEvents).toHaveLength(1);
      expect(result.auditSink.status).toBe("failed");
      if (result.auditSink.status === "failed") {
        expect(result.auditSink.errorSummary).toBe("recovery audit sink failed");
      }
    }
    expect(store.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(1);
  });
});
