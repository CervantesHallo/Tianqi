export type RecoverySinkInvocationStatus =
  | {
      readonly status: "succeeded";
    }
  | {
      readonly status: "not_attempted";
    }
  | {
      readonly status: "failed";
      readonly errorSummary: string;
    };
