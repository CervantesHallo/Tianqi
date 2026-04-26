# `@tianqi/dead-letter-store-memory`

Phase 9 / Step 4 引入。DeadLetterStorePort 的单进程内存实现。

## 包定位

应用层 Step 9 人工介入接口的默认 in-memory 实现。适用于：

- 开发机本地调试
- 单元测试 / 集成测试 fast-feedback 路径

**不适用**于跨进程恢复 / 生产部署（合规要求长期保留死信记录）。生产路径见
[`@tianqi/dead-letter-store-postgres`](../dead-letter-store-postgres)。

## 快速开始

```ts
import { createInMemoryDeadLetterStore } from "@tianqi/dead-letter-store-memory";

const store = createInMemoryDeadLetterStore();
await store.init();

// ... enqueue / load / listPending / listBySaga / markAsProcessed ...

await store.shutdown();
```

## Semantics 三条声明（元规则 N）

1. **持久化保证**：进程结束即丢失全部死信记录。本 Adapter 不持有任何
   文件 / 网络 / 数据库句柄；状态仅存在于工厂闭包内的
   `Map<DeadLetterId, DeadLetterEntry>`。
2. **一致性保证**：单进程内同一 Adapter 实例的所有 enqueue / load /
   listPending / listBySaga / markAsProcessed 看到相同数据（Map 共享内
   存视图）。read-after-write 强一致。
3. **多实例语义**：同进程多次调用 `createInMemoryDeadLetterStore()` 返回
   **独立**实例，互不共享状态。这与 `dead-letter-store-postgres` 的
   "多实例共享同一表" 行为相反。

## 错误码

- `TQ-INF-022` DEAD_LETTER_STORE_NOT_INITIALIZED：在 `init()` 前调用 enqueue / load / listPending / listBySaga / markAsProcessed
- `TQ-INF-023` DEAD_LETTER_STORE_ALREADY_SHUT_DOWN：在 `shutdown()` 后调用上述方法

## 契约覆盖

通过一行挂载验证 14 个基础契约 it（`defineDeadLetterStoreContractTests`）。
不挂载 `definePersistentDeadLetterStoreContractTests`（设计上不持久化）。

## 不实现的能力

- **审计事件写入**：调用方（Step 9 人工介入接口）职责，不在本 Adapter 范围（元规则 F）
- **死信清理 / 归档 / TTL**：Phase 10+ 责任
- **死信删除**：合规要求长期保留，DeadLetterStorePort 不提供 delete
