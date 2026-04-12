import type { CoordinationResultDiagnosticView } from "./coordination-result-diagnostic-view.js";

export type CoordinationDiagnosticComparison = {
  readonly hasDifference: boolean;
  readonly differenceSummary: string;
  readonly versionChanged: boolean;
  readonly riskLevelChanged: boolean;
  readonly manualActionHintChanged: boolean;
  readonly statusChanged: boolean;
};

export const compareCoordinationDiagnosticViews = (input: {
  readonly current: CoordinationResultDiagnosticView;
  readonly historical: CoordinationResultDiagnosticView;
}): CoordinationDiagnosticComparison => {
  const versionChanged = input.current.assessmentRulesVersion !== input.historical.assessmentRulesVersion;
  const riskLevelChanged = input.current.riskLevel !== input.historical.riskLevel;
  const manualActionHintChanged = input.current.manualActionHint !== input.historical.manualActionHint;
  const statusChanged =
    input.current.validationStatus !== input.historical.validationStatus ||
    input.current.repairStatus !== input.historical.repairStatus ||
    input.current.currentReadViewStatus !== input.historical.currentReadViewStatus;

  const hasDifference = versionChanged || riskLevelChanged || manualActionHintChanged || statusChanged;

  if (!hasDifference) {
    return {
      hasDifference: false,
      differenceSummary: "No diagnostic difference between current and historical result",
      versionChanged: false,
      riskLevelChanged: false,
      manualActionHintChanged: false,
      statusChanged: false
    };
  }

  const changedParts = [
    ...(versionChanged ? ["assessmentRulesVersion"] : []),
    ...(riskLevelChanged ? ["riskLevel"] : []),
    ...(manualActionHintChanged ? ["manualActionHint"] : []),
    ...(statusChanged ? ["statusFields(validationStatus/repairStatus/currentReadViewStatus)"] : [])
  ];

  return {
    hasDifference: true,
    differenceSummary: `Changed fields: ${changedParts.join(", ")}`,
    versionChanged,
    riskLevelChanged,
    manualActionHintChanged,
    statusChanged
  };
};
