import type {
  AdapterFoundation,
  AdapterHealthStatus,
  NotificationMessage,
  NotificationPort,
  NotificationPortError
} from "@tianqi/ports";
import { err, ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";

import type {
  NotificationContractProbe,
  NotificationHandler,
  NotificationSubscription
} from "../notification-contract-probe.js";

type LifecycleState = "created" | "running" | "shut_down";

export type ReferenceNotification = NotificationPort &
  AdapterFoundation &
  NotificationContractProbe;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): NotificationPortError => ({
  message: `${code}: ${action}`
});

export const createReferenceNotification = (): ReferenceNotification => {
  const subscribers = new Set<NotificationHandler>();
  let state: LifecycleState = "created";

  const publish = async (
    message: NotificationMessage
  ): Promise<Result<void, NotificationPortError>> => {
    if (state === "shut_down") {
      return err(portError("TQ-INF-004", "publish called after shutdown"));
    }
    if (state === "created") {
      return err(portError("TQ-INF-003", "publish called before init"));
    }
    // Reference semantics: at-least-once, no producer-side dedup. Each publish call produces
    // exactly one delivery per currently-registered subscriber. A snapshot of the subscriber
    // set is taken so that unsubscribe() called from inside a handler does not mutate the
    // set we are currently iterating.
    const snapshot = Array.from(subscribers);
    for (const handler of snapshot) {
      handler(message);
    }
    return ok(undefined);
  };

  const subscribe = (handler: NotificationHandler): NotificationSubscription => {
    if (state === "created") {
      throw new Error("TQ-INF-003: subscribe called before init");
    }
    if (state === "shut_down") {
      throw new Error("TQ-INF-004: subscribe called after shutdown");
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
    state = "running";
  };

  const shutdown = async (): Promise<void> => {
    subscribers.clear();
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName: "reference-notification",
    healthy: state === "running",
    details: {
      lifecycle: state,
      subscriberCount: subscribers.size
    },
    checkedAt: new Date().toISOString()
  });

  return {
    adapterName: "reference-notification",
    __notificationProbe: true,
    publish,
    subscribe,
    init,
    shutdown,
    healthCheck
  };
};
