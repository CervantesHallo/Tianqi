import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DomainEventEnvelope } from "@tianqi/contracts";
import { DOMAIN_EVENT_TYPES, createEventVersion } from "@tianqi/contracts";
import type { AdapterFoundation, EventStorePort } from "@tianqi/ports";
import { createEventId, createRiskCaseId, createTraceId } from "@tianqi/shared";
import type { EventId, RiskCaseId } from "@tianqi/shared";

import type { EventStoreContractProbe } from "./event-store-contract-probe.js";

export type EventStoreAdapterUnderTest = EventStorePort &
  AdapterFoundation &
  EventStoreContractProbe;

export type EventStoreAdapterFactory<
  T extends EventStoreAdapterUnderTest = EventStoreAdapterUnderTest
> = () => T | Promise<T>;

export type EventStoreContractOptions = Readonly<Record<string, never>>;

type SamplePayload = Record<string, unknown>;

type SampleEnvelopeOverrides = {
  readonly eventId?: EventId;
  readonly occurredAt?: string;
  readonly caseId?: RiskCaseId;
  readonly payload?: SamplePayload;
};

const DEFAULT_CASE_ID = createRiskCaseId("case-contract-1");
const DEFAULT_TRACE_ID = createTraceId("trace-contract-1");
const DEFAULT_EVENT_VERSION = createEventVersion("1.0.0");

const buildSampleEnvelope = (
  suffix: string,
  overrides: SampleEnvelopeOverrides = {}
): DomainEventEnvelope<SamplePayload> => ({
  eventId: overrides.eventId ?? createEventId(`evt-${suffix}`),
  eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
  eventVersion: DEFAULT_EVENT_VERSION,
  traceId: DEFAULT_TRACE_ID,
  caseId: overrides.caseId ?? DEFAULT_CASE_ID,
  occurredAt: overrides.occurredAt ?? "2026-04-19T12:00:00.000Z",
  producer: "adapter-testkit",
  payload: overrides.payload ?? { kind: "sample" },
  metadata: {
    sourceModule: "adapter-testkit",
    schemaVersion: "1.0.0"
  }
});

const assertAppendOk = async (
  adapter: EventStoreAdapterUnderTest,
  envelope: DomainEventEnvelope<SamplePayload>
): Promise<void> => {
  const result = await adapter.append(envelope);
  if (!result.ok) {
    throw new Error(`expected append to succeed but got error: ${result.error.message}`);
  }
};

export const defineEventStoreContractTests = <
  T extends EventStoreAdapterUnderTest = EventStoreAdapterUnderTest
