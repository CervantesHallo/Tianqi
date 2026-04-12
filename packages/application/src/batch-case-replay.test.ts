import { describe, expect, it } from "vitest";
import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import {
  runBatchCaseReplay,
  buildReplayBaselineSnapshot,
  assertBatchReplayConsistency
} from "./batch-case-replay.js";
import type { RunBatchCaseReplayCommand } from "./batch-case-replay.js";

const T = "2026-03-25T00:00:00.000Z";

const seedStore = (caseIds: string[], complete = true) => {
  const store = createInMemoryAuditEventStore();
  for (const caseId of caseIds) {
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", `orch-${caseId}`, caseId, T, {}));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", `orch-${caseId}`, caseId, T, { step: "load_case" }));
    if (complete) {
      store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", `orch-${caseId}`, caseId, T, {}));
    }
  }
  return store;
};

const makeCmd = (id: string, caseIds: string[], expectations: { caseId: string; expectedFinalState: string }[] = []): RunBatchCaseReplayCommand => ({
  batchReplayId: id, caseIds, expectations, replayReason: "test", traceId: "tr-batch", replayRequestedAt: T
});

// ─── batch replay main path ─────────────────────────────────────────────────

describe("BatchCaseReplay: main path", () => {
  it("replays multiple cases successfully", () => {
    const store = seedStore(["c1", "c2", "c3"]);
    const result = runBatchCaseReplay(makeCmd("b1", ["c1", "c2", "c3"]), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCases).toBe(3);
    expect(result.value.successfulCases).toBe(3);
    expect(result.value.failedCases).toBe(0);
    expect(result.value.completedCaseIds).toEqual(["c1", "c2", "c3"]);
    expect(result.value.summary).toContain("3/3");
  });

  it("single case failure does not block others", () => {
    const store = seedStore(["c1", "c2"]);
    const result = runBatchCaseReplay(makeCmd("b2", ["c1", "c-missing", "c2"]), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.successfulCases).toBe(2);
    expect(result.value.failedCases).toBe(1);
    expect(result.value.failedCaseIds).toContain("c-missing");
    expect(result.value.completedCaseIds).toContain("c1");
    expect(result.value.completedCaseIds).toContain("c2");
  });

  it("empty caseIds produces empty batch", () => {
    const store = seedStore([]);
    const result = runBatchCaseReplay(makeCmd("b-empty", []), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalCases).toBe(0);
  });
});

// ─── comparison ─────────────────────────────────────────────────────────────

