import { env } from "node:process";
import { setTimeout as scheduleTimer } from "node:timers";

import { describe, expect, it } from "vitest";

import { createKafkaNotification } from "./notification-kafka.js";

const delayMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(() => resolve(), ms);
  });

const brokersEnv = env["TIANQI_TEST_KAFKA_BROKERS"];
const brokers = brokersEnv !== undefined && brokersEnv.length > 0 ? brokersEnv.split(",") : [];
const canReachKafka = brokers.length > 0;

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

describe("createKafkaNotification — adapter-specific invariants", () => {
  it("test_brokers_empty_array_rejects_with_structured_error", () => {
    expect(() =>
      createKafkaNotification({
        brokers: [],
        clientId: "tianqi-empty",
        topic: "tianqi-empty",
        consumerGroupId: "tianqi-empty"
      })
    ).toThrow(/TQ-INF-010/);
  });

  it("test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable", async () => {
    const adapter = createKafkaNotification({
      brokers: ["127.0.0.1:1"],
      clientId: `tianqi-unreach-${RUN_ID}`,
      topic: `tianqi-unreach-${RUN_ID}`,
      consumerGroupId: `tianqi-unreach-${RUN_ID}`,
      connectionTimeoutMs: 500,
      retries: 0
    });
    await expect(adapter.init()).rejects.toThrow(/TQ-INF-010/);
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(false);
    await adapter.shutdown();
  }, 15_000);

  it("test_object_keys_exposes_only_union_of_three_contracts_no_extras", () => {
    const adapter = createKafkaNotification({
      brokers: ["127.0.0.1:9092"],
      clientId: "tianqi-shape-probe",
      topic: "tianqi-shape-probe",
      consumerGroupId: "tianqi-shape-probe"
    });
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

  it.skipIf(!canReachKafka)(
    "test_health_check_details_include_brokers_and_topic_and_subscriber_count",
    async () => {
      const adapter = createKafkaNotification({
        brokers,
        clientId: `tianqi-health-client-${RUN_ID}`,
        topic: `tianqi-health-topic-${RUN_ID}`,
        consumerGroupId: `tianqi-health-group-${RUN_ID}`,
        allowAutoTopicCreation: true
      });
      await adapter.init();
      try {
        adapter.subscribe(() => {});
        adapter.subscribe(() => {});
        const status = await adapter.healthCheck();
        expect(status.details["lifecycle"]).toBe("running");
        expect(status.details["topic"]).toBe(`tianqi-health-topic-${RUN_ID}`);
        expect(status.details["consumerGroupId"]).toBe(`tianqi-health-group-${RUN_ID}`);
        expect(status.details["subscriberCount"]).toBe(2);
        expect(typeof status.details["brokers"]).toBe("string");
      } finally {
        await adapter.shutdown();
      }
    }
  );

  it.skipIf(!canReachKafka)(
    "test_health_check_returns_healthy_false_after_shutdown_without_throwing",
    async () => {
      const adapter = createKafkaNotification({
        brokers,
        clientId: `tianqi-shutdown-client-${RUN_ID}`,
        topic: `tianqi-shutdown-topic-${RUN_ID}`,
        consumerGroupId: `tianqi-shutdown-group-${RUN_ID}`,
        allowAutoTopicCreation: true
      });
      await adapter.init();
      await adapter.shutdown();
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.details["lifecycle"]).toBe("shut_down");
    }
  );

  it.skipIf(!canReachKafka)(
    "test_two_distinct_consumer_groups_on_same_topic_both_receive_messages",
    async () => {
      const topic = `tianqi-fanout-topic-${RUN_ID}`;
      const producerSide = createKafkaNotification({
        brokers,
        clientId: `tianqi-fanout-producer-${RUN_ID}`,
        topic,
        consumerGroupId: `tianqi-fanout-producer-group-${RUN_ID}`,
        allowAutoTopicCreation: true
      });
      const observerSide = createKafkaNotification({
        brokers,
        clientId: `tianqi-fanout-observer-${RUN_ID}`,
        topic,
        consumerGroupId: `tianqi-fanout-observer-group-${RUN_ID}`,
        allowAutoTopicCreation: true
      });
      await producerSide.init();
      await observerSide.init();
      try {
        const observed: string[] = [];
        observerSide.subscribe((message) => observed.push(message.content));

        // Give the observer's consumer a moment to enter the group before publish.
        await delayMs(2_000);

        await producerSide.publish({
          caseId: "case-fanout" as Parameters<typeof producerSide.publish>[0]["caseId"],
          traceId: "trace-fanout" as Parameters<typeof producerSide.publish>[0]["traceId"],
          eventType: "RiskCaseCreated",
          content: "fanout"
        });

        // Allow time for cross-group delivery.
        await delayMs(3_000);
        expect(observed).toContain("fanout");
      } finally {
        await producerSide.shutdown();
        await observerSide.shutdown();
      }
    },
    15_000
  );
});
