import type { DomainEventEnvelope } from "@tianqi/contracts";
import type { RiskCaseId } from "@tianqi/shared";

export type EventStoreContractProbe = {
  readonly __testkitProbe: true;
  listByCaseId(
    caseId: RiskCaseId
  ): Promise<readonly DomainEventEnvelope<Record<string, unknown>>[]>;
  countTotal(): Promise<number>;
};
