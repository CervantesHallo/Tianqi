import type { CoordinationMetricsSinkPort, CoordinationResultStorePort } from "@tianqi/ports";
import { createRiskCaseId } from "@tianqi/shared";

import {
  dependencyFailureError,
  invalidApplicationCommandError,
  resourceNotFoundError
} from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import type { ConfirmCoordinationResultRepairManuallyCommand } from "./confirm-coordination-result-repair-manually-command.js";
import type { CoordinationResultRepairCommandResult } from "./coordination-result-repair-command-result.js";
import type { CoordinationResultRepairRecordView } from "./coordination-result-repair-command-result.js";
import { CoordinationResultRepairRecordRegistry } from "./coordination-result-repair-record-registry.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import type { CoordinationResultReadObservation } from "./coordination-result-observation.js";
import { buildCoordinationResultObservation } from "./coordination-result-observation.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import { buildCoordinationResultFactKey, mapCoordinationResultViewToStoredRecord, mapStoredCoordinationResultToReadView } from "./coordination-result-persistence-mapper.js";
import { validateCoordinationResultReplayCompatibility } from "./coordination-result-replay-validation.js";
import type { CoordinationMetricsSinkStatus } from "./coordination-result-query-model.js";
import {
  canConfirmManuallyUnderStatus,
  canRetryUnderStatus,
  classifyRepairFailureStatus,
  invalidRepairStatusTransitionError
} from "./coordination-result-repair-status.js";
import type { CoordinationResultRepairStatus } from "./coordination-result-repair-status.js";
import type { RepairCoordinationResultReadViewCommand } from "./repair-coordination-result-read-view-command.js";
import type { RetryCoordinationResultRepairCommand } from "./retry-coordination-result-repair-command.js";
import { assertCoordinationResultViewsConsistent } from "./risk-case-coordination-result-read-view.js";

const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

type CoordinationResultRepairCommandHandlerDependencies = {
  readonly coordinationResultRegistry: CoordinationResultRegistry;
  readonly coordinationResultStore: CoordinationResultStorePort;
  readonly coordinationMetricsSink?: CoordinationMetricsSinkPort;
  readonly coordinationObservationRegistry?: CoordinationResultObservationRegistry;
  readonly repairRecordRegistry?: CoordinationResultRepairRecordRegistry;
};

type LocatedRepairFact = {
  readonly factKey: string;
  readonly source: CoordinationResultRepairRecordView["source"];
  readonly riskCaseId?: string;
  readonly subcaseType?: "LiquidationCase" | "ADLCase";
  readonly subcaseId?: string;
};

export class CoordinationResultRepairCommandHandler {
  private readonly coordinationResultRegistry: CoordinationResultRegistry;
  private readonly coordinationResultStore: CoordinationResultStorePort;
  private readonly coordinationMetricsSink: CoordinationMetricsSinkPort | undefined;
  private readonly coordinationObservationRegistry: CoordinationResultObservationRegistry;
  private readonly repairRecordRegistry: CoordinationResultRepairRecordRegistry;

  public constructor(dependencies: CoordinationResultRepairCommandHandlerDependencies) {
    this.coordinationResultRegistry = dependencies.coordinationResultRegistry;
    this.coordinationResultStore = dependencies.coordinationResultStore;
    this.coordinationMetricsSink = dependencies.coordinationMetricsSink;
    this.coordinationObservationRegistry =
      dependencies.coordinationObservationRegistry ?? new CoordinationResultObservationRegistry();
    this.repairRecordRegistry = dependencies.repairRecordRegistry ?? new CoordinationResultRepairRecordRegistry();
  }

  public getRepairRecordRegistry(): CoordinationResultRepairRecordRegistry {
    return this.repairRecordRegistry;
  }

