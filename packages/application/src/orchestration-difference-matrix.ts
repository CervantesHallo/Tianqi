import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView, LiquidationCaseView } from "./orchestration-ports.js";
import type { ExecuteRiskCaseOrchestrationCommand } from "./execute-risk-case-orchestration-command.js";
import type { ExecuteLiquidationCaseOrchestrationCommand } from "./execute-liquidation-case-orchestration-command.js";
import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { executeLiquidationCaseOrchestration } from "./liquidation-case-orchestrator.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { strategyExecutionFailed, portUnavailable } from "./orchestration-error.js";
import type {
  Phase4ScenarioExpectedBaseline,
  Phase4ScenarioFieldSnapshot,
  Phase4OrchestrationDifferenceReport
} from "./orchestration-difference-report.js";
import {
  buildOrchestrationDifferenceReport,
  classifyOrchestrationFieldDrift,
  PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS
} from "./orchestration-difference-report.js";

// ─── constants ──────────────────────────────────────────────────────────────

const T = "2026-03-25T00:00:00.000Z";

const RC_VIEW: RiskCaseView = { caseId: "rc-mx", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL", configVersion: "1.0.0", createdAt: T };
const LC_VIEW: LiquidationCaseView = { caseId: "lc-mx", parentRiskCaseId: "rc-mx", state: "Liquidating", stage: "Liquidating", configVersion: "1.0.0", createdAt: T };
const ACTIVE_CFG: ActivePolicyConfigView = {
  configVersion: "1.0.0", rankingPolicyName: "score-descending-v1", rankingPolicyVersion: "1.0.0",
  fundWaterfallPolicyName: "priority-sequential-v1", fundWaterfallPolicyVersion: "1.0.0",
  candidateSelectionPolicyName: "threshold-selection-v1", candidateSelectionPolicyVersion: "1.0.0"
};

// ─── scenario baselines ─────────────────────────────────────────────────────

export const PHASE4_RISK_CASE_SCENARIO_BASELINES: readonly Phase4ScenarioExpectedBaseline[] = [
  { scenarioId: "R1", scenarioName: "main_path_success", scenarioGroup: "risk_case", expectedFields: { resultStatus: "succeeded", sagaStatus: "completed", idempotencyStatus: "accepted", configVersion: "1.0.0", pendingCompensation: "false", replayedFromPreviousResult: "false" } },
  { scenarioId: "R2", scenarioName: "replay_success", scenarioGroup: "risk_case", expectedFields: { resultStatus: "succeeded", idempotencyStatus: "replayed_same_result", replayedFromPreviousResult: "true" } },
  { scenarioId: "R3", scenarioName: "compensable_failure", scenarioGroup: "risk_case", expectedFields: { resultStatus: "compensation_required", sagaStatus: "compensation_required", pendingCompensation: "true", compensationStatus: "completed" } },
  { scenarioId: "R4", scenarioName: "active_config_missing", scenarioGroup: "risk_case", expectedFields: { resultStatus: "error", sagaStatus: "error" } },
  { scenarioId: "R5", scenarioName: "bundle_resolution_failed", scenarioGroup: "risk_case", expectedFields: { resultStatus: "error", sagaStatus: "error" } }
];

export const PHASE4_LIQUIDATION_CASE_SCENARIO_BASELINES: readonly Phase4ScenarioExpectedBaseline[] = [
  { scenarioId: "L1", scenarioName: "main_path_success", scenarioGroup: "liquidation_case", expectedFields: { resultStatus: "succeeded", sagaStatus: "completed", idempotencyStatus: "accepted", configVersion: "1.0.0", pendingCompensation: "false", replayedFromPreviousResult: "false" } },
  { scenarioId: "L2", scenarioName: "replay_success", scenarioGroup: "liquidation_case", expectedFields: { resultStatus: "succeeded", idempotencyStatus: "replayed_same_result", replayedFromPreviousResult: "true" } },
  { scenarioId: "L3", scenarioName: "compensable_failure", scenarioGroup: "liquidation_case", expectedFields: { resultStatus: "compensation_required", sagaStatus: "compensation_required", pendingCompensation: "true", compensationStatus: "completed" } },
  { scenarioId: "L4", scenarioName: "case_not_orchestrable", scenarioGroup: "liquidation_case", expectedFields: { resultStatus: "error", sagaStatus: "error" } },
  { scenarioId: "L5", scenarioName: "saga_resume_rejected", scenarioGroup: "liquidation_case", expectedFields: { resultStatus: "error", sagaStatus: "error" } }
];

// ─── matrix + acceptance types ──────────────────────────────────────────────

export type Phase4MatrixOverallStatus = "passed" | "passed_with_notice" | "failed";

export type Phase4OrchestrationDifferenceMatrix = {
  readonly matrixRunId: string;
  readonly riskCaseScenarioReports: readonly Phase4OrchestrationDifferenceReport[];
  readonly liquidationCaseScenarioReports: readonly Phase4OrchestrationDifferenceReport[];
  readonly totalScenarios: number;
  readonly matchedScenarios: number;
  readonly mismatchedScenarios: number;
  readonly coreFieldDriftSummary: readonly string[];
  readonly overallStatus: Phase4MatrixOverallStatus;
  readonly matrixSummary: string;
};

export type Phase4AcceptanceInputSnapshot = {
  readonly baselineCoreFields: readonly string[];
  readonly riskCaseScenarioIds: readonly string[];
  readonly liquidationCaseScenarioIds: readonly string[];
  readonly differenceMatrixOverallStatus: Phase4MatrixOverallStatus;
  readonly keyDriftFindings: readonly string[];
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly recommendedNextActions: readonly string[];
};

// ─── snapshot capture ───────────────────────────────────────────────────────

const captureSnapshot = (id: string, group: "risk_case" | "liquidation_case", result: Result<RiskCaseOrchestrationResult, unknown>): Phase4ScenarioFieldSnapshot => {
  if (!result.ok) {
    return { scenarioId: id, scenarioGroup: group, fields: { resultStatus: "error", sagaStatus: "error" } };
  }
  const r = result.value;
  return {
    scenarioId: id,
    scenarioGroup: group,
    fields: {
      resultStatus: r.resultStatus,
      sagaStatus: r.sagaStatus,
      idempotencyStatus: r.idempotencyStatus,
      configVersion: r.configVersion,
      pendingCompensation: String(r.pendingCompensation.needed),
      auditEventSummary: r.auditEventSummary,
      resultSummary: r.resultSummary,
      replayedFromPreviousResult: String(r.replayedFromPreviousResult),
      compensationStatus: r.compensationResult?.compensationStatus ?? "none"
    }
  };
};

// ─── scenario executors ─────────────────────────────────────────────────────

const stdPorts = (): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok(RC_VIEW) },
  liquidationCaseRepository: { loadCase: () => ok(LC_VIEW) },
  policyConfig: { getActivePolicyConfig: () => ok(ACTIVE_CFG) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies resolved" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "5 selected" }),
    executeRanking: () => ok({ rankedCount: 5, summary: "5 ranked" }),
    executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "3 allocated" })
  },
  audit: { publishAuditEvent: () => ok(undefined) }
});

