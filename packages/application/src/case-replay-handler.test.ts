import { describe, expect, it } from "vitest";
import { createInMemoryAuditEventStore } from "./audit-event-store.js";
import type { StoredAuditEvent, AuditEventStorePort } from "./audit-event-store.js";
import { runCaseReplay } from "./case-replay-handler.js";
import type { ReplayCaseCommand } from "./case-replay-command.js";
import { reconstructCaseFromReplayInput } from "./case-reconstruction.js";
import type { CaseReplayInput } from "./case-replay-command.js";
import { validateReplayConsistency } from "./replay-consistency.js";
import { buildOrchestrationAuditEvent } from "./risk-case-orchestration-audit-event.js";

const T = "2026-03-25T00:00:00.000Z";

const makeEvent = (
  id: string, caseId: string, eventType: string, seq: number, version = "1.0.0"
): Omit<StoredAuditEvent, "storedAt" | "sequenceNumber"> => ({
  eventId: id, eventType, eventVersion: version, traceId: "tr1",
  caseId, occurredAt: T, producer: "test", payload: {}, metadata: {}
});

const makeReplayCmd = (caseId: string): ReplayCaseCommand => ({
  caseId, replayReason: "test", traceId: "tr-replay", replayRequestedAt: T
});

// ─── event store ────────────────────────────────────────────────────────────

describe("AuditEventStore: in-memory", () => {
  it("appends and retrieves events", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1));
    store.append(makeEvent("e2", "c1", "RiskCaseOrchestrationCompleted", 2));
    const result = store.listByCaseId("c1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBe(2);
    expect(result.value[0]!.sequenceNumber).toBe(1);
    expect(result.value[1]!.sequenceNumber).toBe(2);
  });

  it("isolates by caseId", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "Started", 1));
    store.append(makeEvent("e2", "c2", "Started", 2));
    const r1 = store.listByCaseId("c1");
    const r2 = store.listByCaseId("c2");
    expect(r1.ok && r1.value.length).toBe(1);
    expect(r2.ok && r2.value.length).toBe(1);
  });

  it("getByEventId returns correct event or null", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "Started", 1));
    const found = store.getByEventId("e1");
    const missing = store.getByEventId("e999");
    expect(found.ok && found.value?.eventId).toBe("e1");
    expect(missing.ok && missing.value).toBeNull();
  });

  it("stored event has storedAt and sequenceNumber", () => {
    const store = createInMemoryAuditEventStore();
    const result = store.append(makeEvent("e1", "c1", "Started", 1));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.storedAt).toBeTruthy();
    expect(result.value.sequenceNumber).toBeGreaterThan(0);
  });

  it("events are serializable", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "Started", 1));
    const r = store.listByCaseId("c1");
    if (!r.ok) return;
    const json = JSON.parse(JSON.stringify(r.value));
    expect(json[0].eventId).toBe("e1");
  });
});

// ─── replay main path ───────────────────────────────────────────────────────

describe("CaseReplay: main path", () => {
  it("replays a complete event stream successfully", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1));
    store.append(makeEvent("e2", "c1", "RiskCaseOrchestrationStepCompleted", 2));
    store.append(makeEvent("e3", "c1", "RiskCaseOrchestrationCompleted", 3));

    const result = runCaseReplay(makeReplayCmd("c1"), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reconstructionStatus).toBe("succeeded");
    expect(result.value.eventCount).toBe(3);
    expect(result.value.finalState).toBe("orchestration_completed");
    expect(result.value.replaySummary).toContain("succeeded");
  });

  it("returns incomplete for stream without terminal event", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1));
    store.append(makeEvent("e2", "c1", "RiskCaseOrchestrationStepCompleted", 2));

    const result = runCaseReplay(makeReplayCmd("c1"), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reconstructionStatus).toBe("incomplete");
  });
});

// ─── replay error paths ─────────────────────────────────────────────────────

describe("CaseReplay: error paths", () => {
  it("fails when no events found", () => {
    const store = createInMemoryAuditEventStore();
    const result = runCaseReplay(makeReplayCmd("c-empty"), store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("replay_input_invalid");
  });

  it("fails when caseId conflicts in events", () => {
    const store = createInMemoryAuditEventStore();
    store.append(makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1));
    store.append(makeEvent("e2", "c1", "RiskCaseOrchestrationCompleted", 2));
    const baseResult = store.listByCaseId("c1");
    const baseEvents = baseResult.ok ? baseResult.value : [];
    const conflictStore: AuditEventStorePort = {
      ...store,
      listByCaseId: () => ({ ok: true as const, value: [...baseEvents, { ...makeEvent("e3", "c-other", "X", 3), storedAt: T, sequenceNumber: 99 }] })
    };
    const result = runCaseReplay(makeReplayCmd("c1"), conflictStore);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("replay_consistency_failed");
  });
});