>(
  adapterName: string,
  factory: EventStoreAdapterFactory<T>,
  _options?: EventStoreContractOptions
): void => {
  describe(`[adapter-testkit] EventStore contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.shutdown();
    });

    describe("category 1: idempotency", () => {
      it("test_append_with_duplicate_event_id_is_idempotent_and_preserves_first_write", async () => {
        const envelope = buildSampleEnvelope("idem-1");
        await assertAppendOk(adapter, envelope);
        const secondResult = await adapter.append({
          ...envelope,
          payload: { kind: "second-attempt" }
        });
        expect(secondResult.ok).toBe(true);
        const stored = await adapter.listByCaseId(envelope.caseId);
        expect(stored).toHaveLength(1);
        expect(stored[0]?.payload).toEqual({ kind: "sample" });
      });

      it("test_append_with_same_event_id_repeated_many_times_converges_to_single_entry", async () => {
        const envelope = buildSampleEnvelope("idem-2");
        for (let i = 0; i < 5; i += 1) {
          const result = await adapter.append(envelope);
          expect(result.ok).toBe(true);
        }
        const stored = await adapter.listByCaseId(envelope.caseId);
        expect(stored).toHaveLength(1);
      });

      it("test_idempotency_does_not_depend_on_append_ordering", async () => {
        const earlyArriving = buildSampleEnvelope("idem-3", {
          occurredAt: "2026-04-19T12:00:00.000Z"
        });
        const lateArrivingSameId: DomainEventEnvelope<SamplePayload> = {
          ...earlyArriving,
          occurredAt: "2026-04-19T11:00:00.000Z",
          payload: { kind: "late-duplicate" }
        };
        await assertAppendOk(adapter, earlyArriving);
        const duplicateResult = await adapter.append(lateArrivingSameId);
        expect(duplicateResult.ok).toBe(true);
        const stored = await adapter.listByCaseId(earlyArriving.caseId);
        expect(stored).toHaveLength(1);
        expect(stored[0]?.payload).toEqual({ kind: "sample" });
        expect(stored[0]?.occurredAt).toBe("2026-04-19T12:00:00.000Z");
      });
    });

    describe("category 2: atomicity", () => {
      it("test_append_of_invalid_event_leaves_store_unchanged", async () => {
        const invalid = {
          ...buildSampleEnvelope("atom-1"),
          eventId: "" as EventId
        } satisfies DomainEventEnvelope<SamplePayload>;
        const before = await adapter.countTotal();
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        const after = await adapter.countTotal();
        expect(after).toBe(before);
      });

      it("test_invalid_event_returns_structured_error_in_tq_con_namespace", async () => {
        const invalid = {
          ...buildSampleEnvelope("atom-2"),
          occurredAt: "2026/04/19"
        } satisfies DomainEventEnvelope<SamplePayload>;
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005:/);
      });

      it("test_append_of_valid_event_increases_total_count_by_exactly_one", async () => {
        const envelope = buildSampleEnvelope("atom-3");
        const before = await adapter.countTotal();
        await assertAppendOk(adapter, envelope);
        const after = await adapter.countTotal();
        expect(after - before).toBe(1);
      });
    });

    describe("category 3: read ordering", () => {
      it("test_list_by_case_returns_events_sorted_by_occurred_at_ascending", async () => {
        const caseId = createRiskCaseId("case-ord-1");
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-1a", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.200Z"
          })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-1b", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.100Z"
          })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-1c", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.300Z"
          })
        );
        const stored = await adapter.listByCaseId(caseId);
        const timestamps = stored.map((event) => event.occurredAt);
        expect(timestamps).toEqual([
          "2026-04-19T12:00:00.100Z",
          "2026-04-19T12:00:00.200Z",
          "2026-04-19T12:00:00.300Z"
        ]);
      });

      it("test_events_with_equal_occurred_at_use_append_order_as_tiebreaker", async () => {
        const caseId = createRiskCaseId("case-ord-2");
        const sharedTimestamp = "2026-04-19T12:00:00.000Z";
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-2a", { caseId, occurredAt: sharedTimestamp })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-2b", { caseId, occurredAt: sharedTimestamp })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-2c", { caseId, occurredAt: sharedTimestamp })
        );
        const stored = await adapter.listByCaseId(caseId);
        expect(stored.map((event) => event.eventId)).toEqual([
          "evt-ord-2a",
          "evt-ord-2b",
          "evt-ord-2c"
        ]);
      });

      it("test_out_of_order_write_does_not_break_read_order", async () => {
        const caseId = createRiskCaseId("case-ord-3");
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-3-late-event", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.900Z"
          })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-3-middle-event", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.500Z"
          })
        );
        await assertAppendOk(
          adapter,
          buildSampleEnvelope("ord-3-early-event", {
            caseId,
            occurredAt: "2026-04-19T12:00:00.100Z"
          })
        );
        const stored = await adapter.listByCaseId(caseId);
        expect(stored.map((event) => event.eventId)).toEqual([
          "evt-ord-3-early-event",
          "evt-ord-3-middle-event",
          "evt-ord-3-late-event"
        ]);
      });
    });

    describe("category 4: concurrency", () => {
      it("test_concurrent_append_for_same_case_converges_without_loss", async () => {
        const caseId = createRiskCaseId("case-con-1");
        const envelopes = Array.from({ length: 20 }, (_, index) =>
          buildSampleEnvelope(`con-1-${index}`, {
            caseId,
            occurredAt: `2026-04-19T12:00:00.${String(index).padStart(3, "0")}Z`
          })
        );
        const results = await Promise.all(envelopes.map((envelope) => adapter.append(envelope)));
        for (const result of results) {
          expect(result.ok).toBe(true);
        }
        const stored = await adapter.listByCaseId(caseId);
        expect(stored).toHaveLength(20);
        const storedIds = new Set(stored.map((event) => event.eventId));
        expect(storedIds.size).toBe(20);
      });

      it("test_concurrent_append_across_cases_is_independent", async () => {
        const caseA = createRiskCaseId("case-con-2a");
        const caseB = createRiskCaseId("case-con-2b");
        const envelopesA = Array.from({ length: 10 }, (_, index) =>
          buildSampleEnvelope(`con-2a-${index}`, { caseId: caseA })
        );
        const envelopesB = Array.from({ length: 10 }, (_, index) =>
          buildSampleEnvelope(`con-2b-${index}`, { caseId: caseB })
        );
        await Promise.all([
          ...envelopesA.map((envelope) => adapter.append(envelope)),
          ...envelopesB.map((envelope) => adapter.append(envelope))
        ]);
        const storedA = await adapter.listByCaseId(caseA);
        const storedB = await adapter.listByCaseId(caseB);
        expect(storedA).toHaveLength(10);
        expect(storedB).toHaveLength(10);
        for (const event of storedA) {
          expect(event.caseId).toBe(caseA);
        }
        for (const event of storedB) {
          expect(event.caseId).toBe(caseB);
        }
      });
    });

    describe("category 5: schema validation", () => {
      it("test_append_with_empty_event_id_rejects_with_tq_con_schema_violation", async () => {
        const invalid = {
          ...buildSampleEnvelope("sch-1"),
          eventId: "" as EventId
        } satisfies DomainEventEnvelope<SamplePayload>;
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005: eventId/);
      });

      it("test_append_with_non_iso_8601_occurred_at_rejects_with_tq_con_schema_violation", async () => {
        const invalid = {
          ...buildSampleEnvelope("sch-2"),
          occurredAt: "2026/04/19 12:00"
        } satisfies DomainEventEnvelope<SamplePayload>;
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005: occurredAt/);
      });

      it("test_append_with_invalid_event_version_rejects_with_tq_con_schema_violation", async () => {
        const invalid = {
          ...buildSampleEnvelope("sch-3"),
          eventVersion: "v1" as DomainEventEnvelope<SamplePayload>["eventVersion"]
        } satisfies DomainEventEnvelope<SamplePayload>;
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005: eventVersion/);
      });

      it("test_append_with_missing_metadata_source_module_rejects_with_tq_con_schema_violation", async () => {
        const base = buildSampleEnvelope("sch-4");
        const invalid = {
          ...base,
          metadata: { ...base.metadata, sourceModule: "" }
        } satisfies DomainEventEnvelope<SamplePayload>;
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005: metadata.sourceModule/);
      });

      it("test_append_with_non_serializable_metadata_value_rejects_with_tq_con_schema_violation", async () => {
        const base = buildSampleEnvelope("sch-5");
        const malformedMetadata: Record<string, unknown> = {
          ...base.metadata,
          smuggledField: () => "function-value"
        };
        const invalid = {
          ...base,
          metadata: malformedMetadata as unknown as DomainEventEnvelope<SamplePayload>["metadata"]
        };
        const result = await adapter.append(invalid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-CON-005: metadata\./);
      });
    });

    describe("category 6: integration with AdapterFoundation", () => {
      it("test_append_before_init_rejects_with_tq_inf_not_initialized", async () => {
        const freshAdapter = await factory();
        const envelope = buildSampleEnvelope("int-1");
        const result = await freshAdapter.append(envelope);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-003:/);
      });

      it("test_append_after_shutdown_rejects_with_tq_inf_already_shut_down", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        await freshAdapter.shutdown();
        const envelope = buildSampleEnvelope("int-2");
        const result = await freshAdapter.append(envelope);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-004:/);
      });

      it("test_health_check_reports_healthy_true_after_init_and_false_after_shutdown_without_throwing", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        const healthyStatus = await freshAdapter.healthCheck();
        expect(healthyStatus.healthy).toBe(true);
        expect(typeof healthyStatus.checkedAt).toBe("string");
        await freshAdapter.shutdown();
        const unhealthyStatus = await freshAdapter.healthCheck();
        expect(unhealthyStatus.healthy).toBe(false);
        expect(typeof unhealthyStatus.checkedAt).toBe("string");
      });

      it("test_repeat_init_and_repeat_shutdown_are_both_idempotent", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        await freshAdapter.init();
        await freshAdapter.init();
        await freshAdapter.shutdown();
        await freshAdapter.shutdown();
        const status = await freshAdapter.healthCheck();
        expect(status.healthy).toBe(false);
      });

      it("test_count_total_matches_sum_of_per_case_list_across_multiple_cases", async () => {
        const caseA = createRiskCaseId("case-int-count-a");
        const caseB = createRiskCaseId("case-int-count-b");
        await assertAppendOk(adapter, buildSampleEnvelope("int-count-a1", { caseId: caseA }));
        await assertAppendOk(adapter, buildSampleEnvelope("int-count-a2", { caseId: caseA }));
        await assertAppendOk(adapter, buildSampleEnvelope("int-count-b1", { caseId: caseB }));
        const countedTotal = await adapter.countTotal();
        const listedA = await adapter.listByCaseId(caseA);
        const listedB = await adapter.listByCaseId(caseB);
        expect(countedTotal).toBeGreaterThanOrEqual(listedA.length + listedB.length);
      });
    });
  });
};
