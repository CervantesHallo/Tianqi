import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";

export type CoreCaseDiagnosticAggregateConsistency = {
  readonly status: "passed" | "failed";
  readonly reason: string;
};

export const validateCoreCaseDiagnosticAggregateConsistency = (input: {
  readonly aggregate: CoreCaseDiagnosticAggregateView;
}): CoreCaseDiagnosticAggregateConsistency => {
  const aggregate = input.aggregate;
  if (aggregate.riskLevel === "high" && !aggregate.requiresAttention) {
    return {
      status: "failed",
      reason: "riskLevel=high requires requiresAttention=true"
    };
  }
  if (aggregate.readAlert?.requiresAttention === true && !aggregate.requiresAttention) {
    return {
      status: "failed",
      reason: "readAlert.requiresAttention=true requires aggregate.requiresAttention=true"
    };
  }
  if (aggregate.manualActionHint === "retry_repair_recommended" && !aggregate.requiresRepairAction) {
    return {
      status: "failed",
      reason: "manualActionHint=retry_repair_recommended requires requiresRepairAction=true"
    };
  }
  if (aggregate.suppressionStateRepair?.canRetry === true && !aggregate.requiresRepairAction) {
    return {
      status: "failed",
      reason: "suppressionStateRepair.canRetry=true requires requiresRepairAction=true"
    };
  }
  if (
    aggregate.suppressionStateRepair?.repairStatus === "repair_failed_manual_confirmation_required" &&
    !aggregate.requiresManualReview
  ) {
    return {
      status: "failed",
      reason: "manual-confirmation-required repair status requires requiresManualReview=true"
    };
  }
  if (
    aggregate.suppressionStateRepairCommandLink &&
    aggregate.suppressionStateRepairCommandLink.commandLinkConsistencyStatus !== "passed" &&
    aggregate.isCrossSessionConsistent
  ) {
    return {
      status: "failed",
      reason: "command-link consistency failure cannot coexist with isCrossSessionConsistent=true"
    };
  }
  if (aggregate.historyReplayValidation?.status === "failed" && aggregate.explanationStatus === "fully_explained") {
    return {
      status: "failed",
      reason: "historyReplayValidation=failed cannot be fully_explained"
    };
  }
  return {
    status: "passed",
    reason: "aggregate consistency passed"
  };
};

