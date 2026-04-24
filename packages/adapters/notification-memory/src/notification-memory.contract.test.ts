import { defineNotificationContractTests } from "@tianqi/adapter-testkit";

import { createInMemoryNotification } from "./notification-memory.js";

defineNotificationContractTests("notification-memory", () => createInMemoryNotification());
