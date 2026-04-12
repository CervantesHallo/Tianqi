import type {
  CoordinationDiagnosticHistoryStorePort,
  CoordinationResultStorePort,
  DiagnosticAlertSuppressionRepairCommandRecordStorePort,
  DiagnosticAlertSuppressionStateRepairLifecycleStorePort,
  DiagnosticAlertSuppressionStorePort,
  StoredCoordinationDiagnosticHistorySlot,
  StoredDiagnosticAlertSuppressionRepairCommandRecord,
  StoredDiagnosticAlertSuppressionState,
  StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot,
  StoredRiskCaseCoordinationResult
} from "@tianqi/ports";
import { ok } from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import {
  getPhase2ScenarioBaselineById,
  PHASE2_AGGREGATE_FAILURE_BASELINES
} from "./core-case-diagnostic-aggregate-baseline.js";
import {
  assertCoreCaseAggregateBaselineConsistency,
  assertCoreCaseAggregateFailureSemanticFrozen
} from "./core-case-diagnostic-aggregate-baseline-consistency.js";
import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import { CoordinationResultDiagnosticQueryHandler } from "./coordination-result-diagnostic-query-handler.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import { CoordinationResultRepairCommandHandler } from "./coordination-result-repair-command-handler.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import { COORDINATION_RESULT_STORE_SCHEMA_VERSION } from "./coordination-result-store-schema.js";

class FakeDiagnosticQueryReader {
  public nextResult: CoordinationResultDiagnosticQueryResult;

  public constructor(result: CoordinationResultDiagnosticQueryResult) {
    this.nextResult = result;
  }

  public async handle() {
    return this.nextResult;
  }
}

class FakeCoordinationResultStore implements CoordinationResultStorePort {
  public readonly byFact = new Map<string, StoredRiskCaseCoordinationResult>();

  public async put(record: StoredRiskCaseCoordinationResult) {
    this.byFact.set(record.factKey, record);
    return ok(undefined);
  }

  public async getByFactKey(factKey: string) {
    const record = this.byFact.get(factKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }

  public async getLatestByRiskCaseAndSubcase(input: {
    readonly riskCaseId: string;
    readonly subcaseType: "LiquidationCase" | "ADLCase";
    readonly subcaseId: string;
  }) {
    let latest: StoredRiskCaseCoordinationResult | undefined;
    for (const candidate of this.byFact.values()) {
      if (
        candidate.riskCaseId === input.riskCaseId &&
        candidate.subcaseType === input.subcaseType &&
        candidate.subcaseId === input.subcaseId &&
        (!latest || new Date(candidate.occurredAt).getTime() >= new Date(latest.occurredAt).getTime())
      ) {
        latest = candidate;
      }
    }
    return ok(latest ? { status: "found" as const, record: latest } : { status: "missing" as const });
  }
}

class FakeCoordinationDiagnosticHistoryStore implements CoordinationDiagnosticHistoryStorePort {
  public readonly byFact = new Map<string, StoredCoordinationDiagnosticHistorySlot>();

  public async put(slot: StoredCoordinationDiagnosticHistorySlot) {
    this.byFact.set(slot.factKey, slot);
    return ok(undefined);
  }

