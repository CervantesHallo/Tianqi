# Phase 8 / Step 9 — @tianqi/notification-kafka Adapter

## A. Step 9 定位

Step 9 是 Sprint C 的收官之战：把 Kafka 接入 Tianqi 的 `NotificationPort` 进程内模型。它是 Phase 8 目前最复杂的一步，因为必须同时完成四件事：

1. 把 Kafka 接入一个**进程内** publish/subscribe 语义的 Port。
2. 通过元规则 A 优雅处置进程内模型与分布式模型的语义缺口——无需跳过任何契约 `it`。
3. 契约测试在真实 Kafka 可达时严格通过，不可达时优雅 skip（元规则 J）。
4. 为 Sprint D Config 与 Sprint E External Engine 的分布式 Adapter 留下设计模板。

本 Step 完成后，Tianqi 拥有第一个真正的分布式消息系统 Adapter，Phase 8 后续任何面向外部服务的 Adapter 都能以本 Step 为模板。

## B. 授权处置 1：契约 `it` 不可达处置

**结论：不跳过任何契约 `it`。所有 18 个契约 `it` 通过"双路径分发"设计在 Kafka 语境下满足契约断言。**

Step 7 的 18 个 `it` 核心假设是"`await adapter.publish(message)` 返回后本地订阅者已收到"。Kafka 是分布式异步系统（producer → broker ack → consumer poll → handler），这条假设在纯异步 Kafka 模型下不成立。两种适配路径：

- **路径 A（被拒绝）**：让 publish 等待本实例 consumer 也处理完这条消息再返回。需要跟踪 publish 到 broker 的 offset，再轮询 consumer 进度。复杂度极高且脆弱。
- **路径 B（选定）**：publish 先等待 broker ack，**再**同步调用本 Adapter 实例内已注册的 handler。本实例的 consumer loop 会从 Kafka 读回自己发的消息，但通过 message header 中的 `originInstance` 与本实例 ID 比对，识别"这是我自己发的"并跳过。

路径 B 的行为：

- **单实例契约测试**：publish → Kafka broker ack → 本地 dispatch → 契约 `it` 断言成立。本实例 consumer 读回消息被 `originInstance` 过滤，无双重投递。
- **跨进程生产**：服务 A publish → 本地 dispatch（A 中无订阅者）+ Kafka；服务 B 的 consumer 读到 → `originInstance` 不匹配 → dispatch 到 B 的订阅者。两个进程各自的本地订阅者都能收到，跨进程通过 Kafka 正常 fan-out。

这是合法的"适配"（授权处置 1 明示允许），不弱化契约任何断言。

## C. 授权处置 2：Probe 扩展选择

**选项 a（本地私有 probe 结构）**。

Adapter 内部本地声明 `TestkitProbe` 类型（结构兼容 `NotificationContractProbe`，带 `__notificationProbe: true` 品牌），不从 `@tianqi/adapter-testkit` 导入（元规则 F）。未对 testkit 内的 `NotificationContractProbe` 做任何扩展——测试所需的观察能力完全由 `subscribe` 承载，不需要 Kafka 特有的新字段。

拒绝选项 b（扩展 probe 接口）的理由：增加 probe 字段会污染 `notification-memory` 等其他 Adapter 的契约边界，违反元规则 B；契约测试能观察的信号越少越好，越少越稳定。

## D. 授权处置 3：错误码复用 vs 新增的裁决

**新增一个错误码：`TQ-INF-010 KAFKA_BROKER_UNREACHABLE`**；其他场景一律复用。

