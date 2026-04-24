import { describe, expect, it } from "vitest";

import { createInMemoryConfig } from "./config-memory.js";

// These tests cover dimensions that the shared Config contract (defineConfigContractTests)
// cannot exercise because they are either factory-shape assertions or cross-instance
// isolation. Each assertion is scoped to config-memory's own surface; nothing here
// duplicates a contract it-block (Convention L self-check).
describe("createInMemoryConfig — adapter-specific invariants", () => {
  it("test_factory_without_options_returns_valid_instance", () => {
    const adapter = createInMemoryConfig();
    expect(adapter.adapterName).toBe("config-memory");
    expect(adapter.__configProbe).toBe(true);
  });

  it("test_factory_with_empty_options_behaves_identically_to_no_options", async () => {
    const a = createInMemoryConfig();
    const b = createInMemoryConfig({});
    await a.init();
    await b.init();
    try {
      const healthA = await a.healthCheck();
      const healthB = await b.healthCheck();
      expect(healthA.adapterName).toBe(healthB.adapterName);
      expect(healthA.details["lifecycle"]).toBe(healthB.details["lifecycle"]);
      expect(healthA.details["versionCount"]).toBe(healthB.details["versionCount"]);
    } finally {
      await a.shutdown();
      await b.shutdown();
    }
  });

  it("test_two_instances_do_not_share_state", async () => {
    // Explicit cross-instance isolation — would not fit the contract suite because the
    // suite tests a single factory-produced Adapter at a time.
    const a = createInMemoryConfig();
    const b = createInMemoryConfig();
    await a.init();
    await b.init();
    try {
      const versionA = a.preview({ key: "value-from-a" });
      await a.activate(versionA);
      // b still has no active version — a's activation did not leak.
      const bActive = await b.getActiveConfig();
      expect(bActive.ok).toBe(false);
      const bPreview = b.preview({ key: "value-from-b" });
      expect(bPreview).toBe(versionA);
    } finally {
      await a.shutdown();
      await b.shutdown();
    }
  });

  it("test_health_check_details_include_lifecycle_and_version_count", async () => {
    const adapter = createInMemoryConfig();
    await adapter.init();
    try {
      const v1 = adapter.preview({ a: 1 });
      const v2 = adapter.preview({ a: 2 });
      await adapter.activate(v1);
      await adapter.activate(v2);
      const health = await adapter.healthCheck();
      expect(health.details["lifecycle"]).toBe("running");
      expect(health.details["versionCount"]).toBe(2);
      expect(health.details["auditEntries"]).toBe(2);
      expect(health.details["activeVersion"]).toBe(String(v2));
    } finally {
      await adapter.shutdown();
    }
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createInMemoryConfig();
    const expected = new Set([
      "adapterName",
      "__configProbe",
      "getActiveConfig",
      "preview",
      "activate",
      "rollback",
      "getByVersion",
      "getAuditTrail",
      "setAuditFailureMode",
      "init",
      "shutdown",
      "healthCheck"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });
});
