import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import { runCaseReplay } from "./case-replay-handler.js";
import { reconstructCaseFromReplayInput } from "./case-reconstruction.js";
import { validateReplayConsistency } from "./replay-consistency.js";
import { runBatchCaseReplay, buildReplayBaselineSnapshot, assertBatchReplayConsistency } from "./batch-case-replay.js";
import { runPhase5ReplayDifferenceMatrix, assertPhase5ReplayBaselineConsistency } from "./replay-difference-matrix.js";
import { runPhase5ReplayAcceptanceGate } from "./replay-acceptance-gate.js";
import type { Phase5ReplayGateStatus } from "./replay-acceptance-gate.js";
import type { Phase5MatrixOverallStatus } from "./replay-difference-matrix.js";
import {
  runPhase5ReplayFinalAcceptance,
  validatePhase5ReplayFinalAcceptanceConsistency
} from "./replay-final-acceptance.js";
import type {
  Phase5ReplayFinalAcceptanceResult,
  Phase5ReplayFinalAcceptanceStatus
} from "./replay-final-acceptance.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase5ReplayFinalCloseDecisionStatus =
  | "phase5_closed"
  | "phase5_closed_with_notices"
  | "phase5_not_closed";

export type Phase5ReplayFinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase5";
  readonly decision: Phase5ReplayFinalCloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase5MatrixOverallStatus;
  readonly acceptanceGateStatus: Phase5ReplayGateStatus;
  readonly finalAcceptanceStatus: Phase5ReplayFinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly readyForNextPhase: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase5ReplayFinalCloseConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export type Phase5RequiredArtifact = {
  readonly artifactId: string;
  readonly description: string;
  readonly step: number;
};

// ─── required artifacts ─────────────────────────────────────────────────────

export const PHASE5_FINAL_REQUIRED_ARTIFACTS: readonly Phase5RequiredArtifact[] = [
  { artifactId: "event-store-boundary", description: "StoredAuditEvent + AuditEventStorePort + createInMemoryAuditEventStore", step: 1 },
  { artifactId: "single-case-replay-reconstruction", description: "runCaseReplay + reconstructCaseFromReplayInput + CaseReplayResult", step: 1 },
  { artifactId: "replay-consistency-skeleton", description: "validateReplayConsistency", step: 1 },
  { artifactId: "phase4-audit-events-into-store", description: "Phase 4 orchestration audit events appendable to store", step: 1 },
  { artifactId: "batch-replay-skeleton", description: "runBatchCaseReplay + BatchCaseReplayResult", step: 2 },
  { artifactId: "comparison-baseline-snapshot", description: "CaseReconstructionComparison + buildReplayBaselineSnapshot + assertBatchReplayConsistency", step: 2 },
  { artifactId: "replay-difference-matrix-acceptance-input", description: "runPhase5ReplayDifferenceMatrix + Phase5ReplayAcceptanceInputSnapshot", step: 3 },
  { artifactId: "replay-acceptance-gate-checklist", description: "runPhase5ReplayAcceptanceGate + Phase5ReplayAcceptanceGateResult", step: 4 },
  { artifactId: "replay-final-acceptance-preclose", description: "runPhase5ReplayFinalAcceptance + Phase5ReplayPreCloseChecklist", step: 5 },
  { artifactId: "replay-final-close-decision", description: "runPhase5ReplayFinalCloseDecision + Phase5ReplayFinalCloseDecision", step: 6 },
  { artifactId: "phase5-freeze-doc", description: "Phase 5 freeze documentation", step: 6 }
];

// ─── artifact verification ──────────────────────────────────────────────────

const isAvailable = (x: unknown): boolean => x != null;

const ARTIFACT_PROBES: Record<string, () => boolean> = {
  "event-store-boundary":                    () => isAvailable(createInMemoryAuditEventStore),
  "single-case-replay-reconstruction":       () => isAvailable(runCaseReplay) && isAvailable(reconstructCaseFromReplayInput),
  "replay-consistency-skeleton":             () => isAvailable(validateReplayConsistency),
  "phase4-audit-events-into-store":          () => isAvailable(createInMemoryAuditEventStore),
  "batch-replay-skeleton":                   () => isAvailable(runBatchCaseReplay),
  "comparison-baseline-snapshot":            () => isAvailable(buildReplayBaselineSnapshot) && isAvailable(assertBatchReplayConsistency),
  "replay-difference-matrix-acceptance-input": () => isAvailable(runPhase5ReplayDifferenceMatrix) && isAvailable(assertPhase5ReplayBaselineConsistency),
  "replay-acceptance-gate-checklist":        () => isAvailable(runPhase5ReplayAcceptanceGate),
  "replay-final-acceptance-preclose":        () => isAvailable(runPhase5ReplayFinalAcceptance),
  "replay-final-close-decision":             () => isAvailable(runPhase5ReplayFinalCloseDecision),
  "phase5-freeze-doc":                       () => true
};

