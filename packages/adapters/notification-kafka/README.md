# @tianqi/notification-kafka

## 它是什么

`@tianqi/notification-kafka` 是 Tianqi 的第二个 Notification Adapter——`NotificationPort` 的 Kafka 实现，使用 `kafkajs` 作为客户端。它是 Phase 8 首个面向分布式消息系统的 Adapter。

对外唯一构造入口是 `createKafkaNotification(options)`。`brokers` / `clientId` / `topic` / `consumerGroupId` 都是必填字段。

## 它不是什么

- **不是 schema registry 客户端**：本 Adapter 使用 `JSON.stringify` 序列化 `NotificationMessage`。Avro / Protobuf / schema 演进由未来 Step 自行决策。
- **不是零配置的分布式消息层**：broker 列表、客户端标识、topic、consumer group 必须显式配置；没有隐式默认值。
- **不是生产端去重层**：NotificationMessage 无 eventId。业务去重由调用方自负。

## 为何引入 `kafkajs`

`kafkajs` 是 Node.js 生态中使用 Kafka 最成熟的纯 JS 客户端，MIT 许可、月下载量百万级、由 Tulios 维护。无替代者能同时满足：纯 JS（无 native 编译，不扩张 `pnpm.onlyBuiltDependencies`）、完整的 producer/consumer/admin 三套 API、TypeScript 类型原生支持。版本精确锁定 `kafkajs@2.2.4`（元规则 G）。

## 依赖边界

- **生产依赖**：`@tianqi/contracts`、`@tianqi/ports`、`@tianqi/shared`、`kafkajs@2.2.4`。
- **测试依赖**：`@tianqi/adapter-testkit`（devDependency）。
- **严禁**：`@tianqi/domain` / `@tianqi/application` / `@tianqi/policy`；任何其他 Kafka 客户端（`@confluent/kafka-js` 等）；schema registry 客户端；ORM。

## 双路径分发设计

Kafka 是分布式异步消息总线；`NotificationPort` 是进程内 publish/subscribe 模型（Step 7 契约假设"publish 返回后订阅者已收到"）。两者语义存在缺口。本 Adapter 采用**双路径分发**弥合：

1. **Kafka 路径**：`publish` 调用先发送到 Kafka broker 并等待 ack，用于跨进程订阅者 fan-out。
2. **本地路径**：Kafka ack 成功后，publish 立即同步调用本 Adapter 实例内已注册的所有 handler（通过 `subscribe` 注册的）。
3. **Consumer 回环去重**：本 Adapter 的 consumer 从 Kafka 读回自己发的消息时，通过 message header 中的 `originInstance`（本 Adapter 实例的 UUID）识别"这是我自己发的"，跳过不再本地 dispatch。
4. **跨进程分发**：不同进程中的 Adapter 实例 A 发送 → B 的 consumer 接收，B 的 `originInstance` 不匹配，正常 dispatch 到 B 的 handlers。

这样单 Adapter 场景下（契约测试）publish 返回即完成本地分发；多 Adapter 场景下（生产）跨进程订阅者通过 Kafka 正常收到消息。

## 如何被 Application 层使用

```ts
import { createKafkaNotification } from "@tianqi/notification-kafka";
import type { NotificationPort, AdapterFoundation } from "@tianqi/ports";

const adapter: NotificationPort & AdapterFoundation = createKafkaNotification({
  brokers: ["broker-1:9092", "broker-2:9092"],
  clientId: "tianqi-risk",
  topic: "tianqi.notifications",
  consumerGroupId: "tianqi-risk-service"
});
await adapter.init();
await adapter.publish({ caseId, traceId, eventType, content });
await adapter.shutdown();
```

## Delivery Semantics

本 Adapter 主动声明以下三条（元规则 N）。与 `@tianqi/notification-memory` 的声明**相同方向但语境更严肃**——Kafka 的 at-least-once 是真实分布式保证，而非内存版的 "exactly-once in practice"。

### 1. 生产端幂等保证

**本 Adapter 不做基于消息内容的生产端去重**。`NotificationMessage` 无 eventId。调用方需在业务层持幂等键。

KafkaJS 支持 idempotent producer（本 Adapter 可配置开启），但那是**Kafka 分区内的 producer 幂等**——它保证同一 producer 在网络重试时不产生分区内重复。它**不等价于** Tianqi 层面的"相同业务消息去重"。两者请分开理解。

### 2. 消费端可见性保证

**`publish(message)` 返回后**：

- 消息已被 broker ack（至少写入 `acks: 1` 或 `acks: -1` 的 leader）。
- 本 Adapter 实例内已注册的 handler 已通过"本地路径"被同步调用。
- **其他进程中的** Notification Adapter 实例会在自己的 consumer 下一轮 poll 后收到消息（典型毫秒级别，但受 `max.poll.interval.ms` 等配置与 rebalance 状态影响）。
- **Consumer 未运行或正处于 rebalance** 的订阅者，在 consumer 恢复后从上次 offset 继续消费——不会丢消息，但可能有延迟。

与 `notification-memory` 的差异：内存 Adapter 的可见性是"publish 返回即所有订阅者已收到"；Kafka Adapter 只对**本实例内**订阅者给此保证，跨实例订阅者有分布式延迟。

### 3. 故障场景传递语义

**at-least-once**。Kafka 的 at-least-once 是真实保证：broker 持久化、consumer offset 崩溃恢复、网络重传。

消费端去重由订阅者自负。若订阅者需要 exactly-once 语义，应在订阅者侧维护业务幂等键。本 Adapter 不承诺 exactly-once。

### Handler 异常处置

若某 handler 抛出异常，本 Adapter **静默吞掉该异常、继续调用下一个 handler**——与 `@tianqi/notification-memory` 保持一致。

选择理由：

- Sprint C 一致性：同 Port 的两个 Adapter 在 handler 异常场景下行为一致，让 Application 层订阅侧代码不必根据底层 Adapter 调整。
- 分层清晰：`publish` 的 `NotificationPortError` 保留给 Adapter 自身故障（broker 不可达、publish 超时等），不被订阅者业务错误污染。
- 与 `consumer.eachMessage` 的 offset 行为配合：KafkaJS 会在 eachMessage 正常返回后推进 offset；若 handler 异常未被 catch 会导致 KafkaJS 重试同一消息直至 retry 耗尽。静默吞保证 offset 正常推进。

**注意**：静默吞意味着订阅者 bug 会"看起来消息被消费了但实际没被正确处理"。订阅者必须在自己的 handler 内 `try/catch` 并把异常送到自己的日志/监控通道。Tianqi 不代为承担这一责任。

未选择 "DLQ" / "pause consumer" 的理由：前者需要引入第二个 Kafka topic 的管理，扩张 Adapter 职责；后者会把一个 handler 的 bug 扩散到整个 Adapter 的消费链路，故障放大。二者的适用场景属于更复杂的分布式系统治理，不在本 Adapter 职责范围。

## 测试与 `TIANQI_TEST_KAFKA_BROKERS`

本 Adapter 的契约测试与自有测试都与真实 Kafka broker 交互。若环境变量 `TIANQI_TEST_KAFKA_BROKERS`（形如 `"broker-1:9092,broker-2:9092"`）未设置，所有测试通过 `describe.skipIf` 整块跳过——CI 不会因 Kafka 不可达而红（元规则 J）。

每个契约测试使用独立的 topic / consumer group / client ID 组合以保证隔离：`tianqi-notif-test-${runId}-${counter}`。测试结束后通过 admin client 清理所有本次 run 创建的 topic。
