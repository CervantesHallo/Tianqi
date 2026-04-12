import { RiskCase, RiskCaseStateMachine } from "@tianqi/domain";
import type { RiskCaseDomainEvent } from "@tianqi/domain";
import { createConfigVersion, createRiskCaseId, createTraceId, err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  CommandResultStorePort,
  DomainEventPublisherPort,
  IdempotencyPort,
  RiskCaseRepositoryPort
} from "@tianqi/ports";

import {
  dependencyFailureError,
  duplicateResultReferenceUnavailableError,
  fromContractError,
  fromDomainError,
  invalidApplicationCommandError,
  publishFailureError,
  resourceNotFoundError
} from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import { validateCommandResultSnapshotSchemaVersion } from "./command-result-snapshot-schema.js";
import { COMPENSATION_STATUSES } from "./compensation-state.js";
import type { CreateRiskCaseCommand } from "./create-risk-case-command.js";
import {
  toApplicationEventRecord,
  toApplicationRiskCaseView,
  toApplicationTransitionView
} from "./risk-case-command-assembler.js";
import type {
  ApplicationEventRecord,
  ApplicationProcessingStatus,
  CompensationMarker,
  CreateRiskCaseCommandResult,
  IdempotencyExecutionState,
  TransitionRiskCaseCommandResult
} from "./risk-case-command-result.js";
import { mapRiskCaseDomainEventToContractEnvelope } from "./risk-case-domain-event-mapper.js";
import type { RiskCaseContractEvent } from "./risk-case-domain-event-mapper.js";
import type { TransitionRiskCaseCommand } from "./transition-risk-case-command.js";

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

type RiskCaseCommandHandlerDependencies = {
  readonly riskCaseRepository: RiskCaseRepositoryPort;
  readonly idempotencyPort: IdempotencyPort;
  readonly domainEventPublisher: DomainEventPublisherPort;
  readonly commandResultStore: CommandResultStorePort;
  readonly stateMachine?: RiskCaseStateMachine;
  readonly eventMapper?: typeof mapRiskCaseDomainEventToContractEnvelope;
};

type MappedEvents = {
  readonly contractEvents: readonly RiskCaseContractEvent[];
  readonly applicationEvents: readonly ApplicationEventRecord[];
};

const parseIsoUtcDate = (
  value: string,
  fieldName: string
): Result<Date, ReturnType<typeof invalidApplicationCommandError>> => {
  if (!ISO_8601_PATTERN.test(value)) {
    return err(
      invalidApplicationCommandError("Command timestamp must use UTC ISO-8601 format", {
        fieldName,
        value
      })
    );
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return err(
      invalidApplicationCommandError("Command timestamp value is invalid", {
        fieldName,
        value
      })
    );
  }
  return ok(parsed);
};

const buildProcessingStatus = (input: {
  readonly persistence: ApplicationProcessingStatus["persistence"];
  readonly mapping: ApplicationProcessingStatus["mapping"];
  readonly publish: ApplicationProcessingStatus["publish"];
}): ApplicationProcessingStatus => {
  if (
    input.persistence === "succeeded" &&
    input.mapping === "succeeded" &&
    input.publish === "succeeded"
  ) {
    return {
      persistence: input.persistence,
      mapping: input.mapping,
      publish: input.publish,
      outcome: "completed"
    };
  }

  if (input.persistence === "succeeded") {
    return {
      persistence: input.persistence,
      mapping: input.mapping,
      publish: input.publish,
      outcome: "failed_after_persistence"
    };
  }

  return {
    persistence: input.persistence,
    mapping: input.mapping,
    publish: input.publish,
    outcome: "failed_before_persistence"
  };
};

export class RiskCaseCommandHandler {
  private readonly stateMachine: RiskCaseStateMachine;
  private readonly riskCaseRepository: RiskCaseRepositoryPort;
  private readonly idempotencyPort: IdempotencyPort;
  private readonly domainEventPublisher: DomainEventPublisherPort;
  private readonly commandResultStore: CommandResultStorePort;
  private readonly eventMapper: typeof mapRiskCaseDomainEventToContractEnvelope;

