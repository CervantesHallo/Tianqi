import type { ApplicationError } from "./application-error.js";
import type { CoordinationResultReadObservation } from "./coordination-result-observation.js";
import type { RiskCaseCoordinationResultView } from "./risk-case-coordination-result-read-view.js";

export type CoordinationMetricsSinkStatus =
  | { readonly status: "succeeded" }
  | { readonly status: "failed"; readonly errorSummary: string }
  | { readonly status: "not_attempted" };

export type CoordinationResultQueryResult =
  | {
      readonly success: true;
      readonly view: RiskCaseCoordinationResultView;
      readonly observation: CoordinationResultReadObservation;
      readonly metricsSink: CoordinationMetricsSinkStatus;
    }
  | {
      readonly success: false;
      readonly error: ApplicationError;
      readonly observation: CoordinationResultReadObservation;
      readonly metricsSink: CoordinationMetricsSinkStatus;
    };