  public async handle(command: RepairCoordinationResultReadViewCommand): Promise<CoordinationResultRepairCommandResult> {
    const located = this.locateFact(command);
    if (!located.ok) {
      const fallbackRecord = this.buildRecord({
        factKey: command.factKey ?? "unknown_fact",
        source: "registry_by_fact_key",
        outcome: "failed",
        commandType: "repair",
        persisted: false,
        reason: command.reason,
        happenedAt: command.repairedAt,
        triggeredBy: command.triggeredBy,
        status: "repair_failed_retryable",
        attempts: 1,
        manualConfirmation: false,
        lastErrorCode: located.error.code
      });
      return this.finalizeFailure(
        fallbackRecord,
        buildCoordinationResultObservation({
          scope: "repair",
          ...(command.factKey ? { factKey: command.factKey } : {}),
          repairAttempted: true,
          repairFailed: true
        }),
        located.error
      );
    }
    return this.executeRepairAttempt({
      located: located.value,
      reason: command.reason,
      happenedAt: command.repairedAt,
      triggeredBy: command.triggeredBy,
      commandType: "repair"
    });
  }

  public async handleRetry(command: RetryCoordinationResultRepairCommand): Promise<CoordinationResultRepairCommandResult> {
    const located = this.locateFactKeyOnly({
      factKey: command.factKey,
      timestamp: command.retriedAt,
      operation: "retry"
    });
    if (!located.ok) {
      const fallbackRecord = this.buildRecord({
        factKey: command.factKey,
        source: "registry_by_fact_key",
        outcome: "failed",
        commandType: "retry",
        persisted: false,
        reason: command.reason,
        happenedAt: command.retriedAt,
        triggeredBy: command.triggeredBy,
        status: "repair_failed_retryable",
        attempts: 1,
        manualConfirmation: false,
        lastErrorCode: located.error.code
      });
      return this.finalizeFailure(
        fallbackRecord,
        buildCoordinationResultObservation({
          scope: "repair",
          factKey: command.factKey,
          repairAttempted: true,
          repairFailed: true
        }),
        located.error
      );
    }

    const state = this.repairRecordRegistry.getRepairStateByFactKey(located.value.factKey);
    if (!canRetryUnderStatus(state.repairStatus)) {
      const error = invalidRepairStatusTransitionError({
        factKey: located.value.factKey,
        from: state.repairStatus,
        to: "repair_failed_retryable",
        reason: "retry blocked by non-retryable status"
      });
      const fallbackRecord = this.buildRecord({
        factKey: located.value.factKey,
        source: "registry_by_fact_key",
        outcome: "failed",
        commandType: "retry",
        persisted: false,
        reason: command.reason,
        happenedAt: command.retriedAt,
        triggeredBy: command.triggeredBy,
        status: state.repairStatus,
        attempts: state.repairAttempts,
        manualConfirmation: state.manualConfirmation,
        ...(state.lastErrorCode ? { lastErrorCode: state.lastErrorCode } : {})
      });
      return this.finalizeFailure(
        fallbackRecord,
        buildCoordinationResultObservation({
          scope: "repair",
          factKey: located.value.factKey,
          repairAttempted: true,
          repairFailed: true
        }),
        error
      );
    }

    return this.executeRepairAttempt({
      located: located.value,
      reason: command.reason,
      happenedAt: command.retriedAt,
      triggeredBy: command.triggeredBy,
      commandType: "retry"
    });
  }

