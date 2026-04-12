import type {
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionRepairCommandType,
  StoredDiagnosticAlertSuppressionRepairCommandRecord
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { dependencyFailureError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";

const buildCommandRecordId = (input: {
  readonly suppressionKey: string;
  readonly commandType: DiagnosticAlertSuppressionRepairCommandType;
  readonly triggeredAt: string;
}): string => `${input.suppressionKey}|${input.commandType}|${input.triggeredAt}`;

export const buildDiagnosticAlertSuppressionRepairCommandRecord = (input: {
  readonly commandType: DiagnosticAlertSuppressionRepairCommandType;
  readonly suppressionKey: string;
  readonly triggeredAt: string;
  readonly triggeredBy: string;
  readonly outcome: "repaired" | "failed" | "noop" | "manually_confirmed";
  readonly outcomeReason: string;
  readonly resultingRepairStatus:
    | "not_repaired"
    | "repair_failed_retryable"
    | "repair_failed_manual_confirmation_required"
    | "manually_confirmed"
    | "repaired";
  readonly schemaVersionBefore?: string;
  readonly schemaVersionAfter?: string;
  readonly linkedLifecycleVersion: string;
}): StoredDiagnosticAlertSuppressionRepairCommandRecord => ({
  commandRecordId: buildCommandRecordId({
    suppressionKey: input.suppressionKey,
    commandType: input.commandType,
    triggeredAt: input.triggeredAt
  }),
  commandType: input.commandType,
  suppressionKey: input.suppressionKey,
  triggeredAt: input.triggeredAt,
  triggeredBy: input.triggeredBy,
  outcome: input.outcome,
  outcomeReason: input.outcomeReason,
  resultingRepairStatus: input.resultingRepairStatus,
  ...(input.schemaVersionBefore ? { schemaVersionBefore: input.schemaVersionBefore } : {}),
  ...(input.schemaVersionAfter ? { schemaVersionAfter: input.schemaVersionAfter } : {}),
  linkedLifecycleVersion: input.linkedLifecycleVersion
});

export const persistDiagnosticAlertSuppressionRepairCommandRecord = async (input: {
  readonly record: StoredDiagnosticAlertSuppressionRepairCommandRecord;
  readonly store?: DiagnosticAlertSuppressionRepairCommandRecordStorePort;
}): Promise<Result<{ readonly status: "persisted" | "not_configured" }, ApplicationError>> => {
  if (!input.store) {
    return ok({ status: "not_configured" });
  }
  const persisted = await input.store.put(input.record);
  if (!persisted.ok) {
    return err(
      dependencyFailureError("Failed to persist suppression repair command record", {
        suppressionKey: input.record.suppressionKey,
        commandRecordId: input.record.commandRecordId,
        message: persisted.error.message
      })
    );
  }
  return ok({ status: "persisted" });
};

