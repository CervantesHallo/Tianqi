// Phase 9 / Step 3 — saga-state-store-postgres 持久化契约挂载（元规则 E）。
// 复用 event-store-postgres.persistent.test.ts 已建立的"databasePath →
// schema 后缀"映射模式：testkit 传入的 session.databasePath 形如
// `<scratchDirectory>/persistent-saga-session-<N>.db`，本 Adapter 把
// 末尾的数字解析为 schema 名后缀，让每个测试用例操作于独立 schema。

import { env } from "node:process";

import { afterAll, describe } from "vitest";

import pg from "pg";

import {
  definePersistentSagaStateStoreContractTests,
  type PersistentSagaStateStoreTestSession
} from "@tianqi/adapter-testkit";

import { createPostgresSagaStateStore } from "./saga-state-store-postgres.js";

const { Client } = pg;

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const SCHEMA_PREFIX = `tianqi_saga_state_p_${RUN_ID}`.toLowerCase();
// session.databasePath 形如 `.../persistent-saga-session-<N>.db`：取尾数为 schema 后缀
const SESSION_SCHEMA_PATTERN = /persistent-saga-session-(\d+)\.db$/;

const usedSchemas = new Set<string>();

const deriveSchemaFromSession = (
  session: PersistentSagaStateStoreTestSession
): string => {
  const match = SESSION_SCHEMA_PATTERN.exec(session.databasePath);
  const sessionNumber = match?.[1] ?? "0";
  const schema = `${SCHEMA_PREFIX}_s${sessionNumber}`;
  usedSchemas.add(schema);
  return schema;
};

const factory = (session: PersistentSagaStateStoreTestSession) => {
  const schema = deriveSchemaFromSession(session);
  return createPostgresSagaStateStore({
    connectionString: testUrl ?? "",
    schema
  });
};

afterAll(async () => {
  if (!canReachPostgres || usedSchemas.size === 0) return;
  // 清理本测试 RUN 内创建的全部 schemas（含表）。
  const client = new Client({ connectionString: testUrl ?? "" });
  await client.connect();
  try {
    for (const schema of usedSchemas) {
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {
        // 忽略清理时的错误；不影响测试结论
      }
    }
  } finally {
    await client.end();
  }
});

describe.skipIf(!canReachPostgres)(
  "saga-state-store-postgres persistent contract",
  () => {
    definePersistentSagaStateStoreContractTests(
      "saga-state-store-postgres",
      factory,
      { scratchDirectory: "/tmp/tianqi-saga-state-store-postgres" }
    );
  }
);
