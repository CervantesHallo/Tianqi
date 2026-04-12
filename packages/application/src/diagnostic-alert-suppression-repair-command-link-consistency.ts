import type {
  StoredDiagnosticAlertSuppressionRepairCommandRecord,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot
} from "@tianqi/ports";
import { ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { ApplicationError } from "./application-error.js";

export type SuppressionRepairCommandLinkConsistencyStatus =
  | "passed"
  | "missing_record"
  | "status_mismatch"
  | "key_mismatch"
  | "timeline_invalid";

export type SuppressionRepairCommandLinkConsistency = {
  readonly status: SuppressionRepairCommandLinkConsistencyStatus;
  readonly reason: string;
};

export const validateSuppressionRepairLifecycleCommandLink = (input: {
  readonly slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot;
  readonly latestRecord?: StoredDiagnosticAlertSuppressionRepairCommandRecord;
}): Result<SuppressionRepairCommandLinkConsistency, ApplicationError> => {
  const lastCommandRecordId = input.slot.lastCommandRecordId;
  if (!lastCommandRecordId) {
    return ok({
      status: "missing_record",
      reason: "Lifecycle slot lastCommandRecordId is missing"
    });
  }
  if (!input.latestRecord) {
    return ok({
      status: "missing_record",
      reason: "Latest command record is missing"
    });
  }
  if (input.latestRecord.commandRecordId !== lastCommandRecordId) {
    return ok({
      status: "missing_record",
      reason: "Lifecycle slot lastCommandRecordId does not match latest command record"
    });
  }
  if (
    input.latestRecord.suppressionKey !== input.slot.suppressionKey ||
    input.latestRecord.suppressionKey !== input.slot.currentLifecycle.targetSuppressionKey
  ) {
    return ok({
      status: "key_mismatch",
      reason: "Command record suppressionKey mismatches lifecycle slot suppression key"
    });
  }
  if (input.latestRecord.resultingRepairStatus !== input.slot.currentLifecycle.repairStatus) {
    return ok({
      status: "status_mismatch",
      reason: "Command record resultingRepairStatus mismatches lifecycle current repairStatus"
    });
  }
  const triggeredAt = Date.parse(input.latestRecord.triggeredAt);
  const updatedAt = Date.parse(input.slot.updatedAt);
  if (Number.isNaN(triggeredAt) || Number.isNaN(updatedAt) || triggeredAt > updatedAt) {
    return ok({
      status: "timeline_invalid",
      reason: "Command triggeredAt is later than lifecycle slot updatedAt or has invalid timestamp"
    });
  }
  return ok({
    status: "passed",
    reason: "Lifecycle slot and latest command record are linked consistently"
  });
};

