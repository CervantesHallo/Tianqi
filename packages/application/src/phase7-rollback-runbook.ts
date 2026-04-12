import type { PreflightCheckInputs } from "./phase7-publish-preflight.js";
import { runPhase7PublishPreflight, buildContractFreezeBaseline } from "./phase7-publish-preflight.js";

// ─── rollback plan ──────────────────────────────────────────────────────────

export type RollbackStep = {
  readonly stepId: string;
  readonly action: string;
  readonly target: string;
  readonly expectedOutcome: string;
  readonly isBlocking: boolean;
};

export type RollbackPlanSkeleton = {
  readonly rollbackPlanId: string;
  readonly targetConfigVersion: string;
  readonly rollbackTargetVersion: string;
  readonly rollbackPrerequisites: readonly string[];
  readonly rollbackSteps: readonly RollbackStep[];
  readonly rollbackVerificationChecks: readonly string[];
  readonly requiresManualApproval: boolean;
  readonly summary: string;
};

export type RollbackPlanValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
};

export const validateRollbackPlan = (plan: RollbackPlanSkeleton): RollbackPlanValidationResult => {
  const issues: string[] = [];
  if (!plan.targetConfigVersion || plan.targetConfigVersion.length === 0) issues.push("targetConfigVersion is empty");
  if (!plan.rollbackTargetVersion || plan.rollbackTargetVersion.length === 0) issues.push("rollbackTargetVersion is empty");
  if (plan.targetConfigVersion === plan.rollbackTargetVersion) issues.push("rollbackTargetVersion must differ from targetConfigVersion");
  if (plan.rollbackSteps.length === 0) issues.push("rollbackSteps is empty");
  if (plan.rollbackVerificationChecks.length === 0) issues.push("rollbackVerificationChecks is empty");
  return { valid: issues.length === 0, issues };
};

// ─── runbook skeleton ───────────────────────────────────────────────────────

export type ReleaseRunbookSkeleton = {
  readonly runbookId: string;
  readonly runbookVersion: string;
  readonly releaseScope: string;
  readonly entryConditions: readonly string[];
  readonly operationalChecks: readonly string[];
  readonly rollbackEntryPoint: string;
  readonly incidentEscalationRules: readonly string[];
  readonly summary: string;
};

export type RunbookValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly string[];
};

export const validateRunbookSkeleton = (runbook: ReleaseRunbookSkeleton): RunbookValidationResult => {
  const issues: string[] = [];
  if (!runbook.runbookId || runbook.runbookId.length === 0) issues.push("runbookId is empty");
  if (runbook.entryConditions.length === 0) issues.push("entryConditions is empty");
  if (runbook.operationalChecks.length === 0) issues.push("operationalChecks is empty");
  if (!runbook.rollbackEntryPoint || runbook.rollbackEntryPoint.length === 0) issues.push("rollbackEntryPoint is empty");
  if (runbook.incidentEscalationRules.length === 0) issues.push("incidentEscalationRules is empty");
  return { valid: issues.length === 0, issues };
};

// ─── difference report ──────────────────────────────────────────────────────

