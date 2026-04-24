# Phase 8 / Step 7 — adapter-testkit Notification 契约测试套件

## A. Step 7 定位

Sprint B（Step 3-6）把 EventStore 契约从"契约"推进到"三个 Adapter 通过同一份契约"。Step 7 是 **Sprint C 的立契约起点**——承担的角色等同于 Sprint B 中的 Step 3：把 `packages/ports/src/notification-port.ts` 中冻结的 `NotificationPort` 语义翻译为可被任意 Notification Adapter（Step 8 内存、Step 9 Kafka）复用的契约 `it` 块，并引入 Sprint C 特有的 `NotificationContractProbe` 模式（类比 Sprint B 的 `EventStoreContractProbe`）。

本 Step 完成后，任何 Notification Adapter 只需要一行 `defineNotificationContractTests("<name>", factory)` 挂载即可被 18 个 `it` 块判决"合格与否"。本 Step 仍是契约级 Step——零正式 Adapter，参考实现严格限定在 `src/fixtures/`。

## B. NotificationPort 签名映射与 META-RULE A 触发

`NotificationPort` 冻结签名（读自 `packages/ports/src/notification-port.ts`）：

```ts
export type NotificationMessage = {
  readonly caseId: RiskCaseId;
  readonly traceId: TraceId;
  readonly eventType: string;
  readonly content: string;
};

export type NotificationPort = {
  publish(message: NotificationMessage): Promise<Result<void, NotificationPortError>>;
};
```

**两处 META-RULE A 冲突**——指令预设与既有 Port 签名存在张力。均按"服从既有事实，留痕说明"处置：

**触发 1 — Port 无 `subscribe` 方法**：

- 指令第五节类别 1 / 4 要求 subscribe / unsubscribe 契约。
- 既有事实：`NotificationPort` 只有 `publish`，没有 subscribe。Port 是生产端接口。
- 指令同时在"本步不做"中明确"不修改 NotificationPort 签名"。
- **处置**：在 adapter-testkit 内新增 `NotificationContractProbe`，它提供 `subscribe(handler): NotificationSubscription` 作为**测试观察原语**（元规则 K）。probe 带 `__notificationProbe: true` 品牌避免与 `EventStoreContractProbe` 的 `__testkitProbe` 字段混淆。factory 返回的 `NotificationAdapterUnderTest = NotificationPort & AdapterFoundation & NotificationContractProbe` 要求被测 Adapter 同时实现 Port、Foundation 与 probe。subscribe 是 testkit 测试观察接口，**不是** `NotificationPort` 的扩展；生产路径不依赖 probe。

**触发 2 — `NotificationMessage` 无 `event_id` 字段**：

- 指令类别 2 以"同一 `event_id` 重复 publish"为断言目标。
- 既有事实：`NotificationMessage` 只有 `caseId / traceId / eventType / content`——没有全局唯一 `event_id`。
- **处置**：按惯例 K 重解释类别 2 为"**非放大契约**（non-amplification under at-least-once semantics）"——Adapter 不承诺生产端基于内容的去重，但承诺"每次 publish 调用对每个订阅者产生且仅产生一次投递"。重复 publish 相同内容的 N 次 → 订阅者收到 N 次（这是诚实的 at-least-once；符合元规则 L 的"禁止把 exactly-once 作为默认选择"）。两个 `it` 块分别断言"单次 publish 不放大"和"相同内容的 N 次 publish 投递 N 次"。

## C. 5 大类别覆盖范围与《宪法》的映射

