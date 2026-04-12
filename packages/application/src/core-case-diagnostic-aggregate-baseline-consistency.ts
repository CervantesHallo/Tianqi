import type { CoordinationResultDiagnosticQueryResult } from "./coordination-result-diagnostic-query-model.js";
import type { CoreCaseDiagnosticAggregateView } from "./core-case-diagnostic-aggregate-view.js";
import {
  PHASE2_AGGREGATE_BASELINE_CORE_FIELDS,
  PHASE2_AGGREGATE_FAILURE_BASELINES,
  type CoreCaseDiagnosticAggregateBaseline,
  type Phase2AggregateFailureSemantic
} from "./core-case-diagnostic-aggregate-baseline.js";

type SuccessfulDiagnosticQueryResult = Extract<CoordinationResultDiagnosticQueryResult, { success: true }>;

export type Phase2AggregateBaselineCoreField = (typeof PHASE2_AGGREGATE_BASELINE_CORE_FIELDS)[number];
export type Phase2AggregateBaselineCoreFieldProjection = Pick<CoreCaseDiagnosticAggregateView, Phase2AggregateBaselineCoreField>;

export type CoreCaseAggregateBaselineConsistency = {
  readonly status: "passed" | "failed";
  readonly reason: string;
};

export const pickPhase2AggregateBaselineCoreFields = (
  aggregate: CoreCaseDiagnosticAggregateView
): Phase2AggregateBaselineCoreFieldProjection => ({
  riskLevel: aggregate.riskLevel,
  manualActionHint: aggregate.manualActionHint,
  requiresAttention: aggregate.requiresAttention,
  requiresRepairAction: aggregate.requiresRepairAction,
  requiresManualReview: aggregate.requiresManualReview,
  isCrossSessionConsistent: aggregate.isCrossSessionConsistent,
  explanationStatus: aggregate.explanationStatus,
  aggregateSummary: aggregate.aggregateSummary,
  recommendedNextStep: aggregate.recommendedNextStep
});

const fail = (reason: string): CoreCaseAggregateBaselineConsistency => ({
  status: "failed",
  reason
});