  public async getByFactKey(factKey: string) {
    const slot = this.byFact.get(factKey);
    return ok(slot ? { status: "found" as const, slot } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionStore implements DiagnosticAlertSuppressionStorePort {
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionState>();

  public async put(state: StoredDiagnosticAlertSuppressionState) {
    this.byKey.set(state.suppressionKey, state);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    const state = this.byKey.get(suppressionKey);
    return ok(state ? { status: "found" as const, state } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairLifecycleStore
  implements DiagnosticAlertSuppressionStateRepairLifecycleStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot>();

  public async put(slot: StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot) {
    this.byKey.set(slot.suppressionKey, slot);
    return ok(undefined);
  }

  public async getBySuppressionKey(suppressionKey: string) {
    const slot = this.byKey.get(suppressionKey);
    return ok(slot ? { status: "found" as const, slot } : { status: "missing" as const });
  }
}

class FakeDiagnosticAlertSuppressionRepairCommandRecordStore
  implements DiagnosticAlertSuppressionRepairCommandRecordStorePort
{
  public readonly byKey = new Map<string, StoredDiagnosticAlertSuppressionRepairCommandRecord>();

  public async put(record: StoredDiagnosticAlertSuppressionRepairCommandRecord) {
    this.byKey.set(record.suppressionKey, record);
    return ok(undefined);
  }

  public async getLatestBySuppressionKey(suppressionKey: string) {
    const record = this.byKey.get(suppressionKey);
    return ok(record ? { status: "found" as const, record } : { status: "missing" as const });
  }
}

type DiagnosticSuccessResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const makeBaseSuccessResult = (input?: Partial<DiagnosticSuccessResult>): DiagnosticSuccessResult =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-step23|ADLCase|adl-step23|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-step23",
      subcaseType: "ADLCase",
      subcaseId: "adl-step23",
      currentReadViewStatus: "persisted",
      validationStatus: "passed",
      repairStatus: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      assessmentRulesVersion: "1.0.0",
      riskLevel: "low",
      manualActionHint: "no_action_needed",
      riskReason: "stable",
      actionHintReason: "stable",
      diagnosticSummary: "stable"
    },
    readCompatibility: "compatible_read",
    compatibilityReason: "ok",
    ...input
  }) satisfies DiagnosticSuccessResult;

const buildSuppressionPersistence = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["alertSuppressionPersistence"]>>
): NonNullable<DiagnosticSuccessResult["alertSuppressionPersistence"]> => ({
  source: "persisted",
  readStatus: "found",
  writeStatus: "written",
  stateReadCompatibility: "compatible_read",
  stateCompatibilityReason: "compatible",
  stateRepairAvailable: true,
  stateRepairRecommended: false,
  stateRepairStatus: "repaired",
  continuityStatus: "passed",
  continuityReasonCategory: "ok",
  continuityReason: "continuous",
  isRepeatCountContinuous: true,
  suppressionStateRepair: {
    repairStatus: "repaired",
    repairAttempts: 1,
    lastRepairOutcome: "repaired",
    manualConfirmation: false,
    targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
    canRetry: false,
    canConfirmManually: false
  },
  suppressionStateRepairPersistence: {
    source: "persisted",
    continuityStatus: "passed",
    continuityReasonCategory: "ok",
    continuityReason: "continuous",
    historyAvailable: true,
    currentLifecycleReadable: true,
    previousLifecycleAvailable: true
  },
  ...input
});

const buildHistoryConsistency = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["historyConsistency"]>>
): NonNullable<DiagnosticSuccessResult["historyConsistency"]> => ({
  status: "passed",
  reason: "history replay passed",
  replayValidation: {
    status: "passed",
    reasonCategory: "current_snapshot_conflict",
    reason: "history replay passed"
  },
  ...input
});

const buildCommandLink = (
  input?: Partial<NonNullable<DiagnosticSuccessResult["suppressionStateRepairCommandLink"]>>
): NonNullable<DiagnosticSuccessResult["suppressionStateRepairCommandLink"]> => ({
  commandLinkConsistencyStatus: "passed",
  commandLinkConsistencyReason: "linked",
  lastCommandType: "repair",
  lastCommandOutcome: "repaired",
  lastCommandTriggeredAt: "2026-03-25T00:00:03.000Z",
  ...input
});

const runAggregateWithReaderResult = async (
  baseResult: DiagnosticSuccessResult
): Promise<{ readonly aggregate: ReturnType<typeof expectAggregate>; readonly base: DiagnosticSuccessResult }> => {
  const reader = new FakeDiagnosticQueryReader(baseResult);
  const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });
  const result = await handler.handle({
    factKey: baseResult.view.factKey,
    includeHistoryComparison: true
  });
  const aggregate = expectAggregate(result);
  return { aggregate, base: baseResult };
};

