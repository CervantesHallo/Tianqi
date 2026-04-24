import { defineEventStoreContractTests } from "@tianqi/adapter-testkit";

import { createSqliteEventStore } from "./event-store-sqlite.js";

defineEventStoreContractTests("event-store-sqlite", () =>
  createSqliteEventStore({ databasePath: ":memory:" })
);
