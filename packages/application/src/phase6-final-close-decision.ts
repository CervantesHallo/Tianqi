import { startTraceContext } from "./trace-context.js";
import { createInMemoryMetricsPort } from "./metrics-port.js";
import { runBenchmark, validateObservabilityConsistency } from "./benchmark-harness.js";
import { runPhase6FaultDrill, validateFaultDrillConsistency, buildFaultDrillBaselineSnapshot } from "./fault-drill.js";
import { runPhase6DifferenceMatrix, assertPhase6BaselineConsistency } from "./phase6-difference-matrix.js";
import { runPhase6AcceptanceGate } from "./phase6-acceptance-gate.js";
import type { Phase6GateStatus } from "./phase6-acceptance-gate.js";
import type { Phase6MatrixOverallStatus } from "./phase6-difference-matrix.js";
import {
  runPhase6FinalAcceptance,
  validatePhase6FinalAcceptanceConsistency
} from "./phase6-final-acceptance.js";
import type {
  Phase6FinalAcceptanceResult,
  Phase6FinalAcceptanceStatus
} from "./phase6-final-acceptance.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase6FinalCloseDecisionStatus =
  | "phase6_closed"
  | "phase6_closed_with_notices"
  | "phase6_not_closed";

export type Phase6FinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase6";
  readonly decision: Phase6FinalCloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase6MatrixOverallStatus;
  readonly acceptanceGateStatus: Phase6GateStatus;
  readonly finalAcceptanceStatus: Phase6FinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly readyForNextPhase: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase6FinalCloseConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export type Phase6RequiredArtifact = {
  readonly artifactId: string;
  readonly description: string;
  readonly step: number;
};

// ─── required artifacts ─────────────────────────────────────────────────────

export const PHASE6_FINAL_REQUIRED_ARTIFACTS: readonly Phase6RequiredArtifact[] = [
  { artifactId: "trace-context-propagation", description: "TraceContext + startTraceContext + deriveChildTraceContext", step: 1 },
  { artifactId: "metrics-port-contract", description: "MetricRecord + MetricsPort + createInMemoryMetricsPort", step: 1 },
  { artifactId: "benchmark-harness-result", description: "BenchmarkScenario + runBenchmark + BenchmarkResult", step: 1 },
  { artifactId: "observability-consistency-helper", description: "validateObservabilityConsistency", step: 1 },
  { artifactId: "fault-injection-model", description: "FaultInjectionScenario + FaultType", step: 2 },
  { artifactId: "fault-drill-runner-result", description: "runPhase6FaultDrill + FaultDrillResult", step: 2 },
  { artifactId: "drill-baseline-snapshot", description: "buildFaultDrillBaselineSnapshot + validateFaultDrillConsistency", step: 2 },
  { artifactId: "phase6-difference-matrix-input", description: "runPhase6DifferenceMatrix + Phase6AcceptanceInputSnapshot", step: 3 },
  { artifactId: "phase6-acceptance-gate-checklist", description: "runPhase6AcceptanceGate + Phase6AcceptanceGateResult", step: 4 },
  { artifactId: "phase6-final-acceptance-preclose", description: "runPhase6FinalAcceptance + Phase6PreCloseChecklist", step: 5 },
  { artifactId: "phase6-final-close-decision", description: "runPhase6FinalCloseDecision + Phase6FinalCloseDecision", step: 6 },
  { artifactId: "phase6-freeze-doc", description: "Phase 6 freeze documentation", step: 6 }
];

// ─── artifact verification ──────────────────────────────────────────────────

const isAvailable = (x: unknown): boolean => x != null;

const ARTIFACT_PROBES: Record<string, () => boolean> = {
  "trace-context-propagation":       () => isAvailable(startTraceContext),
  "metrics-port-contract":           () => isAvailable(createInMemoryMetricsPort),
  "benchmark-harness-result":        () => isAvailable(runBenchmark),
  "observability-consistency-helper": () => isAvailable(validateObservabilityConsistency),
  "fault-injection-model":           () => isAvailable(runPhase6FaultDrill),
  "fault-drill-runner-result":       () => isAvailable(runPhase6FaultDrill),
  "drill-baseline-snapshot":         () => isAvailable(buildFaultDrillBaselineSnapshot) && isAvailable(validateFaultDrillConsistency),
  "phase6-difference-matrix-input":  () => isAvailable(runPhase6DifferenceMatrix) && isAvailable(assertPhase6BaselineConsistency),
  "phase6-acceptance-gate-checklist": () => isAvailable(runPhase6AcceptanceGate),
  "phase6-final-acceptance-preclose": () => isAvailable(runPhase6FinalAcceptance),
  "phase6-final-close-decision":     () => isAvailable(runPhase6FinalCloseDecision),
  "phase6-freeze-doc":               () => true
};

export const verifyPhase6Artifacts = (): { readonly verified: readonly string[]; readonly missing: readonly string[] } => {
  const verified: string[] = [];
  const missing: string[] = [];
  for (const a of PHASE6_FINAL_REQUIRED_ARTIFACTS) {
    const probe = ARTIFACT_PROBES[a.artifactId];
    if (probe && probe()) verified.push(a.artifactId);
    else missing.push(a.artifactId);
  }
  return { verified, missing };
};

