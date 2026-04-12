import { CaseStage } from "./case-stage.js";
import { CaseState } from "./case-state.js";

export const stageByState: Readonly<Record<CaseState, CaseStage>> = {
  [CaseState.Detected]: CaseStage.Detection,
  [CaseState.Validating]: CaseStage.Validation,
  [CaseState.Classified]: CaseStage.Classification,
  [CaseState.Liquidating]: CaseStage.Liquidation,
  [CaseState.FundAbsorbing]: CaseStage.FundAbsorption,
  [CaseState.EvaluatingADL]: CaseStage.ADLEvaluation,
  [CaseState.PlanningADL]: CaseStage.ADLPlanning,
  [CaseState.ExecutingADL]: CaseStage.ADLExecution,
  [CaseState.Settling]: CaseStage.Settlement,
  [CaseState.Closed]: CaseStage.Completed,
  [CaseState.Failed]: CaseStage.Failure,
  [CaseState.ManualInterventionRequired]: CaseStage.ManualIntervention
};

export const resolveStageForState = (state: CaseState): CaseStage => stageByState[state];

export const isStageMatchingState = (state: CaseState, stage: CaseStage): boolean =>
  resolveStageForState(state) === stage;