  public constructor(dependencies: RiskCaseCommandHandlerDependencies) {
    this.stateMachine = dependencies.stateMachine ?? new RiskCaseStateMachine();
    this.riskCaseRepository = dependencies.riskCaseRepository;
    this.idempotencyPort = dependencies.idempotencyPort;
    this.domainEventPublisher = dependencies.domainEventPublisher;
    this.commandResultStore = dependencies.commandResultStore;
    this.eventMapper = dependencies.eventMapper ?? mapRiskCaseDomainEventToContractEnvelope;
  }

  public async handleCreate(command: CreateRiskCaseCommand): Promise<CreateRiskCaseCommandResult> {
    const idempotency = await this.evaluateIdempotency(command.idempotencyKey, "CreateRiskCaseCommand");
    if (!idempotency.ok) {
      return this.failureWithIdempotency(
        {
          key: command.idempotencyKey,
          status: "not_enforced",
          reuse: "not_applicable"
        },
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        idempotency.error
      );
    }

    if (idempotency.value.status === "duplicate") {
      const duplicateResolution = await this.resolveDuplicateResult(
        idempotency.value,
        "CreateRiskCaseCommand"
      );
      if (duplicateResolution) {
        return duplicateResolution;
      }
    }

    const createdAt = parseIsoUtcDate(command.createdAt, "createdAt");
    if (!createdAt.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        createdAt.error
      );
    }