const expectAggregate = (
  result: Awaited<ReturnType<CoreCaseDiagnosticAggregateQueryHandler["handle"]>>
) => {
  expect(result.success).toBe(true);
  if (!result.success) {
    throw new Error("aggregate query should succeed in baseline regression test");
  }
  return result.aggregateView;
};

type ScenarioBaselineId = "A" | "B" | "C" | "D" | "E" | "F";

const scenarioInputByBaselineId: Readonly<Record<ScenarioBaselineId, () => DiagnosticSuccessResult>> = {
  A: () =>
    makeBaseSuccessResult({
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence(),
      suppressionStateRepair: {
        repairStatus: "repaired",
        repairAttempts: 1,
        lastRepairOutcome: "repaired",
        manualConfirmation: false,
        targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
        canRetry: false,
        canConfirmManually: false
      },
      suppressionStateRepairCommandLink: buildCommandLink()
    }),
  B: () =>
    makeBaseSuccessResult({
      view: {
        factKey: "risk-case-step23|ADLCase|adl-step23|2026-03-25T00:00:02.000Z",
        riskCaseId: "risk-case-step23",
        subcaseType: "ADLCase",
        subcaseId: "adl-step23",
        currentReadViewStatus: "persisted",
        validationStatus: "passed",
        repairStatus: "repair_failed_retryable",
        repairAttempts: 2,
        manualConfirmation: false,
        assessmentRulesVersion: "1.0.0",
        riskLevel: "medium",
        manualActionHint: "retry_repair_recommended",
        riskReason: "retryable",
        actionHintReason: "retry required",
        diagnosticSummary: "retryable"
      },
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence({
        suppressionStateRepair: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
          canRetry: true,
          canConfirmManually: true
        }
      }),
      suppressionStateRepair: {
        repairStatus: "repair_failed_retryable",
        repairAttempts: 2,
        lastRepairOutcome: "failed",
        manualConfirmation: false,
        targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
        canRetry: true,
        canConfirmManually: true
      },
      suppressionStateRepairCommandLink: buildCommandLink({
        lastCommandType: "retry",
        lastCommandOutcome: "failed"
      })
    }),
  C: () =>
    makeBaseSuccessResult({
      view: {
        factKey: "risk-case-step23|ADLCase|adl-step23|2026-03-25T00:00:02.000Z",
        riskCaseId: "risk-case-step23",
        subcaseType: "ADLCase",
        subcaseId: "adl-step23",
        currentReadViewStatus: "persisted",
        validationStatus: "failed",
        repairStatus: "repair_failed_manual_confirmation_required",
        repairAttempts: 3,
        manualConfirmation: false,
        assessmentRulesVersion: "1.0.0",
        riskLevel: "high",
        manualActionHint: "manual_confirmation_recommended",
        riskReason: "manual confirmation required",
        actionHintReason: "manual confirm",
        diagnosticSummary: "manual review"
      },
      readAlert: {
        severity: "critical",
        alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT",
        alertSummary: "critical conflict",
        operationalHint: "manual_diagnostic_review_required",
        triggerSource: "replay_validation",
        requiresAttention: true
      },
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence({
        suppressionStateRepair: {
          repairStatus: "repair_failed_manual_confirmation_required",
          repairAttempts: 3,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: true
        }
      }),
      suppressionStateRepair: {
        repairStatus: "repair_failed_manual_confirmation_required",
        repairAttempts: 3,
        lastRepairOutcome: "failed",
        manualConfirmation: false,
        targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
        canRetry: false,
        canConfirmManually: true
      },
      suppressionStateRepairCommandLink: buildCommandLink({
        lastCommandType: "confirm",
        lastCommandOutcome: "failed"
      })
    }),
  D: () =>
    makeBaseSuccessResult({
      historyConsistency: buildHistoryConsistency({
        status: "failed",
        reason: "history continuity failed",
        replayValidation: {
          status: "failed",
          reasonCategory: "current_snapshot_conflict",
          reason: "history replay failed"
        }
      }),
      historyReplayValidation: {
        status: "failed",
        reasonCategory: "current_snapshot_conflict",
        reason: "history replay failed"
      },
      suppressionStateRepairCommandLink: buildCommandLink()
    }),
  E: () =>
    makeBaseSuccessResult({
      suppressionStateRepairCommandLink: buildCommandLink({
        commandLinkConsistencyStatus: "missing_record",
        commandLinkConsistencyReason: "record missing"
      })
    }),
  F: () =>
    makeBaseSuccessResult({
      alertSuppressionPersistence: buildSuppressionPersistence({
        continuityStatus: "failed",
        continuityReasonCategory: "suppression_key_mismatch",
        continuityReason: "persisted suppression continuity failed"
      }),
      suppressionStateRepairCommandLink: buildCommandLink()
    })
};

