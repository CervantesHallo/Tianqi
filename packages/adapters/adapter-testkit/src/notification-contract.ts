import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AdapterFoundation, NotificationMessage, NotificationPort } from "@tianqi/ports";
import { createRiskCaseId, createTraceId } from "@tianqi/shared";
import type { RiskCaseId } from "@tianqi/shared";

import type {
  NotificationContractProbe,
  NotificationHandler
} from "./notification-contract-probe.js";

export type NotificationAdapterUnderTest = NotificationPort &
  AdapterFoundation &
  NotificationContractProbe;

export type NotificationAdapterFactory<
  T extends NotificationAdapterUnderTest = NotificationAdapterUnderTest
> = () => T | Promise<T>;

export type NotificationContractOptions = Readonly<Record<string, never>>;

const buildMessage = (
  eventType: string,
  content: string,
  overrides: { caseId?: RiskCaseId } = {}
): NotificationMessage => ({
  caseId: overrides.caseId ?? createRiskCaseId("case-contract-1"),
  traceId: createTraceId("trace-contract-1"),
  eventType,
  content
});

const captureHandler = (bucket: NotificationMessage[]): NotificationHandler => {
  return (message) => {
    bucket.push(message);
  };
};

export const defineNotificationContractTests = <
  T extends NotificationAdapterUnderTest = NotificationAdapterUnderTest
