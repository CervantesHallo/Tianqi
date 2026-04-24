import { setTimeout as scheduleTimer } from "node:timers";

import { Kafka, type Consumer, type Producer } from "kafkajs";

import type {
  AdapterFoundation,
  AdapterHealthStatus,
  NotificationMessage,
  NotificationPort,
  NotificationPortError
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

type LifecycleState = "created" | "running" | "shut_down";

const ADAPTER_NAME = "notification-kafka";
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 2_000;
const ORIGIN_HEADER = "tianqi-origin-instance";

type NotificationHandler = (message: NotificationMessage) => void;

type NotificationSubscription = {
  unsubscribe(): void;
};

// Structurally compatible with @tianqi/adapter-testkit's NotificationContractProbe (Meta-Rule F:
// Adapter code never imports from adapter-testkit at compile time; structural typing lets
// defineNotificationContractTests accept this adapter as a factory product).
type TestkitProbe = {
  readonly __notificationProbe: true;
  subscribe(handler: NotificationHandler): NotificationSubscription;
};

export type KafkaNotification = NotificationPort & AdapterFoundation & TestkitProbe;

export type KafkaNotificationOptions = Readonly<{
  brokers: readonly string[];
  clientId: string;
  topic: string;
  consumerGroupId: string;
  connectionTimeoutMs?: number;
  healthCheckTimeoutMs?: number;
  allowAutoTopicCreation?: boolean;
  // Number of KafkaJS-level connection retries on init. Defaults to 5 (KafkaJS default).
  // Set to 0 in tests to make "unreachable broker" assertions fail fast.
  retries?: number;
}>;

const portError = (code: string, action: string): NotificationPortError => ({
  message: `${code}: ${action}`
});

const randomInstanceId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const createKafkaNotification = (options: KafkaNotificationOptions): KafkaNotification => {
  if (options.brokers.length === 0) {
    throw new Error("TQ-INF-010: Kafka broker list is empty");
  }
  const brokers = [...options.brokers];
  const clientId = options.clientId;
  const topic = options.topic;
  const consumerGroupId = options.consumerGroupId;
  const connectionTimeoutMs = options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const healthCheckTimeoutMs = options.healthCheckTimeoutMs ?? DEFAULT_HEALTH_CHECK_TIMEOUT_MS;
  const allowAutoTopicCreation = options.allowAutoTopicCreation ?? false;
  const originInstanceId = randomInstanceId();

  const subscribers = new Set<NotificationHandler>();
  let state: LifecycleState = "created";
  let kafka: Kafka | null = null;
  let producer: Producer | null = null;
  let consumer: Consumer | null = null;
  let lastSuccessAt: string | null = null;
  let lastError: string | null = null;

  const dispatchLocally = (message: NotificationMessage): void => {
    const snapshot = Array.from(subscribers);
    for (const handler of snapshot) {
      try {
        handler(message);
      } catch {
        // Handler exceptions are silently swallowed per the README contract: subscriber bugs
        // must not break the publish chain, and Kafka offset must still advance normally.
        // Subscribers are responsible for catching and reporting their own exceptions.
      }
    }
  };

  const publish = async (
    message: NotificationMessage
  ): Promise<Result<void, NotificationPortError>> => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (state === "shut_down") {
      return err(portError("TQ-INF-004", "publish called after shutdown"));
    }
    if (state === "created" || producer === null) {
      return err(portError("TQ-INF-003", "publish called before init"));
    }

    try {
      await producer.send({
        topic,
        messages: [
          {
            key: message.caseId as string,
            value: JSON.stringify(message),
            headers: {
              [ORIGIN_HEADER]: originInstanceId
            }
          }
        ]
      });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      lastError = reason;
      return err(portError("TQ-INF-001", `Kafka publish failed: ${reason}`));
    }

    // Kafka ack succeeded. Dispatch to local subscribers synchronously so contract-test
    // expectations ("publish returned -> handler received") hold within a single adapter
    // instance. Cross-process subscribers receive via the consumer loop in their own Adapter
    // instances; this adapter's own consumer loop will filter out self-origin messages to
    // avoid double-delivery.
    dispatchLocally(message);
    lastSuccessAt = new Date().toISOString();
    return ok(undefined);
  };

  const subscribe = (handler: NotificationHandler): NotificationSubscription => {
    if (state === "shut_down") {
      throw new Error("TQ-INF-004: subscribe called after shutdown");
    }
    if (state === "created") {
      throw new Error("TQ-INF-003: subscribe called before init");
    }
    subscribers.add(handler);
    return {
      unsubscribe: () => {
        subscribers.delete(handler);
      }
    };
  };

  const init = async (): Promise<void> => {
    if (state === "running") return;
    if (state === "shut_down") return;

    kafka = new Kafka({
      clientId,
      brokers,
      connectionTimeout: connectionTimeoutMs,
      ...(options.retries === undefined ? {} : { retry: { retries: options.retries } })
    });
    producer = kafka.producer({ allowAutoTopicCreation });
    consumer = kafka.consumer({ groupId: consumerGroupId, allowAutoTopicCreation });

    try {
      await producer.connect();
      await consumer.connect();
      await consumer.subscribe({ topic, fromBeginning: false });
      // consumer.run() is fire-and-forget; it returns a promise that resolves when the consumer
      // stops. The eachMessage callback fires asynchronously on every polled message. We filter
      // out messages this Adapter itself published (originInstanceId match) so single-instance
      // contract tests do not see double delivery.
      void consumer.run({
        eachMessage: async ({ message: kafkaMessage }) => {
          const headerValue = kafkaMessage.headers?.[ORIGIN_HEADER];
          const originHeader = typeof headerValue === "undefined" ? "" : headerValue.toString();
          if (originHeader === originInstanceId) {
            return;
          }
          const valueBuffer = kafkaMessage.value;
          if (valueBuffer === null) return;
          let parsed: NotificationMessage;
          try {
            parsed = JSON.parse(valueBuffer.toString()) as NotificationMessage;
          } catch {
            lastError = "failed to parse Kafka message payload as NotificationMessage";
            return;
          }
          dispatchLocally(parsed);
        }
      });
      state = "running";
      lastSuccessAt = new Date().toISOString();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      lastError = reason;
      if (producer) {
        await producer.disconnect().catch(() => {
          // Best-effort cleanup on init failure.
        });
      }
      if (consumer) {
        await consumer.disconnect().catch(() => {
          // Best-effort cleanup on init failure.
        });
      }
      producer = null;
      consumer = null;
      kafka = null;
      throw new Error(`TQ-INF-010: Kafka broker unreachable (${brokers.join(",")}): ${reason}`);
    }
  };

  const shutdown = async (): Promise<void> => {
    if (state === "shut_down") return;
    if (consumer) {
      await consumer.disconnect().catch(() => {
        // Shutdown must never throw.
      });
      consumer = null;
    }
    if (producer) {
      await producer.disconnect().catch(() => {
        // Shutdown must never throw.
      });
      producer = null;
    }
    kafka = null;
    subscribers.clear();
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => {
    const baseDetails: Record<string, string | number | boolean | null> = {
      lifecycle: state,
      topic,
      consumerGroupId,
      clientId,
      brokers: brokers.join(","),
      lastSuccessAt: lastSuccessAt ?? "never",
      lastError: lastError ?? "none",
      healthCheckTimeoutMs,
      subscriberCount: subscribers.size
    };
    if (state !== "running" || kafka === null) {
      return {
        adapterName: ADAPTER_NAME,
        healthy: false,
        details: baseDetails,
        checkedAt: new Date().toISOString()
      };
    }
    // Meta-Rule I probe: admin.fetchTopicMetadata is read-only and does not write to any
    // business topic. We race it against an independent timeout so a stuck network cannot
    // block healthCheck indefinitely.
    const admin = kafka.admin();
    const probe = new Promise<boolean>((resolve) => {
      admin
        .connect()
        .then(() => admin.fetchTopicMetadata({ topics: [topic] }))
        .then(() => resolve(true))
        .catch((cause: unknown) => {
          lastError = cause instanceof Error ? cause.message : String(cause);
          resolve(false);
        })
        .finally(() => {
          admin.disconnect().catch(() => {
            // Best-effort cleanup; admin lifecycle is local to this probe.
          });
        });
    });
    const timeout = new Promise<boolean>((resolve) => {
      scheduleTimer(() => resolve(false), healthCheckTimeoutMs);
    });
    const healthy = await Promise.race([probe, timeout]);
    if (healthy) {
      lastSuccessAt = new Date().toISOString();
    }
    return {
      adapterName: ADAPTER_NAME,
      healthy,
      details: baseDetails,
      checkedAt: new Date().toISOString()
    };
  };

  return {
    adapterName: ADAPTER_NAME,
    __notificationProbe: true,
    publish,
    subscribe,
    init,
    shutdown,
    healthCheck
  };
};
