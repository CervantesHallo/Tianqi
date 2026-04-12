import { describe, expect, it } from "vitest";
import { ok } from "@tianqi/shared";

import type { DiagnosticAlertSuppressionStorePort, StoredDiagnosticAlertSuppressionState } from "@tianqi/ports";

import {
  applyDiagnosticAlertSuppression,
  applyDiagnosticAlertSuppressionWithPersistence,
  buildDiagnosticAlertSuppressionKey,
  DiagnosticAlertSuppressionRegistry
} from "./coordination-diagnostic-alert-suppression.js";
import type { DiagnosticHistoryReplayValidationResult } from "./coordination-diagnostic-history-replay-validation.js";
import type { DiagnosticReadAlert } from "./coordination-diagnostic-replay-operational-assessment.js";

const warningAlert = (): DiagnosticReadAlert => ({
  severity: "warning",
  alertCode: "TQ-DIAG-WARN-STATUS_FIELD_CONFLICT",
  alertSummary: "warning",
  operationalHint: "inspect_snapshot_conflict",
  triggerSource: "replay_validation",
  requiresAttention: true
});

const criticalAlert = (): DiagnosticReadAlert => ({
  severity: "critical",
  alertCode: "TQ-DIAG-CRIT-SCHEMA_INCOMPATIBLE",
  alertSummary: "critical",
  operationalHint: "inspect_history_slot_schema",
  triggerSource: "replay_validation",
  requiresAttention: true
});

class FakeDiagnosticAlertSuppressionStore implements DiagnosticAlertSuppressionStorePort {
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionState>();
  public failGet = false;
  public failPut = false;

  public async put(state: StoredDiagnosticAlertSuppressionState) {
    if (this.failPut) {
      return {
        ok: false as const,
        error: { message: "suppression put failed intentionally" }
      };
    }
    this.byKey.set(state.suppressionKey, state);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    if (this.failGet) {
      return {
        ok: false as const,
        error: { message: "suppression get failed intentionally" }
      };
    }
    const state = this.byKey.get(suppressionKey);
    return ok(state ? { status: "found" as const, state } : { status: "missing" as const });
  }
}

