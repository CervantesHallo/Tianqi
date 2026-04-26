// Phase 9 / Step 4 — dead-letter-store-postgres 基础契约挂载。
// 元规则 J：TIANQI_TEST_POSTGRES_URL 控制 skip。

import { env } from "node:process";

import { describe } from "vitest";

import { defineDeadLetterStoreContractTests } from "@tianqi/adapter-testkit";

import { createPostgresDeadLetterStore } from "./dead-letter-store-postgres.js";

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const BASE_SCHEMA = `tianqi_dlq_base_${RUN_ID}`.toLowerCase();

describe.skipIf(!canReachPostgres)("dead-letter-store-postgres base contract", () => {
  defineDeadLetterStoreContractTests("dead-letter-store-postgres", () =>
    createPostgresDeadLetterStore({
      connectionString: testUrl ?? "",
      schema: BASE_SCHEMA
    })
  );
});
