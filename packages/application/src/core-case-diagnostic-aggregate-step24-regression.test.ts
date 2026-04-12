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
  PHASE2_AGGREGATE_FAILURE_BASELINES,
  PHASE2_AGGREGATE_SCENARIO_BASELINES
} from "./core-case-diagnostic-aggregate-baseline.js";
import {
  assertCoreCaseAggregateBaselineConsistency,
  assertCoreCaseAggregateFailureSemanticFrozen,
  pickPhase2AggregateBaselineCoreFields
} from "./core-case-diagnostic-aggregate-baseline-consistency.js";
import { PHASE2_AGGREGATE_SCENARIO_MATRIX } from "./core-case-diagnostic-aggregate-scenario-matrix.js";
import { PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX } from "./core-case-diagnostic-aggregate-failure-combination-matrix.js";
import { buildPhase2AggregateBaselineDifferenceReport } from "./core-case-diagnostic-aggregate-difference-report.js";
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
      factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-s24",
      subcaseType: "ADLCase",
      subcaseId: "adl-s24",
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
    targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
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
  const result = await handler.handle({ factKey: baseResult.view.factKey, includeHistoryComparison: true });
  return { aggregate: expectAggregate(result), base: baseResult };
};

const expectAggregate = (result: Awaited<ReturnType<CoreCaseDiagnosticAggregateQueryHandler["handle"]>>) => {
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("aggregate query should succeed");
  return result.aggregateView;
};

const buildScenarioInput = (matrixId: string): DiagnosticSuccessResult => {
  switch (matrixId) {
    case "M01":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence(),
        suppressionStateRepair: {
          repairStatus: "repaired",
          repairAttempts: 1,
          lastRepairOutcome: "repaired",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: false
        },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M02":
      return makeBaseSuccessResult({
        view: {
          factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-s24",
          subcaseType: "ADLCase",
          subcaseId: "adl-s24",
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
            targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
            canRetry: true,
            canConfirmManually: true
          }
        }),
        suppressionStateRepair: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
          canRetry: true,
          canConfirmManually: true
        },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "failed" })
      });
    case "M03":
      return makeBaseSuccessResult({
        view: {
          factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-s24",
          subcaseType: "ADLCase",
          subcaseId: "adl-s24",
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
            targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
            canRetry: false,
            canConfirmManually: true
          }
        }),
        suppressionStateRepair: {
          repairStatus: "repair_failed_manual_confirmation_required",
          repairAttempts: 3,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: true
        },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "failed" })
      });
    case "M04":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({ status: "passed", reason: "notice: minor slot drift" }),
        historyReplayValidation: {
          status: "failed",
          reasonCategory: "current_snapshot_conflict",
          reason: "history replay notice"
        },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M05":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({
          status: "failed",
          reason: "history continuity failed",
          replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }
        }),
        historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M06":
      return makeBaseSuccessResult({
        alertSuppressionPersistence: buildSuppressionPersistence({
          continuityStatus: "passed",
          continuityReasonCategory: "ok",
          continuityReason: "suppression continuity notice: minor drift"
        }),
        suppressionStateRepair: {
          repairStatus: "repaired",
          repairAttempts: 1,
          lastRepairOutcome: "repaired",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: false
        },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M07":
      return makeBaseSuccessResult({
        alertSuppressionPersistence: buildSuppressionPersistence({
          continuityStatus: "failed",
          continuityReasonCategory: "suppression_key_mismatch",
          continuityReason: "suppression continuity failed"
        }),
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M08":
      return makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({
          commandLinkConsistencyStatus: "missing_record",
          commandLinkConsistencyReason: "record missing"
        })
      });
    case "M09":
      return makeBaseSuccessResult({
        suppressionStateRepairCommandLink: buildCommandLink({
          commandLinkConsistencyStatus: "status_mismatch",
          commandLinkConsistencyReason: "status mismatch"
        })
      });
    case "M10":
      return makeBaseSuccessResult({
        view: {
          factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-s24",
          subcaseType: "ADLCase",
          subcaseId: "adl-s24",
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
      });
    case "M11":
      return makeBaseSuccessResult({
        view: {
          factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-s24",
          subcaseType: "ADLCase",
          subcaseId: "adl-s24",
          currentReadViewStatus: "persisted",
          validationStatus: "passed",
          repairStatus: "repair_failed_retryable",
          repairAttempts: 1,
          manualConfirmation: false,
          assessmentRulesVersion: "1.0.0",
          riskLevel: "medium",
          manualActionHint: "retry_repair_recommended",
          riskReason: "incompatible version + suppression failed",
          actionHintReason: "repair needed",
          diagnosticSummary: "incompatible + continuity failed"
        },
        alertSuppressionPersistence: buildSuppressionPersistence({
          stateReadCompatibility: "incompatible_version",
          stateRepairRecommended: true,
          continuityStatus: "failed",
          continuityReasonCategory: "suppression_key_mismatch",
          continuityReason: "suppression continuity failed",
          suppressionStateRepair: {
            repairStatus: "repair_failed_retryable",
            repairAttempts: 1,
            lastRepairOutcome: "failed",
            manualConfirmation: false,
            targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
            canRetry: true,
            canConfirmManually: true
          }
        }),
        suppressionStateRepair: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 1,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
          canRetry: true,
          canConfirmManually: true
        },
        suppressionStateRepairCommandLink: buildCommandLink()
      });
    case "M12":
      return makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency({
          status: "failed",
          reason: "history continuity failed",
          replayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" }
        }),
        historyReplayValidation: { status: "failed", reasonCategory: "current_snapshot_conflict", reason: "history replay failed" },
        suppressionStateRepairCommandLink: buildCommandLink({
          commandLinkConsistencyStatus: "status_mismatch",
          commandLinkConsistencyReason: "status mismatch"
        })
      });
    default:
      throw new Error(`Unknown matrix scenario: ${matrixId}`);
  }
};

