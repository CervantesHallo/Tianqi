import { ADLCaseState } from "./adl-case-state.js";
import { CaseState } from "./case-state.js";
import { LiquidationCaseState } from "./liquidation-case-state.js";

// Phase 2 / Step 1 keeps the smallest useful subset for RiskCase while preserving existing aggregate.
export const RISK_CASE_PHASE2_STEP1_MINIMAL_STATES = [
  CaseState.Detected,
  CaseState.Validating,
  CaseState.Classified,
  CaseState.Closed
] as const;

export const LIQUIDATION_CASE_PHASE2_STEP1_MINIMAL_STATES = [
  LiquidationCaseState.Initiated,
  LiquidationCaseState.InProgress,
  LiquidationCaseState.Completed,
  LiquidationCaseState.Failed
] as const;

export const ADL_CASE_PHASE2_STEP1_MINIMAL_STATES = [
  ADLCaseState.Initiated,
  ADLCaseState.Queued,
  ADLCaseState.Executed,
  ADLCaseState.Failed
] as const;
