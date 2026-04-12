import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";

export const DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION = "1.0.0" as const;

export type DiagnosticAlertSuppressionStateSchemaVersion = typeof DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION;

export const validateDiagnosticAlertSuppressionStateSchemaVersion = (
  input: string | undefined
): Result<DiagnosticAlertSuppressionStateSchemaVersion, ReturnType<typeof snapshotVersionMissingError> | ReturnType<typeof snapshotVersionUnsupportedError>> => {
  if (!input || input.trim().length === 0) {
    return err(snapshotVersionMissingError("Diagnostic alert suppression state schemaVersion is missing"));
  }
  if (input !== DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION) {
    return err(
      snapshotVersionUnsupportedError("Diagnostic alert suppression state schemaVersion is unsupported", {
        version: input
      })
    );
  }
  return ok(DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION);
};
