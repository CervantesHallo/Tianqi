import { env } from "node:process";
import { setTimeout as scheduleTimer } from "node:timers";

import { Kafka } from "kafkajs";

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

/**
 * Pre-create topic and poll until metadata propagates to broker.
 *
 * Phase 11 / Step 0.5 PR #14 CI run #1 揭露 ADR-0004 §D 类别 4
 * （CI 环境时序假设 vs 本机环境）：CI 环境（KRaft 单 broker setup）
 * admin.createTopics(waitForLeaders) 返回后 topic metadata 可能尚未完全传播；
 * 后续 consumer.subscribe 立即触发 NotLeaderOrFollower → adapter.init() 失败
 * （TQ-INF-010）。本机环境时序快不显化。
 *
 * 修复策略：测试预先用独立 admin client 创建 topic + 轮询 fetchTopicMetadata
 * 直到 partition leader 可见，然后才调 adapter.init()。adapter 内部
 * admin.createTopics 仍执行（idempotent；topic 已存在不抛）；但此时 metadata
 * 已传播，consumer.subscribe 可直接成功。
 *
 * 不修改 adapter 业务代码（接口 / 默认行为不变）；仅测试 fixture 加 helper。
 */
const ensureTopicReady = async (topic: string, timeoutMs = 30_000): Promise<void> => {
  const kafka = new Kafka({ clientId: `tianqi-ensure-${RUN_ID}-${topic}`, brokers });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin
      .createTopics({
        topics: [{ topic, numPartitions: 1, replicationFactor: 1 }],
        waitForLeaders: true,
        timeout: timeoutMs
      })
      .catch(() => {
        // Topic 已存在 → idempotent no-op。
      });
    const start = Date.now();
    let lastError: unknown = null;
    while (Date.now() - start < timeoutMs) {
      try {
        const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
        const topicInfo = metadata.topics[0];
        if (
          topicInfo !== undefined &&
          topicInfo.partitions.length > 0 &&
          topicInfo.partitions.every((p) => p.leader !== -1)
        ) {
          return;
        }
      } catch (err) {
        lastError = err;
      }
      await delayMs(100);
    }
    throw new Error(
      `ensureTopicReady: topic ${topic} metadata not ready within ${timeoutMs}ms; last error: ${String(lastError)}`
    );
  } finally {
    await admin.disconnect().catch(() => {
      // Best-effort cleanup.
    });
  }
};

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
      const topic = `tianqi-shutdown-topic-${RUN_ID}`;
      // Phase 11 / Step 0.5 §D.4：CI 环境时序假设修复 — 预创 topic + 等
      // metadata 传播，避免 adapter.init() 内部 consumer.subscribe 触发
      // NotLeaderOrFollower。详见 ensureTopicReady JSDoc。
      await ensureTopicReady(topic);
      const adapter = createKafkaNotification({
        brokers,
        clientId: `tianqi-shutdown-client-${RUN_ID}`,
        topic,
        consumerGroupId: `tianqi-shutdown-group-${RUN_ID}`,
        allowAutoTopicCreation: true
      });
      await adapter.init();
      await adapter.shutdown();
      const status = await adapter.healthCheck();
      expect(status.healthy).toBe(false);
      expect(status.details["lifecycle"]).toBe("shut_down");
    },
    60_000
  );

  it.skipIf(!canReachKafka)(
    "test_two_distinct_consumer_groups_on_same_topic_both_receive_messages",
    async () => {
      const topic = `tianqi-fanout-topic-${RUN_ID}`;
      // Phase 11 / Step 0.5 §D.4：CI 环境时序假设修复 — 预创 topic + 等
      // metadata 传播，避免 2 个并发 adapter.init() 的 consumer.subscribe
      // 在 metadata 未就绪时触发 NotLeaderOrFollower。
      await ensureTopicReady(topic);
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
