import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMockDownstreamServer, type MockDownstreamServer } from "@tianqi/adapter-testkit";
import {
  createMarginAccountId,
  createMarginAmount,
  createMarginCurrency,
  createMarginLockId
} from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import { createMarginEngineHttp } from "./margin-engine-http.js";

// Own tests for @tianqi/margin-engine-http — 9 it-blocks organised into three
// segments per Step 15's Convention L revision for business engines:
//
//   Adapter identity (≤3)     — factory shape, public surface, base integration
//   Business positive path (≤5) — one positive-path it per business method
//   Business error path (≤2)  — §6.5 translation + response schema violation
//
// No stability-contract duplication — retry / circuit breaker / rate limit /
// trace propagation are covered by the Step 13 contract suite mounted in
// margin-engine-http.contract.test.ts. This file exclusively exercises
// dimensions the contract cannot see: Margin-specific request serialisation,
// response parsing, Port-method-to-operation mapping, and the §6.5
// translation at business-method granularity.

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

const validBalanceBody = {
  accountId: "acct-001",
  currency: "USDT",
  availableMargin: 1200.5,
  lockedMargin: 300.25,
  totalMargin: 1500.75,
  queriedAt: "2026-04-25T00:00:00.000Z"
};

const buildAdapter = () =>
  createMarginEngineHttp({
    baseUrl: mock.url,
    // Budgets outside the 400-599 range so §6.5 regex doesn't misclassify
    // legitimate config numbers as leaked HTTP statuses.
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 1 },
    circuitBreaker: { threshold: 10, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  });

// -- Segment 1: Adapter identity ----------------------------------------------------

describe("margin-engine-http — Adapter identity", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    expect(() =>
      createMarginEngineHttp({
        // @ts-expect-error baseUrl required at type layer too
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_object_keys_exposes_margin_port_methods_plus_foundation_no_extras", () => {
    const adapter = createMarginEngineHttp({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      // Business methods (MarginEnginePort):
      "calculateMargin",
      "lockMargin",
      "releaseMargin",
      "queryMarginBalance",
      // TestkitExternalEngineFoundation pass-through:
      "call",
      // ExternalEngineContractProbe getters:
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
    // Probe values must come from the base; the business adapter never
    // maintains a parallel circuit-breaker or concurrency counter. Verify
    // the delegation returns reasonable defaults after init().
    const adapter = buildAdapter();
    await adapter.init();
    try {
      expect(adapter.getCircuitBreakerState()).toBe("closed");
      expect(adapter.getCurrentConcurrency()).toBe(0);
      expect(adapter.getPeakConcurrency()).toBe(0);
      expect(adapter.getLastTraceId()).toBeNull();
      expect(adapter.getLastCircuitTransitionAt()).toBeNull();
      const stats = adapter.getRetryStats();
      expect(typeof stats.attempts).toBe("number");
      expect(typeof stats.maxSeen).toBe("number");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 2: Business method positive paths --------------------------------------

describe("margin-engine-http — Business methods (positive)", () => {
  it("test_calculate_margin_sends_post_to_slash_calculate_margin_with_serialized_payload", async () => {
    mock.nextResponseWillReturnJson(200, {
      requiredMargin: 123.45,
      currency: "USDT",
      calculatedAt: "2026-04-25T00:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.calculateMargin({
        accountId: createMarginAccountId("acct-001"),
        symbol: "BTC-USDT",
        side: "buy",
        quantity: 1.5,
        price: 65_000
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.requiredMargin).toBe(123.45);
      expect(result.value.currency).toBe("USDT");
      expect(mock.getLastRequestPath()).toBe("/calculate-margin");
      // Serialised payload contains all fields the Port declared, in camelCase
      // identical to the public request shape. No hidden renames.
      const body = mock.getLastRequestBody();
      expect(body).not.toBeNull();
      const parsed = JSON.parse(body as string);
      expect(parsed.symbol).toBe("BTC-USDT");
      expect(parsed.side).toBe("buy");
      expect(parsed.quantity).toBe(1.5);
      expect(parsed.price).toBe(65_000);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_lock_margin_returns_parsed_response_with_brandable_lock_id", async () => {
    mock.nextResponseWillReturnJson(200, {
      lockId: "lock-77",
      lockedAmount: 500,
      currency: "USDT",
      lockedAt: "2026-04-25T00:05:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.lockMargin({
        accountId: createMarginAccountId("acct-002"),
        amount: createMarginAmount(500),
        currency: createMarginCurrency("USDT"),
        idempotencyKey: "idem-abc"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.lockId).toBe("lock-77");
      expect(result.value.lockedAmount).toBe(500);
      expect(mock.getLastRequestPath()).toBe("/lock-margin");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_release_margin_propagates_trace_header_to_downstream", async () => {
    mock.nextResponseWillReturnJson(200, {
      lockId: "lock-77",
      releasedAmount: 500,
      releasedAt: "2026-04-25T00:06:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const trace = createTraceId("trace-release-1");
      const result = await adapter.releaseMargin({
        lockId: createMarginLockId("lock-77"),
        idempotencyKey: "idem-rel-1",
        traceId: trace
      });
      expect(result.ok).toBe(true);
      // The base's default trace header name (x-tianqi-trace-id) carries
      // through the business adapter unchanged.
      expect(mock.getLastRequestHeader("x-tianqi-trace-id")).toBe("trace-release-1");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_margin_balance_returns_all_four_balance_fields", async () => {
    mock.nextResponseWillReturnJson(200, validBalanceBody);
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarginBalance({
        accountId: createMarginAccountId("acct-001"),
        currency: createMarginCurrency("USDT")
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.availableMargin).toBe(1200.5);
      expect(result.value.lockedMargin).toBe(300.25);
      expect(result.value.totalMargin).toBe(1500.75);
      expect(result.value.queriedAt).toBe("2026-04-25T00:00:00.000Z");
      expect(mock.getLastRequestPath()).toBe("/query-margin-balance");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 3: Business method error paths -----------------------------------------

describe("margin-engine-http — Business methods (error paths)", () => {
  it("test_downstream_non_retryable_4xx_is_translated_to_tq_inf_017_not_raw_status", async () => {
    mock.nextResponseWillFail(false); // 403 from mock
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarginBalance({
        accountId: createMarginAccountId("acct-001"),
        currency: createMarginCurrency("USDT")
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-INF-017");
      expect(result.error.context["adapterName"]).toBe("margin-engine-http");
      // §6.5 — no raw 403 leak
      const serialised = JSON.stringify(result.error);
      expect(serialised).not.toMatch(/\b[45]\d\d\b/);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_malformed_response_body_raises_tq_con_010_with_field_reason", async () => {
    // Downstream returned 2xx but the body is missing `queriedAt`. The
    // adapter's strict parser surfaces this as TQ-CON-010 with a domain-
    // moniker `reason` rather than swallowing or defaulting the field.
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-001",
      currency: "USDT",
      availableMargin: 1,
      lockedMargin: 1,
      totalMargin: 2
      // queriedAt intentionally missing
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryMarginBalance({
        accountId: createMarginAccountId("acct-001"),
        currency: createMarginCurrency("USDT")
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-CON-010");
      expect(result.error.context["operation"]).toBe("query-margin-balance");
      expect(result.error.context["fieldPath"]).toBe("queriedAt");
      expect(result.error.context["reason"]).toBe("invalid_timestamp");
    } finally {
      await adapter.shutdown();
    }
  });
});
