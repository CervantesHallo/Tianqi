import { runPhase7PublishPreflight, buildContractFreezeBaseline, validatePhase7PreflightConsistency } from "./phase7-publish-preflight.js";
import { validateRollbackPlan, validateRunbookSkeleton, runPhase7DifferenceMatrixDraft } from "./phase7-rollback-runbook.js";
import { runPhase7DifferenceMatrix, assertPhase7BaselineConsistency } from "./phase7-difference-matrix.js";
import { runPhase7AcceptanceGate } from "./phase7-acceptance-gate.js";
import type { Phase7GateStatus } from "./phase7-acceptance-gate.js";
import type { Phase7MatrixOverallStatus } from "./phase7-difference-matrix.js";
import { runPhase7FinalAcceptance, validatePhase7FinalAcceptanceConsistency } from "./phase7-final-acceptance.js";
import type { Phase7FinalAcceptanceResult, Phase7FinalAcceptanceStatus } from "./phase7-final-acceptance.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase7FinalCloseDecisionStatus = "phase7_closed" | "phase7_closed_with_notices" | "phase7_not_closed";

export type Phase7FinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase7";
  readonly decision: Phase7FinalCloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase7MatrixOverallStatus;
  readonly acceptanceGateStatus: Phase7GateStatus;
  readonly finalAcceptanceStatus: Phase7FinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly readyForNextPhase: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase7FinalCloseConsistencyResult = { readonly consistent: boolean; readonly violations: readonly string[]; readonly checkedInvariants: number; };

export type Phase7RequiredArtifact = { readonly artifactId: string; readonly description: string; readonly step: number; };

// ─── required artifacts ─────────────────────────────────────────────────────

export const PHASE7_FINAL_REQUIRED_ARTIFACTS: readonly Phase7RequiredArtifact[] = [
  { artifactId: "publish-preflight-runner", description: "runPhase7PublishPreflight + Phase7PublishPreflightResult", step: 1 },
  { artifactId: "contract-freeze-baseline", description: "ContractFreezeBaseline + buildContractFreezeBaseline", step: 1 },
  { artifactId: "blocking-rules-consistency", description: "Blocking rules + validatePhase7PreflightConsistency", step: 1 },
  { artifactId: "rollback-plan-skeleton", description: "RollbackPlanSkeleton + validateRollbackPlan", step: 2 },
  { artifactId: "runbook-skeleton", description: "ReleaseRunbookSkeleton + validateRunbookSkeleton", step: 2 },
  { artifactId: "difference-matrix-draft", description: "runPhase7DifferenceMatrixDraft", step: 2 },
  { artifactId: "phase7-difference-matrix-input", description: "runPhase7DifferenceMatrix + Phase7AcceptanceInputSnapshot", step: 3 },
  { artifactId: "phase7-acceptance-gate-checklist", description: "runPhase7AcceptanceGate + Phase7AcceptanceGateResult", step: 4 },
  { artifactId: "phase7-final-acceptance-preclose", description: "runPhase7FinalAcceptance + Phase7PreCloseChecklist", step: 5 },
  { artifactId: "phase7-final-close-decision", description: "runPhase7FinalCloseDecision + Phase7FinalCloseDecision", step: 6 },
  { artifactId: "phase7-freeze-doc", description: "Phase 7 freeze documentation", step: 6 }
];

// ─── artifact verification ──────────────────────────────────────────────────

const isAvailable = (x: unknown): boolean => x != null;

const ARTIFACT_PROBES: Record<string, () => boolean> = {
  "publish-preflight-runner": () => isAvailable(runPhase7PublishPreflight),
  "contract-freeze-baseline": () => isAvailable(buildContractFreezeBaseline),
  "blocking-rules-consistency": () => isAvailable(validatePhase7PreflightConsistency),
  "rollback-plan-skeleton": () => isAvailable(validateRollbackPlan),
  "runbook-skeleton": () => isAvailable(validateRunbookSkeleton),
  "difference-matrix-draft": () => isAvailable(runPhase7DifferenceMatrixDraft),
  "phase7-difference-matrix-input": () => isAvailable(runPhase7DifferenceMatrix) && isAvailable(assertPhase7BaselineConsistency),
  "phase7-acceptance-gate-checklist": () => isAvailable(runPhase7AcceptanceGate),
  "phase7-final-acceptance-preclose": () => isAvailable(runPhase7FinalAcceptance),
  "phase7-final-close-decision": () => isAvailable(runPhase7FinalCloseDecision),
  "phase7-freeze-doc": () => true
};

export const verifyPhase7Artifacts = (): { readonly verified: readonly string[]; readonly missing: readonly string[] } => {
  const verified: string[] = [];
  const missing: string[] = [];
  for (const a of PHASE7_FINAL_REQUIRED_ARTIFACTS) {
    const probe = ARTIFACT_PROBES[a.artifactId];
    if (probe && probe()) verified.push(a.artifactId); else missing.push(a.artifactId);
  }
  return { verified, missing };
};

// ─── close decision determination ───────────────────────────────────────────

