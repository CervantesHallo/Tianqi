import { defineNotificationContractTests } from "./notification-contract.js";
import { createReferenceNotification } from "./fixtures/reference-notification.js";

defineNotificationContractTests("reference", () => createReferenceNotification());
