import type {
  AuditEventSinkPort,
  CompensationRecordQuery,
  CompensationMutationRequest,
  CompensationRecordMutationPort,
  CompensationRecordStorePort,
  SinkFailureRecoveryRecord,
  SinkFailureRecoveryStorePort,
  StoredCompensationRecord
} from "@tianqi/ports";
import { createCommandResultReference, err, ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { CompensationCommandHandler } from "./compensation-command-handler.js";

class FakeCompensationQueryStore implements CompensationRecordStorePort {
  public readonly records = new Map<string, StoredCompensationRecord>();
  public fail = false;

  public async getOne(query: CompensationRecordQuery) {
    if (this.fail) {
      return err({ message: "query dependency failed" });
    }
    const record =
      query.by === "reference"
        ? this.records.get(query.resultReference)
        : query.by === "case_id"
          ? [...this.records.values()].find((item) => item.caseId === query.caseId)
          : [...this.records.values()].find((item) => item.commandName === query.commandName);
    if (!record) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, record });
  }
}

class FakeCompensationMutationStore implements CompensationRecordMutationPort {
  public readonly records = new Map<string, StoredCompensationRecord>();
  public fail = false;

  public async updateOne(request: CompensationMutationRequest) {
    if (this.fail) {
      return err({ message: "mutation dependency failed" });
    }
    const existing = this.records.get(request.resultReference);
    if (!existing) {
      return ok({ status: "missing" as const });
    }
    const updated: StoredCompensationRecord = {
      ...existing,
      status: request.targetStatus,
      updatedAt: "2026-03-25T00:10:00.000Z"
    };
    this.records.set(request.resultReference, updated);
    return ok({ status: "updated" as const, record: updated });
  }
}

class FakeAuditEventSink implements AuditEventSinkPort {
  public calls = 0;
  public fail = false;

  public async append() {
    this.calls += 1;
    if (this.fail) {
      return err({ message: "audit sink failed" });
    }
    return ok(undefined);
  }
}

class FakeSinkFailureRecoveryStore implements SinkFailureRecoveryStorePort {
  public readonly records = new Map<string, SinkFailureRecoveryRecord>();
  public appendCalls = 0;
  public failAppend = false;
  public failLookup = false;

  public async append(record: SinkFailureRecoveryRecord) {
    this.appendCalls += 1;
    if (this.failAppend) {
      return err({ message: "recovery append failed" });
    }
    this.records.set(record.recoveryReference, record);
    return ok({ status: "appended" as const });
  }

  public async getByRecoveryReference(
    recoveryReference: SinkFailureRecoveryRecord["recoveryReference"]
  ) {
    if (this.failLookup) {
      return err({ message: "recovery query failed" });
    }
    const record = this.records.get(recoveryReference);
    if (!record) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, record });
  }
}

const seedRecord = (
  status: StoredCompensationRecord["status"],
  reference: ReturnType<typeof createCommandResultReference>
): StoredCompensationRecord => ({
  commandName: "CreateRiskCaseCommand",
  caseId: "case-comp-command",
  status,
  reason: status === "not_required" ? "not_required" : "publish_failed",
  resultReference: reference,
  updatedAt: "2026-03-25T00:00:00.000Z"
});

