import type { ADLCaseId, ConfigVersion, Result, RiskCaseId, TraceId } from "@tianqi/shared";
import { err, ok } from "@tianqi/shared";

import { ADLCaseState } from "./adl-case-state.js";
import { domainValidationError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";

export type ADLCaseSnapshot = {
  readonly id: ADLCaseId;
  readonly sourceRiskCaseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly configVersion: ConfigVersion;
  readonly state: ADLCaseState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateADLCaseInput = {
  readonly id: ADLCaseId;
  readonly sourceRiskCaseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly configVersion: ConfigVersion;
  readonly createdAt: Date;
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const cloneDate = (value: Date): Date => new Date(value.getTime());

type ADLCaseProps = ADLCaseSnapshot;

export class ADLCase {
  private readonly props: ADLCaseProps;

  private constructor(props: ADLCaseProps) {
    this.props = props;
  }

  public static create(input: CreateADLCaseInput): Result<ADLCase, DomainError> {
    const createdAt = cloneDate(input.createdAt);
    return ADLCase.rehydrate({
      id: input.id,
      sourceRiskCaseId: input.sourceRiskCaseId,
      traceId: input.traceId,
      configVersion: input.configVersion,
      state: ADLCaseState.Initiated,
      createdAt,
      updatedAt: createdAt
    });
  }

  public static rehydrate(snapshot: ADLCaseSnapshot): Result<ADLCase, DomainError> {
    if (!isValidDate(snapshot.createdAt) || !isValidDate(snapshot.updatedAt)) {
      return err(
        domainValidationError("ADLCase timestamps must be valid Date objects", {
          createdAt: snapshot.createdAt.toString(),
          updatedAt: snapshot.updatedAt.toString()
        })
      );
    }

    if (snapshot.updatedAt.getTime() < snapshot.createdAt.getTime()) {
      return err(
        domainValidationError("ADLCase.updatedAt must be greater than or equal to createdAt", {
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString()
        })
      );
    }

    return ok(
      new ADLCase({
        id: snapshot.id,
        sourceRiskCaseId: snapshot.sourceRiskCaseId,
        traceId: snapshot.traceId,
        configVersion: snapshot.configVersion,
        state: snapshot.state,
        createdAt: cloneDate(snapshot.createdAt),
        updatedAt: cloneDate(snapshot.updatedAt)
      })
    );
  }

  public transitionTo(nextState: ADLCaseState, transitionedAt: Date): Result<ADLCase, DomainError> {
    if (!isValidDate(transitionedAt)) {
      return err(
        domainValidationError("ADLCase.transitionedAt must be a valid Date", {
          transitionedAt: transitionedAt.toString()
        })
      );
    }
    if (transitionedAt.getTime() < this.updatedAt.getTime()) {
      return err(
        domainValidationError("ADLCase.transitionedAt cannot be older than updatedAt", {
          currentUpdatedAt: this.updatedAt.toISOString(),
          transitionedAt: transitionedAt.toISOString()
        })
      );
    }
    return ADLCase.rehydrate({
      id: this.id,
      sourceRiskCaseId: this.sourceRiskCaseId,
      traceId: this.traceId,
      configVersion: this.configVersion,
      state: nextState,
      createdAt: this.createdAt,
      updatedAt: cloneDate(transitionedAt)
    });
  }

  public get id(): ADLCaseId {
    return this.props.id;
  }

  public get sourceRiskCaseId(): RiskCaseId {
    return this.props.sourceRiskCaseId;
  }

  public get traceId(): TraceId {
    return this.props.traceId;
  }

  public get configVersion(): ConfigVersion {
    return this.props.configVersion;
  }

  public get state(): ADLCaseState {
    return this.props.state;
  }

  public get createdAt(): Date {
    return cloneDate(this.props.createdAt);
  }

  public get updatedAt(): Date {
    return cloneDate(this.props.updatedAt);
  }

  public toSnapshot(): ADLCaseSnapshot {
    return {
      id: this.id,
      sourceRiskCaseId: this.sourceRiskCaseId,
      traceId: this.traceId,
      configVersion: this.configVersion,
      state: this.state,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}
