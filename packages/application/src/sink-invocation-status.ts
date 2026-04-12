import type { RetryEligibility, SinkFailureRecoveryView } from "./sink-failure-recovery.js";

export type SinkInvocationStatus =
  | {
      readonly status: "succeeded";
      readonly retryEligibility: Extract<RetryEligibility, "not_applicable">;
    }
  | {
      readonly status: "not_attempted";
      readonly retryEligibility: Extract<RetryEligibility, "not_applicable">;
    }
  | {
      readonly status: "failed";
      readonly retryEligibility: Exclude<RetryEligibility, "not_applicable">;
      readonly errorSummary: string;
      readonly recovery: SinkFailureRecoveryView;
    };
