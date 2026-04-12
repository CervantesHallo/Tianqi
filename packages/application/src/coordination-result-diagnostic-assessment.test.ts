import { describe, expect, it } from "vitest";

import { buildCoordinationDiagnosticAssessment } from "./coordination-result-diagnostic-assessment.js";
import {
  COORDINATION_DIAGNOSTIC_RULES_VERSION,
  DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
} from "./coordination-result-diagnostic-assessment-rules.js";

describe("buildCoordinationDiagnosticAssessment", () => {
  it("returns low risk and no action for stable persisted/repaired state", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      manualConfirmation: false
    });
    expect(assessment.assessmentRulesVersion).toBe(COORDINATION_DIAGNOSTIC_RULES_VERSION);
    expect(assessment.riskLevel).toBe("low");
    expect(assessment.manualActionHint).toBe("no_action_needed");
  });

  it("returns medium risk with retry hint for retryable repair failure", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "fallback_only",
      validationStatus: "passed",
      repairStatus: "repair_failed_retryable",
      manualConfirmation: false
    });
    expect(assessment.riskLevel).toBe("medium");
    expect(assessment.manualActionHint).toBe("retry_repair_recommended");
  });

  it("returns high risk with manual confirmation hint for manual-required repair failure", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "fallback_only",
      validationStatus: "passed",
      repairStatus: "repair_failed_manual_confirmation_required",
      manualConfirmation: false
    });
    expect(assessment.riskLevel).toBe("high");
    expect(assessment.manualActionHint).toBe("manual_confirmation_recommended");
  });

  it("prioritizes validation conflict over retryable repair hint", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "fallback_only",
      validationStatus: "failed",
      repairStatus: "repair_failed_retryable",
      manualConfirmation: false
    });
    expect(assessment.riskLevel).toBe("high");
    expect(assessment.manualActionHint).toBe("investigate_validation_conflict");
  });

  it("returns high risk for missing read-view", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "missing",
      validationStatus: "not_performed",
      repairStatus: "not_repaired",
      manualConfirmation: false
    });
    expect(assessment.riskLevel).toBe("high");
    expect(assessment.manualActionHint).toBe("investigate_missing_read_view");
  });

  it("returns medium persistence investigation hint when persistence failure is present", () => {
    const assessment = buildCoordinationDiagnosticAssessment({
      currentReadViewStatus: "fallback_only",
      validationStatus: "passed",
      repairStatus: "manually_confirmed",
      manualConfirmation: true,
      lastPersistenceObservation: {
        scope: "persistence",
        factKey: "fact",
        storeReadHit: false,
        registryFallbackUsed: false,
        validationPassed: false,
        validationFailed: false,
        persistenceWriteSucceeded: false,
        persistenceWriteFailed: true,
        repairAttempted: false,
        repairSucceeded: false,
        repairFailed: false
      }
    });
    expect(assessment.riskLevel).toBe("medium");
    expect(assessment.manualActionHint).toBe("investigate_persistence_failure");
  });

  it("binds assessment output to explicit rules version", () => {
    const assessment = buildCoordinationDiagnosticAssessment(
      {
        currentReadViewStatus: "persisted",
        validationStatus: "passed",
        repairStatus: "repaired",
        manualConfirmation: false
      },
      DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
    );
    expect(assessment.assessmentRulesVersion).toBe(DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES.version);
  });
});
