export type RetryCoordinationResultRepairCommand = {
  readonly factKey: string;
  readonly reason: string;
  readonly retriedAt: string;
  readonly triggeredBy: string;
};
