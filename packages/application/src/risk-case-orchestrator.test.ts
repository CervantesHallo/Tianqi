import { describe, expect, it } from "vitest";
import { ok, err } from "@tianqi/shared";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView } from "./orchestration-ports.js";
import type { ExecuteRiskCaseOrchestrationCommand } from "./execute-risk-case-orchestration-command.js";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";
import { createOrchestrationResultReplayRegistry } from "./orchestration-result-replay.js";
import { executeRiskCaseOrchestration } from "./risk-case-orchestrator.js";
import { portUnavailable, strategyExecutionFailed } from "./orchestration-error.js";

const T = "2026-03-25T00:00:00.000Z";

const makeCmd = (id: string, caseId: string, requestId: string): ExecuteRiskCaseOrchestrationCommand => ({
  orchestrationId: id, caseId, requestId, triggeredBy: "test", triggeredAt: T
});

const CASE_VIEW: RiskCaseView = {
  caseId: "c1", caseType: "adl", state: "EvaluatingADL", stage: "EvaluatingADL",
  configVersion: "1.0.0", createdAt: T
};

const ACTIVE_CONFIG: ActivePolicyConfigView = {
  configVersion: "1.0.0",
  rankingPolicyName: "score-descending-v1", rankingPolicyVersion: "1.0.0",
  fundWaterfallPolicyName: "priority-sequential-v1", fundWaterfallPolicyVersion: "1.0.0",
  candidateSelectionPolicyName: "threshold-selection-v1", candidateSelectionPolicyVersion: "1.0.0"
};

const makePorts = (overrides?: Partial<OrchestrationPorts>): OrchestrationPorts => ({
  caseRepository: { loadCase: () => ok(CASE_VIEW) },
  liquidationCaseRepository: { loadCase: () => ok(null) },
  policyConfig: { getActivePolicyConfig: () => ok(ACTIVE_CONFIG) },
  policyBundle: { resolveAndDryRun: () => ok({ bundleSummary: "3 policies resolved" }) },
  strategyExecution: {
    executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 2, summary: "5 selected, 2 rejected" }),
    executeRanking: () => ok({ rankedCount: 5, summary: "5 ranked by score" }),
    executeFundWaterfall: () => ok({ allocatedCount: 3, shortfall: false, summary: "3 allocated, no shortfall" })
  },
  audit: { publishAuditEvent: () => ok(undefined) },
  ...overrides
});

const makeRegs = () => ({
  idem: createOrchestrationIdempotencyRegistry(),
  replay: createOrchestrationResultReplayRegistry()
});

// ─── main path O1 ───────────────────────────────────────────────────────────

describe("Orchestrator: main path O1", () => {
  it("succeeds with full pipeline", () => {
    const { idem, replay } = makeRegs();
    const result = executeRiskCaseOrchestration(makeCmd("o1", "c1", "r1"), makePorts(), idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("succeeded");
    expect(result.value.sagaStatus).toBe("completed");
    expect(result.value.configVersion).toBe("1.0.0");
    expect(result.value.policyBundleSummary).toBe("3 policies resolved");
    expect(result.value.executedSteps.length).toBe(7);
    expect(result.value.idempotencyStatus).toBe("accepted");
    expect(result.value.pendingCompensation.needed).toBe(false);
    expect(result.value.compensationResult).toBeNull();
    expect(result.value.replayedFromPreviousResult).toBe(false);
    expect(result.value.auditEventSummary).toContain("RiskCaseOrchestrationStarted");
    expect(result.value.auditEventSummary).toContain("RiskCaseOrchestrationCompleted");
  });
});

// ─── idempotency + replay ───────────────────────────────────────────────────

describe("Orchestrator: idempotency and replay", () => {
  it("replays same result on duplicate request", () => {
    const { idem, replay } = makeRegs();
    const first = executeRiskCaseOrchestration(makeCmd("o-rp", "c1", "r-same"), makePorts(), idem, replay);
    expect(first.ok).toBe(true);
    const second = executeRiskCaseOrchestration(makeCmd("o-rp2", "c1", "r-same"), makePorts(), idem, replay);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.idempotencyStatus).toBe("replayed_same_result");
    expect(second.value.replayedFromPreviousResult).toBe(true);
    expect(second.value.resultStatus).toBe("succeeded");
    expect(second.value.orchestrationId).toBe("o-rp");
  });

  it("does not re-execute business logic on replay", () => {
    let callCount = 0;
    const ports = makePorts({
      caseRepository: { loadCase: () => { callCount++; return ok(CASE_VIEW); } }
    });
    const { idem, replay } = makeRegs();
    executeRiskCaseOrchestration(makeCmd("o-noexec", "c1", "r-noexec"), ports, idem, replay);
    const before = callCount;
    executeRiskCaseOrchestration(makeCmd("o-noexec2", "c1", "r-noexec"), ports, idem, replay);
    expect(callCount).toBe(before);
  });
});

// ─── case boundaries ────────────────────────────────────────────────────────

describe("Orchestrator: case boundaries", () => {
  it("fails when case not found", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ caseRepository: { loadCase: () => ok(null) } });
    const result = executeRiskCaseOrchestration(makeCmd("o-nf", "c-missing", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("case_not_orchestrable");
  });

  it("fails when case state is not orchestrable", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ caseRepository: { loadCase: () => ok({ ...CASE_VIEW, state: "Closed" }) } });
    const result = executeRiskCaseOrchestration(makeCmd("o-closed", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
  });

  it("fails when port errors", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ caseRepository: { loadCase: () => err(portUnavailable("caseRepository", "timeout")) } });
    const result = executeRiskCaseOrchestration(makeCmd("o-port", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
  });
});