  public async handleConfirmManually(
    command: ConfirmCoordinationResultRepairManuallyCommand
  ): Promise<CoordinationResultRepairCommandResult> {
    const located = this.locateFactKeyOnly({
      factKey: command.factKey,
      timestamp: command.confirmedAt,
      operation: "confirm_manual"
    });
    if (!located.ok) {
      const fallbackRecord = this.buildRecord({
        factKey: command.factKey,
        source: "registry_by_fact_key",
        outcome: "failed",
        commandType: "confirm_manual",
        persisted: false,
        reason: command.reason,
        happenedAt: command.confirmedAt,
        triggeredBy: command.triggeredBy,
        status: "repair_failed_retryable",
        attempts: 0,
        manualConfirmation: false,
        lastErrorCode: located.error.code
      });
      return this.finalizeFailure(
        fallbackRecord,
        buildCoordinationResultObservation({
          scope: "repair",
          factKey: command.factKey,
          repairFailed: true
        }),
        located.error
      );
    }

    const state = this.repairRecordRegistry.getRepairStateByFactKey(located.value.factKey);
    if (!canConfirmManuallyUnderStatus(state.repairStatus)) {
      const error = invalidRepairStatusTransitionError({
        factKey: located.value.factKey,
        from: state.repairStatus,
        to: "manually_confirmed",
        reason: "manual confirmation blocked by invalid current status"
      });
      const fallbackRecord = this.buildRecord({
        factKey: located.value.factKey,
        source: "registry_by_fact_key",
        outcome: "failed",
        commandType: "confirm_manual",
        persisted: false,
        reason: command.reason,
        happenedAt: command.confirmedAt,
        triggeredBy: command.triggeredBy,
        status: state.repairStatus,
        attempts: state.repairAttempts,
        manualConfirmation: state.manualConfirmation,
        ...(state.lastErrorCode ? { lastErrorCode: state.lastErrorCode } : {})
      });
      return this.finalizeFailure(
        fallbackRecord,
        buildCoordinationResultObservation({
          scope: "repair",
          factKey: located.value.factKey,
          repairFailed: true
        }),
        error
      );
    }

    const latest = this.repairRecordRegistry.getByFactKey(located.value.factKey);
    const transitioned = this.repairRecordRegistry.transitionRepairState({
      factKey: located.value.factKey,
      to: "manually_confirmed",
      outcome: "manually_confirmed",
      repairAttempts: state.repairAttempts,
      manualConfirmation: true,
      updatedAt: command.confirmedAt,
      ...(state.lastErrorCode ? { lastErrorCode: state.lastErrorCode } : {})
    });
    const record = this.buildRecord({
      factKey: located.value.factKey,
      source: latest?.source ?? "registry_by_fact_key",
      outcome: "manually_confirmed",
      commandType: "confirm_manual",
      persisted: latest?.persisted ?? false,
      reason: command.reason,
      happenedAt: command.confirmedAt,
      triggeredBy: command.triggeredBy,
      status: transitioned.repairStatus,
      attempts: transitioned.repairAttempts,
      manualConfirmation: true,
      ...(transitioned.lastErrorCode ? { lastErrorCode: transitioned.lastErrorCode } : {})
    });
    return this.finalizeSuccess(
      record,
      buildCoordinationResultObservation({
        scope: "repair",
        factKey: located.value.factKey
      })
    );
  }