describe("Step 24: scenario matrix regression", () => {
  it("validates all 12 scenario matrix entries against core fields", async () => {
    expect(PHASE2_AGGREGATE_SCENARIO_MATRIX.length).toBeGreaterThanOrEqual(12);

    for (const entry of PHASE2_AGGREGATE_SCENARIO_MATRIX) {
      const input = buildScenarioInput(entry.matrixId);
      const { aggregate } = await runAggregateWithReaderResult(input);
      const projected = pickPhase2AggregateBaselineCoreFields(aggregate);

      for (const [field, expected] of Object.entries(entry.expectedCoreFields)) {
        const actual = projected[field as keyof typeof projected];
        expect(actual, `${entry.matrixId}/${entry.variantName}: ${field}`).toBe(expected);
      }
      expect(aggregate.explanationStatus, `${entry.matrixId}: outcome`).toBe(entry.expectedAggregateOutcome);
    }
  });

  it("preserves Step 23 six baselines intact", async () => {
    const step23Ids = ["A", "B", "C", "D", "E", "F"] as const;
    for (const id of step23Ids) {
      const baseline = getPhase2ScenarioBaselineById(id);
      expect(baseline, `Step 23 baseline ${id} still exists`).toBeDefined();
    }
    expect(PHASE2_AGGREGATE_SCENARIO_BASELINES.length).toBe(6);
  });
});

