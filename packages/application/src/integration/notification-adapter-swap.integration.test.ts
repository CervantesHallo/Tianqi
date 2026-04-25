import { env } from "node:process";

import { describe, expect, it } from "vitest";

import type { AdapterFoundation, NotificationMessage, NotificationPort } from "@tianqi/ports";
import { createRiskCaseId, createTraceId } from "@tianqi/shared";

import { createInMemoryNotification } from "@tianqi/notification-memory";
import { createKafkaNotification } from "@tianqi/notification-kafka";

// Notification Adapter swap integration. Same META-RULE A reflection as the EventStore
// swap test: NotificationPort is not consumed directly by the Phase 1-7 Application
// layer; we verify §3.7 Adapter 替换原则 via a thin "application-layer-style" consumer
// function that drives both adapters. Same code, different factory.

const KAFKA_BROKERS = env["TIANQI_TEST_KAFKA_BROKERS"];

const sampleMessage = (): NotificationMessage => ({
  caseId: createRiskCaseId("case-int-1"),
  traceId: createTraceId("trace-int-1"),
  eventType: "RiskCaseCreated",
  content: "step-18-integration-payload"
});

const consumeNotificationFromApplicationLayer = async (
  notify: NotificationPort
): Promise<{ readonly publishOk: boolean }> => {
  const result = await notify.publish(sampleMessage());
  return { publishOk: result.ok };
};

type AdapterCase = {
  readonly name: string;
  readonly factory: () => NotificationPort & AdapterFoundation;
  readonly skip: boolean;
};

const cases: readonly AdapterCase[] = [
  {
    name: "memory",
    factory: () => createInMemoryNotification(),
    skip: false
  },
  {
    name: "kafka",
    factory: () =>
      createKafkaNotification({
        brokers: (KAFKA_BROKERS ?? "localhost:9092").split(","),
        clientId: "step-18-integration",
        topic: "tianqi-step18-test",
        consumerGroupId: "step-18-integration"
      }),
    skip: !KAFKA_BROKERS
  }
];

describe.each(cases)("Notification Adapter swap: $name", ({ factory, skip }) => {
  it.skipIf(skip)(
    "test_application_layer_consumes_notification_through_port_without_modification",
    async () => {
      const notify = factory();
      await notify.init();
      try {
        const result = await consumeNotificationFromApplicationLayer(notify);
        expect(result.publishOk).toBe(true);
      } finally {
        await notify.shutdown();
      }
    }
  );

  it.skipIf(skip)(
    "test_notification_health_check_reports_running_after_init_swap_invariant",
    async () => {
      const notify = factory();
      await notify.init();
      try {
        const health = await notify.healthCheck();
        expect(health.adapterName).toMatch(/notification-(memory|kafka)/);
        expect(health.healthy).toBe(true);
      } finally {
        await notify.shutdown();
      }
    }
  );
});