| 类别                         | `it` 块数 | 主映射                                         | 关键断言                                                                                                                        |
| ---------------------------- | --------: | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1 Publish & Subscribe basics |         4 | §10 事件契约 + NotificationPort `publish` 语义 | 注册订阅者收到 publish；多订阅者各收一份；后注册不收历史；无订阅者 publish 成功无副作用                                         |
| 2 Non-amplification          |         2 | §18 错误传播 + 元规则 L 显式传递语义           | 单次 publish 恰好一份投递；重复 publish 相同内容按 at-least-once 投递每次（见 §B 触发 2）                                       |
| 3 Ordering                   |         4 | §13 并发与一致性                               | 同 `caseId` 顺序保持；同 `caseId` 跨 `eventType` 顺序保持；跨 `caseId` 无全局顺序承诺；交错 publish 保持 per-case 顺序          |
| 4 Subscription lifecycle     |         4 | 元规则 K 异步分发观察原语                      | `unsubscribe()` 真正停订；同一 handler 重复 subscribe 幂等；`unsubscribe()` 可重复调用不抛；两个不同 handler 独立事件流         |
| 5 Foundation integration     |         4 | Step 2 AdapterFoundation + 元规则 K 观察       | publish 前未 init 返回 TQ-INF-003；subscribe 前未 init 抛 TQ-INF-003；publish 后 shutdown 返回 TQ-INF-004；healthCheck 不抛异常 |

**5 类而非 4 或 6 的依据**：4 类（publish/subscribe 基础 / 顺序 / 生命周期 / Foundation）缺失"非放大"维度——这是元规则 L 的专门承载面；6 类会把 publish 基础与订阅者 lifecycle 拆开，但 Step 7 与 EventStore Step 3 的类别 1 / 4 定位对应（发布基础、lifecycle），拆成两类更清晰。5 类的平衡：每类至少 2、至多 4 个 `it` 块；类别 2 刻意小（2 个）是因为没有基于 eventId 的去重语义支撑更多断言。

## D. NotificationContractProbe 字段选择

**最终形状**（最小克制）：

```ts
export type NotificationContractProbe = {
  readonly __notificationProbe: true;
  subscribe(handler: NotificationHandler): NotificationSubscription;
};
```

一个方法 + 一个品牌字段。考虑过的其他字段均被拒绝：

- `getDeliveredMessages()`：被订阅者 handler 捕获到本地数组的写法替代——更直观、避免 probe 维护双份状态。
- `getSubscriberCount()`：category 4 的重复订阅幂等性通过"handler 只被调用 1 次"直接断言，不需要读订阅者数量。category 5 的"shutdown 清理订阅者"通过"shutdown 后 publish 返回 TQ-INF-004"间接验证。
- `peekBuffered()`：会暴露"将要投递但尚未投递"的中间状态，违反元规则 K 的"不暴露中间状态"硬约束。

`subscribe` 方法对测试观察的收敛达到最小——probe 只提供一条"注册后观察"的通路，其余一切断言通过 handler 捕获和 publish 返回值完成。

## E. 传递语义选择（元规则 L）

**参考实现声明**：`at-least-once`，无生产端去重。

理由：

1. **元规则 L 明禁把 exactly-once 作为默认选择**：分布式消息系统的 exactly-once 需要两阶段提交或幂等消费端 + 系统级去重键，代价高昂；`NotificationPort` 签名无 eventId，无法提供可靠去重键，exactly-once 不可达。
2. **at-most-once 意味着"宁丢勿重"**：对 Tianqi 的风控场景不适用——丢事件比重复事件更危险（重复审计可以在消费端去重；丢失审计可能直接让合规失败）。
3. **at-least-once 是唯一落地路径**：生产端尽力投递一次，允许重复；消费端（订阅者）自负去重。这与 Kafka 默认语义一致，也让 Step 9 的 Kafka Adapter 与 Step 8 的内存 Adapter 在语义上对齐。

参考实现在内存里实际是"exactly-once in practice"（同步无网络，每次 publish 只执行一次迭代）——但**声明层面**诚实声明 at-least-once，为 Kafka Adapter 的真实行为预留语义空间。任何 Notification Adapter 的 README 与 docs 必须显式声明传递语义（元规则 L 硬约束）。

## F. 重复订阅行为选择

**选择**：**同一 handler 重复 subscribe 幂等**（基于 handler 函数引用的 Set 去重）。

理由（天启宗旨"克制 > 堆砌"）：

- 报错方案需要新增 TQ-CON 错误码和处理逻辑，增加代码量。
- 幂等方案用 `Set<Handler>` 天然实现：重复 `add` 无副作用，返回同等有效的 unsubscribe handle。
- 测试更直接：`test_duplicate_subscribe_of_same_handler_is_idempotent_and_delivers_once_per_publish` 断言 handler 只被调用 1 次。
- 实际使用中重复订阅常是代码疏忽（例如组件 re-mount），幂等吸收这种噪声优于抛错让调用方崩溃。

