import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMockDownstreamServer, type MockDownstreamServer } from "@tianqi/adapter-testkit";
import { createPositionAccountId, createPositionId, createPositionSize } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import { createPositionEngineHttp } from "./position-engine-http.js";

// Convention L revised: 10 it-blocks in 3 segments — 3 identity + 5 positive
// (one per business method) + 2 error. Same shape as Step 15's margin-engine-http
// own tests; nothing here duplicates a Step 13 contract assertion.

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await createMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

afterEach(() => {
  mock.reset();
});

const buildAdapter = () =>
  createPositionEngineHttp({
    baseUrl: mock.url,
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 1 },
    circuitBreaker: { threshold: 10, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  });

// -- Segment 1: Adapter identity ----------------------------------------------------

describe("position-engine-http — Adapter identity", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    expect(() =>
      createPositionEngineHttp({
        // @ts-expect-error baseUrl required
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_object_keys_exposes_position_port_methods_plus_foundation_no_extras", () => {
    const adapter = createPositionEngineHttp({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      // PositionEnginePort:
      "queryPosition",
      "openPosition",
      "adjustPosition",
      "closePosition",
      "listOpenPositions",
      // META-RULE P pass-through:
      "call",
      // ExternalEngineContractProbe:
      "getCircuitBreakerState",
      "getCurrentConcurrency",
      "getPeakConcurrency",
      "getLastTraceId",
      "getRetryStats",
      "getLastCircuitTransitionAt"
    ]);
    expect(new Set(Object.keys(adapter))).toEqual(expected);
  });

  it("test_base_adapter_is_properly_consumed_via_probe_delegation", async () => {
    const adapter = buildAdapter();
    await adapter.init();
    try {
      expect(adapter.getCircuitBreakerState()).toBe("closed");
      expect(adapter.getCurrentConcurrency()).toBe(0);
      expect(adapter.getLastTraceId()).toBeNull();
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 2: Business method positive paths --------------------------------------

describe("position-engine-http — Business methods (positive)", () => {
  it("test_query_position_sends_post_to_query_position_path", async () => {
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-001",
      symbol: "BTC-USDT",
      positionId: "pos-7",
      side: "long",
      size: 1.5,
      queriedAt: "2026-04-25T00:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryPosition({
        accountId: createPositionAccountId("acct-001"),
        symbol: "BTC-USDT"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.positionId).toBe("pos-7");
      expect(result.value.side).toBe("long");
      expect(mock.getLastRequestPath()).toBe("/query-position");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_open_position_sends_post_to_open_position_path_with_serialized_payload", async () => {
    mock.nextResponseWillReturnJson(200, {
      positionId: "pos-9",
      accountId: "acct-002",
      symbol: "ETH-USDT",
      side: "short",
      size: 2,
      openedAt: "2026-04-25T00:01:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.openPosition({
        accountId: createPositionAccountId("acct-002"),
        symbol: "ETH-USDT",
        side: "short",
        size: createPositionSize(2),
        idempotencyKey: "idem-open-1"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.positionId).toBe("pos-9");
      expect(mock.getLastRequestPath()).toBe("/open-position");
      const body = mock.getLastRequestBody();
      expect(body).not.toBeNull();
      const parsed = JSON.parse(body as string);
      expect(parsed.symbol).toBe("ETH-USDT");
      expect(parsed.side).toBe("short");
      expect(parsed.size).toBe(2);
      expect(parsed.idempotencyKey).toBe("idem-open-1");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_adjust_position_propagates_trace_header_to_downstream", async () => {
    mock.nextResponseWillReturnJson(200, {
      positionId: "pos-9",
      side: "short",
      size: 3,
      adjustedAt: "2026-04-25T00:02:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const trace = createTraceId("trace-adjust-1");
      const result = await adapter.adjustPosition({
        positionId: createPositionId("pos-9"),
        deltaSize: 1,
        idempotencyKey: "idem-adj-1",
        traceId: trace
      });
      expect(result.ok).toBe(true);
      expect(mock.getLastRequestHeader("x-tianqi-trace-id")).toBe("trace-adjust-1");
      expect(mock.getLastRequestPath()).toBe("/adjust-position");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_close_position_returns_parsed_closed_size_and_timestamp", async () => {
    mock.nextResponseWillReturnJson(200, {
      positionId: "pos-9",
      closedSize: 3,
      closedAt: "2026-04-25T00:03:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.closePosition({
        positionId: createPositionId("pos-9"),
        idempotencyKey: "idem-close-1"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.closedSize).toBe(3);
      expect(mock.getLastRequestPath()).toBe("/close-position");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_list_open_positions_parses_array_response_strictly", async () => {
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-001",
      queriedAt: "2026-04-25T00:04:00.000Z",
      positions: [
        { positionId: "pos-1", symbol: "BTC-USDT", side: "long", size: 1 },
        { positionId: "pos-2", symbol: "ETH-USDT", side: "short", size: 2 }
      ]
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.listOpenPositions({
        accountId: createPositionAccountId("acct-001")
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.positions).toHaveLength(2);
      expect(result.value.positions[0]?.positionId).toBe("pos-1");
      expect(result.value.positions[1]?.side).toBe("short");
      expect(mock.getLastRequestPath()).toBe("/list-open-positions");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 3: Business method error paths -----------------------------------------

describe("position-engine-http — Business methods (error paths)", () => {
  it("test_downstream_non_retryable_4xx_translates_to_tq_inf_017_no_raw_status", async () => {
    mock.nextResponseWillFail(false); // 403
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryPosition({
        accountId: createPositionAccountId("acct-001"),
        symbol: "BTC-USDT"
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-INF-017");
      expect(result.error.context["adapterName"]).toBe("position-engine-http");
      const serialised = JSON.stringify(result.error);
      expect(serialised).not.toMatch(/\b[45]\d\d\b/);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_malformed_response_body_raises_tq_con_011_with_field_reason", async () => {
    // 200 OK but `side` is not "long"|"short" — strict parser rejects.
    mock.nextResponseWillReturnJson(200, {
      positionId: "pos-9",
      accountId: "acct-002",
      symbol: "ETH-USDT",
      side: "invalid_side",
      size: 1,
      openedAt: "2026-04-25T00:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.openPosition({
        accountId: createPositionAccountId("acct-002"),
        symbol: "ETH-USDT",
        side: "long",
        size: createPositionSize(1),
        idempotencyKey: "idem-bad-1"
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-CON-011");
      expect(result.error.context["operation"]).toBe("open-position");
      expect(result.error.context["fieldPath"]).toBe("side");
      expect(result.error.context["reason"]).toBe("side_must_be_long_or_short");
    } finally {
      await adapter.shutdown();
    }
  });
});