const compPorts = (): OrchestrationPorts => ({
  ...stdPorts(),
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
    executeRanking: () => err(strategyExecutionFailed("ranking", "timeout")),
    executeFundWaterfall: () => ok({ allocatedCount: 0, shortfall: false, summary: "n/a" })
  }
});

const execRiskCaseScenarios = (runId: string): { snapshots: Phase4ScenarioFieldSnapshot[] } => {
  const snapshots: Phase4ScenarioFieldSnapshot[] = [];

  // R1: main path
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R1`, caseId: "rc-mx", requestId: "r-R1", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("R1", "risk_case", executeRiskCaseOrchestration(cmd, stdPorts(), idem, rep)));
  })();

  // R2: replay
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd1: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R2a`, caseId: "rc-mx", requestId: "r-R2", triggeredBy: "matrix", triggeredAt: T };
    executeRiskCaseOrchestration(cmd1, stdPorts(), idem, rep);
    const cmd2: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R2b`, caseId: "rc-mx", requestId: "r-R2", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("R2", "risk_case", executeRiskCaseOrchestration(cmd2, stdPorts(), idem, rep)));
  })();

  // R3: compensable failure
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R3`, caseId: "rc-mx", requestId: "r-R3", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("R3", "risk_case", executeRiskCaseOrchestration(cmd, compPorts(), idem, rep)));
  })();

  // R4: active config missing
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const ports: OrchestrationPorts = { ...stdPorts(), policyConfig: { getActivePolicyConfig: () => ok(null) } };
    const cmd: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R4`, caseId: "rc-mx", requestId: "r-R4", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("R4", "risk_case", executeRiskCaseOrchestration(cmd, ports, idem, rep)));
  })();

  // R5: bundle resolution failed
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const ports: OrchestrationPorts = { ...stdPorts(), policyBundle: { resolveAndDryRun: () => err(portUnavailable("bundle", "unresolvable")) } };
    const cmd: ExecuteRiskCaseOrchestrationCommand = { orchestrationId: `${runId}-R5`, caseId: "rc-mx", requestId: "r-R5", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("R5", "risk_case", executeRiskCaseOrchestration(cmd, ports, idem, rep)));
  })();

  return { snapshots };
};

const execLiquidationCaseScenarios = (runId: string): { snapshots: Phase4ScenarioFieldSnapshot[] } => {
  const snapshots: Phase4ScenarioFieldSnapshot[] = [];

  // L1: main path
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L1`, caseId: "lc-mx", requestId: "r-L1", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("L1", "liquidation_case", executeLiquidationCaseOrchestration(cmd, stdPorts(), idem, rep)));
  })();

  // L2: replay
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd1: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L2a`, caseId: "lc-mx", requestId: "r-L2", triggeredBy: "matrix", triggeredAt: T };
    executeLiquidationCaseOrchestration(cmd1, stdPorts(), idem, rep);
    const cmd2: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L2b`, caseId: "lc-mx", requestId: "r-L2", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("L2", "liquidation_case", executeLiquidationCaseOrchestration(cmd2, stdPorts(), idem, rep)));
  })();

  // L3: compensable failure
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const cmd: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L3`, caseId: "lc-mx", requestId: "r-L3", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("L3", "liquidation_case", executeLiquidationCaseOrchestration(cmd, compPorts(), idem, rep)));
  })();

  // L4: case not orchestrable
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const ports: OrchestrationPorts = { ...stdPorts(), liquidationCaseRepository: { loadCase: () => ok({ ...LC_VIEW, state: "Closed" }) } };
    const cmd: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L4`, caseId: "lc-mx", requestId: "r-L4", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("L4", "liquidation_case", executeLiquidationCaseOrchestration(cmd, ports, idem, rep)));
  })();

  // L5: saga resume rejected (case not found ≈ resume impossible)
  (() => {
    const idem = createOrchestrationIdempotencyRegistry(); const rep = createOrchestrationResultReplayRegistry();
    const ports: OrchestrationPorts = { ...stdPorts(), liquidationCaseRepository: { loadCase: () => ok(null) } };
    const cmd: ExecuteLiquidationCaseOrchestrationCommand = { orchestrationId: `${runId}-L5`, caseId: "lc-missing", requestId: "r-L5", triggeredBy: "matrix", triggeredAt: T };
    snapshots.push(captureSnapshot("L5", "liquidation_case", executeLiquidationCaseOrchestration(cmd, ports, idem, rep)));
  })();

  return { snapshots };
};

