import type { StoredRiskCaseCoordinationResult } from "@tianqi/ports";

import { COORDINATION_RESULT_STORE_SCHEMA_VERSION } from "./coordination-result-store-schema.js";
import type { RiskCaseCoordinationResultView } from "./risk-case-coordination-result-read-view.js";

type CoordinationFactKeyInput = Pick<
  RiskCaseCoordinationResultView,
  "riskCaseId" | "subcaseType" | "subcaseId" | "occurredAt"
>;

export const buildCoordinationResultFactKey = (input: CoordinationFactKeyInput): string =>
  `${input.riskCaseId}|${input.subcaseType}|${input.subcaseId}|${input.occurredAt}`;

export const mapCoordinationResultViewToStoredRecord = (
  view: RiskCaseCoordinationResultView
): StoredRiskCaseCoordinationResult => ({
  schemaVersion: COORDINATION_RESULT_STORE_SCHEMA_VERSION,
  factKey: buildCoordinationResultFactKey(view),
  riskCaseId: view.riskCaseId,
  subcaseType: view.subcaseType,
  subcaseId: view.subcaseId,
  signalCategory: view.signalCategory,
  decision: view.decision,
  resolutionAction: view.resolutionAction,
  beforeState: view.beforeState,
  afterState: view.afterState,
  conflictDetected: view.conflictDetected,
  hasOtherActiveSubcases: view.hasOtherActiveSubcases,
  selectedPriority: view.selectedPriority,
  auditRecordSummary: {
    auditId: view.auditRecordSummary.auditId,
    caseType: view.auditRecordSummary.caseType,
    action: view.auditRecordSummary.action,
    reason: view.auditRecordSummary.reason,
    ...(view.auditRecordSummary.relatedCaseType
      ? { relatedCaseType: view.auditRecordSummary.relatedCaseType }
      : {}),
    ...(view.auditRecordSummary.relatedCaseId ? { relatedCaseId: view.auditRecordSummary.relatedCaseId } : {}),
    ...(view.auditRecordSummary.context ? { context: { ...view.auditRecordSummary.context } } : {}),
    occurredAt: view.auditRecordSummary.occurredAt
  },
  occurredAt: view.occurredAt,
  sourceCommandPath: view.sourceCommandPath
});

export const mapStoredCoordinationResultToReadView = (
  record: StoredRiskCaseCoordinationResult
): RiskCaseCoordinationResultView => ({
  riskCaseId: record.riskCaseId,
  subcaseType: record.subcaseType,
  subcaseId: record.subcaseId,
  signalCategory: record.signalCategory,
  decision: record.decision,
  resolutionAction: record.resolutionAction,
  beforeState: record.beforeState,
  afterState: record.afterState,
  conflictDetected: record.conflictDetected,
  hasOtherActiveSubcases: record.hasOtherActiveSubcases,
  selectedPriority: record.selectedPriority,
  auditRecordSummary: {
    auditId: record.auditRecordSummary.auditId,
    caseType: "RiskCase",
    action: record.auditRecordSummary.action,
    reason: record.auditRecordSummary.reason,
    ...(record.auditRecordSummary.relatedCaseType
      ? { relatedCaseType: record.auditRecordSummary.relatedCaseType }
      : {}),
    ...(record.auditRecordSummary.relatedCaseId ? { relatedCaseId: record.auditRecordSummary.relatedCaseId } : {}),
    ...(record.auditRecordSummary.context ? { context: { ...record.auditRecordSummary.context } } : {}),
    occurredAt: record.auditRecordSummary.occurredAt
  },
  occurredAt: record.occurredAt,
  sourceCommandPath: record.sourceCommandPath
});
