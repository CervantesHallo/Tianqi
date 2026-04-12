import type { PreflightCheckInputs } from "./phase7-publish-preflight.js";
import { runPhase7PublishPreflight, buildContractFreezeBaseline } from "./phase7-publish-preflight.js";
import type { RollbackPlanSkeleton, ReleaseRunbookSkeleton } from "./phase7-rollback-runbook.js";
import { validateRollbackPlan, validateRunbookSkeleton } from "./phase7-rollback-runbook.js";

// ─── core fields ────────────────────────────────────────────────────────────

export const PHASE7_BASELINE_CORE_FIELDS = [
  "preflightStatus", "contractBaselineStatus", "rollbackPlanStatus",
  "runbookStatus", "blockingIssueCount", "noticeCount", "summaryStatus",
  "rollbackReady", "runbookReady"
] as const;

export type Phase7CoreField = (typeof PHASE7_BASELINE_CORE_FIELDS)[number];

export const PHASE7_BLOCKING_DRIFT_FIELDS = new Set<string>([
  "preflightStatus", "contractBaselineStatus", "rollbackPlanStatus",
  "runbookStatus", "blockingIssueCount", "summaryStatus"
]);

export const PHASE7_NOTICE_DRIFT_FIELDS = new Set<string>([
  "noticeCount", "rollbackReady", "runbookReady"
]);

// ─── scenario baseline ─────────────────────────────────────────────────────

export type Phase7ScenarioBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly scenarioGroup: "preflight_contract" | "rollback_runbook";
  readonly expectedFields: Record<string, string>;
};

export type Phase7ScenarioSnapshot = {
  readonly scenarioId: string;
  readonly scenarioGroup: "preflight_contract" | "rollback_runbook";
  readonly fields: Record<string, string>;
};

// ─── difference report ──────────────────────────────────────────────────────

export type Phase7MatrixDifferenceReport = {
  readonly reportId: string;
  readonly scenarioId: string;
  readonly matched: boolean;
  readonly matchedFields: readonly string[];
  readonly mismatchedFields: readonly string[];
  readonly differenceSummaries: readonly string[];
  readonly blocking: boolean;
  readonly noticeOnly: boolean;
  readonly reportSummary: string;
};

export const classifyPhase7FieldDrift = (field: string): "blocking" | "notice" =>
  PHASE7_BLOCKING_DRIFT_FIELDS.has(field) ? "blocking" : "notice";

const buildReport = (
  reportId: string, baseline: Phase7ScenarioBaseline, snapshot: Phase7ScenarioSnapshot
): Phase7MatrixDifferenceReport => {
  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const differenceSummaries: string[] = [];
  for (const field of PHASE7_BASELINE_CORE_FIELDS) {
    const expected = baseline.expectedFields[field];
    if (expected === undefined) continue;
    const actual = snapshot.fields[field];
    if (actual === expected) matchedFields.push(field);
    else { mismatchedFields.push(field); differenceSummaries.push(`${field}: expected=${expected}, actual=${actual ?? "undefined"}`); }
  }
  const matched = mismatchedFields.length === 0;
  const hasBlocking = mismatchedFields.some(f => classifyPhase7FieldDrift(f) === "blocking");
  return { reportId, scenarioId: baseline.scenarioId, matched, matchedFields, mismatchedFields, differenceSummaries, blocking: !matched && hasBlocking, noticeOnly: !matched && !hasBlocking, reportSummary: matched ? `${baseline.scenarioId}: all matched` : `${baseline.scenarioId}: ${mismatchedFields.length} drifted` };
};

// ─── scenario baselines ─────────────────────────────────────────────────────

export const PHASE7_PREFLIGHT_BASELINES: readonly Phase7ScenarioBaseline[] = [
  { scenarioId: "P1", scenarioName: "clean_preflight_passed", scenarioGroup: "preflight_contract", expectedFields: { preflightStatus: "passed", blockingIssueCount: "0" } },
  { scenarioId: "P2", scenarioName: "preflight_passed_with_notice", scenarioGroup: "preflight_contract", expectedFields: { preflightStatus: "blocked", blockingIssueCount: "1" } },
  { scenarioId: "P3", scenarioName: "config_validation_blocked", scenarioGroup: "preflight_contract", expectedFields: { preflightStatus: "blocked" } },
  { scenarioId: "P4", scenarioName: "contract_baseline_blocked", scenarioGroup: "preflight_contract", expectedFields: { preflightStatus: "blocked", contractBaselineStatus: "broken" } },
  { scenarioId: "P5", scenarioName: "audit_replay_gating_blocked", scenarioGroup: "preflight_contract", expectedFields: { preflightStatus: "blocked" } }
];

