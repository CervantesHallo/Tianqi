import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import { CaseState } from "./case-state.js";
import { resolveStageForState } from "./case-stage-mapping.js";
import {
  invalidStateTransitionError,
  terminalStateTransitionError,
  transitionGuardRejectedError
} from "./domain-error.js";
import type { DomainError } from "./domain-error.js";
import type { RiskCase } from "./risk-case.js";
import { createRiskCaseStateTransitionedDomainEvent } from "./risk-case-domain-event.js";
import type { TransitionGuard } from "./transition-guard.js";
import type { TransitionInput, TransitionResult } from "./transition-result.js";
import { TransitionAction } from "./transition-action.js";

type TransitionRule = {
  readonly nextState: CaseState;
  readonly guard: TransitionGuard;
};

const defaultTransitionGuard: TransitionGuard = (riskCase, action, context) => {
  const normalizedReason = context.reason.trim();
  if (normalizedReason.length === 0) {
    return err(
      transitionGuardRejectedError(action, "Transition reason must be a non-empty string", {
        traceId: context.traceId
      })
    );
  }

  if (context.configVersion !== riskCase.configVersion) {
    return err(
      transitionGuardRejectedError(action, "Transition config version mismatch", {
        caseConfigVersion: `${riskCase.configVersion}`,
        contextConfigVersion: `${context.configVersion}`
      })
    );
  }

  if (Number.isNaN(context.transitionedAt.getTime())) {
    return err(
      transitionGuardRejectedError(action, "transitionedAt must be a valid Date", {
        transitionedAt: context.transitionedAt.toString()
      })
    );
  }

  if (context.transitionedAt.getTime() < riskCase.updatedAt.getTime()) {
    return err(
      transitionGuardRejectedError(action, "Transition time cannot move backwards", {
        currentUpdatedAt: riskCase.updatedAt.toISOString(),
        transitionedAt: context.transitionedAt.toISOString()
      })
    );
  }

  const expectedStage = resolveStageForState(riskCase.state);
  if (riskCase.stage !== expectedStage) {
    return err(
      transitionGuardRejectedError(action, "RiskCase has invalid state-stage combination", {
        state: riskCase.state,
        stage: riskCase.stage,
        expectedStage
      })
    );
  }

  return ok(undefined);
};

const transitionRules: Partial<
  Readonly<Record<CaseState, Readonly<Partial<Record<TransitionAction, TransitionRule>>>>>
> = {
  [CaseState.Detected]: {
    [TransitionAction.StartValidation]: {
      nextState: CaseState.Validating,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.Validating]: {
    [TransitionAction.Classify]: {
      nextState: CaseState.Classified,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.Classified]: {
    [TransitionAction.Close]: {
      nextState: CaseState.Closed,
      guard: defaultTransitionGuard
    },
    [TransitionAction.StartLiquidation]: {
      nextState: CaseState.Liquidating,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.Liquidating]: {
    [TransitionAction.StartFundAbsorption]: {
      nextState: CaseState.FundAbsorbing,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.FundAbsorbing]: {
    [TransitionAction.StartAdlEvaluation]: {
      nextState: CaseState.EvaluatingADL,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.EvaluatingADL]: {
    [TransitionAction.StartAdlPlanning]: {
      nextState: CaseState.PlanningADL,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.PlanningADL]: {
    [TransitionAction.StartAdlExecution]: {
      nextState: CaseState.ExecutingADL,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.ExecutingADL]: {
    [TransitionAction.Settle]: {
      nextState: CaseState.Settling,
      guard: defaultTransitionGuard
    }
  },
  [CaseState.Settling]: {
    [TransitionAction.Close]: {
      nextState: CaseState.Closed,
      guard: defaultTransitionGuard
    }
  }
};

const terminalTransitionRules: Readonly<
  Partial<Record<TransitionAction, TransitionRule>>
> = {
  [TransitionAction.Fail]: {
    nextState: CaseState.Failed,
    guard: defaultTransitionGuard
  },
  [TransitionAction.RequestManualIntervention]: {
    nextState: CaseState.ManualInterventionRequired,
    guard: defaultTransitionGuard
  }
};

const TERMINAL_STATES: ReadonlySet<CaseState> = new Set([
  CaseState.Closed,
  CaseState.Failed,
  CaseState.ManualInterventionRequired
]);

export class RiskCaseStateMachine {
  public transition(input: TransitionInput): Result<TransitionResult, DomainError> {
    if (TERMINAL_STATES.has(input.riskCase.state)) {
      return err(
        terminalStateTransitionError(
          input.riskCase.state,
          input.action,
          "No transition is allowed once case reaches terminal state"
        )
      );
    }

    const transitionRule = this.resolveTransitionRule(input.riskCase, input.action);
    if (!transitionRule) {
      return err(
        invalidStateTransitionError(
          input.riskCase.state,
          input.action,
          `No transition rule from ${input.riskCase.state} with action ${input.action}`
        )
      );
    }

    const guardResult = transitionRule.guard(input.riskCase, input.action, input.context);
    if (!guardResult.ok) {
      return guardResult;
    }

    const nextRiskCase = input.riskCase.transitionTo(transitionRule.nextState, input.context.transitionedAt);
    if (!nextRiskCase.ok) {
      return nextRiskCase;
    }

    const transitionEvent = createRiskCaseStateTransitionedDomainEvent({
      caseId: nextRiskCase.value.id,
      traceId: input.context.traceId,
      occurredAt: input.context.transitionedAt,
      payload: {
        caseType: nextRiskCase.value.caseType,
        fromState: input.riskCase.state,
        toState: nextRiskCase.value.state,
        fromStage: input.riskCase.stage,
        toStage: nextRiskCase.value.stage,
        action: input.action,
        reason: input.context.reason,
        triggeredBy: input.context.triggeredBy,
        configVersion: nextRiskCase.value.configVersion,
        transitionedAt: input.context.transitionedAt
      }
    });

    return ok({
      riskCase: nextRiskCase.value,
      action: input.action,
      context: input.context,
      before: {
        state: input.riskCase.state,
        stage: input.riskCase.stage,
        updatedAt: input.riskCase.updatedAt
      },
      after: {
        state: nextRiskCase.value.state,
        stage: nextRiskCase.value.stage,
        updatedAt: nextRiskCase.value.updatedAt
      },
      events: [transitionEvent]
    });
  }

  private resolveTransitionRule(
    riskCase: RiskCase,
    action: TransitionAction
  ): TransitionRule | undefined {
    const fromStateTransitions = transitionRules[riskCase.state];
    const mappedRule = fromStateTransitions?.[action];
    if (mappedRule) {
      return mappedRule;
    }
    return terminalTransitionRules[action];
  }
}