## G. 错误码复用 vs 新增的裁决

**决定**：**复用 `TQ-INF-003` 和 `TQ-INF-004`**，不新增 `TQ-INF-013` / `TQ-INF-014`。

惯例 K（Sprint B 留下的新惯例）判断标准：若两个 Adapter 的同一错误场景能用完全相同的诊断动作解决，则共性；否则专属。

- **`TQ-INF-003` "NOT_INITIALIZED"**：EventStore 与 Notification 的"未 init 时被调用写/订阅路径"是同一个 Lifecycle 故障，诊断动作完全一致（先调用 `init()`）。常量名 `EVENT_STORE_NOT_INITIALIZED` 的 `EVENT_STORE_` 前缀是 Step 3 命名时的历史局限，与 Step 5 `SQLITE_SCHEMA_VERSION_MISMATCH` 在 Postgres 上下文的局限一样——惯例 K 明确这类前缀不构成不复用的理由。
- **`TQ-INF-004` "ALREADY_SHUT_DOWN"**：同理，诊断动作一致（Adapter 实例已终态，须新建实例）。

本 Step 的参考实现抛出的错误消息前缀严格用 `TQ-INF-003:` 和 `TQ-INF-004:`——契约测试的 `.toMatch(/^TQ-INF-003:/)` 正则断言不关心常量名，只关心错误码字符串。

**代价**：`ERROR_CODES.EVENT_STORE_NOT_INITIALIZED` 常量名在 Notification 语境下读起来微怪。但本 Step 不重命名（Step 2 §F 规则：错误码一经发布不得改语义）。常量名的范围在 docs 留痕即可。

**未采用**：`TQ-INF-013` / `TQ-INF-014` / `TQ-CON-006 NOTIFICATION_SUBSCRIPTION_VIOLATION` —— 本 Step 没有断言触发这些码（重复订阅是幂等而非抛错；订阅前未 init 复用 TQ-INF-003）。按"无对应断言即不新增"纪律不填充。

## H. 元规则 A–L 触发情况

- **元规则 A（指令 vs 既有事实冲突）**：**触发两次**。(1) Port 无 subscribe → 引入 NotificationContractProbe；(2) NotificationMessage 无 eventId → 重解释类别 2 为 non-amplification。两处均按"服从既有事实，留痕说明"处置。见 §B。
- **元规则 B（testkit 签名兼容纪律）**：未直接触发——`defineNotificationContractTests` 是本 Step 首次发布的函数，无既有签名可兼容。其泛型约束 `T extends NotificationAdapterUnderTest` 遵循 Sprint B 同构形状；`options` 参数空 `Readonly<Record<string, never>>` 留出未来扩展空间但当前不填充。
- **元规则 C（EventStorePort 只写）**：不适用（本 Step 不触碰 EventStorePort）。
- **元规则 D（adapter-testkit 依赖边界）**：**贯彻**。adapter-testkit 新增 Notification 相关源码依赖仍在 `{contracts, ports, shared}` + vitest 白名单内；无第三方运行时依赖新增。
- **元规则 E（持久化契约独立函数）**：不适用——本 Step 不涉及持久化 Notification；若 Step 9 Kafka 需要持久化契约，则按 Step 5 的 `definePersistentEventStoreContractTests` 模式新开独立函数，不塞进 `defineNotificationContractTests`。
- **元规则 F（参考实现跨包引用禁令）**：**贯彻**。`src/fixtures/reference-notification.ts` 不通过 `src/index.ts` 导出、不在 `package.json exports`。未来任何 Adapter 的 test 文件严禁 `import { createReferenceNotification }`。
- **元规则 G（第三方依赖准入）**：不触发（本 Step 无新第三方依赖）。
- **元规则 H（持久化 Adapter 自管 schema）**：不适用。
- **元规则 I（外部服务 healthCheck 语义）**：不直接触发（内存 Adapter 没有外部服务）。Step 9 Kafka 将首次触发。
- **元规则 J（测试用外部服务隔离）**：不直接触发。Step 9 Kafka 将使用 `TIANQI_TEST_KAFKA_BROKERS` 环境变量。
- **元规则 K（异步分发契约的观察原语）**：**首次实战**。`NotificationContractProbe.subscribe` 是消费者观察原语；category 2 显式声明 at-least-once 传递语义（见 §E）。probe 不暴露任何"未发布但即将发布"的中间状态——§D 明示拒绝 `peekBuffered()`。
- **元规则 L（传递语义显式声明）**：**首次实战**。参考实现声明 `at-least-once`、无生产端去重。Step 8 / 9 Adapter 的 README 与 docs 必须显式声明本 Adapter 的三条（生产端幂等保证 / 消费端可见性保证 / 故障场景传递语义）。

