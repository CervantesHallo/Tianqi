import type {
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionRepairCommandType,
  DiagnosticAlertSuppressionStorePort,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import {
  dependencyFailureError,
  invalidApplicationCommandError
} from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import type {
  DiagnosticAlertSuppressionStateRepairCommandResult
} from "./diagnostic-alert-suppression-state-repair-command-result.js";
import {
  evaluateDiagnosticAlertSuppressionStateReadCompatibility
} from "./diagnostic-alert-suppression-state-read-compatibility.js";
import {
  readDiagnosticAlertSuppressionStateWithCompatibility,
  repairDiagnosticAlertSuppressionState
} from "./coordination-diagnostic-alert-suppression-state-repair.js";
import type { ConfirmDiagnosticAlertSuppressionStateRepairManuallyCommand } from "./confirm-diagnostic-alert-suppression-state-repair-manually-command.js";
import {
  canConfirmSuppressionStateRepairManuallyUnderStatus,
  canRetrySuppressionStateRepairUnderStatus,
  invalidSuppressionStateRepairStatusTransitionError
} from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import type {
  DiagnosticAlertSuppressionStateRepairLifecycleState,
  DiagnosticAlertSuppressionStateRepairStatus
} from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import { DiagnosticAlertSuppressionStateRepairLifecycleRegistry } from "./diagnostic-alert-suppression-state-repair-lifecycle-registry.js";
import {
  persistSuppressionRepairLifecycleSlot,
  readSuppressionRepairLifecycleWithContinuity
} from "./coordination-diagnostic-alert-suppression-repair-lifecycle-slot.js";
import {
  buildDiagnosticAlertSuppressionRepairCommandRecord,
  persistDiagnosticAlertSuppressionRepairCommandRecord
} from "./diagnostic-alert-suppression-repair-command-record.js";
import type { RepairDiagnosticAlertSuppressionStateCommand } from "./repair-diagnostic-alert-suppression-state-command.js";
import type { RetryDiagnosticAlertSuppressionStateRepairCommand } from "./retry-diagnostic-alert-suppression-state-repair-command.js";

type DiagnosticAlertSuppressionStateRepairCommandHandlerDependencies = {
  readonly alertSuppressionStore: DiagnosticAlertSuppressionStorePort;
  readonly repairLifecycleRegistry?: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  readonly repairLifecycleStore?: DiagnosticAlertSuppressionStateRepairLifecycleStorePort;
  readonly repairCommandRecordStore?: DiagnosticAlertSuppressionRepairCommandRecordStorePort;
};

export class DiagnosticAlertSuppressionStateRepairCommandHandler {
  private readonly alertSuppressionStore: DiagnosticAlertSuppressionStorePort;
  private readonly repairLifecycleRegistry: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  private readonly repairLifecycleStore: DiagnosticAlertSuppressionStateRepairLifecycleStorePort | undefined;
  private readonly repairCommandRecordStore: DiagnosticAlertSuppressionRepairCommandRecordStorePort | undefined;

  public constructor(dependencies: DiagnosticAlertSuppressionStateRepairCommandHandlerDependencies) {
    this.alertSuppressionStore = dependencies.alertSuppressionStore;
    this.repairLifecycleRegistry =
      dependencies.repairLifecycleRegistry ?? new DiagnosticAlertSuppressionStateRepairLifecycleRegistry();
    this.repairLifecycleStore = dependencies.repairLifecycleStore;
    this.repairCommandRecordStore = dependencies.repairCommandRecordStore;
  }

  public getRepairLifecycleRegistry(): DiagnosticAlertSuppressionStateRepairLifecycleRegistry {
    return this.repairLifecycleRegistry;
  }

  public async handle(
    command: RepairDiagnosticAlertSuppressionStateCommand
  ): Promise<DiagnosticAlertSuppressionStateRepairCommandResult> {
    if (command.suppressionKey.trim().length === 0) {
      return {
        success: false,
        error: invalidApplicationCommandError("RepairDiagnosticAlertSuppressionStateCommand.suppressionKey must be non-empty"),
        record: this.toRecord({
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.repairedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: false,
          repairRecommended: true,
          lifecycle: this.repairLifecycleRegistry.getBySuppressionKey(command.suppressionKey)
        })
      };
    }
    await this.syncLifecycleFromPersistence(command.suppressionKey);
    return this.executeRepairAttempt({
      commandType: "repair",
      suppressionKey: command.suppressionKey,
      reason: command.reason,
      happenedAt: command.repairedAt,
      triggeredBy: command.triggeredBy
    });
  }

  public async handleRetry(
    command: RetryDiagnosticAlertSuppressionStateRepairCommand
  ): Promise<DiagnosticAlertSuppressionStateRepairCommandResult> {
    if (command.suppressionKey.trim().length === 0) {
      return {
        success: false,
        error: invalidApplicationCommandError(
          "RetryDiagnosticAlertSuppressionStateRepairCommand.suppressionKey must be non-empty"
        ),
        record: this.toRecord({
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.retriedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: false,
          repairRecommended: true,
          lifecycle: this.repairLifecycleRegistry.getBySuppressionKey(command.suppressionKey)
        })
      };
    }
    await this.syncLifecycleFromPersistence(command.suppressionKey);
    const state = this.repairLifecycleRegistry.getBySuppressionKey(command.suppressionKey);
    if (!canRetrySuppressionStateRepairUnderStatus(state.repairStatus)) {
      return {
        success: false,
        error: invalidSuppressionStateRepairStatusTransitionError({
          suppressionKey: command.suppressionKey,
          from: state.repairStatus,
          to: "repair_failed_retryable",
          reason: "retry blocked by non-retryable status"
        }),
        record: this.toRecord({
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.retriedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: true,
          repairRecommended: true,
          lifecycle: state
        })
      };
    }
    return this.executeRepairAttempt({
      commandType: "retry",
      suppressionKey: command.suppressionKey,
      reason: command.reason,
      happenedAt: command.retriedAt,
      triggeredBy: command.triggeredBy
    });
  }

  public async handleConfirmManually(
    command: ConfirmDiagnosticAlertSuppressionStateRepairManuallyCommand
  ): Promise<DiagnosticAlertSuppressionStateRepairCommandResult> {
    if (command.suppressionKey.trim().length === 0) {
      return {
        success: false,
        error: invalidApplicationCommandError(
          "ConfirmDiagnosticAlertSuppressionStateRepairManuallyCommand.suppressionKey must be non-empty"
        ),
        record: this.toRecord({
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.confirmedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: false,
          repairRecommended: true,
          lifecycle: this.repairLifecycleRegistry.getBySuppressionKey(command.suppressionKey)
        })
      };
    }

    await this.syncLifecycleFromPersistence(command.suppressionKey);
    const state = this.repairLifecycleRegistry.getBySuppressionKey(command.suppressionKey);
    if (!canConfirmSuppressionStateRepairManuallyUnderStatus(state.repairStatus)) {
      return {
        success: false,
        error: invalidSuppressionStateRepairStatusTransitionError({
          suppressionKey: command.suppressionKey,
          from: state.repairStatus,
          to: "manually_confirmed",
          reason: "manual confirmation blocked by invalid current status"
        }),
        record: this.toRecord({
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.confirmedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: true,
          repairRecommended: true,
          lifecycle: state
        })
      };
    }
    const transitioned = await this.transitionAndPersist({
      commandType: "confirm",
      triggeredBy: command.triggeredBy,
      suppressionKey: command.suppressionKey,
      to: "manually_confirmed",
      outcome: "manually_confirmed",
      attempts: state.repairAttempts,
      manualConfirmation: true,
      reason: command.reason,
      attemptedAt: command.confirmedAt,
      updatedAt: command.confirmedAt,
      schemaVersionBefore: state.schemaVersionBefore,
      schemaVersionAfter: state.schemaVersionAfter
    });
    if (!transitioned.ok) {
      return {
        success: false,
        error: transitioned.error,
        record: this.toRecord({
          commandType: "confirm",
          suppressionKey: command.suppressionKey,
          outcome: "failed",
          reason: command.reason,
          happenedAt: command.confirmedAt,
          triggeredBy: command.triggeredBy,
          compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
          repairAvailable: true,
          repairRecommended: true,
          lifecycle: state
        })
      };
    }
    return {
      success: true,
      record: this.toRecord({
        ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
        commandType: "confirm",
        suppressionKey: command.suppressionKey,
        outcome: "manually_confirmed",
        reason: command.reason,
        happenedAt: command.confirmedAt,
        triggeredBy: command.triggeredBy,
        compatibilityBefore: evaluateDiagnosticAlertSuppressionStateReadCompatibility({}),
        repairAvailable: true,
        repairRecommended: false,
        lifecycle: transitioned.value
      })
    };
  }

  private classifyFailureStatus(input: {
    readonly compatibilityStatus: string;
    readonly reason: string;
  }): DiagnosticAlertSuppressionStateRepairStatus {
    if (
      input.compatibilityStatus === "incompatible_version" ||
      input.reason.includes("conflicts") ||
      input.reason.includes("Critical suppression fields")
    ) {
      return "repair_failed_manual_confirmation_required";
    }
    return "repair_failed_retryable";
  }

  private async executeRepairAttempt(input: {
    readonly commandType: "repair" | "retry";
    readonly suppressionKey: string;
    readonly reason: string;
    readonly happenedAt: string;
    readonly triggeredBy: string;
  }): Promise<DiagnosticAlertSuppressionStateRepairCommandResult> {
    await this.syncLifecycleFromPersistence(input.suppressionKey);
    const read = await readDiagnosticAlertSuppressionStateWithCompatibility({
      suppressionKey: input.suppressionKey,
      store: this.alertSuppressionStore
    });
    if (read.readStatus === "read_failed") {
      const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
      const transitioned = await this.transitionAndPersist({
        commandType: input.commandType,
        triggeredBy: input.triggeredBy,
        suppressionKey: input.suppressionKey,
        to: "repair_failed_retryable",
        outcome: "failed",
        attempts: current.repairAttempts + 1,
        manualConfirmation: current.manualConfirmation,
        reason: read.compatibility.reason,
        attemptedAt: input.happenedAt,
        updatedAt: input.happenedAt
      });
      if (!transitioned.ok) {
        return {
          success: false,
          error: transitioned.error,
          record: this.toRecord({
            commandType: input.commandType,
            suppressionKey: input.suppressionKey,
            outcome: "failed",
            reason: `${input.reason}; ${read.compatibility.reason}`,
            happenedAt: input.happenedAt,
            triggeredBy: input.triggeredBy,
            compatibilityBefore: read.compatibility,
            repairAvailable: read.repairEvaluation.repairAvailable,
            repairRecommended: read.repairEvaluation.repairRecommended,
            lifecycle: current
          })
        };
      }
      return {
        success: false,
        error: dependencyFailureError("Failed to read suppression persisted state before repair/retry", {
          suppressionKey: input.suppressionKey
        }),
        record: this.toRecord({
          ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; ${read.compatibility.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: transitioned.value
        })
      };
    }

    if (!read.state) {
      const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
      const transitioned = await this.transitionAndPersist({
        commandType: input.commandType,
        triggeredBy: input.triggeredBy,
        suppressionKey: input.suppressionKey,
        to: "repair_failed_retryable",
        outcome: "failed",
        attempts: current.repairAttempts + 1,
        manualConfirmation: current.manualConfirmation,
        reason: read.compatibility.reason,
        attemptedAt: input.happenedAt,
        updatedAt: input.happenedAt
      });
      if (!transitioned.ok) {
        return {
          success: false,
          error: transitioned.error,
          record: this.toRecord({
            commandType: input.commandType,
            suppressionKey: input.suppressionKey,
            outcome: "failed",
            reason: `${input.reason}; ${read.compatibility.reason}`,
            happenedAt: input.happenedAt,
            triggeredBy: input.triggeredBy,
            compatibilityBefore: read.compatibility,
            repairAvailable: read.repairEvaluation.repairAvailable,
            repairRecommended: read.repairEvaluation.repairRecommended,
            lifecycle: current
          })
        };
      }
      return {
        success: false,
        error: invalidApplicationCommandError("Suppression persisted state not found for repair/retry", {
          suppressionKey: input.suppressionKey
        }),
        record: this.toRecord({
          ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; ${read.compatibility.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: transitioned.value
        })
      };
    }

    const repaired = repairDiagnosticAlertSuppressionState({
      suppressionKey: input.suppressionKey,
      state: read.state,
      repairedAt: input.happenedAt
    });
    if (repaired.status === "failed") {
      const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
      const transitioned = await this.transitionAndPersist({
        commandType: input.commandType,
        triggeredBy: input.triggeredBy,
        suppressionKey: input.suppressionKey,
        to: this.classifyFailureStatus({
          compatibilityStatus: read.compatibility.status,
          reason: repaired.reason
        }),
        outcome: "failed",
        attempts: current.repairAttempts + 1,
        manualConfirmation: current.manualConfirmation,
        reason: repaired.reason,
        attemptedAt: input.happenedAt,
        updatedAt: input.happenedAt
      });
      if (!transitioned.ok) {
        return {
          success: false,
          error: transitioned.error,
          record: this.toRecord({
            commandType: input.commandType,
            suppressionKey: input.suppressionKey,
            outcome: "failed",
            reason: `${input.reason}; ${repaired.reason}`,
            happenedAt: input.happenedAt,
            triggeredBy: input.triggeredBy,
            compatibilityBefore: read.compatibility,
            repairAvailable: read.repairEvaluation.repairAvailable,
            repairRecommended: read.repairEvaluation.repairRecommended,
            lifecycle: current
          })
        };
      }
      return {
        success: false,
        error: invalidApplicationCommandError("Suppression persisted state repair/retry failed", {
          suppressionKey: input.suppressionKey
        }),
        record: this.toRecord({
          ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; ${repaired.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: transitioned.value
        })
      };
    }

    if (repaired.status === "noop") {
      const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
      const transitioned = await this.transitionAndPersist({
        commandType: input.commandType,
        triggeredBy: input.triggeredBy,
        suppressionKey: input.suppressionKey,
        to: "repaired",
        outcome: "noop",
        attempts: current.repairAttempts + 1,
        manualConfirmation: current.manualConfirmation,
        reason: repaired.reason,
        attemptedAt: input.happenedAt,
        repairedAt: input.happenedAt,
        schemaVersionBefore: read.state.schemaVersion,
        schemaVersionAfter: read.state.schemaVersion,
        updatedAt: input.happenedAt
      });
      if (!transitioned.ok) {
        return {
          success: false,
          error: transitioned.error,
          record: this.toRecord({
            commandType: input.commandType,
            suppressionKey: input.suppressionKey,
            outcome: "failed",
            reason: `${input.reason}; ${repaired.reason}`,
            happenedAt: input.happenedAt,
            triggeredBy: input.triggeredBy,
            compatibilityBefore: read.compatibility,
            repairAvailable: read.repairEvaluation.repairAvailable,
            repairRecommended: read.repairEvaluation.repairRecommended,
            lifecycle: current
          })
        };
      }
      return {
        success: true,
        record: this.toRecord({
          ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "noop",
          reason: `${input.reason}; ${repaired.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          compatibilityAfter: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: transitioned.value
        })
      };
    }

    if (!repaired.repairedState) {
      return {
        success: false,
        error: invalidApplicationCommandError("Suppression persisted state repair missing repairedState payload", {
          suppressionKey: input.suppressionKey
        }),
        record: this.toRecord({
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; repaired state payload missing`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey)
        })
      };
    }

    const stored = await this.alertSuppressionStore.put(repaired.repairedState);
    if (!stored.ok) {
      const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
      const transitioned = await this.transitionAndPersist({
        commandType: input.commandType,
        triggeredBy: input.triggeredBy,
        suppressionKey: input.suppressionKey,
        to: "repair_failed_retryable",
        outcome: "failed",
        attempts: current.repairAttempts + 1,
        manualConfirmation: current.manualConfirmation,
        reason: stored.error.message,
        attemptedAt: input.happenedAt,
        updatedAt: input.happenedAt
      });
      if (!transitioned.ok) {
        return {
          success: false,
          error: transitioned.error,
          record: this.toRecord({
            commandType: input.commandType,
            suppressionKey: input.suppressionKey,
            outcome: "failed",
            reason: `${input.reason}; ${repaired.reason}`,
            happenedAt: input.happenedAt,
            triggeredBy: input.triggeredBy,
            compatibilityBefore: read.compatibility,
            repairAvailable: read.repairEvaluation.repairAvailable,
            repairRecommended: read.repairEvaluation.repairRecommended,
            lifecycle: current
          })
        };
      }
      return {
        success: false,
        error: dependencyFailureError("Failed to persist repaired suppression state", {
          suppressionKey: input.suppressionKey,
          message: stored.error.message
        }),
        record: this.toRecord({
          ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; ${repaired.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: transitioned.value
        })
      };
    }

    const current = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
    const transitioned = await this.transitionAndPersist({
      commandType: input.commandType,
      triggeredBy: input.triggeredBy,
      suppressionKey: input.suppressionKey,
      to: "repaired",
      outcome: "repaired",
      attempts: current.repairAttempts + 1,
      manualConfirmation: current.manualConfirmation,
      reason: repaired.reason,
      attemptedAt: input.happenedAt,
      repairedAt: input.happenedAt,
      schemaVersionBefore: read.state.schemaVersion,
      schemaVersionAfter: repaired.repairedState.schemaVersion,
      updatedAt: input.happenedAt
    });
    if (!transitioned.ok) {
      return {
        success: false,
        error: transitioned.error,
        record: this.toRecord({
          commandType: input.commandType,
          suppressionKey: input.suppressionKey,
          outcome: "failed",
          reason: `${input.reason}; ${repaired.reason}`,
          happenedAt: input.happenedAt,
          triggeredBy: input.triggeredBy,
          compatibilityBefore: read.compatibility,
          repairAvailable: read.repairEvaluation.repairAvailable,
          repairRecommended: read.repairEvaluation.repairRecommended,
          lifecycle: current
        })
      };
    }
    const compatibilityAfter = evaluateDiagnosticAlertSuppressionStateReadCompatibility({
      state: repaired.repairedState
    });
    return {
      success: true,
      record: this.toRecord({
        ...(transitioned.value.commandRecordId ? { commandRecordId: transitioned.value.commandRecordId } : {}),
        commandType: input.commandType,
        suppressionKey: input.suppressionKey,
        outcome: "repaired",
        reason: `${input.reason}; ${repaired.reason}`,
        happenedAt: input.happenedAt,
        triggeredBy: input.triggeredBy,
        compatibilityBefore: read.compatibility,
        compatibilityAfter,
        repairAvailable: read.repairEvaluation.repairAvailable,
        repairRecommended: read.repairEvaluation.repairRecommended,
        repairedSchemaVersion: repaired.repairedSchemaVersion,
        lifecycle: transitioned.value
      })
    };
  }

  private async syncLifecycleFromPersistence(suppressionKey: string): Promise<void> {
    const loaded = await readSuppressionRepairLifecycleWithContinuity({
      suppressionKey,
      registry: this.repairLifecycleRegistry,
      ...(this.repairLifecycleStore ? { store: this.repairLifecycleStore } : {})
    });
    this.repairLifecycleRegistry.setState(loaded.lifecycle);
  }

  private async transitionAndPersist(input: {
    readonly commandType: DiagnosticAlertSuppressionRepairCommandType;
    readonly triggeredBy: string;
    readonly suppressionKey: string;
    readonly to: DiagnosticAlertSuppressionStateRepairStatus;
    readonly outcome: DiagnosticAlertSuppressionStateRepairLifecycleState["lastRepairOutcome"];
    readonly attempts: number;
    readonly manualConfirmation: boolean;
    readonly reason?: string | undefined;
    readonly attemptedAt?: string | undefined;
    readonly repairedAt?: string | undefined;
    readonly schemaVersionBefore?: string | undefined;
    readonly schemaVersionAfter?: string | undefined;
    readonly updatedAt: string;
  }): Promise<Result<DiagnosticAlertSuppressionStateRepairLifecycleState & { readonly commandRecordId?: string }, ApplicationError>> {
    const previous = this.repairLifecycleRegistry.getBySuppressionKey(input.suppressionKey);
    const transitioned = this.repairLifecycleRegistry.transition({
      suppressionKey: input.suppressionKey,
      to: input.to,
      outcome: input.outcome ?? "failed",
      attempts: input.attempts,
      manualConfirmation: input.manualConfirmation,
      ...(input.reason ? { reason: input.reason } : {}),
      ...(input.attemptedAt ? { attemptedAt: input.attemptedAt } : {}),
      ...(input.repairedAt ? { repairedAt: input.repairedAt } : {}),
      ...(input.schemaVersionBefore ? { schemaVersionBefore: input.schemaVersionBefore } : {}),
      ...(input.schemaVersionAfter ? { schemaVersionAfter: input.schemaVersionAfter } : {}),
      updatedAt: input.updatedAt
    });
    const commandRecord = buildDiagnosticAlertSuppressionRepairCommandRecord({
      commandType: input.commandType,
      suppressionKey: input.suppressionKey,
      triggeredAt: input.updatedAt,
      triggeredBy: input.triggeredBy,
      outcome: input.outcome ?? "failed",
      outcomeReason: input.reason ?? "no reason",
      resultingRepairStatus: transitioned.repairStatus,
      ...(input.schemaVersionBefore ? { schemaVersionBefore: input.schemaVersionBefore } : {}),
      ...(input.schemaVersionAfter ? { schemaVersionAfter: input.schemaVersionAfter } : {}),
      linkedLifecycleVersion: transitioned.lastUpdatedAt
    });
    const commandPersisted = await persistDiagnosticAlertSuppressionRepairCommandRecord({
      record: commandRecord,
      ...(this.repairCommandRecordStore ? { store: this.repairCommandRecordStore } : {})
    });
    const commandRecordId = commandPersisted.ok ? commandRecord.commandRecordId : undefined;
    const persisted = await persistSuppressionRepairLifecycleSlot({
      suppressionKey: input.suppressionKey,
      lifecycle: transitioned,
      ...(commandRecordId ? { lastCommandRecordId: commandRecordId } : {}),
      ...(this.repairLifecycleStore ? { store: this.repairLifecycleStore } : {}),
      updatedAt: input.updatedAt
    });
    if (!persisted.ok) {
      this.repairLifecycleRegistry.setState(previous);
      return err(persisted.error);
    }
    return ok({
      ...transitioned,
      ...(commandRecordId ? { commandRecordId } : {})
    });
  }

  private toRecord(input: {
    readonly commandRecordId?: string;
    readonly commandType?: "repair" | "confirm" | "retry";
    readonly suppressionKey: string;
    readonly outcome: "repaired" | "failed" | "noop" | "manually_confirmed";
    readonly reason: string;
    readonly happenedAt: string;
    readonly triggeredBy: string;
    readonly compatibilityBefore: ReturnType<typeof evaluateDiagnosticAlertSuppressionStateReadCompatibility>;
    readonly compatibilityAfter?: ReturnType<typeof evaluateDiagnosticAlertSuppressionStateReadCompatibility>;
    readonly repairAvailable: boolean;
    readonly repairRecommended: boolean;
    readonly lifecycle: DiagnosticAlertSuppressionStateRepairLifecycleState;
    readonly repairedSchemaVersion?: string | undefined;
  }) {
    return {
      ...(input.commandRecordId ? { commandRecordId: input.commandRecordId } : {}),
      ...(input.commandType ? { commandType: input.commandType } : {}),
      suppressionKey: input.suppressionKey,
      outcome: input.outcome,
      reason: input.reason,
      repairedAt: input.happenedAt,
      triggeredBy: input.triggeredBy,
      compatibilityBefore: input.compatibilityBefore,
      ...(input.compatibilityAfter ? { compatibilityAfter: input.compatibilityAfter } : {}),
      repairAvailable: input.repairAvailable,
      repairRecommended: input.repairRecommended,
      ...(input.repairedSchemaVersion ? { repairedSchemaVersion: input.repairedSchemaVersion } : {}),
      repairStatus: input.lifecycle.repairStatus,
      repairAttempts: input.lifecycle.repairAttempts,
      lastRepairOutcome: input.lifecycle.lastRepairOutcome ?? input.outcome,
      manualConfirmation: input.lifecycle.manualConfirmation,
      ...(input.lifecycle.lastReason ? { lastReason: input.lifecycle.lastReason } : {}),
      ...(input.lifecycle.lastAttemptedAt ? { lastAttemptedAt: input.lifecycle.lastAttemptedAt } : {}),
      ...(input.lifecycle.lastRepairedAt ? { lastRepairedAt: input.lifecycle.lastRepairedAt } : {}),
      targetSuppressionKey: input.lifecycle.targetSuppressionKey,
      ...(input.lifecycle.schemaVersionBefore ? { schemaVersionBefore: input.lifecycle.schemaVersionBefore } : {}),
      ...(input.lifecycle.schemaVersionAfter ? { schemaVersionAfter: input.lifecycle.schemaVersionAfter } : {}),
      lifecycleState: input.lifecycle
    };
  }
}