describe("Step 24: failure combination matrix regression", () => {
  it("validates all 3 failure combinations against expected fields", async () => {
    expect(PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX.length).toBeGreaterThanOrEqual(3);

    for (const combo of PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX) {
      let input: DiagnosticSuccessResult;
      switch (combo.combinationId) {
        case "FC01":
          input = makeBaseSuccessResult({
            view: {
              factKey: "risk-case-s24|ADLCase|adl-s24|2026-03-25T00:00:02.000Z",
              riskCaseId: "risk-case-s24",
              subcaseType: "ADLCase",
              subcaseId: "adl-s24",
              currentReadViewStatus: "persisted",
              validationStatus: "failed",
              repairStatus: "repair_failed_manual_confirmation_required",
              repairAttempts: 3,
              manualConfirmation: false,
              assessmentRulesVersion: "1.0.0",
              riskLevel: "high",
              manualActionHint: "investigate_validation_conflict",
              riskReason: "validation conflict + manual confirmation",
              actionHintReason: "investigate + manual",
              diagnosticSummary: "validation conflict + manual review"
            },
            readAlert: {
              severity: "critical",
              alertCode: "TQ-DIAG-CRIT-CURRENT_SNAPSHOT_CONFLICT",
              alertSummary: "conflict",
              operationalHint: "inspect_snapshot_conflict",
              triggerSource: "replay_validation",
              requiresAttention: true
            },
            suppressionStateRepair: {
              repairStatus: "repair_failed_manual_confirmation_required",
              repairAttempts: 3,
              lastRepairOutcome: "failed",
              manualConfirmation: false,
              targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
              canRetry: false,
              canConfirmManually: true
            },
            suppressionStateRepairCommandLink: buildCommandLink()
          });
          break;
        case "FC02":
          input = buildScenarioInput("M11");
          break;
        case "FC03":
          input = buildScenarioInput("M12");
          break;
        default:
          throw new Error(`Unknown combination: ${combo.combinationId}`);
      }

      const { aggregate } = await runAggregateWithReaderResult(input);

      expect(aggregate.requiresAttention, `${combo.combinationId}: attention`).toBe(combo.expectedRequiresAttention);
      expect(aggregate.requiresRepairAction, `${combo.combinationId}: repair`).toBe(combo.expectedRequiresRepairAction);
      expect(aggregate.requiresManualReview, `${combo.combinationId}: manual`).toBe(combo.expectedRequiresManualReview);
      expect(aggregate.isCrossSessionConsistent, `${combo.combinationId}: consistent`).toBe(combo.expectedIsCrossSessionConsistent);
      expect(aggregate.explanationStatus, `${combo.combinationId}: explanation`).toBe(combo.expectedExplanationStatus);
      expect(aggregate.recommendedNextStep, `${combo.combinationId}: nextStep`).toBe(combo.expectedRecommendedNextStep);
      expect(
        aggregate.primaryReason.toLowerCase().includes(combo.expectedPrimaryReasonPattern.toLowerCase()),
        `${combo.combinationId}: primaryReason should contain "${combo.expectedPrimaryReasonPattern}" but was "${aggregate.primaryReason}"`
      ).toBe(true);
    }
  });

  it("Step 23 failure baselines remain intact under Step 24 additions", async () => {
    const step23FailureKeys = Object.keys(PHASE2_AGGREGATE_FAILURE_BASELINES) as Array<keyof typeof PHASE2_AGGREGATE_FAILURE_BASELINES>;
    expect(step23FailureKeys.length).toBe(6);
    for (const key of step23FailureKeys) {
      expect(PHASE2_AGGREGATE_FAILURE_BASELINES[key]).toBeDefined();
    }
  });
});

describe("Step 24: difference report", () => {
  it("produces matched=true for baseline-aligned scenarios", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const input = buildScenarioInput("M01");
    const { aggregate } = await runAggregateWithReaderResult(input);

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: "M01"
    });

    expect(report.matched).toBe(true);
    expect(report.mismatchedCoreFields.length).toBe(0);
    expect(report.consistencyStatus).toBe("passed");
    expect(report.failureSemanticMatch).toBe(true);
    expect(report.reportId).toBe("M01@A");
    expect(report.reportSummary).toContain("match");
  });

  it("produces matched=false with mismatch details when fields drift", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const input = buildScenarioInput("M02");
    const { aggregate } = await runAggregateWithReaderResult(input);

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: "M02-vs-A"
    });

    expect(report.matched).toBe(false);
    expect(report.mismatchedCoreFields.length).toBeGreaterThan(0);
    expect(report.differenceSummaries.length).toBeGreaterThan(0);
    expect(report.consistencyStatus).toBe("failed");

    for (const diff of report.differenceSummaries) {
      expect(diff.field).toBeDefined();
      expect(diff.expected).toBeDefined();
      expect(diff.actual).toBeDefined();
    }
  });

  it("correctly assesses failureSemanticMatch via combination entry", async () => {
    const combo = PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX[2]!;
    const input = buildScenarioInput("M12");
    const { aggregate } = await runAggregateWithReaderResult(input);
    const baseline = getPhase2ScenarioBaselineById("D")!;

    const report = buildPhase2AggregateBaselineDifferenceReport({
      baseline,
      aggregate,
      scenarioOrCombinationId: combo.combinationId,
      failureCombination: combo
    });

    expect(report.failureSemanticMatch).toBe(true);
    expect(report.scenarioOrCombinationId).toBe("FC03");
  });

  it("difference report builder is reusable across all matrix entries", async () => {
    for (const entry of PHASE2_AGGREGATE_SCENARIO_MATRIX.slice(0, 6)) {
      const input = buildScenarioInput(entry.matrixId);
      const { aggregate } = await runAggregateWithReaderResult(input);
      const baseline = getPhase2ScenarioBaselineById(entry.baselineId) ?? getPhase2ScenarioBaselineById("A")!;

      const report = buildPhase2AggregateBaselineDifferenceReport({
        baseline,
        aggregate,
        scenarioOrCombinationId: entry.matrixId
      });

      expect(report.reportId).toContain(entry.matrixId);
      expect(report.matchedCoreFields.length + report.mismatchedCoreFields.length).toBe(9);
    }
  });
});