## I. 新惯例 K 与 L 的应用

**惯例 K（错误码共性 vs 专属）**：本 Step 复用 `TQ-INF-003` / `TQ-INF-004`（Lifecycle 共性），不新增任何错误码。§G 留痕。

**惯例 L（Adapter 自有测试的覆盖边界）**：本 Step 不涉及正式 Adapter，故暂无应用。Step 8 内存 Notification Adapter 落地时将首次应用——自有测试只覆盖该 Adapter 特有维度（工厂签名、Object.keys），契约已覆盖的场景不在自有测试中重复。

## J. 参考实现与 Step 8 正式 in-memory Adapter 的职责分离

与 Sprint B 的 reference-event-store 纪律完全对齐：

- **导出面分离**：`createReferenceNotification` 不通过 `src/index.ts` 导出、不在 `package.json exports`；其他包无合法 import 路径。
- **目录分离**：位于 `src/fixtures/`；Step 8 正式 Adapter 位于 `packages/adapters/notification-memory/src/`。
- **职责分离**：参考实现的唯一消费者是 adapter-testkit 的 `src/notification-contract.test.ts` 自测；Step 8 Adapter 的消费者是 Application 层。
- **迭代分离**：参考实现仅在"契约断言调整"时修订；Step 8 Adapter 仅在"语义 bug / 性能"时修订。

## K. 对 Step 8 / 9 的衔接

**Step 8**（`@tianqi/notification-memory`）的测试挂载形状：

```ts
defineNotificationContractTests("notification-memory", () => createInMemoryNotification());
```

一行驱动 18 个契约 `it`，外加 ≤6 个 Adapter 自有测试。Step 8 的自有测试不重复契约场景；只覆盖工厂签名、`Object.keys` 三契约并集验证、多实例状态独立等内存 Adapter 专属维度。

**Step 9**（`@tianqi/notification-kafka`）将首次触发元规则 I（外部服务 healthCheck：ping broker）与元规则 J（`TIANQI_TEST_KAFKA_BROKERS` 环境变量保护）。Kafka 场景可能需要 `definePersistentNotificationContractTests` 独立函数承载"broker 崩溃恢复 / 消费者 offset 持久化"等持久化 Notification 契约——该决策由 Step 9 指令敲定，本 Step 不预设。

传递语义一致性：Step 8 内存 Adapter 与 Step 9 Kafka Adapter 都必须声明 `at-least-once`（元规则 L），不得声明 exactly-once。

## L. 风险点

- **参考实现被 Step 8 / 9 误用**：Sprint B 已建立的元规则 F 严禁跨包 import `reference-*.ts`。Step 8 的 code review 必须显式检查此项。
- **分布式一致性契约覆盖不足**：本 Step 的 5 类别覆盖内存场景的基本语义；对分布式 Notification（多 broker / 分区重平衡 / 消费者组偏移）的契约需要 Step 9 引入独立函数承载。本 Step 不预设。
- **`defineNotificationContractTests` 签名冻结的长期影响**：本 Step 锁定的泛型 `T extends NotificationAdapterUnderTest`、参数顺序、`NotificationContractOptions` 形状，Step 8 / 9 都必须遵守。元规则 B 禁止拆换签名——未来若需扩展只能在 options 对象中追加可选字段。
- **README 必须声明传递语义**：Step 8 / 9 若在 Adapter README 中缺失"生产端幂等保证 / 消费端可见性保证 / 故障场景传递语义"三条显式声明，属于契约缺陷，code review 必须拒绝合入（元规则 L）。
