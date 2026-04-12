import type {
  DiagnosticAlertSuppressionStorePort,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  StoredDiagnosticAlertSuppressionState
} from "@tianqi/ports";

import {
  DiagnosticAlertSuppressionStateRepairLifecycleRegistry
} from "./diagnostic-alert-suppression-state-repair-lifecycle-registry.js";
import {
  canConfirmSuppressionStateRepairManuallyUnderStatus,
  canRetrySuppressionStateRepairUnderStatus,
  mapContinuityFailureToRepairStatus
} from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import type { DiagnosticAlertSuppressionStateRepairStatus as DiagnosticAlertSuppressionLifecycleStatus } from "./diagnostic-alert-suppression-state-repair-lifecycle.js";
import {
  readDiagnosticAlertSuppressionStateWithCompatibility
} from "./coordination-diagnostic-alert-suppression-state-repair.js";
import {
  persistSuppressionRepairLifecycleSlot,
  readSuppressionRepairLifecycleWithContinuity
} from "./coordination-diagnostic-alert-suppression-repair-lifecycle-slot.js";
import type { DiagnosticAlertSuppressionStateRepairStatus } from "./coordination-diagnostic-alert-suppression-state-repair.js";
import type { DiagnosticAlertSuppressionStateReadCompatibilityStatus } from "./diagnostic-alert-suppression-state-read-compatibility.js";
import {
  validateSuppressionStateContinuity
} from "./coordination-diagnostic-alert-suppression-continuity.js";
import type { DiagnosticHistoryReplayValidationResult } from "./coordination-diagnostic-history-replay-validation.js";
import type { DiagnosticReadAlert } from "./coordination-diagnostic-replay-operational-assessment.js";
import { DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION } from "./diagnostic-alert-suppression-state-schema.js";

export type DiagnosticAlertSuppressionStatus = "emitted" | "deduplicated" | "suppressed_with_notice";

export type DiagnosticAlertDedupKey = {
  readonly factKey: string;
  readonly reasonCategory: DiagnosticHistoryReplayValidationResult["reasonCategory"];
  readonly severity: DiagnosticReadAlert["severity"];
  readonly triggerSource: DiagnosticReadAlert["triggerSource"];
};

export type DiagnosticAlertSuppressionResult = {
  readonly status: DiagnosticAlertSuppressionStatus;
  readonly suppressionKey: string;
  readonly reason: string;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly repeatCount: number;
};

export type DiagnosticAlertSuppressionPersistenceSource = "in_memory_only" | "persisted" | "persisted_with_fallback";
export type DiagnosticAlertSuppressionPersistenceReadStatus = "found" | "missing" | "read_failed";
export type DiagnosticAlertSuppressionPersistenceWriteStatus = "written" | "write_failed" | "not_attempted";

export type DiagnosticAlertSuppressionPersistence = {
  readonly source: DiagnosticAlertSuppressionPersistenceSource;
  readonly readStatus: DiagnosticAlertSuppressionPersistenceReadStatus;
  readonly writeStatus: DiagnosticAlertSuppressionPersistenceWriteStatus;
  readonly stateReadCompatibility: DiagnosticAlertSuppressionStateReadCompatibilityStatus;
  readonly stateCompatibilityReason: string;
  readonly stateRepairAvailable: boolean;
  readonly stateRepairRecommended: boolean;
  readonly stateRepairStatus: DiagnosticAlertSuppressionStateRepairStatus;
  readonly repairedSchemaVersion?: string;
  readonly continuityStatus: "passed" | "notice" | "failed";
  readonly continuityReasonCategory: string;
  readonly continuityReason: string;
  readonly isRepeatCountContinuous: boolean;
  readonly suppressionStateRepair: {
    readonly repairStatus: DiagnosticAlertSuppressionLifecycleStatus;
    readonly repairAttempts: number;
    readonly lastRepairOutcome?: "repaired" | "failed" | "noop" | "manually_confirmed";
    readonly manualConfirmation: boolean;
    readonly lastReason?: string;
    readonly lastAttemptedAt?: string;
    readonly lastRepairedAt?: string;
    readonly targetSuppressionKey: string;
    readonly schemaVersionBefore?: string;
    readonly schemaVersionAfter?: string;
    readonly canRetry: boolean;
    readonly canConfirmManually: boolean;
  };
  readonly suppressionStateRepairPersistence: {
    readonly source: "in_memory_only" | "persisted" | "persisted_with_fallback";
    readonly continuityStatus: "passed" | "notice" | "failed";
    readonly continuityReasonCategory: string;
    readonly continuityReason: string;
    readonly historyAvailable: boolean;
    readonly currentLifecycleReadable: boolean;
    readonly previousLifecycleAvailable: boolean;
    readonly lastCommandRecordId?: string;
  };
};

