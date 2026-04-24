import type { NotificationMessage } from "@tianqi/ports";

export type NotificationHandler = (message: NotificationMessage) => void;

export type NotificationSubscription = {
  unsubscribe(): void;
};

export type NotificationContractProbe = {
  readonly __notificationProbe: true;
  subscribe(handler: NotificationHandler): NotificationSubscription;
};