export const verifyPhase5ReplayArtifacts = (): { readonly verified: readonly string[]; readonly missing: readonly string[] } => {
  const verified: string[] = [];
  const missing: string[] = [];
  for (const a of PHASE5_FINAL_REQUIRED_ARTIFACTS) {
    const probe = ARTIFACT_PROBES[a.artifactId];
    if (probe && probe()) verified.push(a.artifactId);
    else missing.push(a.artifactId);
  }
  return { verified, missing };
};

// ─── close decision determination ───────────────────────────────────────────

const determineCloseDecision = (
  fa: Phase5ReplayFinalAcceptanceResult,
  missingArtifacts: readonly string[],
  faConsistencyOk: boolean
): Phase5ReplayFinalCloseDecisionStatus => {
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
    return "phase5_not_closed";
  }

  if (
    fa.acceptanceGate.gateStatus === "pass_with_notice"
    || fa.finalAcceptanceStatus === "ready_with_notices"
    || fa.nonBlockingNotices.length > 0
  ) {
    return "phase5_closed_with_notices";
  }

  return "phase5_closed";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase5ReplayFinalCloseDecision = (
  closeDecisionId: string,
  fa: Phase5ReplayFinalAcceptanceResult,
  artifacts: { readonly verified: readonly string[]; readonly missing: readonly string[] },
  faConsistencyOk: boolean,
  freezeTime: string
): Phase5ReplayFinalCloseDecision => {
  const decision = determineCloseDecision(fa, artifacts.missing, faConsistencyOk);
  const readyForNextPhase = decision !== "phase5_not_closed";

  const finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings" =
    fa.preCloseChecklist.failedItems > 0 ? "has_failures"
    : fa.preCloseChecklist.warningItems > 0 ? "has_warnings"
    : "all_passed";

  const partial: Phase5ReplayFinalCloseDecision = {
    closeDecisionId, phase: "phase5", decision, decisionSummary: "",
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

export const runPhase5ReplayFinalCloseDecision = (
  closeDecisionId: string,
  freezeTime: string = new Date().toISOString()
): Phase5ReplayFinalCloseDecision => {
  const fa = runPhase5ReplayFinalAcceptance(`${closeDecisionId}-fa`);
  const consistency = validatePhase5ReplayFinalAcceptanceConsistency(fa);
  const artifacts = verifyPhase5ReplayArtifacts();
  return assemblePhase5ReplayFinalCloseDecision(closeDecisionId, fa, artifacts, consistency.consistent, freezeTime);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase5ReplayFinalCloseDecisionConsistency = (
  d: Phase5ReplayFinalCloseDecision
): Phase5ReplayFinalCloseConsistencyResult => {
  const violations: string[] = [];

  if (d.decision === "phase5_closed" && d.blockingIssues.length > 0)
    violations.push("phase5_closed but blockingIssues present");
  if (d.decision === "phase5_closed_with_notices" && d.nonBlockingNotices.length === 0)
    violations.push("phase5_closed_with_notices but no notices");
  if (d.decision === "phase5_not_closed" && d.readyForNextPhase)
    violations.push("phase5_not_closed but readyForNextPhase is true");
  if (d.decision !== "phase5_not_closed" && !d.readyForNextPhase)
    violations.push(`${d.decision} but readyForNextPhase is false`);
  if (d.missingArtifacts.length > 0 && d.decision !== "phase5_not_closed")
    violations.push("missing artifacts but decision is not phase5_not_closed");
  if (d.differenceMatrixStatus === "failed" && d.decision !== "phase5_not_closed")
    violations.push("matrix failed but decision is not phase5_not_closed");

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};

// ─── summary builder ────────────────────────────────────────────────────────

const buildCloseDecisionSummary = (d: Phase5ReplayFinalCloseDecision): string => {
  const lines: string[] = [];

  if (d.decision === "phase5_closed") {
    lines.push(`Phase 5 CLOSED [${d.closeDecisionId}]: all gates passed, all artifacts verified`);
    lines.push("Phase 5 is frozen and ready for next phase");
  } else if (d.decision === "phase5_closed_with_notices") {
    lines.push(`Phase 5 CLOSED WITH NOTICES [${d.closeDecisionId}]`);
    lines.push("Phase 5 is frozen with documented notices, ready for next phase");
  } else {
    lines.push(`Phase 5 NOT CLOSED [${d.closeDecisionId}]`);
    lines.push("Phase 5 is NOT ready for next phase");
  }

  lines.push(`Matrix: ${d.differenceMatrixStatus} | Gate: ${d.acceptanceGateStatus} | Final: ${d.finalAcceptanceStatus} | Checklist: ${d.finalChecklistStatus}`);
  lines.push(`Artifacts: ${d.artifactsVerified.length} verified, ${d.missingArtifacts.length} missing`);

  if (d.blockingIssues.length > 0) lines.push(`Blocking: ${d.blockingIssues.join("; ")}`);
  if (d.nonBlockingNotices.length > 0) lines.push(`Notices: ${d.nonBlockingNotices.join("; ")}`);

  return lines.join("\n");
};
