import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";

export const DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION = "1.0.0" as const;

export type DiagnosticAlertSuppressionRepairLifecycleSlotSchemaVersion =
  typeof DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION;

export const validateDiagnosticAlertSuppressionRepairLifecycleSlotSchemaVersion = (
  schemaVersion: unknown
): Result<DiagnosticAlertSuppressionRepairLifecycleSlotSchemaVersion, ApplicationError> => {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    return err(snapshotVersionMissingError("Suppression repair lifecycle slot schemaVersion is required"));
  }
  if (schemaVersion !== DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION) {
    return err(
      snapshotVersionUnsupportedError("Suppression repair lifecycle slot schemaVersion is unsupported", {
        schemaVersion
      })
    );
  }
  return ok(DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION);
};

