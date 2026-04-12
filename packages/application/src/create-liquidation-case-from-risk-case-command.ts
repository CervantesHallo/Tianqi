export type CreateLiquidationCaseFromRiskCaseCommand = {
  readonly traceId: string;
  readonly liquidationCaseId: string;
  readonly riskCaseId: string;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly createdAt: string;
};
