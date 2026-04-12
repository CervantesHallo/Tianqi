import type { DomainEventEnvelope } from "@tianqi/contracts";
import type { Result } from "@tianqi/shared";

export type EventStoreWriteError = {
  readonly message: string;
};

export type EventStorePort = {
  append<TPayload extends Record<string, unknown>>(
    event: DomainEventEnvelope<TPayload>
  ): Promise<Result<void, EventStoreWriteError>>;
};
