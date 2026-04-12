import { describe, expect, it } from "vitest";

import { validateDiagnosticHistorySlotConsistency } from "./coordination-diagnostic-history-slot-consistency.js";
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

describe("validateDiagnosticHistorySlotConsistency", () => {
  it("passes when factKey/schema/current are consistent", () => {
    const result = validateDiagnosticHistorySlotConsistency({
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
      expect(result.value.replayValidation.status).toBe("passed");
    }
  });

  it("returns notice when persisted current conflicts with live current", () => {
    const result = validateDiagnosticHistorySlotConsistency({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: {
        ...buildView(),
        riskLevel: "high"
      },
      fallbackUsed: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("notice");
      expect(result.value.replayValidation.status).toBe("notice");
      expect(result.value.conflictAttribution?.conflictField).toBe("riskLevel");
    }
  });

  it("fails when slot factKey mismatches request", () => {
    const result = validateDiagnosticHistorySlotConsistency({
      requestedFactKey: "A",
      slotFactKey: "B",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      fallbackUsed: false
    });
    expect(result.ok).toBe(false);
  });

  it("fails when persisted previous version is missing", () => {
    const invalidPrevious = {
      ...buildView(),
      assessmentRulesVersion: ""
    } as unknown as CoordinationResultDiagnosticView;
    const result = validateDiagnosticHistorySlotConsistency({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      persistedPreviousView: invalidPrevious,
      fallbackUsed: false
    });
    expect(result.ok).toBe(false);
  });

  it("returns notice with version attribution when previous uses compatible legacy version", () => {
    const result = validateDiagnosticHistorySlotConsistency({
      requestedFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotFactKey: "risk|ADLCase|adl|2026-03-25T00:00:02.000Z",
      slotSchemaVersion: "1.0.0",
      currentView: buildView(),
      persistedCurrentView: buildView(),
      persistedPreviousView: {
        ...buildView(),
        assessmentRulesVersion: "0.9.0"
      },
      fallbackUsed: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.replayValidation.reasonCategory).toBe("version_mismatch");
      expect(result.value.conflictAttribution?.conflictField).toBe("assessmentRulesVersion");
    }
  });
});