export const assertCoreCaseAggregateBaselineConsistency = (input: {
  readonly baseline: CoreCaseDiagnosticAggregateBaseline;
  readonly aggregate: CoreCaseDiagnosticAggregateView;
  readonly comparedAggregates?: readonly CoreCaseDiagnosticAggregateView[];
  readonly diagnosticBaseResult?: SuccessfulDiagnosticQueryResult;
}): CoreCaseAggregateBaselineConsistency => {
  const aggregate = input.aggregate;
  const baseline = input.baseline;

  if (aggregate.aggregateSummary !== baseline.expectedAggregateSummary) {
    return fail("aggregateSummary mismatches expected baseline summary");
  }
  if (aggregate.requiresAttention !== baseline.expectedRequiresAttention) {
    return fail("requiresAttention mismatches expected baseline");
  }
  if (aggregate.requiresRepairAction !== baseline.expectedRequiresRepairAction) {
    return fail("requiresRepairAction mismatches expected baseline");
  }
  if (aggregate.requiresManualReview !== baseline.expectedRequiresManualReview) {
    return fail("requiresManualReview mismatches expected baseline");
  }
  if (aggregate.isCrossSessionConsistent !== baseline.expectedIsCrossSessionConsistent) {
    return fail("isCrossSessionConsistent mismatches expected baseline");
  }
  if (aggregate.explanationStatus !== baseline.expectedExplanationStatus) {
    return fail("explanationStatus mismatches expected baseline");
  }
  if (aggregate.riskLevel !== baseline.expectedRiskLevel) {
    return fail("riskLevel mismatches expected baseline");
  }
  if (aggregate.manualActionHint !== baseline.expectedManualActionHint) {
    return fail("manualActionHint mismatches expected baseline");
  }
  if (
    baseline.expectedReadAlertSeverity &&
    aggregate.readAlert?.severity !== baseline.expectedReadAlertSeverity
  ) {
    return fail("readAlert.severity mismatches expected baseline");
  }
  if (
    baseline.expectedRepairStatus &&
    aggregate.suppressionStateRepair?.repairStatus !== baseline.expectedRepairStatus
  ) {
    return fail("suppressionStateRepair.repairStatus mismatches expected baseline");
  }
  if (
    baseline.expectedCommandLinkStatus &&
    aggregate.suppressionStateRepairCommandLink?.commandLinkConsistencyStatus !== baseline.expectedCommandLinkStatus
  ) {
    return fail("suppressionStateRepairCommandLink.commandLinkConsistencyStatus mismatches expected baseline");
  }

  if (!aggregate.isCrossSessionConsistent && aggregate.explanationStatus !== "inconsistent") {
    return fail("cross-session inconsistency requires explanationStatus=inconsistent");
  }
  if (
    aggregate.suppressionStateRepairCommandLink &&
    aggregate.suppressionStateRepairCommandLink.commandLinkConsistencyStatus !== "passed" &&
    aggregate.isCrossSessionConsistent
  ) {
    return fail("command-link inconsistency cannot coexist with isCrossSessionConsistent=true");
  }

  if (input.diagnosticBaseResult) {
    const base = input.diagnosticBaseResult;
    if (base.view.factKey !== aggregate.factKey) {
      return fail("diagnostic query factKey mismatches aggregate factKey");
    }
    if (base.view.riskLevel !== aggregate.riskLevel) {
      return fail("diagnostic query riskLevel mismatches aggregate riskLevel");
    }
    if (base.view.manualActionHint !== aggregate.manualActionHint) {
      return fail("diagnostic query manualActionHint mismatches aggregate manualActionHint");
    }
    if (base.view.validationStatus !== aggregate.validationStatus) {
      return fail("diagnostic query validationStatus mismatches aggregate validationStatus");
    }
    if (base.readAlert && !aggregate.readAlert) {
      return fail("aggregate readAlert is missing while diagnostic query has readAlert");
    }
    if (base.readAlert && aggregate.readAlert && base.readAlert.severity !== aggregate.readAlert.severity) {
      return fail("diagnostic query readAlert.severity mismatches aggregate readAlert.severity");
    }
    if (base.suppressionStateRepair && !aggregate.suppressionStateRepair) {
      return fail("aggregate suppressionStateRepair is missing while diagnostic query has suppressionStateRepair");
    }
    if (
      base.suppressionStateRepair &&
      aggregate.suppressionStateRepair &&
      base.suppressionStateRepair.repairStatus !== aggregate.suppressionStateRepair.repairStatus
    ) {
      return fail("diagnostic query suppressionStateRepair.repairStatus mismatches aggregate");
    }
  }

  if (input.comparedAggregates && input.comparedAggregates.length > 0) {
    const current = pickPhase2AggregateBaselineCoreFields(aggregate);
    for (let index = 0; index < input.comparedAggregates.length; index += 1) {
      const compared = pickPhase2AggregateBaselineCoreFields(input.comparedAggregates[index]!);
      for (const field of PHASE2_AGGREGATE_BASELINE_CORE_FIELDS) {
        if (current[field] !== compared[field]) {
          return fail(`core field drift detected on comparedAggregates[${index}].${field}`);
        }
      }
    }
  }

  return {
    status: "passed",
    reason: "aggregate baseline consistency passed"
  };
};

export const assertCoreCaseAggregateFailureSemanticFrozen = (input: {
  readonly failureSemantic: Phase2AggregateFailureSemantic;
  readonly aggregate: CoreCaseDiagnosticAggregateView;
  readonly comparedAggregates?: readonly CoreCaseDiagnosticAggregateView[];
  readonly diagnosticBaseResult?: SuccessfulDiagnosticQueryResult;
}): CoreCaseAggregateBaselineConsistency =>
  assertCoreCaseAggregateBaselineConsistency({
    baseline: PHASE2_AGGREGATE_FAILURE_BASELINES[input.failureSemantic],
    aggregate: input.aggregate,
    ...(input.comparedAggregates ? { comparedAggregates: input.comparedAggregates } : {}),
    ...(input.diagnosticBaseResult ? { diagnosticBaseResult: input.diagnosticBaseResult } : {})
  });