  private async executeRepairAttempt(input: {
    readonly located: LocatedRepairFact;
    readonly reason: string;
    readonly happenedAt: string;
    readonly triggeredBy: string;
    readonly commandType: "repair" | "retry";
  }): Promise<CoordinationResultRepairCommandResult> {
    const state = this.repairRecordRegistry.getRepairStateByFactKey(input.located.factKey);
    const attempts = state.repairAttempts + 1;

    const sourceView = this.coordinationResultRegistry.getByFactKey(input.located.factKey);
    if (!sourceView) {
      const error = resourceNotFoundError("Repair source missing: coordination read-view not found in registry", {
        factKey: input.located.factKey
      });
      return this.failAttempt({
        located: input.located,
        reason: input.reason,
        happenedAt: input.happenedAt,
        triggeredBy: input.triggeredBy,
        commandType: input.commandType,
        persisted: false,
        attempts,
        observation: buildCoordinationResultObservation({
          scope: "repair",
          factKey: input.located.factKey,
          ...(input.located.riskCaseId ? { riskCaseId: input.located.riskCaseId } : {}),
          ...(input.located.subcaseType ? { subcaseType: input.located.subcaseType } : {}),
          ...(input.located.subcaseId ? { subcaseId: input.located.subcaseId } : {}),
          repairAttempted: true,
          repairFailed: true
        }),
        error
      });
    }

    const existingLookup = await this.coordinationResultStore.getByFactKey(input.located.factKey);
    if (!existingLookup.ok) {
      const error = dependencyFailureError("Failed to read persisted coordination result during repair/retry", {
        factKey: input.located.factKey,
        message: existingLookup.error.message
      });
      return this.failAttempt({
        located: input.located,
        reason: input.reason,
        happenedAt: input.happenedAt,
        triggeredBy: input.triggeredBy,
        commandType: input.commandType,
        persisted: false,
        attempts,
        observation: buildCoordinationResultObservation({
          scope: "repair",
          factKey: input.located.factKey,
          riskCaseId: sourceView.riskCaseId,
          subcaseType: sourceView.subcaseType,
          subcaseId: sourceView.subcaseId,
          repairAttempted: true,
          persistenceWriteFailed: true,
          repairFailed: true
        }),
        error
      });
    }

    if (existingLookup.value.status === "found") {
      const replayValidation = validateCoordinationResultReplayCompatibility({
        storedRecord: existingLookup.value.record,
        currentAuditSummary: sourceView.auditRecordSummary
      });
      if (!replayValidation.ok) {
        return this.failAttempt({
          located: input.located,
          reason: input.reason,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          commandType: input.commandType,
          persisted: true,
          attempts,
          observation: buildCoordinationResultObservation({
            scope: "repair",
            factKey: input.located.factKey,
            riskCaseId: sourceView.riskCaseId,
            subcaseType: sourceView.subcaseType,
            subcaseId: sourceView.subcaseId,
            storeReadHit: true,
            validationFailed: true,
            repairAttempted: true,
            repairFailed: true
          }),
          error: replayValidation.error
        });
      }
      const existingView = mapStoredCoordinationResultToReadView(existingLookup.value.record);
      const consistency = assertCoordinationResultViewsConsistent(existingView, sourceView);
      if (!consistency.ok) {
        return this.failAttempt({
          located: input.located,
          reason: input.reason,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          commandType: input.commandType,
          persisted: true,
          attempts,
          observation: buildCoordinationResultObservation({
            scope: "repair",
            factKey: input.located.factKey,
            riskCaseId: sourceView.riskCaseId,
            subcaseType: sourceView.subcaseType,
            subcaseId: sourceView.subcaseId,
            storeReadHit: true,
            validationFailed: true,
            repairAttempted: true,
            repairFailed: true
          }),
          error: invalidApplicationCommandError("Repair blocked: persisted result conflicts with repair source", {
            reason: consistency.reason,
            ...consistency.details
          })
        });
      }

      const transitioned = this.repairRecordRegistry.transitionRepairState({
        factKey: input.located.factKey,
        to: "repaired",
        outcome: "already_persisted",
        repairAttempts: attempts,
        manualConfirmation: false,
        updatedAt: input.happenedAt
      });
      const record = this.buildRecord({
        factKey: input.located.factKey,
        source: input.located.source,
        outcome: "already_persisted",
        commandType: input.commandType,
        persisted: true,
        reason: input.reason,
        happenedAt: input.happenedAt,
        triggeredBy: input.triggeredBy,
        status: transitioned.repairStatus,
        attempts: transitioned.repairAttempts,
        manualConfirmation: transitioned.manualConfirmation
      });
      return this.finalizeSuccess(
        record,
        buildCoordinationResultObservation({
          scope: "repair",
          factKey: input.located.factKey,
          riskCaseId: sourceView.riskCaseId,
          subcaseType: sourceView.subcaseType,
          subcaseId: sourceView.subcaseId,
          storeReadHit: true,
          validationPassed: true,
          repairAttempted: true,
          repairSucceeded: true
        })
      );
    }

    const persisted = await this.coordinationResultStore.put(mapCoordinationResultViewToStoredRecord(sourceView));
    if (!persisted.ok) {
      const error = dependencyFailureError("Repair write failed for coordination read-view persistence", {
        factKey: input.located.factKey,
        message: persisted.error.message
      });
      return this.failAttempt({
        located: input.located,
        reason: input.reason,
        happenedAt: input.happenedAt,
        triggeredBy: input.triggeredBy,
        commandType: input.commandType,
        persisted: false,
        attempts,
        observation: buildCoordinationResultObservation({
          scope: "repair",
          factKey: input.located.factKey,
          riskCaseId: sourceView.riskCaseId,
          subcaseType: sourceView.subcaseType,
          subcaseId: sourceView.subcaseId,
          repairAttempted: true,
          persistenceWriteFailed: true,
          repairFailed: true
        }),
        error
      });
    }

    const transitioned = this.repairRecordRegistry.transitionRepairState({
      factKey: input.located.factKey,
      to: "repaired",
      outcome: "repaired",
      repairAttempts: attempts,
      manualConfirmation: false,
      updatedAt: input.happenedAt
    });
    const record = this.buildRecord({
      factKey: input.located.factKey,
      source: input.located.source,
      outcome: "repaired",
      commandType: input.commandType,
      persisted: true,
      reason: input.reason,
      happenedAt: input.happenedAt,
      triggeredBy: input.triggeredBy,
      status: transitioned.repairStatus,
      attempts: transitioned.repairAttempts,
      manualConfirmation: transitioned.manualConfirmation
    });
    return this.finalizeSuccess(
      record,
      buildCoordinationResultObservation({
        scope: "repair",
        factKey: input.located.factKey,
        riskCaseId: sourceView.riskCaseId,
        subcaseType: sourceView.subcaseType,
        subcaseId: sourceView.subcaseId,
        repairAttempted: true,
        persistenceWriteSucceeded: true,
        repairSucceeded: true
      })
    );
  }