// ─── config / bundle boundaries ─────────────────────────────────────────────

describe("Orchestrator: config and bundle boundaries", () => {
  it("fails when no active config", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ policyConfig: { getActivePolicyConfig: () => ok(null) } });
    const result = executeRiskCaseOrchestration(makeCmd("o-nc", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("active_config_missing");
  });

  it("fails when bundle resolution fails", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({ policyBundle: { resolveAndDryRun: () => err(portUnavailable("bundle", "unresolvable")) } });
    const result = executeRiskCaseOrchestration(makeCmd("o-br", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(false);
  });
});

// ─── compensation ───────────────────────────────────────────────────────────

describe("Orchestrator: compensation", () => {
  it("executes compensation when ranking fails after selection", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      strategyExecution: {
        executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
        executeRanking: () => err(strategyExecutionFailed("ranking", "engine timeout")),
        executeFundWaterfall: () => ok({ allocatedCount: 0, shortfall: false, summary: "n/a" })
      }
    });
    const result = executeRiskCaseOrchestration(makeCmd("o-comp", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("compensation_required");
    expect(result.value.compensationResult).not.toBeNull();
    expect(result.value.compensationResult!.compensationStatus).toBe("completed");
    expect(result.value.compensationResult!.executedCompensationSteps.length).toBe(1);
    expect(result.value.compensationResult!.executedCompensationSteps[0]!.stepName).toBe("execute_candidate_selection");
    expect(result.value.auditEventSummary).toContain("CompensationPlanned");
    expect(result.value.auditEventSummary).toContain("CompensationExecuted");
  });

  it("no compensation when first strategy step fails", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      strategyExecution: {
        executeCandidateSelection: () => err(strategyExecutionFailed("selection", "no candidates")),
        executeRanking: () => ok({ rankedCount: 0, summary: "n/a" }),
        executeFundWaterfall: () => ok({ allocatedCount: 0, shortfall: false, summary: "n/a" })
      }
    });
    const result = executeRiskCaseOrchestration(makeCmd("o-sf", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("failed");
    expect(result.value.compensationResult).toBeNull();
  });
});

// ─── audit events ───────────────────────────────────────────────────────────

describe("Orchestrator: audit events", () => {
  it("success path emits started/step/completed events", () => {
    const published: string[] = [];
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      audit: { publishAuditEvent: (e) => { published.push(e.eventType); return ok(undefined); } }
    });
    executeRiskCaseOrchestration(makeCmd("o-aud", "c1", "r1"), ports, idem, replay);
    expect(published).toContain("RiskCaseOrchestrationStarted");
    expect(published).toContain("RiskCaseOrchestrationCompleted");
    expect(published.filter(e => e === "RiskCaseOrchestrationStepCompleted").length).toBeGreaterThanOrEqual(5);
  });

  it("failure path emits started and failed events", () => {
    const published: string[] = [];
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      caseRepository: { loadCase: () => ok(null) },
      audit: { publishAuditEvent: (e) => { published.push(e.eventType); return ok(undefined); } }
    });
    executeRiskCaseOrchestration(makeCmd("o-aud-fail", "c-miss", "r1"), ports, idem, replay);
    expect(published).toContain("RiskCaseOrchestrationStarted");
    expect(published).toContain("RiskCaseOrchestrationFailed");
  });

  it("compensation path emits planned and executed events", () => {
    const published: string[] = [];
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      strategyExecution: {
        executeCandidateSelection: () => ok({ selectedCount: 5, rejectedCount: 0, summary: "ok" }),
        executeRanking: () => err(strategyExecutionFailed("ranking", "timeout")),
        executeFundWaterfall: () => ok({ allocatedCount: 0, shortfall: false, summary: "n/a" })
      },
      audit: { publishAuditEvent: (e) => { published.push(e.eventType); return ok(undefined); } }
    });
    executeRiskCaseOrchestration(makeCmd("o-aud-comp", "c1", "r1"), ports, idem, replay);
    expect(published).toContain("RiskCaseOrchestrationCompensationPlanned");
    expect(published).toContain("RiskCaseOrchestrationCompensationExecuted");
  });

  it("audit events have correct version and fields", () => {
    const events: import("./risk-case-orchestration-audit-event.js").RiskCaseOrchestrationAuditEvent[] = [];
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      audit: { publishAuditEvent: (e) => { events.push(e); return ok(undefined); } }
    });
    executeRiskCaseOrchestration(makeCmd("o-aud-v", "c1", "r1"), ports, idem, replay);
    for (const e of events) {
      expect(e.eventVersion).toBe("1.0.0");
      expect(e.caseId).toBe("c1");
      expect(e.orchestrationId).toBe("o-aud-v");
      expect(e.producer).toBe("risk-case-orchestrator");
      expect(e.eventId).toBeTruthy();
    }
  });

  it("audit port failure does not crash orchestration", () => {
    const { idem, replay } = makeRegs();
    const ports = makePorts({
      audit: { publishAuditEvent: () => err(portUnavailable("audit", "offline")) }
    });
    const result = executeRiskCaseOrchestration(makeCmd("o-aud-err", "c1", "r1"), ports, idem, replay);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resultStatus).toBe("succeeded");
    expect(result.value.auditEventSummary).toContain("WARN");
  });
});

// ─── ports boundary ─────────────────────────────────────────────────────────

describe("Orchestrator: ports boundary", () => {
  it("works with all fake ports (no real infra)", () => {
    const { idem, replay } = makeRegs();
    const result = executeRiskCaseOrchestration(makeCmd("o-fake", "c1", "r1"), makePorts(), idem, replay);
    expect(result.ok).toBe(true);
  });
});
