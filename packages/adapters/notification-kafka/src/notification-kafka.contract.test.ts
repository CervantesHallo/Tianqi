import { env } from "node:process";

import { afterAll, describe } from "vitest";

import { Kafka } from "kafkajs";

import { defineNotificationContractTests } from "@tianqi/adapter-testkit";

import { createKafkaNotification } from "./notification-kafka.js";

// Meta-Rule J: Kafka contract tests talk to a real broker. If TIANQI_TEST_KAFKA_BROKERS is
// unset the entire describe block is skipped so CI without a Kafka service container does
// not go red. The env var format is "host1:port1,host2:port2" — KafkaJS canonical form.
const brokersEnv = env["TIANQI_TEST_KAFKA_BROKERS"];
const brokers = brokersEnv !== undefined && brokersEnv.length > 0 ? brokersEnv.split(",") : [];
const canReachKafka = brokers.length > 0;

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const TOPIC_PREFIX = `tianqi-notif-contract-${RUN_ID}`;

let counter = 0;
const createdTopics: string[] = [];

const factory = () => {
  counter += 1;
  const topic = `${TOPIC_PREFIX}-${counter}`;
  createdTopics.push(topic);
  return createKafkaNotification({
    brokers,
    clientId: `tianqi-contract-client-${RUN_ID}-${counter}`,
    topic,
    consumerGroupId: `tianqi-contract-group-${RUN_ID}-${counter}`,
    allowAutoTopicCreation: true,
    connectionTimeoutMs: 3_000,
    healthCheckTimeoutMs: 2_000
  });
};

afterAll(async () => {
  if (!canReachKafka || createdTopics.length === 0) return;
  const admin = new Kafka({ clientId: `tianqi-cleanup-${RUN_ID}`, brokers }).admin();
  try {
    await admin.connect();
    await admin.deleteTopics({ topics: createdTopics, timeout: 10_000 }).catch(() => {
      // Best-effort cleanup; topics may not exist if the test never published.
    });
  } finally {
    await admin.disconnect().catch(() => {
      // Best-effort cleanup.
    });
  }
});

describe.skipIf(!canReachKafka)("notification-kafka contract suite", () => {
  defineNotificationContractTests("notification-kafka", factory);
});
