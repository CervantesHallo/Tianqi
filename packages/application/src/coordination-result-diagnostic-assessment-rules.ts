export const COORDINATION_DIAGNOSTIC_RULES_VERSION = "1.0.0" as const;

export type CoordinationDiagnosticAssessmentRulesVersion = `${number}.${number}.${number}`;

export type CoordinationDiagnosticAssessmentRules = {
  readonly version: CoordinationDiagnosticAssessmentRulesVersion;
  readonly highRiskRules: {
    readonly validationFailedDirectHigh: boolean;
    readonly readViewMissingDirectHigh: boolean;
    readonly repairFailedManualConfirmationRequiredDirectHigh: boolean;
  };
  readonly mediumRiskRules: {
    readonly persistenceFailureReadableDirectMedium: boolean;
    readonly repairFailedRetryableDirectMedium: boolean;
    readonly fallbackOnlyDirectMedium: boolean;
    readonly manuallyConfirmedDirectMedium: boolean;
  };
  readonly lowRiskRules: {
    readonly persistedValidationPassedRepairedDirectLow: boolean;
  };
};

export const DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES: CoordinationDiagnosticAssessmentRules = {
  version: COORDINATION_DIAGNOSTIC_RULES_VERSION,
  highRiskRules: {
    validationFailedDirectHigh: true,
    readViewMissingDirectHigh: true,
    repairFailedManualConfirmationRequiredDirectHigh: true
  },
  mediumRiskRules: {
    persistenceFailureReadableDirectMedium: true,
    repairFailedRetryableDirectMedium: true,
    fallbackOnlyDirectMedium: true,
    manuallyConfirmedDirectMedium: true
  },
  lowRiskRules: {
    persistedValidationPassedRepairedDirectLow: true
  }
};
