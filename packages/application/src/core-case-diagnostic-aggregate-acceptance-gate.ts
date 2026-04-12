import type { Phase2AcceptanceInputSnapshot } from "./core-case-diagnostic-aggregate-difference-matrix.js";

export type Phase2AcceptanceGateStatus = "pass" | "pass_with_notice" | "fail";

export type Phase2AcceptanceRecommendedDecision =
  | "ready_for_phase2_close"
  | "ready_with_notices"
  | "not_ready_for_phase2_close";

export type Phase2AcceptanceGateCheckId =
  | "baseline_core_fields_stable"
  | "failure_semantics_frozen"
  | "scenario_matrix_covered"
  | "failure_combination_matrix_covered"
  | "cross_command_consistency_passed"
  | "cross_session_consistency_passed"
  | "no_blocking_core_field_drift"
  | "no_blocking_failure_semantic_mismatch";

export type Phase2AcceptanceGateCheckStatus = "pass" | "warning" | "fail";

export type Phase2AcceptanceGateChecklistItem = {
  readonly checkId: Phase2AcceptanceGateCheckId;
  readonly status: Phase2AcceptanceGateCheckStatus;
  readonly reason: string;
  readonly blocking: boolean;
  readonly relatedArtifacts: readonly string[];
};

export type Phase2AcceptanceGateResult = {
  readonly gateId: string;
  readonly gateStatus: Phase2AcceptanceGateStatus;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
  readonly checkResults: readonly Phase2AcceptanceGateChecklistItem[];
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly gateSummary: string;
  readonly recommendedDecision: Phase2AcceptanceRecommendedDecision;
};

export const PHASE2_ACCEPTANCE_GATE_CHECK_IDS: readonly Phase2AcceptanceGateCheckId[] = [
  "baseline_core_fields_stable",
  "failure_semantics_frozen",
  "scenario_matrix_covered",
  "failure_combination_matrix_covered",
  "cross_command_consistency_passed",
  "cross_session_consistency_passed",
  "no_blocking_core_field_drift",
  "no_blocking_failure_semantic_mismatch"
] as const;

const EXPECTED_SCENARIO_COUNT = 12;
const EXPECTED_FAILURE_COMBINATION_COUNT = 3;

export const PHASE2_NOTICE_ESCALATION_THRESHOLD = 3;

