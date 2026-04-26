// Phase 9 / Step 4 — dead-letter-store-postgres 自有测试（惯例 L 修订版基础设施 ≤6 it）：
//   1. 身份与工厂签名
//   2. schema 名校验失败 → TQ-INF-002
//   3. healthCheck before init 返回 healthy=false 不抛
//   4. 真实 Postgres 不可达 → init 抛 TQ-INF-009（仅在无 env var 时运行）
// 实际 4 it（remaining 2 slots 留作未来按需扩展）

import { env } from "node:process";

import { describe, expect, it } from "vitest";

import { createPostgresDeadLetterStore } from "./dead-letter-store-postgres.js";

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

describe("dead-letter-store-postgres: standalone tests", () => {
  it("test_factory_returns_adapter_with_expected_identity_fields", () => {
    const adapter = createPostgresDeadLetterStore({
      connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
      schema: "test_identity"
    });
    expect(adapter.adapterName).toBe("dead-letter-store-postgres");
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.shutdown).toBe("function");
    expect(typeof adapter.healthCheck).toBe("function");
    expect(typeof adapter.enqueue).toBe("function");
    expect(typeof adapter.load).toBe("function");
    expect(typeof adapter.listPending).toBe("function");
    expect(typeof adapter.listBySaga).toBe("function");
    expect(typeof adapter.markAsProcessed).toBe("function");
  });

  it("test_invalid_schema_name_rejected_at_factory_with_TQ_INF_002", () => {
    expect(() =>
      createPostgresDeadLetterStore({
        connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
        schema: "ILLEGAL UPPERCASE"
      })
    ).toThrow(/TQ-INF-002/);
  });

  it("test_health_check_before_init_returns_healthy_false_without_throwing", async () => {
    const adapter = createPostgresDeadLetterStore({
      connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
      schema: "test_health_pre_init"
    });
    const status = await adapter.healthCheck();
    expect(status.healthy).toBe(false);
    expect(status.adapterName).toBe("dead-letter-store-postgres");
    expect(status.details["lifecycle"]).toBe("created");
  });

  it.skipIf(canReachPostgres)(
    "test_init_against_unreachable_postgres_throws_with_TQ_INF_009",
    async () => {
      const adapter = createPostgresDeadLetterStore({
        connectionString:
          "postgres://tianqi_unreachable:secret@127.0.0.1:1/nonexistent_db",
        schema: "test_unreachable",
        connectionTimeoutMs: 500
      });
      await expect(adapter.init()).rejects.toThrow(/TQ-INF-009/);
    }
  );
});