// ─── runner ─────────────────────────────────────────────────────────────────

export const runPhase4OrchestrationDifferenceMatrix = (
  matrixRunId: string
): { readonly matrix: Phase4OrchestrationDifferenceMatrix; readonly acceptanceInput: Phase4AcceptanceInputSnapshot } => {
  const rcSnaps = execRiskCaseScenarios(matrixRunId);
  const lcSnaps = execLiquidationCaseScenarios(matrixRunId);

  const rcReports = PHASE4_RISK_CASE_SCENARIO_BASELINES.map((b, i) =>
    buildOrchestrationDifferenceReport(`${matrixRunId}-${b.scenarioId}`, b, rcSnaps.snapshots[i]!));
  const lcReports = PHASE4_LIQUIDATION_CASE_SCENARIO_BASELINES.map((b, i) =>
    buildOrchestrationDifferenceReport(`${matrixRunId}-${b.scenarioId}`, b, lcSnaps.snapshots[i]!));

  const allReports = [...rcReports, ...lcReports];
  const matchedCount = allReports.filter(r => r.matched).length;
  const mismatchedCount = allReports.length - matchedCount;

  const coreFieldDriftSummary: string[] = [];
  for (const r of allReports) {
    for (const s of r.differenceSummaries) coreFieldDriftSummary.push(`${r.scenarioId}: ${s}`);
  }

  const hasBlocking = allReports.some(r => r.mismatchedFields.some(f => classifyOrchestrationFieldDrift(f) === "blocking"));
  const hasNotice = allReports.some(r => r.mismatchedFields.some(f => classifyOrchestrationFieldDrift(f) === "notice"));
  const overallStatus: Phase4MatrixOverallStatus = hasBlocking ? "failed" : hasNotice ? "passed_with_notice" : "passed";

  const matrix: Phase4OrchestrationDifferenceMatrix = {
    matrixRunId,
    riskCaseScenarioReports: rcReports,
    liquidationCaseScenarioReports: lcReports,
    totalScenarios: allReports.length,
    matchedScenarios: matchedCount,
    mismatchedScenarios: mismatchedCount,
    coreFieldDriftSummary,
    overallStatus,
    matrixSummary: `Phase 4 orchestration matrix [${matrixRunId}]: ${matchedCount}/${allReports.length} matched, status=${overallStatus}`
  };

  const acceptanceInput = buildPhase4AcceptanceInputSnapshot(matrix);
  return { matrix, acceptanceInput };
};

