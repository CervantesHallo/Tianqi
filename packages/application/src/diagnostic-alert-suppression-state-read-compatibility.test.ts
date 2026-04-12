import { describe, expect, it } from "vitest";

import {
  evaluateDiagnosticAlertSuppressionStateReadCompatibility
} from "./diagnostic-alert-suppression-state-read-compatibility.js";

describe("evaluateDiagnosticAlertSuppressionStateReadCompatibility", () => {
  it("returns compatible_read for current version", () => {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-1|status_field_conflict",
        factKey: "fact-1",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:01.000Z",
        repeatCount: 1,
        lastStatus: "emitted"
      }
    });
    expect(compatibility.status).toBe("compatible_read");
  });

  it("returns compatible_with_notice for supported old version", () => {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: {
        schemaVersion: "0.9.0",
        suppressionKey: "fact-2|status_field_conflict",
        factKey: "fact-2",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:02.000Z",
        repeatCount: 2,
        lastStatus: "deduplicated"
      }
    });
    expect(compatibility.status).toBe("compatible_with_notice");
  });

  it("returns missing_version when schemaVersion is absent", () => {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: {
        suppressionKey: "fact-3|status_field_conflict",
        factKey: "fact-3",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:02.000Z",
        repeatCount: 2,
        lastStatus: "deduplicated"
      }
    });
    expect(compatibility.status).toBe("missing_version");
  });

  it("returns incompatible_version for unknown schemaVersion", () => {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: {
        schemaVersion: "2.0.0",
        suppressionKey: "fact-4|status_field_conflict",
        factKey: "fact-4",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:02.000Z",
        repeatCount: 2,
        lastStatus: "deduplicated"
      }
    });
    expect(compatibility.status).toBe("incompatible_version");
  });

  it("returns malformed_state when persisted shape is invalid", () => {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: {
        schemaVersion: "1.0.0",
        suppressionKey: "fact-5|status_field_conflict",
        factKey: "fact-5",
        reasonCategory: "status_field_conflict",
        severity: "warning",
        triggerSource: "replay_validation",
        firstSeenAt: "2026-03-25T00:00:01.000Z",
        lastSeenAt: "2026-03-25T00:00:02.000Z",
        repeatCount: Number.NaN,
        lastStatus: "deduplicated"
      }
    });
    expect(compatibility.status).toBe("malformed_state");
  });
});
