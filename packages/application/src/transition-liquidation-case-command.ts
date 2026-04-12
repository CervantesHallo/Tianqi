import type { LiquidationCaseTransitionAction } from "@tianqi/domain";

export type TransitionLiquidationCaseCommand = {
  readonly traceId: string;
  readonly liquidationCaseId: string;
  readonly action: LiquidationCaseTransitionAction;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly transitionedAt: string;
};
