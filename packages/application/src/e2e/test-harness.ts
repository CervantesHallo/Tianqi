// Phase 11 / Step 1 — createE2eHarness：端到端测试 fixture 框架。
//
// 用途（裁决 K.3 α 共享 helper）：
// 让 Step 2-6 端到端 4 路径覆盖（顺利 / 补偿 / 死信 / 恢复）共享一份
// "真实基础设施 fixture builder"——单一工厂函数 createE2eHarness 让
// 多 Saga 真实编排 + 真实 EventStore + 真实 SagaStateStore + 真实
// DeadLetterStore + 真实 Notification 统一就位。
//
// 与 saga-end-to-end.integration.test.ts（Phase 9 / Step 16；裁决 4 A
// 仅 memory）形成互补：
//   - saga-end-to-end: memory adapter 快速验证编排逻辑（不涉及真实基础设施）
//   - test-harness:    真实 adapter 验证 §8.1 Mock 边界硬约束兑现下的
//                      端到端集成（Step 2-6 主战场）
//
// 设计原则：
//   - K.1 α 不引入 Testcontainers：harness 只配置 adapter，不启动容器；
//     使用方（测试 / 本地 dev / CI services）负责让 Postgres + Kafka ready
//   - K.4 ci.yml 维持 4 jobs：harness 仅依赖 ci.yml 既有 services.postgres
//     + services.kafka（与 Step 0 + 0.5 一致）
//   - §8.1 Mock 使用边界硬约束严守：事件存储 / Saga 状态持久化 / 死信存储
//     / 消息系统 4 类组件全部真实 adapter（zero mock）
//   - 测试 isolation：RUN_ID + counter 模式（Step 0 + 0.5 实战延伸）
//   - cleanup 自管：drop postgres schemas + delete kafka topics（best-effort）
//
// Phase 11+ 演进预留：
//   - fakeEngineHttp 选项 → Step 2-6 接入 external-engine-http-base 假引擎
//   - clockMode 选项 → Step 4-6 补偿 / 死信 / 恢复时序场景 + Step 7 性能
//   - cleanup 鲁棒性 → Step 2-6 实战压测后扩展

import { Kafka } from "kafkajs";
import pg from "pg";

import { createPostgresEventStore } from "@tianqi/event-store-postgres";
import type { PostgresEventStore } from "@tianqi/event-store-postgres";

import { createPostgresSagaStateStore } from "@tianqi/saga-state-store-postgres";
import type { PostgresSagaStateStore } from "@tianqi/saga-state-store-postgres";

import { createPostgresDeadLetterStore } from "@tianqi/dead-letter-store-postgres";
import type { PostgresDeadLetterStore } from "@tianqi/dead-letter-store-postgres";

import { createKafkaNotification } from "@tianqi/notification-kafka";
import type { KafkaNotification } from "@tianqi/notification-kafka";

import { ok } from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type {
  AuditEventRecord,
  AuditEventSinkError,
  AuditEventSinkPort
} from "@tianqi/ports";

const { Client: PgClient } = pg;

/**
 * E2eHarnessOptions — 端到端 fixture 构造参数。
 *
 * postgresUrl / kafkaBrokers 必须就位（CI services 或 docker-compose β
 * 提供）；harness 不启动容器（K.1 α 不引入 Testcontainers 决策一致）。
 *
 * fakeEngineHttp：Step 2-6 可选挂载假引擎 HTTP 服务（按 §8.1 假引擎
 * 可接受；HTTP 协议）。当前 v1 仅占位；Step 2 实地起接入 external-engine-
 * http-base 既有 helper。
 *
 * clockMode：Step 4-6 补偿 / 死信 / 恢复时序场景 + Step 7 性能基线
 * 可能需要时间快进。当前 v1 仅占位；Step 4 实地起接入 fake-timers。
 */
export type E2eHarnessOptions = Readonly<{
  postgresUrl: string;
  kafkaBrokers: readonly string[];
  /**
   * Reserved for Step 2-6：fake external engine HTTP server config.
   * Phase 11 / Step 1 接口预留，不实施（K.6 0 新 Adapter 严守）。
   */
  fakeEngineHttp?: { port: number };
  /**
   * Reserved for Step 4-6 + Step 7：clock control mode.
   * "real" = 默认（真实时间；与 Step 0 + 0.5 一致）
   * "controlled" = fake-timers（Step 4 起评估接入）
   * Phase 11 / Step 1 仅声明类型；实施推迟到 Step 4。
   */
  clockMode?: "real" | "controlled";
}>;

/**
 * E2eHarness — 端到端 fixture 实例。
 *
 * 4 个真实 adapter + 1 个 in-memory 审计 sink + cleanup 函数。
 * 所有 adapter 已 init() 完毕；harness 返回时即刻可用。
 *
 * 测试用法（Step 2-6 模式预告）：
 *   const harness = await createE2eHarness({ postgresUrl, kafkaBrokers });
 *   try {
 *     // saga 业务调用 harness.eventStore / sagaStateStore / etc.
 *     // 断言 harness.auditSink.events 含期望审计事件（§15 审计要求）
 *   } finally {
 *     await harness.cleanup();  // drop schemas + delete topics
 *   }
 */
