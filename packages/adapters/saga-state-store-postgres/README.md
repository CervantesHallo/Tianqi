# `@tianqi/saga-state-store-postgres`

Phase 9 / Step 3 引入。SagaStateStorePort 的 PostgreSQL 持久化实现。

## 包定位

应用层 SagaOrchestrator（Step 6+）的生产路径默认实现。承担《§4.5》Saga
状态崩溃恢复全部约束：进程重启后 listIncomplete 列出未完成 saga；跨实例
读到相同状态；同 sagaId 多次 save 是 last-write-wins。

## 快速开始

```ts
import { createPostgresSagaStateStore } from "@tianqi/saga-state-store-postgres";

const store = createPostgresSagaStateStore({
  connectionString: process.env["TIANQI_POSTGRES_URL"]!,
  schema: "tianqi_saga_state",
  poolSize: 10,
  connectionTimeoutMs: 5_000,
  healthCheckTimeoutMs: 2_000
});
await store.init();

// ...

await store.shutdown();
```

## Schema 自管理（元规则 H）

`init()` 内执行：

1. `CREATE SCHEMA IF NOT EXISTS "<schema>"`
2. `CREATE TABLE IF NOT EXISTS "<schema>".saga_state` —— 单表 10 列；
   `step_statuses` / `compensation_contexts` 用 JSONB
3. `CREATE INDEX idx_saga_state_incomplete` —— 部分索引仅覆盖
   `overall_status IN ('in_progress', 'compensating')` 的行（让索引体积保持小）
4. `CREATE TABLE schema_version` —— 单行表，CHECK (id = 1)
5. `INSERT INTO schema_version VALUES (1, '1.0.0')` ON CONFLICT DO NOTHING
6. 校验 `schema_version` 与代码内常量一致；不一致抛 TQ-INF-021

## Semantics 三条声明（元规则 N）

1. **持久化保证**：所有 save 都已落盘（pg 默认 fsync）；进程崩溃后 load
   能读回崩溃前最后一次 save 的数据。
2. **一致性保证**：read-after-write 强一致（pg 默认事务隔离 read-committed
   下，单条 INSERT/UPDATE 提交后立即可见）。同 sagaId 并发 save 是 last-write-wins
   （由 `INSERT ... ON CONFLICT DO UPDATE` 保证；不会出现部分字段混合的腐败行）。
3. **多实例语义**：多个 createPostgresSagaStateStore() 实例（即使分布于不
   同进程）访问同一 schema 时**共享同一份 saga_state 表**——这与
   `saga-state-store-memory` 的"多实例独立"行为相反。生产场景下应保证只有
   一个 `schema` 名被同一 RUN 内的所有 saga 实例使用。

## 错误码

- `TQ-INF-002` ADAPTER_INITIALIZATION_FAILED：schema 名格式不合法（不匹配 `[a-z_][a-z0-9_]{0,62}`）
- `TQ-INF-009` POSTGRES_UNREACHABLE：init 时连接 postgres 失败（DNS / 拒绝连接 / 超时）
- `TQ-INF-019` SAGA_STATE_STORE_NOT_INITIALIZED：在 `init()` 前调用 save / load / listIncomplete / delete
- `TQ-INF-020` SAGA_STATE_STORE_ALREADY_SHUT_DOWN：在 `shutdown()` 后调用上述方法
- `TQ-INF-021` SAGA_STATE_STORE_SCHEMA_VERSION_MISMATCH：持久化表的 schema_version 与代码内 SCHEMA_VERSION 不一致

§6.5 转译纪律：原始 PG 错误码 / SQL 文本不会透出到 SagaStateStoreError；仅
产出领域级摘要。

## 契约覆盖

- 13 个基础契约 it（`defineSagaStateStoreContractTests`）—— 仅在
  `TIANQI_TEST_POSTGRES_URL` 设置时运行；否则全部 skip
- 8 个持久化契约 it（`definePersistentSagaStateStoreContractTests`，元规则 E）——
  同样依赖环境变量
- 4 个自有 it（身份 / schema 校验 / health check / 不可达 init）

## 不实现的能力

- **Saga 编排算法**：Step 6 SagaOrchestrator 职责，不在本 Adapter 范围
- **死信存储**：见 [`@tianqi/dead-letter-store-postgres`](../dead-letter-store-postgres)（Step 4 落地）
- **审计事件写入**：调用方（Step 9 编排器）职责，不在本 Adapter 范围（元规则 F）
- **状态历史归档 / TTL 清理**：Phase 10+ 责任；当前实现保留所有 saga 状态
  行（含终态 completed / compensated / partially_compensated / timed_out）
- **schema 迁移自动化**：当前 `init()` 仅做 idempotent bootstrap；schema_version
  不匹配时抛 TQ-INF-021 让操作员介入。Phase 11 部署模型 ADR 后引入正式迁移工具

## 部署提醒

- 推荐 `schema` 名命名空间隔离不同 saga 类型 / 不同环境（譬如 `tianqi_saga_state_prod`、`tianqi_saga_state_test`）
- Phase 11 部署模型 ADR 决定后引入正式迁移脚本（当前 `init()` 是 idempotent
  bootstrap，适合 Phase 9-10 的"零迁移单 schema_version"运行模式）
