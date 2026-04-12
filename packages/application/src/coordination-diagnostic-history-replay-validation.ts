import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import { validateCoordinationDiagnosticHistorySlotSchemaVersion } from "./coordination-diagnostic-history-slot-schema.js";
import { evaluateCoordinationDiagnosticResultReadCompatibility } from "./coordination-result-diagnostic-read-compatibility.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

export type DiagnosticHistoryReplayValidationState = "passed" | "notice" | "failed";

export type DiagnosticHistoryReplayValidationReasonCategory =
  | "version_mismatch"
  | "schema_incompatible"
  | "fact_key_mismatch"
  | "current_snapshot_conflict"
  | "previous_snapshot_conflict"
  | "status_field_conflict"
  | "rules_version_conflict";

export type DiagnosticHistoryConflictAttribution = {
  readonly conflictCategory: DiagnosticHistoryReplayValidationReasonCategory;
  readonly conflictField: string;
  readonly expectedValue: string;
  readonly actualValue: string;
  readonly snapshotSource: "currentResult" | "previousResult" | "liveResult";
  readonly attributionSummary: string;
};

export type DiagnosticHistoryReplayValidationResult = {
  readonly status: DiagnosticHistoryReplayValidationState;
  readonly reasonCategory: DiagnosticHistoryReplayValidationReasonCategory;
  readonly reason: string;
  readonly conflictAttribution?: DiagnosticHistoryConflictAttribution;
};

const notice = (
  reasonCategory: DiagnosticHistoryReplayValidationReasonCategory,
  reason: string,
  conflictAttribution?: DiagnosticHistoryConflictAttribution
): DiagnosticHistoryReplayValidationResult => ({
  status: "notice",
  reasonCategory,
  reason,
  ...(conflictAttribution ? { conflictAttribution } : {})
});

const passed = (reason: string): DiagnosticHistoryReplayValidationResult => ({
  status: "passed",
  reasonCategory: "current_snapshot_conflict",
  reason
});

const firstConflictAttribution = (input: {
  readonly current: CoordinationResultDiagnosticView;
  readonly persisted: CoordinationResultDiagnosticView;
  readonly snapshotSource: "currentResult" | "previousResult";
}): DiagnosticHistoryConflictAttribution | null => {
  const checks: ReadonlyArray<{
    field: string;
    expected: string;
    actual: string;
    category: DiagnosticHistoryReplayValidationReasonCategory;
  }> = [
    {
      field: "assessmentRulesVersion",
      expected: input.current.assessmentRulesVersion,
      actual: input.persisted.assessmentRulesVersion,
      category: "rules_version_conflict"
    },
    {
      field: "riskLevel",
      expected: input.current.riskLevel,
      actual: input.persisted.riskLevel,
      category: "current_snapshot_conflict"
    },
    {
      field: "manualActionHint",
      expected: input.current.manualActionHint,
      actual: input.persisted.manualActionHint,
      category: "current_snapshot_conflict"
    },
    {
      field: "validationStatus",
      expected: input.current.validationStatus,
      actual: input.persisted.validationStatus,
      category: "status_field_conflict"
    },
    {
      field: "repairStatus",
      expected: input.current.repairStatus,
      actual: input.persisted.repairStatus,
      category: "status_field_conflict"
    },
    {
      field: "currentReadViewStatus",
      expected: input.current.currentReadViewStatus,
      actual: input.persisted.currentReadViewStatus,
      category: "status_field_conflict"
    }
  ];

  const conflict = checks.find((item) => item.expected !== item.actual);
  if (!conflict) {
    return null;
  }
  return {
    conflictCategory: conflict.category,
    conflictField: conflict.field,
    expectedValue: conflict.expected,
    actualValue: conflict.actual,
    snapshotSource: input.snapshotSource,
    attributionSummary: `${input.snapshotSource}.${conflict.field} differs from liveResult`
  };
};