const determineCloseDecision = (fa: Phase7FinalAcceptanceResult, missingArtifacts: readonly string[], faConsistencyOk: boolean): Phase7FinalCloseDecisionStatus => {
  const hasChecklistBlockingFail = fa.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");
  if (fa.differenceMatrix.overallStatus === "failed" || fa.acceptanceGate.gateStatus === "fail" || fa.finalAcceptanceStatus === "not_ready_to_close_preparation" || hasChecklistBlockingFail || fa.blockingIssues.length > 0 || missingArtifacts.length > 0 || !faConsistencyOk) return "phase7_not_closed";
  if (fa.acceptanceGate.gateStatus === "pass_with_notice" || fa.finalAcceptanceStatus === "ready_with_notices" || fa.nonBlockingNotices.length > 0) return "phase7_closed_with_notices";
  return "phase7_closed";
};

// ─── assembly ───────────────────────────────────────────────────────────────

export const assemblePhase7FinalCloseDecision = (closeDecisionId: string, fa: Phase7FinalAcceptanceResult, artifacts: { readonly verified: readonly string[]; readonly missing: readonly string[] }, faConsistencyOk: boolean, freezeTime: string): Phase7FinalCloseDecision => {
  const decision = determineCloseDecision(fa, artifacts.missing, faConsistencyOk);
  const readyForNextPhase = decision !== "phase7_not_closed";
  const finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings" = fa.preCloseChecklist.failedItems > 0 ? "has_failures" : fa.preCloseChecklist.warningItems > 0 ? "has_warnings" : "all_passed";
  const partial: Phase7FinalCloseDecision = { closeDecisionId, phase: "phase7", decision, decisionSummary: "", differenceMatrixStatus: fa.differenceMatrix.overallStatus, acceptanceGateStatus: fa.acceptanceGate.gateStatus, finalAcceptanceStatus: fa.finalAcceptanceStatus, finalChecklistStatus, blockingIssues: fa.blockingIssues, nonBlockingNotices: fa.nonBlockingNotices, artifactsVerified: artifacts.verified, missingArtifacts: artifacts.missing, readyForNextPhase, freezeConfirmedAt: readyForNextPhase ? freezeTime : "" };
  return { ...partial, decisionSummary: buildCloseDecisionSummary(partial) };
};

// ─── full pipeline runner ───────────────────────────────────────────────────

export const runPhase7FinalCloseDecision = (closeDecisionId: string, freezeTime: string = new Date().toISOString()): Phase7FinalCloseDecision => {
  const fa = runPhase7FinalAcceptance(`${closeDecisionId}-fa`);
  const consistency = validatePhase7FinalAcceptanceConsistency(fa);
  const artifacts = verifyPhase7Artifacts();
  return assemblePhase7FinalCloseDecision(closeDecisionId, fa, artifacts, consistency.consistent, freezeTime);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase7FinalCloseDecisionConsistency = (d: Phase7FinalCloseDecision): Phase7FinalCloseConsistencyResult => {
  const violations: string[] = [];
  if (d.decision === "phase7_closed" && d.blockingIssues.length > 0) violations.push("phase7_closed but blockingIssues present");
  if (d.decision === "phase7_closed_with_notices" && d.nonBlockingNotices.length === 0) violations.push("phase7_closed_with_notices but no notices");
  if (d.decision === "phase7_not_closed" && d.readyForNextPhase) violations.push("phase7_not_closed but readyForNextPhase is true");
  if (d.decision !== "phase7_not_closed" && !d.readyForNextPhase) violations.push(`${d.decision} but readyForNextPhase is false`);
  if (d.missingArtifacts.length > 0 && d.decision !== "phase7_not_closed") violations.push("missing artifacts but decision is not phase7_not_closed");
  if (d.differenceMatrixStatus === "failed" && d.decision !== "phase7_not_closed") violations.push("matrix failed but decision is not phase7_not_closed");
  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};

// ─── summary builder ────────────────────────────────────────────────────────

const buildCloseDecisionSummary = (d: Phase7FinalCloseDecision): string => {
  const lines: string[] = [];
  if (d.decision === "phase7_closed") { lines.push(`Phase 7 CLOSED [${d.closeDecisionId}]: all gates passed, all artifacts verified`); lines.push("Phase 7 is frozen and ready for next phase"); }
  else if (d.decision === "phase7_closed_with_notices") { lines.push(`Phase 7 CLOSED WITH NOTICES [${d.closeDecisionId}]`); lines.push("Phase 7 is frozen with documented notices, ready for next phase"); }
  else { lines.push(`Phase 7 NOT CLOSED [${d.closeDecisionId}]`); lines.push("Phase 7 is NOT ready for next phase"); }
  lines.push(`Matrix: ${d.differenceMatrixStatus} | Gate: ${d.acceptanceGateStatus} | Final: ${d.finalAcceptanceStatus} | Checklist: ${d.finalChecklistStatus}`);
  lines.push(`Artifacts: ${d.artifactsVerified.length} verified, ${d.missingArtifacts.length} missing`);
  if (d.blockingIssues.length > 0) lines.push(`Blocking: ${d.blockingIssues.join("; ")}`);
  if (d.nonBlockingNotices.length > 0) lines.push(`Notices: ${d.nonBlockingNotices.join("; ")}`);
  return lines.join("\n");
};
