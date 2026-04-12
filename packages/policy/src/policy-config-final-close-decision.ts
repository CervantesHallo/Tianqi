import { buildPolicyKey } from "./policy-descriptor.js";
import { createPolicyRegistry } from "./policy-registry.js";
import { validatePolicyConfigurationRoot } from "./policy-configuration-root.js";
import { resolvePolicyBundle } from "./policy-bundle-resolver.js";
import { prevalidatePolicyConfiguration } from "./policy-configuration-prevalidation.js";
import { dryRunPolicyBundle } from "./policy-bundle-dry-run.js";
import { scoreDescendingRankingPolicyV1 } from "./score-descending-ranking-policy-v1.js";
import { prioritySequentialFundWaterfallPolicyV1 } from "./priority-sequential-fund-waterfall-policy-v1.js";
import { thresholdCandidateSelectionPolicyV1 } from "./threshold-candidate-selection-policy-v1.js";
import { activatePolicyConfigVersion } from "./policy-config-activation.js";
import { rollbackToPreviousPolicyConfigVersion } from "./policy-config-rollback.js";
import { runPolicyConfigActivationPreflight } from "./policy-config-preflight.js";
import { createPolicyConfigVersionAuditRegistry } from "./policy-config-version-audit-record.js";
import { diffPolicyConfigs } from "./policy-bundle-diff.js";
import { buildPolicyConfigVersionReadView } from "./policy-config-version-read-view.js";
import { orchestratePolicyConfigActivation } from "./policy-config-activation-orchestrator.js";
import { PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS } from "./policy-config-version-baseline.js";
import { runPhase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import { runPhase3AcceptanceGate } from "./policy-config-acceptance-gate.js";
import type { Phase3AcceptanceGateStatus } from "./policy-config-acceptance-gate.js";
import type { Phase3MatrixOverallStatus } from "./policy-config-difference-matrix.js";
import {
  runPhase3FinalAcceptance,
  validatePhase3FinalAcceptanceConsistency
} from "./policy-config-final-acceptance.js";
import type {
  Phase3FinalAcceptanceConsistencyResult,
  Phase3FinalAcceptanceResult,
  Phase3FinalAcceptanceStatus
} from "./policy-config-final-acceptance.js";

// ─── types ──────────────────────────────────────────────────────────────────

export type Phase3FinalCloseDecisionStatus =
  | "phase3_closed"
  | "phase3_closed_with_notices"
  | "phase3_not_closed";

export type Phase3FinalCloseDecision = {
  readonly closeDecisionId: string;
  readonly phase: "phase3";
  readonly decision: Phase3FinalCloseDecisionStatus;
  readonly decisionSummary: string;
  readonly differenceMatrixStatus: Phase3MatrixOverallStatus;
  readonly acceptanceGateStatus: Phase3AcceptanceGateStatus;
  readonly finalAcceptanceStatus: Phase3FinalAcceptanceStatus;
  readonly finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings";
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly artifactsVerified: readonly string[];
  readonly missingArtifacts: readonly string[];
  readonly readyForNextPhase: boolean;
  readonly freezeConfirmedAt: string;
};

export type Phase3FinalCloseConsistencyResult = {
  readonly consistent: boolean;
  readonly violations: readonly string[];
  readonly checkedInvariants: number;
};

export type Phase3RequiredArtifact = {
  readonly artifactId: string;
  readonly description: string;
  readonly step: number;
};

// ─── required artifacts ─────────────────────────────────────────────────────

export const PHASE3_FINAL_REQUIRED_ARTIFACTS: readonly Phase3RequiredArtifact[] = [
  { artifactId: "policy-contracts", description: "RankingPolicy / FundWaterfallPolicy / CandidateSelectionPolicy interfaces", step: 1 },
  { artifactId: "policy-descriptor-registry-config-root", description: "PolicyDescriptor / PolicyRegistry / PolicyConfigurationRoot", step: 1 },
  { artifactId: "policy-bundle-prevalidation-dryrun", description: "PolicyBundle / prevalidation / dry-run", step: 2 },
  { artifactId: "real-strategies-v1", description: "ScoreDescendingRankingPolicyV1 / PrioritySequentialFundWaterfallPolicyV1 / ThresholdCandidateSelectionPolicyV1", step: 3 },
  { artifactId: "config-activation-rollback-preflight", description: "activatePolicyConfigVersion / rollbackToPreviousPolicyConfigVersion / runPolicyConfigActivationPreflight", step: 4 },
  { artifactId: "config-audit-diff-readview", description: "PolicyConfigVersionAuditRegistry / diffPolicyConfigs / buildPolicyConfigVersionReadView", step: 5 },
  { artifactId: "activation-orchestration-baseline-freeze", description: "orchestratePolicyConfigActivation / PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS", step: 6 },
  { artifactId: "difference-matrix-acceptance-input", description: "runPhase3PolicyConfigDifferenceMatrix / buildPhase3AcceptanceInputSnapshot", step: 7 },
  { artifactId: "acceptance-gate", description: "runPhase3AcceptanceGate / Phase3AcceptanceGateResult", step: 8 },
  { artifactId: "final-acceptance-runner-preclose-checklist", description: "runPhase3FinalAcceptance / buildPhase3PreCloseChecklist", step: 9 },
  { artifactId: "final-close-decision", description: "runPhase3FinalCloseDecision / Phase3FinalCloseDecision", step: 10 },
  { artifactId: "phase3-freeze-doc", description: "Phase 3 freeze documentation", step: 10 }
];

// ─── artifact verification ──────────────────────────────────────────────────

const isAvailable = (x: unknown): boolean => x != null;

const ARTIFACT_PROBES: Record<string, () => boolean> = {
  "policy-contracts":                       () => isAvailable(buildPolicyKey),
  "policy-descriptor-registry-config-root": () => isAvailable(createPolicyRegistry) && isAvailable(validatePolicyConfigurationRoot),
  "policy-bundle-prevalidation-dryrun":     () => isAvailable(resolvePolicyBundle) && isAvailable(prevalidatePolicyConfiguration) && isAvailable(dryRunPolicyBundle),
  "real-strategies-v1":                     () => isAvailable(scoreDescendingRankingPolicyV1) && isAvailable(prioritySequentialFundWaterfallPolicyV1) && isAvailable(thresholdCandidateSelectionPolicyV1),
  "config-activation-rollback-preflight":   () => isAvailable(activatePolicyConfigVersion) && isAvailable(rollbackToPreviousPolicyConfigVersion) && isAvailable(runPolicyConfigActivationPreflight),
  "config-audit-diff-readview":             () => isAvailable(createPolicyConfigVersionAuditRegistry) && isAvailable(diffPolicyConfigs) && isAvailable(buildPolicyConfigVersionReadView),
  "activation-orchestration-baseline-freeze": () => isAvailable(orchestratePolicyConfigActivation) && isAvailable(PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS),
  "difference-matrix-acceptance-input":     () => isAvailable(runPhase3PolicyConfigDifferenceMatrix),
  "acceptance-gate":                        () => isAvailable(runPhase3AcceptanceGate),
  "final-acceptance-runner-preclose-checklist": () => isAvailable(runPhase3FinalAcceptance),
  "final-close-decision":                   () => isAvailable(runPhase3FinalCloseDecision),
  "phase3-freeze-doc":                      () => true
};

export const verifyPhase3Artifacts = (): { readonly verified: readonly string[]; readonly missing: readonly string[] } => {
  const verified: string[] = [];
  const missing: string[] = [];
  for (const a of PHASE3_FINAL_REQUIRED_ARTIFACTS) {
    const probe = ARTIFACT_PROBES[a.artifactId];
    if (probe && probe()) {
      verified.push(a.artifactId);
    } else {
      missing.push(a.artifactId);
    }
  }
  return { verified, missing };
};

// ─── close decision determination ───────────────────────────────────────────

const determineCloseDecision = (
  fa: Phase3FinalAcceptanceResult,
  consistency: Phase3FinalAcceptanceConsistencyResult,
  missingArtifacts: readonly string[]
): Phase3FinalCloseDecisionStatus => {
  const hasChecklistBlockingFail = fa.preCloseChecklist.items.some(i => i.blocking && i.status === "fail");

  if (
    fa.differenceMatrix.overallStatus === "failed"
    || fa.acceptanceGate.gateStatus === "fail"
    || fa.finalAcceptanceStatus === "not_ready_to_close_preparation"
    || hasChecklistBlockingFail
    || fa.blockingIssues.length > 0
    || missingArtifacts.length > 0
    || !consistency.consistent
  ) {
    return "phase3_not_closed";
  }

  if (
    fa.acceptanceGate.gateStatus === "pass_with_notice"
    || fa.finalAcceptanceStatus === "ready_with_notices"
    || fa.nonBlockingNotices.length > 0
  ) {
    return "phase3_closed_with_notices";
  }

  return "phase3_closed";
};

// ─── assembly (testable with crafted components) ────────────────────────────

export const assemblePhase3FinalCloseDecision = (
  closeDecisionId: string,
  fa: Phase3FinalAcceptanceResult,
  consistency: Phase3FinalAcceptanceConsistencyResult,
  artifacts: { readonly verified: readonly string[]; readonly missing: readonly string[] },
  freezeTime: string
): Phase3FinalCloseDecision => {
  const decision = determineCloseDecision(fa, consistency, artifacts.missing);
  const readyForNextPhase = decision !== "phase3_not_closed";

  const finalChecklistStatus: "all_passed" | "has_failures" | "has_warnings" =
    fa.preCloseChecklist.failedItems > 0 ? "has_failures"
    : fa.preCloseChecklist.warningItems > 0 ? "has_warnings"
    : "all_passed";

  const partial: Phase3FinalCloseDecision = {
    closeDecisionId,
    phase: "phase3",
    decision,
    decisionSummary: "",
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

export const runPhase3FinalCloseDecision = (
  closeDecisionId: string,
  freezeTime: string = new Date().toISOString()
): Phase3FinalCloseDecision => {
  const fa = runPhase3FinalAcceptance(`${closeDecisionId}-fa`);
  const consistency = validatePhase3FinalAcceptanceConsistency(fa);
  const artifacts = verifyPhase3Artifacts();
  return assemblePhase3FinalCloseDecision(closeDecisionId, fa, consistency, artifacts, freezeTime);
};

// ─── consistency validation ─────────────────────────────────────────────────

export const validatePhase3FinalCloseDecisionConsistency = (
  d: Phase3FinalCloseDecision
): Phase3FinalCloseConsistencyResult => {
  const violations: string[] = [];

  if (d.decision === "phase3_closed" && d.blockingIssues.length > 0) {
    violations.push("phase3_closed but blockingIssues present");
  }

  if (d.decision === "phase3_closed_with_notices" && d.nonBlockingNotices.length === 0) {
    violations.push("phase3_closed_with_notices but no notices");
  }

  if (d.decision === "phase3_not_closed" && d.readyForNextPhase) {
    violations.push("phase3_not_closed but readyForNextPhase is true");
  }

  if (d.decision !== "phase3_not_closed" && !d.readyForNextPhase) {
    violations.push(`${d.decision} but readyForNextPhase is false`);
  }

  if (d.missingArtifacts.length > 0 && d.decision !== "phase3_not_closed") {
    violations.push("missing artifacts but decision is not phase3_not_closed");
  }

  if (d.differenceMatrixStatus === "failed" && d.decision !== "phase3_not_closed") {
    violations.push("matrix failed but decision is not phase3_not_closed");
  }

  return { consistent: violations.length === 0, violations, checkedInvariants: 6 };
};

// ─── summary builder ────────────────────────────────────────────────────────

const buildCloseDecisionSummary = (d: Phase3FinalCloseDecision): string => {
  const lines: string[] = [];

  if (d.decision === "phase3_closed") {
    lines.push(`Phase 3 CLOSED [${d.closeDecisionId}]: all gates passed, all artifacts verified`);
    lines.push("Phase 3 is frozen and ready for next phase");
  } else if (d.decision === "phase3_closed_with_notices") {
    lines.push(`Phase 3 CLOSED WITH NOTICES [${d.closeDecisionId}]`);
    lines.push("Phase 3 is frozen with documented notices, ready for next phase");
  } else {
    lines.push(`Phase 3 NOT CLOSED [${d.closeDecisionId}]`);
    lines.push("Phase 3 is NOT ready for next phase");
  }

  lines.push(`Matrix: ${d.differenceMatrixStatus} | Gate: ${d.acceptanceGateStatus} | Final: ${d.finalAcceptanceStatus} | Checklist: ${d.finalChecklistStatus}`);
  lines.push(`Artifacts: ${d.artifactsVerified.length} verified, ${d.missingArtifacts.length} missing`);

  if (d.blockingIssues.length > 0) {
    lines.push(`Blocking: ${d.blockingIssues.join("; ")}`);
  }
  if (d.nonBlockingNotices.length > 0) {
    lines.push(`Notices: ${d.nonBlockingNotices.join("; ")}`);
  }

  return lines.join("\n");
};
