import type {
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  DiagnosticAlertSuppressionStorePort,
  StoredDiagnosticAlertSuppressionRepairCommandRecord,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot,
  StoredDiagnosticAlertSuppressionState
} from "@tianqi/ports";
import { ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { DiagnosticAlertSuppressionStateRepairCommandHandler } from "./diagnostic-alert-suppression-state-repair-command-handler.js";

class FakeDiagnosticAlertSuppressionStore implements DiagnosticAlertSuppressionStorePort {
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionState>();

  public async put(state: StoredDiagnosticAlertSuppressionState) {
    this.byKey.set(state.suppressionKey, state);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    const state = this.byKey.get(suppressionKey);
    return ok(state ? { status: "found" as const, state } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairLifecycleStore
  implements DiagnosticAlertSuppressionStateRepairLifecycleStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot>();

  public async put(slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot) {
    this.byKey.set(slot.suppressionKey, slot);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    const slot = this.byKey.get(suppressionKey);
    return ok(slot ? { status: "found" as const, slot } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairCommandRecordStore
  implements DiagnosticAlertSuppressionRepairCommandRecordStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionRepairCommandRecord>();
  public failPut = false;

  public async put(record: StoredDiagnosticAlertSuppressionRepairCommandRecord) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "repair command record put failed intentionally" }
      };
    }
    this.byKey.set(record.suppressionKey, record);
    return ok(undefined);
  }

  public async getLatestBySuppressionKey(suppressionKey: string) {
    const record = this.byKey.get(suppressionKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }
}

describe("DiagnosticAlertSuppressionStateRepairCommandHandler", () => {
  it("repairs state when schemaVersion is missing", async () => {
    const key = "fact-1|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      suppressionKey: key,
      factKey: "fact-1",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:01.000Z",
      repeatCount: 1,
      lastStatus: "emitted"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "repair missing version",
      repairedAt: "2026-03-25T00:00:02.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("repaired");
      expect(result.record.repairStatus).toBe("repaired");
      expect(result.record.repairedSchemaVersion).toBe("1.0.0");
      expect(result.record.compatibilityAfter?.status).toBe("compatible_read");
    }
  });

  it("repairs supported old version to current schema", async () => {
    const key = "fact-2|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "0.9.0",
      suppressionKey: key,
      factKey: "fact-2",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "repair old version",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("repaired");
      expect(result.record.repairStatus).toBe("repaired");
      expect(result.record.compatibilityBefore.status).toBe("compatible_with_notice");
      expect(result.record.compatibilityAfter?.status).toBe("compatible_read");
    }
  });

  it("repairs repeatCount and timeline anomalies", async () => {
    const key = "fact-3|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-3",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "invalid-time",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 0,
      lastStatus: "suppressed_with_notice"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "repair malformed state",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("repaired");
      expect(result.record.repairStatus).toBe("repaired");
      const repaired = store.byKey.get(key);
      expect(repaired?.repeatCount).toBe(1);
      expect(repaired?.lastStatus).toBe("emitted");
      expect(repaired?.firstSeenAt).toBe(repaired?.lastSeenAt);
    }
  });

  it("fails repair when suppression key conflicts with semantic fields", async () => {
    const key = "fact-4|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-4",
      reasonCategory: "version_mismatch",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "repair conflict",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.record.outcome).toBe("failed");
      expect(result.record.repairStatus).toBe("repair_failed_manual_confirmation_required");
    }
  });

  it("fails repair when critical semantic fields are missing", async () => {
    const key = "fact-5|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "repair missing field",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.record.outcome).toBe("failed");
      expect(result.record.repairStatus).toBe("repair_failed_manual_confirmation_required");
    }
  });

  it("returns noop when state is already compatible", async () => {
    const key = "fact-6|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-6",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });

    const result = await handler.handle({
      suppressionKey: key,
      reason: "noop",
      repairedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "manual"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("noop");
      expect(result.record.repairStatus).toBe("repaired");
      expect(result.record.lastRepairOutcome).toBe("noop");
    }
  });

  it("moves failed retryable state to manually_confirmed by confirm command", async () => {
    const key = "fact-7|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-7",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });
    handler.getRepairLifecycleRegistry().transition({
      suppressionKey: key,
      to: "repair_failed_retryable",
      outcome: "failed",
      attempts: 1,
      manualConfirmation: false,
      reason: "retryable",
      attemptedAt: "2026-03-25T00:00:03.000Z",
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const result = await handler.handleConfirmManually({
      suppressionKey: key,
      reason: "manual confirm",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.record.outcome).toBe("manually_confirmed");
      expect(result.record.repairStatus).toBe("manually_confirmed");
      expect(result.record.manualConfirmation).toBe(true);
    }
  });

  it("allows retry from manually_confirmed and reaches repaired when successful", async () => {
    const key = "fact-8|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "0.9.0",
      suppressionKey: key,
      factKey: "fact-8",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });
    handler.getRepairLifecycleRegistry().transition({
      suppressionKey: key,
      to: "manually_confirmed",
      outcome: "manually_confirmed",
      attempts: 1,
      manualConfirmation: true,
      reason: "manual confirm",
      attemptedAt: "2026-03-25T00:00:03.000Z",
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const retried = await handler.handleRetry({
      suppressionKey: key,
      reason: "retry after confirm",
      retriedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(retried.success).toBe(true);
    if (retried.success) {
      expect(retried.record.outcome).toBe("repaired");
      expect(retried.record.repairStatus).toBe("repaired");
    }
  });

  it("blocks retry when state is not retryable", async () => {
    const key = "fact-9|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-9",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });
    handler.getRepairLifecycleRegistry().transition({
      suppressionKey: key,
      to: "repaired",
      outcome: "repaired",
      attempts: 1,
      manualConfirmation: false,
      reason: "already repaired",
      attemptedAt: "2026-03-25T00:00:03.000Z",
      repairedAt: "2026-03-25T00:00:03.000Z",
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const retried = await handler.handleRetry({
      suppressionKey: key,
      reason: "retry blocked",
      retriedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(retried.success).toBe(false);
    if (!retried.success) {
      expect(retried.record.repairStatus).toBe("repaired");
    }
  });

  it("blocks confirm when current state is repaired", async () => {
    const key = "fact-10|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: key,
      factKey: "fact-10",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store
    });
    handler.getRepairLifecycleRegistry().transition({
      suppressionKey: key,
      to: "repaired",
      outcome: "repaired",
      attempts: 1,
      manualConfirmation: false,
      reason: "already repaired",
      attemptedAt: "2026-03-25T00:00:03.000Z",
      repairedAt: "2026-03-25T00:00:03.000Z",
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const confirmed = await handler.handleConfirmManually({
      suppressionKey: key,
      reason: "invalid confirm",
      confirmedAt: "2026-03-25T00:00:04.000Z",
      triggeredBy: "operator"
    });
    expect(confirmed.success).toBe(false);
    if (!confirmed.success) {
      expect(confirmed.record.repairStatus).toBe("repaired");
    }
  });

  it("writes persisted lifecycle slot after repair success", async () => {
    const key = "fact-11|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandRecordStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    store.byKey.set(key, {
      suppressionKey: key,
      factKey: "fact-11",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:01.000Z",
      repeatCount: 1,
      lastStatus: "emitted"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store,
      repairLifecycleStore: lifecycleStore,
      repairCommandRecordStore: commandRecordStore
    });

    const repaired = await handler.handle({
      suppressionKey: key,
      reason: "persist lifecycle",
      repairedAt: "2026-03-25T00:00:02.000Z",
      triggeredBy: "manual"
    });
    expect(repaired.success).toBe(true);
    const slot = lifecycleStore.byKey.get(key);
    expect(slot?.currentLifecycle.repairStatus).toBe("repaired");
    expect(slot?.previousLifecycle).toBeUndefined();
    expect(slot?.lastCommandRecordId).toBeDefined();
    const latest = commandRecordStore.byKey.get(key);
    expect(latest?.commandType).toBe("repair");
    expect(latest?.resultingRepairStatus).toBe("repaired");
  });

  it("updates persisted lifecycle slot when confirm succeeds", async () => {
    const key = "fact-12|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandRecordStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    store.byKey.set(key, {
      suppressionKey: key,
      factKey: "fact-12",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:01.000Z",
      repeatCount: 1,
      lastStatus: "emitted"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store,
      repairLifecycleStore: lifecycleStore,
      repairCommandRecordStore: commandRecordStore
    });
    handler.getRepairLifecycleRegistry().transition({
      suppressionKey: key,
      to: "repair_failed_manual_confirmation_required",
      outcome: "failed",
      attempts: 1,
      manualConfirmation: false,
      reason: "needs confirm",
      attemptedAt: "2026-03-25T00:00:02.000Z",
      updatedAt: "2026-03-25T00:00:02.000Z"
    });
    await lifecycleStore.put({
      schemaVersion: "1.0.0",
      suppressionKey: key,
      currentLifecycle: {
        repairStatus: "repair_failed_manual_confirmation_required",
        repairAttempts: 1,
        lastRepairOutcome: "failed",
        manualConfirmation: false,
        lastReason: "needs confirm",
        lastAttemptedAt: "2026-03-25T00:00:02.000Z",
        targetSuppressionKey: key,
        canRetry: false,
        canConfirmManually: true
      },
      updatedAt: "2026-03-25T00:00:02.000Z"
    });

    const confirmed = await handler.handleConfirmManually({
      suppressionKey: key,
      reason: "manual confirmed",
      confirmedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator"
    });
    expect(confirmed.success).toBe(true);
    const slot = lifecycleStore.byKey.get(key);
    expect(slot?.currentLifecycle.repairStatus).toBe("manually_confirmed");
    expect(slot?.currentLifecycle.manualConfirmation).toBe(true);
    expect(slot?.previousLifecycle?.repairStatus).toBe("repair_failed_manual_confirmation_required");
    const latest = commandRecordStore.byKey.get(key);
    expect(latest?.commandType).toBe("confirm");
    expect(latest?.resultingRepairStatus).toBe("manually_confirmed");
  });

  it("rotates previous/current lifecycle in persisted slot after retry success", async () => {
    const key = "fact-13|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandRecordStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    store.byKey.set(key, {
      schemaVersion: "0.9.0",
      suppressionKey: key,
      factKey: "fact-13",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });
    await lifecycleStore.put({
      schemaVersion: "1.0.0",
      suppressionKey: key,
      currentLifecycle: {
        repairStatus: "manually_confirmed",
        repairAttempts: 1,
        lastRepairOutcome: "manually_confirmed",
        manualConfirmation: true,
        lastReason: "manual",
        lastAttemptedAt: "2026-03-25T00:00:02.000Z",
        targetSuppressionKey: key,
        canRetry: true,
        canConfirmManually: false
      },
      updatedAt: "2026-03-25T00:00:02.000Z"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store,
      repairLifecycleStore: lifecycleStore,
      repairCommandRecordStore: commandRecordStore
    });

    const retried = await handler.handleRetry({
      suppressionKey: key,
      reason: "retry persist rotate",
      retriedAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator"
    });
    expect(retried.success).toBe(true);
    const slot = lifecycleStore.byKey.get(key);
    expect(slot?.currentLifecycle.repairStatus).toBe("repaired");
    expect(slot?.previousLifecycle?.repairStatus).toBe("manually_confirmed");
    const latest = commandRecordStore.byKey.get(key);
    expect(latest?.commandType).toBe("retry");
    expect(latest?.resultingRepairStatus).toBe("repaired");
  });

  it("keeps lifecycle main semantics when command record write fails", async () => {
    const key = "fact-14|status_field_conflict";
    const store = new FakeDiagnosticAlertSuppressionStore();
    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    const commandRecordStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    commandRecordStore.failPut = true;
    store.byKey.set(key, {
      suppressionKey: key,
      factKey: "fact-14",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:01.000Z",
      repeatCount: 1,
      lastStatus: "emitted"
    });
    const handler = new DiagnosticAlertSuppressionStateRepairCommandHandler({
      alertSuppressionStore: store,
      repairLifecycleStore: lifecycleStore,
      repairCommandRecordStore: commandRecordStore
    });

    const repaired = await handler.handle({
      suppressionKey: key,
      reason: "record fail fallback",
      repairedAt: "2026-03-25T00:00:02.000Z",
      triggeredBy: "manual"
    });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.record.repairStatus).toBe("repaired");
      expect(repaired.record.commandRecordId).toBeUndefined();
    }
  });
});
