import type { DomainEventEnvelope } from "@tianqi/contracts";
import { RiskCase, RiskCaseType, TransitionAction } from "@tianqi/domain";
import type {
  CommandResultStorePort,
  DomainEventPublisherPort,
  IdempotencyPort,
  IdempotencyReservation,
  RiskCaseRepositoryPort,
  StoredCommandResultSnapshot
} from "@tianqi/ports";
import {
  COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
} from "./command-result-snapshot-schema.js";
import {
  createCommandResultReference,
  createConfigVersion,
  createIdempotencyKey,
  createRiskCaseId,
  createTraceId,
  err,
  ok
} from "@tianqi/shared";
import { describe, expect, it } from "vitest";

import { RiskCaseCommandHandler } from "./risk-case-command-handler.js";

class FakeRiskCaseRepository implements RiskCaseRepositoryPort {
  public readonly store = new Map<string, RiskCase>();
  public readonly timeline: string[];
  public failOnSave = false;

  public constructor(timeline: string[] = []) {
    this.timeline = timeline;
  }

  public async getById(caseId: ReturnType<typeof createRiskCaseId>) {
    this.timeline.push("repository.getById");
    return ok(this.store.get(caseId) ?? null);
  }

  public async save(riskCase: RiskCase) {
    this.timeline.push("repository.save");
    if (this.failOnSave) {
      return err({ message: "repository save failed" });
    }
    this.store.set(riskCase.id, riskCase);
    return ok(undefined);
  }
}

class FakeIdempotencyPort implements IdempotencyPort {
  public readonly decisions = new Map<string, IdempotencyReservation>();
  public readonly timeline: string[];

  public constructor(timeline: string[] = []) {
    this.timeline = timeline;
  }

  public async reserve(commandName: string, key: ReturnType<typeof createIdempotencyKey>) {
    this.timeline.push(`idempotency.reserve:${commandName}`);
    const merged = `${commandName}:${key}`;
    return ok(this.decisions.get(merged) ?? { status: "accepted" as const });
  }
}

class FakeDomainEventPublisher implements DomainEventPublisherPort {
  public readonly timeline: string[];
  public failOnPublish = false;

  public constructor(timeline: string[] = []) {
    this.timeline = timeline;
  }

  public async publish(event: DomainEventEnvelope<Record<string, unknown>>) {
    this.timeline.push(`publisher.publish:${event.eventType}`);
    if (this.failOnPublish) {
      return err({ message: "publisher failed" });
    }
    return ok(undefined);
  }
}

class FakeCommandResultStore implements CommandResultStorePort {
  public readonly snapshots = new Map<string, StoredCommandResultSnapshot>();
  public readonly timeline: string[];

  public constructor(timeline: string[] = []) {
    this.timeline = timeline;
  }

  public async getByReference(reference: ReturnType<typeof createCommandResultReference>) {
    this.timeline.push(`resultStore.getByReference:${reference}`);
    const snapshot = this.snapshots.get(reference);
    if (!snapshot) {
      return ok({ status: "missing" as const });
    }
    return ok({ status: "found" as const, snapshot });
  }
}

const createSeedRiskCase = (caseId: string): RiskCase => {
  const created = RiskCase.create({
    id: createRiskCaseId(caseId),
    caseType: RiskCaseType.Liquidation,
    configVersion: createConfigVersion(1),
    createdAt: new Date("2026-03-25T00:00:00.000Z"),
    traceId: createTraceId(`trace-${caseId}-create`)
  });
  if (!created.ok) {
    throw new Error("failed to create seed case");
  }
  return created.value.riskCase;
};

const reusedSnapshot = (reference: ReturnType<typeof createCommandResultReference>): StoredCommandResultSnapshot => ({
  schemaVersion: COMMAND_RESULT_SNAPSHOT_SCHEMA_VERSION,
  reference,
  commandName: "CreateRiskCaseCommand",
  riskCase: {
    caseId: "case-reused",
    caseType: "Liquidation",
    state: "Detected",
    stage: "Detection",
    configVersion: 1,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z"
  },
  events: [
    {
      eventId: "event-reused-001",
      eventType: "RiskCaseCreated",
      eventVersion: "1.0.0",
      traceId: "trace-reused-001",
      caseId: "case-reused",
      occurredAt: "2026-03-25T00:00:00.000Z",
      payload: {
        caseType: "Liquidation"
      }
    }
  ],
  processing: {
    persistence: "succeeded",
    mapping: "succeeded",
    publish: "succeeded",
    outcome: "completed"
  }
});

