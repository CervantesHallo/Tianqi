import { describe, expect, it } from "vitest";

import { createInMemoryEventStore } from "./event-store-memory.js";

describe("createInMemoryEventStore — adapter-specific invariants", () => {
  it("test_factory_without_options_returns_valid_instance", () => {
    const adapter = createInMemoryEventStore();
    expect(adapter.adapterName).toBe("event-store-memory");
    expect(adapter.__testkitProbe).toBe(true);
  });

  it("test_two_instances_do_not_share_state", async () => {
    const adapterA = createInMemoryEventStore();
    const adapterB = createInMemoryEventStore();
    await adapterA.init();
    await adapterB.init();
    expect(await adapterA.countTotal()).toBe(0);
    expect(await adapterB.countTotal()).toBe(0);
    await adapterA.shutdown();
    await adapterB.shutdown();
  });

  it("test_health_check_details_include_lifecycle_and_event_count", async () => {
    const adapter = createInMemoryEventStore();
    await adapter.init();
    const status = await adapter.healthCheck();
    expect(status.details).toEqual({ lifecycle: "running", eventCount: 0 });
    await adapter.shutdown();
    const afterShutdown = await adapter.healthCheck();
    expect(afterShutdown.details).toEqual({ lifecycle: "shut_down", eventCount: 0 });
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createInMemoryEventStore();
    const expected = new Set([
      "adapterName",
      "__testkitProbe",
      "append",
      "listByCaseId",
      "countTotal",
      "init",
      "shutdown",
      "healthCheck"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });

  it("test_empty_options_object_behaves_identically_to_no_options", () => {
    const withoutOptions = createInMemoryEventStore();
    const withEmptyOptions = createInMemoryEventStore(
      {} as Parameters<typeof createInMemoryEventStore>[0]
    );
    expect(Object.keys(withoutOptions)).toEqual(Object.keys(withEmptyOptions));
    expect(withoutOptions.adapterName).toBe(withEmptyOptions.adapterName);
  });
});
