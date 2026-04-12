// ─── core fields ────────────────────────────────────────────────────────────

export const PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS = [
  "resultStatus",
  "sagaStatus",
  "idempotencyStatus",
  "configVersion",
  "pendingCompensation",
  "auditEventSummary",
  "resultSummary",
  "replayedFromPreviousResult",
  "compensationStatus"
] as const;

export type Phase4OrchestrationCoreField = (typeof PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS)[number];

export const PHASE4_BLOCKING_DRIFT_FIELDS = new Set<string>([
  "resultStatus", "sagaStatus", "idempotencyStatus", "configVersion",
  "pendingCompensation", "auditEventSummary", "compensationStatus"
]);

export const PHASE4_NOTICE_DRIFT_FIELDS = new Set<string>([
  "resultSummary", "replayedFromPreviousResult"
]);

// ─── scenario baseline ─────────────────────────────────────────────────────

export type Phase4ScenarioExpectedBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioGroup: "risk_case" | "liquidation_case";
  readonly expectedFields: Record<string, string>;
};

export type Phase4ScenarioFieldSnapshot = {
  readonly scenarioId: string;
  readonly scenarioGroup: "risk_case" | "liquidation_case";
  readonly fields: Record<string, string>;
};

// ─── difference report ──────────────────────────────────────────────────────

export type Phase4OrchestrationDifferenceReport = {
  readonly reportId: string;
  readonly scenarioId: string;
  readonly matched: boolean;
  readonly matchedFields: readonly string[];
  readonly mismatchedFields: readonly string[];
  readonly differenceSummaries: readonly string[];
  readonly consistencyStatus: "consistent" | "drifted";
  readonly reportSummary: string;
};

export const classifyOrchestrationFieldDrift = (field: string): "blocking" | "notice" =>
  PHASE4_BLOCKING_DRIFT_FIELDS.has(field) ? "blocking" : "notice";

export const buildOrchestrationDifferenceReport = (
  reportId: string,
  baseline: Phase4ScenarioExpectedBaseline,
  snapshot: Phase4ScenarioFieldSnapshot
): Phase4OrchestrationDifferenceReport => {
  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const differenceSummaries: string[] = [];

  for (const field of PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS) {
    const expected = baseline.expectedFields[field];
    const actual = snapshot.fields[field];
    if (expected === undefined) continue;
    if (actual === expected || (field === "resultSummary" && actual?.includes(expected ?? ""))) {
      matchedFields.push(field);
    } else {
      mismatchedFields.push(field);
      differenceSummaries.push(`${field}: expected=${expected ?? "undefined"}, actual=${actual ?? "undefined"}`);
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
    consistencyStatus: matched ? "consistent" : "drifted",
    reportSummary: matched
      ? `${baseline.scenarioId}: all fields matched`
      : `${baseline.scenarioId}: ${mismatchedFields.length} field(s) drifted`
  };
};
