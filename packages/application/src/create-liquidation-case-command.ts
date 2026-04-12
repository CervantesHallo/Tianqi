export type CreateLiquidationCaseCommand = {
  readonly traceId: string;
  readonly liquidationCaseId: string;
  readonly sourceRiskCaseId: string;
  readonly configVersion: number;
  readonly createdAt: string;
};
