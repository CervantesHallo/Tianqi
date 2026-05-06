import { describe, expect, it } from "vitest";

import { validateSuppressionRepairLifecycleContinuity } from "./diagnostic-alert-suppression-repair-lifecycle-continuity.js";

describe("validateSuppressionRepairLifecycleContinuity", () => {
  it("passes when persisted slot is consistent with live lifecycle", () => {
    const suppressionKey = "fact-1|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: true,
        lastAttemptedAt: "2026-03-25T00:00:02.000Z",
        lastRepairedAt: "2026-03-25T00:00:02.000Z",
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          lastRepairOutcome: "repaired",
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:02.000Z",
          lastRepairedAt: "2026-03-25T00:00:02.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        previousLifecycle: {
          repairStatus: "manually_confirmed",
          repairAttempts: 1,
          lastRepairOutcome: "manually_confirmed",
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:01.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("passed");
    }
  });

  it("returns notice when persisted slot is missing", () => {
    const suppressionKey = "fact-2|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "not_repaired",
        repairAttempts: 0,
        manualConfirmation: false,
        lastUpdatedAt: new Date(0).toISOString()
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("notice");
      expect(result.value.reasonCategory).toBe("slot_missing");
    }
  });

  it("fails when repairAttempts regresses", () => {
    const suppressionKey = "fact-3|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repair_failed_retryable",
        repairAttempts: 3,
        manualConfirmation: false,
        lastUpdatedAt: "2026-03-25T00:00:03.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: true
        },
        updatedAt: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("attempts_regressed");
    }
  });

  it("fails when previous->current transition is invalid", () => {
    const suppressionKey = "fact-4|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repair_failed_retryable",
        repairAttempts: 2,
        manualConfirmation: false,
        lastUpdatedAt: "2026-03-25T00:00:03.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: true
        },
        previousLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 1,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("invalid_transition");
    }
  });

  it("fails when persisted timeline is invalid", () => {
    const suppressionKey = "fact-5|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 1,
        manualConfirmation: true,
        lastUpdatedAt: "2026-03-25T00:00:03.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 1,
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:04.000Z",
          lastRepairedAt: "2026-03-25T00:00:03.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:04.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("invalid_timeline");
    }
  });

  // Phase 10 / Step 7 coverage upgrade — exercise previously-uncovered branches
  // (per ADR-0003 Step 7 K.2 path B; raise lines coverage to ≥85% safety margin).

  it("fails when persisted previous lifecycle is malformed (manual/status mismatch)", () => {
    const suppressionKey = "fact-6|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 2,
        manualConfirmation: true,
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:02.000Z",
          lastRepairedAt: "2026-03-25T00:00:02.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        previousLifecycle: {
          // manualConfirmation=true with repairStatus="not_repaired" is invalid
          repairStatus: "not_repaired",
          repairAttempts: 1,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("invalid_timeline");
    }
  });

  it("fails when persisted previous lifecycle has invalid timeline", () => {
    const suppressionKey = "fact-7|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 2,
        manualConfirmation: true,
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:02.000Z",
          lastRepairedAt: "2026-03-25T00:00:02.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        previousLifecycle: {
          // lastRepairedAt earlier than lastAttemptedAt (timeline invariant violated)
          repairStatus: "manually_confirmed",
          repairAttempts: 1,
          manualConfirmation: true,
          lastAttemptedAt: "2026-03-25T00:00:05.000Z",
          lastRepairedAt: "2026-03-25T00:00:01.000Z",
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("invalid_timeline");
    }
  });

  it("fails when current attempts regressed against previous lifecycle attempts", () => {
    const suppressionKey = "fact-8|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repair_failed_retryable",
        repairAttempts: 1,
        manualConfirmation: false,
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          // Current attempts=1 but previous=2 (regressed)
          repairStatus: "repair_failed_retryable",
          repairAttempts: 1,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: true
        },
        previousLifecycle: {
          repairStatus: "manually_confirmed",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("attempts_regressed");
    }
  });

  it("fails when persisted current attempts < live in-memory attempts", () => {
    const suppressionKey = "fact-9|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        // Live attempts=3 but persisted current=2 (regressed)
        targetSuppressionKey: suppressionKey,
        repairStatus: "repair_failed_retryable",
        repairAttempts: 3,
        manualConfirmation: false,
        lastUpdatedAt: "2026-03-25T00:00:03.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          manualConfirmation: false,
          targetSuppressionKey: suppressionKey,
          canRetry: true,
          canConfirmManually: true
        },
        updatedAt: "2026-03-25T00:00:03.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("attempts_regressed");
    }
  });

  it("fails when persisted current conflicts with live in-memory (status mismatch)", () => {
    const suppressionKey = "fact-10|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 2,
        manualConfirmation: true,
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          // Persisted status differs from live status while attempts > 0 (live conflict)
          repairStatus: "manually_confirmed",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("live_conflict");
    }
  });

  it("fails when persisted current conflicts with live in-memory (manualConfirmation mismatch)", () => {
    const suppressionKey = "fact-11|status_field_conflict";
    const result = validateSuppressionRepairLifecycleContinuity({
      suppressionKey,
      liveLifecycle: {
        targetSuppressionKey: suppressionKey,
        repairStatus: "repaired",
        repairAttempts: 2,
        manualConfirmation: false,
        lastUpdatedAt: "2026-03-25T00:00:02.000Z"
      },
      persistedSlot: {
        schemaVersion: "1.0.0",
        suppressionKey,
        currentLifecycle: {
          // Same status but manualConfirmation differs (live conflict)
          repairStatus: "repaired",
          repairAttempts: 2,
          manualConfirmation: true,
          targetSuppressionKey: suppressionKey,
          canRetry: false,
          canConfirmManually: false
        },
        updatedAt: "2026-03-25T00:00:02.000Z"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("live_conflict");
    }
  });
});

