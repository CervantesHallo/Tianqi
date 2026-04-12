import type { CoreSubcaseKind } from "./core-case-flow-command-result.js";

export type GetRiskCaseCoordinationResultQuery = {
  readonly riskCaseId: string;
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
};
