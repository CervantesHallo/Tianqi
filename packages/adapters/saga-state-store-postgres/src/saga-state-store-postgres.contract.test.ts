// Phase 9 / Step 3 — saga-state-store-postgres 基础契约挂载。
// 元规则 J：TIANQI_TEST_POSTGRES_URL 控制 skip。

import { env } from "node:process";

import { describe } from "vitest";

import { defineSagaStateStoreContractTests } from "@tianqi/adapter-testkit";

import { createPostgresSagaStateStore } from "./saga-state-store-postgres.js";

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

const RUN_ID = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
const BASE_SCHEMA = `tianqi_saga_state_base_${RUN_ID}`.toLowerCase();

describe.skipIf(!canReachPostgres)("saga-state-store-postgres base contract", () => {
  defineSagaStateStoreContractTests("saga-state-store-postgres", () =>
    createPostgresSagaStateStore({
      connectionString: testUrl ?? "",
      schema: BASE_SCHEMA
    })
  );
});
