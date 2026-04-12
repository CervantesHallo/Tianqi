import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type {
  CoreCaseDiagnosticAggregateExplanationStatus,
  CoreCaseDiagnosticAggregateView
} from "./core-case-diagnostic-aggregate-view.js";

type SuccessfulDiagnosticQueryResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

const isFailureLikeRepairStatus = (
  status: CoreCaseDiagnosticAggregateView["suppressionStateRepair"] extends infer T
    ? T extends { repairStatus: infer S }
      ? S
      : never
    : never
): boolean => status === "repair_failed_retryable" || status === "repair_failed_manual_confirmation_required";

export const buildCoreCaseDiagnosticAggregateView = (
  input: SuccessfulDiagnosticQueryResult
): CoreCaseDiagnosticAggregateView => {
  const crossSessionConsistentBase =
    input.historyConsistency?.status !== "failed" &&
    input.alertSuppressionPersistence?.continuityStatus !== "failed" &&
    input.suppressionStateRepairPersistence?.continuityStatus !== "failed" &&
    (input.suppressionStateRepairCommandLink
      ? input.suppressionStateRepairCommandLink.commandLinkConsistencyStatus === "passed"
      : true);

  const requiresAttention =
    input.readAlert?.requiresAttention === true ||
    input.view.riskLevel === "high" ||
    input.historyReplayValidation?.status === "failed" ||
    (input.suppressionStateRepair ? isFailureLikeRepairStatus(input.suppressionStateRepair.repairStatus) : false) ||
    !crossSessionConsistentBase;

  const requiresRepairAction =
    input.suppressionStateRepair?.canRetry === true ||
    input.alertSuppressionPersistence?.stateRepairRecommended === true ||
    input.view.manualActionHint === "retry_repair_recommended";

  const requiresManualReview =
    input.view.manualActionHint === "manual_confirmation_recommended" ||
    input.view.manualActionHint === "investigate_validation_conflict" ||
    input.readAlert?.severity === "critical" ||
    input.suppressionStateRepair?.repairStatus === "repair_failed_manual_confirmation_required";

  const isCrossSessionConsistent = crossSessionConsistentBase;

  const explanationStatus: CoreCaseDiagnosticAggregateExplanationStatus = !isCrossSessionConsistent
    ? "inconsistent"
    : requiresAttention
      ? "attention_required"
      : requiresRepairAction || requiresManualReview
        ? "partially_explained"
        : "fully_explained";

  const recommendedNextStep = !isCrossSessionConsistent
    ? "investigate_cross_session_inconsistency"
    : requiresManualReview
      ? "perform_manual_review_and_confirmation"
      : requiresRepairAction
        ? "execute_controlled_repair_or_retry"
        : requiresAttention
          ? "inspect_current_alert_and_validation_signals"
          : "no_action_needed";

  const primaryReason = !isCrossSessionConsistent
    ? input.suppressionStateRepairCommandLink?.commandLinkConsistencyReason ??
      input.suppressionStateRepairPersistence?.continuityReason ??
      input.alertSuppressionPersistence?.continuityReason ??
      input.historyConsistency?.reason ??
      "Cross-session diagnostic consistency failed"
    : requiresManualReview
      ? "Manual review is required by current risk hint/alert/repair state"
      : requiresRepairAction
        ? "Repair action is required by retryability or repair recommendation"
        : requiresAttention
          ? "Attention is required by risk, replay validation or alert state"
          : "Current diagnostic chain is stable and explainable";

  const secondaryReason =
    input.historyComparisonNotice ??
    input.historyNotice ??
    (input.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus === "passed"
      ? "Lifecycle and latest command record are linked consistently"
      : undefined);

  const aggregateSummary =
    `risk=${input.view.riskLevel}; hint=${input.view.manualActionHint}; ` +
    `attention=${requiresAttention ? "yes" : "no"}; repair=${requiresRepairAction ? "yes" : "no"}; ` +
    `manual_review=${requiresManualReview ? "yes" : "no"}; consistent=${isCrossSessionConsistent ? "yes" : "no"}`;

  return {
    factKey: input.view.factKey,
    ...(input.view.riskCaseId ? { riskCaseId: input.view.riskCaseId } : {}),
    ...(input.view.subcaseType ? { subcaseType: input.view.subcaseType } : {}),
    ...(input.view.subcaseId ? { subcaseId: input.view.subcaseId } : {}),
    currentReadViewStatus: input.view.currentReadViewStatus,
    validationStatus: input.view.validationStatus,
    riskLevel: input.view.riskLevel,
    manualActionHint: input.view.manualActionHint,
    riskReason: input.view.riskReason,
    actionHintReason: input.view.actionHintReason,
    assessmentRulesVersion: input.view.assessmentRulesVersion,

    ...(input.historySource ? { historySource: input.historySource } : {}),
    ...(typeof input.historyAvailable === "boolean" ? { historyAvailable: input.historyAvailable } : {}),
    ...(input.historyConsistency ? { historyConsistency: input.historyConsistency } : {}),
    ...(input.historyReplayValidation ? { historyReplayValidation: input.historyReplayValidation } : {}),
    ...(input.historyConflictAttribution ? { historyConflictAttribution: input.historyConflictAttribution } : {}),
    ...(input.historyComparisonNotice ? { historyComparisonNotice: input.historyComparisonNotice } : {}),
    ...(input.comparisonResult ? { comparisonResult: input.comparisonResult } : {}),

    ...(input.readAlert ? { readAlert: input.readAlert } : {}),
    ...(input.alertSuppression ? { alertSuppression: input.alertSuppression } : {}),
    ...(input.alertSuppressionPersistence ? { alertSuppressionPersistence: input.alertSuppressionPersistence } : {}),

    ...(input.suppressionStateRepair ? { suppressionStateRepair: input.suppressionStateRepair } : {}),
    ...(input.suppressionStateRepairPersistence
      ? { suppressionStateRepairPersistence: input.suppressionStateRepairPersistence }
      : {}),
    ...(input.suppressionStateRepairCommandLink
      ? { suppressionStateRepairCommandLink: input.suppressionStateRepairCommandLink }
      : {}),

    aggregateSummary,
    primaryReason,
    ...(secondaryReason ? { secondaryReason } : {}),
    recommendedNextStep,
    requiresAttention,
    requiresRepairAction,
    requiresManualReview,
    isCrossSessionConsistent,
    explanationStatus
  };
};

