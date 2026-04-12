import type { CommandResultReference } from "@tianqi/shared";

import type { ApplicationError } from "./application-error.js";
import type { SinkInvocationStatus } from "./sink-invocation-status.js";
import type {
  ApplicationEventRecord,
  ApplicationProcessingStatus,
  ApplicationRiskCaseView,
  ApplicationTransitionView,
  CompensationMarker
} from "./risk-case-command-result.js";

export type CommandResultQueryObservability = {
  readonly validation:
    | "passed"
    | "missing_version"
    | "unsupported_version"
    | "not_performed";
  readonly versionMismatch: boolean;
  readonly snapshotMissing: boolean;
  readonly fallbackApplied: false;
};

export type ResolvedCommandResultSnapshot = {
  readonly schemaVersion: string;
  readonly reference: CommandResultReference;
  readonly commandName: string;
  readonly riskCase: ApplicationRiskCaseView;
  readonly events: readonly ApplicationEventRecord[];
  readonly processing: ApplicationProcessingStatus;
  readonly transition?: ApplicationTransitionView;
  readonly compensation?: CompensationMarker;
};

export type CommandResultQueryResult =
  | {
      readonly status: "found";
      readonly snapshot: ResolvedCommandResultSnapshot;
      readonly observability: CommandResultQueryObservability;
      readonly metricsSink: SinkInvocationStatus;
    }
  | {
      readonly status: "missing";
      readonly reference: CommandResultReference;
      readonly observability: CommandResultQueryObservability;
      readonly metricsSink: SinkInvocationStatus;
    }
  | {
      readonly status: "unavailable";
      readonly reference: CommandResultReference;
      readonly observability: CommandResultQueryObservability;
      readonly metricsSink: SinkInvocationStatus;
      readonly error: ApplicationError;
    };