describe("Step 24: cross-entry consistency regression", () => {
  it("basic query -> aggregate query: load-bearing fields stable", async () => {
    const input = buildScenarioInput("M01");
    const { aggregate: first } = await runAggregateWithReaderResult(input);
    const { aggregate: second } = await runAggregateWithReaderResult(input);

    const baseline = getPhase2ScenarioBaselineById("A")!;
    const consistency = assertCoreCaseAggregateBaselineConsistency({
      baseline,
      aggregate: first,
      comparedAggregates: [second],
      diagnosticBaseResult: input
    });
    expect(consistency.status).toBe("passed");
  });

  it("repair -> aggregate: core fields stable after repair", async () => {
    const repaired = makeBaseSuccessResult({
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence(),
      suppressionStateRepair: {
        repairStatus: "repaired",
        repairAttempts: 1,
        lastRepairOutcome: "repaired",
        manualConfirmation: false,
        targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
        canRetry: false,
        canConfirmManually: false
      },
      suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "repair", lastCommandOutcome: "repaired" })
    });
    const { aggregate } = await runAggregateWithReaderResult(repaired);
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const consistency = assertCoreCaseAggregateBaselineConsistency({ baseline, aggregate, diagnosticBaseResult: repaired });
    expect(consistency.status).toBe("passed");
  });

  it("retry -> aggregate: core fields stable after retry", async () => {
    const retried = makeBaseSuccessResult({
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence(),
      suppressionStateRepair: {
        repairStatus: "repaired",
        repairAttempts: 2,
        lastRepairOutcome: "repaired",
        manualConfirmation: false,
        targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
        canRetry: false,
        canConfirmManually: false
      },
      suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "repaired" })
    });
    const { aggregate } = await runAggregateWithReaderResult(retried);
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const consistency = assertCoreCaseAggregateBaselineConsistency({ baseline, aggregate, diagnosticBaseResult: retried });
    expect(consistency.status).toBe("passed");
  });

  it("confirm -> aggregate: core fields stable after confirm", async () => {
    const confirmed = makeBaseSuccessResult({
      historyConsistency: buildHistoryConsistency(),
      alertSuppressionPersistence: buildSuppressionPersistence(),
      suppressionStateRepair: {
        repairStatus: "repaired",
        repairAttempts: 3,
        lastRepairOutcome: "manually_confirmed",
        manualConfirmation: true,
        targetSuppressionKey: "risk-case-s24|current_snapshot_conflict",
        canRetry: false,
        canConfirmManually: false
      },
      suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "manually_confirmed" })
    });
    const { aggregate } = await runAggregateWithReaderResult(confirmed);
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const consistency = assertCoreCaseAggregateBaselineConsistency({ baseline, aggregate, diagnosticBaseResult: confirmed });
    expect(consistency.status).toBe("passed");
  });

  it("new session aggregate -> aggregate baseline: cross-session stable", async () => {
    const factKey = "risk-case-s24-xsession|ADLCase|adl-s24-xsession|2026-03-25T00:00:02.000Z";
    const suppressionKey = `${factKey}|current_snapshot_conflict`;

    const coordinationStore = new FakeCoordinationResultStore();
    await coordinationStore.put({
      schemaVersion: COORDINATION_RESULT_STORE_SCHEMA_VERSION,
      factKey,
      riskCaseId: "risk-case-s24-xsession",
      subcaseType: "ADLCase",
      subcaseId: "adl-s24-xsession",
      signalCategory: "normal",
      decision: "applied",
      resolutionAction: "MarkRiskCaseResolvedAfterSubcaseCompletion",
      beforeState: "Settling",
      afterState: "Closed",
      conflictDetected: false,
      hasOtherActiveSubcases: false,
      selectedPriority: 2,
      auditRecordSummary: {
        auditId: "audit-s24-xsession",
        caseType: "RiskCase",
        action: "CoordinateRiskCaseAfterSubcaseTerminal",
        reason: "cross-session step24",
        relatedCaseType: "ADLCase",
        relatedCaseId: "adl-s24-xsession",
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

    const newRegistry = new CoordinationResultRegistry();
    const newObservation = new CoordinationResultObservationRegistry();
    newObservation.record({
      scope: "query",
      factKey,
      riskCaseId: "risk-case-s24-xsession",
      subcaseType: "ADLCase",
      subcaseId: "adl-s24-xsession",
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
    const newRepairHandler = new CoordinationResultRepairCommandHandler({
      coordinationResultRegistry: newRegistry,
      coordinationResultStore: coordinationStore,
      coordinationObservationRegistry: newObservation
    });
    newRepairHandler.getRepairRecordRegistry().transitionRepairState({
      factKey,
      to: "repaired",
      outcome: "repaired",
      repairAttempts: 1,
      manualConfirmation: false,
      updatedAt: "2026-03-25T00:00:03.000Z"
    });

    const diagnosticHandler = new CoordinationResultDiagnosticQueryHandler({
      coordinationResultStore: coordinationStore,
      coordinationResultRegistry: newRegistry,
      coordinationObservationRegistry: newObservation,
      repairRecordRegistry: newRepairHandler.getRepairRecordRegistry(),
      diagnosticHistoryStore: historyStore,
      alertSuppressionStore: suppressionStore,
      alertSuppressionRepairLifecycleStore: lifecycleStore,
      alertSuppressionRepairCommandRecordStore: commandStore
    });
    const aggregateHandler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: diagnosticHandler });
    const result = await aggregateHandler.handle({ factKey, includeHistoryComparison: true });
    const aggregate = expectAggregate(result);

    expect(aggregate.requiresAttention).toBe(true);
    expect(aggregate.isCrossSessionConsistent).toBe(false);
    expect(aggregate.explanationStatus).toBe("inconsistent");

    const frozen = assertCoreCaseAggregateFailureSemanticFrozen({
      failureSemantic: "command_link_missing_record",
      aggregate
    });
    expect(frozen.status).toBe("passed");
  });

  it("repair/retry/confirm paths produce stable core fields when all succeed", async () => {
    const baseline = getPhase2ScenarioBaselineById("A")!;
    const variants = [
      makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence(),
        suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 1, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: "risk-case-s24|current_snapshot_conflict", canRetry: false, canConfirmManually: false },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "repair", lastCommandOutcome: "repaired" })
      }),
      makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence(),
        suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 2, lastRepairOutcome: "repaired", manualConfirmation: false, targetSuppressionKey: "risk-case-s24|current_snapshot_conflict", canRetry: false, canConfirmManually: false },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "retry", lastCommandOutcome: "repaired" })
      }),
      makeBaseSuccessResult({
        historyConsistency: buildHistoryConsistency(),
        alertSuppressionPersistence: buildSuppressionPersistence(),
        suppressionStateRepair: { repairStatus: "repaired", repairAttempts: 3, lastRepairOutcome: "manually_confirmed", manualConfirmation: true, targetSuppressionKey: "risk-case-s24|current_snapshot_conflict", canRetry: false, canConfirmManually: false },
        suppressionStateRepairCommandLink: buildCommandLink({ lastCommandType: "confirm", lastCommandOutcome: "manually_confirmed" })
      })
    ];

    const aggregates = await Promise.all(variants.map(async (v) => (await runAggregateWithReaderResult(v)).aggregate));
    const consistency = assertCoreCaseAggregateBaselineConsistency({
      baseline,
      aggregate: aggregates[0]!,
      comparedAggregates: [aggregates[1]!, aggregates[2]!],
      diagnosticBaseResult: variants[0]!
    });
    expect(consistency.status).toBe("passed");
  });
});