type SuppressionState = {
  readonly key: DiagnosticAlertDedupKey;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly repeatCount: number;
};

export const buildDiagnosticAlertSuppressionKey = (key: DiagnosticAlertDedupKey): string =>
  `${key.factKey}|${key.reasonCategory}`;

export class DiagnosticAlertSuppressionRegistry {
  private readonly bySuppressionKey = new Map<string, SuppressionState>();

  public recordOrSuppress(input: {
    readonly key: DiagnosticAlertDedupKey;
    readonly observedAt: string;
  }): DiagnosticAlertSuppressionResult {
    const suppressionKey = buildDiagnosticAlertSuppressionKey(input.key);
    const existing = this.bySuppressionKey.get(suppressionKey);
    if (!existing) {
      const nextState: SuppressionState = {
        key: input.key,
        firstSeenAt: input.observedAt,
        lastSeenAt: input.observedAt,
        repeatCount: 1
      };
      this.bySuppressionKey.set(suppressionKey, nextState);
      return {
        status: "emitted",
        suppressionKey,
        reason: "First alert occurrence for factKey+reasonCategory key",
        firstSeenAt: nextState.firstSeenAt,
        lastSeenAt: nextState.lastSeenAt,
        repeatCount: nextState.repeatCount
      };
    }

    const updatedState: SuppressionState = {
      key: input.key,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: input.observedAt,
      repeatCount: existing.repeatCount + 1
    };
    this.bySuppressionKey.set(suppressionKey, updatedState);

    const status: DiagnosticAlertSuppressionStatus =
      input.key.severity === "critical" ? "suppressed_with_notice" : "deduplicated";

    return {
      status,
      suppressionKey,
      reason:
        status === "suppressed_with_notice"
          ? "Repeated critical alert suppressed with notice to reduce noise"
          : "Repeated alert deduplicated by factKey+reasonCategory key",
      firstSeenAt: updatedState.firstSeenAt,
      lastSeenAt: updatedState.lastSeenAt,
      repeatCount: updatedState.repeatCount
    };
  }

  public getBySuppressionKey(suppressionKey: string): DiagnosticAlertSuppressionResult | null {
    const state = this.bySuppressionKey.get(suppressionKey);
    if (!state) {
      return null;
    }
    const status: DiagnosticAlertSuppressionStatus =
      state.repeatCount <= 1 ? "emitted" : state.key.severity === "critical" ? "suppressed_with_notice" : "deduplicated";
    return {
      status,
      suppressionKey,
      reason: "Suppression state found",
      firstSeenAt: state.firstSeenAt,
      lastSeenAt: state.lastSeenAt,
      repeatCount: state.repeatCount
    };
  }

  public hydrateFromPersistedState(state: StoredDiagnosticAlertSuppressionState): void {
    this.bySuppressionKey.set(state.suppressionKey, {
      key: {
        factKey: state.factKey,
        reasonCategory: state.reasonCategory as DiagnosticHistoryReplayValidationResult["reasonCategory"],
        severity: state.severity,
        triggerSource: state.triggerSource
      },
      firstSeenAt: state.firstSeenAt,
      lastSeenAt: state.lastSeenAt,
      repeatCount: state.repeatCount
    });
  }
}

const toLifecycleView = (state: ReturnType<DiagnosticAlertSuppressionStateRepairLifecycleRegistry["getBySuppressionKey"]>) => ({
  repairStatus: state.repairStatus,
  repairAttempts: state.repairAttempts,
  ...(state.lastRepairOutcome ? { lastRepairOutcome: state.lastRepairOutcome } : {}),
  manualConfirmation: state.manualConfirmation,
  ...(state.lastReason ? { lastReason: state.lastReason } : {}),
  ...(state.lastAttemptedAt ? { lastAttemptedAt: state.lastAttemptedAt } : {}),
  ...(state.lastRepairedAt ? { lastRepairedAt: state.lastRepairedAt } : {}),
  targetSuppressionKey: state.targetSuppressionKey,
  ...(state.schemaVersionBefore ? { schemaVersionBefore: state.schemaVersionBefore } : {}),
  ...(state.schemaVersionAfter ? { schemaVersionAfter: state.schemaVersionAfter } : {}),
  canRetry: canRetrySuppressionStateRepairUnderStatus(state.repairStatus),
  canConfirmManually: canConfirmSuppressionStateRepairManuallyUnderStatus(state.repairStatus)
});

