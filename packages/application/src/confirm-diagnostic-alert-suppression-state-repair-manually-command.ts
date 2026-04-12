export type ConfirmDiagnosticAlertSuppressionStateRepairManuallyCommand = {
  readonly suppressionKey: string;
  readonly reason: string;
  readonly confirmedAt: string;
  readonly triggeredBy: string;
};
