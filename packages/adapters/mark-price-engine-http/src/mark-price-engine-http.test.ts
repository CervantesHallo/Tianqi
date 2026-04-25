import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMockDownstreamServer, type MockDownstreamServer } from "@tianqi/adapter-testkit";
import { createTraceId } from "@tianqi/shared";

import { createMarkPriceEngineHttp } from "./mark-price-engine-http.js";

// Convention L revised, **弹性应用**: 8 it-blocks in 3 segments — 3 identity + 3
// positive (one per business method) + 2 error. With only 3 business methods the
// positive segment uses 3 of the 5 available slots; the remaining 2 slots stay
// unused by design. Tianqi 宗旨 "克制 > 堆砌"——读取型 Engine 业务方法少，自有
// 测试相应少 = 正确的精炼，不是测试覆盖不足。21 contract it 已经在另一个文件覆盖
// 全部稳定性场景；这里只验本 Engine 独有的业务方法 wire 与错误转译。

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
  createMarkPriceEngineHttp({
    baseUrl: mock.url,
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 1 },
    circuitBreaker: { threshold: 10, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  });

// -- Segment 1: Adapter identity ----------------------------------------------------

describe("mark-price-engine-http — Adapter identity", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    expect(() =>
      createMarkPriceEngineHttp({
        // @ts-expect-error baseUrl required
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_object_keys_exposes_mark_price_port_methods_plus_foundation_no_extras", () => {
    const adapter = createMarkPriceEngineHttp({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      // MarkPriceEnginePort:
      "queryMarkPrice",
      "queryMarkPriceBatch",
      "queryFundingRate",
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

describe("mark-price-engine-http — Business methods (positive)", () => {
  it("test_query_mark_price_sends_post_to_query_mark_price_path_with_serialized_payload", async () => {
    mock.nextResponseWillReturnJson(200, {
      symbol: "BTC-USDT",
      markPrice: 65_123.5,
      queriedAt: "2026-04-25T02:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarkPrice({ symbol: "BTC-USDT" });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.symbol).toBe("BTC-USDT");
      expect(result.value.markPrice).toBe(65_123.5);
      expect(mock.getLastRequestPath()).toBe("/query-mark-price");
      const body = mock.getLastRequestBody();
      const parsed = JSON.parse(body as string);
      expect(parsed.symbol).toBe("BTC-USDT");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_mark_price_batch_parses_array_response_strictly", async () => {
    mock.nextResponseWillReturnJson(200, {
      queriedAt: "2026-04-25T02:01:00.000Z",
      prices: [
        { symbol: "BTC-USDT", markPrice: 65_000 },
        { symbol: "ETH-USDT", markPrice: 3_200.25 },
        { symbol: "SOL-USDT", markPrice: 145.1 }
      ]
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarkPriceBatch({
        symbols: ["BTC-USDT", "ETH-USDT", "SOL-USDT"]
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.prices).toHaveLength(3);
      expect(result.value.prices[0]?.symbol).toBe("BTC-USDT");
      expect(result.value.prices[2]?.markPrice).toBe(145.1);
      expect(mock.getLastRequestPath()).toBe("/query-mark-price-batch");
      const body = mock.getLastRequestBody();
      const parsed = JSON.parse(body as string);
      expect(parsed.symbols).toEqual(["BTC-USDT", "ETH-USDT", "SOL-USDT"]);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_funding_rate_propagates_trace_header_and_parses_negative_rate", async () => {
    // FundingRate 可负——多空力量博弈的常态。本测试同时验证 trace 透传 + 负值
    // parser 接受路径，避免 requireFiniteNumber 与 requirePositiveNumber 混用回归。
    mock.nextResponseWillReturnJson(200, {
      symbol: "BTC-USDT",
      fundingRate: -0.000125,
      fundingTime: "2026-04-25T08:00:00.000Z",
      queriedAt: "2026-04-25T02:02:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const trace = createTraceId("trace-funding-1");
      const result = await adapter.queryFundingRate({
        symbol: "BTC-USDT",
        traceId: trace
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.fundingRate).toBe(-0.000125);
      expect(mock.getLastRequestHeader("x-tianqi-trace-id")).toBe("trace-funding-1");
      expect(mock.getLastRequestPath()).toBe("/query-funding-rate");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 3: Business method error paths -----------------------------------------

describe("mark-price-engine-http — Business methods (error paths)", () => {
  it("test_downstream_non_retryable_4xx_translates_to_tq_inf_017_no_raw_status", async () => {
    mock.nextResponseWillFail(false); // 403
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarkPrice({ symbol: "BTC-USDT" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-INF-017");
      expect(result.error.context["adapterName"]).toBe("mark-price-engine-http");
      const serialised = JSON.stringify(result.error);
      expect(serialised).not.toMatch(/\b[45]\d\d\b/);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_malformed_response_body_raises_tq_con_013_with_field_reason", async () => {
    // 200 OK but markPrice 是 0——TQ-CON-013 with reason "missing_or_non_positive_number"。
    // 这是 MarkPrice 引擎与 Margin/Position 数值校验语义的关键差异：标记价不允许 0。
    mock.nextResponseWillReturnJson(200, {
      symbol: "BTC-USDT",
      markPrice: 0,
      queriedAt: "2026-04-25T02:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarkPrice({ symbol: "BTC-USDT" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-CON-013");
      expect(result.error.context["operation"]).toBe("query-mark-price");
      expect(result.error.context["fieldPath"]).toBe("markPrice");
      expect(result.error.context["reason"]).toBe("missing_or_non_positive_number");
    } finally {
      await adapter.shutdown();
    }
  });
});