describe("core-case aggregate baseline regression", () => {
  it("freezes six acceptance-grade aggregate baselines", async () => {
    const baselineIds: readonly ScenarioBaselineId[] = ["A", "B", "C", "D", "E", "F"];
    for (const baselineId of baselineIds) {
      const baseline = getPhase2ScenarioBaselineById(baselineId);
      expect(baseline).toBeDefined();
      const scenarioBuilder = scenarioInputByBaselineId[baselineId];
      const executed = await runAggregateWithReaderResult(scenarioBuilder());
      const consistency = assertCoreCaseAggregateBaselineConsistency({
        baseline: baseline!,
        aggregate: executed.aggregate,
        diagnosticBaseResult: executed.base
      });
      expect(consistency.status).toBe("passed");
    }
  });

  it("freezes critical failure semantics against entry drift", async () => {
    const failureScenarios: Readonly<
      Array<{
        readonly failure: keyof typeof PHASE2_AGGREGATE_FAILURE_BASELINES;
        readonly baseResult: DiagnosticSuccessResult;
      }>
    > = [
      {
        failure: "history_replay_failed",
        baseResult: scenarioInputByBaselineId.D()
      },
      {
        failure: "command_link_missing_record",
        baseResult: scenarioInputByBaselineId.E()
      },
      {
        failure: "command_link_status_mismatch",
        baseResult: makeBaseSuccessResult({
          suppressionStateRepairCommandLink: buildCommandLink({
            commandLinkConsistencyStatus: "status_mismatch",
            commandLinkConsistencyReason: "status mismatch"
          })
        })
      },
      {
        failure: "suppression_state_incompatible_version",
        baseResult: makeBaseSuccessResult({
          view: {
            factKey: "risk-case-step23|ADLCase|adl-step23|2026-03-25T00:00:02.000Z",
            riskCaseId: "risk-case-step23",
            subcaseType: "ADLCase",
            subcaseId: "adl-step23",
            currentReadViewStatus: "persisted",
            validationStatus: "passed",
            repairStatus: "repair_failed_retryable",
            repairAttempts: 1,
            manualConfirmation: false,
            assessmentRulesVersion: "1.0.0",
            riskLevel: "medium",
            manualActionHint: "retry_repair_recommended",
            riskReason: "incompatible version",
            actionHintReason: "repair needed",
            diagnosticSummary: "incompatible version"
          },
          alertSuppressionPersistence: buildSuppressionPersistence({
            stateReadCompatibility: "incompatible_version",
            stateRepairRecommended: true,
            continuityStatus: "passed",
            suppressionStateRepair: {
              repairStatus: "repair_failed_retryable",
              repairAttempts: 1,
              lastRepairOutcome: "failed",
              manualConfirmation: false,
              targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
              canRetry: true,
              canConfirmManually: true
            }
          }),
          suppressionStateRepair: {
            repairStatus: "repair_failed_retryable",
            repairAttempts: 1,
            lastRepairOutcome: "failed",
            manualConfirmation: false,
            targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
            canRetry: true,
            canConfirmManually: true
          },
          suppressionStateRepairCommandLink: buildCommandLink()
        })
      },
      {
        failure: "suppression_state_manual_confirmation_required",
        baseResult: scenarioInputByBaselineId.C()
      },
      {
        failure: "diagnostic_validation_conflict",
        baseResult: makeBaseSuccessResult({
          view: {
            factKey: "risk-case-step23|ADLCase|adl-step23|2026-03-25T00:00:02.000Z",
            riskCaseId: "risk-case-step23",
            subcaseType: "ADLCase",
            subcaseId: "adl-step23",
            currentReadViewStatus: "persisted",
            validationStatus: "failed",
            repairStatus: "repaired",
            repairAttempts: 1,
            manualConfirmation: false,
            assessmentRulesVersion: "1.0.0",
            riskLevel: "high",
            manualActionHint: "investigate_validation_conflict",
            riskReason: "validation conflict",
            actionHintReason: "investigate",
            diagnosticSummary: "validation conflict"
          },
          readAlert: {
            severity: "critical",
            alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT",
            alertSummary: "conflict",
            operationalHint: "inspect_snapshot_conflict",
            triggerSource: "replay_validation",
            requiresAttention: true
          },
          suppressionStateRepairCommandLink: buildCommandLink()
        })
      }
    ];

    for (const scenario of failureScenarios) {
      const first = await runAggregateWithReaderResult(scenario.baseResult);
      const second = await runAggregateWithReaderResult({
        ...scenario.baseResult,
        compatibilityReason: "entry-variant"
      });
      const frozen = assertCoreCaseAggregateFailureSemanticFrozen({
        failureSemantic: scenario.failure,
        aggregate: first.aggregate,
        comparedAggregates: [second.aggregate],
        diagnosticBaseResult: first.base
      });
      expect(frozen.status, `${scenario.failure}: ${frozen.reason}`).toBe("passed");
    }
  });

  it("keeps load-bearing core fields stable across command-path variants", async () => {
    const baseline = getPhase2ScenarioBaselineById("A");
    expect(baseline).toBeDefined();
    const repairPath = await runAggregateWithReaderResult(
      makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({
          lastCommandType: "repair",
          lastCommandOutcome: "repaired"
        }),
        suppressionStateRepair: {
          repairStatus: "repaired",
          repairAttempts: 1,
          lastRepairOutcome: "repaired",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: false
        }
      })
    );
    const retryPath = await runAggregateWithReaderResult(
      makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({
          lastCommandType: "retry",
          lastCommandOutcome: "repaired"
        }),
        suppressionStateRepair: {
          repairStatus: "repaired",
          repairAttempts: 2,
          lastRepairOutcome: "repaired",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: false
        }
      })
    );
    const confirmPath = await runAggregateWithReaderResult(
      makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({
          lastCommandType: "confirm",
          lastCommandOutcome: "manually_confirmed"
        }),
        suppressionStateRepair: {
          repairStatus: "repaired",
          repairAttempts: 3,
          lastRepairOutcome: "manually_confirmed",
          manualConfirmation: true,
          targetSuppressionKey: "risk-case-step23|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: false
        }
      })
    );

    const stability = assertCoreCaseAggregateBaselineConsistency({
      baseline: baseline!,
      aggregate: repairPath.aggregate,
      comparedAggregates: [retryPath.aggregate, confirmPath.aggregate],
      diagnosticBaseResult: repairPath.base
    });
    expect(stability.status).toBe("passed");
  });

  it("keeps cross-session aggregate baseline stable with persisted history/suppression/lifecycle/command-link", async () => {
    const factKey = "risk-case-step23-xsession|ADLCase|adl-step23-xsession|2026-03-25T00:00:02.000Z";
    const suppressionKey = `${factKey}|current_snapshot_conflict`;

    const coordinationStore = new FakeCoordinationResultStore();
    await coordinationStore.put({
      schemaVersion: COORDINATION_RESULT_STORE_SCHEMA_VERSION,
      factKey,
      riskCaseId: "risk-case-step23-xsession",
      subcaseType: "ADLCase",
      subcaseId: "adl-step23-xsession",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-step23-xsession",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "cross-session baseline",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-step23-xsession",
        context: { arbitration_decision: "applied", signal_category: "normal" },
        occurredAt: "2026-03-25T00:00:02.000Z"
      },
      occurredAt: "2026-03-25T00:00:02.000Z",
      sourceCommandPath: "explicit_coordination_command"
    });

    const historyStore = new FakeCoordinationDiagnosticHistoryStore();
    historyStore.byFact.set(factKey, {
      schemaVersion: "1.0.0",
      factKey,
      currentResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        validationStatus: "passed",
        repairStatus: "repaired",
        currentReadViewStatus: "persisted"
      },
      previousResult: {
        assessmentRulesVersion: "1.0.0",
        riskLevel: "low",
        manualActionHint: "no_action_needed",
        validationStatus: "passed",
        repairStatus: "repaired",
        currentReadViewStatus: "persisted"
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const suppressionStore = new FakeDiagnosticAlertSuppressionStore();
    suppressionStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      factKey,
      reasonCategory: "current_snapshot_conflict",
      severity: "info",
      triggerSource: "replay_validation",
      firstSeenAt: "2026-03-25T00:00:01.000Z",
      lastSeenAt: "2026-03-25T00:00:02.000Z",
      repeatCount: 2,
      lastStatus: "deduplicated"
    });

    const lifecycleStore = new FakeDiagnosticAlertSuppressionRepairLifecycleStore();
    lifecycleStore.byKey.set(suppressionKey, {
      schemaVersion: "1.0.0",
      suppressionKey,
      currentLifecycle: {
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: false,
        targetSuppressionKey: suppressionKey,
        canRetry: false,
        canConfirmManually: false
      },
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const commandStore = new FakeDiagnosticAlertSuppressionRepairCommandRecordStore();
    commandStore.byKey.set(suppressionKey, {
      commandRecordId: `${suppressionKey}|repair|2026-03-25T00:00:03.000Z`,
      commandType: "repair",
      suppressionKey,
      triggeredAt: "2026-03-25T00:00:03.000Z",
      triggeredBy: "operator",
      outcome: "repaired",
      outcomeReason: "repaired",
      resultingRepairStatus: "repaired",
      linkedLifecycleVersion: "2026-03-25T00:00:03.000Z"
    });

    const newSessionRegistry = new CoordinationResultRegistry();
    const newSessionObservationRegistry = new CoordinationResultObservationRegistry();
    newSessionObservationRegistry.record({
      scope: "query",
      factKey,
      riskCaseId: "risk-case-step23-xsession",
      subcaseType: "ADLCase",
      subcaseId: "adl-step23-xsession",
      storeReadHit: true,
      registryFallbackUsed: false,
      validationPassed: true,
      validationFailed: false,
      persistenceWriteSucceeded: false,
      persistenceWriteFailed: false,
      repairAttempted: false,
      repairSucceeded: false,
      repairFailed: false
    });
    const newSessionRepairRegistry = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: newSessionRegistry,
      coordinationResultStore: coordinationStore,
      coordinationObservationRegistry: newSessionObservationRegistry
    }).getRepairRecordRegistry();
    newSessionRepairRegistry.transitionRepairState({
      factKey,
      to: "repaired",
      outcome: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const diagnosticHandler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: coordinationStore,
      coordinationResultRegistry: newSessionRegistry,
      coordinationObservationRegistry: newSessionObservationRegistry,
      repairRecordRegistry: newSessionRepairRegistry,
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: commandStore
    });
    const aggregateHandler = new CoreCaseDiagnosticAggregateQueryHandler({
      diagnosticQueryReader: diagnosticHandler
    });

    const result = await aggregateHandler.handle({
      factKey,
      includeHistoryComparison: true
    });
    const aggregate = expectAggregate(result);
    const frozen = assertCoreCaseAggregateFailureSemanticFrozen({
      failureSemantic: "command_link_missing_record",
      aggregate
    });
    expect(frozen.status).toBe("passed");
    expect(aggregate.requiresAttention).toBe(true);
    expect(aggregate.requiresRepairAction).toBe(false);
    expect(aggregate.requiresManualReview).toBe(false);
    expect(aggregate.isCrossSessionConsistent).toBe(false);
    expect(aggregate.explanationStatus).toBe("inconsistent");
  });
});

