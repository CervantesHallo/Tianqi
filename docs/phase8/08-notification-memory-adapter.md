# Phase 8 / Step 8 — @tianqi/notification-memory Adapter

## A. Step 8 定位

Step 7 浇好了 Sprint C 的契约地基；Step 8 是 Sprint C 的第一个正式 Adapter，类比 Sprint B 中的 Step 4 之于 Step 3。本 Step 的价值不在"多一个 Adapter"，而在于**三个第一次**：

1. **第一次把 Step 7 定下的 18 个契约 `it` 跑在非参考实现上**——证明契约套件不是为参考实现量身定做。
2. **第一次把元规则 N 的"传递语义三条"落到 Adapter 自己的 README**——Adapter 主动声明生产端幂等、消费端可见性、故障场景传递语义，不引用参考实现作为理由。
3. **第一次把惯例 L 的"自有测试 ≤5 不重复契约"在 Notification 领域应用**——每个自有测试的"若放入契约套件仍有意义吗"自测都返回"否"，验证边界划分正确。

## B. 工厂签名 options 空对象的继承依据

`createInMemoryNotification(options?: InMemoryNotificationOptions)`，`InMemoryNotificationOptions = Readonly<Record<string, never>>`。

继承依据：与 Step 4 `createInMemoryEventStore(options?)` 空 options 的设计完全对齐——内存 Adapter 没有外部资源锚点，调用方不需要传任何东西。Step 4 的决策理由在 `docs/phase8/04 §E` 已立为模板，本 Step 直接沿用：未来若发现需要可配置项（例如多实例后缀 debug），按向前兼容方式在 options 中追加可选字段，签名形状 `(options?) => T` 永远不变。

拒绝的候选：

- `maxSubscribers`（防 handler 泄漏）：限流是 Application 层职责，不在内存 Adapter 范围。
- `deliverySemantics`（让调用方选 at-least-once / at-most-once）：元规则 N 要求 Adapter **主动**声明传递语义；让调用方选会让 Adapter 放弃语义承诺，与元规则 N 相悖。

## C. healthCheck details 字段选择

`details: { lifecycle, subscriberCount }`。两字段。

- **`lifecycle`**：沿用 Step 4 event-store-memory 的 `details.lifecycle`——给运维一个"Adapter 是否在跑"的直观枚举。
- **`subscriberCount`**：Notification 特有的观察维度——订阅者数量直接对应 Adapter 的"负载"视角（多少下游在听）。内存场景下几乎零代价（Set.size），信息密度高。

拒绝的候选：

- `lastPublishAt` / `lastSuccessAt`：会引入隐藏状态（每次 publish 都要写一次 `new Date().toISOString()`），给 publish 热路径增加副作用；Sprint C 的消费端可见性保证已承诺 "publish 返回即完成"，运维可直接从上游调用侧日志获取 publish 时间，不需要 Adapter 代管。
- `deliverySemantics` 字符串（"at-least-once"）：静态常量，应在 README 而非运行时健康指标中声明（README 已有专门章节，§D）。

## D. Handler 异常处置策略（元规则 N 的延伸承诺）

**选择**：某 handler 抛异常时，**静默吞掉该异常、继续调用下一个 handler**。不重抛、不计入 details。

三选一的 NotificationPort 语义依据：

- **"重抛给 publish 调用方"（返回 `err({ message: ... })`）**：违反 `NotificationPort.publish` 的 `Result<void, NotificationPortError>` 契约——该返回类型对应的是 Adapter 自身故障（未 init / 已 shutdown / 底层 broker 不可达），**不应**承载订阅者业务错误。一个订阅者的 bug 把 publish 链路打断，会把 Adapter 层错误与订阅者层错误混淆，破坏分层。
- **"记录到 details / lastError"**：订阅者异常是订阅者侧的问题，Adapter 的 details 是 Adapter 自身健康指标而非订阅者错误总线。而且没有合理的报告通道——`publish` 返回 `ok(undefined)` 后该异常已经无处可上报。
- **"静默吞"（当前选择）**：贴合 fire-and-forget 分发语义。订阅者必须在自己的 handler 内 `try/catch` 并把异常送到自己的日志通道。这也是 `Node.EventEmitter`、RxJS Subject 等主流 pub/sub 实现的默认行为。

该选择在本 Adapter 内部是永久性承诺，已在 README §Handler 异常处置 明示。Step 9 Kafka Adapter 会面临不同的设计权衡（broker ack 与 consumer ack 分离、DLQ 策略等），届时 Kafka Adapter 需要**自己**声明——不继承本 Adapter 的选择。

## E. 传递语义三条显式声明（元规则 N）

README § Delivery Semantics 节明示以下三条，**本 Adapter 主动声明**，不引用 Step 7 参考实现作为理由：

### 1. 生产端幂等保证

> **本 Adapter 不做生产端去重**。`NotificationMessage` 签名中没有 `eventId` 字段；Adapter 无可靠去重键。

### 2. 消费端可见性保证