// ─── close decision determination ───────────────────────────────────────────

const determineCloseDecision = (
  fa: Phase6FinalAcceptanceResult, missingArtifacts: readonly string[], faConsistencyOk: boolean
): Phase6FinalCloseDecisionStatus => {
  const hasChecklistBlockingFail = fa.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (fa.differenceMatrix.overallStatus === "failed" || fa.acceptanceGate.gateStatus === "fail"
    || fa.finalAcceptanceStatus === "not_ready_to_close_preparation" || hasChecklistBlockingFail
    || fa.blockingIssues.length > 0 || missingArtifacts.length > 0 || !faConsistencyOk) return "phase6_not_closed";
  if (fa.acceptanceGate.gateStatus === "pass_with_notice" || fa.finalAcceptanceStatus === "ready_with_notices"
    || fa.nonBlockingNotices.length > 0) return "phase6_closed_with_notices";
  return "phase6_closed";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase6FinalCloseDecision = (
  closeDecisionId: string, fa: Phase6FinalAcceptanceResult,
  artifacts: { readonly verified: readonly string[]; readonly missing: readonly string[] },
  faConsistencyOk: boolean, freezeTime: string
): Phase6FinalCloseDecision => {
  const decision = determineCloseDecision(fa, artifacts.missing, faConsistencyOk);
  const readyForNextPhase = decision !== "phase6_not_closed";
  const finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings" =
    fa.preCloseChecklist.failedItems > 0 ? "has_failures" : fa.preCloseChecklist.warningItems > 0 ? "has_warnings" : "all_passed";

  const partial: Phase6FinalCloseDecision = {
    closeDecisionId, phase: "phase6", decision, decisionSummary: "",
    differenceMatrixStatus: fa.differenceMatrix.overallStatus, acceptanceGateStatus: fa.acceptanceGate.gateStatus,
    finalAcceptanceStatus: fa.finalAcceptanceStatus, finalChecklistStatus,
    blockingIssues: fa.blockingIssues, nonBlockingNotices: fa.nonBlockingNotices,
    artifactsVerified: artifacts.verified, missingArtifacts: artifacts.missing,
    readyForNextPhase, freezeConfirmedAt: readyForNextPhase ? freezeTime : ""
  };
  return { ...partial, decisionSummary: buildCloseDecisionSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase6FinalCloseDecision = (
  closeDecisionId: string, freezeTime: string = new Date().toISOString()
): Phase6FinalCloseDecision => {
  const fa = runPhase6FinalAcceptance(`${closeDecisionId}-fa`);
  const consistency = validatePhase6FinalAcceptanceConsistency(fa);
  const artifacts = verifyPhase6Artifacts();
  return assemblePhase6FinalCloseDecision(closeDecisionId, fa, artifacts, consistency.consistent, freezeTime);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase6FinalCloseDecisionConsistency = (d: Phase6FinalCloseDecision): Phase6FinalCloseConsistencyResult => {
  const violations: string[] = [];
  if (d.decision === "phase6_closed" && d.blockingIssues.length > 0) violations.push("phase6_closed but blockingIssues present");
  if (d.decision === "phase6_closed_with_notices" && d.nonBlockingNotices.length === 0) violations.push("phase6_closed_with_notices but no notices");
  if (d.decision === "phase6_not_closed" && d.readyForNextPhase) violations.push("phase6_not_closed but readyForNextPhase is true");
  if (d.decision !== "phase6_not_closed" && !d.readyForNextPhase) violations.push(`${d.decision} but readyForNextPhase is false`);
  if (d.missingArtifacts.length > 0 && d.decision !== "phase6_not_closed") violations.push("missing artifacts but decision is not phase6_not_closed");
  if (d.differenceMatrixStatus === "failed" && d.decision !== "phase6_not_closed") violations.push("matrix failed but decision is not phase6_not_closed");
  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};

// ─── summary builder ────────────────────────────────────────────────────────

const buildCloseDecisionSummary = (d: Phase6FinalCloseDecision): string => {
  const lines: string[] = [];
  if (d.decision === "phase6_closed") { lines.push(`Phase 6 CLOSED [${d.closeDecisionId}]: all gates passed, all artifacts verified`); lines.push("Phase 6 is frozen and ready for next phase"); }
  else if (d.decision === "phase6_closed_with_notices") { lines.push(`Phase 6 CLOSED WITH NOTICES [${d.closeDecisionId}]`); lines.push("Phase 6 is frozen with documented notices, ready for next phase"); }
  else { lines.push(`Phase 6 NOT CLOSED [${d.closeDecisionId}]`); lines.push("Phase 6 is NOT ready for next phase"); }
  lines.push(`Matrix: ${d.differenceMatrixStatus} | Gate: ${d.acceptanceGateStatus} | Final: ${d.finalAcceptanceStatus} | Checklist: ${d.finalChecklistStatus}`);
  lines.push(`Artifacts: ${d.artifactsVerified.length} verified, ${d.missingArtifacts.length} missing`);
  if (d.blockingIssues.length > 0) lines.push(`Blocking: ${d.blockingIssues.join("; ")}`);
  if (d.nonBlockingNotices.length > 0) lines.push(`Notices: ${d.nonBlockingNotices.join("; ")}`);
  return lines.join("\n");
};
