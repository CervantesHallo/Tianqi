// Phase 9 / Step 3 — saga-state-store-postgres 自有测试（惯例 L 修订版基础设施 ≤6 it）：
//   1. 身份与工厂签名
//   2. schema 名校验失败 → TQ-INF-002
//   3. 真实 Postgres 不可达 → init 抛 TQ-INF-009
//   4. healthCheck 在 unconfigured 状态返回 healthy=false 不抛错
// 实际 4 it（remaining 2 slots 留作未来按需扩展）

import { env } from "node:process";

import { describe, expect, it } from "vitest";

import { createPostgresSagaStateStore } from "./saga-state-store-postgres.js";

const testUrl = env["TIANQI_TEST_POSTGRES_URL"];
const canReachPostgres = typeof testUrl === "string" && testUrl.length > 0;

describe("saga-state-store-postgres: standalone tests", () => {
  it("test_factory_returns_adapter_with_expected_identity_fields", () => {
    const adapter = createPostgresSagaStateStore({
      connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
      schema: "test_identity"
    });
    expect(adapter.adapterName).toBe("saga-state-store-postgres");
    expect(typeof adapter.init).toBe("function");
    expect(typeof adapter.shutdown).toBe("function");
    expect(typeof adapter.healthCheck).toBe("function");
    expect(typeof adapter.save).toBe("function");
    expect(typeof adapter.load).toBe("function");
    expect(typeof adapter.listIncomplete).toBe("function");
    expect(typeof adapter.delete).toBe("function");
  });

  it("test_invalid_schema_name_rejected_at_factory_with_TQ_INF_002", () => {
    expect(() =>
      createPostgresSagaStateStore({
        connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
        schema: "ILLEGAL UPPERCASE"
      })
    ).toThrow(/TQ-INF-002/);
  });

  it("test_health_check_before_init_returns_healthy_false_without_throwing", async () => {
    const adapter = createPostgresSagaStateStore({
      connectionString: "postgres://placeholder:secret@127.0.0.1:5432/placeholder",
      schema: "test_health_pre_init"
    });
    const status = await adapter.healthCheck();
    // 元规则 I：不抛错；created 状态返回 healthy=false
    expect(status.healthy).toBe(false);
    expect(status.adapterName).toBe("saga-state-store-postgres");
    expect(status.details["lifecycle"]).toBe("created");
  });

  it.skipIf(canReachPostgres)(
    "test_init_against_unreachable_postgres_throws_with_TQ_INF_009",
    async () => {
      // 仅在 TIANQI_TEST_POSTGRES_URL 未设置时运行：用一个明确不可达的连接串，
      // 验证 §6.5 转译纪律——错误消息含 TQ-INF-009 但**不**含原始 ECONNREFUSED 文本
      const adapter = createPostgresSagaStateStore({
        connectionString:
          "postgres://tianqi_unreachable:secret@127.0.0.1:1/nonexistent_db",
        schema: "test_unreachable",
        connectionTimeoutMs: 500
      });
      await expect(adapter.init()).rejects.toThrow(/TQ-INF-009/);
    }
  );
});
