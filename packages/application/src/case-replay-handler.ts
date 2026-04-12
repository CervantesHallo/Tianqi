import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import { ERROR_CODES } from "@tianqi/contracts";

import type { AuditEventStorePort } from "./audit-event-store.js";
import type { ReplayCaseCommand, CaseReplayInput } from "./case-replay-command.js";
import type { CaseReplayResult } from "./case-replay-result.js";
import { reconstructCaseFromReplayInput } from "./case-reconstruction.js";
import { validateReplayConsistency } from "./replay-consistency.js";

export type CaseReplayError = {
  readonly code: string;
  readonly type: "replay_input_invalid" | "event_store_read_failed" | "replay_reconstruction_failed" | "replay_consistency_failed";
  readonly message: string;
};

export const runCaseReplay = (
  command: ReplayCaseCommand,
  store: AuditEventStorePort
): Result<CaseReplayResult, CaseReplayError> => {

  const eventsResult = store.listByCaseId(command.caseId);
  if (!eventsResult.ok) {
    return err({
      code: ERROR_CODES.AUDIT_EVENT_STORE_READ_FAILED,
      type: "event_store_read_failed",
      message: `Failed to read events for case ${command.caseId}: ${eventsResult.error.message}`
    });
  }

  const events = eventsResult.value;
  if (events.length === 0) {
    return err({
      code: ERROR_CODES.REPLAY_INPUT_INVALID,
      type: "replay_input_invalid",
      message: `No events found for case ${command.caseId}`
    });
  }

  const replayInput: CaseReplayInput = {
    caseId: command.caseId,
    events,
    expectedConfigVersion: null,
    replayRequestedAt: command.replayRequestedAt,
    replayReason: command.replayReason,
    traceId: command.traceId
  };

  const consistency = validateReplayConsistency(replayInput);
  if (!consistency.consistent) {
    return err({
      code: ERROR_CODES.REPLAY_CONSISTENCY_CHECK_FAILED,
      type: "replay_consistency_failed",
      message: `Replay consistency check failed: ${consistency.violations.join("; ")}`
    });
  }

  const reconstruction = reconstructCaseFromReplayInput(replayInput);
  if (reconstruction.reconstructionStatus === "failed") {
    return err({
      code: ERROR_CODES.REPLAY_RECONSTRUCTION_FAILED,
      type: "replay_reconstruction_failed",
      message: `Reconstruction failed: ${reconstruction.summary}`
    });
  }

  return ok({
    caseId: command.caseId,
    eventCount: events.length,
    reconstructionStatus: reconstruction.reconstructionStatus,
    finalState: reconstruction.finalState,
    replaySummary: `Replay ${reconstruction.reconstructionStatus}: ${events.length} events, final=${reconstruction.finalState}`
  });
};