export const applyDiagnosticAlertSuppression = (input: {
  readonly factKey: string;
  readonly replayValidation: DiagnosticHistoryReplayValidationResult;
  readonly alert: DiagnosticReadAlert;
  readonly registry: DiagnosticAlertSuppressionRegistry;
  readonly observedAt?: string;
}): DiagnosticAlertSuppressionResult =>
  input.registry.recordOrSuppress({
    key: {
      factKey: input.factKey,
      reasonCategory: input.replayValidation.reasonCategory,
      severity: input.alert.severity,
      triggerSource: input.alert.triggerSource
    },
    observedAt: input.observedAt ?? new Date().toISOString()
  });

const toStoredSuppressionState = (input: {
  readonly key: DiagnosticAlertDedupKey;
  readonly suppression: DiagnosticAlertSuppressionResult;
}): StoredDiagnosticAlertSuppressionState => ({
  schemaVersion: DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION,
  suppressionKey: input.suppression.suppressionKey,
  factKey: input.key.factKey,
  reasonCategory: input.key.reasonCategory,
  severity: input.key.severity,
  triggerSource: input.key.triggerSource,
  firstSeenAt: input.suppression.firstSeenAt,
  lastSeenAt: input.suppression.lastSeenAt,
  repeatCount: input.suppression.repeatCount,
  lastStatus: input.suppression.status
});

const isHydratablePersistedState = (input: {
  readonly state: StoredDiagnosticAlertSuppressionState;
  readonly suppressionKey: string;
  readonly key: DiagnosticAlertDedupKey;
}): boolean =>
  input.state.suppressionKey === input.suppressionKey &&
  input.state.factKey === input.key.factKey &&
  input.state.reasonCategory === input.key.reasonCategory &&
  input.state.severity === input.key.severity &&
  input.state.triggerSource === input.key.triggerSource &&
  input.state.repeatCount >= 1 &&
  Date.parse(input.state.firstSeenAt) <= Date.parse(input.state.lastSeenAt);

