import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createMockDownstreamServer, type MockDownstreamServer } from "@tianqi/adapter-testkit";
import {
  createFundAccountId,
  createFundAmount,
  createFundCurrency,
  createTransferId
} from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

import { createFundEngineHttp } from "./fund-engine-http.js";

// Convention L revised: 9 it-blocks in 3 segments — 3 identity + 4 positive
// (one per business method) + 2 error. Below the 10-it ceiling by 1 slot;
// the slack stays unused (Tianqi 宗旨 "克制 > 堆砌"). 21 contract it run in
// the sibling .contract.test.ts file.

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
  createFundEngineHttp({
    baseUrl: mock.url,
    timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 },
    retry: { maxAttempts: 1 },
    circuitBreaker: { threshold: 10, resetTimeoutMs: 100 },
    rateLimit: { maxConcurrency: 5 },
    healthCheckTimeoutMs: 300
  });

// -- Segment 1: Adapter identity ----------------------------------------------------

describe("fund-engine-http — Adapter identity", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    expect(() =>
      createFundEngineHttp({
        // @ts-expect-error baseUrl required
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_object_keys_exposes_fund_port_methods_plus_foundation_no_extras", () => {
    const adapter = createFundEngineHttp({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      // FundEnginePort:
      "queryFundBalance",
      "queryFundLedger",
      "transferFund",
      "queryTransferStatus",
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

describe("fund-engine-http — Business methods (positive)", () => {
  it("test_query_fund_balance_returns_three_balance_fields", async () => {
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-A",
      currency: "USDT",
      totalBalance: 10_000,
      availableBalance: 7_500,
      frozenBalance: 2_500,
      queriedAt: "2026-04-25T03:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryFundBalance({
        accountId: createFundAccountId("acct-A"),
        currency: createFundCurrency("USDT")
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.totalBalance).toBe(10_000);
      expect(result.value.availableBalance).toBe(7_500);
      expect(result.value.frozenBalance).toBe(2_500);
      expect(mock.getLastRequestPath()).toBe("/query-fund-balance");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_fund_ledger_parses_typed_entry_array_strictly", async () => {
    mock.nextResponseWillReturnJson(200, {
      accountId: "acct-A",
      currency: "USDT",
      queriedAt: "2026-04-25T03:01:00.000Z",
      entries: [
        {
          entryId: "ledger-1",
          type: "deposit",
          amount: 5_000,
          balanceAfter: 5_000,
          entryAt: "2026-04-25T01:00:00.000Z"
        },
        {
          entryId: "ledger-2",
          type: "trade",
          amount: 100,
          balanceAfter: 4_900,
          entryAt: "2026-04-25T02:00:00.000Z"
        }
      ]
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryFundLedger({
        accountId: createFundAccountId("acct-A"),
        currency: createFundCurrency("USDT"),
        limit: 50
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.entries).toHaveLength(2);
      expect(result.value.entries[0]?.type).toBe("deposit");
      expect(result.value.entries[1]?.balanceAfter).toBe(4_900);
      expect(mock.getLastRequestPath()).toBe("/query-fund-ledger");
      const body = mock.getLastRequestBody();
      const parsed = JSON.parse(body as string);
      expect(parsed.limit).toBe(50);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_transfer_fund_sends_post_with_idempotency_key_and_serialized_payload", async () => {
    mock.nextResponseWillReturnJson(200, {
      transferId: "trf-1",
      status: "pending",
      transferredAt: "2026-04-25T03:02:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.transferFund({
        fromAccountId: createFundAccountId("acct-A"),
        toAccountId: createFundAccountId("acct-B"),
        currency: createFundCurrency("USDT"),
        amount: createFundAmount(500),
        idempotencyKey: "idem-tr-1"
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.transferId).toBe("trf-1");
      expect(result.value.status).toBe("pending");
      expect(mock.getLastRequestPath()).toBe("/transfer-fund");
      const body = mock.getLastRequestBody();
      const parsed = JSON.parse(body as string);
      expect(parsed.fromAccountId).toBe("acct-A");
      expect(parsed.toAccountId).toBe("acct-B");
      expect(parsed.amount).toBe(500);
      expect(parsed.idempotencyKey).toBe("idem-tr-1");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_query_transfer_status_propagates_trace_header_to_downstream", async () => {
    mock.nextResponseWillReturnJson(200, {
      transferId: "trf-1",
      status: "completed",
      transferredAt: "2026-04-25T03:03:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const trace = createTraceId("trace-trf-1");
      const result = await adapter.queryTransferStatus({
        transferId: createTransferId("trf-1"),
        traceId: trace
      });
      expect(result.ok).toBe(true);
      expect(mock.getLastRequestHeader("x-tianqi-trace-id")).toBe("trace-trf-1");
      expect(mock.getLastRequestPath()).toBe("/query-transfer-status");
    } finally {
      await adapter.shutdown();
    }
  });
});

// -- Segment 3: Business method error paths -----------------------------------------

describe("fund-engine-http — Business methods (error paths)", () => {
  it("test_downstream_non_retryable_4xx_translates_to_tq_inf_017_no_raw_status", async () => {
    mock.nextResponseWillFail(false); // 403
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.queryFundBalance({
        accountId: createFundAccountId("acct-A"),
        currency: createFundCurrency("USDT")
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-INF-017");
      expect(result.error.context["adapterName"]).toBe("fund-engine-http");
      const serialised = JSON.stringify(result.error);
      expect(serialised).not.toMatch(/\b[45]\d\d\b/);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_malformed_response_body_raises_tq_con_014_with_field_reason", async () => {
    // 200 OK but transfer status is unknown enum value — strict parser rejects
    // with reason "transfer_status_unknown"。这是 Fund 引擎 enum validator 与
    // 既有 Match 引擎 OrderStatus 的同模式但独立实现。
    mock.nextResponseWillReturnJson(200, {
      transferId: "trf-1",
      status: "fancy_unknown_state",
      transferredAt: "2026-04-25T03:00:00.000Z"
    });
    const adapter = buildAdapter();
    await adapter.init();
    try {
      const result = await adapter.transferFund({
        fromAccountId: createFundAccountId("acct-A"),
        toAccountId: createFundAccountId("acct-B"),
        currency: createFundCurrency("USDT"),
        amount: createFundAmount(100),
        idempotencyKey: "idem-bad-1"
      });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("TQ-CON-014");
      expect(result.error.context["operation"]).toBe("transfer-fund");
      expect(result.error.context["fieldPath"]).toBe("status");
      expect(result.error.context["reason"]).toBe("transfer_status_unknown");
    } finally {
      await adapter.shutdown();
    }
  });
});