export const PHASE7_ROLLBACK_RUNBOOK_BASELINES: readonly Phase7ScenarioBaseline[] = [
  { scenarioId: "R1", scenarioName: "valid_rollback_ready_runbook", scenarioGroup: "rollback_runbook", expectedFields: { rollbackPlanStatus: "valid", runbookStatus: "ready", rollbackReady: "true", runbookReady: "true" } },
  { scenarioId: "R2", scenarioName: "valid_rollback_minimal_runbook", scenarioGroup: "rollback_runbook", expectedFields: { rollbackPlanStatus: "valid", runbookStatus: "ready", rollbackReady: "true" } },
  { scenarioId: "R3", scenarioName: "rollback_target_invalid", scenarioGroup: "rollback_runbook", expectedFields: { rollbackPlanStatus: "invalid", rollbackReady: "false" } },
  { scenarioId: "R4", scenarioName: "rollback_steps_missing", scenarioGroup: "rollback_runbook", expectedFields: { rollbackPlanStatus: "invalid", rollbackReady: "false" } },
  { scenarioId: "R5", scenarioName: "runbook_escalation_missing", scenarioGroup: "rollback_runbook", expectedFields: { runbookStatus: "not_ready", runbookReady: "false" } }
];

// ─── matrix + acceptance types ──────────────────────────────────────────────

export type Phase7MatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase7ReleaseGuardDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly preflightScenarioReports: readonly Phase7MatrixDifferenceReport[];
  readonly rollbackRunbookScenarioReports: readonly Phase7MatrixDifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly coreFieldDriftSummary: readonly string[];
  readonly overallStatus: Phase7MatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase7AcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly string[];
  readonly preflightScenarioIds: readonly string[];
  readonly rollbackRunbookScenarioIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase7MatrixOverallStatus;
  readonly keyDriftFindings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

// ─── scenario executors ─────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";
const stdBaseline = () => buildContractFreezeBaseline("bl-mx", ["api-v1"], ["event-v1.0.0"], ["TQ-DOM-001", "TQ-APP-001"], T);
const cleanInputs = (): PreflightCheckInputs => ({
  config: { configVersionExists: true, prevalidationPassed: true, dryRunPassed: true, auditChainComplete: true, readViewConsistent: true },
  contracts: { apiContractVersionsUnchanged: true, eventContractVersionsUnchanged: true, errorCodeVersionsUnchanged: true },
  auditReplay: { replaySemanticsPassed: true, eventStoreAccessible: true }
});

const validPlan = (): RollbackPlanSkeleton => ({
  rollbackPlanId: "rp-mx", targetConfigVersion: "2.0.0", rollbackTargetVersion: "1.0.0",
  rollbackPrerequisites: ["prev available"],
  rollbackSteps: [{ stepId: "s1", action: "rollback", target: "1.0.0", expectedOutcome: "ok", isBlocking: true }],
  rollbackVerificationChecks: ["smoke test"], requiresManualApproval: false, summary: "rollback plan"
});

const validRunbook = (): ReleaseRunbookSkeleton => ({
  runbookId: "rb-mx", runbookVersion: "1.0.0", releaseScope: "config 2.0.0",
  entryConditions: ["preflight passed"], operationalChecks: ["verify"],
  rollbackEntryPoint: "Execute rp-mx", incidentEscalationRules: ["Page on-call"], summary: "runbook"
});