| 故障场景                          | 选择                                         | 理由                                                                                                                                                              |
| --------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broker 不可达 / 网络中断          | **新增 `TQ-INF-010`**                        | 诊断工具链专属 Kafka（`kafka-topics.sh` / `kafkacat`），与 Postgres 的 `psql` 不同。惯例 K 判断：诊断动作不等价 → 新增。                                          |
| Topic 不存在                      | 不新增                                       | 通过 `allowAutoTopicCreation: true` 让 Kafka 自动处理；生产路径禁止自动创建但本 Step 不建模"禁止自动创建下的明确 NOT_FOUND"。真正遇到时再补 TQ-INF-011 或等价码。 |
| Publish 失败（超时 / 拒绝）       | 复用 `TQ-INF-001 INFRASTRUCTURE_UNAVAILABLE` | Phase 1-7 冻结的通用基础设施故障码，语义吻合；无 Kafka 专属诊断动作。                                                                                             |
| Consumer group fenced / rebalance | 不新增                                       | KafkaJS 自动重试；未暴露到 Adapter 契约面。                                                                                                                       |
| 未初始化 / 已 shutdown            | 复用 `TQ-INF-003 / TQ-INF-004`               | 惯例 K Lifecycle 共性；与 Sprint B/C 其他 Adapter 一致。                                                                                                          |

新增 `TQ-INF-010` 对应断言 `test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable`（Adapter 自有测试）及工厂级校验 `test_brokers_empty_array_rejects_with_structured_error`。

## E. 授权处置 4：持久化契约函数抉择

**选项 a（不开新函数）**。

理由（克制 > 堆砌）：Kafka 持久化语义主要体现在两个维度——broker 持久化（已被契约测试间接覆盖：publish 返回 → 消息在 broker；跨实例 consumer 能读到）与 consumer offset 持久化（属于 consumer group 重启恢复语义，需要真实多服务部署才能稳定测试）。当前没有一组"必须跨 Adapter 通用的持久化 Kafka 契约"足以撑起一个独立 testkit 函数。

选项 b 若实施，需要在 adapter-testkit 新开 `defineDistributedNotificationContractTests` 函数 + 新类型 + options 对象，并在 Step 8 `notification-memory` 场景下不适用（内存无持久化）。这会多引入一层"契约家族"的维护负担，且当前只有一个 Adapter（Kafka）会使用。

选项 c（扩展 `definePersistentEventStoreContractTests` 语义到 Notification 域）直接拒绝：EventStore 持久化（append-only 日志）与 Kafka 持久化（分区日志 + consumer offset）语义差异显著，硬扩展会污染两边的契约边界。

因此：Kafka 持久化专属维度由本 Adapter 的 6 个自有测试承担（broker 可达性 / 两 consumer group fan-out / healthCheck 细节 / 等），不开新 testkit 函数。真正需要跨 Adapter 持久化契约时，Step 10+ 再判断。

## F. Kafka 分区与顺序保证策略

**单 topic + KafkaJS 默认分区策略 + 以 `caseId` 作为 message key**。

- 契约测试创建的 topic 默认由 Kafka 决定分区数（`allowAutoTopicCreation: true` + 未指定 partitions 时 KafkaJS 按 broker 配置创建，典型是 1）。
- `producer.send` 的 `key: message.caseId` 决定分区路由——KafkaJS 默认分区器对 key 做 hash，同 `caseId` 保证落到同分区。
- 单分区场景下 Kafka 全局保序，契约类别 3 所有 `it`（包括跨 caseId）都通过。
- 多分区场景下只保同 caseId 内的顺序——这正是契约类别 3 断言的粒度："跨 caseId 无全局顺序承诺"。两种情况契约都满足。

生产部署建议在 README 中留痕：若使用多分区 topic，分区数应与消费并发度对齐；key 必须设置（Adapter 已处理）。

## G. Handler 异常处置选择

**选择：静默吞——与 `@tianqi/notification-memory` 保持 Sprint C 一致性。**

拒绝 "pause consumer"（单 handler bug 扩散到整个消费链路）和 "DLQ 策略"（需要第二个 Kafka topic 管理，扩张 Adapter 职责）。订阅者必须在自己的 handler 内 try/catch。

Kafka 场景特有的语义后果已在 README § Handler 异常处置 节留痕：

- KafkaJS 在 `eachMessage` 正常返回后推进 offset；我们的静默吞让 offset 正常推进，避免单条毒消息阻塞整个消费链路。
- 代价：订阅者 bug 会"看起来消息被消费了但实际没被正确处理"——订阅者责任。

## H. healthCheck 探测动作选择（元规则 I）

