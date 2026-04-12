import type { CompensationRecordQuery } from "@tianqi/ports";

import type { ApplicationError } from "./application-error.js";
import type { CompensationStatus } from "./compensation-state.js";

export type CompensationRecordView = {
  readonly commandName: string;
  readonly caseId: string;
  readonly status: CompensationStatus;
  readonly reason: "publish_failed" | "not_required";
  readonly resultReference?: string;
  readonly updatedAt: string;
};

export type CompensationQueryResult =
  | { readonly status: "found"; readonly record: CompensationRecordView }
  | { readonly status: "missing"; readonly query: CompensationRecordQuery }
  | {
      readonly status: "unavailable";
      readonly query: CompensationRecordQuery;
      readonly error: ApplicationError;
    };
