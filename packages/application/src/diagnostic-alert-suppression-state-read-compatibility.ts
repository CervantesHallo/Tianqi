import {
  DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION
} from "./diagnostic-alert-suppression-state-schema.js";
import type { StoredDiagnosticAlertSuppressionState } from "@tianqi/ports";

export type DiagnosticAlertSuppressionStateReadCompatibilityStatus =
  | "compatible_read"
  | "compatible_with_notice"
  | "missing_version"
  | "incompatible_version"
  | "malformed_state"
  | "state_missing";

export type DiagnosticAlertSuppressionStateReadCompatibility = {
  readonly status: DiagnosticAlertSuppressionStateReadCompatibilityStatus;
  readonly reason: string;
  readonly storedVersion?: string;
  readonly expectedVersion: string;
  readonly supportedVersions: readonly string[];
};

export const DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SUPPORTED_READ_VERSIONS = [
  DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION,
  "0.9.0"
] as const;

const isStatusValid = (value: unknown): value is StoredDiagnosticAlertSuppressionState["lastStatus"] =>
  value === "emitted" || value === "deduplicated" || value === "suppressed_with_notice";

const isSeverityValid = (value: unknown): value is StoredDiagnosticAlertSuppressionState["severity"] =>
  value === "info" || value === "warning" || value === "critical";

const isTriggerSourceValid = (value: unknown): value is StoredDiagnosticAlertSuppressionState["triggerSource"] =>
  value === "replay_validation" || value === "history_slot_consistency";

export const isDiagnosticAlertSuppressionStateMalformed = (state: StoredDiagnosticAlertSuppressionState): boolean => {
  if (!state || typeof state !== "object") {
    return true;
  }
  if (
    typeof state.suppressionKey !== "string" ||
    typeof state.factKey !== "string" ||
    typeof state.reasonCategory !== "string" ||
    !isSeverityValid(state.severity) ||
    !isTriggerSourceValid(state.triggerSource)
  ) {
    return true;
  }
  if (typeof state.repeatCount !== "number" || !Number.isFinite(state.repeatCount) || state.repeatCount < 1) {
    return true;
  }
  if (typeof state.firstSeenAt !== "string" || typeof state.lastSeenAt !== "string") {
    return true;
  }
  const firstSeenAt = Date.parse(state.firstSeenAt);
  const lastSeenAt = Date.parse(state.lastSeenAt);
  if (Number.isNaN(firstSeenAt) || Number.isNaN(lastSeenAt) || lastSeenAt < firstSeenAt) {
    return true;
  }
  if (!isStatusValid(state.lastStatus)) {
    return true;
  }
  const expectedStatus = state.repeatCount <= 1 ? "emitted" : state.severity === "critical" ? "suppressed_with_notice" : "deduplicated";
  if (state.lastStatus !== expectedStatus) {
    return true;
  }
  return false;
};

export const evaluateDiagnosticAlertSuppressionStateReadCompatibility = (input: {
  readonly state?: StoredDiagnosticAlertSuppressionState;
  readonly expectedVersion?: string;
  readonly supportedVersions?: readonly string[];
}): DiagnosticAlertSuppressionStateReadCompatibility => {
  const expectedVersion = input.expectedVersion ?? DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION;
  const supportedVersions = [...(input.supportedVersions ?? DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SUPPORTED_READ_VERSIONS)];
  if (!input.state) {
    return {
      status: "state_missing",
      reason: "Diagnostic alert suppression persisted state is missing",
      expectedVersion,
      supportedVersions
    };
  }
  if (isDiagnosticAlertSuppressionStateMalformed(input.state)) {
    const storedVersion = input.state.schemaVersion?.trim();
    return {
      status: "malformed_state",
      reason: "Diagnostic alert suppression persisted state is malformed",
      ...(storedVersion ? { storedVersion } : {}),
      expectedVersion,
      supportedVersions
    };
  }

  const version = input.state.schemaVersion?.trim();
  if (!version) {
    return {
      status: "missing_version",
      reason: "Diagnostic alert suppression persisted state schemaVersion is missing",
      expectedVersion,
      supportedVersions
    };
  }
  if (version === expectedVersion) {
    return {
      status: "compatible_read",
      reason: "Diagnostic alert suppression persisted state version matches current schema version",
      storedVersion: version,
      expectedVersion,
      supportedVersions
    };
  }
  if (supportedVersions.includes(version)) {
    return {
      status: "compatible_with_notice",
      reason: "Diagnostic alert suppression persisted state version is readable but differs from current schema version",
      storedVersion: version,
      expectedVersion,
      supportedVersions
    };
  }
  return {
    status: "incompatible_version",
    reason: "Diagnostic alert suppression persisted state version is not in supported read versions",
    storedVersion: version,
    expectedVersion,
    supportedVersions
  };
};
