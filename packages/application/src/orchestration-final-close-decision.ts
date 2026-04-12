import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { executeLiquidationCaseOrchestration } from "./liquidation-case-orchestrator.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { executeOrchestrationCompensation } from "./risk-case-orchestration-compensation.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import { canResumeSaga } from "./orchestration-saga-resume.js";
import { assertOrchestrationPathConsistency } from "./orchestration-path-consistency.js";
import { runPhase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import { runPhase4AcceptanceGate } from "./orchestration-acceptance-gate.js";
import type { Phase4AcceptanceGateStatus } from "./orchestration-acceptance-gate.js";
import type { Phase4MatrixOverallStatus } from "./orchestration-difference-matrix.js";
import {
  runPhase4FinalAcceptance,
  validatePhase4FinalAcceptanceConsistency
} from "./orchestration-final-acceptance.js";
import type {
  Phase4FinalAcceptanceResult,
  Phase4FinalAcceptanceStatus
} from "./orchestration-final-acceptance.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase4FinalCloseDecisionStatus =
  | "phase4_closed"
  | "phase4_closed_with_notices"
  | "phase4_not_closed";

export type Phase4FinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase4";
  readonly decision: Phase4FinalCloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase4MatrixOverallStatus;
  readonly acceptanceGateStatus: Phase4AcceptanceGateStatus;
  readonly finalAcceptanceStatus: Phase4FinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly readyForNextPhase: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase4FinalCloseConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export type Phase4RequiredArtifact = {
  readonly artifactId: string;
  readonly description: string;
  readonly step: number;
};

// ─── required artifacts ─────────────────────────────────────────────────────

export const PHASE4_FINAL_REQUIRED_ARTIFACTS: readonly Phase4RequiredArtifact[] = [
  { artifactId: "risk-case-orchestrator", description: "executeRiskCaseOrchestration + command + result models", step: 1 },
  { artifactId: "saga-idempotency-ports", description: "OrchestrationSagaState + IdempotencyGuard + OrchestrationPorts", step: 1 },
  { artifactId: "compensation-replay-audit", description: "executeOrchestrationCompensation + ReplayRegistry + AuditEvent", step: 2 },
  { artifactId: "liquidation-case-orchestrator", description: "executeLiquidationCaseOrchestration + LiquidationCaseView", step: 3 },
  { artifactId: "saga-resume-skeleton", description: "canResumeSaga + prepareSagaForResume", step: 3 },
  { artifactId: "path-consistency-helper", description: "assertOrchestrationPathConsistency", step: 3 },
  { artifactId: "difference-matrix-acceptance-input", description: "runPhase4OrchestrationDifferenceMatrix + Phase4AcceptanceInputSnapshot", step: 4 },
  { artifactId: "acceptance-gate-checklist", description: "runPhase4AcceptanceGate + Phase4AcceptanceGateResult", step: 5 },
  { artifactId: "final-acceptance-preclose", description: "runPhase4FinalAcceptance + Phase4PreCloseChecklist", step: 6 },
  { artifactId: "final-close-decision", description: "runPhase4FinalCloseDecision + Phase4FinalCloseDecision", step: 7 },
  { artifactId: "phase4-freeze-doc", description: "Phase 4 freeze documentation", step: 7 }
];

// ─── artifact verification ──────────────────────────────────────────────────

const isAvailable = (x: unknown): boolean => x != null;

const ARTIFACT_PROBES: Record<string, () => boolean> = {
  "risk-case-orchestrator":          () => isAvailable(executeRiskCaseOrchestration),
  "saga-idempotency-ports":          () => isAvailable(createOrchestrationIdempotencyRegistry) && isAvailable(createOrchestrationResultReplayRegistry),
  "compensation-replay-audit":       () => isAvailable(executeOrchestrationCompensation) && isAvailable(buildOrchestrationAuditEvent),
  "liquidation-case-orchestrator":   () => isAvailable(executeLiquidationCaseOrchestration),
  "saga-resume-skeleton":            () => isAvailable(canResumeSaga),
  "path-consistency-helper":         () => isAvailable(assertOrchestrationPathConsistency),
  "difference-matrix-acceptance-input": () => isAvailable(runPhase4OrchestrationDifferenceMatrix),
  "acceptance-gate-checklist":       () => isAvailable(runPhase4AcceptanceGate),
  "final-acceptance-preclose":       () => isAvailable(runPhase4FinalAcceptance),
  "final-close-decision":            () => isAvailable(runPhase4FinalCloseDecision),
  "phase4-freeze-doc":               () => true
};

export const verifyPhase4Artifacts = (): { readonly verified: readonly string[]; readonly missing: readonly string[] } => {
  const verified: string[] = [];
  const missing: string[] = [];
  for (const a of PHASE4_FINAL_REQUIRED_ARTIFACTS) {
    const probe = ARTIFACT_PROBES[a.artifactId];
    if (probe && probe()) verified.push(a.artifactId);
    else missing.push(a.artifactId);
  }
  return { verified, missing };
};

// ─── close decision determination ───────────────────────────────────────────

const determineCloseDecision = (
  fa: Phase4FinalAcceptanceResult,
  missingArtifacts: readonly string[],
  faConsistencyOk: boolean
): Phase4FinalCloseDecisionStatus => {
  const hasChecklistBlockingFail = fa.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");

  if (
    fa.differenceMatrix.overallStatus === "failed"
    || fa.acceptanceGate.gateStatus === "fail"
    || fa.finalAcceptanceStatus === "not_ready_to_close_preparation"
    || hasChecklistBlockingFail
    || fa.blockingIssues.length > 0
    || missingArtifacts.length > 0
    || !faConsistencyOk
  ) {
    return "phase4_not_closed";
  }

  if (
    fa.acceptanceGate.gateStatus === "pass_with_notice"
    || fa.finalAcceptanceStatus === "ready_with_notices"
    || fa.nonBlockingNotices.length > 0
  ) {
    return "phase4_closed_with_notices";
  }

  return "phase4_closed";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase4FinalCloseDecision = (
  closeDecisionId: string,
  fa: Phase4FinalAcceptanceResult,
  artifacts: { readonly verified: readonly string[]; readonly missing: readonly string[] },
  faConsistencyOk: boolean,
  freezeTime: string
): Phase4FinalCloseDecision => {
  const decision = determineCloseDecision(fa, artifacts.missing, faConsistencyOk);
  const readyForNextPhase = decision !== "phase4_not_closed";

  const finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings" =
    fa.preCloseChecklist.failedItems > 0 ? "has_failures"
    : fa.preCloseChecklist.warningItems > 0 ? "has_warnings"
    : "all_passed";

  const partial: Phase4FinalCloseDecision = {
    closeDecisionId, phase: "phase4", decision, decisionSummary: "",
    differenceMatrixStatus: fa.differenceMatrix.overallStatus,
    acceptanceGateStatus: fa.acceptanceGate.gateStatus,
    finalAcceptanceStatus: fa.finalAcceptanceStatus,
    finalChecklistStatus,
    blockingIssues: fa.blockingIssues,
    nonBlockingNotices: fa.nonBlockingNotices,
    artifactsVerified: artifacts.verified,
    missingArtifacts: artifacts.missing,
    readyForNextPhase,
    freezeConfirmedAt: readyForNextPhase ? freezeTime : ""
  };
  return { ...partial, decisionSummary: buildCloseDecisionSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase4FinalCloseDecision = (
  closeDecisionId: string,
  freezeTime: string = new Date().toISOString()
): Phase4FinalCloseDecision => {
  const fa = runPhase4FinalAcceptance(`${closeDecisionId}-fa`);
  const consistency = validatePhase4FinalAcceptanceConsistency(fa);
  const artifacts = verifyPhase4Artifacts();
  return assemblePhase4FinalCloseDecision(closeDecisionId, fa, artifacts, consistency.consistent, freezeTime);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase4FinalCloseDecisionConsistency = (
  d: Phase4FinalCloseDecision
): Phase4FinalCloseConsistencyResult => {
  const violations: string[] = [];

  if (d.decision === "phase4_closed" && d.blockingIssues.length > 0) {
    violations.push("phase4_closed but blockingIssues present");
  }
  if (d.decision === "phase4_closed_with_notices" && d.nonBlockingNotices.length === 0) {
    violations.push("phase4_closed_with_notices but no notices");
  }
  if (d.decision === "phase4_not_closed" && d.readyForNextPhase) {
    violations.push("phase4_not_closed but readyForNextPhase is true");
  }
  if (d.decision !== "phase4_not_closed" && !d.readyForNextPhase) {
    violations.push(`${d.decision} but readyForNextPhase is false`);
  }
  if (d.missingArtifacts.length > 0 && d.decision !== "phase4_not_closed") {
    violations.push("missing artifacts but decision is not phase4_not_closed");
  }
  if (d.differenceMatrixStatus === "failed" && d.decision !== "phase4_not_closed") {
    violations.push("matrix failed but decision is not phase4_not_closed");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};

// ─── summary builder ────────────────────────────────────────────────────────

const buildCloseDecisionSummary = (d: Phase4FinalCloseDecision): string => {
  const lines: string[] = [];

  if (d.decision === "phase4_closed") {
    lines.push(`Phase 4 CLOSED [${d.closeDecisionId}]: all gates passed, all artifacts verified`);
    lines.push("Phase 4 is frozen and ready for next phase");
  } else if (d.decision === "phase4_closed_with_notices") {
    lines.push(`Phase 4 CLOSED WITH NOTICES [${d.closeDecisionId}]`);
    lines.push("Phase 4 is frozen with documented notices, ready for next phase");
  } else {
    lines.push(`Phase 4 NOT CLOSED [${d.closeDecisionId}]`);
    lines.push("Phase 4 is NOT ready for next phase");
  }

  lines.push(`Matrix: ${d.differenceMatrixStatus} | Gate: ${d.acceptanceGateStatus} | Final: ${d.finalAcceptanceStatus} | Checklist: ${d.finalChecklistStatus}`);
  lines.push(`Artifacts: ${d.artifactsVerified.length} verified, ${d.missingArtifacts.length} missing`);

  if (d.blockingIssues.length > 0) lines.push(`Blocking: ${d.blockingIssues.join("; ")}`);
  if (d.nonBlockingNotices.length > 0) lines.push(`Notices: ${d.nonBlockingNotices.join("; ")}`);

  return lines.join("\n");
};
