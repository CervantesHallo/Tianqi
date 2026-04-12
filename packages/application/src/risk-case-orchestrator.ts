import { ok, err } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type { ExecuteRiskCaseOrchestrationCommand } from "./execute-risk-case-orchestration-command.js";
import type { RiskCaseOrchestrationResult } from "./risk-case-orchestration-result.js";
import type { OrchestrationPorts, ActivePolicyConfigView, RiskCaseView } from "./orchestration-ports.js";
import type { OrchestrationIdempotencyRegistryOperations } from "./orchestration-idempotency.js";
import type { OrchestrationResultReplayRegistryOperations } from "./orchestration-result-replay.js";
import type { OrchestrationError } from "./orchestration-error.js";
import type { OrchestrationCompensationResult } from "./risk-case-orchestration-compensation.js";
import {
  idempotencyConflictError,
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

const ORCHESTRABLE_STATES = new Set([
  "Detected", "Validating", "Classified", "EvaluatingADL", "PlanningADL"
]);

const publishSafe = (
  ports: OrchestrationPorts,
  event: RiskCaseOrchestrationAuditEvent,
  collector: string[]
): void => {
  const r = ports.audit.publishAuditEvent(event);
  collector.push(event.eventType);
  if (!r.ok) {
    collector.push(`WARN:${event.eventType}_publish_failed`);
  }
};

const buildResult = (
  cmd: ExecuteRiskCaseOrchestrationCommand,
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
    auditSummary: `orchestration=${cmd.orchestrationId} case=${cmd.caseId} status=${saga.sagaStatus} steps=${saga.completedSteps.length}`,
    resultStatus: isSuccess ? "succeeded" : isCompensation ? "compensation_required" : "failed",
    resultSummary: isSuccess
      ? `Orchestration completed: ${saga.completedSteps.length} steps succeeded`
      : `Orchestration ${saga.sagaStatus}: ${saga.failedStep?.reason ?? "unknown"}`
  };
};

