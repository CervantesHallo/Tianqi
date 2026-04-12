import { invalidApplicationCommandError } from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import type { CoreCaseAuditRecordView, CoreCaseFlowResult, CoreSubcaseKind } from "./core-case-flow-command-result.js";

export type CoordinationSourceCommandPath =
  | "subcase_transition_auto_coordination"
  | "explicit_coordination_command";

export type CoordinationAuditRecordSummaryView = {
  readonly auditId: string;
  readonly caseType: "RiskCase";
  readonly action: string;
  readonly reason: string;
  readonly relatedCaseType?: CoreSubcaseKind;
  readonly relatedCaseId?: string;
  readonly context?: Readonly<Record<string, string>>;
  readonly occurredAt: string;
};

export type RiskCaseCoordinationResultView = {
  readonly riskCaseId: string;
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
  readonly signalCategory: "normal" | "duplicate" | "late" | "replayed";
  readonly decision: "applied" | "deferred" | "rejected" | "ignored" | "duplicate";
  readonly resolutionAction: string;
  readonly beforeState: string;
  readonly afterState: string;
  readonly conflictDetected: boolean;
  readonly hasOtherActiveSubcases: boolean;
  readonly selectedPriority: number;
  readonly auditRecordSummary: CoordinationAuditRecordSummaryView;
  readonly occurredAt: string;
  readonly sourceCommandPath: CoordinationSourceCommandPath;
};

const toProjectedError = (reason: string, details?: Record<string, string>) =>
  invalidApplicationCommandError(reason, details);

const findRiskCoordinationAudit = (
  auditRecords: readonly CoreCaseAuditRecordView[],
  subcaseType: CoreSubcaseKind,
  subcaseId: string
): CoreCaseAuditRecordView | null =>
  auditRecords.find(
    (item) =>
      item.caseType === "RiskCase" &&
      item.relatedCaseType === subcaseType &&
      item.relatedCaseId === subcaseId &&
      typeof item.context === "object"
  ) ?? null;

export const projectCoreCaseFlowResultToCoordinationResultView = (input: {
  readonly result: CoreCaseFlowResult;
  readonly sourceCommandPath: CoordinationSourceCommandPath;
}):
  | {
      readonly ok: true;
      readonly value: RiskCaseCoordinationResultView;
    }
  | {
      readonly ok: false;
      readonly error: ApplicationError;
    } => {
  if (!input.result.success) {
    return {
      ok: false,
      error: toProjectedError("Cannot project failed command result to coordination read view", {
        operation: input.result.operation,
        errorCode: input.result.error.code
      })
    };
  }
  if (!input.result.resolution) {
    return {
      ok: false,
      error: toProjectedError("Command result does not include coordination resolution payload", {
        caseType: input.result.caseView.caseType,
        caseId: input.result.caseView.caseId
      })
    };
  }

  const resolution = input.result.resolution;
  const riskAudit = findRiskCoordinationAudit(input.result.auditRecords, resolution.subcaseType, resolution.subcaseId);
  if (!riskAudit) {
    return {
      ok: false,
      error: toProjectedError("Coordination read view requires RiskCase audit summary", {
        riskCaseId: resolution.riskCaseId,
        subcaseType: resolution.subcaseType,
        subcaseId: resolution.subcaseId
      })
    };
  }

  if (riskAudit.context?.arbitration_decision && riskAudit.context.arbitration_decision !== resolution.decision) {
    return {
      ok: false,
      error: toProjectedError("Audit summary decision mismatches coordination resolution", {
        auditDecision: riskAudit.context.arbitration_decision,
        resolutionDecision: resolution.decision
      })
    };
  }

  return {
    ok: true,
    value: {
      riskCaseId: resolution.riskCaseId,
      subcaseType: resolution.subcaseType,
      subcaseId: resolution.subcaseId,
      signalCategory: resolution.signalCategory,
      decision: resolution.decision,
      resolutionAction: resolution.action,
      beforeState: resolution.beforeState,
      afterState: resolution.afterState,
      conflictDetected: resolution.conflictDetected,
      hasOtherActiveSubcases: resolution.hasOtherActiveSubcases,
      selectedPriority: resolution.selectedPriority,
      auditRecordSummary: {
        auditId: riskAudit.auditId,
        caseType: "RiskCase",
        action: riskAudit.action,
        reason: riskAudit.reason,
        ...(riskAudit.relatedCaseType ? { relatedCaseType: riskAudit.relatedCaseType as CoreSubcaseKind } : {}),
        ...(riskAudit.relatedCaseId ? { relatedCaseId: riskAudit.relatedCaseId } : {}),
        ...(riskAudit.context ? { context: { ...riskAudit.context } } : {}),
        occurredAt: riskAudit.occurredAt
      },
      occurredAt: resolution.signalOccurredAt,
      sourceCommandPath: input.sourceCommandPath
    }
  };
};

const isEquivalentDecision = (
  baseline: RiskCaseCoordinationResultView["decision"],
  candidate: RiskCaseCoordinationResultView["decision"]
): boolean => {
  if (baseline === candidate) {
    return true;
  }
  if (
    (baseline === "applied" && candidate === "duplicate") ||
    (baseline === "duplicate" && candidate === "applied")
  ) {
    return true;
  }
  return false;
};

export const assertCoordinationResultViewsConsistent = (
  baseline: RiskCaseCoordinationResultView,
  candidate: RiskCaseCoordinationResultView
):
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string; readonly details: Record<string, string> } => {
  if (baseline.riskCaseId !== candidate.riskCaseId) {
    return {
      ok: false,
      reason: "riskCaseId mismatch",
      details: { baseline: baseline.riskCaseId, candidate: candidate.riskCaseId }
    };
  }
  if (baseline.subcaseType !== candidate.subcaseType || baseline.subcaseId !== candidate.subcaseId) {
    return {
      ok: false,
      reason: "subcase identity mismatch",
      details: {
        baseline: `${baseline.subcaseType}:${baseline.subcaseId}`,
        candidate: `${candidate.subcaseType}:${candidate.subcaseId}`
      }
    };
  }
  if (baseline.occurredAt !== candidate.occurredAt) {
    return {
      ok: false,
      reason: "signal occurredAt mismatch",
      details: { baseline: baseline.occurredAt, candidate: candidate.occurredAt }
    };
  }
  if (!isEquivalentDecision(baseline.decision, candidate.decision)) {
    return {
      ok: false,
      reason: "decision mismatch",
      details: { baseline: baseline.decision, candidate: candidate.decision }
    };
  }
  if (baseline.resolutionAction !== candidate.resolutionAction || baseline.afterState !== candidate.afterState) {
    return {
      ok: false,
      reason: "resolution action or after-state mismatch",
      details: {
        baseline: `${baseline.resolutionAction}:${baseline.afterState}`,
        candidate: `${candidate.resolutionAction}:${candidate.afterState}`
      }
    };
  }
  return { ok: true };
};
