import { describe, expect, it } from "vitest";
import { ok, err } from "@tianqi/shared";
import type { OrchestrationPorts, ActivePolicyConfigView, LiquidationCaseView } from "./orchestration-ports.js";
import type { ExecuteLiquidationCaseOrchestrationCommand } from "./execute-liquidation-case-orchestration-command.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { executeLiquidationCaseOrchestration } from "./liquidation-case-orchestrator.js";
import { portUnavailable, strategyExecutionFailed } from "./orchestration-error.js";

const T = "2026-03-25T00:00:00.000Z";

const makeCmd = (id: string, caseId: string, requestId: string): ExecuteLiquidationCaseOrchestrationCommand => ({
  orchestrationId: id, caseId, requestId, triggeredBy: "test", triggeredAt: T
});

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

const makePorts = (overrides?: Partial<OrchestrationPorts>): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok(null) },
  liquidationCaseRepository: { loadCase: () => ok(LIQ_VIEW) },
  policyConfig: { getActivePolicyConfig: () => ok(ACTIVE_CONFIG) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies resolved" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 4, rejectedCount: 1, summary: "4 selected, 1 rejected" }),
    executeRanking: () => ok({ rankedCount: 4, summary: "4 ranked" }),
    executeFundWaterfall: () => ok({ allocatedCount: 2, shortfall: false, summary: "2 allocated" })
  },
  audit: { publishAuditEvent: () => ok(undefined) },
  ...overrides
});

const makeRegs = () => ({
  idem: createOrchestrationIdempotencyRegistry(),
  replay: createOrchestrationResultReplayRegistry()
});

// ─── L1 main path ───────────────────────────────────────────────────────────

describe("LiquidationCase Orchestrator: L1 path", () => {
  it("succeeds with full pipeline", () => {
    const { idem, replay } = makeRegs();
    const result = executeLiquidationCaseOrchestration(makeCmd("l1", "lc1", "r1"), makePorts(), idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("succeeded");
    expect(result.value.sagaStatus).toBe("completed");
    expect(result.value.executedSteps.length).toBe(7);
    expect(result.value.idempotencyStatus).toBe("accepted");
    expect(result.value.replayedFromPreviousResult).toBe(false);
    expect(result.value.auditEventSummary).toContain("RiskCaseOrchestrationStarted");
    expect(result.value.auditEventSummary).toContain("RiskCaseOrchestrationCompleted");
    expect(result.value.resultSummary).toContain("Liquidation");
  });
});

// ─── replay ─────────────────────────────────────────────────────────────────

describe("LiquidationCase Orchestrator: replay", () => {
  it("replays same result on duplicate request", () => {
    const { idem, replay } = makeRegs();
    executeLiquidationCaseOrchestration(makeCmd("l-rp", "lc1", "r-same"), makePorts(), idem, replay);
    const second = executeLiquidationCaseOrchestration(makeCmd("l-rp2", "lc1", "r-same"), makePorts(), idem, replay);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.idempotencyStatus).toBe("replayed_same_result");
    expect(second.value.replayedFromPreviousResult).toBe(true);
  });
});

// ─── compensation ───────────────────────────────────────────────────────────

describe("LiquidationCase Orchestrator: compensation", () => {
  it("executes compensation when ranking fails after selection", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      strategyExecution: {
        executeCandidateSelection: () => ok({ selectedCount: 3, rejectedCount: 0, summary: "ok" }),
        executeRanking: () => err(strategyExecutionFailed("ranking", "timeout")),
        executeFundWaterfall: () => ok({ allocatedCount: 0, shortfall: false, summary: "n/a" })
      }
    });
    const result = executeLiquidationCaseOrchestration(makeCmd("l-comp", "lc1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("compensation_required");
    expect(result.value.compensationResult).not.toBeNull();
    expect(result.value.auditEventSummary).toContain("CompensationPlanned");
  });
});

// ─── boundaries ─────────────────────────────────────────────────────────────

describe("LiquidationCase Orchestrator: boundaries", () => {
  it("fails when liquidation case not found", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ liquidationCaseRepository: { loadCase: () => ok(null) } });
    const result = executeLiquidationCaseOrchestration(makeCmd("l-nf", "lc-missing", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("case_not_orchestrable");
  });

  it("fails when case state is not orchestrable", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ liquidationCaseRepository: { loadCase: () => ok({ ...LIQ_VIEW, state: "Closed" }) } });
    const result = executeLiquidationCaseOrchestration(makeCmd("l-closed", "lc1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
  });

  it("fails when no active config", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ policyConfig: { getActivePolicyConfig: () => ok(null) } });
    const result = executeLiquidationCaseOrchestration(makeCmd("l-nc", "lc1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("active_config_missing");
  });

  it("fails when bundle resolution fails", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ policyBundle: { resolveAndDryRun: () => err(portUnavailable("bundle", "err")) } });
    const result = executeLiquidationCaseOrchestration(makeCmd("l-br", "lc1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
  });
});
