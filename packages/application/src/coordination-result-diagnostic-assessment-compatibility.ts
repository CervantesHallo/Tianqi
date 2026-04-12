import {
  COORDINATION_DIAGNOSTIC_RULES_VERSION,
  DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES
} from "./coordination-result-diagnostic-assessment-rules.js";
import type { CoordinationDiagnosticAssessmentRules } from "./coordination-result-diagnostic-assessment-rules.js";
import { buildCoordinationDiagnosticAssessment } from "./coordination-result-diagnostic-assessment.js";
import type {
  CoordinationResultDiagnosticRiskLevel,
  CoordinationResultManualActionHint
} from "./coordination-result-diagnostic-assessment.js";

type CompatibilityFixture = {
  readonly name: string;
  readonly input: Parameters<typeof buildCoordinationDiagnosticAssessment>[0];
  readonly expectedRiskLevel: CoordinationResultDiagnosticRiskLevel;
  readonly expectedManualActionHint: CoordinationResultManualActionHint;
};

const V1_COMPATIBILITY_FIXTURES: readonly CompatibilityFixture[] = [
  {
    name: "stable-low",
    input: {
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      manualConfirmation: false
    },
    expectedRiskLevel: "low",
    expectedManualActionHint: "no_action_needed"
  },
  {
    name: "retryable-medium",
    input: {
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repair_failed_retryable",
      manualConfirmation: false
    },
    expectedRiskLevel: "medium",
    expectedManualActionHint: "retry_repair_recommended"
  },
  {
    name: "validation-high",
    input: {
      currentReadViewStatus: "persisted",
      validationStatus: "failed",
      repairStatus: "repair_failed_retryable",
      manualConfirmation: false
    },
    expectedRiskLevel: "high",
    expectedManualActionHint: "investigate_validation_conflict"
  },
  {
    name: "manual-confirm-required-high",
    input: {
      currentReadViewStatus: "fallback_only",
      validationStatus: "passed",
      repairStatus: "repair_failed_manual_confirmation_required",
      manualConfirmation: false
    },
    expectedRiskLevel: "high",
    expectedManualActionHint: "manual_confirmation_recommended"
  },
  {
    name: "missing-read-view-high",
    input: {
      currentReadViewStatus: "missing",
      validationStatus: "not_performed",
      repairStatus: "not_repaired",
      manualConfirmation: false
    },
    expectedRiskLevel: "high",
    expectedManualActionHint: "investigate_missing_read_view"
  }
];

const COMPATIBILITY_FIXTURES_BY_VERSION: Readonly<Record<string, readonly CompatibilityFixture[]>> = {
  [COORDINATION_DIAGNOSTIC_RULES_VERSION]: V1_COMPATIBILITY_FIXTURES
};

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const validateRulesShape = (rules: unknown): string[] => {
  const errors: string[] = [];
  if (!rules || typeof rules !== "object") {
    return ["rules object is required"];
  }

  const candidate = rules as Record<string, unknown>;
  const high = candidate.highRiskRules as Record<string, unknown> | undefined;
  const medium = candidate.mediumRiskRules as Record<string, unknown> | undefined;
  const low = candidate.lowRiskRules as Record<string, unknown> | undefined;

  if (typeof candidate.version !== "string" || candidate.version.trim().length === 0) {
    errors.push("rules.version must be non-empty");
  }
  if (!high) {
    errors.push("highRiskRules is required");
  } else {
    if (!isBoolean(high.validationFailedDirectHigh)) {
      errors.push("highRiskRules.validationFailedDirectHigh must be boolean");
    }
    if (!isBoolean(high.readViewMissingDirectHigh)) {
      errors.push("highRiskRules.readViewMissingDirectHigh must be boolean");
    }
    if (!isBoolean(high.repairFailedManualConfirmationRequiredDirectHigh)) {
      errors.push("highRiskRules.repairFailedManualConfirmationRequiredDirectHigh must be boolean");
    }
  }
  if (!medium) {
    errors.push("mediumRiskRules is required");
  } else {
    if (!isBoolean(medium.persistenceFailureReadableDirectMedium)) {
      errors.push("mediumRiskRules.persistenceFailureReadableDirectMedium must be boolean");
    }
    if (!isBoolean(medium.repairFailedRetryableDirectMedium)) {
      errors.push("mediumRiskRules.repairFailedRetryableDirectMedium must be boolean");
    }
    if (!isBoolean(medium.fallbackOnlyDirectMedium)) {
      errors.push("mediumRiskRules.fallbackOnlyDirectMedium must be boolean");
    }
    if (!isBoolean(medium.manuallyConfirmedDirectMedium)) {
      errors.push("mediumRiskRules.manuallyConfirmedDirectMedium must be boolean");
    }
  }
  if (!low) {
    errors.push("lowRiskRules is required");
  } else if (!isBoolean(low.persistedValidationPassedRepairedDirectLow)) {
    errors.push("lowRiskRules.persistedValidationPassedRepairedDirectLow must be boolean");
  }
  return errors;
};

export const assertDiagnosticAssessmentCompatibility = (
  rules: CoordinationDiagnosticAssessmentRules,
  expectedRulesVersion: string = DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES.version
): void => {
  const errors = validateRulesShape(rules);
  if (errors.length > 0) {
    throw new Error(`Diagnostic assessment compatibility assertion failed: ${errors.join("; ")}`);
  }
  if (rules.version !== expectedRulesVersion) {
    errors.push(`rules.version mismatch: expected=${expectedRulesVersion}, actual=${rules.version}`);
  }

  const fixtures = COMPATIBILITY_FIXTURES_BY_VERSION[rules.version];
  if (!fixtures) {
    errors.push(`no compatibility fixtures declared for rules.version=${rules.version}`);
  } else {
    for (const fixture of fixtures) {
      const assessed = buildCoordinationDiagnosticAssessment(fixture.input, rules);
      if (assessed.assessmentRulesVersion !== rules.version) {
        errors.push(`${fixture.name}: assessmentRulesVersion mismatch`);
      }
      if (assessed.riskLevel !== fixture.expectedRiskLevel) {
        errors.push(`${fixture.name}: riskLevel expected=${fixture.expectedRiskLevel}, actual=${assessed.riskLevel}`);
      }
      if (assessed.manualActionHint !== fixture.expectedManualActionHint) {
        errors.push(
          `${fixture.name}: manualActionHint expected=${fixture.expectedManualActionHint}, actual=${assessed.manualActionHint}`
        );
      }
      if (assessed.riskReason.trim().length === 0) {
        errors.push(`${fixture.name}: riskReason should be non-empty`);
      }
      if (assessed.actionHintReason.trim().length === 0) {
        errors.push(`${fixture.name}: actionHintReason should be non-empty`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Diagnostic assessment compatibility assertion failed: ${errors.join("; ")}`);
  }
};
