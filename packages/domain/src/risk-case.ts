import type { ConfigVersion, RiskCaseId, Result, TraceId } from "@tianqi/shared";
import { err, ok } from "@tianqi/shared";

import { CaseStage } from "./case-stage.js";
import { CaseState } from "./case-state.js";
import { domainValidationError, stateStageMismatchError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";
import { resolveStageForState } from "./case-stage-mapping.js";
import { createRiskCaseCreatedDomainEvent } from "./risk-case-domain-event.js";
import type { RiskCaseDomainEvent } from "./risk-case-domain-event.js";
import type { RiskCaseType } from "./risk-case-type.js";

export type RiskCaseSnapshot = {
  readonly id: RiskCaseId;
  readonly caseType: RiskCaseType;
  readonly state: CaseState;
  readonly stage: CaseStage;
  readonly configVersion: ConfigVersion;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateRiskCaseInput = {
  readonly id: RiskCaseId;
  readonly caseType: RiskCaseType;
  readonly configVersion: ConfigVersion;
  readonly createdAt: Date;
  readonly traceId: TraceId;
};

export type RiskCaseCreateResult = {
  readonly riskCase: RiskCase;
  readonly events: readonly RiskCaseDomainEvent[];
};

type RiskCaseProps = RiskCaseSnapshot;

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const cloneDate = (value: Date): Date => new Date(value.getTime());

export class RiskCase {
  private readonly props: RiskCaseProps;

  private constructor(props: RiskCaseProps) {
    this.props = props;
  }

  public static create(input: CreateRiskCaseInput): Result<RiskCaseCreateResult, DomainError> {
    const createdAt = cloneDate(input.createdAt);
    const snapshot: RiskCaseSnapshot = {
      id: input.id,
      caseType: input.caseType,
      state: CaseState.Detected,
      stage: CaseStage.Detection,
      configVersion: input.configVersion,
      createdAt,
      updatedAt: cloneDate(createdAt)
    };
    const rehydrated = RiskCase.rehydrate(snapshot);
    if (!rehydrated.ok) {
      return rehydrated;
    }

    return ok({
      riskCase: rehydrated.value,
      events: [
        createRiskCaseCreatedDomainEvent({
          caseId: rehydrated.value.id,
          traceId: input.traceId,
          occurredAt: createdAt,
          payload: {
            caseType: rehydrated.value.caseType,
            initialState: rehydrated.value.state,
            initialStage: rehydrated.value.stage,
            configVersion: rehydrated.value.configVersion,
            createdAt: rehydrated.value.createdAt
          }
        })
      ]
    });
  }

  public static rehydrate(snapshot: RiskCaseSnapshot): Result<RiskCase, DomainError> {
    if (!isValidDate(snapshot.createdAt) || !isValidDate(snapshot.updatedAt)) {
      return err(
        domainValidationError("RiskCase timestamps must be valid Date objects", {
          createdAt: snapshot.createdAt.toString(),
          updatedAt: snapshot.updatedAt.toString()
        })
      );
    }

    if (snapshot.updatedAt.getTime() < snapshot.createdAt.getTime()) {
      return err(
        domainValidationError("RiskCase.updatedAt must be greater than or equal to createdAt", {
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString()
        })
      );
    }

    const expectedStage = resolveStageForState(snapshot.state);
    if (snapshot.stage !== expectedStage) {
      return err(stateStageMismatchError(snapshot.state, snapshot.stage));
    }

    return ok(
      new RiskCase({
        id: snapshot.id,
        caseType: snapshot.caseType,
        state: snapshot.state,
        stage: snapshot.stage,
        configVersion: snapshot.configVersion,
        createdAt: cloneDate(snapshot.createdAt),
        updatedAt: cloneDate(snapshot.updatedAt)
      })
    );
  }

  public transitionTo(nextState: CaseState, transitionedAt: Date): Result<RiskCase, DomainError> {
    if (!isValidDate(transitionedAt)) {
      return err(
        domainValidationError("transitionedAt must be a valid Date", {
          transitionedAt: transitionedAt.toString()
        })
      );
    }

    if (transitionedAt.getTime() < this.updatedAt.getTime()) {
      return err(
        domainValidationError("transitionedAt must not be older than current updatedAt", {
          currentUpdatedAt: this.updatedAt.toISOString(),
          transitionedAt: transitionedAt.toISOString()
        })
      );
    }

    return RiskCase.rehydrate({
      id: this.id,
      caseType: this.caseType,
      state: nextState,
      stage: resolveStageForState(nextState),
      configVersion: this.configVersion,
      createdAt: this.createdAt,
      updatedAt: cloneDate(transitionedAt)
    });
  }

  public get id(): RiskCaseId {
    return this.props.id;
  }

  public get caseType(): RiskCaseType {
    return this.props.caseType;
  }

  public get state(): CaseState {
    return this.props.state;
  }

  public get stage(): CaseStage {
    return this.props.stage;
  }

  public get configVersion(): ConfigVersion {
    return this.props.configVersion;
  }

  public get createdAt(): Date {
    return cloneDate(this.props.createdAt);
  }

  public get updatedAt(): Date {
    return cloneDate(this.props.updatedAt);
  }

  public toSnapshot(): RiskCaseSnapshot {
    return {
      id: this.id,
      caseType: this.caseType,
      state: this.state,
      stage: this.stage,
      configVersion: this.configVersion,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
