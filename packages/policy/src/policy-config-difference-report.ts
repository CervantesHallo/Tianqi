export const PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS = [
  "configVersion",
  "activationStatus",
  "preflightPassed",
  "policySelectionSummary",
  "dryRunPassed",
  "auditAction",
  "diffSummary",
  "currentActiveVersion",
  "rollbackAvailable"
] as const;

export type Phase3PolicyConfigBaselineCoreField =
  typeof PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS[number];

export const PHASE3_BLOCKING_DRIFT_FIELDS = new Set<string>([
  "configVersion", "activationStatus", "preflightPassed", "dryRunPassed",
  "currentActiveVersion", "auditAction", "rollbackAvailable"
]);

export const PHASE3_NOTICE_DRIFT_FIELDS = new Set<string>([
  "diffSummary", "policySelectionSummary"
]);

export type Phase3ScenarioExpectedBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioGroup: "strategy" | "config_version";
  readonly expectedFields: Readonly<Record<string, string>>;
};

export type Phase3ScenarioFieldSnapshot = {
  readonly scenarioId: string;
  readonly scenarioGroup: "strategy" | "config_version";
  readonly fields: Readonly<Record<string, string>>;
};

export type Phase3PolicyConfigDifferenceReport = {
  readonly reportId: string;
  readonly scenarioId: string;
  readonly matched: boolean;
  readonly matchedFields: readonly string[];
  readonly mismatchedFields: readonly string[];
  readonly differenceSummaries: readonly string[];
  readonly consistencyStatus: "consistent" | "inconsistent";
  readonly reportSummary: string;
};

export const classifyFieldDrift = (field: string): "blocking" | "notice" => {
  if (PHASE3_BLOCKING_DRIFT_FIELDS.has(field)) return "blocking";
  return "notice";
};

const isFieldMatch = (field: string, expected: string, actual: string): boolean => {
  if (field === "diffSummary" && expected !== "N/A") {
    return actual.includes(expected);
  }
  return actual === expected;
};

export const buildDifferenceReport = (
  reportId: string,
  baseline: Phase3ScenarioExpectedBaseline,
  actual: Phase3ScenarioFieldSnapshot
): Phase3PolicyConfigDifferenceReport => {
  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const differenceSummaries: string[] = [];

  for (const field of PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS) {
    const expected = baseline.expectedFields[field];
    if (expected === undefined) continue;
    const actualValue = actual.fields[field] ?? "undefined";

    if (isFieldMatch(field, expected, actualValue)) {
      matchedFields.push(field);
    } else {
      mismatchedFields.push(field);
      differenceSummaries.push(`${field}: expected=${expected}, actual=${actualValue}`);
    }
  }

  const matched = mismatchedFields.length === 0;
  return {
    reportId,
    scenarioId: baseline.scenarioId,
    matched,
    matchedFields,
    mismatchedFields,
    differenceSummaries,
    consistencyStatus: matched ? "consistent" : "inconsistent",
    reportSummary: matched
      ? `${baseline.scenarioId} (${baseline.scenarioName}): all ${matchedFields.length} field(s) matched`
      : `${baseline.scenarioId} (${baseline.scenarioName}): ${mismatchedFields.length} field(s) drifted`
  };
};
