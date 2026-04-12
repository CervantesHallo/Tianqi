import type { CoreSubcaseKind } from "./core-case-flow-command-result.js";

export type CoordinateRiskCaseAfterSubcaseTerminalCommand = {
  readonly traceId: string;
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly coordinatedAt: string;
};