export const validateDiagnosticHistoryReplay = (input: {
  readonly requestedFactKey: string;
  readonly slotFactKey: string;
  readonly slotSchemaVersion?: string;
  readonly currentView: CoordinationResultDiagnosticView;
  readonly persistedCurrentView?: CoordinationResultDiagnosticView;
  readonly persistedPreviousView?: CoordinationResultDiagnosticView;
  readonly fallbackUsed: boolean;
}): Result<DiagnosticHistoryReplayValidationResult, ApplicationError> => {
  if (input.slotFactKey !== input.requestedFactKey) {
    return err(
      snapshotVersionUnsupportedError("Diagnostic history slot factKey mismatch", {
        expectedFactKey: input.requestedFactKey,
        actualFactKey: input.slotFactKey
      })
    );
  }

  const schemaValidated = validateCoordinationDiagnosticHistorySlotSchemaVersion(input.slotSchemaVersion);
  if (!schemaValidated.ok) {
    return err(schemaValidated.error);
  }

  if (!input.currentView.assessmentRulesVersion || input.currentView.assessmentRulesVersion.trim().length === 0) {
    return err(snapshotVersionMissingError("Current diagnostic view assessmentRulesVersion is missing"));
  }

  if (!input.persistedCurrentView) {
    return ok(
      notice(
        "current_snapshot_conflict",
        input.fallbackUsed
          ? "Persisted history current slot missing, in-memory fallback used"
          : "Persisted history current slot unavailable"
      )
    );
  }

  if (!input.persistedCurrentView.assessmentRulesVersion || input.persistedCurrentView.assessmentRulesVersion.trim().length === 0) {
    return err(snapshotVersionMissingError("Persisted history current assessmentRulesVersion is missing"));
  }
  const currentCompatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
    assessmentRulesVersion: input.persistedCurrentView.assessmentRulesVersion
  });
  if (currentCompatibility.status === "missing_version") {
    return err(snapshotVersionMissingError("Persisted history current assessmentRulesVersion is missing"));
  }
  if (currentCompatibility.status === "incompatible_version") {
    return err(
      snapshotVersionUnsupportedError("Persisted history current assessmentRulesVersion is incompatible", {
        version: currentCompatibility.storedVersion ?? "unknown"
      })
    );
  }

  if (input.persistedPreviousView) {
    if (!input.persistedPreviousView.assessmentRulesVersion || input.persistedPreviousView.assessmentRulesVersion.trim().length === 0) {
      return err(snapshotVersionMissingError("Persisted history previous assessmentRulesVersion is missing"));
    }
    const previousCompatibility = evaluateCoordinationDiagnosticResultReadCompatibility({
      assessmentRulesVersion: input.persistedPreviousView.assessmentRulesVersion
    });
    if (previousCompatibility.status === "missing_version") {
      return err(snapshotVersionMissingError("Persisted history previous assessmentRulesVersion is missing"));
    }
    if (previousCompatibility.status === "incompatible_version") {
      return err(
        snapshotVersionUnsupportedError("Persisted history previous assessmentRulesVersion is incompatible", {
          version: previousCompatibility.storedVersion ?? "unknown"
        })
      );
    }
    if (previousCompatibility.status === "compatible_with_notice") {
      return ok(
        notice("version_mismatch", "Persisted history previous assessmentRulesVersion is compatible with notice", {
          conflictCategory: "version_mismatch",
          conflictField: "assessmentRulesVersion",
          expectedValue: input.currentView.assessmentRulesVersion,
          actualValue: input.persistedPreviousView.assessmentRulesVersion,
          snapshotSource: "previousResult",
          attributionSummary: "previousResult.assessmentRulesVersion differs from liveResult"
        })
      );
    }
  }

  if (currentCompatibility.status === "compatible_with_notice") {
    return ok(
      notice("version_mismatch", "Persisted history current assessmentRulesVersion is compatible with notice", {
        conflictCategory: "version_mismatch",
        conflictField: "assessmentRulesVersion",
        expectedValue: input.currentView.assessmentRulesVersion,
        actualValue: input.persistedCurrentView.assessmentRulesVersion,
        snapshotSource: "currentResult",
        attributionSummary: "currentResult.assessmentRulesVersion differs from liveResult"
      })
    );
  }

  const currentConflict = firstConflictAttribution({
    current: input.currentView,
    persisted: input.persistedCurrentView,
    snapshotSource: "currentResult"
  });
  if (currentConflict) {
    return ok(
      notice(
        currentConflict.conflictCategory,
        "Persisted history current differs from live current diagnostic result on critical fields",
        currentConflict
      )
    );
  }

  const previousConflict =
    input.persistedPreviousView
      ? firstConflictAttribution({
          current: input.currentView,
          persisted: input.persistedPreviousView,
          snapshotSource: "previousResult"
        })
      : null;
  if (previousConflict) {
    return ok(
      notice(
        previousConflict.conflictCategory === "rules_version_conflict"
          ? "previous_snapshot_conflict"
          : previousConflict.conflictCategory,
        "Persisted history previous differs from live current diagnostic result on compared fields",
        previousConflict
      )
    );
  }

  return ok(passed("Persisted history slot replay validation passed"));
};
