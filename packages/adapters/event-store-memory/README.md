# @tianqi/event-store-memory

## 它是什么

`@tianqi/event-store-memory` 是 Tianqi 的第一个正式 EventStore Adapter——`packages/ports/src/event-store-port.ts` 中 `EventStorePort` 的内存实现。它同时实现 Phase 8 Step 2 的 `AdapterFoundation`（健康检查 + 生命周期）与 Step 3 的 `EventStoreContractProbe`（testkit 观察面），这样就能以一行 `defineEventStoreContractTests("event-store-memory", factory)` 被 `@tianqi/adapter-testkit` 的全部契约断言覆盖。

对外唯一构造入口是工厂函数 `createInMemoryEventStore(options?)`。不暴露类（class）——工厂封装允许未来内部结构演进而不破坏外部契约。

## 它不是什么

- **不是持久化**：进程重启后全部事件丢失。生产部署必须选用 `@tianqi/event-store-sqlite`（Step 5）或 `@tianqi/event-store-postgres`（Step 6）。
- **不是跨进程共享**：两个进程各自持有独立的 in-memory 实例，互不感知。
- **不是读取接口**：`EventStorePort` 在 Phase 5 封板为只写（仅 `append`）。运行时的事件读取/回放走未来独立的 Query Port / Replayer Port（不在本 Adapter 职责）。`EventStoreContractProbe.listByCaseId / countTotal` **仅供契约测试使用**，生产代码严禁引用。
- **不感知领域**：Adapter 只针对 `DomainEventEnvelope` 的 schema 与 `EventStorePort` 的 append 契约工作，不识别 `eventType` 语义、不读任何领域状态机。

## 依赖边界

- **生产依赖**：`@tianqi/contracts`、`@tianqi/ports`、`@tianqi/shared`。
- **测试依赖**：`@tianqi/adapter-testkit`（仅 devDependency，用于契约挂载）。
- **零第三方运行时依赖**。
- **严禁**依赖 `@tianqi/domain` / `@tianqi/application` / `@tianqi/policy`。

## 如何被 Application 层使用

```ts
import { createInMemoryEventStore } from "@tianqi/event-store-memory";
import type { EventStorePort, AdapterFoundation } from "@tianqi/ports";

const adapter: EventStorePort & AdapterFoundation = createInMemoryEventStore();
await adapter.init();
// ... 使用 append / healthCheck，经 saga / orchestrator 注入
await adapter.shutdown();
```

Application 层应将变量显式标注为 `EventStorePort & AdapterFoundation`——这样 TypeScript 会拒绝访问 `listByCaseId` / `countTotal`（probe 仅在 `EventStoreContractProbe` 下可见）。