  private failAttempt(input: {
    readonly located: LocatedRepairFact;
    readonly reason: string;
    readonly happenedAt: string;
    readonly triggeredBy: string;
    readonly commandType: "repair" | "retry";
    readonly persisted: boolean;
    readonly attempts: number;
    readonly observation: CoordinationResultReadObservation;
    readonly error: ApplicationError;
  }): Promise<CoordinationResultRepairCommandResult> {
    const classified = classifyRepairFailureStatus(input.error);
    const transitioned = this.repairRecordRegistry.transitionRepairState({
      factKey: input.located.factKey,
      to: classified,
      outcome: "failed",
      repairAttempts: input.attempts,
      manualConfirmation: false,
      updatedAt: input.happenedAt,
      lastErrorCode: input.error.code
    });
    const record = this.buildRecord({
      factKey: input.located.factKey,
      source: input.located.source,
      outcome: "failed",
      commandType: input.commandType,
      persisted: input.persisted,
      reason: input.reason,
      happenedAt: input.happenedAt,
      triggeredBy: input.triggeredBy,
      status: transitioned.repairStatus,
      attempts: transitioned.repairAttempts,
      manualConfirmation: transitioned.manualConfirmation,
      lastErrorCode: input.error.code
    });
    return this.finalizeFailure(record, input.observation, input.error);
  }

