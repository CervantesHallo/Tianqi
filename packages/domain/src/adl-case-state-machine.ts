import type { Result } from "@tianqi/shared";
import { err, ok } from "@tianqi/shared";

import { ADLCaseState } from "./adl-case-state.js";
import { ADLCaseTransitionAction } from "./adl-case-transition-action.js";
import { domainValidationError, invalidStateTransitionError, terminalStateTransitionError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";
import type { ADLCase } from "./adl-case.js";
import type { TransitionContext } from "./transition-context.js";

type ADLTransitionRule = {
  readonly nextState: ADLCaseState;
};

export type ADLCaseTransitionInput = {
  readonly adlCase: ADLCase;
  readonly action: ADLCaseTransitionAction;
  readonly context: TransitionContext;
};

export type ADLCaseTransitionResult = {
  readonly adlCase: ADLCase;
  readonly action: ADLCaseTransitionAction;
  readonly context: TransitionContext;
  readonly before: {
    readonly state: ADLCaseState;
    readonly updatedAt: Date;
  };
  readonly after: {
    readonly state: ADLCaseState;
    readonly updatedAt: Date;
  };
};

const transitionRules: Readonly<
  Partial<Record<ADLCaseState, Partial<Record<ADLCaseTransitionAction, ADLTransitionRule>>>>
> = {
  [ADLCaseState.Initiated]: {
    [ADLCaseTransitionAction.Queue]: {
      nextState: ADLCaseState.Queued
    },
    [ADLCaseTransitionAction.Fail]: {
      nextState: ADLCaseState.Failed
    }
  },
  [ADLCaseState.Queued]: {
    [ADLCaseTransitionAction.Execute]: {
      nextState: ADLCaseState.Executed
    },
    [ADLCaseTransitionAction.Fail]: {
      nextState: ADLCaseState.Failed
    }
  }
};

const TERMINAL_STATES: ReadonlySet<ADLCaseState> = new Set([
  ADLCaseState.Executed,
  ADLCaseState.Failed
]);

const validateTransitionContext = (input: ADLCaseTransitionInput): Result<void, DomainError> => {
  if (input.context.reason.trim().length === 0) {
    return err(
      domainValidationError("ADLCase transition reason must be non-empty", {
        action: input.action
      })
    );
  }
  if (input.context.configVersion !== input.adlCase.configVersion) {
    return err(
      domainValidationError("ADLCase transition config version mismatch", {
        caseConfigVersion: `${input.adlCase.configVersion}`,
        contextConfigVersion: `${input.context.configVersion}`
      })
    );
  }
  if (Number.isNaN(input.context.transitionedAt.getTime())) {
    return err(
      domainValidationError("ADLCase transitionedAt must be valid", {
        transitionedAt: input.context.transitionedAt.toString()
      })
    );
  }
  if (input.context.transitionedAt.getTime() < input.adlCase.updatedAt.getTime()) {
    return err(
      domainValidationError("ADLCase transitionedAt cannot move backwards", {
        currentUpdatedAt: input.adlCase.updatedAt.toISOString(),
        transitionedAt: input.context.transitionedAt.toISOString()
      })
    );
  }
  return ok(undefined);
};

export class ADLCaseStateMachine {
  public transition(input: ADLCaseTransitionInput): Result<ADLCaseTransitionResult, DomainError> {
    if (TERMINAL_STATES.has(input.adlCase.state)) {
      return err(
        terminalStateTransitionError(
          input.adlCase.state,
          input.action,
          "ADLCase cannot transition from terminal state"
        )
      );
    }

    const rule = transitionRules[input.adlCase.state]?.[input.action];
    if (!rule) {
      return err(
        invalidStateTransitionError(
          input.adlCase.state,
          input.action,
          `No ADL transition rule from ${input.adlCase.state} using ${input.action}`
        )
      );
    }

    const contextValidation = validateTransitionContext(input);
    if (!contextValidation.ok) {
      return contextValidation;
    }

    const nextCase = input.adlCase.transitionTo(rule.nextState, input.context.transitionedAt);
    if (!nextCase.ok) {
      return nextCase;
    }

    return ok({
      adlCase: nextCase.value,
      action: input.action,
      context: input.context,
      before: {
        state: input.adlCase.state,
        updatedAt: input.adlCase.updatedAt
      },
      after: {
        state: nextCase.value.state,
        updatedAt: nextCase.value.updatedAt
      }
    });
  }
}
