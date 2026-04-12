import type { Result } from "@tianqi/shared";

export type CoordinationMetricsObservationRecord = {
  readonly scope: "query" | "persistence" | "repair";
  readonly factKey?: string;
  readonly riskCaseId?: string;
  readonly subcaseType?: "LiquidationCase" | "ADLCase";
  readonly subcaseId?: string;
  readonly storeReadHit: boolean;
  readonly registryFallbackUsed: boolean;
  readonly validationPassed: boolean;
  readonly validationFailed: boolean;
  readonly persistenceWriteSucceeded: boolean;
  readonly persistenceWriteFailed: boolean;
  readonly repairAttempted: boolean;
  readonly repairSucceeded: boolean;
  readonly repairFailed: boolean;
};

export type CoordinationMetricsSinkError = {
  readonly message: string;
};

export type CoordinationMetricsSinkPort = {
  record(observation: CoordinationMetricsObservationRecord): Promise<Result<void, CoordinationMetricsSinkError>>;
};
