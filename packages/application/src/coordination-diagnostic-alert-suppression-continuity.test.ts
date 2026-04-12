import { describe, expect, it } from "vitest";

import { validateSuppressionStateContinuity } from "./coordination-diagnostic-alert-suppression-continuity.js";

describe("validateSuppressionStateContinuity", () => {
  it("passes when persisted state is consistent with current suppression", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-1|status_field_conflict",
      factKey: "fact-1",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 2,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:02.000Z",
      currentStatus: "deduplicated",
      persistedState: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-1|status_field_conflict",
        factKey: "fact-1",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:01.500Z",
        repeatCount: 1,
        lastStatus: "emitted"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("passed");
      expect(result.value.isContinuous).toBe(true);
    }
  });

  it("returns notice when persisted state is missing", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-2|status_field_conflict",
      factKey: "fact-2",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 1,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:01.000Z",
      currentStatus: "emitted"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("notice");
      expect(result.value.reasonCategory).toBe("state_missing");
    }
  });

  it("fails when persisted repeatCount regresses", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-3|status_field_conflict",
      factKey: "fact-3",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 1,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:01.500Z",
      currentStatus: "emitted",
      persistedState: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-3|status_field_conflict",
        factKey: "fact-3",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:01.200Z",
        repeatCount: 2,
        lastStatus: "deduplicated"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("repeat_count_regressed");
    }
  });

  it("fails when persisted key mismatches", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-4|status_field_conflict",
      factKey: "fact-4",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 2,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:01.500Z",
      currentStatus: "deduplicated",
      persistedState: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-4|version_mismatch",
        factKey: "fact-4",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:01.200Z",
        repeatCount: 1,
        lastStatus: "emitted"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("suppression_key_mismatch");
    }
  });

  it("fails when persisted schemaVersion is missing", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-5|status_field_conflict",
      factKey: "fact-5",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 2,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:01.500Z",
      currentStatus: "deduplicated",
      persistedState: {
        suppressionKey: "fact-5|status_field_conflict",
        factKey: "fact-5",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:01.200Z",
        repeatCount: 1,
        lastStatus: "emitted"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("schema_missing");
    }
  });

  it("fails when persisted state is malformed", () => {
    const result = validateSuppressionStateContinuity({
      suppressionKey: "fact-6|status_field_conflict",
      factKey: "fact-6",
      reasonCategory: "status_field_conflict",
      severity: "warning",
      triggerSource: "replay_validation",
      currentRepeatCount: 2,
      currentFirstSeenAt: "2026-03-25T00:00:01.000Z",
      currentLastSeenAt: "2026-03-25T00:00:01.500Z",
      currentStatus: "deduplicated",
      persistedState: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-6|status_field_conflict",
        factKey: "fact-6",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:03.000Z",
        lastSeenAt: "2026-03-25T00:00:01.000Z",
        repeatCount: 0,
        lastStatus: "emitted"
      }
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("failed");
      expect(result.value.reasonCategory).toBe("persisted_state_malformed");
    }
  });
});
