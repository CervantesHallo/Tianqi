// Phase 9 / Step 3 — saga-state-store-postgres 基础契约挂载。
// 元规则 J：TIANQI_TEST_POSTGRES_URL 控制 skip。
// Phase 11 / Step 0：每次 factory 调用使用独立 schema（避免 it 间数据污染；
// 与 in-memory adapter 通过 `new Map()` 天然隔离的语义对齐）+ afterAll cleanup。

import { env } from "node:process";

import { afterAll, describe } from "vitest";

import pg from "pg";

import { defineSagaStateStoreContractTests } from "@tianqi/adapter-testkit";

import { createPostgresSagaStateStore } from "./saga-state-store-postgres.js";

const { Client } = pg;

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const SCHEMA_PREFIX = `tianqi_saga_state_base_${RUN_ID}`.toLowerCase();

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

describe.skipIf(!canReachPostgres)("saga-state-store-postgres base contract", () => {
  defineSagaStateStoreContractTests("saga-state-store-postgres", () =>
    createPostgresSagaStateStore({
      connectionString: testUrl ?? "",
      schema: `${SCHEMA_PREFIX}_it${++factoryCounter}`
    })
  );
});
