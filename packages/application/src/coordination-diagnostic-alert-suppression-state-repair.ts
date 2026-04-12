import type {
  DiagnosticAlertSuppressionStorePort,
  StoredDiagnosticAlertSuppressionState
} from "@tianqi/ports";

import {
  DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION
} from "./diagnostic-alert-suppression-state-schema.js";
import {
  DiagnosticAlertSuppressionStateReadCompatibility,
  evaluateDiagnosticAlertSuppressionStateReadCompatibility
} from "./diagnostic-alert-suppression-state-read-compatibility.js";

export type DiagnosticAlertSuppressionStateRepairStatus = "repaired" | "failed" | "noop" | "not_attempted";

export type DiagnosticAlertSuppressionStateRepairEvaluation = {
  readonly repairAvailable: boolean;
  readonly repairRecommended: boolean;
  readonly reason: string;
};

export type DiagnosticAlertSuppressionStateRepairResult = {
  readonly status: "repaired" | "failed" | "noop";
  readonly reason: string;
  readonly repairedState?: StoredDiagnosticAlertSuppressionState;
  readonly repairedSchemaVersion?: string;
};

export type DiagnosticAlertSuppressionStateReadResult = {
  readonly readStatus: "found" | "missing" | "read_failed";
  readonly state?: StoredDiagnosticAlertSuppressionState;
  readonly compatibility: DiagnosticAlertSuppressionStateReadCompatibility;
  readonly repairEvaluation: DiagnosticAlertSuppressionStateRepairEvaluation;
};

const safeTrimmed = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const expectedStatusFor = (
  repeatCount: number,
  severity: StoredDiagnosticAlertSuppressionState["severity"]
): StoredDiagnosticAlertSuppressionState["lastStatus"] =>
  repeatCount <= 1 ? "emitted" : severity === "critical" ? "suppressed_with_notice" : "deduplicated";

const assessRepairEvaluation = (input: {
  readonly state?: StoredDiagnosticAlertSuppressionState;
  readonly compatibility: DiagnosticAlertSuppressionStateReadCompatibility;
}): DiagnosticAlertSuppressionStateRepairEvaluation => {
  const state = input.state;
  if (!state) {
    return {
      repairAvailable: false,
      repairRecommended: false,
      reason: "No persisted suppression state to repair"
    };
  }
  const expectedSuppressionKey = `${safeTrimmed(state.factKey)}|${safeTrimmed(state.reasonCategory)}`;
  if (
    safeTrimmed(state.suppressionKey).length === 0 ||
    safeTrimmed(state.factKey).length === 0 ||
    safeTrimmed(state.reasonCategory).length === 0
  ) {
    return {
      repairAvailable: false,
      repairRecommended: true,
      reason: "Critical suppression semantic fields are missing"
    };
  }
  if (state.suppressionKey !== expectedSuppressionKey) {
    return {
      repairAvailable: false,
      repairRecommended: true,
      reason: "Suppression key conflicts with factKey/reasonCategory semantic"
    };
  }
  if (input.compatibility.status === "incompatible_version") {
    return {
      repairAvailable: false,
      repairRecommended: true,
      reason: "Suppression state version is incompatible and not in supported repair set"
    };
  }
  if (input.compatibility.status === "state_missing") {
    return {
      repairAvailable: false,
      repairRecommended: false,
      reason: "Suppression state does not exist"
    };
  }
  if (input.compatibility.status === "compatible_read") {
    return {
      repairAvailable: true,
      repairRecommended: false,
      reason: "Suppression state is already compatible; repair can run as noop"
    };
  }
  return {
    repairAvailable: true,
    repairRecommended: true,
    reason: `Suppression state compatibility=${input.compatibility.status} suggests minimal repair`
  };
};

export const readDiagnosticAlertSuppressionStateWithCompatibility = async (input: {
  readonly suppressionKey: string;
  readonly store: DiagnosticAlertSuppressionStorePort;
}): Promise<DiagnosticAlertSuppressionStateReadResult> => {
  const loaded = await input.store.getBySuppressionKey(input.suppressionKey);
  if (!loaded.ok) {
    const compatibility: DiagnosticAlertSuppressionStateReadCompatibility = {
      status: "state_missing",
      reason: `Suppression store read failed: ${loaded.error.message}`,
      expectedVersion: DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION,
      supportedVersions: [DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION]
    };
    return {
      readStatus: "read_failed",
      compatibility,
      repairEvaluation: {
        repairAvailable: false,
        repairRecommended: true,
        reason: "Suppression store read failed; no persisted state available for repair"
      }
    };
  }
  if (loaded.value.status === "missing") {
    const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({});
    return {
      readStatus: "missing",
      compatibility,
      repairEvaluation: assessRepairEvaluation({ compatibility })
    };
  }

  const state = loaded.value.state;
  const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({ state });
  return {
    readStatus: "found",
    state,
    compatibility,
    repairEvaluation: assessRepairEvaluation({ state, compatibility })
  };
};

