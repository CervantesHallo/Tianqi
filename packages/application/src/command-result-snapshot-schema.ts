import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { snapshotVersionMissingError, snapshotVersionUnsupportedError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";

export const COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION = "1.0.0" as const;

export type CommandResultSnapshotSchemaVersion = typeof COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION;

export const validateCommandResultSnapshotSchemaVersion = (
  schemaVersion: unknown
): Result<CommandResultSnapshotSchemaVersion, ApplicationError> => {
  if (typeof schemaVersion !== "string" || schemaVersion.trim().length === 0) {
    return err(
      snapshotVersionMissingError("Snapshot schema version field is required for result reuse/query")
    );
  }

  if (schemaVersion !== COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION) {
    return err(
      snapshotVersionUnsupportedError("Only known snapshot schema versions are readable in current phase", {
        schemaVersion
      })
    );
  }

  return ok(COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION);
};
