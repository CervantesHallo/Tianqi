export type DomainEventMetadata = {
  readonly sourceModule: string;
  readonly schemaVersion: string;
  readonly correlationId?: string;
};
