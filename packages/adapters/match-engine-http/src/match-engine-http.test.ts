import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMockDownstreamServer, type MockDownstreamServer } from "@tianqi/adapter-testkit";
import { createMatchAccountId, createOrderId } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import { createMatchEngineHttp } from "./match-engine-http.js";

// Convention L revised: 10 it-blocks in 3 segments — 3 identity + 5 positive
// (one per business method) + 2 error. Identical structure to the Margin /
// Position business adapters' own tests.

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
  createMatchEngineHttp({
    baseUrl: mock.url,
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 1 },
    circuitBreaker: { threshold: 10, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  });

// -- Segment 1: Adapter identity ----------------------------------------------------

describe("match-engine-http — Adapter identity", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    expect(() =>
      createMatchEngineHttp({
        // @ts-expect-error baseUrl required
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_object_keys_exposes_match_port_methods_plus_foundation_no_extras", () => {
    const adapter = createMatchEngineHttp({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      // MatchEnginePort:
      "placeOrder",
      "cancelOrder",
      "queryOrder",
      "listActiveOrders",
      "queryTrades",
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

describe("match-engine-http — Business methods (positive)", () => {
  it("test_place_order_sends_post_to_place_order_path_with_serialized_payload", async () => {
    mock.nextResponseWillReturnJson(200, {
      orderId: "ord-1",
      status: "pending",
      placedAt: "2026-04-25T01:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.placeOrder({
        accountId: createMatchAccountId("acct-A"),
        symbol: "BTC-USDT",
        side: "buy",
        type: "limit",
        quantity: 0.5,
        price: 65_000,
        idempotencyKey: "idem-place-1"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.orderId).toBe("ord-1");
      expect(result.value.status).toBe("pending");
      expect(mock.getLastRequestPath()).toBe("/place-order");
      const body = mock.getLastRequestBody();
      const parsed = JSON.parse(body as string);
      expect(parsed.symbol).toBe("BTC-USDT");
      expect(parsed.side).toBe("buy");
      expect(parsed.type).toBe("limit");
      expect(parsed.quantity).toBe(0.5);
      expect(parsed.price).toBe(65_000);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_cancel_order_returns_parsed_status_on_2xx", async () => {
    mock.nextResponseWillReturnJson(200, {
      orderId: "ord-1",
      status: "cancelled",
      cancelledAt: "2026-04-25T01:01:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.cancelOrder({
        orderId: createOrderId("ord-1"),
        idempotencyKey: "idem-cancel-1"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.status).toBe("cancelled");
      expect(mock.getLastRequestPath()).toBe("/cancel-order");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_order_propagates_trace_header_to_downstream", async () => {
    mock.nextResponseWillReturnJson(200, {
      orderId: "ord-1",
      status: "partially_filled",
      side: "buy",
      type: "limit",
      quantity: 1,
      filledQuantity: 0.3,
      remainingQuantity: 0.7,
      queriedAt: "2026-04-25T01:02:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const trace = createTraceId("trace-q-order-1");
      const result = await adapter.queryOrder({
        orderId: createOrderId("ord-1"),
        traceId: trace
      });
      expect(result.ok).toBe(true);
      expect(mock.getLastRequestHeader("x-tianqi-trace-id")).toBe("trace-q-order-1");
      expect(mock.getLastRequestPath()).toBe("/query-order");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_list_active_orders_parses_array_response_strictly", async () => {
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-A",
      queriedAt: "2026-04-25T01:03:00.000Z",
      orders: [
        {
          orderId: "ord-1",
          status: "pending",
          side: "buy",
          type: "limit",
          remainingQuantity: 0.5
        },
        {
          orderId: "ord-2",
          status: "partially_filled",
          side: "sell",
          type: "market",
          remainingQuantity: 1
        }
      ]
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.listActiveOrders({
        accountId: createMatchAccountId("acct-A")
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.orders).toHaveLength(2);
      expect(result.value.orders[0]?.orderId).toBe("ord-1");
      expect(result.value.orders[1]?.type).toBe("market");
      expect(mock.getLastRequestPath()).toBe("/list-active-orders");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_trades_returns_parsed_trade_list", async () => {
    mock.nextResponseWillReturnJson(200, {
      orderId: "ord-1",
      queriedAt: "2026-04-25T01:04:00.000Z",
      trades: [
        {
          tradeId: "trd-1",
          orderId: "ord-1",
          executedQuantity: 0.3,
          executedPrice: 64_900,
          executedAt: "2026-04-25T01:03:30.000Z"
        }
      ]
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryTrades({
        orderId: createOrderId("ord-1")
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.trades).toHaveLength(1);
      expect(result.value.trades[0]?.tradeId).toBe("trd-1");
      expect(result.value.trades[0]?.executedPrice).toBe(64_900);
      expect(mock.getLastRequestPath()).toBe("/query-trades");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 3: Business method error paths -----------------------------------------

describe("match-engine-http — Business methods (error paths)", () => {
  it("test_downstream_non_retryable_4xx_translates_to_tq_inf_017_no_raw_status", async () => {
    mock.nextResponseWillFail(false); // 403
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryOrder({ orderId: createOrderId("ord-1") });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-INF-017");
      expect(result.error.context["adapterName"]).toBe("match-engine-http");
      const serialised = JSON.stringify(result.error);
      expect(serialised).not.toMatch(/\b[45]\d\d\b/);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_malformed_response_body_raises_tq_con_012_with_field_reason", async () => {
    // 200 OK but `status` is an unknown enum value — strict parser rejects.
    mock.nextResponseWillReturnJson(200, {
      orderId: "ord-1",
      status: "unknown_fancy_status",
      placedAt: "2026-04-25T00:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.placeOrder({
        accountId: createMatchAccountId("acct-A"),
        symbol: "BTC-USDT",
        side: "buy",
        type: "limit",
        quantity: 0.5,
        price: 65_000,
        idempotencyKey: "idem-bad-1"
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-CON-012");
      expect(result.error.context["operation"]).toBe("place-order");
      expect(result.error.context["fieldPath"]).toBe("status");
      expect(result.error.context["reason"]).toBe("status_unknown");
    } finally {
      await adapter.shutdown();
    }
  });
});
