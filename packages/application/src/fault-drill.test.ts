import { describe, expect, it } from "vitest";
import {
  PHASE6_ORCHESTRATION_FAULT_SCENARIOS,
  PHASE6_REPLAY_FAULT_SCENARIOS,
  runPhase6FaultDrill,
  validateFaultDrillConsistency
} from "./fault-drill.js";

// ─── scenario completeness ──────────────────────────────────────────────────

describe("Phase6 Fault Drill: scenario definitions", () => {
  it("has 4 orchestration fault scenarios", () => {
    expect(PHASE6_ORCHESTRATION_FAULT_SCENARIOS).toHaveLength(4);
    expect(PHASE6_ORCHESTRATION_FAULT_SCENARIOS.map(s => s.faultId)).toEqual(["O-F1", "O-F2", "O-F3", "O-F4"]);
  });

  it("has 4 replay fault scenarios", () => {
    expect(PHASE6_REPLAY_FAULT_SCENARIOS).toHaveLength(4);
    expect(PHASE6_REPLAY_FAULT_SCENARIOS.map(s => s.faultId)).toEqual(["R-F1", "R-F2", "R-F3", "R-F4"]);
  });

  it("covers all 4 fault types", () => {
    const all = [...PHASE6_ORCHESTRATION_FAULT_SCENARIOS, ...PHASE6_REPLAY_FAULT_SCENARIOS];
    const types = new Set(all.map(s => s.faultType));
    expect(types.has("timeout")).toBe(true);
    expect(types.has("duplicate_message")).toBe(true);
    expect(types.has("out_of_order_message")).toBe(true);
    expect(types.has("partial_write_success")).toBe(true);
  });
});

// ─── full drill run ─────────────────────────────────────────────────────────

describe("Phase6 Fault Drill: full run", () => {
  const { results } = runPhase6FaultDrill("p6-drill");

  it("produces 8 drill results", () => {
    expect(results).toHaveLength(8);
  });

  it("no failed_unexpectedly results", () => {
    for (const r of results) {
      expect(r.drillStatus).not.toBe("failed_unexpectedly");
    }
  });

  it("O-F1 timeout handled as expected", () => {
    const r = results.find(r => r.scenarioId === "O-F1")!;
    expect(r.drillStatus).toBe("handled_as_expected");
    expect(r.targetPath).toBe("orchestration");
    expect(r.faultType).toBe("timeout");
  });

  it("O-F2 duplicate handled via idempotency", () => {
    const r = results.find(r => r.scenarioId === "O-F2")!;
    expect(r.drillStatus).toBe("handled_as_expected");
    expect(r.observedOutcome).toContain("replayed_same_result");
  });

  it("O-F3 partial audit degraded but continued", () => {
    const r = results.find(r => r.scenarioId === "O-F3")!;
    expect(r.drillStatus).toBe("degraded_but_continued");
  });

  it("O-F4 compensation path handled under fault", () => {
    const r = results.find(r => r.scenarioId === "O-F4")!;
    expect(r.drillStatus).toBe("handled_as_expected");
    expect(r.observedOutcome).toContain("compensation_required");
  });

  it("R-F1 out-of-order handled as expected", () => {
    const r = results.find(r => r.scenarioId === "R-F1")!;
    expect(r.drillStatus).toBe("handled_as_expected");
    expect(r.targetPath).toBe("replay");
  });

  it("R-F2 duplicate replay handled idempotently", () => {
    const r = results.find(r => r.scenarioId === "R-F2")!;
    expect(r.drillStatus).toBe("handled_as_expected");
  });

  it("R-F3 partial visibility degraded but continued", () => {
    const r = results.find(r => r.scenarioId === "R-F3")!;
    expect(r.drillStatus).toBe("degraded_but_continued");
  });

  it("R-F4 malformed stream handled as expected", () => {
    const r = results.find(r => r.scenarioId === "R-F4")!;
    expect(r.drillStatus).toBe("handled_as_expected");
  });

  it("all results have trace and metric counts > 0", () => {
    for (const r of results) {
      expect(r.traceSpanCount).toBeGreaterThan(0);
      expect(r.metricCount).toBeGreaterThan(0);
    }
  });
});

// ─── baseline snapshot ──────────────────────────────────────────────────────

describe("Phase6 Fault Drill: baseline snapshot", () => {
  const { snapshot } = runPhase6FaultDrill("p6-snap");

  it("has correct scenario count", () => {
    expect(snapshot.scenarioCount).toBe(8);
  });

  it("overallStatus is passed_with_notice due to degraded scenarios", () => {
    expect(snapshot.overallStatus).toBe("passed_with_notice");
    expect(snapshot.degradedButContinuedCount).toBeGreaterThan(0);
    expect(snapshot.failedUnexpectedlyCount).toBe(0);
  });

  it("summary is human-readable", () => {
    expect(snapshot.summary).toContain("handled");
    expect(snapshot.summary).toContain("degraded");
  });

  it("counts sum to scenarioCount", () => {
    expect(snapshot.handledAsExpectedCount + snapshot.degradedButContinuedCount + snapshot.failedUnexpectedlyCount).toBe(snapshot.scenarioCount);
  });
});

// ─── consistency ────────────────────────────────────────────────────────────

describe("Phase6 Fault Drill: consistency", () => {
  it("real drill is consistent", () => {
    const { snapshot } = runPhase6FaultDrill("p6-con");
    const c = validateFaultDrillConsistency(snapshot);
    expect(c.consistent).toBe(true);
    expect(c.violations).toHaveLength(0);
    expect(c.checkedInvariants).toBe(5);
  });
});

// ─── Step 1 compatibility ───────────────────────────────────────────────────

describe("Phase6 Fault Drill: Step 1 compatibility", () => {
  it("drill results contain trace and metric data from Step 1 spine", () => {
    const { results } = runPhase6FaultDrill("p6-compat");
    for (const r of results) {
      expect(r.traceSpanCount).toBeGreaterThanOrEqual(1);
      expect(r.metricCount).toBeGreaterThanOrEqual(1);
    }
  });
});
