import type { CommandResultReference, Result } from "@tianqi/shared";

export type CompensationRecordQuery =
  | { readonly by: "reference"; readonly resultReference: CommandResultReference }
  | { readonly by: "case_id"; readonly caseId: string }
  | { readonly by: "command_name"; readonly commandName: string };

export type StoredCompensationRecord = {
  readonly commandName: string;
  readonly caseId: string;
  readonly status: "pending" | "not_required" | "resolved" | "manual_intervention_required";
  readonly reason: "publish_failed" | "not_required";
  readonly resultReference?: CommandResultReference;
  readonly updatedAt: string;
};

export type CompensationRecordLookup =
  | { readonly status: "found"; readonly record: StoredCompensationRecord }
  | { readonly status: "missing" };

export type CompensationRecordStoreError = {
  readonly message: string;
};

export type CompensationRecordStorePort = {
  getOne(query: CompensationRecordQuery): Promise<Result<CompensationRecordLookup, CompensationRecordStoreError>>;
};
