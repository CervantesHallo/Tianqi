import type { ApplicationError } from "./application-error.js";
import type { CompensationStatusChangedAuditEvent } from "./compensation-audit-event.js";
import type { CompensationRecordView } from "./compensation-query-model.js";
import type { CompensationStatus } from "./compensation-state.js";
import type { SinkInvocationStatus } from "./sink-invocation-status.js";

export type CompensationTransitionView = {
  readonly fromStatus: CompensationStatus;
  readonly toStatus: CompensationStatus;
};

export type CompensationCommandResult =
  | {
      readonly success: true;
      readonly record: CompensationRecordView;
      readonly transition: CompensationTransitionView;
      readonly auditEvents: readonly CompensationStatusChangedAuditEvent[];
      readonly auditSink: SinkInvocationStatus;
    }
  | {
      readonly success: false;
      readonly state: "missing" | "invalid_transition" | "unavailable";
      readonly error: ApplicationError;
      readonly auditEvents: readonly [];
      readonly auditSink: SinkInvocationStatus;
    };