// ─── acceptance input builder ───────────────────────────────────────────────

const buildPhase4AcceptanceInputSnapshot = (
  matrix: Phase4OrchestrationDifferenceMatrix
): Phase4AcceptanceInputSnapshot => {
  const allReports = [...matrix.riskCaseScenarioReports, ...matrix.liquidationCaseScenarioReports];

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const r of allReports) {
    for (const f of r.mismatchedFields) {
      const label = `${r.scenarioId}: ${f} drifted`;
      if (classifyOrchestrationFieldDrift(f) === "blocking") blockingIssues.push(label);
      else nonBlockingNotices.push(label);
    }
  }

  const recommendedNextActions: string[] = [];
  if (matrix.overallStatus === "passed") {
    recommendedNextActions.push("Proceed to Phase 4 acceptance gate (Step 5)");
  } else if (matrix.overallStatus === "passed_with_notice") {
    recommendedNextActions.push("Review notice-level drift before proceeding");
    recommendedNextActions.push("Proceed to Phase 4 acceptance gate with documented notices");
  } else {
    recommendedNextActions.push("Resolve blocking drift before proceeding");
    recommendedNextActions.push("Re-run difference matrix after fixes");
  }

  return {
    baselineCoreFields: [...PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS],
    riskCaseScenarioIds: matrix.riskCaseScenarioReports.map(r => r.scenarioId),
    liquidationCaseScenarioIds: matrix.liquidationCaseScenarioReports.map(r => r.scenarioId),
    differenceMatrixOverallStatus: matrix.overallStatus,
    keyDriftFindings: matrix.coreFieldDriftSummary,
    blockingIssues,
    nonBlockingNotices,
    recommendedNextActions
  };
};