    let caseId;
    let traceId;
    let configVersion;
    try {
      caseId = createRiskCaseId(command.caseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        invalidApplicationCommandError("Create command contains invalid identifier fields", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const created = RiskCase.create({
      id: caseId,
      caseType: command.caseType,
      configVersion,
      createdAt: createdAt.value,
      traceId
    });
    if (!created.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        fromDomainError(created.error)
      );
    }

    const saveResult = await this.riskCaseRepository.save(created.value.riskCase);
    if (!saveResult.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "failed",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        dependencyFailureError("Failed to persist created RiskCase", {
          message: saveResult.error.message
        })
      );
    }

    const mappedEvents = this.mapDomainEvents(created.value.events);
    if (!mappedEvents.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "succeeded",
          mapping: "failed",
          publish: "not_attempted"
        }),
        mappedEvents.error
      );
    }

    const published = await this.publishContractEvents(mappedEvents.value.contractEvents);
    if (!published.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "succeeded",
          mapping: "succeeded",
          publish: "failed"
        }),
        published.error,
        this.buildCompensationMarker("CreateRiskCaseCommand", created.value.riskCase.id)
      );
    }

    return {
      success: true,
      idempotency: idempotency.value,
      processing: buildProcessingStatus({
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded"
      }),
      riskCase: toApplicationRiskCaseView(created.value.riskCase),
      events: mappedEvents.value.applicationEvents,
      compensation: this.buildNotRequiredCompensationMarker(
        "CreateRiskCaseCommand",
        created.value.riskCase.id
      )
    };
  }

  public async handleTransition(
    command: TransitionRiskCaseCommand
  ): Promise<TransitionRiskCaseCommandResult> {
    const idempotency = await this.evaluateIdempotency(
      command.idempotencyKey,
      "TransitionRiskCaseCommand"
    );
    if (!idempotency.ok) {
      return this.failureWithIdempotency(
        {
          key: command.idempotencyKey,
          status: "not_enforced",
          reuse: "not_applicable"
        },
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        idempotency.error
      );
    }

    if (idempotency.value.status === "duplicate") {
      const duplicateResolution = await this.resolveDuplicateResult(
        idempotency.value,
        "TransitionRiskCaseCommand"
      );
      if (duplicateResolution) {
        return duplicateResolution;
      }
    }

    const transitionedAt = parseIsoUtcDate(command.transitionedAt, "transitionedAt");
    if (!transitionedAt.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        transitionedAt.error
      );
    }

    let caseId;
    let traceId;
    let configVersion;
    try {
      caseId = createRiskCaseId(command.caseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        invalidApplicationCommandError("Transition command contains invalid identifier fields", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loaded = await this.riskCaseRepository.getById(caseId);
    if (!loaded.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        dependencyFailureError("Failed to load RiskCase for transition", {
          caseId,
          message: loaded.error.message
        })
      );
    }

    if (loaded.value === null) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        resourceNotFoundError("RiskCase not found for transition", {
          caseId
        })
      );
    }

    const transitioned = this.stateMachine.transition({
      riskCase: loaded.value,
      action: command.action,
      context: {
        traceId,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        configVersion,
        transitionedAt: transitionedAt.value
      }
    });
    if (!transitioned.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        fromDomainError(transitioned.error)
      );
    }

    const saveResult = await this.riskCaseRepository.save(transitioned.value.riskCase);
    if (!saveResult.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "failed",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        dependencyFailureError("Failed to persist transitioned RiskCase", {
          caseId,
          message: saveResult.error.message
        })
      );
    }

    const mappedEvents = this.mapDomainEvents(transitioned.value.events);
    if (!mappedEvents.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "succeeded",
          mapping: "failed",
          publish: "not_attempted"
        }),
        mappedEvents.error
      );
    }

    const published = await this.publishContractEvents(mappedEvents.value.contractEvents);
    if (!published.ok) {
      return this.failureWithIdempotency(
        idempotency.value,
        buildProcessingStatus({
          persistence: "succeeded",
          mapping: "succeeded",
          publish: "failed"
        }),
        published.error,
        this.buildCompensationMarker("TransitionRiskCaseCommand", transitioned.value.riskCase.id)
      );
    }

    return {
      success: true,
      idempotency: idempotency.value,
      processing: buildProcessingStatus({
        persistence: "succeeded",
        mapping: "succeeded",
        publish: "succeeded"
      }),
      riskCase: toApplicationRiskCaseView(transitioned.value.riskCase),
      events: mappedEvents.value.applicationEvents,
      transition: toApplicationTransitionView({
        before: transitioned.value.before,
        after: transitioned.value.after
      }),
      compensation: this.buildNotRequiredCompensationMarker(
        "TransitionRiskCaseCommand",
        transitioned.value.riskCase.id
      )
    };
  }

  private async resolveDuplicateResult(
    idempotency: IdempotencyExecutionState,
    commandName: string
  ): Promise<CreateRiskCaseCommandResult | TransitionRiskCaseCommandResult | null> {
    if (idempotency.reuse === "reference_unavailable" || !idempotency.resultReference) {
      return this.failureWithIdempotency(
        idempotency,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        duplicateResultReferenceUnavailableError(
          "Duplicate request has no reusable result reference in current phase",
          {
            command: commandName,
            key: idempotency.key
          }
        )
      );
    }

    const lookup = await this.commandResultStore.getByReference(idempotency.resultReference);
    if (!lookup.ok) {
      return this.failureWithIdempotency(
        idempotency,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        dependencyFailureError("Failed to resolve duplicate result reference", {
          command: commandName,
          reference: idempotency.resultReference,
          message: lookup.error.message
        })
      );
    }

    if (lookup.value.status === "missing") {
      return this.failureWithIdempotency(
        idempotency,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        duplicateResultReferenceUnavailableError("Duplicate result reference points to missing snapshot", {
          command: commandName,
          reference: idempotency.resultReference
        })
      );
    }

    const version = validateCommandResultSnapshotSchemaVersion(lookup.value.snapshot.schemaVersion);
    if (!version.ok) {
      return this.failureWithIdempotency(
        idempotency,
        buildProcessingStatus({
          persistence: "not_attempted",
          mapping: "not_attempted",
          publish: "not_attempted"
        }),
        version.error
      );
    }

    return {
      success: true as const,
      idempotency,
      processing: lookup.value.snapshot.processing,
      riskCase: lookup.value.snapshot.riskCase,
      events: lookup.value.snapshot.events,
      ...(lookup.value.snapshot.transition
        ? { transition: lookup.value.snapshot.transition }
        : {}),
      ...(lookup.value.snapshot.compensation
        ? { compensation: lookup.value.snapshot.compensation }
        : {
            compensation: this.buildNotRequiredCompensationMarker(
              lookup.value.snapshot.commandName,
              lookup.value.snapshot.riskCase.caseId,
              lookup.value.snapshot.reference
            )
          })
    };
  }

  private async evaluateIdempotency(
    key: IdempotencyExecutionState["key"],
    commandName: string
  ): Promise<Result<IdempotencyExecutionState, ApplicationError>> {
    const reserved = await this.idempotencyPort.reserve(commandName, key);
    if (!reserved.ok) {
      return err(
        dependencyFailureError("Failed to reserve idempotency key", {
          commandName,
          key,
          message: reserved.error.message
        })
      );
    }

    if (reserved.value.status === "duplicate") {
      if (reserved.value.resultReference) {
        return ok({
          key,
          status: "duplicate",
          reuse: "reference_available",
          resultReference: reserved.value.resultReference
        });
      }
      return ok({
        key,
        status: "duplicate",
        reuse: "reference_unavailable"
      });
    }

    if (reserved.value.status === "not_enforced") {
      return ok({
        key,
        status: "not_enforced",
        reuse: "not_applicable"
      });
    }

    return ok({
      key,
      status: "accepted",
      reuse: "not_applicable"
    });
  }

  private mapDomainEvents(
    domainEvents: readonly RiskCaseDomainEvent[]
  ): Result<MappedEvents, ApplicationError> {
    const contractEvents: RiskCaseContractEvent[] = [];
    const applicationEvents: ApplicationEventRecord[] = [];
    for (const domainEvent of domainEvents) {
      const mapped = this.eventMapper(domainEvent);
      if (!mapped.ok) {
        return err(fromContractError(mapped.error));
      }
      contractEvents.push(mapped.value);
      applicationEvents.push(toApplicationEventRecord(mapped.value));
    }
    return ok({
      contractEvents,
      applicationEvents
    });
  }

  private async publishContractEvents(
    events: readonly RiskCaseContractEvent[]
  ): Promise<Result<void, ApplicationError>> {
    for (const event of events) {
      const published = await this.domainEventPublisher.publish(event);
      if (!published.ok) {
        return err(
          publishFailureError("Failed to publish mapped domain event", {
            eventType: event.eventType,
            eventId: event.eventId,
            message: published.error.message
          })
        );
      }
    }
    return ok(undefined);
  }

  private buildCompensationMarker(
    commandName: string,
    caseId: string
  ): CompensationMarker {
    return {
      required: true,
      reason: "publish_failed",
      status: COMPENSATION_STATUSES.Pending,
      commandName,
      caseId
    };
  }

  private buildNotRequiredCompensationMarker(
    commandName: string,
    caseId: string,
    resultReference?: IdempotencyExecutionState["resultReference"]
  ): CompensationMarker {
    return resultReference
      ? {
          required: false,
          reason: "not_required",
          status: COMPENSATION_STATUSES.NotRequired,
          commandName,
          caseId,
          resultReference
        }
      : {
          required: false,
          reason: "not_required",
          status: COMPENSATION_STATUSES.NotRequired,
          commandName,
          caseId
        };
  }

  private failureWithIdempotency(
    idempotency: IdempotencyExecutionState,
    processing: ApplicationProcessingStatus,
    error: ApplicationError,
    compensation?: CompensationMarker
  ): {
    readonly success: false;
    readonly idempotency: IdempotencyExecutionState;
    readonly processing: ApplicationProcessingStatus;
    readonly events: readonly [];
    readonly error: ApplicationError;
    readonly compensation?: CompensationMarker;
  } {
    return compensation
      ? {
          success: false,
          idempotency,
          processing,
          events: [],
          error,
          compensation
        }
      : {
          success: false,
          idempotency,
          processing,
          events: [],
          error
        };
  }
}
