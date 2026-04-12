import { createEventId } from "@tianqi/shared";
import type { ConfigVersion, EventId, RiskCaseId, TraceId } from "@tianqi/shared";

import type { CaseStage } from "./case-stage.js";
import type { CaseState } from "./case-state.js";
import type { RiskCaseType } from "./risk-case-type.js";
import type { TransitionAction } from "./transition-action.js";

export const RISK_CASE_DOMAIN_EVENT_TYPES = {
  RiskCaseCreated: "RiskCaseCreated",
  RiskCaseStateTransitioned: "RiskCaseStateTransitioned"
} as const;

export type RiskCaseDomainEventType =
  (typeof RISK_CASE_DOMAIN_EVENT_TYPES)[keyof typeof RISK_CASE_DOMAIN_EVENT_TYPES];

export type RiskCaseDomainEventVersion = "1.0.0";

type RiskCaseDomainEventBase<TType extends RiskCaseDomainEventType, TPayload> = {
  readonly eventId: EventId;
  readonly eventType: TType;
  readonly eventVersion: RiskCaseDomainEventVersion;
  readonly caseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly occurredAt: Date;
  readonly payload: TPayload;
};

export type RiskCaseCreatedPayload = {
  readonly caseType: RiskCaseType;
  readonly initialState: CaseState;
  readonly initialStage: CaseStage;
  readonly configVersion: ConfigVersion;
  readonly createdAt: Date;
};

export type RiskCaseStateTransitionedPayload = {
  readonly caseType: RiskCaseType;
  readonly fromState: CaseState;
  readonly toState: CaseState;
  readonly fromStage: CaseStage;
  readonly toStage: CaseStage;
  readonly action: TransitionAction;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: ConfigVersion;
  readonly transitionedAt: Date;
};

export type RiskCaseCreatedDomainEvent = RiskCaseDomainEventBase<
  "RiskCaseCreated",
  RiskCaseCreatedPayload
>;

export type RiskCaseStateTransitionedDomainEvent = RiskCaseDomainEventBase<
  "RiskCaseStateTransitioned",
  RiskCaseStateTransitionedPayload
>;

export type RiskCaseDomainEvent =
  | RiskCaseCreatedDomainEvent
  | RiskCaseStateTransitionedDomainEvent;

const EVENT_VERSION: RiskCaseDomainEventVersion = "1.0.0";

const buildDomainEventId = (
  caseId: RiskCaseId,
  eventType: RiskCaseDomainEventType,
  occurredAt: Date
): EventId => createEventId(`${caseId}:${eventType}:${occurredAt.toISOString()}`);

export const createRiskCaseCreatedDomainEvent = (input: {
  readonly caseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly occurredAt: Date;
  readonly payload: RiskCaseCreatedPayload;
}): RiskCaseCreatedDomainEvent => ({
  eventId: buildDomainEventId(input.caseId, RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseCreated, input.occurredAt),
  eventType: RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseCreated,
  eventVersion: EVENT_VERSION,
  caseId: input.caseId,
  traceId: input.traceId,
  occurredAt: input.occurredAt,
  payload: input.payload
});

export const createRiskCaseStateTransitionedDomainEvent = (input: {
  readonly caseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly occurredAt: Date;
  readonly payload: RiskCaseStateTransitionedPayload;
}): RiskCaseStateTransitionedDomainEvent => ({
  eventId: buildDomainEventId(
    input.caseId,
    RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned,
    input.occurredAt
  ),
  eventType: RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned,
  eventVersion: EVENT_VERSION,
  caseId: input.caseId,
  traceId: input.traceId,
  occurredAt: input.occurredAt,
  payload: input.payload
});
