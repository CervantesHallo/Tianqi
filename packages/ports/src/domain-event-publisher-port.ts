import type { DomainEventEnvelope } from "@tianqi/contracts";
import type { Result } from "@tianqi/shared";

export type DomainEventPublisherError = {
  readonly message: string;
};

export type DomainEventPublisherPort = {
  publish(event: DomainEventEnvelope<Record<string, unknown>>): Promise<Result<void, DomainEventPublisherError>>;
};