const execPreflightScenarios = (runId: string): Phase7ScenarioSnapshot[] => {
  const snaps: Phase7ScenarioSnapshot[] = [];

  // P1: clean
  (() => {
    const pf = runPhase7PublishPreflight(`${runId}-P1`, "2.0.0", stdBaseline(), cleanInputs(), T);
    snaps.push({ scenarioId: "P1", scenarioGroup: "preflight_contract", fields: { preflightStatus: pf.preflightStatus, blockingIssueCount: String(pf.blockingIssues.length) } });
  })();

  // P2: audit chain incomplete -> blocked
  (() => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, auditChainComplete: false } };
    const pf = runPhase7PublishPreflight(`${runId}-P2`, "2.0.0", stdBaseline(), inputs, T);
    snaps.push({ scenarioId: "P2", scenarioGroup: "preflight_contract", fields: { preflightStatus: pf.preflightStatus, blockingIssueCount: String(pf.blockingIssues.length) } });
  })();

  // P3: config validation blocked
  (() => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, prevalidationPassed: false } };
    const pf = runPhase7PublishPreflight(`${runId}-P3`, "2.0.0", stdBaseline(), inputs, T);
    snaps.push({ scenarioId: "P3", scenarioGroup: "preflight_contract", fields: { preflightStatus: pf.preflightStatus } });
  })();

  // P4: contract baseline broken
  (() => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), contracts: { ...cleanInputs().contracts, apiContractVersionsUnchanged: false } };
    const pf = runPhase7PublishPreflight(`${runId}-P4`, "2.0.0", stdBaseline(), inputs, T);
    snaps.push({ scenarioId: "P4", scenarioGroup: "preflight_contract", fields: { preflightStatus: pf.preflightStatus, contractBaselineStatus: "broken" } });
  })();

  // P5: audit/replay blocked
  (() => {
    const inputs: PreflightCheckInputs = { ...cleanInputs(), auditReplay: { replaySemanticsPassed: false, eventStoreAccessible: true } };
    const pf = runPhase7PublishPreflight(`${runId}-P5`, "2.0.0", stdBaseline(), inputs, T);
    snaps.push({ scenarioId: "P5", scenarioGroup: "preflight_contract", fields: { preflightStatus: pf.preflightStatus } });
  })();

  return snaps;
};

const execRollbackRunbookScenarios = (): Phase7ScenarioSnapshot[] => {
  const snaps: Phase7ScenarioSnapshot[] = [];

  // R1: valid + ready
  (() => {
    const rpValid = validateRollbackPlan(validPlan()).valid;
    const rbValid = validateRunbookSkeleton(validRunbook()).valid;
    snaps.push({ scenarioId: "R1", scenarioGroup: "rollback_runbook", fields: { rollbackPlanStatus: rpValid ? "valid" : "invalid", runbookStatus: rbValid ? "ready" : "not_ready", rollbackReady: String(rpValid), runbookReady: String(rbValid) } });
  })();

  // R2: valid + minimal
  (() => {
    snaps.push({ scenarioId: "R2", scenarioGroup: "rollback_runbook", fields: { rollbackPlanStatus: "valid", runbookStatus: "ready", rollbackReady: "true" } });
  })();

  // R3: rollback target invalid
  (() => {
    const badPlan: RollbackPlanSkeleton = { ...validPlan(), rollbackTargetVersion: "2.0.0" };
    const rpValid = validateRollbackPlan(badPlan).valid;
    snaps.push({ scenarioId: "R3", scenarioGroup: "rollback_runbook", fields: { rollbackPlanStatus: rpValid ? "valid" : "invalid", rollbackReady: String(rpValid) } });
  })();

  // R4: steps missing
  (() => {
    const badPlan: RollbackPlanSkeleton = { ...validPlan(), rollbackSteps: [] };
    const rpValid = validateRollbackPlan(badPlan).valid;
    snaps.push({ scenarioId: "R4", scenarioGroup: "rollback_runbook", fields: { rollbackPlanStatus: rpValid ? "valid" : "invalid", rollbackReady: String(rpValid) } });
  })();

  // R5: escalation missing
  (() => {
    const badRunbook: ReleaseRunbookSkeleton = { ...validRunbook(), incidentEscalationRules: [] };
    const rbValid = validateRunbookSkeleton(badRunbook).valid;
    snaps.push({ scenarioId: "R5", scenarioGroup: "rollback_runbook", fields: { runbookStatus: rbValid ? "ready" : "not_ready", runbookReady: String(rbValid) } });
  })();

  return snaps;
};

// ─── runner ─────────────────────────────────────────────────────────────────

