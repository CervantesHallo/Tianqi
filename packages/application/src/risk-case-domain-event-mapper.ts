import {
  DOMAIN_EVENT_TYPES,
  createDomainEventEnvelope,
  createEventVersion
} from "@tianqi/contracts";
import type {
  ContractError,
  RiskCaseCreatedEvent,
  RiskCaseStateTransitionedEvent
} from "@tianqi/contracts";
import {
  RISK_CASE_DOMAIN_EVENT_TYPES
} from "@tianqi/domain";
import type { RiskCaseDomainEvent } from "@tianqi/domain";
import type { Result } from "@tianqi/shared";

export type RiskCaseContractEvent = RiskCaseCreatedEvent | RiskCaseStateTransitionedEvent;

export const mapRiskCaseDomainEventToContractEnvelope = (
  domainEvent: RiskCaseDomainEvent
): Result<RiskCaseContractEvent, ContractError> => {
  if (domainEvent.eventType === RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseCreated) {
    return createDomainEventEnvelope({
      eventId: domainEvent.eventId,
      eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
      eventVersion: createEventVersion(domainEvent.eventVersion),
      traceId: domainEvent.traceId,
      caseId: domainEvent.caseId,
      occurredAt: domainEvent.occurredAt.toISOString(),
      producer: "domain.risk_case",
      payload: {
        caseType: domainEvent.payload.caseType,
        initialState: domainEvent.payload.initialState,
        initialStage: domainEvent.payload.initialStage,
        configVersion: domainEvent.payload.configVersion
      },
      metadata: {
        sourceModule: "application.risk_case_event_mapper",
        schemaVersion: domainEvent.eventVersion
      }
    });
  }

  return createDomainEventEnvelope({
    eventId: domainEvent.eventId,
    eventType: DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned,
    eventVersion: createEventVersion(domainEvent.eventVersion),
    traceId: domainEvent.traceId,
    caseId: domainEvent.caseId,
    occurredAt: domainEvent.occurredAt.toISOString(),
    producer: "domain.risk_case",
    payload: {
      fromState: domainEvent.payload.fromState,
      toState: domainEvent.payload.toState,
      fromStage: domainEvent.payload.fromStage,
      toStage: domainEvent.payload.toStage,
      action: domainEvent.payload.action,
      reason: domainEvent.payload.reason,
      transitionedAt: domainEvent.payload.transitionedAt.toISOString()
    },
    metadata: {
      sourceModule: "application.risk_case_event_mapper",
      schemaVersion: domainEvent.eventVersion
    }
  });
};