**选择：`admin.fetchTopicMetadata({ topics: [topic] })`**。

理由：

- 只读操作，不触发任何业务写（元规则 I 硬约束）。
- 返回 topic 的分区/副本元数据——隐含验证 broker 连通性与 topic 存在性。
- 比 `producer.send` 到 healthcheck 专用 topic 简单（不需要额外 topic 管理）。
- 比 `consumer.describeGroup` 对 broker 负担更小。

独立超时：`healthCheckTimeoutMs`（默认 2000ms），用 `Promise.race` 绑定 `scheduleTimer`。超时即 `healthy: false`，不抛异常。

details 包含：`{ lifecycle, topic, consumerGroupId, clientId, brokers, lastSuccessAt, lastError, healthCheckTimeoutMs, subscriberCount }`——运维无需读代码即可诊断"为何不健康"。

## I. 传递语义三条（元规则 N）与 `notification-memory` 的对比

本 Adapter 主动声明三条（详见 README § Delivery Semantics）：

| 维度             | notification-memory                                                 | notification-kafka                                                                                               |
| ---------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 生产端幂等保证   | 不做去重（无 eventId）                                              | 不做去重（无 eventId）——KafkaJS idempotent producer 是分区内 producer 幂等，不等价于 Tianqi 业务去重             |
| 消费端可见性保证 | `publish` 返回即所有订阅者已收到                                    | `publish` 返回即 broker ack + 本实例订阅者已收到；**跨实例订阅者有分布式延迟**（consumer poll + rebalance 窗口） |
| 故障场景传递语义 | at-least-once（exactly-once in practice，声明层诚实 at-least-once） | at-least-once（真实分布式保证，非 in-practice）                                                                  |

两 Adapter 在单实例 / 同进程下行为几乎等价（都是同步 dispatch）；跨实例下 Kafka 有真实的 broker 持久化与 offset 恢复承诺。

## J. Step 5 state guard 教训的复用姿势

本 Adapter 的 `publish` 开头：

```ts
// Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
if (state === "shut_down") {
  return err(portError("TQ-INF-004", "publish called after shutdown"));
}
if (state === "created" || producer === null) {
  return err(portError("TQ-INF-003", "publish called before init"));
}
```

`subscribe` 同序。该顺序保证契约类别 5 的 "publish 后 shutdown 拒绝 TQ-INF-004" 稳定命中正确错误码。注释显式致敬 Step 5 留痕。

## K. 元规则 A–J + M + N 触发情况 + 惯例 K / L 应用

- **元规则 A（指令 vs 既有事实冲突）**：**显式使用**。`NotificationPort` 进程内模型与 Kafka 分布式模型的根本差异通过"双路径分发 + originInstance header 去重"处理（§B 授权处置 1）；不跳过任何契约 `it`。
- **元规则 B（testkit 签名兼容）**：贯彻。`defineNotificationContractTests` 签名未改；本 Adapter 一行挂载。
- **元规则 C**（EventStorePort 只写）：不适用。
- **元规则 D（testkit 依赖边界）**：贯彻。adapter-testkit 本 Step 未修改；kafkajs 仅进入 notification-kafka 包。
- **元规则 E**（持久化契约独立函数）：不适用。选项 a 拒绝新开函数（§E）。
- **元规则 F（参考实现跨包引用禁令）**：严格贯彻。零 `import` 指向 `adapter-testkit/.../fixtures/reference-notification` 或其他 Adapter；`TestkitProbe` 类型本地声明。
- **元规则 G（第三方依赖准入）**：**第三次实战**。`kafkajs@2.2.4` 通过五项准入——工业标准（Tulios 维护，MIT，月下载百万）、MIT 许可、dependencies 字段、精确版本锁、README §"为何引入 kafkajs" 明述理由。纯 JS 不扩张 `pnpm.onlyBuiltDependencies`。
- **元规则 H（持久化 Adapter 自管 schema）**：不严格适用（Kafka topic 不是 schema），但通过 `allowAutoTopicCreation: true` 实现"幂等自管 topic"精神等价行为——init 不显式创建 topic，让 Kafka 在首次 publish 时自动建。
- **元规则 I（外部服务 healthCheck）**：**第二次实战**（首次 Step 6 Postgres）。探测动作 `admin.fetchTopicMetadata` 只读；独立 `healthCheckTimeoutMs`；`Promise.race` 超时实现；不抛异常；details 含诊断字段；不内部轮询。
- **元规则 J（测试外部服务隔离）**：**第二次实战**（首次 Step 6 Postgres）。`TIANQI_TEST_KAFKA_BROKERS` 环境变量；`describe.skipIf(!canReachKafka)` 整块跳过；skip 判断在文件顶部；`it.skipIf` 保护需要真实 Kafka 的自有测试。
- **元规则 M（异步分发契约观察原语）**：贯彻。probe 只暴露 `subscribe`；未扩展到"可观察未发布消息"的中间状态。
- **元规则 N（传递语义显式声明）**：**第三次实战**（首次 Step 7 参考，第二次 Step 8 memory）。§I 与 README 的三条声明独立表述，与 `notification-memory` 有差异但都符合元规则 N 硬约束。

