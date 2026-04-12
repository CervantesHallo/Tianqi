export const ORCHESTRATION_AUDIT_EVENT_VERSION = "1.0.0" as const;

export type OrchestrationAuditEventType =
  | "RiskCaseOrchestrationStarted"
  | "RiskCaseOrchestrationStepCompleted"
  | "RiskCaseOrchestrationFailed"
  | "RiskCaseOrchestrationCompensationPlanned"
  | "RiskCaseOrchestrationCompensationExecuted"
  | "RiskCaseOrchestrationCompleted";

export type RiskCaseOrchestrationAuditEvent = {
  readonly eventId: string;
  readonly eventType: OrchestrationAuditEventType;
  readonly eventVersion: string;
  readonly traceId: string;
  readonly caseId: string;
  readonly orchestrationId: string;
  readonly occurredAt: string;
  readonly producer: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, string>;
};

let auditSeq = 0;

export const buildOrchestrationAuditEvent = (
  eventType: OrchestrationAuditEventType,
  orchestrationId: string,
  caseId: string,
  occurredAt: string,
  payload: Record<string, unknown>
): RiskCaseOrchestrationAuditEvent => ({
  eventId: `${orchestrationId}-audit-${++auditSeq}`,
  eventType,
  eventVersion: ORCHESTRATION_AUDIT_EVENT_VERSION,
  traceId: orchestrationId,
  caseId,
  orchestrationId,
  occurredAt,
  producer: "risk-case-orchestrator",
  payload,
  metadata: { generatedBy: "orchestrator-step2" }
});
