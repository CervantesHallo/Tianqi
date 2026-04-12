import type { CoreSubcaseKind } from "./core-case-flow-command-result.js";

export type RepairCoordinationResultReadViewCommand = {
  readonly factKey?: string;
  readonly riskCaseId?: string;
  readonly subcaseType?: CoreSubcaseKind;
  readonly subcaseId?: string;
  readonly occurredAt?: string;
  readonly reason: string;
  readonly repairedAt: string;
  readonly triggeredBy: string;
};
