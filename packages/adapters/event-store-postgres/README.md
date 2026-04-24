# @tianqi/event-store-postgres

## 它是什么

`@tianqi/event-store-postgres` 是 Tianqi 的第三个 EventStore Adapter——`EventStorePort` 基于 PostgreSQL 的持久化实现，使用 `pg` 作为驱动、`pg.Pool` 作为连接池。它与 Step 4 的 `@tianqi/event-store-memory` 和 Step 5 的 `@tianqi/event-store-sqlite` 通过**同一份** `defineEventStoreContractTests` + `definePersistentEventStoreContractTests` 证明自己合格——21 基础契约 + 12 持久化契约共 33 个 `it` 块挂载在两行代码上。

对外唯一构造入口是 `createPostgresEventStore(options: PostgresEventStoreOptions)`，`connectionString` 必填。

## 它不是什么

- **不是多 shard / 逻辑复制目标**：本 Adapter 是单库单 schema 写入；LISTEN/NOTIFY、logical replication、分区表等能力不在 Phase 8 范围内。
- **不是 ORM 层的一部分**：本 Adapter 不引入 knex / drizzle / typeorm，使用 `pg` 原生参数化查询。
- **不是 schema migration 工具**：与 Step 5 同纪律，`schema_version` 表只作为未来 migration 的锚点。

## 为何引入 `pg`

`pg` 是 Node.js PostgreSQL 客户端事实上的标准（月下载量千万级、MIT 许可、由 brianc 长期维护），无替代者能同时满足：纯 JS（无 native 编译负担，不扩张 `pnpm.onlyBuiltDependencies`）、参数化查询原生支持、`Pool` 开箱即用、TIMESTAMPTZ / JSONB 自动编解码。版本精确锁定 `pg@8.13.1`（元规则 G）。

`@types/pg@8.11.10` 作为 devDependency 精确版本锁。

## 依赖边界

- **生产依赖**：`@tianqi/contracts`、`@tianqi/ports`、`@tianqi/shared`、`pg@8.13.1`。
- **测试依赖**：`@tianqi/adapter-testkit`、`@types/pg@8.11.10`。
- **严禁**：`@tianqi/domain` / `@tianqi/application` / `@tianqi/policy`；任何 ORM；任何连接池包装器（沿用 pg.Pool 原生语义）。

## Schema 结构

schema 设计与 SQLite Adapter 语义同构，但使用 Postgres 原生类型：

```sql
CREATE SCHEMA IF NOT EXISTS "<schema>";

CREATE TABLE IF NOT EXISTS "<schema>".events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  producer TEXT NOT NULL,
  payload JSONB NOT NULL,
  metadata JSONB NOT NULL,
  append_seq BIGSERIAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_case_occurred_seq
  ON "<schema>".events (case_id, occurred_at, append_seq);

CREATE TABLE IF NOT EXISTS "<schema>".schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL
);

INSERT INTO "<schema>".schema_version (id, version) VALUES (1, '1.0.0')
  ON CONFLICT (id) DO NOTHING;
```

允许偏离 SQLite 的点：

1. **`payload` / `metadata` 使用 `JSONB` 而非 `TEXT`**：Postgres 原生支持 JSONB，存储更紧凑、查询性能更好、pg 驱动自动双向转换。SQLite 不支持 JSONB，故用 TEXT 存 JSON 字符串。
2. **`occurred_at` 使用 `TIMESTAMPTZ` 而非 `TEXT`**：Postgres 原生时间类型；Tianqi 层仍以 ISO-8601 字符串交互，Adapter 内部在读取时 `date.toISOString()` 转回字符串。
3. **`append_seq` 使用 `BIGSERIAL`**：Postgres 惯用自增类型。与 SQLite 的 `AUTOINCREMENT` 语义等价（严格单调）。
4. **`schema_version.id` 约束用 `CHECK (id = 1)` 且配合 `ON CONFLICT (id) DO NOTHING`**：Postgres 原生 `ON CONFLICT` 语法；SQLite 用 `INSERT OR IGNORE`。

错误码 `TQ-INF-008 SQLITE_SCHEMA_VERSION_MISMATCH` 在本 Adapter 语义上也适用——两 Adapter 的 `schema_version` 表完全同构。常量名的 `SQLITE_` 前缀是 Step 5 命名时的局限，Step 6 复用该 code（字符串 `"TQ-INF-008"`）不新增 TQ-INF-012（详见 [docs/phase8/06](../../../docs/phase8/06-event-store-postgres-adapter.md) §C）。

## 如何被 Application 层使用

```ts
import { createPostgresEventStore } from "@tianqi/event-store-postgres";
import type { EventStorePort, AdapterFoundation } from "@tianqi/ports";

const adapter: EventStorePort & AdapterFoundation = createPostgresEventStore({
  connectionString: "postgres://user:pass@host:5432/tianqi",
  poolSize: 10,
  connectionTimeoutMs: 5000,
  healthCheckTimeoutMs: 2000
});
await adapter.init();
// ... append / healthCheck
await adapter.shutdown();
```

## 测试与 `TIANQI_TEST_POSTGRES_URL`

本 Adapter 的契约测试与真实 Postgres 服务器交互。若环境变量 `TIANQI_TEST_POSTGRES_URL`（形如 `postgres://user:pass@host:port/db`）未设置，所有需要真实 Postgres 的测试通过 `describe.skipIf` 整块跳过——CI 不会因 Postgres 不可达而红。
