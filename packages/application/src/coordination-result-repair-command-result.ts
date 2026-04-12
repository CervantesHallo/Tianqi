import type { ApplicationError } from "./application-error.js";
import type { CoordinationResultReadObservation } from "./coordination-result-observation.js";
import type { CoordinationMetricsSinkStatus } from "./coordination-result-query-model.js";
import type { CoordinationResultRepairStatus } from "./coordination-result-repair-status.js";

export type CoordinationResultRepairRecordView = {
  readonly factKey: string;
  readonly outcome: "repaired" | "already_persisted" | "failed" | "manually_confirmed";
  readonly commandType: "repair" | "retry" | "confirm_manual";
  readonly source: "registry_by_fact_key" | "registry_by_composite_key";
  readonly persisted: boolean;
  readonly repairStatus: CoordinationResultRepairStatus;
  readonly repairAttempts: number;
  readonly manualConfirmation: boolean;
  readonly lastErrorCode?: string;
  readonly reason: string;
  readonly repairedAt: string;
  readonly triggeredBy: string;
};

export type CoordinationResultRepairCommandResult =
  | {
      readonly success: true;
      readonly record: CoordinationResultRepairRecordView;
      readonly observation: CoordinationResultReadObservation;
      readonly metricsSink: CoordinationMetricsSinkStatus;
    }
  | {
      readonly success: false;
      readonly error: ApplicationError;
      readonly record: CoordinationResultRepairRecordView;
      readonly observation: CoordinationResultReadObservation;
      readonly metricsSink: CoordinationMetricsSinkStatus;
    };
