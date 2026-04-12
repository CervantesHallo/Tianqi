export type RetryDiagnosticAlertSuppressionStateRepairCommand = {
  readonly suppressionKey: string;
  readonly reason: string;
  readonly retriedAt: string;
  readonly triggeredBy: string;
};
