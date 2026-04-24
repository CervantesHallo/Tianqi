import { beforeEach, describe, expect, it } from "vitest";

import type { DomainEventEnvelope } from "@tianqi/contracts";
import { DOMAIN_EVENT_TYPES, createEventVersion } from "@tianqi/contracts";
import { createEventId, createRiskCaseId, createTraceId } from "@tianqi/shared";
import type { EventId, RiskCaseId } from "@tianqi/shared";

import type { EventStoreAdapterUnderTest } from "./event-store-contract.js";

export type PersistentTestSession = Readonly<{
  databasePath: string;
}>;

export type PersistentEventStoreAdapterFactory<
  T extends EventStoreAdapterUnderTest = EventStoreAdapterUnderTest
> = (session: PersistentTestSession) => T | Promise<T>;

export type PersistentEventStoreContractOptions = Readonly<{
  scratchDirectory: string;
  corruptSchemaVersion: (
    session: PersistentTestSession,
    newVersion: string
  ) => void | Promise<void>;
}>;

type SamplePayload = Record<string, unknown>;

type SampleEnvelopeOverrides = {
  readonly eventId?: EventId;
  readonly occurredAt?: string;
  readonly caseId?: RiskCaseId;
  readonly payload?: SamplePayload;
};

const buildSampleEnvelope = (
  suffix: string,
  overrides: SampleEnvelopeOverrides = {}
): DomainEventEnvelope<SamplePayload> => ({
  eventId: overrides.eventId ?? createEventId(`evt-p-${suffix}`),
  eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
  eventVersion: createEventVersion("1.0.0"),
  traceId: createTraceId("trace-persistent-1"),
  caseId: overrides.caseId ?? createRiskCaseId("case-persistent-1"),
  occurredAt: overrides.occurredAt ?? "2026-04-19T12:00:00.000Z",
  producer: "adapter-testkit-persistent",
  payload: overrides.payload ?? { kind: "sample" },
  metadata: {
    sourceModule: "adapter-testkit-persistent",
    schemaVersion: "1.0.0"
  }
});

let sessionCounter = 0;

const nextSessionPath = (scratchDirectory: string): string => {
  sessionCounter += 1;
  return `${scratchDirectory}/persistent-session-${sessionCounter}.sqlite`;
};

export const definePersistentEventStoreContractTests = <
  T extends EventStoreAdapterUnderTest = EventStoreAdapterUnderTest