export type E2eHarness = Readonly<{
  eventStore: PostgresEventStore;
  sagaStateStore: PostgresSagaStateStore;
  deadLetterStore: PostgresDeadLetterStore;
  notification: KafkaNotification;
  /**
   * In-memory 审计 sink：与 saga-end-to-end.integration.test.ts 模式一致
   * （Phase 9 / Step 16 createInMemoryAuditSink）。Step 2-6 测试可读
   * events 数组断言审计事件。
   *
   * Phase 11+ 如需持久化审计（譬如 Step 9-10 metrics + trace）→ 替换为
   * 真实 audit-event-store adapter；当前 v1 in-memory 足够。
   */
  auditSink: AuditEventSinkPort & { readonly events: readonly AuditEventRecord[] };
  /**
   * Best-effort cleanup：drop postgres schemas + delete kafka topics。
   * 测试 finally 必调；如失败 swallow（cleanup 不应抛阻塞测试）。
   */
  cleanup: () => Promise<void>;
}>;

/**
 * Unique RUN_ID + counter 模式（Step 0 + 0.5 实战延伸）：让并发跑的 harness
 * 实例不共享 postgres schema / kafka topic 名（避免测试间状态干扰）。
 */
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
let harnessCounter = 0;

const createInMemoryAuditSink = (): AuditEventSinkPort & {
  readonly events: AuditEventRecord[];
} => {
  const events: AuditEventRecord[] = [];
  return {
    events,
    async append(event: AuditEventRecord): Promise<Result<void, AuditEventSinkError>> {
      events.push(event);
      return ok(undefined);
    }
  };
};

/**
 * Phase 11 / Step 1 — createE2eHarness factory。
 *
 * 调用方负责让 Postgres (postgresUrl) + Kafka (kafkaBrokers) ready。
 * 本机 dev: `docker compose up -d postgres kafka` (Step 1 K.2 β)。
 * CI: services.postgres + services.kafka (Step 0 + 0.5 既有)。
 *
 * 创建 4 个真实 adapter（unique 命名空间隔离）+ 1 个 in-memory 审计 sink；
 * 返回 cleanup 函数。
 */
export const createE2eHarness = async (
  options: E2eHarnessOptions
): Promise<E2eHarness> => {
  harnessCounter += 1;
  const ns = `e2e_${RUN_ID}_h${harnessCounter}`.toLowerCase().replace(/-/g, "_");

  const postgresSchema = ns;
  const kafkaTopic = `tianqi-${ns}`;
  const kafkaConsumerGroup = `${ns}-group`;
  const kafkaClientId = `${ns}-client`;

  // 4 个真实 adapter 创建 + init。顺序：先 store 后 notification；
  // notification 内部用 admin.createTopics (Step 0.5 K.9 fix) 等 metadata
  // 传播。
  const eventStore = createPostgresEventStore({
    connectionString: options.postgresUrl,
    schema: postgresSchema
  });
  const sagaStateStore = createPostgresSagaStateStore({
    connectionString: options.postgresUrl,
    schema: postgresSchema
  });
  const deadLetterStore = createPostgresDeadLetterStore({
    connectionString: options.postgresUrl,
    schema: postgresSchema
  });
  const notification = createKafkaNotification({
    brokers: options.kafkaBrokers,
    clientId: kafkaClientId,
    topic: kafkaTopic,
    consumerGroupId: kafkaConsumerGroup,
    allowAutoTopicCreation: true
  });

  await Promise.all([
    eventStore.init(),
    sagaStateStore.init(),
    deadLetterStore.init()
  ]);
  // Kafka init 与 Postgres 并发可能与 admin.createTopics 内部 race；
  // 序列化 Kafka init 在 Postgres 之后（与 Step 0.5 实战一致）。
  await notification.init();

  const auditSink = createInMemoryAuditSink();

  const cleanup = async (): Promise<void> => {
    // shutdown 顺序：notification 先（subscribers 解绑）→ stores 后。
    await notification.shutdown().catch(() => {
      // Best-effort cleanup.
    });
    await Promise.all([
      eventStore.shutdown().catch(() => {
        // Best-effort cleanup.
      }),
      sagaStateStore.shutdown().catch(() => {
        // Best-effort cleanup.
      }),
      deadLetterStore.shutdown().catch(() => {
        // Best-effort cleanup.
      })
    ]);

    // Drop postgres schema (CASCADE deletes tables).
    const pgClient = new PgClient({ connectionString: options.postgresUrl });
    try {
      await pgClient.connect();
      await pgClient.query(`DROP SCHEMA IF EXISTS "${postgresSchema}" CASCADE`);
    } catch {
      // Best-effort cleanup.
    } finally {
      await pgClient.end().catch(() => {
        // Best-effort cleanup.
      });
    }

    // Delete kafka topic (timeout best-effort; CI 环境时序较慢容忍 10s).
    const kafkaAdmin = new Kafka({
      clientId: `${kafkaClientId}-cleanup`,
      brokers: [...options.kafkaBrokers]
    }).admin();
    try {
      await kafkaAdmin.connect();
      await kafkaAdmin
        .deleteTopics({ topics: [kafkaTopic], timeout: 10_000 })
        .catch(() => {
          // Best-effort cleanup;topic 可能已不存在.
        });
    } catch {
      // Best-effort cleanup.
    } finally {
      await kafkaAdmin.disconnect().catch(() => {
        // Best-effort cleanup.
      });
    }
  };

  return {
    eventStore,
    sagaStateStore,
    deadLetterStore,
    notification,
    auditSink,
    cleanup
  };
};
