import type { CommandResultReference } from "@tianqi/shared";

import type { CompensationStatus } from "./compensation-state.js";

export const COMPENSATION_AUDIT_EVENT_TYPES = {
  CompensationStatusChanged: "CompensationStatusChanged"
} as const;

export type CompensationAuditEventType =
  (typeof COMPENSATION_AUDIT_EVENT_TYPES)[keyof typeof COMPENSATION_AUDIT_EVENT_TYPES];

export type CompensationStatusChangedAuditEvent = {
  readonly eventType: "CompensationStatusChanged";
  readonly resultReference: CommandResultReference;
  readonly caseId: string;
  readonly commandName: string;
  readonly beforeStatus: CompensationStatus;
  readonly afterStatus: CompensationStatus;
  readonly reason: string;
  readonly traceId: string;
  readonly occurredAt: string;
};

export const createCompensationStatusChangedAuditEvent = (input: {
  readonly resultReference: CommandResultReference;
  readonly caseId: string;
  readonly commandName: string;
  readonly beforeStatus: CompensationStatus;
  readonly afterStatus: CompensationStatus;
  readonly reason: string;
  readonly traceId: string;
  readonly occurredAt: string;
}): CompensationStatusChangedAuditEvent => ({
  eventType: COMPENSATION_AUDIT_EVENT_TYPES.CompensationStatusChanged,
  resultReference: input.resultReference,
  caseId: input.caseId,
  commandName: input.commandName,
  beforeStatus: input.beforeStatus,
  afterStatus: input.afterStatus,
  reason: input.reason,
  traceId: input.traceId,
  occurredAt: input.occurredAt
});
