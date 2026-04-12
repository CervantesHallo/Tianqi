import { CaseState } from "@tianqi/domain";

export const RISK_CASE_STATES_ALLOW_DERIVE_SPECIAL_CASE: readonly CaseState[] = [
  CaseState.Classified
];

export const RISK_CASE_STATES_ALLOW_SPECIAL_CASE_TRANSITION: readonly CaseState[] = [
  CaseState.Classified,
  CaseState.Liquidating,
  CaseState.FundAbsorbing,
  CaseState.EvaluatingADL,
  CaseState.PlanningADL,
  CaseState.ExecutingADL,
  CaseState.Settling
];

export const isRiskCaseStateAllowedForDerivation = (state: CaseState): boolean =>
  RISK_CASE_STATES_ALLOW_DERIVE_SPECIAL_CASE.includes(state);

export const isRiskCaseStateAllowedForSpecialCaseTransition = (state: CaseState): boolean =>
  RISK_CASE_STATES_ALLOW_SPECIAL_CASE_TRANSITION.includes(state);
