import { ERROR_CODES } from "@tianqi/contracts";
import type { ErrorCode } from "@tianqi/contracts";

export type DomainErrorCode = Extract<ErrorCode, `TQ-DOM-${string}`>;

export type DomainErrorContext = {
  readonly reason: string;
  readonly details?: Record<string, string>;
};

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly context: DomainErrorContext;

  public constructor(code: DomainErrorCode, message: string, context: DomainErrorContext) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.context = context;
  }
}

export const invalidStateTransitionError = (
  currentState: string,
  action: string,
  reason: string
): DomainError =>
  new DomainError(ERROR_CODES.INVALID_STATE_TRANSITION, "Invalid state transition", {
    reason,
    details: {
      currentState,
      action
    }
  });

export const domainValidationError = (
  reason: string,
  details?: Record<string, string>
): DomainError =>
  new DomainError(
    ERROR_CODES.DOMAIN_VALIDATION_FAILED,
    "Domain validation failed",
    details ? { reason, details } : { reason }
  );

export const transitionGuardRejectedError = (
  action: string,
  reason: string,
  details?: Record<string, string>
): DomainError =>
  new DomainError(ERROR_CODES.TRANSITION_GUARD_REJECTED, "Transition guard rejected", {
    reason,
    details: {
      action,
      ...details
    }
  });

export const stateStageMismatchError = (state: string, stage: string): DomainError =>
  new DomainError(ERROR_CODES.STATE_STAGE_MISMATCH, "State and stage mismatch", {
    reason: "RiskCase state and stage must stay aligned",
    details: {
      state,
      stage
    }
  });

export const terminalStateTransitionError = (
  currentState: string,
  action: string,
  reason: string
): DomainError =>
  new DomainError(
    ERROR_CODES.TERMINAL_STATE_TRANSITION_FORBIDDEN,
    "Transition forbidden on terminal state",
    {
      reason,
      details: {
        currentState,
        action
      }
    }
  );
