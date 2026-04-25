import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDomainEventEnvelope, DOMAIN_EVENT_TYPES } from "@tianqi/contracts";
import type { AdapterFoundation, EventStorePort } from "@tianqi/ports";
import {
  createConfigVersion,
  createEventId,
  createRiskCaseId,
  createTraceId
} from "@tianqi/shared";
import type { ConfigVersion } from "@tianqi/shared";
import { createEventVersion } from "@tianqi/contracts";

import { createInMemoryEventStore } from "@tianqi/event-store-memory";
import { createSqliteEventStore } from "@tianqi/event-store-sqlite";
import { createPostgresEventStore } from "@tianqi/event-store-postgres";

// META-RULE A 反思留痕：Application 层 (Phase 1-7 冻结) 的 OrchestrationPorts 使用
// 自家定义的端口形状（caseRepository / audit 等），并不直接消费 EventStorePort 这种
// Phase 8 标准化 Adapter 端口。Phase 9+ 才会出现 EventStore 的直接 Application 消费者。
// 因此 Step 18 的"DI 切换零业务代码改动"在 Phase 8 阶段表达为：写一个 thin
// "application-layer-style" 消费函数，让所有 Adapter 通过同一份代码被驱动；切换
// 时除工厂参数外**测试代码完全相同**。这就是 §3.7 Adapter 替换原则在 Phase 8 末尾
// 的可观测形态。Phase 9+ 当 Application 真的注入 EventStorePort 时，本测试自动
// 升级为"端到端 DI 切换"，无需结构性重写。

// -- Application-layer-style consumer ------------------------------------------------
// 这个 helper 模拟 Application 层在 Phase 9+ 将做的事情：构造一个 DomainEventEnvelope，
// 通过 EventStorePort 写入。**这正是 Adapter 替换原则的核心负载**——同一份消费逻辑
// 必须能驱动 memory / sqlite / postgres 三个实现而无差异。
const buildSampleEnvelope = (configVersion: ConfigVersion) => {
  const result = createDomainEventEnvelope({
    eventId: createEventId("evt-integration-1"),
    eventType: DOMAIN_EVENT_TYPES.RiskCaseCreated,
    eventVersion: createEventVersion("1.0.0"),
    traceId: createTraceId("trace-int-1"),
    caseId: createRiskCaseId("case-int-1"),
    occurredAt: "2026-04-25T10:00:00.000Z",
    producer: "integration-test",
    payload: {
      caseType: "risk",
      configVersion: String(configVersion as number),
      detectedAt: "2026-04-25T10:00:00.000Z"
    },
    metadata: {
      sourceModule: "step-18-integration",
      schemaVersion: "1.0.0"
    }
  });
  if (!result.ok) {
    throw new Error(`failed to build envelope: ${result.error.message}`);
  }
  return result.value;
};

const consumeEventStoreFromApplicationLayer = async (
  store: EventStorePort
): Promise<{ readonly appendOk: boolean }> => {
  const envelope = buildSampleEnvelope(createConfigVersion(1));
  const result = await store.append(envelope);
  return { appendOk: result.ok };
};

// -- Adapter factories --------------------------------------------------------------

const POSTGRES_URL = env["TIANQI_TEST_POSTGRES_URL"];

type AdapterCase = {
  readonly name: string;
  readonly factory: () => Promise<{
    readonly store: EventStorePort & AdapterFoundation;
    readonly cleanup: () => Promise<void>;
  }>;
  readonly skip: boolean;
};

let scratchDir: string;

beforeAll(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), "tianqi-step18-eventstore-"));
});

afterAll(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

const cases: readonly AdapterCase[] = [
  {
    name: "memory",
    factory: async () => {
      const store = createInMemoryEventStore();
      return { store, cleanup: async () => undefined };
    },
    skip: false
  },
  {
    name: "sqlite (in-memory mode allowed by §8.1 in Phase 8)",
    factory: async () => {
      const store = createSqliteEventStore({ databasePath: ":memory:" });
      return { store, cleanup: async () => undefined };
    },
    skip: false
  },
  {
    name: "postgres",
    factory: async () => {
      const store = createPostgresEventStore({
        connectionString: POSTGRES_URL ?? "postgres://invalid/invalid"
      });
      return { store, cleanup: async () => undefined };
    },
    skip: !POSTGRES_URL
  }
];

// -- Adapter swap integration tests -------------------------------------------------

describe.each(cases)("EventStore Adapter swap: $name", ({ factory, skip }) => {
  // §3.7 Adapter 替换原则的运行时验证：所有 case 用**完全相同**的消费代码
  // (consumeEventStoreFromApplicationLayer)，仅 factory 不同。任何 case 需要特殊
  // setup 才能跑通即视为契约违反。

  it.skipIf(skip)(
    "test_application_layer_consumes_event_store_through_port_without_modification",
    async () => {
      const { store, cleanup } = await factory();
      await store.init();
      try {
        const result = await consumeEventStoreFromApplicationLayer(store);
        expect(result.appendOk).toBe(true);
      } finally {
        await store.shutdown();
        await cleanup();
      }
    }
  );

  it.skipIf(skip)(
    "test_event_store_health_check_reports_running_after_init_swap_invariant",
    async () => {
      const { store, cleanup } = await factory();
      await store.init();
      try {
        const health = await store.healthCheck();
        expect(health.healthy).toBe(true);
        expect(health.adapterName).toMatch(/event-store-(memory|sqlite|postgres)/);
      } finally {
        await store.shutdown();
        await cleanup();
      }
    }
  );
});
