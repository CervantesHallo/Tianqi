import type { CaseState } from "./case-state.js";
import type { CaseStage } from "./case-stage.js";
import type { RiskCase } from "./risk-case.js";
import type { RiskCaseDomainEvent } from "./risk-case-domain-event.js";
import type { TransitionAction } from "./transition-action.js";
import type { TransitionContext } from "./transition-context.js";

export type TransitionInput = {
  readonly riskCase: RiskCase;
  readonly action: TransitionAction;
  readonly context: TransitionContext;
};

export type TransitionSnapshot = {
  readonly state: CaseState;
  readonly stage: CaseStage;
  readonly updatedAt: Date;
};

export type TransitionResult = {
  readonly riskCase: RiskCase;
  readonly action: TransitionAction;
  readonly context: TransitionContext;
  readonly before: TransitionSnapshot;
  readonly after: TransitionSnapshot;
  readonly events: readonly RiskCaseDomainEvent[];
};
