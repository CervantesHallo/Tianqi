export type CreateADLCaseCommand = {
  readonly traceId: string;
  readonly adlCaseId: string;
  readonly sourceRiskCaseId: string;
  readonly configVersion: number;
  readonly createdAt: string;
};
