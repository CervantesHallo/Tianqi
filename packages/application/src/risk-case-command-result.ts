import type { CommandResultReference, IdempotencyKey } from "@tianqi/shared";

import type { CompensationStatus } from "./compensation-state.js";
import type { ApplicationError } from "./application-error.js";

export type ApplicationRiskCaseView = {
  readonly caseId: string;
  readonly caseType: string;
  readonly state: string;
  readonly stage: string;
  readonly configVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type ApplicationTransitionView = {
  readonly before: {
    readonly state: string;
    readonly stage: string;
    readonly updatedAt: string;
  };
  readonly after: {
    readonly state: string;
    readonly stage: string;
    readonly updatedAt: string;
  };
};

export type ApplicationEventRecord = {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly traceId: string;
  readonly caseId: string;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
};

export type IdempotencyExecutionState = {
  readonly key: IdempotencyKey;
  readonly status: "not_enforced" | "accepted" | "duplicate";
  readonly reuse: "not_applicable" | "reference_available" | "reference_unavailable";
  readonly resultReference?: CommandResultReference;
};

export type ApplicationProcessingStatus = {
  readonly persistence: "not_attempted" | "succeeded" | "failed";
  readonly mapping: "not_attempted" | "succeeded" | "failed";
  readonly publish: "not_attempted" | "succeeded" | "failed";
  readonly outcome: "completed" | "failed_before_persistence" | "failed_after_persistence";
};

export type CompensationMarker = {
  readonly required: boolean;
  readonly reason: "publish_failed" | "not_required";
  readonly status: CompensationStatus;
  readonly commandName: string;
  readonly caseId: string;
  readonly resultReference?: CommandResultReference;
};

type ApplicationCommandSuccessResult = {
  readonly success: true;
  readonly idempotency: IdempotencyExecutionState;
  readonly processing: ApplicationProcessingStatus;
  readonly riskCase: ApplicationRiskCaseView;
  readonly events: readonly ApplicationEventRecord[];
  readonly transition?: ApplicationTransitionView;
  readonly compensation?: CompensationMarker;
};

type ApplicationCommandFailureResult = {
  readonly success: false;
  readonly idempotency: IdempotencyExecutionState;
  readonly processing: ApplicationProcessingStatus;
  readonly events: readonly [];
  readonly error: ApplicationError;
  readonly compensation?: CompensationMarker;
};

export type CreateRiskCaseCommandResult =
  | ApplicationCommandSuccessResult
  | ApplicationCommandFailureResult;

export type TransitionRiskCaseCommandResult =
  | ApplicationCommandSuccessResult
  | ApplicationCommandFailureResult;