  private locateFact(command: RepairCoordinationResultReadViewCommand):
    | { readonly ok: true; readonly value: LocatedRepairFact }
    | { readonly ok: false; readonly error: ApplicationError } {
    if (!ISO_8601_PATTERN.test(command.repairedAt)) {
      return {
        ok: false,
        error: invalidApplicationCommandError("Repair command repairedAt must be UTC ISO-8601 format", {
          repairedAt: command.repairedAt
        })
      };
    }
    if (command.factKey && command.factKey.trim().length > 0) {
      return {
        ok: true,
        value: {
          factKey: command.factKey,
          source: "registry_by_fact_key"
        }
      };
    }
    if (!command.riskCaseId || !command.subcaseType || !command.subcaseId || !command.occurredAt) {
      return {
        ok: false,
        error: invalidApplicationCommandError(
          "Repair command must provide factKey or complete composite locator (riskCaseId/subcaseType/subcaseId/occurredAt)"
        )
      };
    }
    if (!ISO_8601_PATTERN.test(command.occurredAt)) {
      return {
        ok: false,
        error: invalidApplicationCommandError("Repair command occurredAt must be UTC ISO-8601 format", {
          occurredAt: command.occurredAt
        })
      };
    }
    try {
      createRiskCaseId(command.riskCaseId);
    } catch (error) {
      return {
        ok: false,
        error: invalidApplicationCommandError("Repair command has invalid riskCaseId", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      };
    }
    return {
      ok: true,
      value: {
        factKey: buildCoordinationResultFactKey({
          riskCaseId: command.riskCaseId,
          subcaseType: command.subcaseType,
          subcaseId: command.subcaseId,
          occurredAt: command.occurredAt
        }),
        source: "registry_by_composite_key",
        riskCaseId: command.riskCaseId,
        subcaseType: command.subcaseType,
        subcaseId: command.subcaseId
      }
    };
  }

  private locateFactKeyOnly(input: {
    readonly factKey: string;
    readonly timestamp: string;
    readonly operation: "retry" | "confirm_manual";
  }):
    | { readonly ok: true; readonly value: LocatedRepairFact }
    | { readonly ok: false; readonly error: ApplicationError } {
    if (!ISO_8601_PATTERN.test(input.timestamp)) {
      return {
        ok: false,
        error: invalidApplicationCommandError(`${input.operation} command timestamp must be UTC ISO-8601 format`, {
          timestamp: input.timestamp
        })
      };
    }
    if (input.factKey.trim().length === 0) {
      return {
        ok: false,
        error: invalidApplicationCommandError(`${input.operation} command factKey must be non-empty`)
      };
    }
    return {
      ok: true,
      value: {
        factKey: input.factKey,
        source: "registry_by_fact_key"
      }
    };
  }

  private buildRecord(input: {
    readonly factKey: string;
    readonly source: CoordinationResultRepairRecordView["source"];
    readonly outcome: CoordinationResultRepairRecordView["outcome"];
    readonly commandType: CoordinationResultRepairRecordView["commandType"];
    readonly persisted: boolean;
    readonly reason: string;
    readonly happenedAt: string;
    readonly triggeredBy: string;
    readonly status: CoordinationResultRepairStatus;
    readonly attempts: number;
    readonly manualConfirmation: boolean;
    readonly lastErrorCode?: string;
  }): CoordinationResultRepairRecordView {
    return {
      factKey: input.factKey,
      outcome: input.outcome,
      commandType: input.commandType,
      source: input.source,
      persisted: input.persisted,
      repairStatus: input.status,
      repairAttempts: input.attempts,
      manualConfirmation: input.manualConfirmation,
      ...(input.lastErrorCode ? { lastErrorCode: input.lastErrorCode } : {}),
      reason: input.reason,
      repairedAt: input.happenedAt,
      triggeredBy: input.triggeredBy
    };
  }

  private async finalizeSuccess(
    record: CoordinationResultRepairRecordView,
    observation: CoordinationResultReadObservation
  ): Promise<CoordinationResultRepairCommandResult> {
    this.repairRecordRegistry.save(record);
    this.coordinationObservationRegistry.record(observation);
    const metricsSink = await this.emitObservation(observation);
    return {
      success: true,
      record,
      observation,
      metricsSink
    };
  }

  private async finalizeFailure(
    record: CoordinationResultRepairRecordView,
    observation: CoordinationResultReadObservation,
    error: ApplicationError
  ): Promise<CoordinationResultRepairCommandResult> {
    this.repairRecordRegistry.save(record);
    this.coordinationObservationRegistry.record(observation);
    const metricsSink = await this.emitObservation(observation);
    return {
      success: false,
      error,
      record,
      observation,
      metricsSink
    };
  }

  private async emitObservation(
    observation: CoordinationResultReadObservation
  ): Promise<CoordinationMetricsSinkStatus> {
    if (!this.coordinationMetricsSink) {
      return { status: "not_attempted" };
    }
    const sink = await this.coordinationMetricsSink.record(observation);
    if (!sink.ok) {
      return { status: "failed", errorSummary: sink.error.message };
    }
    return { status: "succeeded" };
  }
}
