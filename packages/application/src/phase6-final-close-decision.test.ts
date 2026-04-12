import { describe, expect, it } from "vitest";
import type { Phase6AcceptanceInputSnapshot } from "./phase6-difference-matrix.js";
import { runPhase6DifferenceMatrix, PHASE6_BASELINE_CORE_FIELDS } from "./phase6-difference-matrix.js";
import { runPhase6AcceptanceGate } from "./phase6-acceptance-gate.js";
import { assemblePhase6FinalAcceptance, validatePhase6FinalAcceptanceConsistency } from "./phase6-final-acceptance.js";
import {
  assemblePhase6FinalCloseDecision, PHASE6_FINAL_REQUIRED_ARTIFACTS,
  runPhase6FinalCloseDecision, validatePhase6FinalCloseDecisionConsistency, verifyPhase6Artifacts
} from "./phase6-final-close-decision.js";

const FREEZE_TIME = "2026-03-25T00:00:00.000Z";
const buildPassInput = (): Phase6AcceptanceInputSnapshot => ({
  baselineCoreFields: [...PHASE6_BASELINE_CORE_FIELDS], observabilityScenarioIds: ["T1", "T2", "T3", "T4", "T5"],
  faultDrillScenarioIds: ["F1", "F2", "F3", "F4", "F5"], differenceMatrixOverallStatus: "passed",
  keyDriftFindings: [], blockingIssues: [], nonBlockingNotices: [], recommendedNextActions: []
});

describe("Phase6 Close Decision: phase6_closed", () => {
  it("full pipeline produces phase6_closed", () => {
    const d = runPhase6FinalCloseDecision("cd-closed", FREEZE_TIME);
    expect(d.decision).toBe("phase6_closed");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.phase).toBe("phase6");
    expect(d.blockingIssues.length).toBe(0);
    expect(d.missingArtifacts.length).toBe(0);
    expect(d.freezeConfirmedAt).toBe(FREEZE_TIME);
    expect(d.differenceMatrixStatus).toBe("passed");
    expect(d.acceptanceGateStatus).toBe("pass");
    expect(d.finalAcceptanceStatus).toBe("ready_to_close_preparation");
    expect(d.finalChecklistStatus).toBe("all_passed");
  });
});

describe("Phase6 Close Decision: phase6_closed_with_notices", () => {
  it("produces closed_with_notices when notices present", () => {
    const { matrix } = runPhase6DifferenceMatrix("cd-notice-mx");
    const noticeInput: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["T3: avgDurationMs drifted"] };
    const gate = runPhase6AcceptanceGate("cd-notice-gate", noticeInput);
    const fa = assemblePhase6FinalAcceptance("cd-notice-fa", matrix, noticeInput, gate);
    const consistency = validatePhase6FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase6Artifacts();
    const d = assemblePhase6FinalCloseDecision("cd-notice", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase6_closed_with_notices");
    expect(d.readyForNextPhase).toBe(true);
    expect(d.nonBlockingNotices.length).toBeGreaterThan(0);
  });
});

describe("Phase6 Close Decision: phase6_not_closed", () => {
  it("produces not_closed when gate fails", () => {
    const { matrix } = runPhase6DifferenceMatrix("cd-fail-mx");
    const failInput: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["T1: tracePropagationStatus drifted"] };
    const gate = runPhase6AcceptanceGate("cd-fail-gate", failInput);
    const fa = assemblePhase6FinalAcceptance("cd-fail-fa", matrix, failInput, gate);
    const consistency = validatePhase6FinalAcceptanceConsistency(fa);
    const artifacts = verifyPhase6Artifacts();
    const d = assemblePhase6FinalCloseDecision("cd-fail", fa, artifacts, consistency.consistent, FREEZE_TIME);
    expect(d.decision).toBe("phase6_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.freezeConfirmedAt).toBe("");
  });

  it("produces not_closed when artifacts missing", () => {
    const fa = (() => { const { matrix, acceptanceInput } = runPhase6DifferenceMatrix("cd-miss-mx"); const gate = runPhase6AcceptanceGate("cd-miss-gate", acceptanceInput); return assemblePhase6FinalAcceptance("cd-miss-fa", matrix, acceptanceInput, gate); })();
    const fakeArtifacts = { verified: ["trace-context-propagation"], missing: ["benchmark-harness-result"] };
    const d = assemblePhase6FinalCloseDecision("cd-miss", fa, fakeArtifacts, true, FREEZE_TIME);
    expect(d.decision).toBe("phase6_not_closed");
    expect(d.readyForNextPhase).toBe(false);
    expect(d.missingArtifacts).toContain("benchmark-harness-result");
  });
});

describe("Phase6 Close Decision: artifact verification", () => {
  it("all 12 required artifacts are verified", () => {
    const { verified, missing } = verifyPhase6Artifacts();
    expect(verified.length).toBe(12);
    expect(missing.length).toBe(0);
    for (const a of PHASE6_FINAL_REQUIRED_ARTIFACTS) expect(verified).toContain(a.artifactId);
  });

  it("required artifacts list covers steps 1-6", () => {
    const steps = new Set(PHASE6_FINAL_REQUIRED_ARTIFACTS.map(a => a.step));
    for (let s = 1; s <= 6; s++) expect(steps.has(s)).toBe(true);
  });
});

describe("Phase6 Close Decision: consistency", () => {
  it("closed path is consistent", () => {
    const d = runPhase6FinalCloseDecision("cd-con-closed", FREEZE_TIME);
    const c = validatePhase6FinalCloseDecisionConsistency(d);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(6);
  });

  it("notice path is consistent", () => {
    const { matrix } = runPhase6DifferenceMatrix("cd-con-n-mx");
    const noticeInput: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "passed_with_notice", nonBlockingNotices: ["T3: avgDurationMs drifted"] };
    const gate = runPhase6AcceptanceGate("cd-con-n-gate", noticeInput);
    const fa = assemblePhase6FinalAcceptance("cd-con-n-fa", matrix, noticeInput, gate);
    const artifacts = verifyPhase6Artifacts();
    const d = assemblePhase6FinalCloseDecision("cd-con-n", fa, artifacts, true, FREEZE_TIME);
    expect(validatePhase6FinalCloseDecisionConsistency(d).consistent).toBe(true);
  });

  it("not_closed path is consistent", () => {
    const { matrix } = runPhase6DifferenceMatrix("cd-con-f-mx");
    const failInput: Phase6AcceptanceInputSnapshot = { ...buildPassInput(), differenceMatrixOverallStatus: "failed", blockingIssues: ["T1: tracePropagationStatus drifted"] };
    const gate = runPhase6AcceptanceGate("cd-con-f-gate", failInput);
    const fa = assemblePhase6FinalAcceptance("cd-con-f-fa", matrix, failInput, gate);
    const artifacts = verifyPhase6Artifacts();
    const d = assemblePhase6FinalCloseDecision("cd-con-f", fa, artifacts, true, FREEZE_TIME);
    expect(validatePhase6FinalCloseDecisionConsistency(d).consistent).toBe(true);
  });
});

describe("Phase6 Close Decision: summary", () => {
  it("closed summary is human-readable", () => {
    const d = runPhase6FinalCloseDecision("cd-sum", FREEZE_TIME);
    expect(d.decisionSummary).toContain("CLOSED");
    expect(d.decisionSummary).toContain("frozen");
    expect(d.decisionSummary).toContain("next phase");
  });
});
