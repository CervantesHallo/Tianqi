import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type { EventId, RiskCaseId, TraceId } from "@tianqi/shared";

import {
  contractInvalidFieldFormatError,
  contractRequiredFieldMissingError
} from "./contract-error.js";
import type { ContractError } from "./contract-error.js";
import type { DomainEventType } from "./domain-event-type.js";
import type { DomainEventMetadata } from "./event-metadata.js";
import type { EventVersion } from "./event-version.js";

export type DomainEventEnvelope<
  TPayload extends Record<string, unknown>,
  TEventType extends DomainEventType = DomainEventType
> = {
  readonly eventId: EventId;
  readonly eventType: TEventType;
  readonly eventVersion: EventVersion;
  readonly traceId: TraceId;
  readonly caseId: RiskCaseId;
  readonly occurredAt: string;
  readonly producer: string;
  readonly payload: TPayload;
  readonly metadata: DomainEventMetadata;
};

export type CreateDomainEventEnvelopeInput<
  TPayload extends Record<string, unknown>,
  TEventType extends DomainEventType
> = {
  readonly eventId: EventId;
  readonly eventType: TEventType;
  readonly eventVersion: EventVersion;
  readonly traceId: TraceId;
  readonly caseId: RiskCaseId;
  readonly occurredAt: string;
  readonly producer: string;
  readonly payload: TPayload;
  readonly metadata: DomainEventMetadata;
};

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const createDomainEventEnvelope = <
  TPayload extends Record<string, unknown>,
  TEventType extends DomainEventType
>(
  input: CreateDomainEventEnvelopeInput<TPayload, TEventType>
): Result<DomainEventEnvelope<TPayload, TEventType>, ContractError> => {
  if (!isNonEmpty(input.producer)) {
    return err(contractRequiredFieldMissingError("producer"));
  }

  if (!isNonEmpty(input.metadata.sourceModule)) {
    return err(contractRequiredFieldMissingError("metadata.sourceModule"));
  }

  if (!isNonEmpty(input.metadata.schemaVersion)) {
    return err(contractRequiredFieldMissingError("metadata.schemaVersion"));
  }

  if (!ISO_8601_PATTERN.test(input.occurredAt)) {
    return err(contractInvalidFieldFormatError("occurredAt", "UTC ISO-8601 string"));
  }

  return ok({
    eventId: input.eventId,
    eventType: input.eventType,
    eventVersion: input.eventVersion,
    traceId: input.traceId,
    caseId: input.caseId,
    occurredAt: input.occurredAt,
    producer: input.producer,
    payload: input.payload,
    metadata: input.metadata
  });
};
