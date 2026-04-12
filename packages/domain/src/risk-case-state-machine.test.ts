import { describe, expect, it } from "vitest";

import { createConfigVersion, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { CaseStage } from "./case-stage.js";
import { CaseState } from "./case-state.js";
import { RiskCaseStateMachine } from "./risk-case-state-machine.js";
import { RISK_CASE_DOMAIN_EVENT_TYPES } from "./risk-case-domain-event.js";
import { RiskCaseType } from "./risk-case-type.js";
import { TransitionAction } from "./transition-action.js";
import { RiskCase } from "./risk-case.js";

const createBaseRiskCase = (): RiskCase => {
  const created = RiskCase.create({
    id: createRiskCaseId("case-state-machine"),
    caseType: RiskCaseType.Liquidation,
    configVersion: createConfigVersion(1),
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    traceId: createTraceId("trace-create-base")
  });

  if (!created.ok) {
    throw new Error("failed to create base RiskCase for tests");
  }

  return created.value.riskCase;
};

describe("RiskCaseStateMachine", () => {
  it("allows transition Detected -> Validating", () => {
    const stateMachine = new RiskCaseStateMachine();
    const riskCase = createBaseRiskCase();
    const result = stateMachine.transition({
      riskCase,
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-legal-1"),
        reason: "risk event detected",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.after.state).toBe(CaseState.Validating);
      expect(result.value.events).toHaveLength(1);
      expect(result.value.events[0]?.eventType).toBe(
        RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned
      );
      if (result.value.events[0]?.eventType === RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned) {
        expect(result.value.events[0].payload.toState).toBe(CaseState.Validating);
        expect(result.value.events[0].payload.toStage).toBe(CaseStage.Validation);
      }
    }
  });

  it("allows transition Validating -> Classified", () => {
    const stateMachine = new RiskCaseStateMachine();
    const first = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-legal-2-a"),
        reason: "move to validating",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = stateMachine.transition({
      riskCase: first.value.riskCase,
      action: TransitionAction.Classify,
      context: {
        traceId: createTraceId("trace-legal-2-b"),
        reason: "validated and classified",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:02.000Z")
      }
    });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.after.state).toBe(CaseState.Classified);
      expect(second.value.after.stage).toBe(CaseStage.Classification);
    }
  });

  it("allows minimal classified -> closed transition in phase2 step1", () => {
    const stateMachine = new RiskCaseStateMachine();
    const first = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-minimal-close-a"),
        reason: "move to validating",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = stateMachine.transition({
      riskCase: first.value.riskCase,
      action: TransitionAction.Classify,
      context: {
        traceId: createTraceId("trace-minimal-close-b"),
        reason: "classified for closure",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:02.000Z")
      }
    });
    expect(second.ok).toBe(true);
    if (!second.ok) {
      return;
    }

    const third = stateMachine.transition({
      riskCase: second.value.riskCase,
      action: TransitionAction.Close,
      context: {
        traceId: createTraceId("trace-minimal-close-c"),
        reason: "phase2 minimal closure",
        triggeredBy: "manual",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:03.000Z")
      }
    });

    expect(third.ok).toBe(true);
    if (third.ok) {
      expect(third.value.after.state).toBe(CaseState.Closed);
      expect(third.value.after.stage).toBe(CaseStage.Completed);
    }
  });

  it("rejects illegal transition Detected -> Close", () => {
    const stateMachine = new RiskCaseStateMachine();
    const result = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.Close,
      context: {
        traceId: createTraceId("trace-illegal-1"),
        reason: "invalid close",
        triggeredBy: "manual",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-DOM-002");
      expect(result.error.context.details?.currentState).toBe(CaseState.Detected);
      expect("events" in result).toBe(false);
    }
  });

  it("rejects illegal transition Validating -> Settle", () => {
    const stateMachine = new RiskCaseStateMachine();
    const first = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-illegal-2-a"),
        reason: "enter validating",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }

    const second = stateMachine.transition({
      riskCase: first.value.riskCase,
      action: TransitionAction.Settle,
      context: {
        traceId: createTraceId("trace-illegal-2-b"),
        reason: "should fail from validating",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:02.000Z")
      }
    });

    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("TQ-DOM-002");
      expect(second.error.context.details?.currentState).toBe(CaseState.Validating);
      expect("events" in second).toBe(false);
    }
  });

  it("returns before/after snapshots and bumps updatedAt", () => {
    const stateMachine = new RiskCaseStateMachine();
    const riskCase = createBaseRiskCase();
    const result = stateMachine.transition({
      riskCase,
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-before-after"),
        reason: "time update check",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:03.000Z")
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.before.updatedAt.toISOString()).toBe("2026-03-25T00:00:00.000Z");
      expect(result.value.after.updatedAt.toISOString()).toBe("2026-03-25T00:00:03.000Z");
      expect(result.value.after.updatedAt.getTime()).toBeGreaterThan(result.value.before.updatedAt.getTime());
      expect(result.value.events).toHaveLength(1);
      if (result.value.events[0]?.eventType === RISK_CASE_DOMAIN_EVENT_TYPES.RiskCaseStateTransitioned) {
        expect(result.value.events[0].payload.transitionedAt.toISOString()).toBe(
          "2026-03-25T00:00:03.000Z"
        );
      }
    }
  });

  it("rejects transition when config version mismatches", () => {
    const stateMachine = new RiskCaseStateMachine();
    const result = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-config-mismatch"),
        reason: "wrong config",
        triggeredBy: "system",
        configVersion: createConfigVersion(999),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-DOM-003");
    }
  });

  it("rejects transition when transitionedAt goes backwards", () => {
    const stateMachine = new RiskCaseStateMachine();
    const result = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-time-backward"),
        reason: "invalid time rollback",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-24T23:59:59.000Z")
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-DOM-003");
    }
  });

  it("forbids any transition from terminal state", () => {
    const stateMachine = new RiskCaseStateMachine();
    const toTerminal = stateMachine.transition({
      riskCase: createBaseRiskCase(),
      action: TransitionAction.Fail,
      context: {
        traceId: createTraceId("trace-terminal-enter"),
        reason: "force terminal",
        triggeredBy: "manual",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:01.000Z")
      }
    });
    expect(toTerminal.ok).toBe(true);
    if (!toTerminal.ok) {
      return;
    }

    const result = stateMachine.transition({
      riskCase: toTerminal.value.riskCase,
      action: TransitionAction.StartValidation,
      context: {
        traceId: createTraceId("trace-terminal-retry"),
        reason: "should be forbidden",
        triggeredBy: "system",
        configVersion: createConfigVersion(1),
        transitionedAt: new Date("2026-03-25T00:00:02.000Z")
      }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("TQ-DOM-005");
    }
  });
});
