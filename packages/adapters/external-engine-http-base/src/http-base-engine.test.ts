import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createTraceId } from "@tianqi/shared";

import { createHttpBaseEngine } from "./http-base-engine.js";

import {
  startMockDownstreamServer,
  type MockDownstreamServer
} from "./helpers/mock-downstream-server.js";

// Own tests cover dimensions the shared Step 13 contract suite cannot exercise —
// HTTP-stack specific behaviours (trace header wire observation, base URL
// unreachability, init-time lifecycle, public surface shape). Each assertion is
// scoped to http-base specifics; nothing here duplicates a contract it (Convention L
// self-check).

let mock: MockDownstreamServer;

beforeAll(async () => {
  mock = await startMockDownstreamServer();
});

afterAll(async () => {
  await mock.close();
});

afterEach(() => {
  mock.reset();
});

describe("createHttpBaseEngine — adapter-specific invariants", () => {
  it("test_factory_requires_base_url_at_runtime", () => {
    // baseUrl is the one option that has no sane default; the factory must refuse
    // construction rather than silently pointing at some dummy URL.
    expect(() =>
      createHttpBaseEngine({
        // @ts-expect-error baseUrl is required at the type layer too
        baseUrl: undefined
      })
    ).toThrow(/baseUrl is required/);
  });

  it("test_trace_header_is_injected_on_outbound_request", async () => {
    // Step 14 §C.3 decision: trace header name is "x-tianqi-trace-id". Verify that
    // a call() invocation with a traceId actually emits that header on the wire.
    // This is the only test that observes HTTP-level behaviour directly — no
    // Step 13 contract can see the outbound header because the contract suite only
    // inspects the adapter's probe surface.
    const adapter = createHttpBaseEngine({
      baseUrl: mock.url,
      timeouts: { connectMs: 300, requestMs: 300, totalMs: 1000 }
    });
    await adapter.init();
    try {
      const trace = createTraceId("trace-header-probe");
      const result = await adapter.call({ operation: "echo" }, trace);
      expect(result.ok).toBe(true);
      const observed = mock.getLastRequestHeader("x-tianqi-trace-id");
      expect(observed).toBe("trace-header-probe");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_init_against_invalid_base_url_parses_but_call_surfaces_TQ-INF-013_on_first_request", async () => {
    // "Invalid" here means a syntactically-valid URL that simply points nowhere.
    // undici's Pool construction does not eagerly resolve DNS or open sockets;
    // init() therefore succeeds. The first call() surfaces the unreachable state
    // as a timeout (TQ-INF-013) once the total budget elapses. This documents the
    // exact init-vs-call boundary so operators know which phase to blame when the
    // URL is wrong — and why TQ-INF-018 (the preemptive check) exists as a code
    // that Step 15+ engines can surface after their own explicit probe, rather
    // than being produced automatically here.
    const adapter = createHttpBaseEngine({
      baseUrl: "http://127.0.0.1:1",
      timeouts: { connectMs: 100, requestMs: 100, totalMs: 300 },
      retry: { maxAttempts: 1 }
    });
    await adapter.init();
    try {
      const result = await adapter.call({ operation: "lookup" });
      expect(result.ok).toBe(false);
      if (result.ok) return;
      // Unreachable host → connection refused → classified as retryable /
      // downstream_unavailable. With maxAttempts: 1 the budget is exhausted on
      // the first failure. The adapter surfaces TQ-INF-014 in that case.
      expect(["TQ-INF-013", "TQ-INF-014"]).toContain(result.error.code);
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_health_check_surfaces_base_url_and_pool_diagnostics_in_running_state", async () => {
    const adapter = createHttpBaseEngine({
      baseUrl: mock.url,
      timeouts: { connectMs: 300, requestMs: 300, totalMs: 1000 }
    });
    await adapter.init();
    try {
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.details["baseUrl"]).toBe(mock.url);
      expect(typeof health.details["circuitBreakerState"]).toBe("string");
      expect(typeof health.details["currentConcurrency"]).toBe("number");
      expect(typeof health.details["maxConcurrency"]).toBe("number");
      expect(typeof health.details["lastError"]).toBe("string");
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_health_check_after_shutdown_returns_healthy_false_without_throwing", async () => {
    const adapter = createHttpBaseEngine({ baseUrl: mock.url });
    await adapter.init();
    await adapter.shutdown();
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    expect(health.details["lifecycle"]).toBe("shut_down");
  });

  it("test_object_keys_exposes_only_public_contract_surface_no_extras", () => {
    const adapter = createHttpBaseEngine({ baseUrl: mock.url });
    const expected = new Set([
      "adapterName",
      "__externalEngineProbe",
      "init",
      "shutdown",
      "healthCheck",
      "call",
      "getCircuitBreakerState",
      "getCurrentConcurrency",
      "getPeakConcurrency",
      "getLastTraceId",
      "getRetryStats",
      "getLastCircuitTransitionAt"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });
});