describe("BatchCaseReplay: comparison", () => {
  it("matched when expected final state equals actual", () => {
    const store = seedStore(["c1"]);
    const result = runBatchCaseReplay(
      makeCmd("b-match", ["c1"], [{ caseId: "c1", expectedFinalState: "orchestration_completed" }]),
      store
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comp = result.value.caseResults[0]!.comparison!;
    expect(comp.comparisonStatus).toBe("matched");
    expect(comp.hasDifference).toBe(false);
  });

  it("mismatched when expected final state differs", () => {
    const store = seedStore(["c1"]);
    const result = runBatchCaseReplay(
      makeCmd("b-mismatch", ["c1"], [{ caseId: "c1", expectedFinalState: "orchestration_failed" }]),
      store
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comp = result.value.caseResults[0]!.comparison!;
    expect(comp.comparisonStatus).toBe("mismatched");
    expect(comp.hasDifference).toBe(true);
    expect(comp.differenceSummary).toContain("Expected");
  });

  it("incomplete when reconstruction is incomplete", () => {
    const store = seedStore(["c1"], false);
    const result = runBatchCaseReplay(
      makeCmd("b-inc", ["c1"], [{ caseId: "c1", expectedFinalState: "orchestration_completed" }]),
      store
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comp = result.value.caseResults[0]!.comparison!;
    expect(comp.comparisonStatus).toBe("incomplete");
  });

  it("failed when replay itself fails", () => {
    const store = seedStore([]);
    const result = runBatchCaseReplay(
      makeCmd("b-fail", ["c-missing"], [{ caseId: "c-missing", expectedFinalState: "x" }]),
      store
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comp = result.value.caseResults[0]!.comparison!;
    expect(comp.comparisonStatus).toBe("failed");
  });

  it("matched when no expectation provided and replay succeeds", () => {
    const store = seedStore(["c1"]);
    const result = runBatchCaseReplay(makeCmd("b-noexp", ["c1"]), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const comp = result.value.caseResults[0]!.comparison!;
    expect(comp.comparisonStatus).toBe("matched");
  });
});

// ─── baseline snapshot ──────────────────────────────────────────────────────

describe("BatchCaseReplay: baseline snapshot", () => {
  it("all matched produces passed status", () => {
    const store = seedStore(["c1", "c2"]);
    const batchResult = runBatchCaseReplay(
      makeCmd("b-snap", ["c1", "c2"], [
        { caseId: "c1", expectedFinalState: "orchestration_completed" },
        { caseId: "c2", expectedFinalState: "orchestration_completed" }
      ]),
      store
    );
    expect(batchResult.ok).toBe(true);
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("snap-1", batchResult.value);
    expect(snapshot.overallStatus).toBe("passed");
    expect(snapshot.matchedCases).toBe(2);
    expect(snapshot.mismatchedCases).toBe(0);
    expect(snapshot.caseCount).toBe(2);
  });

  it("mismatch produces failed status", () => {
    const store = seedStore(["c1"]);
    const batchResult = runBatchCaseReplay(
      makeCmd("b-snap-f", ["c1"], [{ caseId: "c1", expectedFinalState: "wrong" }]),
      store
    );
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("snap-2", batchResult.value);
    expect(snapshot.overallStatus).toBe("failed");
    expect(snapshot.mismatchedCases).toBe(1);
  });

  it("incomplete produces passed_with_notice status", () => {
    const store = seedStore(["c1"], false);
    const batchResult = runBatchCaseReplay(makeCmd("b-snap-i", ["c1"]), store);
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("snap-3", batchResult.value);
    expect(snapshot.overallStatus).toBe("passed_with_notice");
    expect(snapshot.incompleteCases).toBe(1);
  });

  it("snapshot summary is human-readable", () => {
    const store = seedStore(["c1"]);
    const batchResult = runBatchCaseReplay(
      makeCmd("b-snap-s", ["c1"], [{ caseId: "c1", expectedFinalState: "orchestration_completed" }]),
      store
    );
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("snap-4", batchResult.value);
    expect(snapshot.snapshotSummary).toContain("matched");
    expect(snapshot.snapshotSummary).toContain("passed");
  });
});

// ─── consistency ────────────────────────────────────────────────────────────

describe("BatchCaseReplay: consistency", () => {
  it("clean batch and snapshot are consistent", () => {
    const store = seedStore(["c1", "c2"]);
    const batchResult = runBatchCaseReplay(
      makeCmd("b-con", ["c1", "c2"], [
        { caseId: "c1", expectedFinalState: "orchestration_completed" },
        { caseId: "c2", expectedFinalState: "orchestration_completed" }
      ]),
      store
    );
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("con-1", batchResult.value);
    const c = assertBatchReplayConsistency(batchResult.value, snapshot);
    expect(c.consistent).toBe(true);
    expect(c.violations.length).toBe(0);
    expect(c.checkedInvariants).toBe(5);
  });

  it("mixed batch is still consistent", () => {
    const store = seedStore(["c1"]);
    const batchResult = runBatchCaseReplay(
      makeCmd("b-con-mix", ["c1", "c-missing"], [
        { caseId: "c1", expectedFinalState: "orchestration_completed" },
        { caseId: "c-missing", expectedFinalState: "x" }
      ]),
      store
    );
    if (!batchResult.ok) return;
    const snapshot = buildReplayBaselineSnapshot("con-2", batchResult.value);
    const c = assertBatchReplayConsistency(batchResult.value, snapshot);
    expect(c.consistent).toBe(true);
  });
});

// ─── Step 1 compatibility ───────────────────────────────────────────────────

describe("BatchCaseReplay: Step 1 compatibility", () => {
  it("single case replay result in batch matches standalone replay semantics", () => {
    const store = seedStore(["c1"]);
    const batchResult = runBatchCaseReplay(makeCmd("b-compat", ["c1"]), store);
    expect(batchResult.ok).toBe(true);
    if (!batchResult.ok) return;
    const entry = batchResult.value.caseResults[0]!;
    expect(entry.replayResult).not.toBeNull();
    expect(entry.replayResult!.reconstructionStatus).toBe("succeeded");
    expect(entry.replayResult!.finalState).toBe("orchestration_completed");
    expect(entry.replayError).toBeNull();
  });
});
