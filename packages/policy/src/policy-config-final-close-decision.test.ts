import { describe, expect, it } from "vitest";
import type { Phase3AcceptanceInputSnapshot } from "./policy-config-difference-matrix.js";
import { buildPhase3AcceptanceInputSnapshot, runPhase3PolicyConfigDifferenceMatrix } from "./policy-config-difference-matrix.js";
import { runPhase3AcceptanceGate } from "./policy-config-acceptance-gate.js";
import { assemblePhase3FinalAcceptance, validatePhase3FinalAcceptanceConsistency } from "./policy-config-final-acceptance.js";
import {
  assemblePhase3FinalCloseDecision,
  PHASE3_FINAL_REQUIRED_ARTIFACTS,
  runPhase3FinalCloseDecision,
  validatePhase3FinalCloseDecisionConsistency,
  verifyPhase3Artifacts
} from "./policy-config-final-close-decision.js";

const FREEZE_TIME = "2026-03-25T00:00:00.000Z";

// ─── closed path ────────────────────────────────────────────────────────────

describe("Close Decision: phase3_closed", () => {
  it("full pipeline produces phase3_closed", () => {
    const d = runPhase3FinalCloseDecision("cd-closed", FREEZE_TIME);
    expect(d.decision).toBe("phase3_closed");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.phase).toBe("phase3");
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

describe("Close Decision: phase3_closed_with_notices", () => {
  it("produces closed_with_notices when notices present", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("cd-notice-mx");
    const noticeInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: policySelectionSummary drifted"]
    };
    const gate = runPhase3AcceptanceGate("cd-notice-gate", noticeInput);
    const fa = assemblePhase3FinalAcceptance("cd-notice-fa", matrix, noticeInput, gate);
    const consistency = validatePhase3FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase3Artifacts();
    const d = assemblePhase3FinalCloseDecision("cd-notice", fa, consistency, artifacts, FREEZE_TIME);
    expect(d.decision).toBe("phase3_closed_with_notices");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.nonBlockingNotices.length).toBeGreaterThan(0);
    expect(d.blockingIssues.length).toBe(0);
    expect(d.freezeConfirmedAt).toBe(FREEZE_TIME);
  });
});

// ─── not_closed path ────────────────────────────────────────────────────────

describe("Close Decision: phase3_not_closed", () => {
  it("produces not_closed when gate fails", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("cd-fail-mx");
    const failInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["C2: activationStatus drifted"]
    };
    const gate = runPhase3AcceptanceGate("cd-fail-gate", failInput);
    const fa = assemblePhase3FinalAcceptance("cd-fail-fa", matrix, failInput, gate);
    const consistency = validatePhase3FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase3Artifacts();
    const d = assemblePhase3FinalCloseDecision("cd-fail", fa, consistency, artifacts, FREEZE_TIME);
    expect(d.decision).toBe("phase3_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.blockingIssues.length).toBeGreaterThan(0);
    expect(d.freezeConfirmedAt).toBe("");
  });

  it("produces not_closed when artifacts missing", () => {
    const fa = assemblePhase3FinalAcceptance(
      "cd-miss-fa",
      ...(() => {
        const { matrix, acceptanceInput } = runPhase3PolicyConfigDifferenceMatrix("cd-miss-mx");
        const gate = runPhase3AcceptanceGate("cd-miss-gate", acceptanceInput);
        return [matrix, acceptanceInput, gate] as const;
      })()
    );
    const consistency = validatePhase3FinalAcceptanceConsistency(fa);
    const fakeArtifacts = { verified: ["policy-contracts"], missing: ["real-strategies-v1"] };
    const d = assemblePhase3FinalCloseDecision("cd-miss", fa, consistency, fakeArtifacts, FREEZE_TIME);
    expect(d.decision).toBe("phase3_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.missingArtifacts).toContain("real-strategies-v1");
  });
});

// ─── artifact verification ──────────────────────────────────────────────────

describe("Close Decision: artifact verification", () => {
  it("all 12 required artifacts are verified", () => {
    const { verified, missing } = verifyPhase3Artifacts();
    expect(verified.length).toBe(12);
    expect(missing.length).toBe(0);
    for (const a of PHASE3_FINAL_REQUIRED_ARTIFACTS) {
      expect(verified).toContain(a.artifactId);
    }
  });

  it("required artifacts list covers steps 1-10", () => {
    const steps = new Set(PHASE3_FINAL_REQUIRED_ARTIFACTS.map(a => a.step));
    for (let s = 1; s <= 10; s++) {
      expect(steps.has(s)).toBe(true);
    }
  });
});

// ─── consistency validation ─────────────────────────────────────────────────

describe("Close Decision: consistency", () => {
  it("closed path is consistent", () => {
    const d = runPhase3FinalCloseDecision("cd-con-closed", FREEZE_TIME);
    const c = validatePhase3FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(6);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("cd-con-n-mx");
    const noticeInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "passed_with_notice",
      nonBlockingNotices: ["S1: policySelectionSummary drifted"]
    };
    const gate = runPhase3AcceptanceGate("cd-con-n-gate", noticeInput);
    const fa = assemblePhase3FinalAcceptance("cd-con-n-fa", matrix, noticeInput, gate);
    const consistency = validatePhase3FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase3Artifacts();
    const d = assemblePhase3FinalCloseDecision("cd-con-n", fa, consistency, artifacts, FREEZE_TIME);
    const c = validatePhase3FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });

  it("not_closed path is consistent", () => {
    const { matrix } = runPhase3PolicyConfigDifferenceMatrix("cd-con-f-mx");
    const failInput: Phase3AcceptanceInputSnapshot = {
      ...buildPhase3AcceptanceInputSnapshot(matrix),
      differenceMatrixOverallStatus: "failed",
      blockingIssues: ["C2: activationStatus drifted"]
    };
    const gate = runPhase3AcceptanceGate("cd-con-f-gate", failInput);
    const fa = assemblePhase3FinalAcceptance("cd-con-f-fa", matrix, failInput, gate);
    const consistency = validatePhase3FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase3Artifacts();
    const d = assemblePhase3FinalCloseDecision("cd-con-f", fa, consistency, artifacts, FREEZE_TIME);
    const c = validatePhase3FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
  });
});

// ─── summary ────────────────────────────────────────────────────────────────

describe("Close Decision: summary", () => {
  it("closed summary is human-readable", () => {
    const d = runPhase3FinalCloseDecision("cd-sum", FREEZE_TIME);
    expect(d.decisionSummary).toContain("CLOSED");
    expect(d.decisionSummary).toContain("frozen");
    expect(d.decisionSummary).toContain("next phase");
  });
});
