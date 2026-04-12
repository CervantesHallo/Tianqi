import type {
  ConfigVersion,
  LiquidationCaseId,
  Result,
  RiskCaseId,
  TraceId
} from "@tianqi/shared";
import { err, ok } from "@tianqi/shared";

import { domainValidationError } from "./domain-error.js";
import type { DomainError } from "./domain-error.js";
import { LiquidationCaseState } from "./liquidation-case-state.js";

export type LiquidationCaseSnapshot = {
  readonly id: LiquidationCaseId;
  readonly sourceRiskCaseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly configVersion: ConfigVersion;
  readonly state: LiquidationCaseState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type CreateLiquidationCaseInput = {
  readonly id: LiquidationCaseId;
  readonly sourceRiskCaseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly configVersion: ConfigVersion;
  readonly createdAt: Date;
};

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const cloneDate = (value: Date): Date => new Date(value.getTime());

type LiquidationCaseProps = LiquidationCaseSnapshot;

export class LiquidationCase {
  private readonly props: LiquidationCaseProps;

  private constructor(props: LiquidationCaseProps) {
    this.props = props;
  }

  public static create(input: CreateLiquidationCaseInput): Result<LiquidationCase, DomainError> {
    const createdAt = cloneDate(input.createdAt);
    return LiquidationCase.rehydrate({
      id: input.id,
      sourceRiskCaseId: input.sourceRiskCaseId,
      traceId: input.traceId,
      configVersion: input.configVersion,
      state: LiquidationCaseState.Initiated,
      createdAt,
      updatedAt: createdAt
    });
  }

  public static rehydrate(snapshot: LiquidationCaseSnapshot): Result<LiquidationCase, DomainError> {
    if (!isValidDate(snapshot.createdAt) || !isValidDate(snapshot.updatedAt)) {
      return err(
        domainValidationError("LiquidationCase timestamps must be valid Date objects", {
          createdAt: snapshot.createdAt.toString(),
          updatedAt: snapshot.updatedAt.toString()
        })
      );
    }

    if (snapshot.updatedAt.getTime() < snapshot.createdAt.getTime()) {
      return err(
        domainValidationError("LiquidationCase.updatedAt must be greater than or equal to createdAt", {
          createdAt: snapshot.createdAt.toISOString(),
          updatedAt: snapshot.updatedAt.toISOString()
        })
      );
    }

    return ok(
      new LiquidationCase({
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

  public transitionTo(
    nextState: LiquidationCaseState,
    transitionedAt: Date
  ): Result<LiquidationCase, DomainError> {
    if (!isValidDate(transitionedAt)) {
      return err(
        domainValidationError("LiquidationCase.transitionedAt must be a valid Date", {
          transitionedAt: transitionedAt.toString()
        })
      );
    }
    if (transitionedAt.getTime() < this.updatedAt.getTime()) {
      return err(
        domainValidationError("LiquidationCase.transitionedAt cannot be older than updatedAt", {
          currentUpdatedAt: this.updatedAt.toISOString(),
          transitionedAt: transitionedAt.toISOString()
        })
      );
    }
    return LiquidationCase.rehydrate({
      id: this.id,
      sourceRiskCaseId: this.sourceRiskCaseId,
      traceId: this.traceId,
      configVersion: this.configVersion,
      state: nextState,
      createdAt: this.createdAt,
      updatedAt: cloneDate(transitionedAt)
    });
  }

  public get id(): LiquidationCaseId {
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

  public get state(): LiquidationCaseState {
    return this.props.state;
  }

  public get createdAt(): Date {
    return cloneDate(this.props.createdAt);
  }

  public get updatedAt(): Date {
    return cloneDate(this.props.updatedAt);
  }

  public toSnapshot(): LiquidationCaseSnapshot {
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
