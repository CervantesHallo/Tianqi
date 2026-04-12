import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { ApplicationError } from "./application-error.js";
import {
  validateDiagnosticHistoryReplay
} from "./coordination-diagnostic-history-replay-validation.js";
import type {
  DiagnosticHistoryConflictAttribution,
  DiagnosticHistoryReplayValidationResult
} from "./coordination-diagnostic-history-replay-validation.js";
import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

export type DiagnosticHistorySlotConsistencyResult = {
  readonly status: "passed" | "notice" | "failed";
  readonly reason: string;
  readonly replayValidation: DiagnosticHistoryReplayValidationResult;
  readonly conflictAttribution?: DiagnosticHistoryConflictAttribution;
};

export const validateDiagnosticHistorySlotConsistency = (input: {
  readonly requestedFactKey: string;
  readonly slotFactKey: string;
  readonly slotSchemaVersion?: string;
  readonly currentView: CoordinationResultDiagnosticView;
  readonly persistedCurrentView?: CoordinationResultDiagnosticView;
  readonly persistedPreviousView?: CoordinationResultDiagnosticView;
  readonly fallbackUsed: boolean;
}): Result<DiagnosticHistorySlotConsistencyResult, ApplicationError> => {
  const replayValidated = validateDiagnosticHistoryReplay({
    requestedFactKey: input.requestedFactKey,
    slotFactKey: input.slotFactKey,
    ...(input.slotSchemaVersion ? { slotSchemaVersion: input.slotSchemaVersion } : {}),
    currentView: input.currentView,
    ...(input.persistedCurrentView ? { persistedCurrentView: input.persistedCurrentView } : {}),
    ...(input.persistedPreviousView ? { persistedPreviousView: input.persistedPreviousView } : {}),
    fallbackUsed: input.fallbackUsed
  });
  if (!replayValidated.ok) {
    return err(replayValidated.error);
  }

  const replayValidation = replayValidated.value;
  return ok({
    status: replayValidation.status,
    reason: replayValidation.reason,
    replayValidation,
    ...(replayValidation.conflictAttribution ? { conflictAttribution: replayValidation.conflictAttribution } : {})
  });
};
