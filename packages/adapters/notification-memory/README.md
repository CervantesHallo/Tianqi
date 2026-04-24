# @tianqi/notification-memory

## 它是什么

`@tianqi/notification-memory` 是 Tianqi 的第一个正式 Notification Adapter——`NotificationPort` 的内存实现。它同时实现 `AdapterFoundation`（Step 2）与 `NotificationContractProbe`（Step 7 testkit 专用观察接口），通过一行 `defineNotificationContractTests("notification-memory", factory)` 被 Step 7 的 18 个契约 `it` 块覆盖。

对外唯一构造入口是工厂函数 `createInMemoryNotification(options?)`。不暴露 class。

## 它不是什么

- **不是分布式消息总线**：进程内单实例；两个进程各自的 Adapter 互不感知。
- **不是持久化队列**：shutdown 后订阅者列表被清空，进程重启后全部丢失。生产部署必须选用 `@tianqi/notification-kafka`（Step 9）。
- **不是可靠传递保证**：order-within-case 是可观察性承诺，exactly-once 从未承诺（参见下方 Delivery Semantics）。

## 依赖边界

- **生产依赖**：`@tianqi/contracts`、`@tianqi/ports`、`@tianqi/shared`。
- **测试依赖**：`@tianqi/adapter-testkit`（devDependency）。
- **零第三方运行时依赖**——`EventEmitter` 都不用，手写 `Set<Handler>` 更符合 Tianqi 宗旨"语义清晰 > 代码省字数"。

## 如何被 Application 层使用

```ts
import { createInMemoryNotification } from "@tianqi/notification-memory";
import type { NotificationPort, AdapterFoundation } from "@tianqi/ports";

const adapter: NotificationPort & AdapterFoundation = createInMemoryNotification();
await adapter.init();
await adapter.publish({
  caseId: createRiskCaseId("case-1"),
  traceId: createTraceId("trace-1"),
  eventType: "RiskCaseCreated",
  content: "payload"
});
await adapter.shutdown();
```

Application 层显式将变量标注为 `NotificationPort & AdapterFoundation`——TypeScript 即会拒绝访问 `subscribe(...)` 等 probe 方法（`NotificationContractProbe` 不在此类型中）。

## Delivery Semantics

本 Adapter 主动声明以下三条（元规则 N）。

### 1. 生产端幂等保证

**本 Adapter 不做生产端去重**。

`NotificationMessage` 签名中没有 `eventId` 字段；Adapter 无可靠去重键。调用 `publish(message)` N 次（即便 `message` 各字段完全相等）必然产生 N 次分发。

调用方若需要去重，必须在业务层持有一个幂等键并在调用 `publish` 前自行判断是否已发过。

### 2. 消费端可见性保证

**`publish(message)` 返回后，所有在 `publish` 调用前已通过 `subscribe(handler)` 注册的 handler 都已被同步调用一次。**

内存实现利用 `Set<Handler>` 快照遍历完成分发；`publish` 与 handler 调用在同一次异步函数调用栈内完成。Step 9 Kafka Adapter 的可见性保证会弱于此（broker ack 不等于消费者可见），届时 Kafka 将自己声明其可见性；本 Adapter 不代为承诺。

`publish` 返回**前**完成的分发不会在 `publish` 返回**后**被回滚。若 handler 抛异常，见下文第 3 条。

### 3. 故障场景传递语义

**at-least-once**。

内存场景下实际发生的是 "exactly-once in practice"（同步函数调用，无网络、无 broker），但本 Adapter 声明层面**诚实声明 at-least-once**——理由：

- 与 Step 9 Kafka Adapter 语义对齐，让 Application 层无需根据底层 Adapter 调整订阅侧代码。
- 元规则 N 明禁 exactly-once 作为默认选择；at-least-once 是 Tianqi 风控场景（丢事件 > 重复事件）下的唯一落地路径。
- Handler 抛异常时本 Adapter 采用 **"静默吞掉"** 策略（见 §Handler 异常处置），这本身就意味着"同一消息可能被部分 handler 处理、部分未处理"——不是严格 exactly-once。

### Handler 异常处置

若某 handler 在被调用时抛出异常，本 Adapter **静默吞掉该异常、继续调用下一个 handler**。

三选一中选择"静默吞"的理由：

- "重抛给 publish 调用方"：会让一个订阅者的 bug 把 publish 链路打断，违反 `NotificationPort.publish` 的 `Result<void, _>` 返回契约（publish 失败应指向 Adapter 自身故障而非订阅者故障）。
- "记录到 details/lastError"：订阅者异常是订阅者侧的问题，Adapter 记录后也没有合理的报告通道（`publish` 的 `NotificationPortError` 是 Adapter 层错误，不是业务层错误）。
- "静默吞"：贴合 fire-and-forget 分发语义；订阅者必须在自己的 handler 内捕获异常并上报（订阅者自负）。

该选择在本 Adapter 内部是永久性承诺。调用方在 handler 内应显式 `try/catch` 并把异常送到自己的日志通道。

## 测试与元规则 L（Adapter 自有测试的覆盖边界）

本 Adapter 的测试分两块：

1. **契约测试**（18 个 `it`）：通过 `defineNotificationContractTests("notification-memory", factory)` 一行挂载，驱动 Step 7 发布的契约套件在本 Adapter 上全绿。
2. **Adapter 自有测试**（5 个 `it`）：只覆盖内存 Adapter 独有的维度——工厂签名、多实例状态独立、`Object.keys` 契约并集验证。严禁重复契约已覆盖场景（幂等 / 顺序 / 生命周期 / healthCheck 状态切换等）。

详见 [docs/phase8/08-notification-memory-adapter.md](../../../docs/phase8/08-notification-memory-adapter.md) §F。
