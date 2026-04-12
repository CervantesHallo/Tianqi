import type { CoordinationMetricsObservationRecord } from "@tianqi/ports";

export type CoordinationResultReadObservation = CoordinationMetricsObservationRecord;

export const buildCoordinationResultObservation = (input: {
  readonly scope: CoordinationResultReadObservation["scope"];
  readonly factKey?: string;
  readonly riskCaseId?: string;
  readonly subcaseType?: "LiquidationCase" | "ADLCase";
  readonly subcaseId?: string;
  readonly storeReadHit?: boolean;
  readonly registryFallbackUsed?: boolean;
  readonly validationPassed?: boolean;
  readonly validationFailed?: boolean;
  readonly persistenceWriteSucceeded?: boolean;
  readonly persistenceWriteFailed?: boolean;
  readonly repairAttempted?: boolean;
  readonly repairSucceeded?: boolean;
  readonly repairFailed?: boolean;
}): CoordinationResultReadObservation => ({
  scope: input.scope,
  ...(input.factKey ? { factKey: input.factKey } : {}),
  ...(input.riskCaseId ? { riskCaseId: input.riskCaseId } : {}),
  ...(input.subcaseType ? { subcaseType: input.subcaseType } : {}),
  ...(input.subcaseId ? { subcaseId: input.subcaseId } : {}),
  storeReadHit: input.storeReadHit ?? false,
  registryFallbackUsed: input.registryFallbackUsed ?? false,
  validationPassed: input.validationPassed ?? false,
  validationFailed: input.validationFailed ?? false,
  persistenceWriteSucceeded: input.persistenceWriteSucceeded ?? false,
  persistenceWriteFailed: input.persistenceWriteFailed ?? false,
  repairAttempted: input.repairAttempted ?? false,
  repairSucceeded: input.repairSucceeded ?? false,
  repairFailed: input.repairFailed ?? false
});
