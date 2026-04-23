import { defineEventStoreContractTests } from "@tianqi/adapter-testkit";

import { createInMemoryEventStore } from "./event-store-memory.js";

defineEventStoreContractTests("event-store-memory", () => createInMemoryEventStore());
