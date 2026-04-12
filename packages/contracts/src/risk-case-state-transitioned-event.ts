import type { DomainEventEnvelope } from "./domain-event-envelope.js";

export type RiskCaseStateTransitionedPayload = {
  readonly fromState: string;
  readonly toState: string;
  readonly fromStage: string;
  readonly toStage: string;
  readonly action: string;
  readonly reason: string;
  readonly transitionedAt: string;
};

export type RiskCaseStateTransitionedEvent = DomainEventEnvelope<
  RiskCaseStateTransitionedPayload,
  "RiskCaseStateTransitioned"
>;