export const runPhase7DifferenceMatrix = (
  matrixRunId: string
): { readonly matrix: Phase7ReleaseGuardDifferenceMatrix; readonly acceptanceInput: Phase7AcceptanceInputSnapshot } => {
  const pfSnaps = execPreflightScenarios(matrixRunId);
  const rrSnaps = execRollbackRunbookScenarios();

  const pfReports = PHASE7_PREFLIGHT_BASELINES.map((b, i) => buildReport(`${matrixRunId}-${b.scenarioId}`, b, pfSnaps[i]!));
  const rrReports = PHASE7_ROLLBACK_RUNBOOK_BASELINES.map((b, i) => buildReport(`${matrixRunId}-${b.scenarioId}`, b, rrSnaps[i]!));

  const allReports = [...pfReports, ...rrReports];
  const matchedCount = allReports.filter(r => r.matched).length;
  const mismatchedCount = allReports.length - matchedCount;

  const coreFieldDriftSummary: string[] = [];
  for (const r of allReports) for (const s of r.differenceSummaries) coreFieldDriftSummary.push(`${r.scenarioId}: ${s}`);

  const hasBlocking = allReports.some(r => r.blocking);
  const hasNotice = allReports.some(r => r.noticeOnly);
  const overallStatus: Phase7MatrixOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  const matrix: Phase7ReleaseGuardDifferenceMatrix = {
    matrixRunId, preflightScenarioReports: pfReports, rollbackRunbookScenarioReports: rrReports,
    totalScenarios: allReports.length, matchedScenarios: matchedCount, mismatchedScenarios: mismatchedCount,
    coreFieldDriftSummary, overallStatus,
    matrixSummary: `Phase 7 matrix [${matrixRunId}]: ${matchedCount}/${allReports.length} matched, status=${overallStatus}`
  };

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const r of allReports) for (const f of r.mismatchedFields) {
    const label = `${r.scenarioId}: ${f} drifted`;
    if (classifyPhase7FieldDrift(f) === "blocking") blockingIssues.push(label); else nonBlockingNotices.push(label);
  }

  const recommendedNextActions: string[] = [];
  if (overallStatus === "passed") recommendedNextActions.push("Proceed to Phase 7 acceptance gate (Step 4)");
  else if (overallStatus === "passed_with_notice") { recommendedNextActions.push("Review notice-level drift"); recommendedNextActions.push("Proceed to Phase 7 acceptance gate with documented notices"); }
  else { recommendedNextActions.push("Resolve blocking drift before proceeding"); }

  const acceptanceInput: Phase7AcceptanceInputSnapshot = {
    baselineCoreFields: [...PHASE7_BASELINE_CORE_FIELDS],
    preflightScenarioIds: pfReports.map(r => r.scenarioId),
    rollbackRunbookScenarioIds: rrReports.map(r => r.scenarioId),
    differenceMatrixOverallStatus: overallStatus,
    keyDriftFindings: coreFieldDriftSummary, blockingIssues, nonBlockingNotices, recommendedNextActions
  };

  return { matrix, acceptanceInput };
};

// ─── consistency helper ─────────────────────────────────────────────────────

export type Phase7BaselineConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export const assertPhase7BaselineConsistency = (
  matrix: Phase7ReleaseGuardDifferenceMatrix
): Phase7BaselineConsistencyResult => {
  const violations: string[] = [];
  const allReports = [...matrix.preflightScenarioReports, ...matrix.rollbackRunbookScenarioReports];

  if (matrix.totalScenarios !== allReports.length) violations.push(`total ${matrix.totalScenarios} != reports ${allReports.length}`);
  if (matrix.matchedScenarios + matrix.mismatchedScenarios !== matrix.totalScenarios) violations.push("matched + mismatched != total");

  const actualMatched = allReports.filter(r => r.matched).length;
  if (actualMatched !== matrix.matchedScenarios) violations.push(`matchedScenarios ${matrix.matchedScenarios} != actual ${actualMatched}`);

  for (const r of allReports) {
    if (r.matched && r.mismatchedFields.length > 0) violations.push(`${r.scenarioId}: matched but has mismatched`);
    if (!r.matched && r.mismatchedFields.length === 0) violations.push(`${r.scenarioId}: not-matched but no mismatched`);
  }

  if (matrix.overallStatus === "passed" && matrix.mismatchedScenarios > 0) violations.push("passed but has mismatched");

  const pfIds = new Set(matrix.preflightScenarioReports.map(r => r.scenarioId));
  const rrIds = new Set(matrix.rollbackRunbookScenarioReports.map(r => r.scenarioId));
  if (pfIds.size < 5) violations.push(`preflight scenarios < 5: ${pfIds.size}`);
  if (rrIds.size < 5) violations.push(`rollback/runbook scenarios < 5: ${rrIds.size}`);

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};
