# @tianqi/event-store-sqlite

## 它是什么

`@tianqi/event-store-sqlite` 是 Tianqi 的第二个正式 EventStore Adapter——`EventStorePort` 的 SQLite 持久化实现。它同时实现 `AdapterFoundation`（Step 2）、`EventStoreContractProbe`（Step 3），在 Step 3 的 21 个基础契约断言之外，还通过 Step 5 新增的 `definePersistentEventStoreContractTests`（共 12 个 `it` 块）证明它满足持久化专属契约：跨重启恢复、schema 版本管理、事务原子性、健康检查细节。

对外唯一构造入口是工厂函数 `createSqliteEventStore(options: SqliteEventStoreOptions)`——`databasePath` 必填，无"省略 options"的便利重载。

## 它不是什么

- **不是多进程共享总线**：SQLite 本身支持多进程连接，但本 Adapter 假定单进程单连接为典型场景。
- **不是高并发写入的选择**：SQLite 写入是串行化的；本 Adapter 适合中小吞吐场景。高并发写入请用 `@tianqi/event-store-postgres`（Step 6）。
- **不是 schema migration 工具**：本 Step 只落地 `schema_version` 表作为未来 migration 基座；具体 migration 机制由真实版本演进驱动，不预构建。

## 为何引入 `better-sqlite3`

`better-sqlite3` 是 Node.js 生态中 SQLite 同步绑定事实上的工业标准，MIT 许可，无替代者能同时满足以下四点：

1. **同步 API**：避免 Promise 包装的异步开销；SQLite 本身是嵌入式数据库，同步接口更贴近其本质。
2. **预编译二进制**：主流平台（macOS / Linux / Windows × x64/arm64）有预编译的 native binding，减少 CI 构建时间。
3. **事务与 prepared statement 原生支持**：`db.prepare(sql)` + `statement.run(params)` 的简洁 API，避免字符串拼接注入风险。
4. **维护活跃**：由 WiseLibs 长期维护，兼容 Node 20+。

版本精确锁定为 `11.5.0`（遵循元规则 G：第三方依赖必须精确版本锁）。升级必须走破坏性契约变更流程。

## 依赖边界

- **生产依赖**：`@tianqi/contracts`、`@tianqi/ports`、`@tianqi/shared`、`better-sqlite3@11.5.0`。
- **测试依赖**：`@tianqi/adapter-testkit`（devDependency）、`@types/better-sqlite3`（devDependency）。
- **严禁**依赖 `@tianqi/domain` / `@tianqi/application` / `@tianqi/policy`。

## Schema 结构

本 Adapter 在 `init()` 时自检并建立以下 schema（幂等）：

```sql
CREATE TABLE IF NOT EXISTS events (
  append_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  event_version TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  producer TEXT NOT NULL,
  payload TEXT NOT NULL,
  metadata TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_case_occurred_seq
  ON events (case_id, occurred_at, append_seq);

CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  version TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, '1.0.0');
```

- `append_seq` 是 `AUTOINCREMENT` 列，作为同 `occurred_at` 的稳定 tie-breaker。
- `event_id` 是 `UNIQUE` 约束——幂等去重通过 `INSERT OR IGNORE` 原子实现，无竞态。
- `payload` 与 `metadata` 以 JSON 字符串存于 `TEXT` 列（SQLite 无原生 JSON 类型时的工业约定）。
- `schema_version` 单行，`id = 1` 的 `CHECK` 约束保证唯一。

## 如何被 Application 层使用

```ts
import { createSqliteEventStore } from "@tianqi/event-store-sqlite";
import type { EventStorePort, AdapterFoundation } from "@tianqi/ports";

const adapter: EventStorePort & AdapterFoundation = createSqliteEventStore({
  databasePath: "/var/lib/tianqi/events.sqlite"
});
await adapter.init();
// ... append / healthCheck
await adapter.shutdown();
```

Application 层标注变量为 `EventStorePort & AdapterFoundation` 即让 TypeScript 拒绝访问 `listByCaseId / countTotal` 等 probe 方法。
