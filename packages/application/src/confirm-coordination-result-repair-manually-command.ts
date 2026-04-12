export type ConfirmCoordinationResultRepairManuallyCommand = {
  readonly factKey: string;
  readonly reason: string;
  readonly confirmedAt: string;
  readonly triggeredBy: string;
};
