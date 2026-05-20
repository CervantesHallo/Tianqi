// Phase 11 / Step 2 fix iteration #2 — warmupKafkaTopics 通用 testkit helper.
//
// 用途（ADR-0004 §D.7 修复通用化原则首次正式沉淀）：
// 让所有需要 Kafka adapter 的测试场景（含 createE2eHarness + 未来 Step 3-6
// 端到端测试 + Step 7-8 性能/混沌 + Step 9-10 观测性测试）共享同一份"topic
// metadata propagation 等待"逻辑——避免 KafkaJS Consumer 在 topic metadata
// 完全传播到所有 broker 前订阅触发 `TQ-INF-010 "This server does not host
// this topic-partition"` race condition。
//
// 沉淀来源：
//   - Step 0.5 §D.5 `ensureTopicReady`（notification-kafka.test.ts:37 局部实现）
//   - Step 2 PR #16 CI run #2 createE2eHarness 路径再次兑现 TQ-INF-010
//     → 揭露 Step 0.5 单点修复未通用化的工程纪律盲点
//   - 本 helper 是该盲点修复（修复通用化原则 §D.7）
//
// 设计原则（与 Step 0.5 `ensureTopicReady` 逻辑等价 — §B.1.A 事实锚定纪律严守）：
//   1. **幂等**：重复调用同 topics 不报错（admin.createTopics 已存在 swallow；
//      admin.fetchTopicMetadata 轮询直到 partitions visible）
//   2. **显式 metadata wait**：admin.createTopics(waitForLeaders=true) 等
//      leader 选举完成；fetchTopicMetadata 轮询补充等"metadata 传播到 broker"
//   3. **不修业务代码**：仅 testkit 层 helper；notification-kafka.ts adapter
//      init() 行为 0 变化（§B.1.E 防御应用边界严守）
//   4. **partition leader 实际可见**：要求每个 partition `leader !== -1`
//      （而非仅 `partitions.length > 0`；Step 0.5 实战学习）
//
// Step 0.5 既有 `ensureTopicReady` 实现 **不迁移到本 helper**（Step 0.5
// 测试维持当前实现；Step 11 收官评估统一迁移）。本 helper 是新使用方
// （createE2eHarness 等）的统一入口。

import { setTimeout as scheduleTimer } from "node:timers";

import { Kafka } from "kafkajs";

export type KafkaTopicWarmupOptions = Readonly<{
  /** topic 分区数；默认 1（单 broker KRaft 与 Step 0.5 K.9 fix 一致）。 */
  readonly partitions?: number;
  /** topic 复制因子；默认 1（单 broker KRaft 与 Step 0.5 一致）。 */
  readonly replicationFactor?: number;
  /** 总超时（毫秒）；createTopics + metadata propagation 共用预算。默认 30s。 */
  readonly timeoutMs?: number;
  /**
   * KafkaJS Admin client clientId；默认含时间戳 + 随机后缀避免并发场景
   * client id 冲突。
   */
  readonly clientId?: string;
}>;

const delayMs = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    scheduleTimer(() => resolve(), ms);
  });

/**
 * Pre-create Kafka topics + wait for metadata propagation to broker.
 *
 * 调用方应在 KafkaJS Consumer 订阅 / KafkaJS adapter init() 之前调用，
 * 避免 TQ-INF-010 race。
 *
 * @example
 *   // createE2eHarness 内部：
 *   await warmupKafkaTopics(kafkaBrokers, [kafkaTopic]);
 *   await notification.init();
 *
 * @param brokers Kafka broker 列表（与 adapter 配置一致）
 * @param topics 需要预创 + 等 metadata propagate 的 topic 名列表
 * @param options 可选配置（partitions / replicationFactor / timeoutMs / clientId）
 *
 * @throws Error 若任一 topic 在 timeoutMs 内未达到"partitions visible 且
 *   每个 partition 有 leader"状态。
 */
export const warmupKafkaTopics = async (
  brokers: readonly string[],
  topics: readonly string[],
  options: KafkaTopicWarmupOptions = {}
): Promise<void> => {
  if (topics.length === 0) return;

  const partitions = options.partitions ?? 1;
  const replicationFactor = options.replicationFactor ?? 1;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const clientId =
    options.clientId ?? `tianqi-warmup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const kafka = new Kafka({ clientId, brokers: [...brokers] });
  const admin = kafka.admin();
  await admin.connect();
  try {
    await admin
      .createTopics({
        topics: topics.map((topic) => ({
          topic,
          numPartitions: partitions,
          replicationFactor
        })),
        waitForLeaders: true,
        timeout: timeoutMs
      })
      .catch(() => {
        // Topic 已存在 → idempotent no-op（与 Step 0.5 ensureTopicReady 一致）。
      });

    // 逐个 topic 显式 metadata wait — admin.createTopics(waitForLeaders) 等
    // leader 选举完成，但不保证 metadata 已传播到所有 broker；fetchTopicMetadata
    // 轮询补充等到"partition leader 实际可见"（Step 0.5 实战学习）。
    for (const topic of topics) {
      const start = Date.now();
      let lastError: unknown = null;
      let ready = false;
      while (Date.now() - start < timeoutMs) {
        try {
          const metadata = await admin.fetchTopicMetadata({ topics: [topic] });
          const topicInfo = metadata.topics[0];
          if (
            topicInfo !== undefined &&
            topicInfo.partitions.length > 0 &&
            topicInfo.partitions.every((p: { readonly leader: number }) => p.leader !== -1)
          ) {
            ready = true;
            break;
          }
        } catch (err) {
          lastError = err;
        }
        await delayMs(100);
      }
      if (!ready) {
        throw new Error(
          `warmupKafkaTopics: topic ${topic} metadata not ready within ${timeoutMs}ms; last error: ${String(lastError)}`
        );
      }
    }
  } finally {
    await admin.disconnect().catch(() => {
      // Best-effort cleanup.
    });
  }
};