export const repairDiagnosticAlertSuppressionState = (input: {
  readonly suppressionKey: string;
  readonly state: StoredDiagnosticAlertSuppressionState;
  readonly repairedAt: string;
}): DiagnosticAlertSuppressionStateRepairResult => {
  const state = input.state;
  const factKey = safeTrimmed(state.factKey);
  const reasonCategory = safeTrimmed(state.reasonCategory);
  const suppressionKey = safeTrimmed(state.suppressionKey);
  if (
    factKey.length === 0 ||
    reasonCategory.length === 0 ||
    suppressionKey.length === 0 ||
    safeTrimmed(state.firstSeenAt).length === 0 ||
    safeTrimmed(state.lastSeenAt).length === 0
  ) {
    return {
      status: "failed",
      reason: "Critical suppression fields are missing and cannot be safely repaired"
    };
  }

  const expectedSuppressionKey = `${factKey}|${reasonCategory}`;
  if (suppressionKey !== input.suppressionKey || suppressionKey !== expectedSuppressionKey) {
    return {
      status: "failed",
      reason: "Suppression key conflicts with request key or semantic key; repair rejected"
    };
  }

  const compatibility = evaluateDiagnosticAlertSuppressionStateReadCompatibility({ state });
  if (compatibility.status === "incompatible_version") {
    return {
      status: "failed",
      reason: "Suppression state version is incompatible and not repairable in current minimal strategy"
    };
  }

  let nextSchemaVersion = state.schemaVersion;
  let nextRepeatCount = state.repeatCount;
  let nextFirstSeenAt = state.firstSeenAt;
  let nextLastSeenAt = state.lastSeenAt;
  let nextLastStatus = state.lastStatus;
  let changed = false;

  if (!nextSchemaVersion || compatibility.status === "compatible_with_notice") {
    nextSchemaVersion = DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION;
    changed = true;
  }

  if (!Number.isFinite(nextRepeatCount) || nextRepeatCount < 1) {
    nextRepeatCount = 1;
    changed = true;
  }

  const parsedFirst = Date.parse(nextFirstSeenAt);
  const parsedLast = Date.parse(nextLastSeenAt);
  if (Number.isNaN(parsedFirst) && Number.isNaN(parsedLast)) {
    nextFirstSeenAt = input.repairedAt;
    nextLastSeenAt = input.repairedAt;
    changed = true;
  } else if (Number.isNaN(parsedFirst) && !Number.isNaN(parsedLast)) {
    nextFirstSeenAt = nextLastSeenAt;
    changed = true;
  } else if (!Number.isNaN(parsedFirst) && Number.isNaN(parsedLast)) {
    nextLastSeenAt = nextFirstSeenAt;
    changed = true;
  } else if (parsedLast < parsedFirst) {
    nextLastSeenAt = nextFirstSeenAt;
    changed = true;
  }

  const expectedStatus = expectedStatusFor(nextRepeatCount, state.severity);
  if (nextLastStatus !== expectedStatus) {
    nextLastStatus = expectedStatus;
    changed = true;
  }

  if (!changed) {
    return {
      status: "noop",
      reason: "Suppression state is already compatible and requires no repair"
    };
  }

  const repairedState: StoredDiagnosticAlertSuppressionState = {
    schemaVersion: nextSchemaVersion,
    suppressionKey: state.suppressionKey,
    factKey: state.factKey,
    reasonCategory: state.reasonCategory,
    severity: state.severity,
    triggerSource: state.triggerSource,
    firstSeenAt: nextFirstSeenAt,
    lastSeenAt: nextLastSeenAt,
    repeatCount: nextRepeatCount,
    lastStatus: nextLastStatus
  };

  return {
    status: "repaired",
    reason: "Suppression state repaired with minimal safe normalization",
    repairedState,
    ...(repairedState.schemaVersion ? { repairedSchemaVersion: repairedState.schemaVersion } : {})
  };
};
