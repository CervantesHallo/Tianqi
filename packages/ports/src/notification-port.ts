import type { Result, RiskCaseId, TraceId } from "@tianqi/shared";

export type NotificationMessage = {
  readonly caseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly eventType: string;
  readonly content: string;
};

export type NotificationPortError = {
  readonly message: string;
};

export type NotificationPort = {
  publish(message: NotificationMessage): Promise<Result<void, NotificationPortError>>;
};