// ─── reconstruction skeleton ────────────────────────────────────────────────

describe("CaseReconstruction: skeleton", () => {
  it("succeeds with complete event stream", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [
        { ...makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1), storedAt: T, sequenceNumber: 1 },
        { ...makeEvent("e2", "c1", "RiskCaseOrchestrationCompleted", 2), storedAt: T, sequenceNumber: 2 }
      ],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = reconstructCaseFromReplayInput(input);
    expect(r.reconstructionStatus).toBe("succeeded");
    expect(r.appliedEvents).toBe(2);
    expect(r.finalState).toBe("orchestration_completed");
  });

  it("returns incomplete for empty events", () => {
    const input: CaseReplayInput = {
      caseId: "c1", events: [],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = reconstructCaseFromReplayInput(input);
    expect(r.reconstructionStatus).toBe("incomplete");
  });

  it("fails on caseId conflict", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [
        { ...makeEvent("e1", "c-wrong", "RiskCaseOrchestrationStarted", 1), storedAt: T, sequenceNumber: 1 }
      ],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = reconstructCaseFromReplayInput(input);
    expect(r.reconstructionStatus).toBe("failed");
    expect(r.summary).toContain("caseId");
  });

  it("fails on missing eventVersion", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [
        { ...makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1), eventVersion: "", storedAt: T, sequenceNumber: 1 }
      ],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = reconstructCaseFromReplayInput(input);
    expect(r.reconstructionStatus).toBe("failed");
  });
});

// ─── consistency checker ────────────────────────────────────────────────────

describe("ReplayConsistency: validation", () => {
  it("passes for valid input", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [
        { ...makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1), storedAt: T, sequenceNumber: 1 },
        { ...makeEvent("e2", "c1", "RiskCaseOrchestrationCompleted", 2), storedAt: T, sequenceNumber: 2 }
      ],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = validateReplayConsistency(input);
    expect(r.consistent).toBe(true);
    expect(r.checkedInvariants).toBe(4);
  });

  it("fails on caseId mismatch", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [{ ...makeEvent("e1", "c-other", "RiskCaseOrchestrationStarted", 1), storedAt: T, sequenceNumber: 1 }],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = validateReplayConsistency(input);
    expect(r.consistent).toBe(false);
    expect(r.violations.some(v => v.includes("caseId"))).toBe(true);
  });

  it("fails on missing eventVersion", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [{ ...makeEvent("e1", "c1", "RiskCaseOrchestrationStarted", 1), eventVersion: "", storedAt: T, sequenceNumber: 1 }],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = validateReplayConsistency(input);
    expect(r.consistent).toBe(false);
  });

  it("fails when missing Started event", () => {
    const input: CaseReplayInput = {
      caseId: "c1",
      events: [{ ...makeEvent("e1", "c1", "RiskCaseOrchestrationCompleted", 1), storedAt: T, sequenceNumber: 1 }],
      expectedConfigVersion: null, replayRequestedAt: T, replayReason: "test", traceId: "tr1"
    };
    const r = validateReplayConsistency(input);
    expect(r.consistent).toBe(false);
  });
});

// ─── Phase 4 integration ───────────────────────────────────────────────────

describe("Phase 4 audit events → event store", () => {
  it("Phase 4 orchestration audit events can be appended to store", () => {
    const store = createInMemoryAuditEventStore();
    const event = buildOrchestrationAuditEvent(
      "RiskCaseOrchestrationStarted", "orch-1", "c1", T, { requestId: "r1" }
    );
    const appendResult = store.append(event);
    expect(appendResult.ok).toBe(true);
    const listResult = store.listByCaseId("c1");
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.value.length).toBe(1);
    expect(listResult.value[0]!.eventType).toBe("RiskCaseOrchestrationStarted");
    expect(listResult.value[0]!.eventVersion).toBe("1.0.0");
  });

  it("multiple Phase 4 events form a replayable stream", () => {
    const store = createInMemoryAuditEventStore();
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStarted", "orch-2", "c2", T, {}));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationStepCompleted", "orch-2", "c2", T, { step: "load_case" }));
    store.append(buildOrchestrationAuditEvent("RiskCaseOrchestrationCompleted", "orch-2", "c2", T, {}));

    const replay = runCaseReplay(makeReplayCmd("c2"), store);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.reconstructionStatus).toBe("succeeded");
    expect(replay.value.eventCount).toBe(3);
  });
});
