import { describe, expect, it } from "vitest";

import type { AdapterFoundation } from "@tianqi/ports";

import {
  defineConfigContractTests,
  defineEventStoreContractTests,
  defineExternalEngineContractTests,
  defineHealthCheckContractTests,
  defineLifecycleContractTests,
  defineNotificationContractTests,
  definePersistentConfigContractTests,
  definePersistentEventStoreContractTests,
  type AdapterFoundationFactory
} from "./index.js";

const buildStubFoundation = (): AdapterFoundation => ({
  adapterName: "testkit-exports-stub",
  async init(): Promise<void> {},
  async shutdown(): Promise<void> {},
  async healthCheck() {
    return {
      adapterName: "testkit-exports-stub",
      healthy: true,
      details: {},
      checkedAt: "2026-04-19T12:00:00.000Z"
    };
  }
});

describe("@tianqi/adapter-testkit exports", () => {
  it("exports defineHealthCheckContractTests as a callable function", () => {
    expect(typeof defineHealthCheckContractTests).toBe("function");
  });

  it("exports defineLifecycleContractTests as a callable function", () => {
    expect(typeof defineLifecycleContractTests).toBe("function");
  });

  it("accepts a factory returning AdapterFoundation for HealthCheck container", () => {
    const factory: AdapterFoundationFactory = () => buildStubFoundation();
    expect(() => defineHealthCheckContractTests(factory)).not.toThrow();
  });

  it("accepts a factory returning AdapterFoundation for Lifecycle container", () => {
    const factory: AdapterFoundationFactory = () => buildStubFoundation();
    expect(() => defineLifecycleContractTests(factory)).not.toThrow();
  });

  it("accepts a Promise-returning factory", () => {
    const factory: AdapterFoundationFactory = async () => buildStubFoundation();
    expect(() => defineHealthCheckContractTests(factory)).not.toThrow();
    expect(() => defineLifecycleContractTests(factory)).not.toThrow();
  });

  it("exports the full set of Phase 8 adapter contract suites as callable functions", () => {
    // Smoke test: every contract suite ships as a named export so Adapters can mount it
    // with a single import. Without this guard, renaming one would silently break fan-out.
    expect(typeof defineEventStoreContractTests).toBe("function");
    expect(typeof defineNotificationContractTests).toBe("function");
    expect(typeof defineConfigContractTests).toBe("function");
  });

  it("exports the full set of Phase 8 persistent contract suites as callable functions", () => {
    // Persistent contracts are a separate fan-out vector — Step 5 for EventStore,
    // Step 12 for Config. Adapters that advertise persistence mount these additionally
    // to the basic contracts. Guard the barrel so neither persistent suite silently
    // disappears during a refactor.
    expect(typeof definePersistentEventStoreContractTests).toBe("function");
    expect(typeof definePersistentConfigContractTests).toBe("function");
  });

  it("exports the External Engine contract suite as a callable function", () => {
    // Step 13 adds Sprint E's stability-focused contract suite for external service
    // adapters (timeout / retry / circuit / rate limit / trace propagation). Guard
    // the barrel so renames or accidental removals during Step 14-18 land loudly.
    expect(typeof defineExternalEngineContractTests).toBe("function");
  });
});
