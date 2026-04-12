import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";

export type OrchestrationPathConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

const REQUIRED_RESULT_FIELDS: readonly (keyof RiskCaseOrchestrationResult)[] = [
  "orchestrationId", "caseId", "configVersion", "sagaStatus",
  "idempotencyStatus", "executedSteps", "pendingCompensation",
  "auditEventSummary", "resultStatus", "resultSummary"
];

export const assertOrchestrationPathConsistency = (
  pathALabel: string,
  pathAResult: RiskCaseOrchestrationResult,
  pathBLabel: string,
  pathBResult: RiskCaseOrchestrationResult
): OrchestrationPathConsistencyResult => {
  const violations: string[] = [];

  for (const field of REQUIRED_RESULT_FIELDS) {
    if (pathAResult[field] === undefined) {
      violations.push(`${pathALabel} missing field: ${field}`);
    }
    if (pathBResult[field] === undefined) {
      violations.push(`${pathBLabel} missing field: ${field}`);
    }
  }

  if (pathAResult.sagaStatus === "completed" && pathAResult.pendingCompensation.needed) {
    violations.push(`${pathALabel}: saga completed but compensation still needed`);
  }
  if (pathBResult.sagaStatus === "completed" && pathBResult.pendingCompensation.needed) {
    violations.push(`${pathBLabel}: saga completed but compensation still needed`);
  }

  if (pathAResult.sagaStatus === "compensation_required" && pathAResult.compensationResult == null && !pathAResult.pendingCompensation.needed) {
    violations.push(`${pathALabel}: compensation_required but no plan and no result`);
  }
  if (pathBResult.sagaStatus === "compensation_required" && pathBResult.compensationResult == null && !pathBResult.pendingCompensation.needed) {
    violations.push(`${pathBLabel}: compensation_required but no plan and no result`);
  }

  if (pathAResult.replayedFromPreviousResult && pathAResult.idempotencyStatus !== "replayed_same_result") {
    violations.push(`${pathALabel}: replayed but idempotencyStatus is not replayed_same_result`);
  }
  if (pathBResult.replayedFromPreviousResult && pathBResult.idempotencyStatus !== "replayed_same_result") {
    violations.push(`${pathBLabel}: replayed but idempotencyStatus is not replayed_same_result`);
  }

  const aHasAudit = pathAResult.auditEventSummary.length > 0;
  const bHasAudit = pathBResult.auditEventSummary.length > 0;
  if (aHasAudit !== bHasAudit) {
    violations.push("Audit event summary presence differs between paths");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};
