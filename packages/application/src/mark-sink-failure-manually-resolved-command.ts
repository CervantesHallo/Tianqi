import type { SinkRecoveryReferenceId } from "@tianqi/shared";

export type MarkSinkFailureManuallyResolvedCommand = {
  readonly recoveryReference: SinkRecoveryReferenceId;
  readonly traceId: string;
  readonly note?: string;
};
