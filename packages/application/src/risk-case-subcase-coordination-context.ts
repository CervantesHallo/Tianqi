import { ADLCaseState, type ADLCase, LiquidationCaseState, type LiquidationCase } from "@tianqi/domain";

import type { CoreSubcaseKind } from "./core-case-flow-command-result.js";

export type SubcaseTerminalOutcome = "success" | "failure" | "non_terminal";

export type SubcaseTerminalSignal = {
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
  readonly subcaseState: string;
};

export type RiskCaseSubcaseSnapshot = {
  readonly subcaseType: CoreSubcaseKind;
  readonly subcaseId: string;
  readonly state: string;
  readonly terminalOutcome: SubcaseTerminalOutcome;
  readonly isTriggerSignal: boolean;
};

export type RiskCaseSubcaseCoordinationContext = {
  readonly triggerSignal: SubcaseTerminalSignal;
  readonly snapshots: readonly RiskCaseSubcaseSnapshot[];
  readonly hasOtherActiveSubcases: boolean;
  readonly terminalSuccessSignalCount: number;
  readonly terminalFailureSignalCount: number;
  readonly conflictDetected: boolean;
};

const toTerminalOutcome = (subcaseType: CoreSubcaseKind, state: string): SubcaseTerminalOutcome => {
  if (subcaseType === "LiquidationCase") {
    if (state === LiquidationCaseState.Completed) {
      return "success";
    }
    if (state === LiquidationCaseState.Failed) {
      return "failure";
    }
    return "non_terminal";
  }
  if (state === ADLCaseState.Executed) {
    return "success";
  }
  if (state === ADLCaseState.Failed) {
    return "failure";
  }
  return "non_terminal";
};

const toSnapshot = (
  subcaseType: CoreSubcaseKind,
  subcaseId: string,
  state: string,
  triggerSignal: SubcaseTerminalSignal
): RiskCaseSubcaseSnapshot => ({
  subcaseType,
  subcaseId,
  state,
  terminalOutcome: toTerminalOutcome(subcaseType, state),
  isTriggerSignal: triggerSignal.subcaseType === subcaseType && triggerSignal.subcaseId === subcaseId
});

export const buildRiskCaseSubcaseCoordinationContext = (input: {
  readonly triggerSignal: SubcaseTerminalSignal;
  readonly liquidationCases: readonly LiquidationCase[];
  readonly adlCases: readonly ADLCase[];
}): RiskCaseSubcaseCoordinationContext => {
  const snapshots: RiskCaseSubcaseSnapshot[] = [];
  for (const liquidationCase of input.liquidationCases) {
    snapshots.push(
      toSnapshot("LiquidationCase", liquidationCase.id, liquidationCase.state, input.triggerSignal)
    );
  }
  for (const adlCase of input.adlCases) {
    snapshots.push(toSnapshot("ADLCase", adlCase.id, adlCase.state, input.triggerSignal));
  }

  const terminalSuccessSignalCount = snapshots.filter((item) => item.terminalOutcome === "success").length;
  const terminalFailureSignalCount = snapshots.filter((item) => item.terminalOutcome === "failure").length;
  const hasOtherActiveSubcases = snapshots.some(
    (item) => !item.isTriggerSignal && item.terminalOutcome === "non_terminal"
  );
  return {
    triggerSignal: input.triggerSignal,
    snapshots,
    hasOtherActiveSubcases,
    terminalSuccessSignalCount,
    terminalFailureSignalCount,
    conflictDetected: terminalSuccessSignalCount > 0 && terminalFailureSignalCount > 0
  };
};

export const toCoordinationContextAuditFields = (
  context: RiskCaseSubcaseCoordinationContext,
  arbitrationRule: string
): Readonly<Record<string, string>> => ({
  trigger_subcase_type: context.triggerSignal.subcaseType,
  trigger_subcase_id: context.triggerSignal.subcaseId,
  trigger_subcase_state: context.triggerSignal.subcaseState,
  total_subcase_count: `${context.snapshots.length}`,
  other_active_subcase_exists: `${context.hasOtherActiveSubcases}`,
  terminal_success_signal_count: `${context.terminalSuccessSignalCount}`,
  terminal_failure_signal_count: `${context.terminalFailureSignalCount}`,
  conflict_detected: `${context.conflictDetected}`,
  arbitration_rule: arbitrationRule
});
