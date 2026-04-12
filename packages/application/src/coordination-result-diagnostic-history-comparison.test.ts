import { describe, expect, it } from "vitest";

import { compareCoordinationDiagnosticViews } from "./coordination-result-diagnostic-history-comparison.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

const baseView = (): CoordinationResultDiagnosticView => ({
  factKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
  currentReadViewStatus: "persisted",
  validationStatus: "passed",
  repairStatus: "repaired",
  repairAttempts: 1,
  manualConfirmation: false,
  assessmentRulesVersion: "1.0.0",
  riskLevel: "low",
  manualActionHint: "no_action_needed",
  riskReason: "stable",
  actionHintReason: "none",
  diagnosticSummary: "stable"
});

describe("compareCoordinationDiagnosticViews", () => {
  it("returns hasDifference false when all key fields are unchanged", () => {
    const current = baseView();
    const historical = baseView();
    const compared = compareCoordinationDiagnosticViews({ current, historical });
    expect(compared.hasDifference).toBe(false);
    expect(compared.versionChanged).toBe(false);
    expect(compared.riskLevelChanged).toBe(false);
    expect(compared.manualActionHintChanged).toBe(false);
    expect(compared.statusChanged).toBe(false);
  });

  it("detects version difference", () => {
    const current = baseView();
    const historical = { ...baseView(), assessmentRulesVersion: "0.9.0" as const };
    const compared = compareCoordinationDiagnosticViews({ current, historical });
    expect(compared.hasDifference).toBe(true);
    expect(compared.versionChanged).toBe(true);
  });

  it("detects risk level difference", () => {
    const current = { ...baseView(), riskLevel: "high" as const };
    const historical = baseView();
    const compared = compareCoordinationDiagnosticViews({ current, historical });
    expect(compared.hasDifference).toBe(true);
    expect(compared.riskLevelChanged).toBe(true);
  });

  it("detects manual action hint difference", () => {
    const current = { ...baseView(), manualActionHint: "retry_repair_recommended" as const };
    const historical = baseView();
    const compared = compareCoordinationDiagnosticViews({ current, historical });
    expect(compared.hasDifference).toBe(true);
    expect(compared.manualActionHintChanged).toBe(true);
  });

  it("detects status fields difference", () => {
    const current = {
      ...baseView(),
      validationStatus: "failed" as const,
      repairStatus: "repair_failed_retryable" as const,
      currentReadViewStatus: "fallback_only" as const
    };
    const historical = baseView();
    const compared = compareCoordinationDiagnosticViews({ current, historical });
    expect(compared.hasDifference).toBe(true);
    expect(compared.statusChanged).toBe(true);
  });
});
