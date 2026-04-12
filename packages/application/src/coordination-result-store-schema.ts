import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";

export const COORDINATION_RESULT_STORE_SCHEMA_VERSION = "1.0.0" as const;

export type CoordinationResultStoreSchemaVersion = typeof COORDINATION_RESULT_STORE_SCHEMA_VERSION;

export const validateCoordinationResultStoreSchemaVersion = (
  schemaVersion: unknown
): Result<CoordinationResultStoreSchemaVersion, ApplicationError> => {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    return err(
      snapshotVersionMissingError("Coordination result store schemaVersion is required for read/replay validation")
    );
  }

  if (schemaVersion !== COORDINATION_RESULT_STORE_SCHEMA_VERSION) {
    return err(
      snapshotVersionUnsupportedError(
        "Only known coordination result schema versions are readable in current phase",
        {
          schemaVersion
        }
      )
    );
  }

  return ok(COORDINATION_RESULT_STORE_SCHEMA_VERSION);
};
