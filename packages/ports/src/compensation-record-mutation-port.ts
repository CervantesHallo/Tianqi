import type { CommandResultReference, Result } from "@tianqi/shared";

export type CompensationMutationRequest = {
  readonly resultReference: CommandResultReference;
  readonly targetStatus: "pending" | "not_required" | "resolved" | "manual_intervention_required";
  readonly reason: string;
  readonly traceId: string;
};

export type MutatedCompensationRecord = {
  readonly commandName: string;
  readonly caseId: string;
  readonly status: "pending" | "not_required" | "resolved" | "manual_intervention_required";
  readonly reason: "publish_failed" | "not_required";
  readonly resultReference?: CommandResultReference;
  readonly updatedAt: string;
};

export type CompensationMutationOutcome =
  | { readonly status: "updated"; readonly record: MutatedCompensationRecord }
  | { readonly status: "missing" };

export type CompensationMutationStoreError = {
  readonly message: string;
};

export type CompensationRecordMutationPort = {
  updateOne(
    request: CompensationMutationRequest
  ): Promise<Result<CompensationMutationOutcome, CompensationMutationStoreError>>;
};
