import { describe, expect, it } from "vitest";
import {
  validateRollbackPlan, validateRunbookSkeleton,
  runPhase7DifferenceMatrixDraft, PHASE7_MATRIX_DRAFT_SCENARIOS
} from "./phase7-rollback-runbook.js";
import type { RollbackPlanSkeleton, ReleaseRunbookSkeleton } from "./phase7-rollback-runbook.js";

const validPlan = (): RollbackPlanSkeleton => ({
  rollbackPlanId: "rp-t", targetConfigVersion: "2.0.0", rollbackTargetVersion: "1.0.0",
  rollbackPrerequisites: ["prev available"],
  rollbackSteps: [{ stepId: "s1", action: "rollback", target: "1.0.0", expectedOutcome: "ok", isBlocking: true }],
  rollbackVerificationChecks: ["smoke test"],
  requiresManualApproval: false, summary: "test"
});

const validRunbook = (): ReleaseRunbookSkeleton => ({
  runbookId: "rb-t", runbookVersion: "1.0.0", releaseScope: "test",
  entryConditions: ["preflight passed"], operationalChecks: ["verify"],
  rollbackEntryPoint: "Execute rp-t", incidentEscalationRules: ["Page on-call"],
  summary: "test"
});

// ─── rollback plan validation ───────────────────────────────────────────────

describe("RollbackPlan: validation", () => {
  it("valid plan passes", () => {
    const r = validateRollbackPlan(validPlan());
    expect(r.valid).toBe(true);
    expect(r.issues.length).toBe(0);
  });

  it("fails when target version empty", () => {
    const r = validateRollbackPlan({ ...validPlan(), targetConfigVersion: "" });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("targetConfigVersion"))).toBe(true);
  });

  it("fails when rollback target same as target", () => {
    const r = validateRollbackPlan({ ...validPlan(), rollbackTargetVersion: "2.0.0" });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("differ"))).toBe(true);
  });

  it("fails when steps empty", () => {
    const r = validateRollbackPlan({ ...validPlan(), rollbackSteps: [] });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("rollbackSteps"))).toBe(true);
  });

  it("fails when verification checks empty", () => {
    const r = validateRollbackPlan({ ...validPlan(), rollbackVerificationChecks: [] });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("rollbackVerificationChecks"))).toBe(true);
  });
});

// ─── runbook skeleton validation ────────────────────────────────────────────

describe("RunbookSkeleton: validation", () => {
  it("valid runbook passes", () => {
    const r = validateRunbookSkeleton(validRunbook());
    expect(r.valid).toBe(true);
    expect(r.issues.length).toBe(0);
  });

  it("fails when rollback entry point empty", () => {
    const r = validateRunbookSkeleton({ ...validRunbook(), rollbackEntryPoint: "" });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("rollbackEntryPoint"))).toBe(true);
  });

  it("fails when escalation rules empty", () => {
    const r = validateRunbookSkeleton({ ...validRunbook(), incidentEscalationRules: [] });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => i.includes("incidentEscalationRules"))).toBe(true);
  });

  it("fails when entry conditions empty", () => {
    const r = validateRunbookSkeleton({ ...validRunbook(), entryConditions: [] });
    expect(r.valid).toBe(false);
  });

  it("fails when operational checks empty", () => {
    const r = validateRunbookSkeleton({ ...validRunbook(), operationalChecks: [] });
    expect(r.valid).toBe(false);
  });
});

// ─── difference matrix draft ────────────────────────────────────────────────

describe("Phase7 DifferenceMatrixDraft: full run", () => {
  const draft = runPhase7DifferenceMatrixDraft("p7-draft");

  it("has at least 7 scenarios", () => {
    expect(draft.totalScenarios).toBeGreaterThanOrEqual(7);
  });

  it("all scenarios matched", () => {
    expect(draft.matchedScenarios).toBe(draft.totalScenarios);
    expect(draft.mismatchedScenarios).toBe(0);
  });

  it("overallStatus is passed", () => {
    expect(draft.overallStatus).toBe("passed");
  });

  it("summary is human-readable", () => {
    expect(draft.summary).toContain("matched");
    expect(draft.summary).toContain("passed");
  });

  it("G1 clean path matches", () => {
    const g1 = draft.reports.find(r => r.scenarioId === "G1")!;
    expect(g1.matched).toBe(true);
    expect(g1.matchedFields).toContain("preflightStatus");
    expect(g1.matchedFields).toContain("rollbackValid");
    expect(g1.matchedFields).toContain("runbookReady");
  });

  it("G3 blocked rollback matches baseline expectation", () => {
    const g3 = draft.reports.find(r => r.scenarioId === "G3")!;
    expect(g3.matched).toBe(true);
  });

  it("G5 blocked runbook matches baseline expectation", () => {
    const g5 = draft.reports.find(r => r.scenarioId === "G5")!;
    expect(g5.matched).toBe(true);
  });

  it("G6 blocked contract matches baseline expectation", () => {
    const g6 = draft.reports.find(r => r.scenarioId === "G6")!;
    expect(g6.matched).toBe(true);
  });

  it("G7 fully blocked matches baseline expectation", () => {
    const g7 = draft.reports.find(r => r.scenarioId === "G7")!;
    expect(g7.matched).toBe(true);
  });
});

describe("Phase7 scenarios: completeness", () => {
  it("covers G1-G7", () => {
    expect(PHASE7_MATRIX_DRAFT_SCENARIOS.map(s => s.scenarioId)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7"]);
  });
});

// ─── Step 1 compatibility ───────────────────────────────────────────────────

describe("Phase7 Step 2: Step 1 preflight compatibility", () => {
  it("G1 scenario uses real preflight runner without breaking Step 1 semantics", () => {
    const draft = runPhase7DifferenceMatrixDraft("compat");
    const g1 = draft.reports.find(r => r.scenarioId === "G1")!;
    expect(g1.matchedFields).toContain("preflightStatus");
  });
});
