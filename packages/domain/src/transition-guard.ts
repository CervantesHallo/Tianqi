import type { Result } from "@tianqi/shared";

import type { DomainError } from "./domain-error.js";
import type { RiskCase } from "./risk-case.js";
import type { TransitionAction } from "./transition-action.js";
import type { TransitionContext } from "./transition-context.js";

export type TransitionGuard = (
  riskCase: RiskCase,
  action: TransitionAction,
  context: TransitionContext
) => Result<void, DomainError>;