export const executeRiskCaseOrchestration = (
  cmd: ExecuteRiskCaseOrchestrationCommand,
  ports: OrchestrationPorts,
  idempotencyRegistry: OrchestrationIdempotencyRegistryOperations,
  replayRegistry: OrchestrationResultReplayRegistryOperations
): Result<RiskCaseOrchestrationResult, OrchestrationError> => {

  const idempotencyKey = { caseId: cmd.caseId, actionType: "execute_orchestration", requestId: cmd.requestId };

  // ── replay check ──
  const recorded = replayRegistry.getRecordedResult(idempotencyKey);
  if (recorded != null) {
    return ok({ ...recorded, idempotencyStatus: "replayed_same_result", replayedFromPreviousResult: true });
  }

  // ── idempotency guard ──
  const idempotencyCheck = idempotencyRegistry.check(idempotencyKey);
  if (idempotencyCheck.status === "duplicate_rejected") {
    return err(idempotencyConflictError(idempotencyCheck.key));
  }

  const auditEvents: string[] = [];
  let saga = createSagaState(cmd.orchestrationId, cmd.caseId, cmd.triggeredAt);
  let configVersion = "";
  let bundleSummary = "";

  // ── audit: started ──
  publishSafe(ports, buildOrchestrationAuditEvent(
    "RiskCaseOrchestrationStarted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt,
    { requestId: cmd.requestId, triggeredBy: cmd.triggeredBy }
  ), auditEvents);

  // ── Step 1: load case ──
  saga = advanceSaga(saga, "load_case");
  const caseResult = ports.caseRepository.loadCase(cmd.caseId);
  if (!caseResult.ok) {
    saga = recordStepFailure(saga, "load_case", caseResult.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason: caseResult.error.message }), auditEvents);
    return err(sagaStepFailed("load_case", caseResult.error.message));
  }
  const riskCase: RiskCaseView | null = caseResult.value;
  if (riskCase == null) {
    saga = recordStepFailure(saga, "load_case", "case not found");
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason: "case not found" }), auditEvents);
    return err(caseNotOrchestrable(cmd.caseId, "case not found"));
  }
  if (!ORCHESTRABLE_STATES.has(riskCase.state)) {
    const reason = `state ${riskCase.state} is not orchestrable`;
    saga = recordStepFailure(saga, "load_case", reason);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case", reason }), auditEvents);
    return err(caseNotOrchestrable(cmd.caseId, reason));
  }
  saga = recordStepSuccess(saga, "load_case", `loaded case in state ${riskCase.state}`);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_case" }), auditEvents);

  // ── Step 2: load active config ──
  saga = advanceSaga(saga, "load_active_config");
  const configResult = ports.policyConfig.getActivePolicyConfig();
  if (!configResult.ok) {
    saga = recordStepFailure(saga, "load_active_config", configResult.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config", reason: configResult.error.message }), auditEvents);
    return err(sagaStepFailed("load_active_config", configResult.error.message));
  }
  const activeConfig: ActivePolicyConfigView | null = configResult.value;
  if (activeConfig == null) {
    saga = recordStepFailure(saga, "load_active_config", "no active config");
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config", reason: "no active config" }), auditEvents);
    return err(activeConfigMissing());
  }
  configVersion = activeConfig.configVersion;
  saga = recordStepSuccess(saga, "load_active_config", `active config v${configVersion}`);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "load_active_config" }), auditEvents);

  // ── Step 3: resolve bundle ──
  saga = advanceSaga(saga, "resolve_bundle");
  const bundleResultVal = ports.policyBundle.resolveAndDryRun(activeConfig);
  if (!bundleResultVal.ok) {
    saga = recordStepFailure(saga, "resolve_bundle", bundleResultVal.error.message);
    publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationFailed", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "resolve_bundle", reason: bundleResultVal.error.message }), auditEvents);
    return err(bundleResolutionFailed(bundleResultVal.error.message));
  }
  bundleSummary = bundleResultVal.value.bundleSummary;
  saga = recordStepSuccess(saga, "resolve_bundle", bundleSummary);
  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { step: "resolve_bundle" }), auditEvents);

  const execInput = { caseId: cmd.caseId, caseType: riskCase.caseType, configVersion };

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

  // ── Steps 4-6: strategy execution ──
  if (!runStep("execute_candidate_selection", () => {
    const r = ports.strategyExecution.executeCandidateSelection(execInput);
    return r.ok ? ok({ summary: r.value.summary }) : r;
  })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }
  if (!runStep("execute_ranking", () => {
    const r = ports.strategyExecution.executeRanking(execInput);
    return r.ok ? ok({ summary: r.value.summary }) : r;
  })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }
  if (!runStep("execute_fund_waterfall", () => {
    const r = ports.strategyExecution.executeFundWaterfall(execInput);
    return r.ok ? ok({ summary: r.value.summary }) : r;
  })) {
    return ok(handleCompensation(cmd, saga, configVersion, bundleSummary, auditEvents, ports));
  }

  // ── Step 7: finalize ──
  saga = advanceSaga(saga, "finalize");
  saga = recordStepSuccess(saga, "finalize", "orchestration finalized");
  saga = completeSaga(saga, cmd.triggeredAt);

  publishSafe(ports, buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", cmd.orchestrationId, cmd.caseId, cmd.triggeredAt, { totalSteps: String(saga.completedSteps.length) }), auditEvents);

  const result = buildResult(cmd, saga, configVersion, bundleSummary, "accepted", null, auditEvents, false);

  idempotencyRegistry.record(idempotencyKey, cmd.orchestrationId);
  replayRegistry.recordResult(idempotencyKey, result);

  return ok(result);
};

// ── compensation path ──────────────────────────────────────────────────────

const handleCompensation = (
  cmd: ExecuteRiskCaseOrchestrationCommand,
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
