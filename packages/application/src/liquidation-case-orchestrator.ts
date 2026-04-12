import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { ExecuteLiquidationCaseOrchestrationCommand } from "./execute-liquidation-case-orchestration-command.js";
import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";
import type { OrchestrationPorts, LiquidationCaseView } from "./orchestration-ports.js";
import type { OrchestrationIdempotencyRegistryOperations } from "./orchestration-idempotency.js";
import type { OrchestrationResultReplayRegistryOperations } from "./orchestration-result-replay.js";
import type { OrchestrationError } from "./orchestration-error.js";
import type { OrchestrationCompensationResult } from "./risk-case-orchestration-compensation.js";
import {
  caseNotOrchestrable,
  activeConfigMissing,
  bundleResolutionFailed,
  sagaStepFailed
} from "./orchestration-error.js";
import {
  createSagaState,
  advanceSaga,
  recordStepSuccess,
  recordStepFailure,
  completeSaga
} from "./risk-case-orchestration-saga.js";
import type { OrchestrationSagaState } from "./risk-case-orchestration-saga.js";
import { executeOrchestrationCompensation } from "./risk-case-orchestration-compensation.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";
import type { RiskCaseOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";

const LIQUIDATION_ORCHESTRABLE_STATES = new Set([
  "Detected", "Validating", "Classified", "Liquidating", "FundAbsorbing"
]);

const publishSafe = (
  ports: OrchestrationPorts,
  event: RiskCaseOrchestrationAuditEvent,
  collector: string[]
): void => {
  const r = ports.audit.publishAuditEvent(event);
  collector.push(event.eventType);
  if (!r.ok) collector.push(`WARN:${event.eventType}_publish_failed`);
};

const buildResult = (
  cmd: ExecuteLiquidationCaseOrchestrationCommand,
  saga: OrchestrationSagaState,
  configVersion: string,
  bundleSummary: string,
  idempotencyStatus: "accepted" | "duplicate_rejected" | "replayed_same_result",
  compensationResult: OrchestrationCompensationResult | null,
  auditEvents: readonly string[],
  replayed: boolean
): RiskCaseOrchestrationResult => {
  const isSuccess = saga.sagaStatus === "completed";
  const isCompensation = saga.sagaStatus === "compensation_required";
  return {
    orchestrationId: cmd.orchestrationId,
    caseId: cmd.caseId,
    configVersion,
    policyBundleSummary: bundleSummary,
    sagaStatus: saga.sagaStatus,
    idempotencyStatus,
    executedSteps: saga.completedSteps,
    pendingCompensation: saga.compensationPlan,
    compensationResult,
    auditEventSummary: `${auditEvents.length} audit event(s): ${auditEvents.join(", ")}`,
    replayedFromPreviousResult: replayed,
    auditSummary: `orchestration=${cmd.orchestrationId} case=${cmd.caseId} type=liquidation status=${saga.sagaStatus} steps=${saga.completedSteps.length}`,
    resultStatus: isSuccess ? "succeeded" : isCompensation ? "compensation_required" : "failed",
    resultSummary: isSuccess
      ? `Liquidation orchestration completed: ${saga.completedSteps.length} steps succeeded`
      : `Liquidation orchestration ${saga.sagaStatus}: ${saga.failedStep?.reason ?? "unknown"}`
  };
};

export const executeLiquidationCaseOrchestration = (
  cmd: ExecuteLiquidationCaseOrchestrationCommand,
  ports: OrchestrationPorts,
  idempotencyRegistry: OrchestrationIdempotencyRegistryOperations,
  replayRegistry: OrchestrationResultReplayRegistryOperations
): Result<RiskCaseOrchestrationResult, OrchestrationError> => {

  const idempotencyKey = { caseId: cmd.caseId, actionType: "execute_liquidation_orchestration", requestId: cmd.requestId };

  const recorded = replayRegistry.getRecordedResult(idempotencyKey);
  if (recorded != null) {
    return ok({ ...recorded, idempotencyStatus: "replayed_same_result", replayedFromPreviousResult: true });
  }

  const idempotencyCheck = idempotencyRegistry.check(idempotencyKey);
  if (idempotencyCheck.status === "duplicate_rejected") {
    return err({ code: "TQ-APP-009" as const, type: "idempotency_conflict" as const, message: `Duplicate: ${idempotencyCheck.key}`, context: { idempotencyKey: idempotencyCheck.key } });
  }

  const auditEvents: string[] = [];
  let saga = createSagaState(cmd.orchestrationId, cmd.caseId, cmd.triggeredAt);
  let configVersion = "";
  let bundleSummary = "";

  publishSafe(ports, buildOrchestrationAuditEvent(
    "RiskCaseOrchestrationStarted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt,
    { requestId: cmd.requestId, triggeredBy: cmd.triggeredBy, caseType: "liquidation" }
  ), auditEvents);

  // ── load liquidation case ──
  saga = advanceSaga(saga, "load_case");
  const caseResult = ports.liquidationCaseRepository.loadCase(cmd.caseId);
  if (!caseResult.ok) {
    saga = recordStepFailure(saga, "load_case", caseResult.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason: caseResult.error.message }), auditEvents);
    return err(sagaStepFailed("load_case", caseResult.error.message));
  }
  const liqCase: LiquidationCaseView | null = caseResult.value;
  if (liqCase == null) {
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason: "case not found" }), auditEvents);
    return err(caseNotOrchestrable(cmd.caseId, "liquidation case not found"));
  }
  if (!LIQUIDATION_ORCHESTRABLE_STATES.has(liqCase.state)) {
    const reason = `state ${liqCase.state} is not orchestrable for liquidation`;
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason }), auditEvents);
    return err(caseNotOrchestrable(cmd.caseId, reason));
  }
  saga = recordStepSuccess(saga, "load_case", `loaded liquidation case in state ${liqCase.state}`);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case" }), auditEvents);

  // ── load active config ──
  saga = advanceSaga(saga, "load_active_config");
  const configResult = ports.policyConfig.getActivePolicyConfig();
  if (!configResult.ok) {
    saga = recordStepFailure(saga, "load_active_config", configResult.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config", reason: configResult.error.message }), auditEvents);
    return err(sagaStepFailed("load_active_config", configResult.error.message));
  }
  if (configResult.value == null) {
    saga = recordStepFailure(saga, "load_active_config", "no active config");
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config", reason: "no active config" }), auditEvents);
    return err(activeConfigMissing());
  }
  configVersion = configResult.value.configVersion;
  saga = recordStepSuccess(saga, "load_active_config", `active config v${configVersion}`);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config" }), auditEvents);

  // ── resolve bundle ──
  saga = advanceSaga(saga, "resolve_bundle");
  const bundleVal = ports.policyBundle.resolveAndDryRun(configResult.value);
  if (!bundleVal.ok) {
    saga = recordStepFailure(saga, "resolve_bundle", bundleVal.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "resolve_bundle", reason: bundleVal.error.message }), auditEvents);
    return err(bundleResolutionFailed(bundleVal.error.message));
  }
  bundleSummary = bundleVal.value.bundleSummary;
  saga = recordStepSuccess(saga, "resolve_bundle", bundleSummary);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "resolve_bundle" }), auditEvents);

  const execInput = { caseId: cmd.caseId, caseType: "liquidation", configVersion };

  // ── helper: run strategy step ──
  const runStep = (
    stepName: "execute_candidate_selection" | "execute_ranking" | "execute_fund_waterfall",
    executor: () => Result<{ summary: string }, OrchestrationError>
  ): boolean => {
    saga = advanceSaga(saga, stepName);
    const r = executor();
    if (!r.ok) {
      saga = recordStepFailure(saga, stepName, r.error.message);
      publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: stepName, reason: r.error.message }), auditEvents);
      return false;
    }
    saga = recordStepSuccess(saga, stepName, r.value.summary);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: stepName }), auditEvents);
    return true;
  };

  if (!runStep("execute_candidate_selection", () => { const r = ports.strategyExecution.executeCandidateSelection(execInput); return r.ok ? ok({ summary: r.value.summary }) : r; })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }
  if (!runStep("execute_ranking", () => { const r = ports.strategyExecution.executeRanking(execInput); return r.ok ? ok({ summary: r.value.summary }) : r; })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }
  if (!runStep("execute_fund_waterfall", () => { const r = ports.strategyExecution.executeFundWaterfall(execInput); return r.ok ? ok({ summary: r.value.summary }) : r; })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }

  // ── finalize ──
  saga = advanceSaga(saga, "finalize");
  saga = recordStepSuccess(saga, "finalize", "liquidation orchestration finalized");
  saga = completeSaga(saga, cmd.triggeredAt);

  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { totalSteps: String(saga.completedSteps.length), caseType: "liquidation" }), auditEvents);

  const result = buildResult(cmd, saga, configVersion, bundleSummary, "accepted", null, auditEvents, false);
  idempotencyRegistry.record(idempotencyKey, cmd.orchestrationId);
  replayRegistry.recordResult(idempotencyKey, result);
  return ok(result);
};

const handleCompensation = (
  cmd: ExecuteLiquidationCaseOrchestrationCommand,
  saga: OrchestrationSagaState,
  configVersion: string,
  bundleSummary: string,
  auditEvents: string[],
  ports: OrchestrationPorts
): RiskCaseOrchestrationResult => {
  let compensationResult: OrchestrationCompensationResult | null = null;
  if (saga.compensationPlan.needed) {
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationCompensationPlanned", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { plan: JSON.stringify(saga.compensationPlan.requirements.map(r => r.compensableSteps)) }), auditEvents);
    compensationResult = executeOrchestrationCompensation(cmd.orchestrationId, cmd.caseId, saga.compensationPlan);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationCompensationExecuted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { compensationStatus: compensationResult.compensationStatus, steps: String(compensationResult.executedCompensationSteps.length) }), auditEvents);
  }
  return buildResult(cmd, saga, configVersion, bundleSummary, "accepted", compensationResult, auditEvents, false);
};
