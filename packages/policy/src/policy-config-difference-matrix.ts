import type { PolicyConfigurationRoot } from "./policy-configuration-root.js";
import type {
  Phase3ScenarioExpectedBaseline,
  Phase3ScenarioFieldSnapshot,
  Phase3PolicyConfigDifferenceReport
} from "./policy-config-difference-report.js";
import {
  buildDifferenceReport,
  classifyFieldDrift,
  PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS
} from "./policy-config-difference-report.js";
import { createPolicyRegistry } from "./policy-registry.js";
import type { PolicyRegistryOperations } from "./policy-registry.js";
import {
  registerDefaultRealPoliciesV1,
  registerDefaultStubPolicies,
  registerAllDefaultPolicies
} from "./default-policy-registration.js";
import { REAL_POLICY_CONFIG_V1, STUB_POLICY_CONFIG } from "./policy-config-fixtures.js";
import { createPolicyConfigActivationRegistry } from "./policy-config-activation-registry.js";
import { createPolicyConfigVersionAuditRegistry } from "./policy-config-version-audit-record.js";
import { createDraftVersionRecord } from "./policy-config-version.js";
import { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
import { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";
import { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";
import {
  orchestratePolicyConfigActivation,
  orchestratePolicyConfigRollback
} from "./policy-config-activation-orchestrator.js";
import type { PolicyConfigActivationOutcome } from "./policy-config-activation-orchestrator.js";

// ─── constants ──────────────────────────────────────────────────────────────

const MATRIX_TIME = "2026-03-25T00:00:00.000Z";

const PHASE3_UNRESOLVABLE_CONFIG: PolicyConfigurationRoot = {
  configVersion: "99.0.0-bad",
  ranking: { policyType: "ranking", policyName: "non-existent", policyVersion: "0.0.0" },
  fundWaterfall: { policyType: "fund_waterfall", policyName: "non-existent", policyVersion: "0.0.0" },
  candidateSelection: { policyType: "candidate_selection", policyName: "non-existent", policyVersion: "0.0.0" },
  configSource: "test-unresolvable",
  createdAt: MATRIX_TIME
};

// ─── scenario baselines ─────────────────────────────────────────────────────

const pss = (c: PolicyConfigurationRoot): string =>
  `${c.ranking.policyName}@${c.ranking.policyVersion}, ` +
  `${c.fundWaterfall.policyName}@${c.fundWaterfall.policyVersion}, ` +
  `${c.candidateSelection.policyName}@${c.candidateSelection.policyVersion}`;

export const PHASE3_STRATEGY_SCENARIO_BASELINES: readonly Phase3ScenarioExpectedBaseline[] = [
  {
    scenarioId: "S1", scenarioName: "stub_bundle_dryrun_success", scenarioGroup: "strategy",
    expectedFields: { configVersion: "0.1.0-stub", preflightPassed: "true", dryRunPassed: "true", policySelectionSummary: pss(STUB_POLICY_CONFIG) }
  },
  {
    scenarioId: "S2", scenarioName: "real_bundle_dryrun_success", scenarioGroup: "strategy",
    expectedFields: { configVersion: "1.0.0", preflightPassed: "true", dryRunPassed: "true", policySelectionSummary: pss(REAL_POLICY_CONFIG_V1) }
  },
  {
    scenarioId: "S3", scenarioName: "stub_real_coexistence_no_conflict", scenarioGroup: "strategy",
    expectedFields: { configVersion: "1.0.0", preflightPassed: "true", dryRunPassed: "true", policySelectionSummary: pss(REAL_POLICY_CONFIG_V1) }
  },
  {
    scenarioId: "S4", scenarioName: "invalid_descriptor_resolution_failure", scenarioGroup: "strategy",
    expectedFields: { configVersion: "99.0.0-bad", preflightPassed: "false", dryRunPassed: "false", policySelectionSummary: pss(PHASE3_UNRESOLVABLE_CONFIG) }
  },
  {
    scenarioId: "S5", scenarioName: "stub_full_preflight_pipeline_pass", scenarioGroup: "strategy",
    expectedFields: { configVersion: "0.1.0-stub", preflightPassed: "true", dryRunPassed: "true", policySelectionSummary: pss(STUB_POLICY_CONFIG) }
  }
];

export const PHASE3_CONFIG_VERSION_SCENARIO_BASELINES: readonly Phase3ScenarioExpectedBaseline[] = [
  {
    scenarioId: "C1", scenarioName: "first_activation_success", scenarioGroup: "config_version",
    expectedFields: { configVersion: "1.0.0", activationStatus: "activated", preflightPassed: "true", currentActiveVersion: "1.0.0", rollbackAvailable: "false", auditAction: "activate", diffSummary: "N/A" }
  },
  {
    scenarioId: "C2", scenarioName: "version_switch_success", scenarioGroup: "config_version",
    expectedFields: { configVersion: "0.1.0-stub", activationStatus: "activated", preflightPassed: "true", currentActiveVersion: "0.1.0-stub", rollbackAvailable: "true", auditAction: "activate", diffSummary: "3 policy change" }
  },
  {
    scenarioId: "C3", scenarioName: "preflight_failure_rejected", scenarioGroup: "config_version",
    expectedFields: { configVersion: "99.0.0-bad", activationStatus: "rejected", preflightPassed: "false", currentActiveVersion: "null", rollbackAvailable: "false", auditAction: "activate", diffSummary: "N/A" }
  },
  {
    scenarioId: "C4", scenarioName: "rollback_success", scenarioGroup: "config_version",
    expectedFields: { configVersion: "1.0.0", activationStatus: "activated", preflightPassed: "true", currentActiveVersion: "1.0.0", rollbackAvailable: "true", auditAction: "rollback", diffSummary: "3 policy change" }
  },
  {
    scenarioId: "C5", scenarioName: "already_active_stable", scenarioGroup: "config_version",
    expectedFields: { configVersion: "1.0.0", activationStatus: "already_active", preflightPassed: "true", currentActiveVersion: "1.0.0", rollbackAvailable: "false", auditAction: "activate", diffSummary: "N/A" }
  },
  {
    scenarioId: "C6", scenarioName: "activation_produces_audit_diff_readview", scenarioGroup: "config_version",
    expectedFields: { configVersion: "1.0.0", activationStatus: "activated", preflightPassed: "true", currentActiveVersion: "1.0.0", rollbackAvailable: "true", auditAction: "activate", diffSummary: "3 policy change" }
  }
];

// ─── matrix + acceptance types ──────────────────────────────────────────────

export type Phase3MatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase3PolicyConfigDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly strategyScenarioReports: readonly Phase3PolicyConfigDifferenceReport[];
  readonly configVersionScenarioReports: readonly Phase3PolicyConfigDifferenceReport[];
  readonly strategySnapshots: readonly Phase3ScenarioFieldSnapshot[];
  readonly configVersionSnapshots: readonly Phase3ScenarioFieldSnapshot[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly coreFieldDriftSummary: readonly string[];
  readonly overallStatus: Phase3MatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase3AcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly string[];
  readonly strategyScenarioIds: readonly string[];
  readonly configVersionScenarioIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase3MatrixOverallStatus;
  readonly keyDriftFindings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

// ─── scenario executors ─────────────────────────────────────────────────────

const execStrategyPipeline = (
  id: string, config: PolicyConfigurationRoot, reg: PolicyRegistryOperations
): Phase3ScenarioFieldSnapshot => {
  const preval = prevalidatePolicyConfiguration(config, reg);
  const bundleResult = resolvePolicyBundle(config, reg);
  const dryRun = bundleResult.ok ? dryRunPolicyBundle(bundleResult.value) : null;
  return {
    scenarioId: id,
    scenarioGroup: "strategy",
    fields: {
      configVersion: config.configVersion,
      preflightPassed: String(preval.isValid && bundleResult.ok && (dryRun?.success ?? false)),
      dryRunPassed: String(dryRun?.success ?? false),
      policySelectionSummary: pss(config)
    }
  };
};

const execConfigVersion = (
  id: string, outcome: PolicyConfigActivationOutcome
): Phase3ScenarioFieldSnapshot => ({
  scenarioId: id,
  scenarioGroup: "config_version",
  fields: {
    configVersion: outcome.activationResult.requestedVersion || "unknown",
    activationStatus: outcome.activationResult.activationStatus,
    preflightPassed: String(outcome.activationResult.preflightStatus),
    currentActiveVersion: String(outcome.activationResult.currentActiveVersion),
    rollbackAvailable: String(outcome.activationResult.rollbackAvailable),
    auditAction: outcome.auditRecord.actionType,
    diffSummary: outcome.bundleDiff?.diffSummary ?? "N/A"
  }
});

// ─── runner ─────────────────────────────────────────────────────────────────

export const runPhase3PolicyConfigDifferenceMatrix = (
  matrixRunId: string
): { readonly matrix: Phase3PolicyConfigDifferenceMatrix; readonly acceptanceInput: Phase3AcceptanceInputSnapshot } => {
  let auditSeq = 0;
  const nextAuditId = () => `${matrixRunId}-a${++auditSeq}`;

  // ── strategy scenarios ──
  const strategySnapshots: Phase3ScenarioFieldSnapshot[] = [];

  // S1
  const s1Reg = createPolicyRegistry();
  registerDefaultStubPolicies(s1Reg);
  strategySnapshots.push(execStrategyPipeline("S1", STUB_POLICY_CONFIG, s1Reg));

  // S2
  const s2Reg = createPolicyRegistry();
  registerDefaultRealPoliciesV1(s2Reg);
  strategySnapshots.push(execStrategyPipeline("S2", REAL_POLICY_CONFIG_V1, s2Reg));

  // S3
  const s3Reg = createPolicyRegistry();
  registerAllDefaultPolicies(s3Reg);
  const s3StubOk = resolvePolicyBundle(STUB_POLICY_CONFIG, s3Reg).ok;
  const s3Snap = execStrategyPipeline("S3", REAL_POLICY_CONFIG_V1, s3Reg);
  strategySnapshots.push(s3StubOk ? s3Snap : { ...s3Snap, fields: { ...s3Snap.fields, preflightPassed: "false" } });

  // S4
  const s4Reg = createPolicyRegistry();
  registerDefaultRealPoliciesV1(s4Reg);
  strategySnapshots.push(execStrategyPipeline("S4", PHASE3_UNRESOLVABLE_CONFIG, s4Reg));

  // S5
  const s5Reg = createPolicyRegistry();
  registerDefaultStubPolicies(s5Reg);
  const s5Preflight = runPolicyConfigActivationPreflight(STUB_POLICY_CONFIG, s5Reg);
  strategySnapshots.push({
    scenarioId: "S5", scenarioGroup: "strategy",
    fields: {
      configVersion: STUB_POLICY_CONFIG.configVersion,
      preflightPassed: String(s5Preflight.passed),
      dryRunPassed: String(s5Preflight.dryRunPassed),
      policySelectionSummary: pss(STUB_POLICY_CONFIG)
    }
  });

  // ── config version scenarios ──
  const cvSnapshots: Phase3ScenarioFieldSnapshot[] = [];

  // C1
  (() => {
    const pr = createPolicyRegistry(); registerDefaultRealPoliciesV1(pr);
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    cvSnapshots.push(execConfigVersion("C1", orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId)));
  })();

  // C2
  (() => {
    const pr = createPolicyRegistry(); registerDefaultRealPoliciesV1(pr); registerDefaultStubPolicies(pr);
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    ar.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId);
    cvSnapshots.push(execConfigVersion("C2", orchestratePolicyConfigActivation(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId)));
  })();

  // C3
  (() => {
    const pr = createPolicyRegistry();
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(PHASE3_UNRESOLVABLE_CONFIG, "bad"));
    cvSnapshots.push(execConfigVersion("C3", orchestratePolicyConfigActivation(
      { targetConfigVersion: "99.0.0-bad", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId)));
  })();

  // C4
  (() => {
    const pr = createPolicyRegistry(); registerDefaultRealPoliciesV1(pr); registerDefaultStubPolicies(pr);
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    ar.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId);
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId);
    cvSnapshots.push(execConfigVersion("C4", orchestratePolicyConfigRollback(
      { rolledBackBy: "matrix", rolledBackAt: MATRIX_TIME },
      pr, ar, au, nextAuditId)));
  })();

  // C5
  (() => {
    const pr = createPolicyRegistry(); registerDefaultRealPoliciesV1(pr);
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId);
    cvSnapshots.push(execConfigVersion("C5", orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId)));
  })();

  // C6
  (() => {
    const pr = createPolicyRegistry(); registerDefaultRealPoliciesV1(pr); registerDefaultStubPolicies(pr);
    const ar = createPolicyConfigActivationRegistry(); const au = createPolicyConfigVersionAuditRegistry();
    ar.addVersion(createDraftVersionRecord(STUB_POLICY_CONFIG, "stub"));
    ar.addVersion(createDraftVersionRecord(REAL_POLICY_CONFIG_V1, "v1"));
    orchestratePolicyConfigActivation(
      { targetConfigVersion: "0.1.0-stub", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId);
    cvSnapshots.push(execConfigVersion("C6", orchestratePolicyConfigActivation(
      { targetConfigVersion: "1.0.0", activatedBy: "matrix", activatedAt: MATRIX_TIME, allowOverrideActive: true },
      pr, ar, au, nextAuditId)));
  })();

  // ── build reports ──
  const strategyReports = PHASE3_STRATEGY_SCENARIO_BASELINES.map((b, i) =>
    buildDifferenceReport(`${matrixRunId}-S${i + 1}`, b, strategySnapshots[i]!));
  const cvReports = PHASE3_CONFIG_VERSION_SCENARIO_BASELINES.map((b, i) =>
    buildDifferenceReport(`${matrixRunId}-C${i + 1}`, b, cvSnapshots[i]!));

  const allReports = [...strategyReports, ...cvReports];
  const matchedCount = allReports.filter(r => r.matched).length;
  const mismatchedCount = allReports.length - matchedCount;

  const coreFieldDriftSummary: string[] = [];
  for (const r of allReports) {
    for (const s of r.differenceSummaries) {
      coreFieldDriftSummary.push(`${r.scenarioId}: ${s}`);
    }
  }

  const hasBlocking = allReports.some(r => r.mismatchedFields.some(f => classifyFieldDrift(f) === "blocking"));
  const hasNotice = allReports.some(r => r.mismatchedFields.some(f => classifyFieldDrift(f) === "notice"));
  const overallStatus: Phase3MatrixOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  const matrix: Phase3PolicyConfigDifferenceMatrix = {
    matrixRunId,
    strategyScenarioReports: strategyReports,
    configVersionScenarioReports: cvReports,
    strategySnapshots,
    configVersionSnapshots: cvSnapshots,
    totalScenarios: allReports.length,
    matchedScenarios: matchedCount,
    mismatchedScenarios: mismatchedCount,
    coreFieldDriftSummary,
    overallStatus,
    matrixSummary: `Phase 3 difference matrix [${matrixRunId}]: ${matchedCount}/${allReports.length} matched, status=${overallStatus}`
  };

  const acceptanceInput = buildPhase3AcceptanceInputSnapshot(matrix);
  return { matrix, acceptanceInput };
};