describe("RiskCaseCommandHandler", () => {
  it("create success path includes publish call", async () => {
    const timeline: string[] = [];
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(timeline),
      idempotencyPort: new FakeIdempotencyPort(timeline),
      domainEventPublisher: new FakeDomainEventPublisher(timeline),
      commandResultStore: new FakeCommandResultStore(timeline)
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-create-success"),
      traceId: "trace-create-success",
      caseId: "case-create-success",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.processing.publish).toBe("succeeded");
      expect(result.compensation?.status).toBe("not_required");
      expect(result.events[0]?.eventType).toBe("RiskCaseCreated");
    }
    expect(timeline).toEqual([
      "idempotency.reserve:CreateRiskCaseCommand",
      "repository.save",
      "publisher.publish:RiskCaseCreated"
    ]);
  });

  it("transition success path includes publish call", async () => {
    const timeline: string[] = [];
    const repository = new FakeRiskCaseRepository(timeline);
    repository.store.set("case-transition-success", createSeedRiskCase("case-transition-success"));
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: repository,
      idempotencyPort: new FakeIdempotencyPort(timeline),
      domainEventPublisher: new FakeDomainEventPublisher(timeline),
      commandResultStore: new FakeCommandResultStore(timeline)
    });

    const result = await handler.handleTransition({
      idempotencyKey: createIdempotencyKey("idem-transition-success"),
      traceId: "trace-transition-success",
      caseId: "case-transition-success",
      action: TransitionAction.StartValidation,
      reason: "transition",
      triggeredBy: "system",
      configVersion: 1,
      transitionedAt: "2026-03-25T00:00:01.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.processing.publish).toBe("succeeded");
      expect(result.compensation?.status).toBe("not_required");
      expect(result.transition?.after.state).toBe("Validating");
    }
    expect(timeline).toEqual([
      "idempotency.reserve:TransitionRiskCaseCommand",
      "repository.getById",
      "repository.save",
      "publisher.publish:RiskCaseStateTransitioned"
    ]);
  });

  it("publish failure returns compensation marker", async () => {
    const publisher = new FakeDomainEventPublisher();
    publisher.failOnPublish = true;
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(),
      idempotencyPort: new FakeIdempotencyPort(),
      domainEventPublisher: publisher,
      commandResultStore: new FakeCommandResultStore()
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-publish-failure"),
      traceId: "trace-publish-failure",
      caseId: "case-publish-failure",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-005");
      expect(result.processing.outcome).toBe("failed_after_persistence");
      expect(result.compensation?.required).toBe(true);
      expect(result.compensation?.reason).toBe("publish_failed");
      expect(result.compensation?.status).toBe("pending");
      expect(result.compensation?.commandName).toBe("CreateRiskCaseCommand");
    }
  });

  it("duplicate + reference + readable returns reused snapshot", async () => {
    const timeline: string[] = [];
    const idempotency = new FakeIdempotencyPort(timeline);
    const resultStore = new FakeCommandResultStore(timeline);
    const reference = createCommandResultReference("result-ref-readable");
    idempotency.decisions.set("CreateRiskCaseCommand:idem-dup-readable", {
      status: "duplicate",
      resultReference: reference
    });
    resultStore.snapshots.set(reference, reusedSnapshot(reference));
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(timeline),
      idempotencyPort: idempotency,
      domainEventPublisher: new FakeDomainEventPublisher(timeline),
      commandResultStore: resultStore
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-dup-readable"),
      traceId: "trace-dup-readable",
      caseId: "case-dup-readable",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.idempotency.status).toBe("duplicate");
      expect(result.idempotency.reuse).toBe("reference_available");
      expect(result.riskCase.caseId).toBe("case-reused");
      expect(result.events[0]?.eventType).toBe("RiskCaseCreated");
    }
    expect(timeline).toEqual([
      "idempotency.reserve:CreateRiskCaseCommand",
      "resultStore.getByReference:result-ref-readable"
    ]);
  });

  it("duplicate + reference + missing snapshot returns unavailable reference error", async () => {
    const idempotency = new FakeIdempotencyPort();
    const reference = createCommandResultReference("result-ref-missing");
    idempotency.decisions.set("CreateRiskCaseCommand:idem-dup-missing", {
      status: "duplicate",
      resultReference: reference
    });
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(),
      idempotencyPort: idempotency,
      domainEventPublisher: new FakeDomainEventPublisher(),
      commandResultStore: new FakeCommandResultStore()
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-dup-missing"),
      traceId: "trace-dup-missing",
      caseId: "case-dup-missing",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-006");
      expect(result.idempotency.reuse).toBe("reference_available");
    }
  });

  it("duplicate + no reference keeps explicit unavailable semantics", async () => {
    const idempotency = new FakeIdempotencyPort();
    idempotency.decisions.set("CreateRiskCaseCommand:idem-dup-no-reference", {
      status: "duplicate"
    });
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: new FakeRiskCaseRepository(),
      idempotencyPort: idempotency,
      domainEventPublisher: new FakeDomainEventPublisher(),
      commandResultStore: new FakeCommandResultStore()
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-dup-no-reference"),
      traceId: "trace-dup-no-reference",
      caseId: "case-dup-no-reference",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-006");
      expect(result.idempotency.reuse).toBe("reference_unavailable");
    }
  });

  it("save failure never publishes", async () => {
    const timeline: string[] = [];
    const repository = new FakeRiskCaseRepository(timeline);
    repository.failOnSave = true;
    const handler = new RiskCaseCommandHandler({
      riskCaseRepository: repository,
      idempotencyPort: new FakeIdempotencyPort(timeline),
      domainEventPublisher: new FakeDomainEventPublisher(timeline),
      commandResultStore: new FakeCommandResultStore(timeline)
    });

    const result = await handler.handleCreate({
      idempotencyKey: createIdempotencyKey("idem-save-failure"),
      traceId: "trace-save-failure",
      caseId: "case-save-failure",
      caseType: RiskCaseType.Liquidation,
      configVersion: 1,
      createdAt: "2026-03-25T00:00:00.000Z"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("TQ-APP-004");
      expect(result.processing.publish).toBe("not_attempted");
    }
    expect(timeline).toEqual([
      "idempotency.reserve:CreateRiskCaseCommand",
      "repository.save"
    ]);
  });
});
