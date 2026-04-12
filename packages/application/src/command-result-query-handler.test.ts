import type {
  AuditEventSinkPort,
  CommandResultStorePort,
  MetricsSinkPort,
  SinkFailureRecoveryRecord,
  SinkFailureRecoveryStorePort,
  StoredCommandResultSnapshot
} from "@tianqi/ports";
import { createCommandResultReference, err, ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION } from "./command-result-snapshot-schema.js";
import { CommandResultQueryHandler } from "./command-result-query-handler.js";

class FakeCommandResultStore implements CommandResultStorePort {
  public readonly snapshots = new Map<string, StoredCommandResultSnapshot>();
  public fail = false;

  public async getByReference(reference: ReturnType<typeof createCommandResultReference>) {
    if (this.fail) {
      return err({ message: "result store unavailable" });
    }
    const snapshot = this.snapshots.get(reference);
    if (!snapshot) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, snapshot });
  }
}

class FakeMetricsSink implements MetricsSinkPort {
  public calls = 0;
  public fail = false;

  public async record() {
    this.calls += 1;
    if (this.fail) {
      return err({ message: "metrics sink failed" });
    }
    return ok(undefined);
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

describe("CommandResultQueryHandler", () => {
  it("returns found snapshot by reference and metrics sink succeeded", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    const reference = createCommandResultReference("query-ref-found");
    store.snapshots.set(reference, {
      schemaVersion: COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
      reference,
      commandName: "CreateRiskCaseCommand",
      riskCase: {
        caseId: "case-query",
        caseType: "Liquidation",
        state: "Detected",
        stage: "Detection",
        configVersion: 1,
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z"
      },
      events: [],
      processing: {
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded",
        outcome: "completed"
      }
    });
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.snapshot.schemaVersion).toBe(COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION);
      expect(result.snapshot.reference).toBe(reference);
      expect(result.snapshot.commandName).toBe("CreateRiskCaseCommand");
      expect(result.observability.validation).toBe("passed");
      expect(result.observability.versionMismatch).toBe(false);
      expect(result.metricsSink.status).toBe("succeeded");
      expect(result.metricsSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.metricsSink).toBe(false);
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("returns missing status and still attempts metrics sink", async () => {
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    const handler = new CommandResultQueryHandler(
      new FakeCommandResultStore(),
      metricsSink,
      recoveryStore,
      auditSink
    );
    const reference = createCommandResultReference("query-ref-missing");

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("missing");
    if (result.status === "missing") {
      expect(result.reference).toBe(reference);
      expect(result.observability.snapshotMissing).toBe(true);
      expect(result.observability.fallbackApplied).toBe(false);
      expect(result.metricsSink.status).toBe("succeeded");
      expect(result.metricsSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.metricsSink).toBe(false);
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("returns unavailable status when store dependency fails and still attempts metrics sink", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    store.fail = true;
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);
    const reference = createCommandResultReference("query-ref-unavailable");

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.error.code).toBe("TQ-APP-004");
      expect(result.observability.validation).toBe("not_performed");
      expect(result.metricsSink.status).toBe("succeeded");
      expect(result.metricsSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.metricsSink).toBe(false);
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("returns unavailable when snapshot schemaVersion is unknown", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    const reference = createCommandResultReference("query-ref-unknown-version");
    store.snapshots.set(reference, {
      schemaVersion: "2.0.0",
      reference,
      commandName: "CreateRiskCaseCommand",
      riskCase: {
        caseId: "case-unknown-version",
        caseType: "Liquidation",
        state: "Detected",
        stage: "Detection",
        configVersion: 1,
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z"
      },
      events: [],
      processing: {
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded",
        outcome: "completed"
      }
    });
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.error.code).toBe("TQ-APP-008");
      expect(result.observability.versionMismatch).toBe(true);
      expect(result.observability.validation).toBe("unsupported_version");
      expect(result.metricsSink.status).toBe("succeeded");
      expect(result.metricsSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.metricsSink).toBe(false);
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("returns unavailable when snapshot schemaVersion is missing", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    const reference = createCommandResultReference("query-ref-missing-version");
    store.snapshots.set(
      reference,
      {
        reference,
        commandName: "CreateRiskCaseCommand",
        riskCase: {
          caseId: "case-missing-version",
          caseType: "Liquidation",
          state: "Detected",
          stage: "Detection",
          configVersion: 1,
          createdAt: "2026-03-25T00:00:00.000Z",
          updatedAt: "2026-03-25T00:00:00.000Z"
        },
        events: [],
        processing: {
          persistence: "succeeded",
          mapping: "succeeded",
          publish: "succeeded",
          outcome: "completed"
        }
      } as unknown as StoredCommandResultSnapshot
    );
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.error.code).toBe("TQ-APP-007");
      expect(result.observability.validation).toBe("missing_version");
      expect(result.metricsSink.status).toBe("succeeded");
      expect(result.metricsSink.retryEligibility).toBe("not_applicable");
      expect("recovery" in result.metricsSink).toBe(false);
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(0);
    expect(auditSink.calls).toBe(0);
  });

  it("keeps query success while exposing metrics sink failure", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    metricsSink.fail = true;
    const reference = createCommandResultReference("query-ref-metrics-fail");
    store.snapshots.set(reference, {
      schemaVersion: COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
      reference,
      commandName: "CreateRiskCaseCommand",
      riskCase: {
        caseId: "case-query-metrics-fail",
        caseType: "Liquidation",
        state: "Detected",
        stage: "Detection",
        configVersion: 1,
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z"
      },
      events: [],
      processing: {
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded",
        outcome: "completed"
      }
    });
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.observability.validation).toBe("passed");
      expect(result.snapshot.compensation).toBeUndefined();
      expect(result.metricsSink.status).toBe("failed");
      if (result.metricsSink.status === "failed") {
        expect(result.metricsSink.errorSummary).toBe("metrics sink failed");
        expect(result.metricsSink.retryEligibility).toBe("eligible_for_retry");
        expect(result.metricsSink.recovery.sinkKind).toBe("metrics");
        expect(result.metricsSink.recovery.retryEligibility).toBe("eligible_for_retry");
        expect(result.metricsSink.recovery.recoveryReference.sinkKind).toBe("metrics");
        expect(result.metricsSink.recovery.recoveryReference.resultReference).toBe(reference);
        if (result.metricsSink.recovery.recoveryReference.sinkKind === "metrics") {
          expect(result.metricsSink.recovery.recoveryReference.sourceQueryName).toBe(
            "CommandResultQueryHandler.getCommandResultByReference"
          );
        }
        expect(result.metricsSink.recovery.recoveryReference.traceId).toBe(`query:${reference}`);
        expect(result.metricsSink.recovery.recoveryReference.failureCategory).toBe(
          "sink_dependency_failure"
        );
        expect(result.metricsSink.recovery.recoveryReference.recoveryId.length).toBeGreaterThan(0);
        expect(result.metricsSink.recovery.recoveryRecord.status).toBe("persisted");
        expect(result.metricsSink.recovery.auditEvents).toHaveLength(1);
        expect(result.metricsSink.recovery.auditEvents[0]?.eventType).toBe("RecoveryRecordChanged");
        expect(result.metricsSink.recovery.auditEvents[0]?.eventKind).toBe(
          "RecoveryRecordAppended"
        );
        expect(result.metricsSink.recovery.auditSink.status).toBe("succeeded");
      }
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(1);
  });

  it("keeps query result while exposing recovery append failure when metrics sink fails", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    metricsSink.fail = true;
    recoveryStore.failAppend = true;
    const reference = createCommandResultReference("query-ref-metrics-fail-recovery-append-fail");
    store.snapshots.set(reference, {
      schemaVersion: COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
      reference,
      commandName: "CreateRiskCaseCommand",
      riskCase: {
        caseId: "case-query-metrics-fail-recovery",
        caseType: "Liquidation",
        state: "Detected",
        stage: "Detection",
        configVersion: 1,
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z"
      },
      events: [],
      processing: {
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded",
        outcome: "completed"
      }
    });
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.metricsSink.status).toBe("failed");
      if (result.metricsSink.status === "failed") {
        expect(result.metricsSink.recovery.recoveryRecord.status).toBe("persist_failed");
        if (result.metricsSink.recovery.recoveryRecord.status === "persist_failed") {
          expect(result.metricsSink.recovery.recoveryRecord.errorSummary).toBe(
            "recovery append failed"
          );
        }
        expect(result.metricsSink.recovery.auditEvents).toHaveLength(0);
        expect(result.metricsSink.recovery.auditSink.status).toBe("not_attempted");
      }
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(0);
  });

  it("keeps query status while exposing recovery audit sink failure", async () => {
    const store = new FakeCommandResultStore();
    const metricsSink = new FakeMetricsSink();
    const recoveryStore = new FakeSinkFailureRecoveryStore();
    const auditSink = new FakeAuditEventSink();
    metricsSink.fail = true;
    auditSink.fail = true;
    const reference = createCommandResultReference("query-ref-recovery-audit-fail");
    store.snapshots.set(reference, {
      schemaVersion: COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
      reference,
      commandName: "CreateRiskCaseCommand",
      riskCase: {
        caseId: "case-query-recovery-audit-fail",
        caseType: "Liquidation",
        state: "Detected",
        stage: "Detection",
        configVersion: 1,
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z"
      },
      events: [],
      processing: {
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded",
        outcome: "completed"
      }
    });
    const handler = new CommandResultQueryHandler(store, metricsSink, recoveryStore, auditSink);

    const result = await handler.getCommandResultByReference(reference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.metricsSink.status).toBe("failed");
      if (result.metricsSink.status === "failed") {
        expect(result.metricsSink.recovery.auditSink.status).toBe("failed");
        if (result.metricsSink.recovery.auditSink.status === "failed") {
          expect(result.metricsSink.recovery.auditSink.errorSummary).toBe(
            "recovery audit sink failed"
          );
        }
      }
    }
    expect(metricsSink.calls).toBe(1);
    expect(recoveryStore.appendCalls).toBe(1);
    expect(auditSink.calls).toBe(1);
  });
});
