export type RepairDiagnosticAlertSuppressionStateCommand = {
  readonly suppressionKey: string;
  readonly reason: string;
  readonly repairedAt: string;
  readonly triggeredBy: string;
};
