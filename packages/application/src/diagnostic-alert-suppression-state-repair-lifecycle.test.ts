import { describe, expect, it } from "vitest";

import { mapContinuityFailureToRepairStatus } from "./diagnostic-alert-suppression-state-repair-lifecycle.js";

describe("mapContinuityFailureToRepairStatus", () => {
  it("maps light continuity issues to retryable", () => {
    const mapped = mapContinuityFailureToRepairStatus({
      persistence: {
        source: "persisted_with_fallback",
        readStatus: "found",
        writeStatus: "not_attempted",
        stateReadCompatibility: "missing_version",
        stateCompatibilityReason: "missing",
        stateRepairAvailable: true,
        stateRepairRecommended: true,
        stateRepairStatus: "failed",
        continuityStatus: "failed",
        continuityReasonCategory: "schema_missing",
        continuityReason: "missing schema",
        isRepeatCountContinuous: false,
        suppressionStateRepair: {
          repairStatus: "not_repaired",
          repairAttempts: 0,
          manualConfirmation: false,
          targetSuppressionKey: "fact|reason",
          canRetry: false,
          canConfirmManually: false
        },
        suppressionStateRepairPersistence: {
          source: "in_memory_only",
          continuityStatus: "notice",
          continuityReasonCategory: "slot_missing",
          continuityReason: "missing slot",
          historyAvailable: false,
          currentLifecycleReadable: true,
          previousLifecycleAvailable: false
        }
      }
    });
    expect(mapped).toBe("repair_failed_retryable");
  });

  it("maps semantic conflicts to manual confirmation required", () => {
    const mapped = mapContinuityFailureToRepairStatus({
      persistence: {
        source: "persisted_with_fallback",
        readStatus: "found",
        writeStatus: "not_attempted",
        stateReadCompatibility: "compatible_read",
        stateCompatibilityReason: "ok",
        stateRepairAvailable: false,
        stateRepairRecommended: true,
        stateRepairStatus: "failed",
        continuityStatus: "failed",
        continuityReasonCategory: "suppression_key_mismatch",
        continuityReason: "conflict",
        isRepeatCountContinuous: false,
        suppressionStateRepair: {
          repairStatus: "not_repaired",
          repairAttempts: 0,
          manualConfirmation: false,
          targetSuppressionKey: "fact|reason",
          canRetry: false,
          canConfirmManually: false
        },
        suppressionStateRepairPersistence: {
          source: "in_memory_only",
          continuityStatus: "notice",
          continuityReasonCategory: "slot_missing",
          continuityReason: "missing slot",
          historyAvailable: false,
          currentLifecycleReadable: true,
          previousLifecycleAvailable: false
        }
      }
    });
    expect(mapped).toBe("repair_failed_manual_confirmation_required");
  });

  it("maps incompatible version to manual confirmation required", () => {
    const mapped = mapContinuityFailureToRepairStatus({
      persistence: {
        source: "persisted_with_fallback",
        readStatus: "found",
        writeStatus: "not_attempted",
        stateReadCompatibility: "incompatible_version",
        stateCompatibilityReason: "incompatible",
        stateRepairAvailable: false,
        stateRepairRecommended: true,
        stateRepairStatus: "failed",
        continuityStatus: "failed",
        continuityReasonCategory: "schema_incompatible",
        continuityReason: "incompatible",
        isRepeatCountContinuous: false,
        suppressionStateRepair: {
          repairStatus: "not_repaired",
          repairAttempts: 0,
          manualConfirmation: false,
          targetSuppressionKey: "fact|reason",
          canRetry: false,
          canConfirmManually: false
        },
        suppressionStateRepairPersistence: {
          source: "in_memory_only",
          continuityStatus: "notice",
          continuityReasonCategory: "slot_missing",
          continuityReason: "missing slot",
          historyAvailable: false,
          currentLifecycleReadable: true,
          previousLifecycleAvailable: false
        }
      }
    });
    expect(mapped).toBe("repair_failed_manual_confirmation_required");
  });
});
