# `@tianqi/dead-letter-store-postgres`

Phase 9 / Step 4 引入。DeadLetterStorePort 的 PostgreSQL 持久化实现。

## 包定位

应用层 Step 9 人工介入接口的生产路径默认实现。承担《§4.6》死信约束：补
偿失败的 saga step 必须可追溯、可人工介入、可长期审计保留。

## 快速开始

```ts
import { createPostgresDeadLetterStore } from "@tianqi/dead-letter-store-postgres";

const store = createPostgresDeadLetterStore({
  connectionString: process.env["TIANQI_POSTGRES_URL"]!,
  schema: "tianqi_dead_letter",
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
2. `CREATE TABLE IF NOT EXISTS "<schema>".dead_letter_entries` —— 单表 14 列；
   `compensation_context` / `failure_chain` 用 JSONB
3. `CREATE INDEX idx_dlq_saga_id` —— 支持 `listBySaga` 高效查询
4. `CREATE INDEX idx_dlq_pending` —— 部分索引仅覆盖 `status='pending'` 的行
   （listPending 是最频繁运维操作；已处理 / 归档行不在索引内）
5. `CREATE TABLE schema_version` + INSERT + 校验

## Semantics 三条声明（元规则 N）

1. **持久化保证**：所有 enqueue / markAsProcessed 都已落盘（pg 默认 fsync）；
   进程崩溃后 load 能读回崩溃前最后一次状态。
2. **一致性保证**：read-after-write 强一致（pg read-committed 隔离）。同
   entryId 并发 enqueue 是 last-write-wins（INSERT ... ON CONFLICT DO UPDATE
   保证）。markAsProcessed 是单 UPDATE，原子。
3. **多实例语义**：多个 createPostgresDeadLetterStore() 实例（即使分布于
   不同进程）访问同一 schema 时**共享同一份 dead_letter_entries 表**——这
   与 `dead-letter-store-memory` 的"多实例独立"行为相反。

## 错误码

- `TQ-INF-002` ADAPTER_INITIALIZATION_FAILED：schema 名格式不合法
- `TQ-INF-009` POSTGRES_UNREACHABLE：init 时连接 postgres 失败
- `TQ-INF-022` DEAD_LETTER_STORE_NOT_INITIALIZED：在 `init()` 前调用 enqueue 等
- `TQ-INF-023` DEAD_LETTER_STORE_ALREADY_SHUT_DOWN：在 `shutdown()` 后调用上述方法
- `TQ-INF-024` DEAD_LETTER_STORE_SCHEMA_VERSION_MISMATCH：持久化表 schema_version 不匹配

§6.5 转译纪律：原始 PG 错误码 / SQL 文本不会透出到 DeadLetterStoreError；
仅产出领域级摘要。

## 契约覆盖

- 14 个基础契约 it（`defineDeadLetterStoreContractTests`）—— 仅在
  `TIANQI_TEST_POSTGRES_URL` 设置时运行；否则全部 skip
- 8 个持久化契约 it（`definePersistentDeadLetterStoreContractTests`，元规
  则 E 第三次实战）—— 同样依赖环境变量
- 4 个自有 it（身份 / schema 校验 / health check / 不可达 init）

## 不实现的能力

- **审计事件写入**：调用方（Step 9 人工介入接口）职责，不在本 Adapter 范围（元规则 F）
- **死信清理 / 归档 / TTL**：Phase 10+ 责任。`DeadLetterEntryStatus` 含
  `archived` 终态值供未来归档转换 API 使用，但本 Step 不实现转换接口
- **死信删除**：合规要求长期保留，DeadLetterStorePort 不提供 delete

## 部署提醒

- 推荐 `schema` 名命名空间隔离不同环境（譬如 `tianqi_dead_letter_prod`）
- 部分索引 `idx_dlq_pending` 在 status 字段更新时由 postgres 自动维护
  （pending → processed 时该行从索引中移出；不需要应用层关注）
- Phase 11 部署模型 ADR 决定后引入正式迁移脚本
