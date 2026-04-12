import { describe, expect, it } from "vitest";

import { validateSuppressionRepairLifecycleCommandLink } from "./diagnostic-alert-suppression-repair-command-link-consistency.js";

describe("validateSuppressionRepairLifecycleCommandLink", () => {
  it("returns passed when lifecycle and command record are consistent", () => {
    const suppressionKey = "fact-1|status_field_conflict";
    const result = validateSuppressionRepairLifecycleCommandLink({
      slot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        updatedAt: "2026-03-25T00:00:03.000Z"
      },
      latestRecord: {
        commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        commandType: "retry",
        suppressionKey,
        triggeredAt: "2026-03-25T00:00:03.000Z",
        triggeredBy: "operator",
        outcome: "repaired",
        outcomeReason: "ok",
        resultingRepairStatus: "repaired",
        linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("passed");
    }
  });

  it("returns missing_record when lifecycle references absent record", () => {
    const suppressionKey = "fact-2|status_field_conflict";
    const result = validateSuppressionRepairLifecycleCommandLink({
      slot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 1,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: true
        },
        lastCommandRecordId: "missing-id",
        updatedAt: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("missing_record");
    }
  });

  it("returns status_mismatch when resulting status mismatches lifecycle", () => {
    const suppressionKey = "fact-3|status_field_conflict";
    const result = validateSuppressionRepairLifecycleCommandLink({
      slot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        updatedAt: "2026-03-25T00:00:03.000Z"
      },
      latestRecord: {
        commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        commandType: "retry",
        suppressionKey,
        triggeredAt: "2026-03-25T00:00:03.000Z",
        triggeredBy: "operator",
        outcome: "repaired",
        outcomeReason: "ok",
        resultingRepairStatus: "manually_confirmed",
        linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("status_mismatch");
    }
  });

  it("returns key_mismatch when command record key mismatches lifecycle key", () => {
    const suppressionKey = "fact-4|status_field_conflict";
    const result = validateSuppressionRepairLifecycleCommandLink({
      slot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        lastCommandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        updatedAt: "2026-03-25T00:00:03.000Z"
      },
      latestRecord: {
        commandRecordId: `${suppressionKey}|retry|2026-03-25T00:00:03.000Z`,
        commandType: "retry",
        suppressionKey: "fact-4|other_reason",
        triggeredAt: "2026-03-25T00:00:03.000Z",
        triggeredBy: "operator",
        outcome: "repaired",
        outcomeReason: "ok",
        resultingRepairStatus: "repaired",
        linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("key_mismatch");
    }
  });
});

