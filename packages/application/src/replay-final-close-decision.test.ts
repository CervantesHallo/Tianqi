import { describe, expect, it } from "vitest";
import type { Phase5ReplayAcceptanceInputSnapshot } from "./replay-difference-matrix.js";
import { runPhase5ReplayDifferenceMatrix, PHASE5_REPLAY_BASELINE_CORE_FIELDS } from "./replay-difference-matrix.js";
import { runPhase5ReplayAcceptanceGate } from "./replay-acceptance-gate.js";
import { assemblePhase5ReplayFinalAcceptance, validatePhase5ReplayFinalAcceptanceConsistency } from "./replay-final-acceptance.js";
import {
  assemblePhase5ReplayFinalCloseDecision,
  PHASE5_FINAL_REQUIRED_ARTIFACTS,
  runPhase5ReplayFinalCloseDecision,
  validatePhase5ReplayFinalCloseDecisionConsistency,
  verifyPhase5ReplayArtifacts
} from "./replay-final-close-decision.js";

const FREEZE_TIME = "2026-03-25T00:00:00.000Z";

const buildPassInput = (): Phase5ReplayAcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE5_REPLAY_BASELINE_CORE_FIELDS],
  singleCaseScenarioIds: ["S1", "S2", "S3", "S4", "S5"],
  batchReplayScenarioIds: ["B1", "B2", "B3", "B4", "B5"],
  differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

// ─── closed path ────────────────────────────────────────────────────────────

describe("Phase5 Close Decision: phase5_closed", () => {
  it("full pipeline produces phase5_closed", () => {
    const d = runPhase5ReplayFinalCloseDecision("cd-closed", FREEZE_TIME);
    expect(d.decision).toBe("phase5_closed");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.phase).toBe("phase5");
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

describe("Phase5 Close Decision: phase5_closed_with_notices", () => {
  it("produces closed_with_notices when notices present", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("cd-notice-mx");
    const noticeInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: eventCount drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("cd-notice-gate", noticeInput);
    const fa = assemblePhase5ReplayFinalAcceptance("cd-notice-fa", matrix, noticeInput, gate);
    const consistency = validatePhase5ReplayFinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase5ReplayArtifacts();
    const d = assemblePhase5ReplayFinalCloseDecision("cd-notice", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase5_closed_with_notices");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(d.blockingIssues.length).toBe(0);
  });
});

// ─── not_closed path ────────────────────────────────────────────────────────

describe("Phase5 Close Decision: phase5_not_closed", () => {
  it("produces not_closed when gate fails", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("cd-fail-mx");
    const failInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["S1: reconstructionStatus drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("cd-fail-gate", failInput);
    const fa = assemblePhase5ReplayFinalAcceptance("cd-fail-fa", matrix, failInput, gate);
    const consistency = validatePhase5ReplayFinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase5ReplayArtifacts();
    const d = assemblePhase5ReplayFinalCloseDecision("cd-fail", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase5_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.freezeConfirmedAt).toBe("");
  });

  it("produces not_closed when artifacts missing", () => {
    const fa = (() => {
      const { matrix, acceptanceInput } = runPhase5ReplayDifferenceMatrix("cd-miss-mx");
      const gate = runPhase5ReplayAcceptanceGate("cd-miss-gate", acceptanceInput);
      return assemblePhase5ReplayFinalAcceptance("cd-miss-fa", matrix, acceptanceInput, gate);
    })();
    const fakeArtifacts = { verified: ["event-store-boundary"], missing: ["batch-replay-skeleton"] };
    const d = assemblePhase5ReplayFinalCloseDecision("cd-miss", fa, fakeArtifacts, true, FREEZE_TIME);
    expect(d.decision).toBe("phase5_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.missingArtifacts).toContain("batch-replay-skeleton");
  });
});

// ─── artifact verification ──────────────────────────────────────────────────

describe("Phase5 Close Decision: artifact verification", () => {
  it("all 11 required artifacts are verified", () => {
    const { verified, missing } = verifyPhase5ReplayArtifacts();
    expect(verified.length).toBe(11);
    expect(missing.length).toBe(0);
    for (const a of PHASE5_FINAL_REQUIRED_ARTIFACTS) {
      expect(verified).toContain(a.artifactId);
    }
  });

  it("required artifacts list covers steps 1-6", () => {
    const steps = new Set(PHASE5_FINAL_REQUIRED_ARTIFACTS.map(a => a.step));
    for (let s = 1; s <= 6; s++) {
      expect(steps.has(s)).toBe(true);
    }
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Phase5 Close Decision: consistency", () => {
  it("closed path is consistent", () => {
    const d = runPhase5ReplayFinalCloseDecision("cd-con-closed", FREEZE_TIME);
    const c = validatePhase5ReplayFinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(6);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("cd-con-n-mx");
    const noticeInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: eventCount drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("cd-con-n-gate", noticeInput);
    const fa = assemblePhase5ReplayFinalAcceptance("cd-con-n-fa", matrix, noticeInput, gate);
    const consistency = validatePhase5ReplayFinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase5ReplayArtifacts();
    const d = assemblePhase5ReplayFinalCloseDecision("cd-con-n", fa, artifacts, consistency.consistent, FREEZE_TIME);
    const c = validatePhase5ReplayFinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });

  it("not_closed path is consistent", () => {
    const { matrix } = runPhase5ReplayDifferenceMatrix("cd-con-f-mx");
    const failInput: Phase5ReplayAcceptanceInputSnapshot = {
      ...buildPassInput(),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["S1: reconstructionStatus drifted"]
    };
    const gate = runPhase5ReplayAcceptanceGate("cd-con-f-gate", failInput);
    const fa = assemblePhase5ReplayFinalAcceptance("cd-con-f-fa", matrix, failInput, gate);
    const artifacts = verifyPhase5ReplayArtifacts();
    const d = assemblePhase5ReplayFinalCloseDecision("cd-con-f", fa, artifacts, true, FREEZE_TIME);
    const c = validatePhase5ReplayFinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary ────────────────────────────────────────────────────────────────

describe("Phase5 Close Decision: summary", () => {
  it("closed summary is human-readable", () => {
    const d = runPhase5ReplayFinalCloseDecision("cd-sum", FREEZE_TIME);
    expect(d.decisionSummary).toContain("CLOSED");
    expect(d.decisionSummary).toContain("frozen");
    expect(d.decisionSummary).toContain("next phase");
  });
});
