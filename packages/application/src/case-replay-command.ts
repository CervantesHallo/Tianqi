import type { StoredAuditEvent } from "./audit-event-store.js";

export type CaseReplayInput = {
  readonly caseId: string;
  readonly events: readonly StoredAuditEvent[];
  readonly expectedConfigVersion: string | null;
  readonly replayRequestedAt: string;
  readonly replayReason: string;
  readonly traceId: string;
};

export type ReplayCaseCommand = {
  readonly caseId: string;
  readonly replayReason: string;
  readonly traceId: string;
  readonly replayRequestedAt: string;
};
