import type { Result } from "@tianqi/shared";
import { err, ok } from "@tianqi/shared";

import { domainValidationError, invalidStateTransitionError, terminalStateTransitionError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";
import type { LiquidationCase } from "./liquidation-case.js";
import { LiquidationCaseState } from "./liquidation-case-state.js";
import { LiquidationCaseTransitionAction } from "./liquidation-case-transition-action.js";
import type { TransitionContext } from "./transition-context.js";

type LiquidationTransitionRule = {
  readonly nextState: LiquidationCaseState;
};

export type LiquidationCaseTransitionInput = {
  readonly liquidationCase: LiquidationCase;
  readonly action: LiquidationCaseTransitionAction;
  readonly context: TransitionContext;
};

export type LiquidationCaseTransitionResult = {
  readonly liquidationCase: LiquidationCase;
  readonly action: LiquidationCaseTransitionAction;
  readonly context: TransitionContext;
  readonly before: {
    readonly state: LiquidationCaseState;
    readonly updatedAt: Date;
  };
  readonly after: {
    readonly state: LiquidationCaseState;
    readonly updatedAt: Date;
  };
};

const transitionRules: Readonly<
  Partial<
    Record<LiquidationCaseState, Partial<Record<LiquidationCaseTransitionAction, LiquidationTransitionRule>>>
  >
> = {
  [LiquidationCaseState.Initiated]: {
    [LiquidationCaseTransitionAction.StartProgress]: {
      nextState: LiquidationCaseState.InProgress
    },
    [LiquidationCaseTransitionAction.Fail]: {
      nextState: LiquidationCaseState.Failed
    }
  },
  [LiquidationCaseState.InProgress]: {
    [LiquidationCaseTransitionAction.Complete]: {
      nextState: LiquidationCaseState.Completed
    },
    [LiquidationCaseTransitionAction.Fail]: {
      nextState: LiquidationCaseState.Failed
    }
  }
};

const TERMINAL_STATES: ReadonlySet<LiquidationCaseState> = new Set([
  LiquidationCaseState.Completed,
  LiquidationCaseState.Failed
]);

const validateTransitionContext = (
  input: LiquidationCaseTransitionInput
): Result<void, DomainError> => {
  if (input.context.reason.trim().length === 0) {
    return err(
      domainValidationError("LiquidationCase transition reason must be non-empty", {
        action: input.action
      })
    );
  }
  if (input.context.configVersion !== input.liquidationCase.configVersion) {
    return err(
      domainValidationError("LiquidationCase transition config version mismatch", {
        caseConfigVersion: `${input.liquidationCase.configVersion}`,
        contextConfigVersion: `${input.context.configVersion}`
      })
    );
  }
  if (Number.isNaN(input.context.transitionedAt.getTime())) {
    return err(
      domainValidationError("LiquidationCase transitionedAt must be valid", {
        transitionedAt: input.context.transitionedAt.toString()
      })
    );
  }
  if (input.context.transitionedAt.getTime() < input.liquidationCase.updatedAt.getTime()) {
    return err(
      domainValidationError("LiquidationCase transitionedAt cannot move backwards", {
        currentUpdatedAt: input.liquidationCase.updatedAt.toISOString(),
        transitionedAt: input.context.transitionedAt.toISOString()
      })
    );
  }
  return ok(undefined);
};

export class LiquidationCaseStateMachine {
  public transition(
    input: LiquidationCaseTransitionInput
  ): Result<LiquidationCaseTransitionResult, DomainError> {
    if (TERMINAL_STATES.has(input.liquidationCase.state)) {
      return err(
        terminalStateTransitionError(
          input.liquidationCase.state,
          input.action,
          "LiquidationCase cannot transition from terminal state"
        )
      );
    }

    const rule = transitionRules[input.liquidationCase.state]?.[input.action];
    if (!rule) {
      return err(
        invalidStateTransitionError(
          input.liquidationCase.state,
          input.action,
          `No liquidation transition rule from ${input.liquidationCase.state} using ${input.action}`
        )
      );
    }

    const contextValidation = validateTransitionContext(input);
    if (!contextValidation.ok) {
      return contextValidation;
    }

    const nextCase = input.liquidationCase.transitionTo(rule.nextState, input.context.transitionedAt);
    if (!nextCase.ok) {
      return nextCase;
    }

    return ok({
      liquidationCase: nextCase.value,
      action: input.action,
      context: input.context,
      before: {
        state: input.liquidationCase.state,
        updatedAt: input.liquidationCase.updatedAt
      },
      after: {
        state: nextCase.value.state,
        updatedAt: nextCase.value.updatedAt
      }
    });
  }
}