describe("CompensationCommandHandler", () => {
  it("changes pending -> resolved", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-resolve");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    queryStore.records.set(reference, seedRecord("pending", reference));
    mutationStore.records.set(reference, seedRecord("pending", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: reference,
      reason: "publish gap recovered",
      traceId: "trace-resolve-001"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition.fromStatus).toBe("pending");
      expect(result.transition.toStatus).toBe("resolved");
      expect(result.record.status).toBe("resolved");
      expect(result.auditEvents).toHaveLength(1);
      const event = result.auditEvents[0];
      expect(event?.eventType).toBe("CompensationStatusChanged");
      expect(event?.resultReference).toBe(reference);
      expect(event?.caseId).toBe("case-comp-command");
      expect(event?.commandName).toBe("ResolveCompensationCommand");
      expect(event?.beforeStatus).toBe("pending");
      expect(event?.afterStatus).toBe("resolved");
      expect(event?.reason).toBe("publish gap recovered");
      expect(event?.traceId).toBe("trace-resolve-001");
      expect(result.auditSink.status).toBe("succeeded");
      expect(result.auditSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.auditSink).toBe(false);
    }
    expect(auditSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
  });

  it("changes pending -> manual_intervention_required", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-manual");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    queryStore.records.set(reference, seedRecord("pending", reference));
    mutationStore.records.set(reference, seedRecord("pending", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.markManualInterventionRequired({
      resultReference: reference,
      reason: "automatic recovery not possible",
      traceId: "trace-manual-001"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.transition.fromStatus).toBe("pending");
      expect(result.transition.toStatus).toBe("manual_intervention_required");
      expect(result.auditEvents).toHaveLength(1);
      expect(result.auditEvents[0]?.afterStatus).toBe("manual_intervention_required");
      expect(result.auditSink.status).toBe("succeeded");
      expect(result.auditSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.auditSink).toBe(false);
    }
    expect(auditSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
  });

  it("keeps compensation mutation success while exposing audit sink failure", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-audit-fail");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    auditSink.fail = true;
    queryStore.records.set(reference, seedRecord("pending", reference));
    mutationStore.records.set(reference, seedRecord("pending", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: reference,
      reason: "recover but audit sink fails",
      traceId: "trace-audit-fail-001"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.status).toBe("resolved");
      expect(result.auditSink.status).toBe("failed");
      if (result.auditSink.status === "failed") {
        expect(result.auditSink.errorSummary).toBe("audit sink failed");
        expect(result.auditSink.retryEligibility).toBe("eligible_for_retry");
        expect(result.auditSink.recovery.sinkKind).toBe("audit");
        expect(result.auditSink.recovery.retryEligibility).toBe("eligible_for_retry");
        expect(result.auditSink.recovery.recoveryReference.sinkKind).toBe("audit");
        if (result.auditSink.recovery.recoveryReference.sinkKind === "audit") {
          expect(result.auditSink.recovery.recoveryReference.caseId).toBe("case-comp-command");
          expect(result.auditSink.recovery.recoveryReference.resultReference).toBe(reference);
          expect(result.auditSink.recovery.recoveryReference.sourceCommandName).toBe(
            "ResolveCompensationCommand"
          );
        }
        expect(result.auditSink.recovery.recoveryReference.traceId).toBe("trace-audit-fail-001");
        expect(result.auditSink.recovery.recoveryReference.failureCategory).toBe(
          "sink_dependency_failure"
        );
        expect(result.auditSink.recovery.recoveryReference.recoveryId.length).toBeGreaterThan(0);
        expect(result.auditSink.recovery.recoveryRecord.status).toBe("persisted");
        expect(result.auditSink.recovery.auditEvents).toHaveLength(1);
        expect(result.auditSink.recovery.auditEvents[0]?.eventType).toBe("RecoveryRecordChanged");
        expect(result.auditSink.recovery.auditEvents[0]?.eventKind).toBe("RecoveryRecordAppended");
        expect(result.auditSink.recovery.auditSink.status).toBe("failed");
        if (result.auditSink.recovery.auditSink.status === "failed") {
          expect(result.auditSink.recovery.auditSink.errorSummary).toBe("audit sink failed");
        }
      }
      expect(result.auditEvents).toHaveLength(1);
    }
    expect(auditSink.calls).toBe(2);
    expect(recoveryStore.appendCalls).toBe(1);
  });

  it("keeps mutation success and reports recovery append failure", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-recovery-append-fail");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    auditSink.fail = true;
    recoveryStore.failAppend = true;
    queryStore.records.set(reference, seedRecord("pending", reference));
    mutationStore.records.set(reference, seedRecord("pending", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: reference,
      reason: "sink fail with recovery append fail",
      traceId: "trace-recovery-append-fail-001"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.auditSink.status).toBe("failed");
      if (result.auditSink.status === "failed") {
        expect(result.auditSink.recovery.recoveryRecord.status).toBe("persist_failed");
        if (result.auditSink.recovery.recoveryRecord.status === "persist_failed") {
          expect(result.auditSink.recovery.recoveryRecord.errorSummary).toBe(
            "recovery append failed"
          );
        }
        expect(result.auditSink.recovery.auditEvents).toHaveLength(0);
        expect(result.auditSink.recovery.auditSink.status).toBe("not_attempted");
      }
    }
    expect(auditSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(1);
  });

  it("rejects illegal transition not_required -> resolved", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-illegal-1");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    queryStore.records.set(reference, seedRecord("not_required", reference));
    mutationStore.records.set(reference, seedRecord("not_required", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: reference,
      reason: "invalid resolve",
      traceId: "trace-illegal-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state).toBe("invalid_transition");
      expect(result.error.code).toBe("TQ-APP-002");
      expect(result.auditEvents).toHaveLength(0);
      expect(result.auditSink.status).toBe("not_attempted");
      expect(result.auditSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.auditSink).toBe(false);
    }
    expect(auditSink.calls).toBe(0);
    expect(recoveryStore.appendCalls).toBe(0);
  });

  it("returns missing when compensation record does not exist", async () => {
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const handler = new CompensationCommandHandler({
      compensationQueryStore: new FakeCompensationQueryStore(),
      compensationMutationStore: new FakeCompensationMutationStore(),
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: createCommandResultReference("comp-cmd-ref-missing"),
      reason: "resolve missing",
      traceId: "trace-missing-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state).toBe("missing");
      expect(result.error.code).toBe("TQ-APP-003");
      expect(result.auditEvents).toHaveLength(0);
      expect(result.auditSink.status).toBe("not_attempted");
      expect(result.auditSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.auditSink).toBe(false);
    }
    expect(auditSink.calls).toBe(0);
    expect(recoveryStore.appendCalls).toBe(0);
  });

  it("returns unavailable when mutation dependency fails", async () => {
    const reference = createCommandResultReference("comp-cmd-ref-mutation-fail");
    const queryStore = new FakeCompensationQueryStore();
    const mutationStore = new FakeCompensationMutationStore();
    const auditSink = new FakeAuditEventSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    mutationStore.fail = true;
    queryStore.records.set(reference, seedRecord("pending", reference));
    mutationStore.records.set(reference, seedRecord("pending", reference));
    const handler = new CompensationCommandHandler({
      compensationQueryStore: queryStore,
      compensationMutationStore: mutationStore,
      auditEventSink: auditSink,
      sinkFailureRecoveryStore: recoveryStore
    });

    const result = await handler.resolveCompensation({
      resultReference: reference,
      reason: "mutation fail",
      traceId: "trace-mutation-fail-001"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.state).toBe("unavailable");
      expect(result.error.code).toBe("TQ-APP-004");
      expect(result.auditEvents).toHaveLength(0);
      expect(result.auditSink.status).toBe("not_attempted");
      expect(result.auditSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.auditSink).toBe(false);
    }
    expect(auditSink.calls).toBe(0);
    expect(recoveryStore.appendCalls).toBe(0);
  });
});
