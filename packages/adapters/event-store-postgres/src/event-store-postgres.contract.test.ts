import { env } from "node:process";

import { afterAll, describe } from "vitest";

import pg from "pg";

import { defineEventStoreContractTests } from "@tianqi/adapter-testkit";

import { createPostgresEventStore } from "./event-store-postgres.js";

const { Client } = pg;

// Contract tests talk to a real Postgres server. If TIANQI_TEST_POSTGRES_URL is unset the
// entire suite is skipped so CI without a Postgres service container does not go red.
const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const SCHEMA_PREFIX = `tianqi_step6_base_${RUN_ID}`.toLowerCase();

// Phase 11 / Step 0 fix: testkit beforeEach calls factory() per-it to create a fresh
// adapter, but the in-memory adapter gains isolation "for free" via a new Map per
// instance — Postgres adapters need an explicit per-it schema to match that semantic.
// Otherwise, data from prior `it` blocks survives in the shared schema and breaks any
// "expect empty" / "expect length 1 after idempotent re-append" assertions.
// We mint one schema per factory call (counter) and drop them all in afterAll.
let factoryCounter = 0;

afterAll(async () => {
  if (!canReachPostgres) return;
  const client = new Client({ connectionString: testUrl ?? "" });
  await client.connect();
  try {
    const schemas = await client.query<{ schema_name: string }>(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE $1",
      [`${SCHEMA_PREFIX}%`]
    );
    for (const row of schemas.rows) {
      await client.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
    }
  } finally {
    await client.end();
  }
});

describe.skipIf(!canReachPostgres)("event-store-postgres base contract", () => {
  defineEventStoreContractTests("event-store-postgres", () =>
    createPostgresEventStore({
      connectionString: testUrl ?? "",
      schema: `${SCHEMA_PREFIX}_it${++factoryCounter}`
    })
  );
});