>(
  adapterName: string,
  factory: NotificationAdapterFactory<T>,
  _options?: NotificationContractOptions
): void => {
  describe(`[adapter-testkit] Notification contract — ${adapterName}`, () => {
    let adapter: T;

    beforeEach(async () => {
      adapter = await factory();
      await adapter.init();
    });

    afterEach(async () => {
      await adapter.shutdown();
    });

    describe("category 1: publish and subscribe basics", () => {
      it("test_publish_delivers_event_to_registered_subscriber", async () => {
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        const message = buildMessage("RiskCaseCreated", "hello");
        const result = await adapter.publish(message);
        expect(result.ok).toBe(true);
        expect(received).toHaveLength(1);
        expect(received[0]?.content).toBe("hello");
      });

      it("test_multiple_subscribers_all_receive_the_same_published_event", async () => {
        const receivedA: NotificationMessage[] = [];
        const receivedB: NotificationMessage[] = [];
        const receivedC: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(receivedA));
        adapter.subscribe(captureHandler(receivedB));
        adapter.subscribe(captureHandler(receivedC));
        await adapter.publish(buildMessage("RiskCaseCreated", "broadcast"));
        expect(receivedA).toHaveLength(1);
        expect(receivedB).toHaveLength(1);
        expect(receivedC).toHaveLength(1);
      });

      it("test_subscriber_registered_after_publish_does_not_receive_historical_events", async () => {
        await adapter.publish(buildMessage("RiskCaseCreated", "early"));
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        expect(received).toHaveLength(0);
        await adapter.publish(buildMessage("RiskCaseCreated", "late"));
        expect(received).toHaveLength(1);
        expect(received[0]?.content).toBe("late");
      });

      it("test_publish_without_any_subscribers_succeeds_without_side_effects", async () => {
        const result = await adapter.publish(buildMessage("RiskCaseCreated", "silent"));
        expect(result.ok).toBe(true);
      });
    });

    describe("category 2: non-amplification under at-least-once semantics", () => {
      it("test_single_publish_results_in_exactly_one_delivery_per_subscriber", async () => {
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        await adapter.publish(buildMessage("RiskCaseCreated", "one-time"));
        expect(received).toHaveLength(1);
      });

      it("test_repeated_publish_of_identical_content_delivers_each_call_under_at_least_once_semantics", async () => {
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        const message = buildMessage("RiskCaseCreated", "repeated");
        await adapter.publish(message);
        await adapter.publish(message);
        await adapter.publish(message);
        // Contract: under at-least-once, identical content is NOT deduped at the producer.
        // Subscribers receive exactly one delivery per publish call (no amplification).
        expect(received).toHaveLength(3);
      });
    });

    describe("category 3: ordering", () => {
      it("test_per_case_id_sequence_preserved_in_subscriber_delivery", async () => {
        const caseId = createRiskCaseId("case-order-1");
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        await adapter.publish(buildMessage("RiskCaseCreated", "#1", { caseId }));
        await adapter.publish(buildMessage("RiskCaseCreated", "#2", { caseId }));
        await adapter.publish(buildMessage("RiskCaseCreated", "#3", { caseId }));
        expect(received.map((message) => message.content)).toEqual(["#1", "#2", "#3"]);
      });

      it("test_per_case_id_order_preserved_across_different_event_types", async () => {
        const caseId = createRiskCaseId("case-order-2");
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        await adapter.publish(buildMessage("RiskCaseCreated", "created", { caseId }));
        await adapter.publish(
          buildMessage("RiskCaseStateTransitioned", "transitioned", { caseId })
        );
        await adapter.publish(buildMessage("RiskCaseStateTransitioned", "closed", { caseId }));
        expect(received.map((message) => message.content)).toEqual([
          "created",
          "transitioned",
          "closed"
        ]);
      });

      it("test_cross_case_ids_have_no_guaranteed_global_ordering", async () => {
        // Contract: the Adapter does NOT promise cross-case ordering. Both "a-then-b" and
        // "b-then-a" interleavings are valid. The strongest assertion we can make is that
        // per-case-ordering holds independently for each case_id.
        const caseA = createRiskCaseId("case-order-3a");
        const caseB = createRiskCaseId("case-order-3b");
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        await adapter.publish(buildMessage("RiskCaseCreated", "a1", { caseId: caseA }));
        await adapter.publish(buildMessage("RiskCaseCreated", "b1", { caseId: caseB }));
        await adapter.publish(buildMessage("RiskCaseCreated", "a2", { caseId: caseA }));
        const contentsForA = received
          .filter((message) => message.caseId === caseA)
          .map((message) => message.content);
        const contentsForB = received
          .filter((message) => message.caseId === caseB)
          .map((message) => message.content);
        expect(contentsForA).toEqual(["a1", "a2"]);
        expect(contentsForB).toEqual(["b1"]);
      });

      it("test_interleaved_per_case_publishes_preserve_per_case_order", async () => {
        const caseA = createRiskCaseId("case-order-4a");
        const caseB = createRiskCaseId("case-order-4b");
        const received: NotificationMessage[] = [];
        adapter.subscribe(captureHandler(received));
        const sequence: readonly { caseId: RiskCaseId; content: string }[] = [
          { caseId: caseA, content: "a-1" },
          { caseId: caseB, content: "b-1" },
          { caseId: caseA, content: "a-2" },
          { caseId: caseB, content: "b-2" },
          { caseId: caseA, content: "a-3" }
        ];
        for (const step of sequence) {
          await adapter.publish(
            buildMessage("RiskCaseCreated", step.content, { caseId: step.caseId })
          );
        }
        const forA = received
          .filter((message) => message.caseId === caseA)
          .map((message) => message.content);
        const forB = received
          .filter((message) => message.caseId === caseB)
          .map((message) => message.content);
        expect(forA).toEqual(["a-1", "a-2", "a-3"]);
        expect(forB).toEqual(["b-1", "b-2"]);
      });
    });

    describe("category 4: subscription lifecycle", () => {
      it("test_unsubscribe_handle_stops_further_events_from_reaching_subscriber", async () => {
        const received: NotificationMessage[] = [];
        const subscription = adapter.subscribe(captureHandler(received));
        await adapter.publish(buildMessage("RiskCaseCreated", "before"));
        subscription.unsubscribe();
        await adapter.publish(buildMessage("RiskCaseCreated", "after"));
        expect(received.map((message) => message.content)).toEqual(["before"]);
      });

      it("test_duplicate_subscribe_of_same_handler_is_idempotent_and_delivers_once_per_publish", async () => {
        let callCount = 0;
        const handler: NotificationHandler = () => {
          callCount += 1;
        };
        adapter.subscribe(handler);
        adapter.subscribe(handler);
        adapter.subscribe(handler);
        await adapter.publish(buildMessage("RiskCaseCreated", "once"));
        expect(callCount).toBe(1);
      });

      it("test_unsubscribe_is_idempotent_calling_it_multiple_times_does_not_throw", async () => {
        const received: NotificationMessage[] = [];
        const subscription = adapter.subscribe(captureHandler(received));
        subscription.unsubscribe();
        expect(() => {
          subscription.unsubscribe();
          subscription.unsubscribe();
        }).not.toThrow();
      });

      it("test_two_distinct_handlers_receive_independent_event_streams", async () => {
        const receivedA: NotificationMessage[] = [];
        const receivedB: NotificationMessage[] = [];
        const subA = adapter.subscribe(captureHandler(receivedA));
        adapter.subscribe(captureHandler(receivedB));
        await adapter.publish(buildMessage("RiskCaseCreated", "both"));
        subA.unsubscribe();
        await adapter.publish(buildMessage("RiskCaseCreated", "only-b"));
        expect(receivedA.map((message) => message.content)).toEqual(["both"]);
        expect(receivedB.map((message) => message.content)).toEqual(["both", "only-b"]);
      });
    });

    describe("category 5: integration with AdapterFoundation", () => {
      it("test_publish_before_init_rejects_with_tq_inf_not_initialized", async () => {
        const freshAdapter = await factory();
        const result = await freshAdapter.publish(buildMessage("RiskCaseCreated", "pre-init"));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-003:/);
      });

      it("test_subscribe_before_init_throws_not_initialized", async () => {
        const freshAdapter = await factory();
        expect(() => freshAdapter.subscribe(() => {})).toThrow(/TQ-INF-003/);
      });

      it("test_publish_after_shutdown_rejects_with_tq_inf_already_shut_down", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        await freshAdapter.shutdown();
        const result = await freshAdapter.publish(buildMessage("RiskCaseCreated", "post-shutdown"));
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.message).toMatch(/^TQ-INF-004:/);
      });

      it("test_health_check_reports_healthy_true_after_init_and_false_after_shutdown_without_throwing", async () => {
        const freshAdapter = await factory();
        await freshAdapter.init();
        const healthy = await freshAdapter.healthCheck();
        expect(healthy.healthy).toBe(true);
        await freshAdapter.shutdown();
        const unhealthy = await freshAdapter.healthCheck();
        expect(unhealthy.healthy).toBe(false);
      });
    });
  });
};
