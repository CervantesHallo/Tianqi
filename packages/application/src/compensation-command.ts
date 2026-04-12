import type { CommandResultReference } from "@tianqi/shared";

export type ResolveCompensationCommand = {
  readonly resultReference: CommandResultReference;
  readonly reason: string;
  readonly traceId: string;
};

export type MarkCompensationManualInterventionRequiredCommand = {
  readonly resultReference: CommandResultReference;
  readonly reason: string;
  readonly traceId: string;
};
