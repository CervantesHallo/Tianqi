import type {
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  StoredDiagnosticAlertSuppressionStateRepairLifecycle,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { dependencyFailureError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import type { DiagnosticAlertSuppressionStateRepairLifecycleState } from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import { DiagnosticAlertSuppressionStateRepairLifecycleRegistry } from "./diagnostic-alert-suppression-state-repair-lifecycle-registry.js";
import {
  validateSuppressionRepairLifecycleContinuity
} from "./diagnostic-alert-suppression-repair-lifecycle-continuity.js";
import {
  DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION
} from "./diagnostic-alert-suppression-repair-lifecycle-slot-schema.js";

export type DiagnosticAlertSuppressionStateRepairPersistenceSource =
  | "in_memory_only"
  | "persisted"
  | "persisted_with_fallback";

export type DiagnosticAlertSuppressionStateRepairPersistence = {
  readonly source: DiagnosticAlertSuppressionStateRepairPersistenceSource;
  readonly continuityStatus: "passed" | "notice" | "failed";
  readonly continuityReasonCategory: string;
  readonly continuityReason: string;
  readonly historyAvailable: boolean;
  readonly currentLifecycleReadable: boolean;
  readonly previousLifecycleAvailable: boolean;
  readonly lastCommandRecordId?: string;
};

const canRetry = (status: DiagnosticAlertSuppressionStateRepairLifecycleState["repairStatus"]): boolean =>
  status === "repair_failed_retryable" || status === "manually_confirmed";

const canConfirm = (status: DiagnosticAlertSuppressionStateRepairLifecycleState["repairStatus"]): boolean =>
  status === "repair_failed_retryable" || status === "repair_failed_manual_confirmation_required";

export const mapRepairLifecycleToStored = (
  lifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState
): StoredDiagnosticAlertSuppressionStateRepairLifecycle => ({
  repairStatus: lifecycle.repairStatus,
  repairAttempts: lifecycle.repairAttempts,
  ...(lifecycle.lastRepairOutcome ? { lastRepairOutcome: lifecycle.lastRepairOutcome } : {}),
  manualConfirmation: lifecycle.manualConfirmation,
  ...(lifecycle.lastReason ? { lastReason: lifecycle.lastReason } : {}),
  ...(lifecycle.lastAttemptedAt ? { lastAttemptedAt: lifecycle.lastAttemptedAt } : {}),
  ...(lifecycle.lastRepairedAt ? { lastRepairedAt: lifecycle.lastRepairedAt } : {}),
  targetSuppressionKey: lifecycle.targetSuppressionKey,
  ...(lifecycle.schemaVersionBefore ? { schemaVersionBefore: lifecycle.schemaVersionBefore } : {}),
  ...(lifecycle.schemaVersionAfter ? { schemaVersionAfter: lifecycle.schemaVersionAfter } : {}),
  canRetry: canRetry(lifecycle.repairStatus),
  canConfirmManually: canConfirm(lifecycle.repairStatus)
});

export const mapStoredRepairLifecycleToRuntime = (
  suppressionKey: string,
  lifecycle: StoredDiagnosticAlertSuppressionStateRepairLifecycle,
  updatedAt: string
): DiagnosticAlertSuppressionStateRepairLifecycleState => ({
  targetSuppressionKey: lifecycle.targetSuppressionKey || suppressionKey,
  repairStatus: lifecycle.repairStatus,
  repairAttempts: lifecycle.repairAttempts,
  ...(lifecycle.lastRepairOutcome ? { lastRepairOutcome: lifecycle.lastRepairOutcome } : {}),
  manualConfirmation: lifecycle.manualConfirmation,
  ...(lifecycle.lastReason ? { lastReason: lifecycle.lastReason } : {}),
  ...(lifecycle.lastAttemptedAt ? { lastAttemptedAt: lifecycle.lastAttemptedAt } : {}),
  ...(lifecycle.lastRepairedAt ? { lastRepairedAt: lifecycle.lastRepairedAt } : {}),
  ...(lifecycle.schemaVersionBefore ? { schemaVersionBefore: lifecycle.schemaVersionBefore } : {}),
  ...(lifecycle.schemaVersionAfter ? { schemaVersionAfter: lifecycle.schemaVersionAfter } : {}),
  lastUpdatedAt: updatedAt
});

export const createNextSuppressionRepairLifecycleSlot = (input: {
  readonly suppressionKey: string;
  readonly currentLifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState;
  readonly existingSlot?: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot;
  readonly lastCommandRecordId?: string;
  readonly updatedAt: string;
}): StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot => ({
  schemaVersion: DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION,
  suppressionKey: input.suppressionKey,
  currentLifecycle: mapRepairLifecycleToStored(input.currentLifecycle),
  ...(input.existingSlot ? { previousLifecycle: input.existingSlot.currentLifecycle } : {}),
  ...(input.lastCommandRecordId ? { lastCommandRecordId: input.lastCommandRecordId } : {}),
  updatedAt: input.updatedAt
});

export const persistSuppressionRepairLifecycleSlot = async (input: {
  readonly suppressionKey: string;
  readonly lifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState;
  readonly store?: DiagnosticAlertSuppressionStateRepairLifecycleStorePort;
  readonly lastCommandRecordId?: string;
  readonly updatedAt: string;
}): Promise<Result<{ readonly status: "persisted" | "not_configured" }, ApplicationError>> => {
  if (!input.store) {
    return ok({ status: "not_configured" });
  }
  const existing = await input.store.getBySuppressionKey(input.suppressionKey);
  if (!existing.ok) {
    return err(
      dependencyFailureError("Failed to read suppression repair lifecycle slot before write", {
        suppressionKey: input.suppressionKey,
        message: existing.error.message
      })
    );
  }
  const next = createNextSuppressionRepairLifecycleSlot({
    suppressionKey: input.suppressionKey,
    currentLifecycle: input.lifecycle,
    ...(existing.value.status === "found" ? { existingSlot: existing.value.slot } : {}),
    ...(input.lastCommandRecordId ? { lastCommandRecordId: input.lastCommandRecordId } : {}),
    updatedAt: input.updatedAt
  });
  const persisted = await input.store.put(next);
  if (!persisted.ok) {
    return err(
      dependencyFailureError("Failed to persist suppression repair lifecycle slot", {
        suppressionKey: input.suppressionKey,
        message: persisted.error.message
      })
    );
  }
  return ok({ status: "persisted" });
};

export const readSuppressionRepairLifecycleWithContinuity = async (input: {
  readonly suppressionKey: string;
  readonly registry: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  readonly store?: DiagnosticAlertSuppressionStateRepairLifecycleStorePort;
}): Promise<{
  readonly lifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState;
  readonly persistence: DiagnosticAlertSuppressionStateRepairPersistence;
}> => {
  const live = input.registry.getBySuppressionKey(input.suppressionKey);
  if (!input.store) {
    return {
      lifecycle: live,
      persistence: {
        source: "in_memory_only",
        continuityStatus: "notice",
        continuityReasonCategory: "slot_missing",
        continuityReason: "Suppression repair lifecycle store is not configured",
        historyAvailable: false,
        currentLifecycleReadable: true,
        previousLifecycleAvailable: false
      }
    };
  }

  const loaded = await input.store.getBySuppressionKey(input.suppressionKey);
  if (!loaded.ok) {
    return {
      lifecycle: live,
      persistence: {
        source: "persisted_with_fallback",
        continuityStatus: "notice",
        continuityReasonCategory: "slot_missing",
        continuityReason: `Suppression repair lifecycle store read failed: ${loaded.error.message}`,
        historyAvailable: false,
        currentLifecycleReadable: false,
        previousLifecycleAvailable: false
      }
    };
  }
  if (loaded.value.status === "missing") {
    return {
      lifecycle: live,
      persistence: {
        source: "in_memory_only",
        continuityStatus: "notice",
        continuityReasonCategory: "slot_missing",
        continuityReason: "Suppression repair lifecycle slot is missing",
        historyAvailable: false,
        currentLifecycleReadable: true,
        previousLifecycleAvailable: false
      }
    };
  }

  const slot = loaded.value.slot;
  const persistedCurrent = mapStoredRepairLifecycleToRuntime(
    input.suppressionKey,
    slot.currentLifecycle,
    slot.updatedAt
  );
  const continuity = validateSuppressionRepairLifecycleContinuity({
    suppressionKey: input.suppressionKey,
    liveLifecycle: live,
    persistedSlot: slot
  });
  if (!continuity.ok) {
    return {
      lifecycle: live,
      persistence: {
        source: "persisted_with_fallback",
        continuityStatus: "failed",
        continuityReasonCategory: "live_conflict",
        continuityReason: continuity.error.message,
        historyAvailable: Boolean(slot.previousLifecycle),
        currentLifecycleReadable: false,
        previousLifecycleAvailable: Boolean(slot.previousLifecycle),
        ...(slot.lastCommandRecordId ? { lastCommandRecordId: slot.lastCommandRecordId } : {})
      }
    };
  }
  if (continuity.value.status === "failed") {
    return {
      lifecycle: live,
      persistence: {
        source: "persisted_with_fallback",
        continuityStatus: continuity.value.status,
        continuityReasonCategory: continuity.value.reasonCategory,
        continuityReason: continuity.value.reason,
        historyAvailable: Boolean(slot.previousLifecycle),
        currentLifecycleReadable: false,
        previousLifecycleAvailable: Boolean(slot.previousLifecycle),
        ...(slot.lastCommandRecordId ? { lastCommandRecordId: slot.lastCommandRecordId } : {})
      }
    };
  }

  input.registry.setState(persistedCurrent);
  return {
    lifecycle: persistedCurrent,
    persistence: {
      source: "persisted",
      continuityStatus: continuity.value.status,
      continuityReasonCategory: continuity.value.reasonCategory,
      continuityReason: continuity.value.reason,
      historyAvailable: Boolean(slot.previousLifecycle),
      currentLifecycleReadable: true,
      previousLifecycleAvailable: Boolean(slot.previousLifecycle),
      ...(slot.lastCommandRecordId ? { lastCommandRecordId: slot.lastCommandRecordId } : {})
    }
  };
};

