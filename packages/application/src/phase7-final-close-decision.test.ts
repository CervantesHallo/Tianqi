import { describe, expect, it } from "vitest";
import type { Phase7AcceptanceInputSnapshot } from "./phase7-difference-matrix.js";
import { runPhase7DifferenceMatrix, PHASE7_BASELINE_CORE_FIELDS } from "./phase7-difference-matrix.js";
import { runPhase7AcceptanceGate } from "./phase7-acceptance-gate.js";
import { assemblePhase7FinalAcceptance, validatePhase7FinalAcceptanceConsistency } from "./phase7-final-acceptance.js";
import { assemblePhase7FinalCloseDecision, PHASE7_FINAL_REQUIRED_ARTIFACTS, runPhase7FinalCloseDecision, validatePhase7FinalCloseDecisionConsistency, verifyPhase7Artifacts } from "./phase7-final-close-decision.js";

const FREEZE_TIME = "2026-03-25T00:00:00.000Z";
const buildPassInput = (): Phase7AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE7_BASELINE_CORE_FIELDS], preflightScenarioIds: ["P1", "P2", "P3", "P4", "P5"],
  rollbackRunbookScenarioIds: ["R1", "R2", "R3", "R4", "R5"], differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

describe("Phase7 Close Decision: phase7_closed", () => {
  it("full pipeline produces phase7_closed", () => {
    const d = runPhase7FinalCloseDecision("cd-closed", FREEZE_TIME);
    expect(d.decision).toBe("phase7_closed");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.phase).toBe("phase7");
    expect(d.blockingIssues.length).toBe(0);
    expect(d.missingArtifacts.length).toBe(0);
    expect(d.freezeConfirmedAt).toBe(FREEZE_TIME);
    expect(d.differenceMatrixStatus).toBe("passed");
    expect(d.acceptanceGateStatus).toBe("pass");
    expect(d.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(d.finalChecklistStatus).toBe("all_passed");
  });
});

describe("Phase7 Close Decision: phase7_closed_with_notices", () => {
  it("produces closed_with_notices when notices present", () => {
    const { matrix } = runPhase7DifferenceMatrix("cd-notice-mx");
    const noticeInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: noticeCount drifted"] };
    const gate = runPhase7AcceptanceGate("cd-notice-gate", noticeInput);
    const fa = assemblePhase7FinalAcceptance("cd-notice-fa", matrix, noticeInput, gate);
    const consistency = validatePhase7FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase7Artifacts();
    const d = assemblePhase7FinalCloseDecision("cd-notice", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase7_closed_with_notices");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

describe("Phase7 Close Decision: phase7_not_closed", () => {
  it("produces not_closed when gate fails", () => {
    const { matrix } = runPhase7DifferenceMatrix("cd-fail-mx");
    const failInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["P3: preflightStatus drifted"] };
    const gate = runPhase7AcceptanceGate("cd-fail-gate", failInput);
    const fa = assemblePhase7FinalAcceptance("cd-fail-fa", matrix, failInput, gate);
    const consistency = validatePhase7FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase7Artifacts();
    const d = assemblePhase7FinalCloseDecision("cd-fail", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase7_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.freezeConfirmedAt).toBe("");
  });

  it("produces not_closed when artifacts missing", () => {
    const fa = (() => { const { matrix, acceptanceInput } = runPhase7DifferenceMatrix("cd-miss-mx"); const gate = runPhase7AcceptanceGate("cd-miss-gate", acceptanceInput); return assemblePhase7FinalAcceptance("cd-miss-fa", matrix, acceptanceInput, gate); })();
    const fakeArtifacts = { verified: ["publish-preflight-runner"], missing: ["rollback-plan-skeleton"] };
    const d = assemblePhase7FinalCloseDecision("cd-miss", fa, fakeArtifacts, true, FREEZE_TIME);
    expect(d.decision).toBe("phase7_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.missingArtifacts).toContain("rollback-plan-skeleton");
  });
});

describe("Phase7 Close Decision: artifact verification", () => {
  it("all 11 required artifacts are verified", () => {
    const { verified, missing } = verifyPhase7Artifacts();
    expect(verified.length).toBe(11);
    expect(missing.length).toBe(0);
    for (const a of PHASE7_FINAL_REQUIRED_ARTIFACTS) expect(verified).toContain(a.artifactId);
  });

  it("required artifacts list covers steps 1-6", () => {
    const steps = new Set(PHASE7_FINAL_REQUIRED_ARTIFACTS.map(a => a.step));
    for (let s = 1; s <= 6; s++) expect(steps.has(s)).toBe(true);
  });
});

describe("Phase7 Close Decision: consistency", () => {
  it("closed path is consistent", () => {
    const d = runPhase7FinalCloseDecision("cd-con-closed", FREEZE_TIME);
    const c = validatePhase7FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(6);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase7DifferenceMatrix("cd-con-n-mx");
    const noticeInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["R2: noticeCount drifted"] };
    const gate = runPhase7AcceptanceGate("cd-con-n-gate", noticeInput);
    const fa = assemblePhase7FinalAcceptance("cd-con-n-fa", matrix, noticeInput, gate);
    const artifacts = verifyPhase7Artifacts();
    const d = assemblePhase7FinalCloseDecision("cd-con-n", fa, artifacts, true, FREEZE_TIME);
    expect(validatePhase7FinalCloseDecisionConsistency(d).consistent).toBe(true);
  });

  it("not_closed path is consistent", () => {
    const { matrix } = runPhase7DifferenceMatrix("cd-con-f-mx");
    const failInput: Phase7AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["P3: preflightStatus drifted"] };
    const gate = runPhase7AcceptanceGate("cd-con-f-gate", failInput);
    const fa = assemblePhase7FinalAcceptance("cd-con-f-fa", matrix, failInput, gate);
    const artifacts = verifyPhase7Artifacts();
    const d = assemblePhase7FinalCloseDecision("cd-con-f", fa, artifacts, true, FREEZE_TIME);
    expect(validatePhase7FinalCloseDecisionConsistency(d).consistent).toBe(true);
  });
});

describe("Phase7 Close Decision: summary", () => {
  it("closed summary is human-readable", () => {
    const d = runPhase7FinalCloseDecision("cd-sum", FREEZE_TIME);
    expect(d.decisionSummary).toContain("CLOSED");
    expect(d.decisionSummary).toContain("frozen");
    expect(d.decisionSummary).toContain("next phase");
  });
});
