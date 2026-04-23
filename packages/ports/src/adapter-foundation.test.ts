import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  AdapterFoundation,
  AdapterHealthStatus,
  AdapterLifecycle
} from "./adapter-foundation.js";

type PlaceholderPort = {
  fetch(input: string): Promise<string>;
};

const buildStubAdapter = (): AdapterFoundation & { readonly initCount: () => number } => {
  let initCounter = 0;
  let shutdownCounter = 0;
  let started = false;
  return {
    adapterName: "stub-adapter",
    initCount: () => initCounter,
    async init(): Promise<void> {
      if (started) return;
      started = true;
      initCounter += 1;
    },
    async shutdown(): Promise<void> {
      if (!started) return;
      started = false;
      shutdownCounter += 1;
    },
    async healthCheck(): Promise<AdapterHealthStatus> {
      return {
        adapterName: "stub-adapter",
        healthy: started,
        details: { shutdownCount: shutdownCounter, started },
        checkedAt: "2026-04-19T12:34:56.000Z"
      };
    }
  };
};

describe("AdapterFoundation", () => {
  it("accepts a minimal AdapterHealthStatus literal", () => {
    const status: AdapterHealthStatus = {
      adapterName: "x",
      healthy: true,
      details: {},
      checkedAt: "2026-04-19T12:00:00.000Z"
    };
    expect(status.healthy).toBe(true);
  });

  it("composes with an arbitrary Port via intersection", () => {
    type Combined = AdapterFoundation & PlaceholderPort;
    const adapter: Combined = {
      ...buildStubAdapter(),
      async fetch(input: string): Promise<string> {
        return input;
      }
    };
    expect(adapter.adapterName).toBe("stub-adapter");
  });

  it("types healthCheck() as returning Promise<AdapterHealthStatus>", () => {
    const adapter = buildStubAdapter();
    expectTypeOf(adapter.healthCheck).returns.toEqualTypeOf<Promise<AdapterHealthStatus>>();
  });

  it("treats init() as idempotent: repeated calls do not produce extra side effects", async () => {
    const adapter = buildStubAdapter();
    await adapter.init();
    await adapter.init();
    await adapter.init();
    expect(adapter.initCount()).toBe(1);
  });

  it("treats shutdown() as idempotent: repeated calls after first shutdown do not throw", async () => {
    const adapter = buildStubAdapter();
    await adapter.init();
    await adapter.shutdown();
    await expect(adapter.shutdown()).resolves.toBeUndefined();
  });

  it("healthCheck returns structured status without throwing on an unhealthy adapter", async () => {
    const adapter = buildStubAdapter();
    const status = await adapter.healthCheck();
    expect(status.adapterName).toBe("stub-adapter");
    expect(status.healthy).toBe(false);
    expect(typeof status.checkedAt).toBe("string");
  });

  it("exposes Lifecycle as a structural subtype of AdapterFoundation", () => {
    const adapter = buildStubAdapter();
    const lifecycle: AdapterLifecycle = adapter;
    expectTypeOf(lifecycle.init).returns.toEqualTypeOf<Promise<void>>();
    expectTypeOf(lifecycle.shutdown).returns.toEqualTypeOf<Promise<void>>();
  });

  it("details accept serializable primitive values only", () => {
    const status: AdapterHealthStatus = {
      adapterName: "y",
      healthy: false,
      details: { queueDepth: 7, connected: false, note: "n/a", lastError: null },
      checkedAt: "2026-04-19T12:00:00.000Z"
    };
    const roundTripped = JSON.parse(JSON.stringify(status)) as AdapterHealthStatus;
    expect(roundTripped.details).toEqual(status.details);
  });
});