describe("DiagnosticAlertSuppressionRegistry", () => {
  it("emits on first occurrence", () => {
    const registry = new DiagnosticAlertSuppressionRegistry();
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "notice",
      reasonCategory: "status_field_conflict",
      reason: "notice"
    };
    const result = applyDiagnosticAlertSuppression({
      factKey: "fact-1",
      replayValidation: replay,
      alert: warningAlert(),
      registry,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    expect(result.status).toBe("emitted");
    expect(result.repeatCount).toBe(1);
    expect(result.suppressionKey).toBe(
      buildDiagnosticAlertSuppressionKey({
        factKey: "fact-1",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation"
      })
    );
  });

  it("deduplicates repeated warning alert for same key", () => {
    const registry = new DiagnosticAlertSuppressionRegistry();
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "notice",
      reasonCategory: "status_field_conflict",
      reason: "notice"
    };
    applyDiagnosticAlertSuppression({
      factKey: "fact-2",
      replayValidation: replay,
      alert: warningAlert(),
      registry,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    const second = applyDiagnosticAlertSuppression({
      factKey: "fact-2",
      replayValidation: replay,
      alert: warningAlert(),
      registry,
      observedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(second.status).toBe("deduplicated");
    expect(second.repeatCount).toBe(2);
  });

  it("does not merge different reasonCategory under same factKey", () => {
    const registry = new DiagnosticAlertSuppressionRegistry();
    applyDiagnosticAlertSuppression({
      factKey: "fact-3",
      replayValidation: {
        status: "notice",
        reasonCategory: "status_field_conflict",
        reason: "status notice"
      },
      alert: warningAlert(),
      registry,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    const second = applyDiagnosticAlertSuppression({
      factKey: "fact-3",
      replayValidation: {
        status: "notice",
        reasonCategory: "version_mismatch",
        reason: "version notice"
      },
      alert: warningAlert(),
      registry,
      observedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(second.status).toBe("emitted");
    expect(second.repeatCount).toBe(1);
  });

  it("uses suppressed_with_notice for repeated critical alerts", () => {
    const registry = new DiagnosticAlertSuppressionRegistry();
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "failed",
      reasonCategory: "schema_incompatible",
      reason: "failed"
    };
    applyDiagnosticAlertSuppression({
      factKey: "fact-4",
      replayValidation: replay,
      alert: criticalAlert(),
      registry,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    const second = applyDiagnosticAlertSuppression({
      factKey: "fact-4",
      replayValidation: replay,
      alert: criticalAlert(),
      registry,
      observedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(second.status).toBe("suppressed_with_notice");
    expect(second.repeatCount).toBe(2);
  });

  it("persists suppression state and keeps repeatCount continuity across fresh registry", async () => {
    const store = new FakeDiagnosticAlertSuppressionStore();
    const firstRegistry = new DiagnosticAlertSuppressionRegistry();
    const first = await applyDiagnosticAlertSuppressionWithPersistence({
      factKey: "fact-5",
      replayValidation: {
        status: "notice",
        reasonCategory: "status_field_conflict",
        reason: "notice"
      },
      alert: warningAlert(),
      registry: firstRegistry,
      store,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    expect(first.suppression.status).toBe("emitted");
    expect(first.persistence.source).toBe("persisted");
    expect(first.persistence.writeStatus).toBe("written");
    expect(first.persistence.stateReadCompatibility).toBe("state_missing");

    const secondRegistry = new DiagnosticAlertSuppressionRegistry();
    const second = await applyDiagnosticAlertSuppressionWithPersistence({
      factKey: "fact-5",
      replayValidation: {
        status: "notice",
        reasonCategory: "status_field_conflict",
        reason: "notice"
      },
      alert: warningAlert(),
      registry: secondRegistry,
      store,
      observedAt: "2026-03-25T00:00:02.000Z"
    });
    expect(second.suppression.status).toBe("deduplicated");
    expect(second.suppression.repeatCount).toBe(2);
    expect(second.persistence.continuityStatus).toBe("passed");
    expect(second.persistence.isRepeatCountContinuous).toBe(true);
    expect(second.persistence.stateReadCompatibility).toBe("compatible_read");
  });

  it("returns persisted_with_fallback when continuity validation fails", async () => {
    const store = new FakeDiagnosticAlertSuppressionStore();
    const key = buildDiagnosticAlertSuppressionKey({
      factKey: "fact-6",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation"
    });
    store.byKey.set(key, {
      schemaVersion: "1.0.0",
      suppressionKey: "fact-6|version_mismatch",
      factKey: "fact-6",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 5,
      lastStatus: "deduplicated"
    });

    const result = await applyDiagnosticAlertSuppressionWithPersistence({
      factKey: "fact-6",
      replayValidation: {
        status: "notice",
        reasonCategory: "status_field_conflict",
        reason: "notice"
      },
      alert: warningAlert(),
      registry: new DiagnosticAlertSuppressionRegistry(),
      store,
      observedAt: "2026-03-25T00:00:03.000Z"
    });
    expect(result.persistence.source).toBe("persisted_with_fallback");
    expect(result.persistence.continuityStatus).toBe("failed");
    expect(result.persistence.continuityReasonCategory).toBe("suppression_key_mismatch");
    expect(result.persistence.stateReadCompatibility).toBe("compatible_read");
  });

  it("returns in_memory_only when no suppression store configured", async () => {
    const result = await applyDiagnosticAlertSuppressionWithPersistence({
      factKey: "fact-7",
      replayValidation: {
        status: "notice",
        reasonCategory: "version_mismatch",
        reason: "notice"
      },
      alert: warningAlert(),
      registry: new DiagnosticAlertSuppressionRegistry(),
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    expect(result.persistence.source).toBe("in_memory_only");
    expect(result.persistence.writeStatus).toBe("not_attempted");
    expect(result.persistence.stateReadCompatibility).toBe("state_missing");
  });

  it("returns persisted_with_fallback on suppression store write failure", async () => {
    const store = new FakeDiagnosticAlertSuppressionStore();
    store.failPut = true;
    const result = await applyDiagnosticAlertSuppressionWithPersistence({
      factKey: "fact-8",
      replayValidation: {
        status: "notice",
        reasonCategory: "version_mismatch",
        reason: "notice"
      },
      alert: warningAlert(),
      registry: new DiagnosticAlertSuppressionRegistry(),
      store,
      observedAt: "2026-03-25T00:00:01.000Z"
    });
    expect(result.persistence.source).toBe("persisted_with_fallback");
    expect(result.persistence.writeStatus).toBe("write_failed");
    expect(result.persistence.stateReadCompatibility).toBe("state_missing");
  });
});
