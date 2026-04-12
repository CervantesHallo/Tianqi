import type { DomainEventEnvelope } from "./domain-event-envelope.js";

export type RiskCaseCreatedPayload = {
  readonly caseType: string;
  readonly initialState: string;
  readonly initialStage: string;
  readonly configVersion: number;
};

export type RiskCaseCreatedEvent = DomainEventEnvelope<RiskCaseCreatedPayload, "RiskCaseCreated">;
