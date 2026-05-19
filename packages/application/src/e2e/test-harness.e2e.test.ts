// Phase 11 / Step 1 — test-harness 自检测试。
//
// 用途：验证 createE2eHarness fixture 框架本身可用。不实现具体 4 端到端
// 路径（Step 2-6 责任；本文件仅 fixture self-check）。
//
// 元规则 J：TIANQI_TEST_POSTGRES_URL + TIANQI_TEST_KAFKA_BROKERS 双控
// 制 skip。如任一未设置 → 整个 describe 跳过（与既有 .persistent +
// .contract test 同模式）。
//
// CI services (Step 0 + 0.5) + 本地 docker-compose β (Step 1 K.2) 都
// 满足 env vars 条件;harness 即可激活.

import { env } from "node:process";

import { afterAll, describe, expect, it } from "vitest";

import { createE2eHarness } from "./test-harness.js";

const postgresUrl = env["TIANQI_TEST_POSTGRES_URL"];
const kafkaBrokersEnv = env["TIANQI_TEST_KAFKA_BROKERS"];
const kafkaBrokers =
  kafkaBrokersEnv !== undefined && kafkaBrokersEnv.length > 0
    ? kafkaBrokersEnv.split(",")
    : [];

const canRunE2e =
  typeof postgresUrl === "string" && postgresUrl.length > 0 && kafkaBrokers.length > 0;

const harnessesCreated: Array<{ cleanup: () => Promise<void> }> = [];

afterAll(async () => {
  // Defensive cleanup: 如某 it 因失败未触发自己的 cleanup,统一在 afterAll
  // 兜底（best-effort）。
  for (const h of harnessesCreated) {
    await h.cleanup().catch(() => {
      // Best-effort.
    });
  }
}, 60_000);

describe.skipIf(!canRunE2e)("createE2eHarness — Step 1 self-check", () => {
  it(
    "test_harness_returns_all_four_real_adapters_initialized_and_healthy",
    async () => {
      const harness = await createE2eHarness({
        postgresUrl: postgresUrl!,
        kafkaBrokers
      });
      harnessesCreated.push(harness);
      try {
        // 4 adapter healthCheck 全部 healthy = true
        const [es, sss, dls, n] = await Promise.all([
          harness.eventStore.healthCheck(),
          harness.sagaStateStore.healthCheck(),
          harness.deadLetterStore.healthCheck(),
          harness.notification.healthCheck()
        ]);
        expect(es.healthy).toBe(true);
        expect(sss.healthy).toBe(true);
        expect(dls.healthy).toBe(true);
        expect(n.healthy).toBe(true);
      } finally {
        await harness.cleanup();
      }
    },
    60_000
  );

  it(
    "test_harness_auditSink_starts_empty_and_accepts_appends",
    async () => {
      const harness = await createE2eHarness({
        postgresUrl: postgresUrl!,
        kafkaBrokers
      });
      harnessesCreated.push(harness);
      try {
        expect(harness.auditSink.events).toEqual([]);
        const result = await harness.auditSink.append({
          eventType: "saga.started",
          occurredAt: "2026-05-19T00:00:00.000Z",
          traceId: "trace-self-check-1",
          payload: { sagaId: "saga-self-check-1" }
        });
        expect(result.ok).toBe(true);
        expect(harness.auditSink.events).toHaveLength(1);
        expect(harness.auditSink.events[0]?.eventType).toBe("saga.started");
      } finally {
        await harness.cleanup();
      }
    },
    60_000
  );

  it(
    "test_harness_postgres_schema_isolation_concurrent_harnesses_do_not_collide",
    async () => {
      // 并发两个 harness 实例 → 各自独立 schema (harnessCounter)
      // → adapter init 不冲突。
      const [h1, h2] = await Promise.all([
        createE2eHarness({ postgresUrl: postgresUrl!, kafkaBrokers }),
        createE2eHarness({ postgresUrl: postgresUrl!, kafkaBrokers })
      ]);
      harnessesCreated.push(h1, h2);
      try {
        const [hc1, hc2] = await Promise.all([
          h1.eventStore.healthCheck(),
          h2.eventStore.healthCheck()
        ]);
        expect(hc1.healthy).toBe(true);
        expect(hc2.healthy).toBe(true);
        // 两个 harness 的 in-memory auditSink 独立
        expect(h1.auditSink.events).not.toBe(h2.auditSink.events);
      } finally {
        await Promise.all([h1.cleanup(), h2.cleanup()]);
      }
    },
    90_000
  );

  it(
    "test_harness_cleanup_drops_postgres_schema_and_deletes_kafka_topic",
    async () => {
      // cleanup 不应抛 (best-effort);二次调用 cleanup 也不应抛 (idempotent
      // 性质;allow finally + afterAll 重复触发)。
      const harness = await createE2eHarness({
        postgresUrl: postgresUrl!,
        kafkaBrokers
      });
      harnessesCreated.push(harness);
      await expect(harness.cleanup()).resolves.toBeUndefined();
      // Second cleanup call should not throw
      await expect(harness.cleanup()).resolves.toBeUndefined();
    },
    60_000
  );
});
