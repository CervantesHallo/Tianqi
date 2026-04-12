import type { CommandResultReference, Result } from "@tianqi/shared";

export type StoredApplicationRiskCaseView = {
  readonly caseId: string;
  readonly caseType: string;
  readonly state: string;
  readonly stage: string;
  readonly configVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type StoredApplicationTransitionView = {
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

export type StoredApplicationEventRecord = {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: string;
  readonly traceId: string;
  readonly caseId: string;
  readonly occurredAt: string;
  readonly payload: Record<string, unknown>;
};

export type StoredApplicationProcessingStatus = {
  readonly persistence: "not_attempted" | "succeeded" | "failed";
  readonly mapping: "not_attempted" | "succeeded" | "failed";
  readonly publish: "not_attempted" | "succeeded" | "failed";
  readonly outcome: "completed" | "failed_before_persistence" | "failed_after_persistence";
};

export type StoredCompensationMarker = {
  readonly required: boolean;
  readonly reason: "publish_failed" | "not_required";
  readonly status: "pending" | "not_required" | "resolved" | "manual_intervention_required";
  readonly commandName: string;
  readonly caseId: string;
  readonly resultReference?: CommandResultReference;
};

export type StoredCommandResultSnapshot = {
  readonly schemaVersion: string;
  readonly reference: CommandResultReference;
  readonly commandName: string;
  readonly riskCase: StoredApplicationRiskCaseView;
  readonly events: readonly StoredApplicationEventRecord[];
  readonly processing: StoredApplicationProcessingStatus;
  readonly transition?: StoredApplicationTransitionView;
  readonly compensation?: StoredCompensationMarker;
};

export type CommandResultLookup =
  | { readonly status: "found"; readonly snapshot: StoredCommandResultSnapshot }
  | { readonly status: "missing" };

export type CommandResultStoreError = {
  readonly message: string;
};

export type CommandResultStorePort = {
  getByReference(
    resultReference: CommandResultReference
  ): Promise<Result<CommandResultLookup, CommandResultStoreError>>;
};