const evaluateCheck = (
  checkId: Phase2AcceptanceGateCheckId,
  snapshot: Phase2AcceptanceInputSnapshot
): Phase2AcceptanceGateChecklistItem => {
  switch (checkId) {
    case "baseline_core_fields_stable": {
      const blockingDrifts = snapshot.keyDriftFindings.filter((f) => f.blocking);
      const nonBlockingDrifts = snapshot.keyDriftFindings.filter((f) => !f.blocking);
      if (blockingDrifts.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${blockingDrifts.length} blocking core field drift(s) detected`,
          relatedArtifacts: blockingDrifts.map((d) => `${d.sourceId}:${d.field}`)
        };
      }
      if (nonBlockingDrifts.length > 0) {
        return {
          checkId,
          status: "warning",
          blocking: false,
          reason: `${nonBlockingDrifts.length} non-blocking core field drift(s)`,
          relatedArtifacts: nonBlockingDrifts.map((d) => `${d.sourceId}:${d.field}`)
        };
      }
      return { checkId, status: "pass", blocking: false, reason: "All core fields stable", relatedArtifacts: [] };
    }
    case "failure_semantics_frozen": {
      const mismatches = snapshot.blockingIssues.filter((s) => s.toLowerCase().includes("failure semantic"));
      if (mismatches.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${mismatches.length} failure semantic mismatch(es)`,
          relatedArtifacts: mismatches
        };
      }
      return { checkId, status: "pass", blocking: false, reason: "All failure semantics frozen", relatedArtifacts: [] };
    }
    case "scenario_matrix_covered": {
      if (snapshot.scenarioMatrixIds.length >= EXPECTED_SCENARIO_COUNT) {
        return {
          checkId,
          status: "pass",
          blocking: false,
          reason: `${snapshot.scenarioMatrixIds.length} scenarios covered`,
          relatedArtifacts: [...snapshot.scenarioMatrixIds]
        };
      }
      return {
        checkId,
        status: "fail",
        blocking: true,
        reason: `Only ${snapshot.scenarioMatrixIds.length}/${EXPECTED_SCENARIO_COUNT} scenarios covered`,
        relatedArtifacts: [...snapshot.scenarioMatrixIds]
      };
    }
    case "failure_combination_matrix_covered": {
      if (snapshot.failureCombinationIds.length >= EXPECTED_FAILURE_COMBINATION_COUNT) {
        return {
          checkId,
          status: "pass",
          blocking: false,
          reason: `${snapshot.failureCombinationIds.length} combinations covered`,
          relatedArtifacts: [...snapshot.failureCombinationIds]
        };
      }
      return {
        checkId,
        status: "fail",
        blocking: true,
        reason: `Only ${snapshot.failureCombinationIds.length}/${EXPECTED_FAILURE_COMBINATION_COUNT} combinations covered`,
        relatedArtifacts: [...snapshot.failureCombinationIds]
      };
    }
    case "cross_command_consistency_passed": {
      const commandDrifts = snapshot.keyDriftFindings.filter(
        (f) =>
          f.blocking &&
          (f.field === "requiresAttention" || f.field === "requiresRepairAction" || f.field === "requiresManualReview")
      );
      if (commandDrifts.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${commandDrifts.length} command-path consistency drift(s)`,
          relatedArtifacts: commandDrifts.map((d) => `${d.sourceId}:${d.field}`)
        };
      }
      return {
        checkId,
        status: "pass",
        blocking: false,
        reason: "Cross-command consistency passed",
        relatedArtifacts: []
      };
    }
    case "cross_session_consistency_passed": {
      const sessionDrifts = snapshot.keyDriftFindings.filter(
        (f) => f.blocking && f.field === "isCrossSessionConsistent"
      );
      if (sessionDrifts.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${sessionDrifts.length} cross-session consistency drift(s)`,
          relatedArtifacts: sessionDrifts.map((d) => `${d.sourceId}:${d.field}`)
        };
      }
      return {
        checkId,
        status: "pass",
        blocking: false,
        reason: "Cross-session consistency passed",
        relatedArtifacts: []
      };
    }
    case "no_blocking_core_field_drift": {
      const blockingDrifts = snapshot.keyDriftFindings.filter((f) => f.blocking);
      if (blockingDrifts.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${blockingDrifts.length} blocking core field drift(s)`,
          relatedArtifacts: blockingDrifts.map((d) => `${d.sourceId}:${d.field}`)
        };
      }
      return {
        checkId,
        status: "pass",
        blocking: false,
        reason: "No blocking core field drift",
        relatedArtifacts: []
      };
    }
    case "no_blocking_failure_semantic_mismatch": {
      const mismatches = snapshot.blockingIssues.filter((s) => s.toLowerCase().includes("failure semantic"));
      if (mismatches.length > 0) {
        return {
          checkId,
          status: "fail",
          blocking: true,
          reason: `${mismatches.length} failure semantic mismatch(es)`,
          relatedArtifacts: mismatches
        };
      }
      return {
        checkId,
        status: "pass",
        blocking: false,
        reason: "No failure semantic mismatch",
        relatedArtifacts: []
      };
    }
  }
};

const evaluateAllChecks = (
  snapshot: Phase2AcceptanceInputSnapshot
): readonly Phase2AcceptanceGateChecklistItem[] =>
  PHASE2_ACCEPTANCE_GATE_CHECK_IDS.map((checkId) => evaluateCheck(checkId, snapshot));

const computeGateStatus = (
  checks: readonly Phase2AcceptanceGateChecklistItem[]
): Phase2AcceptanceGateStatus => {
  if (checks.some((c) => c.status === "fail")) return "fail";
  if (checks.some((c) => c.status === "warning")) return "pass_with_notice";
  return "pass";
};

const mapGateStatusToDecision = (
  status: Phase2AcceptanceGateStatus
): Phase2AcceptanceRecommendedDecision => {
  switch (status) {
    case "pass":
      return "ready_for_phase2_close";
    case "pass_with_notice":
      return "ready_with_notices";
    case "fail":
      return "not_ready_for_phase2_close";
  }
};

export const buildPhase2AcceptanceGateSummary = (input: {
  readonly gateStatus: Phase2AcceptanceGateStatus;
  readonly passedChecks: number;
  readonly failedChecks: number;
  readonly warningChecks: number;
  readonly blockingIssues: readonly string[];
  readonly nonBlockingNotices: readonly string[];
}): string => {
  const total = input.passedChecks + input.failedChecks + input.warningChecks;

  if (input.gateStatus === "pass") {
    return `Phase 2 Acceptance Gate: PASS. All ${total} checks passed. Ready for Phase 2 close.`;
  }
  if (input.gateStatus === "pass_with_notice") {
    return (
      `Phase 2 Acceptance Gate: PASS WITH NOTICE. ${input.passedChecks}/${total} passed, ${input.warningChecks} warning(s). ` +
      `Non-blocking: ${input.nonBlockingNotices.join("; ")}. Review before closing.`
    );
  }
  return (
    `Phase 2 Acceptance Gate: FAIL. ${input.failedChecks}/${total} check(s) failed. ` +
    `Blocking: ${input.blockingIssues.join("; ")}. Must resolve before Phase 2 close.`
  );
};

export const runPhase2AcceptanceGate = (input: {
  readonly gateId: string;
  readonly snapshot: Phase2AcceptanceInputSnapshot;
}): Phase2AcceptanceGateResult => {
  const checks = evaluateAllChecks(input.snapshot);

  const passedChecks = checks.filter((c) => c.status === "pass").length;
  const failedChecks = checks.filter((c) => c.status === "fail").length;
  const warningChecks = checks.filter((c) => c.status === "warning").length;

  const blockingIssues: string[] = [];
  const nonBlockingNotices: string[] = [];
  for (const check of checks) {
    if (check.status === "fail") {
      blockingIssues.push(`${check.checkId}: ${check.reason}`);
    } else if (check.status === "warning") {
      nonBlockingNotices.push(`${check.checkId}: ${check.reason}`);
    }
  }

  let gateStatus = computeGateStatus(checks);

  const nonBlockingDriftCount = input.snapshot.keyDriftFindings.filter((f) => !f.blocking).length;
  if (gateStatus === "pass_with_notice" && nonBlockingDriftCount >= PHASE2_NOTICE_ESCALATION_THRESHOLD) {
    gateStatus = "fail";
    blockingIssues.push(
      `notice_escalation: ${nonBlockingDriftCount} non-blocking drifts exceed threshold (${PHASE2_NOTICE_ESCALATION_THRESHOLD}), escalated to fail`
    );
  }

  const recommendedDecision = mapGateStatusToDecision(gateStatus);
  const gateSummary = buildPhase2AcceptanceGateSummary({
    gateStatus,
    passedChecks,
    failedChecks,
    warningChecks,
    blockingIssues,
    nonBlockingNotices
  });

  return {
    gateId: input.gateId,
    gateStatus,
    blockingIssues,
    nonBlockingNotices,
    checkResults: checks,
    passedChecks,
    failedChecks,
    warningChecks,
    gateSummary,
    recommendedDecision
  };
};