// ─── acceptance input builder ───────────────────────────────────────────────

export const buildPhase3AcceptanceInputSnapshot = (
  matrix: Phase3PolicyConfigDifferenceMatrix
): Phase3AcceptanceInputSnapshot => {
  const allReports = [...matrix.strategyScenarioReports, ...matrix.configVersionScenarioReports];

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const r of allReports) {
    for (const f of r.mismatchedFields) {
      const label = `${r.scenarioId}: ${f} drifted`;
      if (classifyFieldDrift(f) === "blocking") blockingIssues.push(label);
      else nonBlockingNotices.push(label);
    }
  }

  const recommendedNextActions: string[] = [];
  if (matrix.overallStatus === "passed") {
    recommendedNextActions.push("Proceed to Phase 3 acceptance gate (Step 8)");
  } else if (matrix.overallStatus === "passed_with_notice") {
    recommendedNextActions.push("Review notice-level drift before proceeding");
    recommendedNextActions.push("Proceed to Phase 3 acceptance gate with documented notices");
  } else {
    recommendedNextActions.push("Resolve blocking drift before proceeding");
    recommendedNextActions.push("Re-run difference matrix after fixes");
  }

  return {
    baselineCoreFields: [...PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS],
    strategyScenarioIds: matrix.strategyScenarioReports.map(r => r.scenarioId),
    configVersionScenarioIds: matrix.configVersionScenarioReports.map(r => r.scenarioId),
    differenceMatrixOverallStatus: matrix.overallStatus,
    keyDriftFindings: matrix.coreFieldDriftSummary,
    blockingIssues,
    nonBlockingNotices,
    recommendedNextActions
  };
};
