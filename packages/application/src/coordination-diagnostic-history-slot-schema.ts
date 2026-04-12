import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";

export const COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION = "1.0.0" as const;

export type CoordinationDiagnosticHistorySlotSchemaVersion = typeof COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION;

export const validateCoordinationDiagnosticHistorySlotSchemaVersion = (
  schemaVersion: unknown
): Result<CoordinationDiagnosticHistorySlotSchemaVersion, ApplicationError> => {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    return err(snapshotVersionMissingError("Diagnostic history slot schemaVersion is required"));
  }

  if (schemaVersion !== COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION) {
    return err(
      snapshotVersionUnsupportedError("Diagnostic history slot schemaVersion is unsupported", {
        schemaVersion
      })
    );
  }

  return ok(COORDINATION_DIAGNOSTIC_HISTORY_SLOT_SCHEMA_VERSION);
};
