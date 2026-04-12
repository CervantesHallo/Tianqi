import type { TransitionAction } from "@tianqi/domain";
import type { IdempotencyKey } from "@tianqi/shared";

export type TransitionRiskCaseCommand = {
  readonly idempotencyKey: IdempotencyKey;
  readonly traceId: string;
  readonly caseId: string;
  readonly action: TransitionAction;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: number;
  readonly transitionedAt: string;
};
