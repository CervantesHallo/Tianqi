import type {
  MetricsSinkPort,
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

import { SinkFailureRecoveryQueryHandler } from "./sink-failure-recovery-query-handler.js";

class FakeSinkFailureRecoveryStore implements SinkFailureRecoveryStorePort {
  public readonly records = new Map<string, SinkFailureRecoveryRecord>();
  public failLookup = false;

  public async append(record: SinkFailureRecoveryRecord) {
    this.records.set(record.recoveryReference, record);
    return ok({ status: "appended" as const });
  }

  public async getByRecoveryReference(recoveryReference: SinkFailureRecoveryRecord["recoveryReference"]) {
    if (this.failLookup) {
      return err({ message: "recovery lookup unavailable" });
    }
    const record = this.records.get(recoveryReference);
    if (!record) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, record });
  }
}

class FakeMetricsSink implements MetricsSinkPort {
  public calls = 0;
  public fail = false;

  public async record() {
    this.calls += 1;
    if (this.fail) {
      return err({ message: "recovery metrics sink failed" });
    }
    return ok(undefined);
  }
}

const seedRecoveryRecord = (
  recoveryReference: ReturnType<typeof createSinkRecoveryReferenceId>
): SinkFailureRecoveryRecord => ({
  recoveryReference,
  sinkKind: "metrics",
  retryEligibility: "eligible_for_retry",
  failureCategory: "sink_dependency_failure",
  sourceQueryName: "CommandResultQueryHandler.getCommandResultByReference",
  resultReference: createCommandResultReference("result-ref-query-001"),
  traceId: "query:result-ref-query-001",
  createdAt: "2026-03-25T00:00:00.000Z",
  status: "open"
});

describe("SinkFailureRecoveryQueryHandler", () => {
  it("returns found recovery record by recovery reference", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-query-ref-found");
    const store = new FakeSinkFailureRecoveryStore();
    const metricsSink = new FakeMetricsSink();
    store.records.set(recoveryReference, seedRecoveryRecord(recoveryReference));
    const handler = new SinkFailureRecoveryQueryHandler(store, metricsSink);

    const result = await handler.getByRecoveryReference(recoveryReference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.record.recoveryReference).toBe(recoveryReference);
      expect(result.record.sinkKind).toBe("metrics");
      expect(result.record.status).toBe("open");
      expect(result.diagnostics.outcome).toBe("found");
      expect(result.diagnostics.statusCategory).toBe("open");
      expect(result.diagnostics.retryEligibilityCategory).toBe("eligible_for_retry");
      expect(result.diagnostics.hasNote).toBe(false);
      expect(result.diagnostics.storeAccessed).toBe(true);
      expect(result.diagnostics.fallbackApplied).toBe(false);
      expect(result.metricsSink.status).toBe("succeeded");
    }
    expect(metricsSink.calls).toBe(1);
  });

  it("returns missing when recovery record does not exist", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-query-ref-missing");
    const metricsSink = new FakeMetricsSink();
    const handler = new SinkFailureRecoveryQueryHandler(new FakeSinkFailureRecoveryStore(), metricsSink);

    const result = await handler.getByRecoveryReference(recoveryReference);
    expect(result.status).toBe("missing");
    if (result.status === "missing") {
      expect(result.recoveryReference).toBe(recoveryReference);
      expect(result.diagnostics.outcome).toBe("missing");
      expect(result.diagnostics.statusCategory).toBe("none");
      expect(result.diagnostics.retryEligibilityCategory).toBe("not_applicable");
      expect(result.diagnostics.hasNote).toBe(false);
      expect(result.metricsSink.status).toBe("succeeded");
    }
    expect(metricsSink.calls).toBe(1);
  });

  it("returns unavailable when query dependency fails", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-query-ref-unavailable");
    const store = new FakeSinkFailureRecoveryStore();
    const metricsSink = new FakeMetricsSink();
    store.failLookup = true;
    const handler = new SinkFailureRecoveryQueryHandler(store, metricsSink);

    const result = await handler.getByRecoveryReference(recoveryReference);
    expect(result.status).toBe("unavailable");
    if (result.status === "unavailable") {
      expect(result.error.code).toBe("TQ-APP-004");
      expect(result.recoveryReference).toBe(recoveryReference);
      expect(result.diagnostics.outcome).toBe("unavailable");
      expect(result.diagnostics.statusCategory).toBe("none");
      expect(result.diagnostics.retryEligibilityCategory).toBe("not_applicable");
      expect(result.diagnostics.hasNote).toBe(false);
      expect(result.metricsSink.status).toBe("succeeded");
    }
    expect(metricsSink.calls).toBe(1);
  });

  it("keeps query status while exposing metrics sink failure", async () => {
    const recoveryReference = createSinkRecoveryReferenceId("recovery-query-ref-metrics-fail");
    const store = new FakeSinkFailureRecoveryStore();
    const metricsSink = new FakeMetricsSink();
    metricsSink.fail = true;
    store.records.set(recoveryReference, seedRecoveryRecord(recoveryReference));
    const handler = new SinkFailureRecoveryQueryHandler(store, metricsSink);

    const result = await handler.getByRecoveryReference(recoveryReference);
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.metricsSink.status).toBe("failed");
      if (result.metricsSink.status === "failed") {
        expect(result.metricsSink.errorSummary).toBe("recovery metrics sink failed");
      }
    }
    expect(metricsSink.calls).toBe(1);
  });
});
