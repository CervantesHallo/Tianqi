import type { ApplicationError } from "./application-error.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";

export type CoreCaseDiagnosticAggregateQueryResult =
  | {
      readonly success: true;
      readonly aggregateView: CoreCaseDiagnosticAggregateView;
      readonly consistencyStatus: "passed" | "failed";
      readonly consistencyReason: string;
    }
  | {
      readonly success: false;
      readonly error: ApplicationError;
    };

