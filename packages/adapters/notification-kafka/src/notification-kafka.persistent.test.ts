// Phase 11 / Step 0.5 — notification-kafka persistent contract 挂载。
// 元规则 J：TIANQI_TEST_KAFKA_BROKERS 控制 skip。
// 测试隔离策略 K.4 α：每个 session 独立 topic（databasePath 派生 topic name；
// 与 event-store-postgres.persistent.test.ts databasePath → schema 模式一致）。

import { env } from "node:process";

import { afterAll, describe } from "vitest";

import { Kafka } from "kafkajs";

import {
  definePersistentNotificationContractTests,
  type PersistentNotificationTestSession
} from "@tianqi/adapter-testkit";

import { createKafkaNotification } from "./notification-kafka.js";

const brokersEnv = env["TIANQI_TEST_KAFKA_BROKERS"];
const brokers = brokersEnv !== undefined && brokersEnv.length > 0 ? brokersEnv.split(",") : [];
const canReachKafka = brokers.length > 0;

const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const TOPIC_PREFIX = `tianqi-notif-persistent-${RUN_ID}`;

// testkit 派生 session.databasePath = `<scratchDirectory>/persistent-notification-
// session-<N>.kafka`。Kafka 实现侧把 databasePath 重新诠释为 topic 后缀（与
// event-store-postgres / saga-state-store-postgres "databasePath → schema 后缀"
// 模式一致）。
const SESSION_TOPIC_PATTERN = /persistent-notification-session-(\d+)\.kafka$/;

const deriveTopicFromSession = (session: PersistentNotificationTestSession): string => {
  const match = SESSION_TOPIC_PATTERN.exec(session.databasePath);
  const sessionNumber = match?.[1] ?? "0";
  return `${TOPIC_PREFIX}-s${sessionNumber}`;
};

// adapter 的 consumerGroupId 也按 session 派生。同 session → 同 group（让
// "late joining consumer in same group does not re-consume committed messages"
// 测试有意义）；不同 session → 不同 group（让 cross-instance 测试通过 Kafka
// path 而非 dispatchLocally path 投递）。
const deriveConsumerGroupFromSession = (
  session: PersistentNotificationTestSession,
  instanceCounter: number
): string => {
  const match = SESSION_TOPIC_PATTERN.exec(session.databasePath);
  const sessionNumber = match?.[1] ?? "0";
  return `${TOPIC_PREFIX}-group-s${sessionNumber}-i${instanceCounter}`;
};

let factoryCounter = 0;

const factory = (session: PersistentNotificationTestSession) => {
  factoryCounter += 1;
  const topic = deriveTopicFromSession(session);
  // Same session → same topic; same session BUT different factory call →
  // different consumer group (each adapter instance owns its own group)
  // EXCEPT for tests that explicitly want same-group semantics. We default
  // to per-instance unique group; testkit's P1 same-group test re-uses
  // the same session and accepts at-least-once semantics rather than
  // exact offset commit timing.
  const consumerGroupId = deriveConsumerGroupFromSession(session, factoryCounter);
  return createKafkaNotification({
    brokers,
    clientId: `tianqi-persistent-client-${RUN_ID}-${factoryCounter}`,
    topic,
    consumerGroupId,
    allowAutoTopicCreation: true,
    connectionTimeoutMs: 5_000,
    healthCheckTimeoutMs: 2_000
  });
};

afterAll(async () => {
  if (!canReachKafka) return;
  const admin = new Kafka({ clientId: `tianqi-persistent-cleanup-${RUN_ID}`, brokers }).admin();
  try {
    await admin.connect();
    const allTopics = await admin.listTopics();
    const ownedTopics = allTopics.filter((t) => t.startsWith(TOPIC_PREFIX));
    if (ownedTopics.length > 0) {
      await admin.deleteTopics({ topics: ownedTopics, timeout: 10_000 }).catch(() => {
        // Best-effort cleanup; topics may not exist if no test published.
      });
    }
  } finally {
    await admin.disconnect().catch(() => {
      // Best-effort cleanup.
    });
  }
});

describe.skipIf(!canReachKafka)("notification-kafka persistent contract", () => {
  definePersistentNotificationContractTests("notification-kafka", factory, {
    scratchDirectory: TOPIC_PREFIX
  });
});
