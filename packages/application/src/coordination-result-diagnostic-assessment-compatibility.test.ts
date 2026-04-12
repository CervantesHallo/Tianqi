import { describe, expect, it } from "vitest";

import { assertDiagnosticAssessmentCompatibility } from "./coordination-result-diagnostic-assessment-compatibility.js";
import {
  COORDINATION_DIAGNOSTIC_RULES_VERSION,
  DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
} from "./coordination-result-diagnostic-assessment-rules.js";

describe("assertDiagnosticAssessmentCompatibility", () => {
  it("passes for current default rules and version", () => {
    expect(() =>
      assertDiagnosticAssessmentCompatibility(
        DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES,
        COORDINATION_DIAGNOSTIC_RULES_VERSION
      )
    ).not.toThrow();
  });

  it("fails when rules shape is missing required fields", () => {
    const invalidRules = {
      version: COORDINATION_DIAGNOSTIC_RULES_VERSION,
      highRiskRules: {
        validationFailedDirectHigh: true
      }
    } as unknown as typeof DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES;

    expect(() => assertDiagnosticAssessmentCompatibility(invalidRules, COORDINATION_DIAGNOSTIC_RULES_VERSION)).toThrow(
      /must be boolean|is required/
    );
  });

  it("fails when key mapping changes without rules version bump", () => {
    const driftedRules = {
      ...DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES,
      mediumRiskRules: {
        ...DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES.mediumRiskRules,
        repairFailedRetryableDirectMedium: false
      }
    };

    expect(() => assertDiagnosticAssessmentCompatibility(driftedRules, COORDINATION_DIAGNOSTIC_RULES_VERSION)).toThrow(
      /retryable-medium/
    );
  });

  it("fails when expected version differs from rules version", () => {
    expect(() =>
      assertDiagnosticAssessmentCompatibility(
        DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES,
        "9.9.9"
      )
    ).toThrow(/rules\.version mismatch/);
  });
});
