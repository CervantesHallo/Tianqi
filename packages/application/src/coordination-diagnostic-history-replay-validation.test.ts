import { describe, expect, it } from "vitest";

import { validateDiagnosticHistoryReplay } from "./coordination-diagnostic-history-replay-validation.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

const buildView = (): CoordinationResultDiagnosticView => ({
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
  actionHintReason: "stable",
  diagnosticSummary: "stable"
});

describe("validateDiagnosticHistoryReplay", () => {
  it("passes for fully consistent slot", () => {
    const result = validateDiagnosticHistoryReplay({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      fallbackUsed: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("passed");
    }
  });

  it("returns notice when persisted current rules version is compatible legacy", () => {
    const result = validateDiagnosticHistoryReplay({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: {
        ...buildView(),
        assessmentRulesVersion: "0.9.0"
      },
      fallbackUsed: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("notice");
      expect(result.value.reasonCategory).toBe("version_mismatch");
      expect(result.value.conflictAttribution?.snapshotSource).toBe("currentResult");
    }
  });

  it("fails when slot schema version is missing", () => {
    const result = validateDiagnosticHistoryReplay({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      fallbackUsed: false
    });
    expect(result.ok).toBe(false);
  });

  it("fails when factKey mismatches", () => {
    const result = validateDiagnosticHistoryReplay({
      requestedFactKey: "A",
      slotFactKey: "B",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      fallbackUsed: false
    });
    expect(result.ok).toBe(false);
  });
});
