import type { CaseReplayInput } from "./case-replay-command.js";
import type { StoredAuditEvent } from "./audit-event-store.js";

// ─── result model ───────────────────────────────────────────────────────────

export type CaseReconstructionStatus = "succeeded" | "failed" | "incomplete";

export type CaseReconstructionResult = {
  readonly caseId: string;
  readonly reconstructionStatus: CaseReconstructionStatus;
  readonly appliedEvents: number;
  readonly finalState: string;
  readonly reconstructedCaseType: string;
  readonly summary: string;
};

// ─── state derivation from events ───────────────────────────────────────────

const STATE_DERIVING_EVENT_TYPES: Record<string, string> = {
  RiskCaseOrchestrationStarted: "orchestration_started",
  RiskCaseOrchestrationStepCompleted: "step_completed",
  RiskCaseOrchestrationFailed: "orchestration_failed",
  RiskCaseOrchestrationCompensationPlanned: "compensation_planned",
  RiskCaseOrchestrationCompensationExecuted: "compensation_executed",
  RiskCaseOrchestrationCompleted: "orchestration_completed"
};

const deriveState = (event: StoredAuditEvent): string =>
  STATE_DERIVING_EVENT_TYPES[event.eventType] ?? "unknown";

const deriveCaseType = (events: readonly StoredAuditEvent[]): string => {
  const first = events[0];
  if (!first) return "unknown";
  const ct = first.payload["caseType"];
  if (typeof ct === "string") return ct;
  return first.producer.includes("liquidation") ? "liquidation" : "risk_case";
};

// ─── reconstruction ─────────────────────────────────────────────────────────

export const reconstructCaseFromReplayInput = (input: CaseReplayInput): CaseReconstructionResult => {
  if (input.events.length === 0) {
    return {
      caseId: input.caseId,
      reconstructionStatus: "incomplete",
      appliedEvents: 0,
      finalState: "no_events",
      reconstructedCaseType: "unknown",
      summary: "No events to reconstruct from"
    };
  }

  const caseIdMismatch = input.events.some(e => e.caseId !== input.caseId);
  if (caseIdMismatch) {
    return {
      caseId: input.caseId,
      reconstructionStatus: "failed",
      appliedEvents: 0,
      finalState: "caseId_conflict",
      reconstructedCaseType: "unknown",
      summary: "Event stream contains events for different caseId"
    };
  }

  const versionMissing = input.events.some(e => !e.eventVersion || e.eventVersion.length === 0);
  if (versionMissing) {
    return {
      caseId: input.caseId,
      reconstructionStatus: "failed",
      appliedEvents: 0,
      finalState: "version_invalid",
      reconstructedCaseType: "unknown",
      summary: "Event stream contains events with missing eventVersion"
    };
  }

  const sorted = [...input.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const lastEvent = sorted[sorted.length - 1]!;
  const finalState = deriveState(lastEvent);
  const caseType = deriveCaseType(sorted);

  const hasStarted = sorted.some(e => e.eventType === "RiskCaseOrchestrationStarted");
  const hasTerminal = sorted.some(e =>
    e.eventType === "RiskCaseOrchestrationCompleted" || e.eventType === "RiskCaseOrchestrationFailed"
  );

  if (!hasStarted) {
    return {
      caseId: input.caseId,
      reconstructionStatus: "incomplete",
      appliedEvents: sorted.length,
      finalState,
      reconstructedCaseType: caseType,
      summary: "Event stream missing Started event"
    };
  }

  return {
    caseId: input.caseId,
    reconstructionStatus: hasTerminal ? "succeeded" : "incomplete",
    appliedEvents: sorted.length,
    finalState,
    reconstructedCaseType: caseType,
    summary: hasTerminal
      ? `Reconstruction succeeded: ${sorted.length} events applied, final=${finalState}`
      : `Reconstruction incomplete: ${sorted.length} events applied but no terminal event`
  };
};
