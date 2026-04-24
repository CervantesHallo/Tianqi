import { describe, expect, it } from "vitest";

import { createRiskCaseId, createTraceId } from "@tianqi/shared";

import { createInMemoryNotification } from "./notification-memory.js";

describe("createInMemoryNotification — adapter-specific invariants", () => {
  it("test_factory_without_options_returns_valid_instance", () => {
    const adapter = createInMemoryNotification();
    expect(adapter.adapterName).toBe("notification-memory");
    expect(adapter.__notificationProbe).toBe(true);
  });

  it("test_factory_with_empty_options_behaves_identically_to_no_options", () => {
    const withoutOptions = createInMemoryNotification();
    const withEmptyOptions = createInMemoryNotification(
      {} as Parameters<typeof createInMemoryNotification>[0]
    );
    expect(Object.keys(withoutOptions)).toEqual(Object.keys(withEmptyOptions));
    expect(withoutOptions.adapterName).toBe(withEmptyOptions.adapterName);
  });

  it("test_two_instances_do_not_share_subscribers", async () => {
    const adapterA = createInMemoryNotification();
    const adapterB = createInMemoryNotification();
    await adapterA.init();
    await adapterB.init();

    const receivedA: string[] = [];
    const receivedB: string[] = [];
    adapterA.subscribe((message) => receivedA.push(message.content));
    adapterB.subscribe((message) => receivedB.push(message.content));

    await adapterA.publish({
      caseId: createRiskCaseId("case-isolated"),
      traceId: createTraceId("trace-isolated"),
      eventType: "RiskCaseCreated",
      content: "only-for-a"
    });

    expect(receivedA).toEqual(["only-for-a"]);
    expect(receivedB).toEqual([]);

    await adapterA.shutdown();
    await adapterB.shutdown();
  });

  it("test_health_check_details_include_lifecycle_and_subscriber_count", async () => {
    const adapter = createInMemoryNotification();
    await adapter.init();
    adapter.subscribe(() => {});
    adapter.subscribe(() => {});
    const status = await adapter.healthCheck();
    expect(status.details).toEqual({
      lifecycle: "running",
      subscriberCount: 2
    });
    await adapter.shutdown();
  });

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createInMemoryNotification();
    const expected = new Set([
      "adapterName",
      "__notificationProbe",
      "publish",
      "subscribe",
      "init",
      "shutdown",
      "healthCheck"
    ]);
    const actual = new Set(Object.keys(adapter));
    expect(actual).toEqual(expected);
  });
});
