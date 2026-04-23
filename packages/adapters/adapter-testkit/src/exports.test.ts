import { describe, expect, it } from "vitest";

import type { AdapterFoundation } from "@tianqi/ports";

import {
  defineHealthCheckContractTests,
  defineLifecycleContractTests,
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
});
