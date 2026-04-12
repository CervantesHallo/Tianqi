import { describe, expect, it } from "vitest";
import { ok } from "@tianqi/shared";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView, LiquidationCaseView } from "./orchestration-ports.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { executeLiquidationCaseOrchestration } from "./liquidation-case-orchestrator.js";
import { assertOrchestrationPathConsistency } from "./orchestration-path-consistency.js";

const T = "2026-03-25T00:00:00.000Z";

const CASE_VIEW: RiskCaseView = {
  caseId: "c1", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL",
  configVersion: "1.0.0", createdAt: T
};

const LIQ_VIEW: LiquidationCaseView = {
  caseId: "lc1", parentRiskCaseId: "rc1", state: "Liquidating", stage: "Liquidating",
  configVersion: "1.0.0", createdAt: T
};

const ACTIVE_CONFIG: ActivePolicyConfigView = {
  configVersion: "1.0.0",
  rankingPolicyName: "score-descending-v1", rankingPolicyVersion: "1.0.0",
  fundWaterfallPolicyName: "priority-sequential-v1", fundWaterfallPolicyVersion: "1.0.0",
  candidateSelectionPolicyName: "threshold-selection-v1", candidateSelectionPolicyVersion: "1.0.0"
};

const makePorts = (): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok(CASE_VIEW) },
  liquidationCaseRepository: { loadCase: () => ok(LIQ_VIEW) },
  policyConfig: { getActivePolicyConfig: () => ok(ACTIVE_CONFIG) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies resolved" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "5 selected" }),
    executeRanking: () => ok({ rankedCount: 5, summary: "5 ranked" }),
    executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "3 allocated" })
  },
  audit: { publishAuditEvent: () => ok(undefined) }
});

describe("Path consistency: RiskCase vs LiquidationCase", () => {
  it("both success paths share the same result shape", () => {
    const ports = makePorts();
    const idem1 = createOrchestrationIdempotencyRegistry();
    const replay1 = createOrchestrationResultReplayRegistry();
    const idem2 = createOrchestrationIdempotencyRegistry();
    const replay2 = createOrchestrationResultReplayRegistry();

    const riskResult = executeRiskCaseOrchestration(
      { orchestrationId: "o-rc", caseId: "c1", requestId: "r1", triggeredBy: "test", triggeredAt: T },
      ports, idem1, replay1
    );
    const liqResult = executeLiquidationCaseOrchestration(
      { orchestrationId: "o-lc", caseId: "lc1", requestId: "r2", triggeredBy: "test", triggeredAt: T },
      ports, idem2, replay2
    );

    expect(riskResult.ok).toBe(true);
    expect(liqResult.ok).toBe(true);
    if (!riskResult.ok || !liqResult.ok) return;

    const consistency = assertOrchestrationPathConsistency(
      "RiskCase", riskResult.value, "LiquidationCase", liqResult.value
    );
    expect(consistency.consistent).toBe(true);
    expect(consistency.violations).toHaveLength(0);
    expect(consistency.checkedInvariants).toBe(6);
  });

  it("both paths produce equivalent field types", () => {
    const ports = makePorts();
    const idem1 = createOrchestrationIdempotencyRegistry();
    const replay1 = createOrchestrationResultReplayRegistry();
    const idem2 = createOrchestrationIdempotencyRegistry();
    const replay2 = createOrchestrationResultReplayRegistry();

    const rr = executeRiskCaseOrchestration(
      { orchestrationId: "o-rc2", caseId: "c1", requestId: "r3", triggeredBy: "test", triggeredAt: T },
      ports, idem1, replay1
    );
    const lr = executeLiquidationCaseOrchestration(
      { orchestrationId: "o-lc2", caseId: "lc1", requestId: "r4", triggeredBy: "test", triggeredAt: T },
      ports, idem2, replay2
    );
    expect(rr.ok).toBe(true);
    expect(lr.ok).toBe(true);
    if (!rr.ok || !lr.ok) return;

    expect(rr.value.resultStatus).toBe("succeeded");
    expect(lr.value.resultStatus).toBe("succeeded");
    expect(rr.value.executedSteps.length).toBe(lr.value.executedSteps.length);
    expect(typeof rr.value.auditEventSummary).toBe(typeof lr.value.auditEventSummary);
  });
});