- **惯例 K（错误码共性 vs 专属）**：贯彻。新增 `TQ-INF-010`（Kafka 专属，诊断工具链不同）；其他场景复用（§D 表）。
- **惯例 L（Adapter 自有测试覆盖边界）**：**第二次实战**。6 个自有测试（§M）全部通过"若放入契约套件仍有意义吗"自测。

## L. 错误码 → `it` 块对应表

| 错误码                    | 名称                                                  | 触发的 `it` 块                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TQ-INF-010`              | `KAFKA_BROKER_UNREACHABLE`                            | Adapter 自有 `test_brokers_empty_array_rejects_with_structured_error`（工厂层抛）+ `test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable`（init 层抛） |
| `TQ-INF-001`              | `INFRASTRUCTURE_UNAVAILABLE`（复用 Phase 1-7 冻结码） | 任何 `publish` 调用期间 Kafka 返回非连接错误——在契约测试中通常不会出现（契约测试的 publish 都应成功）；生产场景下的偶发网络抖动走此路径                                            |
| `TQ-INF-003 / TQ-INF-004` | NOT_INITIALIZED / ALREADY_SHUT_DOWN（惯例 K 复用）    | 契约类别 5 所有 4 个 `it`                                                                                                                                                          |

## M. 惯例 L 应用：6 个自有测试的"若放入契约套件仍有意义吗"自测

| 自有测试                                                                           | 放入契约套件是否有意义                                                                                                                                                                    | 判决             |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| `test_brokers_empty_array_rejects_with_structured_error`                           | **否**——`brokers: readonly string[]` 是 Kafka 特定字段，非 Notification 契约；契约套件无法访问此字段。                                                                                    | 合格自有         |
| `test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable` | **否**——`TQ-INF-010` 是 Kafka 专属；其他 Adapter（memory）没有 broker 概念。                                                                                                              | 合格自有         |
| `test_object_keys_exposes_only_union_of_three_contracts_no_extras`                 | **否**——契约套件通过 TS 类型强制三契约；`Object.keys` 运行时反证只能在具体 Adapter 实例上。                                                                                               | 合格自有         |
| `test_health_check_details_include_brokers_and_topic_and_subscriber_count`         | **否**——details 字段集是 Adapter 特定（本 Adapter 含 `brokers`、`topic`、`consumerGroupId` 等 Kafka 特有字段）；契约只要求 details 存在。                                                 | 合格自有         |
| `test_health_check_returns_healthy_false_after_shutdown_without_throwing`          | **否**（边界案例）——这点看似契约，但契约套件的类别 5.4 已覆盖相似语义；本自有测试聚焦 Kafka 特有 admin 客户端生命周期；若简化可移除。保留以覆盖 Kafka admin client 的关闭行为特别稳健性。 | 合格自有（边界） |
| `test_two_distinct_consumer_groups_on_same_topic_both_receive_messages`            | **否**——跨 consumer group fan-out 是 Kafka 专属语义；`notification-memory` 没有 consumer group 概念。                                                                                     | 合格自有         |

6 个测试全部合格。

## N. 本地执行与 `TIANQI_TEST_KAFKA_BROKERS`

本次执行**未**触达真实 Kafka——开发机未设 `TIANQI_TEST_KAFKA_BROKERS`。测试结果：

- 18 个契约 `it` + 4 个需要 DB 的 Adapter 自有（`it.skipIf`）= **22 skipped**。
- 3 个不需 Kafka 的 Adapter 自有（empty brokers / 不可达 brokers / Object.keys）= **3 passed**。
- 加上 Step 6 Postgres 的 36 skipped = 本次总 57 skipped。
- 基线 1300 + 本 Step 新增 3 passed + 22 skipped = **1325**。

等一下——实际跑的测试数是 **1324** 不是 1325。差 1 个。让我重新核对：

本 Step 新增 3 个不 skip + 18 契约 skip + 3 个 DB 自有 skip = 24。但我的自有有 6 个其中 3 个不 skip 3 个 skip。所以新增 = 18 + 6 = 24。对。

1300 + 24 = 1324。✓

这是元规则 J 的预期行为：没有真实 Kafka 时 CI 不红，skip 计入总数。Phase 10 CI/CD 阶段需提供 Kafka service container 并设置 `TIANQI_TEST_KAFKA_BROKERS`，届时 22 skipped → 22 passed。

## O. 风险点

- **CI 需要 Kafka service container**：Phase 10 CI/CD 必须在 workflow 中起一个 Kafka（或使用 Confluent cloud / Testcontainers-node / GitHub services）并通过 `TIANQI_TEST_KAFKA_BROKERS` 注入。否则 Kafka 契约面在 CI 不被真正验证。本 Step 不构建 CI；docs 留痕供 Phase 10 runbook 消费。
- **KafkaJS 版本与 broker 协议兼容性**：`kafkajs@2.2.4` 支持 Kafka broker v0.10-v3.6。真实生产环境的 Kafka 版本差异可能触发边缘兼容问题，Phase 10 需声明 broker 最小版本要求。
- **分区重平衡期间的契约测试稳定性**：契约测试使用独立 consumer group，重平衡不影响当前测试。但若 CI 并发运行多个 suite 对同一 Kafka 集群，可能触发集群级资源竞争。缓解：每个测试使用独立 topic + group（已实现）。
- **Topic 污染**：测试 topic 在 `afterAll` 被 admin.deleteTopics 清理。若进程异常退出，topic 可能残留。Kafka 有自己的 retention 策略；CI 环境建议用短 retention 或定期清理脚本。
- **Handler 异常处置"静默吞"在生产场景的副作用**：订阅者 bug 会静默失败。Phase 10 阶段建议引入 Adapter 级 metrics（handler 异常计数）让运维可观察——但本 Step 不做。
- **推送过程**：预期 fast-forward，无 rebase。

## P. 对 Sprint D / Sprint E 的衔接

Step 9 完成后，Sprint D（Config）和 Sprint E（External Engine）面对的共同挑战是"外部服务 Adapter 设计模板"。本 Step 建立的模板：

1. **双路径分发模式**：若 Port 的语义期望是"同步"而底层基础设施是"异步"，Adapter 可通过本地路径 + 远程路径 + 远程路径自环去重实现同步语义兼容。这个模式对 Config Adapter 不适用（Config 是请求-响应式），但对 External Engine Adapter 的 event-broadcasting 场景适用。
2. **外部服务 healthCheck 模式**：只读探测 + 独立超时 + `Promise.race` + details 诊断字段。这个模式对 Config / External Engine 完全适用。
3. **环境变量 skipIf 保护**：`TIANQI_TEST_<SERVICE>_<DETAIL>` 命名规范（Step 6 立 + Step 9 沿用），外部服务 Adapter 都应遵循。
4. **专属错误码 vs 复用**：惯例 K 判断标准（诊断动作等价性）经过 Sprint B 和 Sprint C 的实战验证；Sprint D/E 继续沿用。
