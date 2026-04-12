import { describe, expect, it } from "vitest";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";

const SAMPLE_RESULT: RiskCaseOrchestrationResult = {
  orchestrationId: "o1",
  caseId: "c1",
  configVersion: "1.0.0",
  policyBundleSummary: "3 policies",
  sagaStatus: "completed",
  idempotencyStatus: "accepted",
  executedSteps: [],
  pendingCompensation: { needed: false, requirements: [] },
  compensationResult: null,
  auditEventSummary: "ok",
  replayedFromPreviousResult: false,
  auditSummary: "ok",
  resultStatus: "succeeded",
  resultSummary: "ok"
};

describe("Replay: registry", () => {
  it("returns null for unknown key", () => {
    const reg = createOrchestrationResultReplayRegistry();
    const key = { caseId: "c1", actionType: "execute", requestId: "r1" };
    expect(reg.getRecordedResult(key)).toBeNull();
  });

  it("records and retrieves result", () => {
    const reg = createOrchestrationResultReplayRegistry();
    const key = { caseId: "c1", actionType: "execute", requestId: "r1" };
    reg.recordResult(key, SAMPLE_RESULT);
    const retrieved = reg.getRecordedResult(key);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.orchestrationId).toBe("o1");
  });

  it("different keys are independent", () => {
    const reg = createOrchestrationResultReplayRegistry();
    const k1 = { caseId: "c1", actionType: "execute", requestId: "r1" };
    const k2 = { caseId: "c1", actionType: "execute", requestId: "r2" };
    reg.recordResult(k1, SAMPLE_RESULT);
    expect(reg.getRecordedResult(k2)).toBeNull();
  });
});