> `publish(message)` 返回后，所有在 `publish` 调用前已通过 `subscribe(handler)` 注册的 handler 都已被同步调用一次。

这是**本 Adapter 独有**的强保证（内存 = 同步 = 可见即返回）。Step 9 Kafka 的可见性保证将弱于此（broker ack 不等于 consumer 可见），届时 Kafka Adapter 需要自己声明其实际可见性边界。

### 3. 故障场景传递语义

> at-least-once。

内存场景实际是 "exactly-once in practice"（同步调用、无网络）——但声明层面**诚实声明 at-least-once**。理由：

- 与 Step 9 Kafka Adapter 语义对齐，让 Application 层订阅侧代码不需要根据底层 Adapter 调整。
- 元规则 N 明禁 exactly-once 作为默认选择。
- handler 异常静默吞意味着"同一消息可能部分 handler 处理、部分未处理"——这本身就不是严格 exactly-once。

## F. 惯例 L 应用：每个自有测试的"若放入契约套件仍有意义吗"自测

惯例 L 判断标准："若把该测试放到契约套件里仍然有意义，说明它是契约而非自有，应移到 testkit"。下面对每个自有测试应用该判断：

| 自有测试                                                            | 放入契约套件是否有意义                                                                                                                                                                                    | 判决                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `test_factory_without_options_returns_valid_instance`               | **否**——契约套件不能固化"某个 Adapter 的 adapterName 常量值"，那是 Adapter 特有身份。`__notificationProbe === true` 是 probe brand，契约套件的所有 `it` 都隐式依赖它，显式断言属于 Adapter 内部一致性。   | 通过（合格自有测试） |
| `test_factory_with_empty_options_behaves_identically_to_no_options` | **否**——`InMemoryNotificationOptions` 是 Adapter 特定类型；契约套件不假设 options 形状。                                                                                                                  | 通过                 |
| `test_two_instances_do_not_share_subscribers`                       | **否**——两实例的进程内状态独立性是内存 Adapter 的可观察特性；Step 9 Kafka 的"多实例"语义完全不同（多个 producer 客户端可能共享同一 broker），契约层面不能强加该断言。                                     | 通过                 |
| `test_health_check_details_include_lifecycle_and_subscriber_count`  | **否**——`details` 字段集是 Adapter 特定选择（本 Adapter 的 §C 决策）；契约只要求 details 存在，不约束具体字段。                                                                                           | 通过                 |
| `test_object_keys_exposes_only_union_of_three_contracts_no_extras`  | **否**——契约套件通过 TypeScript 类型强制 Adapter 实现三契约；`Object.keys` 是运行时反证无附加方法泄露，只有在具体 Adapter 实例上才有意义（契约套件不 new adapter，factory 产出的对象是 Adapter 的职责）。 | 通过                 |

5 个测试全部通过惯例 L 自测。无一与契约套件覆盖场景重叠（幂等 / 顺序 / 生命周期拒绝 / healthy 切换 / unsubscribe 行为 / handler 调用次数全部由契约承担）。

## G. Step 5 state guard 教训的复用姿势

Step 5 `docs/phase8/05 §E` 留痕的 "先判 shut_down，再判 created/null" 硬模板，本 Step 在 `publish` 与 `subscribe` 两处都严格应用：

```ts
// Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
if (state === "shut_down") {
  return err(portError("TQ-INF-004", "publish called after shutdown"));
}
if (state === "created") {
  return err(portError("TQ-INF-003", "publish called before init"));
}
```

注释显式致敬 Step 5。`subscribe` 同序。该顺序保证类别 5 契约中 "publish 后 shutdown 拒绝 TQ-INF-004" 测试能稳定命中正确错误码。

## H. 元规则 A–J + M + N 触发情况 + 惯例 K / L 应用

- **元规则 A（指令 vs 既有事实冲突）**：本 Step 未触发——指令与既有 NotificationPort 签名无冲突（Port 是生产端 only，Step 7 已通过 probe 吸收 subscribe 语义）。
- **元规则 B（testkit 签名兼容）**：贯彻。`defineNotificationContractTests` 签名未改；本 Adapter 挂载方式为一行 factory。
- **元规则 C**（EventStorePort 只写）：不适用（本 Step 不触碰 EventStorePort）。
- **元规则 D（testkit 依赖边界）**：贯彻。本 Adapter 的生产 deps 白名单严格 `{contracts, ports, shared}`，`@tianqi/adapter-testkit` 仅在 devDependencies。
- **元规则 E**（持久化契约独立函数）：不适用。
- **元规则 F（参考实现跨包引用禁令）**：**严格贯彻**。`packages/adapters/notification-memory/src/` 下零 `import` 指向 `@tianqi/adapter-testkit/.../fixtures/reference-notification` 或其相对路径。`TestkitProbe` 类型在 Adapter 本地声明（与 `NotificationContractProbe` 结构同构但独立），通过 TypeScript 结构类型兼容让 `defineNotificationContractTests` 接受本 Adapter 作为 factory 产物。实现代码从零写，结构与参考实现同构但语句级独立。
- **元规则 G**（第三方依赖准入）：不触发（本 Step 无新第三方依赖）。
- **元规则 H**（持久化 Adapter 自管 schema）：不适用（内存无 schema）。
- **元规则 I**（外部服务 healthCheck 语义）：不直接触发（内存无外部服务）。但内存 healthCheck 仍遵从精神：不抛异常、details 有诊断字段、不内部轮询——Step 9 Kafka 将正面触发完整元规则 I。
- **元规则 J**（测试用外部服务隔离）：不适用。
- **元规则 M（异步分发契约的观察原语）**：贯彻。本 Adapter 通过本地 `TestkitProbe` 类型兼容 `NotificationContractProbe`，subscribe 是唯一观察原语；没有暴露"未发布但即将发布"的中间状态。
- **元规则 N（传递语义显式声明）**：**第二次实战**。首次是 Step 7 参考实现的 at-least-once 声明；本 Step 作为第一个正式 Adapter，主动声明三条（见 §E），不引用参考实现为理由。README § Delivery Semantics 节是元规则 N 的工程化兑现。

