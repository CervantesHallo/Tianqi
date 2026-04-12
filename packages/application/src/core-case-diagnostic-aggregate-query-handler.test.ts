import { describe, expect, it } from "vitest";

import { CoreCaseDiagnosticAggregateQueryHandler } from "./core-case-diagnostic-aggregate-query-handler.js";
import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";

class FakeDiagnosticQueryReader {
  public nextResult: CoordinationResultDiagnosticQueryResult;
  public readonly calls: Array<{ readonly factKey: string; readonly includeHistoryComparison?: boolean }> = [];

  public constructor(result: CoordinationResultDiagnosticQueryResult) {
    this.nextResult = result;
  }

  public async handle(query: { readonly factKey: string; readonly includeHistoryComparison?: boolean }) {
    this.calls.push(query);
    return this.nextResult;
  }
}

const makeBaseSuccessResult = (input?: Partial<Extract<CoordinationResultDiagnosticQueryResult, { success: true }>>) =>
  ({
    success: true as const,
    view: {
      factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z",
      riskCaseId: "risk-case-agg",
      subcaseType: "ADLCase",
      subcaseId: "adl-agg",
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
  }) satisfies Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

describe("CoreCaseDiagnosticAggregateQueryHandler", () => {
  it("returns fully_explained for normal stable chain", async () => {
    const reader = new FakeDiagnosticQueryReader(makeBaseSuccessResult());
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });

    const result = await handler.handle({ factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.aggregateView.explanationStatus).toBe("fully_explained");
      expect(result.aggregateView.requiresAttention).toBe(false);
      expect(result.aggregateView.requiresRepairAction).toBe(false);
      expect(result.aggregateView.isCrossSessionConsistent).toBe(true);
      expect(result.consistencyStatus).toBe("passed");
    }
    expect(reader.calls).toHaveLength(1);
    expect(reader.calls[0]?.includeHistoryComparison).toBe(true);
  });

  it("returns repair action guidance when lifecycle is retryable", async () => {
    const reader = new FakeDiagnosticQueryReader(
      makeBaseSuccessResult({
        view: {
          factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-agg",
          subcaseType: "ADLCase",
          subcaseId: "adl-agg",
          currentReadViewStatus: "fallback_only",
          validationStatus: "passed",
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          manualConfirmation: false,
          assessmentRulesVersion: "1.0.0",
          riskLevel: "medium",
          manualActionHint: "retry_repair_recommended",
          riskReason: "retryable",
          actionHintReason: "retry recommended",
          diagnosticSummary: "retryable"
        },
        suppressionStateRepair: {
          repairStatus: "repair_failed_retryable",
          repairAttempts: 2,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-agg|current_snapshot_conflict",
          canRetry: true,
          canConfirmManually: true
        }
      })
    );
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });

    const result = await handler.handle({ factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.aggregateView.requiresRepairAction).toBe(true);
      expect(result.aggregateView.recommendedNextStep).toBe("execute_controlled_repair_or_retry");
      expect(result.aggregateView.explanationStatus).toBe("attention_required");
    }
  });

  it("returns manual review guidance when manual-confirmation signals are present", async () => {
    const reader = new FakeDiagnosticQueryReader(
      makeBaseSuccessResult({
        view: {
          factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z",
          riskCaseId: "risk-case-agg",
          subcaseType: "ADLCase",
          subcaseId: "adl-agg",
          currentReadViewStatus: "fallback_only",
          validationStatus: "failed",
          repairStatus: "repair_failed_manual_confirmation_required",
          repairAttempts: 2,
          manualConfirmation: false,
          assessmentRulesVersion: "1.0.0",
          riskLevel: "high",
          manualActionHint: "manual_confirmation_recommended",
          riskReason: "manual confirmation required",
          actionHintReason: "operator should confirm",
          diagnosticSummary: "manual"
        },
        readAlert: {
          severity: "critical",
          alertCode: "TQ-DIAG-CRIT-STATUS_FIELD_CONFLICT",
          alertSummary: "critical conflict",
          operationalHint: "manual_diagnostic_review_required",
          triggerSource: "replay_validation",
          requiresAttention: true
        },
        suppressionStateRepair: {
          repairStatus: "repair_failed_manual_confirmation_required",
          repairAttempts: 2,
          lastRepairOutcome: "failed",
          manualConfirmation: false,
          targetSuppressionKey: "risk-case-agg|current_snapshot_conflict",
          canRetry: false,
          canConfirmManually: true
        }
      })
    );
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });
    const result = await handler.handle({ factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.aggregateView.requiresManualReview).toBe(true);
      expect(result.aggregateView.requiresAttention).toBe(true);
      expect(result.aggregateView.recommendedNextStep).toBe("perform_manual_review_and_confirmation");
    }
  });

  it("marks inconsistent when continuity/accountability chain fails", async () => {
    const reader = new FakeDiagnosticQueryReader(
      makeBaseSuccessResult({
        historyConsistency: {
          status: "failed",
          reason: "history continuity failed",
          replayValidation: {
            status: "failed",
            reasonCategory: "current_snapshot_conflict",
            reason: "conflict"
          }
        },
        suppressionStateRepairCommandLink: {
          lastCommandType: "retry",
          lastCommandOutcome: "repaired",
          lastCommandTriggeredAt: "2026-03-25T00:00:03.000Z",
          commandLinkConsistencyStatus: "status_mismatch",
          commandLinkConsistencyReason: "status mismatch"
        }
      })
    );
    const handler = new CoreCaseDiagnosticAggregateQueryHandler({ diagnosticQueryReader: reader });
    const result = await handler.handle({ factKey: "risk-case-agg|ADLCase|adl-agg|2026-03-25T00:00:02.000Z" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.aggregateView.isCrossSessionConsistent).toBe(false);
      expect(result.aggregateView.explanationStatus).toBe("inconsistent");
      expect(result.aggregateView.requiresAttention).toBe(true);
    }
  });
});