export const applyDiagnosticAlertSuppressionWithPersistence = async (input: {
  readonly factKey: string;
  readonly replayValidation: DiagnosticHistoryReplayValidationResult;
  readonly alert: DiagnosticReadAlert;
  readonly registry: DiagnosticAlertSuppressionRegistry;
  readonly store?: DiagnosticAlertSuppressionStorePort;
  readonly lifecycleRegistry?: DiagnosticAlertSuppressionStateRepairLifecycleRegistry;
  readonly lifecycleStore?: DiagnosticAlertSuppressionStateRepairLifecycleStorePort;
  readonly observedAt?: string;
}): Promise<{
  readonly suppression: DiagnosticAlertSuppressionResult;
  readonly persistence: DiagnosticAlertSuppressionPersistence;
}> => {
  const key: DiagnosticAlertDedupKey = {
    factKey: input.factKey,
    reasonCategory: input.replayValidation.reasonCategory,
    severity: input.alert.severity,
    triggerSource: input.alert.triggerSource
  };
  const suppressionKey = buildDiagnosticAlertSuppressionKey(key);

  let persistedState: StoredDiagnosticAlertSuppressionState | undefined;
  let readStatus: DiagnosticAlertSuppressionPersistenceReadStatus = "missing";
  let stateReadCompatibility: DiagnosticAlertSuppressionStateReadCompatibilityStatus = "state_missing";
  let stateCompatibilityReason = "Suppression store is not configured";
  let stateRepairAvailable = false;
  let stateRepairRecommended = false;
  let stateRepairStatus: DiagnosticAlertSuppressionStateRepairStatus = "not_attempted";
  const repairedSchemaVersion = undefined;
  const lifecycleRegistry = input.lifecycleRegistry ?? new DiagnosticAlertSuppressionStateRepairLifecycleRegistry();
  const lifecycleRead = await readSuppressionRepairLifecycleWithContinuity({
    suppressionKey,
    registry: lifecycleRegistry,
    ...(input.lifecycleStore ? { store: input.lifecycleStore } : {})
  });
  const lifecycleState = lifecycleRead.lifecycle;
  if (input.store) {
    const loaded = await readDiagnosticAlertSuppressionStateWithCompatibility({
      suppressionKey,
      store: input.store
    });
    readStatus = loaded.readStatus;
    stateReadCompatibility = loaded.compatibility.status;
    stateCompatibilityReason = loaded.compatibility.reason;
    stateRepairAvailable = loaded.repairEvaluation.repairAvailable;
    stateRepairRecommended = loaded.repairEvaluation.repairRecommended;
    if (loaded.readStatus === "read_failed") {
      const fallbackSuppression = input.registry.recordOrSuppress({
        key,
        observedAt: input.observedAt ?? new Date().toISOString()
      });
      return {
        suppression: fallbackSuppression,
        persistence: {
          source: "persisted_with_fallback",
          readStatus: "read_failed",
          writeStatus: "not_attempted",
          stateReadCompatibility,
          stateCompatibilityReason,
          stateRepairAvailable,
          stateRepairRecommended,
          stateRepairStatus,
          ...(repairedSchemaVersion ? { repairedSchemaVersion } : {}),
          continuityStatus: "notice",
          continuityReasonCategory: "state_missing",
          continuityReason: stateCompatibilityReason,
          isRepeatCountContinuous: false,
          suppressionStateRepair: toLifecycleView(lifecycleState),
          suppressionStateRepairPersistence: lifecycleRead.persistence
        }
      };
    }
    if (loaded.readStatus === "found" && loaded.state) {
      persistedState = loaded.state;
      if (
        stateReadCompatibility !== "incompatible_version" &&
        stateReadCompatibility !== "malformed_state" &&
        !input.registry.getBySuppressionKey(suppressionKey) &&
        isHydratablePersistedState({ state: persistedState, suppressionKey, key })
      ) {
        input.registry.hydrateFromPersistedState(persistedState);
      }
    }
  }

  const suppression = input.registry.recordOrSuppress({
    key,
    observedAt: input.observedAt ?? new Date().toISOString()
  });

  const continuity = validateSuppressionStateContinuity({
    suppressionKey,
    factKey: key.factKey,
    reasonCategory: key.reasonCategory,
    severity: key.severity,
    triggerSource: key.triggerSource,
    currentRepeatCount: suppression.repeatCount,
    currentFirstSeenAt: suppression.firstSeenAt,
    currentLastSeenAt: suppression.lastSeenAt,
    currentStatus: suppression.status,
    ...(persistedState ? { persistedState } : {})
  });
  const continuityValue = continuity.ok
    ? continuity.value
    : {
        status: "failed" as const,
        reasonCategory: "semantic_mismatch",
        reason: continuity.error.message,
        isContinuous: false
      };

  if (!input.store) {
    return {
      suppression,
      persistence: {
        source: "in_memory_only",
        readStatus: "missing",
        writeStatus: "not_attempted",
        stateReadCompatibility,
        stateCompatibilityReason,
        stateRepairAvailable,
        stateRepairRecommended,
        stateRepairStatus,
        ...(repairedSchemaVersion ? { repairedSchemaVersion } : {}),
        continuityStatus: continuityValue.status,
        continuityReasonCategory: continuityValue.reasonCategory,
        continuityReason: continuityValue.reason,
        isRepeatCountContinuous: continuityValue.isContinuous,
        suppressionStateRepair: toLifecycleView(lifecycleState),
        suppressionStateRepairPersistence: lifecycleRead.persistence
      }
    };
  }

  if (continuityValue.status === "failed") {
    const mapped = mapContinuityFailureToRepairStatus({
      persistence: {
        source: "persisted_with_fallback",
        readStatus,
        writeStatus: "not_attempted",
        stateReadCompatibility,
        stateCompatibilityReason,
        stateRepairAvailable,
        stateRepairRecommended,
        stateRepairStatus,
        continuityStatus: continuityValue.status,
        continuityReasonCategory: continuityValue.reasonCategory,
        continuityReason: continuityValue.reason,
        isRepeatCountContinuous: continuityValue.isContinuous,
        suppressionStateRepair: toLifecycleView(lifecycleState),
        suppressionStateRepairPersistence: lifecycleRead.persistence
      }
    });
    const transitioned = lifecycleRegistry.transition({
      suppressionKey,
      to: mapped,
      outcome: "failed",
      attempts: lifecycleState.repairAttempts + 1,
      manualConfirmation: lifecycleState.manualConfirmation,
      reason: continuityValue.reason,
      attemptedAt: input.observedAt ?? new Date().toISOString(),
      updatedAt: input.observedAt ?? new Date().toISOString()
    });
    await persistSuppressionRepairLifecycleSlot({
      suppressionKey,
      lifecycle: transitioned,
      ...(input.lifecycleStore ? { store: input.lifecycleStore } : {}),
      updatedAt: input.observedAt ?? new Date().toISOString()
    });
    stateRepairStatus = "failed";
    return {
      suppression,
      persistence: {
        source: "persisted_with_fallback",
        readStatus,
        writeStatus: "not_attempted",
        stateReadCompatibility,
        stateCompatibilityReason,
        stateRepairAvailable,
        stateRepairRecommended,
        stateRepairStatus,
        ...(repairedSchemaVersion ? { repairedSchemaVersion } : {}),
        continuityStatus: continuityValue.status,
        continuityReasonCategory: continuityValue.reasonCategory,
        continuityReason: continuityValue.reason,
        isRepeatCountContinuous: continuityValue.isContinuous,
        suppressionStateRepair: toLifecycleView(transitioned),
        suppressionStateRepairPersistence: lifecycleRead.persistence
      }
    };
  }

  const persisted = await input.store.put(toStoredSuppressionState({ key, suppression }));
  if (!persisted.ok) {
    return {
      suppression,
      persistence: {
        source: "persisted_with_fallback",
        readStatus,
        writeStatus: "write_failed",
        stateReadCompatibility,
        stateCompatibilityReason,
        stateRepairAvailable,
        stateRepairRecommended,
        stateRepairStatus,
        ...(repairedSchemaVersion ? { repairedSchemaVersion } : {}),
        continuityStatus: continuityValue.status,
        continuityReasonCategory: continuityValue.reasonCategory,
        continuityReason: `${continuityValue.reason}; suppression store write failed: ${persisted.error.message}`,
        isRepeatCountContinuous: continuityValue.isContinuous,
        suppressionStateRepair: toLifecycleView(lifecycleState),
        suppressionStateRepairPersistence: lifecycleRead.persistence
      }
    };
  }

  const repairedTransition = lifecycleRegistry.transition({
    suppressionKey,
    to: "repaired",
    outcome: suppression.status === "emitted" ? "noop" : "repaired",
    attempts: lifecycleState.repairAttempts + 1,
    manualConfirmation: lifecycleState.manualConfirmation,
    reason: "Suppression persisted state write succeeded",
    attemptedAt: input.observedAt ?? new Date().toISOString(),
    repairedAt: input.observedAt ?? new Date().toISOString(),
    schemaVersionBefore: persistedState?.schemaVersion,
    schemaVersionAfter: DIAGNOSTIC_ALERT_SUPPRESSION_STATE_SCHEMA_VERSION,
    updatedAt: input.observedAt ?? new Date().toISOString()
  });
  await persistSuppressionRepairLifecycleSlot({
    suppressionKey,
    lifecycle: repairedTransition,
    ...(input.lifecycleStore ? { store: input.lifecycleStore } : {}),
    updatedAt: input.observedAt ?? new Date().toISOString()
  });
  stateRepairStatus = suppression.status === "emitted" ? "noop" : "repaired";
  return {
    suppression,
    persistence: {
      source: "persisted",
      readStatus,
      writeStatus: "written",
      stateReadCompatibility,
      stateCompatibilityReason,
      stateRepairAvailable,
      stateRepairRecommended,
      stateRepairStatus,
      ...(repairedSchemaVersion ? { repairedSchemaVersion } : {}),
      continuityStatus: continuityValue.status,
      continuityReasonCategory: continuityValue.reasonCategory,
      continuityReason: continuityValue.reason,
      isRepeatCountContinuous: continuityValue.isContinuous,
      suppressionStateRepair: toLifecycleView(repairedTransition),
      suppressionStateRepairPersistence: lifecycleRead.persistence
    }
  };
};
