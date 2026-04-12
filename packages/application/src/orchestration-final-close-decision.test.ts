import { describe, expect, it } from "vitest";
import type { Phase4AcceptanceInputSnapshot } from "./orchestration-difference-matrix.js";
import { runPhase4OrchestrationDifferenceMatrix } from "./orchestration-difference-matrix.js";
import { runPhase4AcceptanceGate } from "./orchestration-acceptance-gate.js";
import { assemblePhase4FinalAcceptance, validatePhase4FinalAcceptanceConsistency } from "./orchestration-final-acceptance.js";
import { PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS } from "./orchestration-difference-report.js";
import {
  assemblePhase4FinalCloseDecision,
  PHASE4_FINAL_REQUIRED_ARTIFACTS,
  runPhase4FinalCloseDecision,
  validatePhase4FinalCloseDecisionConsistency,
  verifyPhase4Artifacts
} from "./orchestration-final-close-decision.js";

const FREEZE_TIME = "2026-03-25T00:00:00.000Z";

const buildPassInput = (): Phase4AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS],
  riskCaseScenarioIds: ["R1", "R2", "R3", "R4", "R5"],
  liquidationCaseScenarioIds: ["L1", "L2", "L3", "L4", "L5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── closed path ────────────────────────────────────────────────────────────

describe("Phase4 Close Decision: phase4_closed", () => {
  it("full pipeline produces phase4_closed", () => {
    const d = runPhase4FinalCloseDecision("cd-closed", FREEZE_TIME);
    expect(d.decision).toBe("phase4_closed");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.phase).toBe("phase4");
    expect(d.blockingIssues.length).toBe(0);
    expect(d.missingArtifacts.length).toBe(0);
    expect(d.freezeConfirmedAt).toBe(FREEZE_TIME);
    expect(d.differenceMatrixStatus).toBe("passed");
    expect(d.acceptanceGateStatus).toBe("pass");
    expect(d.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(d.finalChecklistStatus).toBe("all_passed");
  });
});

// ─── closed_with_notices path ───────────────────────────────────────────────

describe("Phase4 Close Decision: phase4_closed_with_notices", () => {
  it("produces closed_with_notices when notices present", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("cd-notice-mx");
    const noticeInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["R1: resultSummary drifted"]
    };
    const gate = runPhase4AcceptanceGate("cd-notice-gate", noticeInput);
    const fa = assemblePhase4FinalAcceptance("cd-notice-fa", matrix, noticeInput, gate);
    const consistency = validatePhase4FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase4Artifacts();
    const d = assemblePhase4FinalCloseDecision("cd-notice", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase4_closed_with_notices");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(d.blockingIssues.length).toBe(0);
  });
});

// ─── not_closed path ────────────────────────────────────────────────────────

describe("Phase4 Close Decision: phase4_not_closed", () => {
  it("produces not_closed when gate fails", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("cd-fail-mx");
    const failInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["R1: resultStatus drifted"]
    };
    const gate = runPhase4AcceptanceGate("cd-fail-gate", failInput);
    const fa = assemblePhase4FinalAcceptance("cd-fail-fa", matrix, failInput, gate);
    const consistency = validatePhase4FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase4Artifacts();
    const d = assemblePhase4FinalCloseDecision("cd-fail", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase4_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.blockingIssues.length).toBeGreaterThan(0);
    expect(d.freezeConfirmedAt).toBe("");
  });

  it("produces not_closed when artifacts missing", () => {
    const fa = (() => {
      const { matrix, acceptanceInput } = runPhase4OrchestrationDifferenceMatrix("cd-miss-mx");
      const gate = runPhase4AcceptanceGate("cd-miss-gate", acceptanceInput);
      return assemblePhase4FinalAcceptance("cd-miss-fa", matrix, acceptanceInput, gate);
    })();
    const fakeArtifacts = { verified: ["risk-case-orchestrator"], missing: ["saga-resume-skeleton"] };
    const d = assemblePhase4FinalCloseDecision("cd-miss", fa, fakeArtifacts, true, FREEZE_TIME);
    expect(d.decision).toBe("phase4_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.missingArtifacts).toContain("saga-resume-skeleton");
  });
});

// ─── artifact verification ──────────────────────────────────────────────────

describe("Phase4 Close Decision: artifact verification", () => {
  it("all 11 required artifacts are verified", () => {
    const { verified, missing } = verifyPhase4Artifacts();
    expect(verified.length).toBe(11);
    expect(missing.length).toBe(0);
    for (const a of PHASE4_FINAL_REQUIRED_ARTIFACTS) {
      expect(verified).toContain(a.artifactId);
    }
  });

  it("required artifacts list covers steps 1-7", () => {
    const steps = new Set(PHASE4_FINAL_REQUIRED_ARTIFACTS.map(a => a.step));
    for (let s = 1; s <= 7; s++) {
      expect(steps.has(s)).toBe(true);
    }
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Phase4 Close Decision: consistency", () => {
  it("closed path is consistent", () => {
    const d = runPhase4FinalCloseDecision("cd-con-closed", FREEZE_TIME);
    const c = validatePhase4FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(6);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("cd-con-n-mx");
    const noticeInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["R1: resultSummary drifted"]
    };
    const gate = runPhase4AcceptanceGate("cd-con-n-gate", noticeInput);
    const fa = assemblePhase4FinalAcceptance("cd-con-n-fa", matrix, noticeInput, gate);
    const consistency = validatePhase4FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase4Artifacts();
    const d = assemblePhase4FinalCloseDecision("cd-con-n", fa, artifacts, consistency.consistent, FREEZE_TIME);
    const c = validatePhase4FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });

  it("not_closed path is consistent", () => {
    const { matrix } = runPhase4OrchestrationDifferenceMatrix("cd-con-f-mx");
    const failInput: Phase4AcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["R1: resultStatus drifted"]
    };
    const gate = runPhase4AcceptanceGate("cd-con-f-gate", failInput);
    const fa = assemblePhase4FinalAcceptance("cd-con-f-fa", matrix, failInput, gate);
    const artifacts = verifyPhase4Artifacts();
    const d = assemblePhase4FinalCloseDecision("cd-con-f", fa, artifacts, true, FREEZE_TIME);
    const c = validatePhase4FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary ────────────────────────────────────────────────────────────────

describe("Phase4 Close Decision: summary", () => {
  it("closed summary is human-readable", () => {
    const d = runPhase4FinalCloseDecision("cd-sum", FREEZE_TIME);
    expect(d.decisionSummary).toContain("CLOSED");
    expect(d.decisionSummary).toContain("frozen");
    expect(d.decisionSummary).toContain("next phase");
  });
});