>(
  adapterName: string,
  factory: PersistentEventStoreAdapterFactory<T>,
  options: PersistentEventStoreContractOptions
): void => {
  describe(`[adapter-testkit] EventStore persistent contract — ${adapterName}`, () => {
    let session: PersistentTestSession;

    beforeEach(() => {
      session = { databasePath: nextSessionPath(options.scratchDirectory) };
    });

    describe("category P1: persistence and recovery", () => {
      it("test_events_persist_across_shutdown_and_fresh_init_on_same_path", async () => {
        const writer = await factory(session);
        await writer.init();
        const envelope = buildSampleEnvelope("p1-1");
        const writeResult = await writer.append(envelope);
        expect(writeResult.ok).toBe(true);
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        const recovered = await reader.listByCaseId(envelope.caseId);
        expect(recovered).toHaveLength(1);
        expect(recovered[0]?.eventId).toBe(envelope.eventId);
        await reader.shutdown();
      });

      it("test_recovered_events_preserve_occurred_at_ascending_order", async () => {
        const writer = await factory(session);
        await writer.init();
        const caseId = createRiskCaseId("case-p1-2");
        await writer.append(
          buildSampleEnvelope("p1-2-late", { caseId, occurredAt: "2026-04-19T12:00:00.900Z" })
        );
        await writer.append(
          buildSampleEnvelope("p1-2-early", { caseId, occurredAt: "2026-04-19T12:00:00.100Z" })
        );
        await writer.append(
          buildSampleEnvelope("p1-2-mid", { caseId, occurredAt: "2026-04-19T12:00:00.500Z" })
        );
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        const recovered = await reader.listByCaseId(caseId);
        expect(recovered.map((event) => event.occurredAt)).toEqual([
          "2026-04-19T12:00:00.100Z",
          "2026-04-19T12:00:00.500Z",
          "2026-04-19T12:00:00.900Z"
        ]);
        await reader.shutdown();
      });

      it("test_count_total_after_recovery_equals_count_before_shutdown", async () => {
        const writer = await factory(session);
        await writer.init();
        for (let index = 0; index < 7; index += 1) {
          await writer.append(buildSampleEnvelope(`p1-3-${index}`));
        }
        const beforeShutdown = await writer.countTotal();
        await writer.shutdown();

        const reader = await factory(session);
        await reader.init();
        const afterRecover = await reader.countTotal();
        expect(afterRecover).toBe(beforeShutdown);
        expect(afterRecover).toBe(7);
        await reader.shutdown();
      });

      it("test_two_independent_instances_on_same_path_both_see_committed_events", async () => {
        const writer = await factory(session);
        await writer.init();
        const envelope = buildSampleEnvelope("p1-4");
        await writer.append(envelope);

        const reader = await factory(session);
        await reader.init();
        const observed = await reader.listByCaseId(envelope.caseId);
        expect(observed.map((event) => event.eventId)).toContain(envelope.eventId);
        await reader.shutdown();
        await writer.shutdown();
      });
    });

    describe("category P2: schema management", () => {
      it("test_init_on_empty_database_creates_schema_and_records_schema_version_1_0_0", async () => {
        const adapter = await factory(session);
        await adapter.init();
        const health = await adapter.healthCheck();
        expect(health.details["schemaVersion"]).toBe("1.0.0");
        await adapter.shutdown();
      });

      it("test_init_on_preexisting_schema_is_idempotent_and_does_not_overwrite_version", async () => {
        const first = await factory(session);
        await first.init();
        await first.append(buildSampleEnvelope("p2-2"));
        await first.shutdown();

        const second = await factory(session);
        await second.init();
        const health = await second.healthCheck();
        expect(health.details["schemaVersion"]).toBe("1.0.0");
        expect(await second.countTotal()).toBe(1);
        await second.shutdown();
      });

      it("test_init_on_schema_version_mismatch_rejects_with_tq_inf_schema_version_mismatch", async () => {
        const first = await factory(session);
        await first.init();
        await first.shutdown();

        await options.corruptSchemaVersion(session, "99.0.0");

        const second = await factory(session);
        await expect(second.init()).rejects.toThrow(/TQ-INF-008/);
      });
    });

    describe("category P3: concurrency and transaction atomicity", () => {
      it("test_failed_append_does_not_persist_and_prior_appends_remain_intact", async () => {
        const adapter = await factory(session);
        await adapter.init();
        const good = buildSampleEnvelope("p3-1-good");
        const okResult = await adapter.append(good);
        expect(okResult.ok).toBe(true);

        const invalid = {
          ...buildSampleEnvelope("p3-1-bad"),
          occurredAt: "not-a-date"
        } as DomainEventEnvelope<SamplePayload>;
        const badResult = await adapter.append(invalid);
        expect(badResult.ok).toBe(false);

        const count = await adapter.countTotal();
        expect(count).toBe(1);
        await adapter.shutdown();
      });

      it("test_promise_all_concurrent_appends_produce_no_lost_or_duplicate_events", async () => {
        const adapter = await factory(session);
        await adapter.init();
        const envelopes = Array.from({ length: 15 }, (_, index) =>
          buildSampleEnvelope(`p3-2-${index}`)
        );
        const results = await Promise.all(envelopes.map((envelope) => adapter.append(envelope)));
        for (const result of results) {
          expect(result.ok).toBe(true);
        }
        expect(await adapter.countTotal()).toBe(15);
        const uniqueIds = new Set(envelopes.map((envelope) => envelope.eventId));
        expect(uniqueIds.size).toBe(15);
        await adapter.shutdown();
      });

      it("test_committed_appends_are_visible_to_a_second_adapter_instance_on_same_path", async () => {
        const writer = await factory(session);
        await writer.init();
        const envelope = buildSampleEnvelope("p3-3");
        await writer.append(envelope);

        const observer = await factory(session);
        await observer.init();
        expect(await observer.countTotal()).toBe(1);
        const observed = await observer.listByCaseId(envelope.caseId);
        expect(observed[0]?.eventId).toBe(envelope.eventId);

        await observer.shutdown();
        await writer.shutdown();
      });
    });

    describe("category P4: health check and persistence details", () => {
      it("test_health_check_details_include_database_path_and_schema_version_and_lifecycle", async () => {
        const adapter = await factory(session);
        await adapter.init();
        const status = await adapter.healthCheck();
        expect(status.details["databasePath"]).toBe(session.databasePath);
        expect(status.details["schemaVersion"]).toBe("1.0.0");
        expect(status.details["lifecycle"]).toBe("running");
        await adapter.shutdown();
      });

      it("test_health_check_on_unreachable_database_path_returns_healthy_false_without_throwing", async () => {
        const badSession: PersistentTestSession = {
          databasePath: "/this/path/does/not/exist/and/cannot/be/created.sqlite"
        };
        const adapter = await factory(badSession);
        await expect(adapter.init()).rejects.toThrow();
        const status = await adapter.healthCheck();
        expect(status.healthy).toBe(false);
      });
    });
  });
};
