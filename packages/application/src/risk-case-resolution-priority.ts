import { CaseState } from "@tianqi/domain";

import { RiskCaseResolutionAction } from "./risk-case-resolution-action.js";

export const RISK_CASE_RESOLUTION_PRIORITY = {
  [RiskCaseResolutionAction.MarkRiskCaseUnderReviewAfterSubcaseCompletion]: 1,
  [RiskCaseResolutionAction.MarkRiskCaseResolvedAfterSubcaseCompletion]: 2,
  [RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure]: 3
} as const;

export const getResolutionPriority = (action: RiskCaseResolutionAction): number =>
  RISK_CASE_RESOLUTION_PRIORITY[action];

export const getRiskCaseCurrentPriority = (state: CaseState): number => {
  if (state === CaseState.ManualInterventionRequired) {
    return 3;
  }
  if (state === CaseState.Closed) {
    return 2;
  }
  return 0;
};