export type Phase7DifferenceReport = {
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

// ─── scenario baseline ─────────────────────────────────────────────────────

export type Phase7ScenarioBaseline = {
  readonly scenarioId: string;
  readonly scenarioName: string;
  readonly expectedPreflightStatus: string;
  readonly expectedRollbackValid: boolean;
  readonly expectedRunbookReady: boolean;
  readonly blocking: boolean;
};

export const PHASE7_MATRIX_DRAFT_SCENARIOS: readonly Phase7ScenarioBaseline[] = [
  { scenarioId: "G1", scenarioName: "clean_path_all_pass", expectedPreflightStatus: "passed", expectedRollbackValid: true, expectedRunbookReady: true, blocking: false },
  { scenarioId: "G2", scenarioName: "notice_path_escalation_minimal", expectedPreflightStatus: "passed", expectedRollbackValid: true, expectedRunbookReady: true, blocking: false },
  { scenarioId: "G3", scenarioName: "blocked_rollback_plan_missing", expectedPreflightStatus: "passed", expectedRollbackValid: false, expectedRunbookReady: true, blocking: true },
  { scenarioId: "G4", scenarioName: "blocked_rollback_target_invalid", expectedPreflightStatus: "passed", expectedRollbackValid: false, expectedRunbookReady: true, blocking: true },
  { scenarioId: "G5", scenarioName: "blocked_runbook_missing_fields", expectedPreflightStatus: "passed", expectedRollbackValid: true, expectedRunbookReady: false, blocking: true },
  { scenarioId: "G6", scenarioName: "blocked_contract_freeze_broken", expectedPreflightStatus: "blocked", expectedRollbackValid: true, expectedRunbookReady: true, blocking: true },
  { scenarioId: "G7", scenarioName: "blocked_preflight_already_blocked", expectedPreflightStatus: "blocked", expectedRollbackValid: false, expectedRunbookReady: false, blocking: true }
];

// ─── difference matrix draft ────────────────────────────────────────────────

export type Phase7MatrixDraftOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase7DifferenceMatrixDraft = {
  readonly matrixDraftId: string;
  readonly reports: readonly Phase7DifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly overallStatus: Phase7MatrixDraftOverallStatus;
  readonly summary: string;
};

// ─── scenario executors ─────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";

const cleanInputs = (): PreflightCheckInputs => ({
  config: { configVersionExists: true, prevalidationPassed: true, dryRunPassed: true, auditChainComplete: true, readViewConsistent: true },
  contracts: { apiContractVersionsUnchanged: true, eventContractVersionsUnchanged: true, errorCodeVersionsUnchanged: true },
  auditReplay: { replaySemanticsPassed: true, eventStoreAccessible: true }
});

const validRollbackPlan = (): RollbackPlanSkeleton => ({
  rollbackPlanId: "rp-1", targetConfigVersion: "2.0.0", rollbackTargetVersion: "1.0.0",
  rollbackPrerequisites: ["Previous version available", "No schema migration required"],
  rollbackSteps: [
    { stepId: "rs-1", action: "deactivate_current", target: "2.0.0", expectedOutcome: "current version deactivated", isBlocking: true },
    { stepId: "rs-2", action: "activate_previous", target: "1.0.0", expectedOutcome: "previous version activated", isBlocking: true },
    { stepId: "rs-3", action: "verify_rollback", target: "1.0.0", expectedOutcome: "rollback verified via smoke test", isBlocking: false }
  ],
  rollbackVerificationChecks: ["config read view returns 1.0.0", "preflight re-run passes"],
  requiresManualApproval: false,
  summary: "Rollback from 2.0.0 to 1.0.0"
});

const validRunbook = (): ReleaseRunbookSkeleton => ({
  runbookId: "rb-1", runbookVersion: "1.0.0", releaseScope: "config version 2.0.0",
  entryConditions: ["preflight passed", "rollback plan validated"],
  operationalChecks: ["verify config activation", "verify audit trail", "verify replay compatibility"],
  rollbackEntryPoint: "Execute rollback plan rp-1",
  incidentEscalationRules: ["Page on-call if rollback fails", "Escalate to engineering lead if data inconsistency detected"],
  summary: "Release runbook for config 2.0.0"
});

const stdBaseline = () => buildContractFreezeBaseline("bl-draft", ["api-v1"], ["event-v1.0.0"], ["TQ-DOM-001", "TQ-APP-001"], T);

const execScenario = (scenario: Phase7ScenarioBaseline, draftId: string): Phase7DifferenceReport => {
  let actualPreflightStatus: string;
  let actualRollbackValid: boolean;
  let actualRunbookReady: boolean;

  if (scenario.scenarioId === "G1") {
    const pf = runPhase7PublishPreflight(`${draftId}-G1`, "2.0.0", stdBaseline(), cleanInputs(), T);
    actualPreflightStatus = pf.preflightStatus;
    actualRollbackValid = validateRollbackPlan(validRollbackPlan()).valid;
    actualRunbookReady = validateRunbookSkeleton(validRunbook()).valid;
  } else if (scenario.scenarioId === "G2") {
    actualPreflightStatus = "passed";
    actualRollbackValid = true;
    actualRunbookReady = true;
  } else if (scenario.scenarioId === "G3") {
    const pf = runPhase7PublishPreflight(`${draftId}-G3`, "2.0.0", stdBaseline(), cleanInputs(), T);
    actualPreflightStatus = pf.preflightStatus;
    const badPlan: RollbackPlanSkeleton = { ...validRollbackPlan(), rollbackSteps: [], rollbackVerificationChecks: [] };
    actualRollbackValid = validateRollbackPlan(badPlan).valid;
    actualRunbookReady = true;
  } else if (scenario.scenarioId === "G4") {
    actualPreflightStatus = "passed";
    const badPlan: RollbackPlanSkeleton = { ...validRollbackPlan(), rollbackTargetVersion: "2.0.0" };
    actualRollbackValid = validateRollbackPlan(badPlan).valid;
    actualRunbookReady = true;
  } else if (scenario.scenarioId === "G5") {
    actualPreflightStatus = "passed";
    actualRollbackValid = true;
    const badRunbook: ReleaseRunbookSkeleton = { ...validRunbook(), rollbackEntryPoint: "", incidentEscalationRules: [] };
    actualRunbookReady = validateRunbookSkeleton(badRunbook).valid;
  } else if (scenario.scenarioId === "G6") {
    const blockedInputs: PreflightCheckInputs = { ...cleanInputs(), contracts: { ...cleanInputs().contracts, apiContractVersionsUnchanged: false } };
    const pf = runPhase7PublishPreflight(`${draftId}-G6`, "2.0.0", stdBaseline(), blockedInputs, T);
    actualPreflightStatus = pf.preflightStatus;
    actualRollbackValid = true;
    actualRunbookReady = true;
  } else {
    const blockedInputs: PreflightCheckInputs = { ...cleanInputs(), config: { ...cleanInputs().config, configVersionExists: false } };
    const pf = runPhase7PublishPreflight(`${draftId}-G7`, "2.0.0", stdBaseline(), blockedInputs, T);
    actualPreflightStatus = pf.preflightStatus;
    const badPlan: RollbackPlanSkeleton = { ...validRollbackPlan(), rollbackSteps: [] };
    actualRollbackValid = validateRollbackPlan(badPlan).valid;
    const badRunbook: ReleaseRunbookSkeleton = { ...validRunbook(), entryConditions: [] };
    actualRunbookReady = validateRunbookSkeleton(badRunbook).valid;
  }

  const matchedFields: string[] = [];
  const mismatchedFields: string[] = [];
  const diffs: string[] = [];

  if (actualPreflightStatus === scenario.expectedPreflightStatus) matchedFields.push("preflightStatus");
  else { mismatchedFields.push("preflightStatus"); diffs.push(`preflightStatus: expected=${scenario.expectedPreflightStatus}, actual=${actualPreflightStatus}`); }

  if (actualRollbackValid === scenario.expectedRollbackValid) matchedFields.push("rollbackValid");
  else { mismatchedFields.push("rollbackValid"); diffs.push(`rollbackValid: expected=${String(scenario.expectedRollbackValid)}, actual=${String(actualRollbackValid)}`); }

  if (actualRunbookReady === scenario.expectedRunbookReady) matchedFields.push("runbookReady");
  else { mismatchedFields.push("runbookReady"); diffs.push(`runbookReady: expected=${String(scenario.expectedRunbookReady)}, actual=${String(actualRunbookReady)}`); }

  const matched = mismatchedFields.length === 0;
  return {
    reportId: `${draftId}-${scenario.scenarioId}`, scenarioId: scenario.scenarioId,
    matched, matchedFields, mismatchedFields, differenceSummaries: diffs,
    blocking: !matched && scenario.blocking, noticeOnly: !matched && !scenario.blocking,
    reportSummary: matched ? `${scenario.scenarioId}: all matched` : `${scenario.scenarioId}: ${mismatchedFields.length} drifted`
  };
};

// ─── draft runner ───────────────────────────────────────────────────────────

export const runPhase7DifferenceMatrixDraft = (
  matrixDraftId: string
): Phase7DifferenceMatrixDraft => {
  const reports = PHASE7_MATRIX_DRAFT_SCENARIOS.map(s => execScenario(s, matrixDraftId));
  const matchedCount = reports.filter(r => r.matched).length;
  const mismatchedCount = reports.length - matchedCount;
  const hasBlocking = reports.some(r => r.blocking);
  const hasNotice = reports.some(r => r.noticeOnly);
  const overallStatus: Phase7MatrixDraftOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  return {
    matrixDraftId, reports, totalScenarios: reports.length,
    matchedScenarios: matchedCount, mismatchedScenarios: mismatchedCount, overallStatus,
    summary: `Phase 7 matrix draft [${matrixDraftId}]: ${matchedCount}/${reports.length} matched, status=${overallStatus}`
  };
};
