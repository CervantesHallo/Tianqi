// Phase 9 / Step 4 — dead-letter-store-postgres 持久化契约挂载（元规则 E
// 第三次实战）。复用 saga-state-store-postgres.persistent.test.ts 已建立
// 的"databasePath → schema 后缀"映射模式。

import { env } from "node:process";

import { afterAll, describe } from "vitest";

import pg from "pg";

import {
  definePersistentDeadLetterStoreContractTests,
  type PersistentDeadLetterStoreTestSession
} from "@tianqi/adapter-testkit";

import { createPostgresDeadLetterStore } from "./dead-letter-store-postgres.js";

const { Client } = pg;

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const SCHEMA_PREFIX = `tianqi_dlq_p_${RUN_ID}`.toLowerCase();
const SESSION_SCHEMA_PATTERN = /persistent-dlq-session-(\d+)\.db$/;

const usedSchemas = new Set<string>();

const deriveSchemaFromSession = (
  session: PersistentDeadLetterStoreTestSession
): string => {
  const match = SESSION_SCHEMA_PATTERN.exec(session.databasePath);
  const sessionNumber = match?.[1] ?? "0";
  const schema = `${SCHEMA_PREFIX}_s${sessionNumber}`;
  usedSchemas.add(schema);
  return schema;
};

const factory = (session: PersistentDeadLetterStoreTestSession) => {
  const schema = deriveSchemaFromSession(session);
  return createPostgresDeadLetterStore({
    connectionString: testUrl ?? "",
    schema
  });
};

afterAll(async () => {
  if (!canReachPostgres || usedSchemas.size === 0) return;
  const client = new Client({ connectionString: testUrl ?? "" });
  await client.connect();
  try {
    for (const schema of usedSchemas) {
      try {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } catch {
        // 忽略清理错误
      }
    }
  } finally {
    await client.end();
  }
});

describe.skipIf(!canReachPostgres)(
  "dead-letter-store-postgres persistent contract",
  () => {
    definePersistentDeadLetterStoreContractTests(
      "dead-letter-store-postgres",
      factory,
      { scratchDirectory: "/tmp/tianqi-dead-letter-store-postgres" }
    );
  }
);
