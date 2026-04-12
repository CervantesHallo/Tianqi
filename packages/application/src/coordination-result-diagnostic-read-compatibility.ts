import {
  COORDINATION_DIAGNOSTIC_RULES_VERSION
} from "./coordination-result-diagnostic-assessment-rules.js";

export type CoordinationDiagnosticResultReadCompatibilityStatus =
  | "compatible_read"
  | "compatible_with_notice"
  | "incompatible_version"
  | "missing_version";

export type CoordinationDiagnosticResultReadCompatibility = {
  readonly status: CoordinationDiagnosticResultReadCompatibilityStatus;
  readonly reason: string;
  readonly storedVersion?: string;
  readonly expectedVersion: string;
  readonly supportedVersions: readonly string[];
};

export const DIAGNOSTIC_RESULT_SUPPORTED_READ_VERSIONS = [
  COORDINATION_DIAGNOSTIC_RULES_VERSION,
  "0.9.0"
] as const;

export const evaluateCoordinationDiagnosticResultReadCompatibility = (input: {
  readonly assessmentRulesVersion?: string;
  readonly expectedVersion?: string;
  readonly supportedVersions?: readonly string[];
}): CoordinationDiagnosticResultReadCompatibility => {
  const expectedVersion = input.expectedVersion ?? COORDINATION_DIAGNOSTIC_RULES_VERSION;
  const supportedVersions = [...(input.supportedVersions ?? DIAGNOSTIC_RESULT_SUPPORTED_READ_VERSIONS)];
  const version = input.assessmentRulesVersion?.trim();

  if (!version) {
    return {
      status: "missing_version",
      reason: "Diagnostic result assessmentRulesVersion is missing",
      expectedVersion,
      supportedVersions
    };
  }

  if (version === expectedVersion) {
    return {
      status: "compatible_read",
      reason: "Diagnostic result version matches current default rules version",
      storedVersion: version,
      expectedVersion,
      supportedVersions
    };
  }

  if (supportedVersions.includes(version)) {
    return {
      status: "compatible_with_notice",
      reason: "Diagnostic result version is readable but differs from current default rules version",
      storedVersion: version,
      expectedVersion,
      supportedVersions
    };
  }

  return {
    status: "incompatible_version",
    reason: "Diagnostic result version is not in supported read compatibility versions",
    storedVersion: version,
    expectedVersion,
    supportedVersions
  };
};
