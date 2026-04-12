import type { ADLCaseTransitionAction } from "@tianqi/domain";

export type TransitionADLCaseCommand = {
  readonly traceId: string;
  readonly adlCaseId: string;
  readonly action: ADLCaseTransitionAction;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly transitionedAt: string;
};
