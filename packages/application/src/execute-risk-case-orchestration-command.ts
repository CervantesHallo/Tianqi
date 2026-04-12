export type ExecuteRiskCaseOrchestrationCommand = {
  readonly orchestrationId: string;
  readonly caseId: string;
  readonly requestId: string;
  readonly triggeredBy: string;
  readonly triggeredAt: string;
};
