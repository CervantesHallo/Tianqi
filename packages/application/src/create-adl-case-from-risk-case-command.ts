export type CreateADLCaseFromRiskCaseCommand = {
  readonly traceId: string;
  readonly adlCaseId: string;
  readonly riskCaseId: string;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly createdAt: string;
};
