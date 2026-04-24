import { env } from "node:process";

import { describe } from "vitest";

import { defineEventStoreContractTests } from "@tianqi/adapter-testkit";

import { createPostgresEventStore } from "./event-store-postgres.js";

// Contract tests talk to a real Postgres server. If TIANQI_TEST_POSTGRES_URL is unset the
// entire suite is skipped so CI without a Postgres service container does not go red.
const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const BASE_SCHEMA = `tianqi_step6_base_${RUN_ID}`.toLowerCase();

describe.skipIf(!canReachPostgres)("event-store-postgres base contract", () => {
  defineEventStoreContractTests("event-store-postgres", () =>
    createPostgresEventStore({
      connectionString: testUrl ?? "",
      schema: BASE_SCHEMA
    })
  );
});
