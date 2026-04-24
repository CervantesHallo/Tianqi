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

const ADAPTER_NAME = "notification-memory";

type NotificationHandler = (message: NotificationMessage) => void;

type NotificationSubscription = {
  unsubscribe(): void;
};

// Structurally compatible with @tianqi/adapter-testkit's NotificationContractProbe.
// Declared locally so production code carries no compile-time coupling to the testkit
// (Meta-Rule F). The brand field __notificationProbe distinguishes this probe shape from
// the EventStoreContractProbe's __testkitProbe brand.
type TestkitProbe = {
  readonly __notificationProbe: true;
  subscribe(handler: NotificationHandler): NotificationSubscription;
};

export type InMemoryNotification = NotificationPort & AdapterFoundation & TestkitProbe;

export type InMemoryNotificationOptions = Readonly<Record<string, never>>;

const portError = (code: "TQ-INF-003" | "TQ-INF-004", action: string): NotificationPortError => ({
  message: `${code}: ${action}`
});

export const createInMemoryNotification = (
  _options: InMemoryNotificationOptions = {} as InMemoryNotificationOptions
): InMemoryNotification => {
  const subscribers = new Set<NotificationHandler>();
  let state: LifecycleState = "created";

  const publish = async (
    message: NotificationMessage
  ): Promise<Result<void, NotificationPortError>> => {
    // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
    if (state === "shut_down") {
      return err(portError("TQ-INF-004", "publish called after shutdown"));
    }
    if (state === "created") {
      return err(portError("TQ-INF-003", "publish called before init"));
    }
    // Snapshot before iteration so a handler that subscribe/unsubscribes inside its own
    // invocation does not mutate the set we are currently walking. This also preserves
    // insertion order as Set iteration in JS is insertion-ordered.
    const snapshot = Array.from(subscribers);
    for (const handler of snapshot) {
      try {
        handler(message);
      } catch {
        // Handler-thrown errors are swallowed per the README's "handler exception handling"
        // contract: subscriber bugs must not break the publish chain, and NotificationPortError
        // is reserved for Adapter-layer failures. Subscribers are responsible for catching and
        // logging their own exceptions.
      }
    }
    return ok(undefined);
  };

  const subscribe = (handler: NotificationHandler): NotificationSubscription => {
    // Same state-guard ordering as publish for consistency.
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
    state = "running";
  };

  const shutdown = async (): Promise<void> => {
    subscribers.clear();
    state = "shut_down";
  };

  const healthCheck = async (): Promise<AdapterHealthStatus> => ({
    adapterName: ADAPTER_NAME,
    healthy: state === "running",
    details: {
      lifecycle: state,
      subscriberCount: subscribers.size
    },
    checkedAt: new Date().toISOString()
  });

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
