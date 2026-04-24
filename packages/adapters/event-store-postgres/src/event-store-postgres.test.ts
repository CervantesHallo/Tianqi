import { env } from "node:process";

import { describe, expect, it } from "vitest";

import { DOMAIN_EVENT_TYPES, createEventVersion } from "@tianqi/contracts";
import { createEventId, createRiskCaseId, createTraceId } from "@tianqi/shared";

import { createPostgresEventStore } from "./event-store-postgres.js";

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const OWN_SCHEMA_PREFIX = `tianqi_step6_own_${RUN_ID}`.toLowerCase();

describe("createPostgresEventStore — adapter-specific invariants", () => {
  it("test_connection_string_required_at_type_layer", () => {
    // @ts-expect-error — connectionString is a required field of PostgresEventStoreOptions
    const adapter = createPostgresEventStore({});
    expect(adapter.adapterName).toBe("event-store-postgres");
  });

  it("test_network_unreachable_init_rejects_with_tq_inf_postgres_unreachable", async () => {
    const adapter = createPostgresEventStore({
      connectionString: "postgres://tianqi_none:secret@127.0.0.1:1/nonexistent",
      connectionTimeoutMs: 500
    });
    await expect(adapter.init()).rejects.toThrow(/TQ-INF-009/);
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    await adapter.shutdown();
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createPostgresEventStore({
      connectionString: "postgres://placeholder:placeholder@127.0.0.1:1/placeholder"
    });
    const expected = new Set([
      "adapterName",
      "__testkitProbe",
      "append",
      "listByCaseId",
      "countTotal",
      "init",
      "shutdown",
      "healthCheck"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });

  it.skipIf(!canReachPostgres)(
    "test_health_check_details_include_pool_stats_and_lifecycle",
    async () => {
      const adapter = createPostgresEventStore({
        connectionString: testUrl ?? "",
        schema: `${OWN_SCHEMA_PREFIX}_pool`
      });
      await adapter.init();
      try {
        const status = await adapter.healthCheck();
        expect(status.details["lifecycle"]).toBe("running");
        expect(status.details["schemaVersion"]).toBe("1.0.0");
        expect(typeof status.details["idleCount"]).toBe("number");
        expect(typeof status.details["totalCount"]).toBe("number");
        expect(typeof status.details["waitingCount"]).toBe("number");
      } finally {
        await adapter.shutdown();
      }
    }
  );

  it.skipIf(!canReachPostgres)(
    "test_health_check_returns_healthy_false_after_shutdown_without_throwing",
    async () => {
      const adapter = createPostgresEventStore({
        connectionString: testUrl ?? "",
        schema: `${OWN_SCHEMA_PREFIX}_shutdown`
      });
      await adapter.init();
      await adapter.shutdown();
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.details["lifecycle"]).toBe("shut_down");
    }
  );

  it.skipIf(!canReachPostgres)("test_concurrent_appends_within_pool_size_succeed", async () => {
    const adapter = createPostgresEventStore({
      connectionString: testUrl ?? "",
      schema: `${OWN_SCHEMA_PREFIX}_concurrent`,
      poolSize: 4
    });
    await adapter.init();
    try {
      const traceId = createTraceId(`trace-concurrent-${RUN_ID}`);
      const caseId = createRiskCaseId(`case-concurrent-${RUN_ID}`);
      const eventVersion = createEventVersion("1.0.0");
      const envelopes = Array.from({ length: 20 }, (_, index) => ({
        eventId: createEventId(`concurrent-${RUN_ID}-${index}`),
        eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
        eventVersion,
        traceId,
        caseId,
        occurredAt: `2026-04-19T12:00:00.${String(index).padStart(3, "0")}Z`,
        producer: "concurrent-test",
        payload: { index },
        metadata: { sourceModule: "concurrent", schemaVersion: "1.0.0" }
      }));
      const results = await Promise.all(envelopes.map((envelope) => adapter.append(envelope)));
      for (const result of results) {
        expect(result.ok).toBe(true);
      }
      expect(await adapter.countTotal()).toBe(20);
    } finally {
      await adapter.shutdown();
    }
  });
});
