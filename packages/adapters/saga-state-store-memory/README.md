# `@tianqi/saga-state-store-memory`

Phase 9 / Step 3 引入。SagaStateStorePort 的单进程内存实现。

## 包定位

应用层 SagaOrchestrator（Step 6+）的默认 in-memory 实现。适用于：

- 开发机本地调试
- 单元测试 / 集成测试中的 fast-feedback 路径

**不适用**于跨进程恢复 / 生产部署。生产路径见
[`@tianqi/saga-state-store-postgres`](../saga-state-store-postgres)。

## 快速开始

```ts
import { createInMemorySagaStateStore } from "@tianqi/saga-state-store-memory";

const store = createInMemorySagaStateStore();
await store.init();

// ... save / load / listIncomplete ...

await store.shutdown();
```

## Semantics 三条声明（元规则 N）

1. **持久化保证**：进程结束即丢失全部状态。本 Adapter 不持有任何文件 /
   网络 / 数据库句柄；状态仅存在于工厂闭包内的 `Map<SagaId, PersistedSagaState>`。
2. **一致性保证**：单进程内同一 Adapter 实例的所有 save / load /
   listIncomplete 看到相同数据（Map 共享内存视图）。read-after-write 强一致。
3. **多实例语义**：同进程多次调用 `createInMemorySagaStateStore()` 返回
   **独立**实例，互不共享状态。这与 `saga-state-store-postgres` 的
   "多实例共享同一表" 行为相反——使用方须明确选择适合自己场景的语义。

## 错误码

- `TQ-INF-019` SAGA_STATE_STORE_NOT_INITIALIZED：在 `init()` 前调用 save / load / listIncomplete / delete
- `TQ-INF-020` SAGA_STATE_STORE_ALREADY_SHUT_DOWN：在 `shutdown()` 后调用上述方法或 `init()`

## 契约覆盖

通过一行挂载验证 13 个基础契约 it（`defineSagaStateStoreContractTests`）。
不挂载 `definePersistentSagaStateStoreContractTests`（设计上不持久化）。
