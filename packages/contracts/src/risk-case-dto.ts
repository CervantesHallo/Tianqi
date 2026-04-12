export type RiskCaseDto = {
  readonly caseId: string;
  readonly caseType: string;
  readonly currentState: string;
  readonly currentStage: string;
  readonly configVersion: number;
};
