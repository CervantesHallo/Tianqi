import { describe, expect, it } from "vitest";

import {
  buildDiagnosticReadAlert,
  buildDiagnosticReplayOperationalHint
} from "./coordination-diagnostic-replay-operational-assessment.js";
import type { DiagnosticHistoryReplayValidationResult } from "./coordination-diagnostic-history-replay-validation.js";

describe("buildDiagnosticReplayOperationalHint", () => {
  it("returns no action for passed replay validation", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "passed",
      reasonCategory: "current_snapshot_conflict",
      reason: "passed"
    };
    const hint = buildDiagnosticReplayOperationalHint(replay);
    expect(hint.operationalHint).toBe("no_operational_action_needed");
  });

  it("maps version mismatch notice to review_version_compatibility", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "notice",
      reasonCategory: "version_mismatch",
      reason: "version notice"
    };
    const hint = buildDiagnosticReplayOperationalHint(replay);
    expect(hint.operationalHint).toBe("review_version_compatibility");
  });

  it("maps schema incompatibility to inspect_history_slot_schema", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "failed",
      reasonCategory: "schema_incompatible",
      reason: "schema failed"
    };
    const hint = buildDiagnosticReplayOperationalHint(replay);
    expect(hint.operationalHint).toBe("inspect_history_slot_schema");
  });

  it("maps fact key mismatch to inspect_fact_key_mapping", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "failed",
      reasonCategory: "fact_key_mismatch",
      reason: "fact key failed"
    };
    const hint = buildDiagnosticReplayOperationalHint(replay);
    expect(hint.operationalHint).toBe("inspect_fact_key_mapping");
  });
});

describe("buildDiagnosticReadAlert", () => {
  it("builds info alert for passed", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "passed",
      reasonCategory: "current_snapshot_conflict",
      reason: "passed"
    };
    const alert = buildDiagnosticReadAlert({
      replayValidation: replay,
      operationalHint: "no_operational_action_needed",
      triggerSource: "replay_validation"
    });
    expect(alert.severity).toBe("info");
    expect(alert.requiresAttention).toBe(false);
  });

  it("builds warning alert for notice", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "notice",
      reasonCategory: "status_field_conflict",
      reason: "notice"
    };
    const alert = buildDiagnosticReadAlert({
      replayValidation: replay,
      operationalHint: "inspect_snapshot_conflict",
      triggerSource: "history_slot_consistency"
    });
    expect(alert.severity).toBe("warning");
    expect(alert.requiresAttention).toBe(true);
  });

  it("builds critical alert for failed", () => {
    const replay: DiagnosticHistoryReplayValidationResult = {
      status: "failed",
      reasonCategory: "schema_incompatible",
      reason: "failed"
    };
    const alert = buildDiagnosticReadAlert({
      replayValidation: replay,
      operationalHint: "inspect_history_slot_schema",
      triggerSource: "replay_validation"
    });
    expect(alert.severity).toBe("critical");
    expect(alert.requiresAttention).toBe(true);
  });
});