- **惯例 K（错误码共性 vs 专属）**：贯彻。本 Adapter 复用 `TQ-INF-003` / `TQ-INF-004`（Lifecycle 共性），不新增任何错误码。
- **惯例 L（Adapter 自有测试覆盖边界）**：**第一次实战**。5 个自有测试全部通过惯例 L 自测（§F），无契约场景重复。

## I. 本 Step 没做什么

- **未实现 Kafka**（Step 9 职责，含外部服务连接、broker ack、consumer group offset 等正面触发元规则 I/J）。
- **未迁移 `reference-notification.ts` 代码**（元规则 F 禁令）。Adapter 从零写，结构与参考实现同构但源码独立。
- **未引入任何第三方依赖**（不引入 `EventEmitter` 包装器、`eventemitter3` 等；手写 `Set<Handler>` 足够，符合"语义清晰 > 代码省字数"）。
- **未修改任何既有签名或错误码**。
- **未在 Application 层切换 Adapter 实现**（依赖注入切换留给独立 Step）。
- **未预先构建 Kafka 契约扩展**（Step 9 自行判断是否需要 `definePersistentNotificationContractTests` 独立函数）。

## J. 风险点

- **Handler 异常处置"静默吞"在分布式 Adapter 中可能被挑战**：Step 9 Kafka 场景下，broker ack 与 consumer ack 分离，handler 异常可能影响消费者 offset 推进。Kafka Adapter 届时需要面对 DLQ / retry / poison pill 等权衡，可能选择与本 Adapter 不同的处置（例如"记录到 Kafka DLQ topic + 不推进 offset"）。本 Adapter 的"静默吞"承诺只约束本 Adapter，不构成 Sprint C 所有 Adapter 的通用规则。
- **传递语义声明的 at-least-once 与内存场景"实际是 exactly-once"的认知差**：熟悉内存实现的开发者可能看到 at-least-once 声明后疑惑"明明不可能丢啊"。README §3 已显式说明这一认知差（诚实声明为 at-least-once 以与分布式 Adapter 对齐，给 Step 9 预留语义空间）。关键纪律：**声明是契约的一部分**（元规则 N）；应用层代码应基于声明而非实现细节构建幂等逻辑。
- **Object.keys 测试依赖 JS 对象顺序**：本测试用 `Set<string>` 比较，不依赖顺序——已规避该脆弱性。若未来有人改成 array 比较需谨慎。
- **推送过程**：预期 fast-forward，无 rebase。

## K. 对 Step 9（Kafka）的衔接

Step 9 将建立 `@tianqi/notification-kafka`。从本 Step 到 Step 9 的演进：

1. 外部契约零改变：两行挂载形状不变——`defineNotificationContractTests("notification-kafka", factory)`。Application 层代码从 `createInMemoryNotification()` 换到 `createKafkaNotification({ brokers, ... })` 即可。
2. Kafka Adapter 触发完整元规则 I（broker ping-based healthCheck，独立超时）+ 元规则 J（`TIANQI_TEST_KAFKA_BROKERS` 环境变量 + describe.skipIf 保护）+ 元规则 G（kafkajs 作为第二次 Sprint G 实战）。
3. Kafka Adapter 的 Delivery Semantics 三条必须重新**自己**声明（元规则 N 的"Adapter 主动声明"硬约束）。特别地，消费端可见性保证必须反映"broker ack 不等于 consumer 可见"的真实分布式语义。
4. Handler 异常处置可能与本 Adapter 不同（§D 已预留该演进空间）。
5. Step 9 可能判断需要 `definePersistentNotificationContractTests` 独立函数，承载 broker 崩溃恢复、消费者 offset 持久化、分区重平衡等持久化契约（类比 Step 5 的 `definePersistentEventStoreContractTests`）。该决策由 Step 9 指令敲定。
