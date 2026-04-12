import type { Result } from "@tianqi/shared";

export type AuditEventRecord = {
  readonly eventType: string;
  readonly occurredAt: string;
  readonly traceId: string;
  readonly payload: Record<string, unknown>;
};

export type AuditEventSinkError = {
  readonly message: string;
};

export type AuditEventSinkPort = {
  append(event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>>;
};
