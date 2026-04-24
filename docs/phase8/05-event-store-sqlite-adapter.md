# Phase 8 / Step 5 — @tianqi/event-store-sqlite + 持久化契约套件

## A. Step 5 定位

Step 1–4 把 Phase 8 从"空目录"推进到"第一个通过全部基础契约的内存 Adapter"。Step 5 是 Phase 8 首次触地磁盘的一步，同时在 adapter-testkit 内落地针对"持久化 Adapter"的独立契约套件 `definePersistentEventStoreContractTests`（对齐 Step 3 Step 4 记录的元规则 E：持久化契约必须走独立函数，严禁塞进基础 `defineEventStoreContractTests`）。

本 Step 完成后，`@tianqi/event-store-sqlite` 以两行挂载（一行基础契约 + 一行持久化契约）驱动 21 + 12 = 33 个 `it` 块全绿，外加 5 个 Adapter 自有单元测试，构成 Phase 8 首份"真实持久化 Adapter"的合格证据。

## B. 设计决策：工厂签名强制 `databasePath`

`createSqliteEventStore(options: SqliteEventStoreOptions)` 不提供无 options 的重载。`SqliteEventStoreOptions.databasePath` 是必填字符串。这与 Step 4 的 `createInMemoryEventStore(options?)` 空 options 形成刻意的对称差异：

- 内存 Adapter 没有外部资源锚点，调用方不需要传任何东西。
- 持久化 Adapter 没有合理的"默认路径"——任何隐式路径都会误导调用方（隐含路径可能与另一 Adapter 实例、另一服务、容器外机器存储混淆）。强制调用方显式给出路径，是把"数据到底存哪里"这个决定从 Adapter 移回调用方，符合《宪法》§5.2"基础设施通过适配器注入"的精神。

同时，`databasePath` 的特殊值 `":memory:"` 被 better-sqlite3 原生支持——Phase 8 以后若某 Application 测试需要"用 SQLite 语义但不落盘"的短命实例，直接传 `":memory:"` 即可。

## C. Schema 结构选择

两表 + 一索引的设计在《补充文档》§3.6 健康检查强制、§3.7 Adapter 替换原则之间取了最小充分交集：

1. **`events` 表以 `event_id` UNIQUE + `append_seq AUTOINCREMENT PRIMARY KEY`**：`event_id` UNIQUE 让幂等去重通过 `INSERT OR IGNORE` 原子化（无 SELECT-then-INSERT 竞态）；`append_seq AUTOINCREMENT` 映射到 SQLite ROWID，跨生命周期严格单调递增，即使事件被删除后重建也不会冲突——这保证了同 `occurred_at` 的 tie-breaker 在 Adapter 重启、跨会话场景下仍然稳定。
2. **`(case_id, occurred_at, append_seq)` 复合索引**：直接匹配 `listByCaseId` 的 `WHERE case_id = ? ORDER BY occurred_at, append_seq` 查询形状，无需回表即可满足读取顺序契约。
3. **`payload` 与 `metadata` 以 `TEXT` 存 JSON 字符串**：SQLite 无原生 JSON 类型（JSONB 是 Postgres 的专属），`TEXT` 是工业约定；Application 层不直接 SQL 查询这两个字段，Adapter 内部 `JSON.parse`/`JSON.stringify` 自闭环。
4. **`schema_version` 单行表 + `CHECK (id = 1)`**：保证只有一行；`INSERT OR IGNORE` 种子只在空库时写入 `"1.0.0"`；后续 init 不覆盖既有值。这为 Step 5 以外的未来 migration（真实版本演进驱动时）留下锚点，不预构建 migration 框架。

## D. 元规则 G 的本 Step 落地细节

本 Step 首次触发元规则 G（第三方依赖准入）：

| 条款                               | 验证                                                                                                 |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 工业标准                           | `better-sqlite3` 是 Node.js 同步 SQLite 绑定事实上的工业标准（WiseLibs 维护，下载量千万级）          |
| 许可证                             | MIT 许可（符合 MIT / Apache-2.0 / ISC 白名单）                                                       |
| 在 dependencies 而非 peer/optional | `packages/adapters/event-store-sqlite/package.json` 的 `"dependencies"` 字段                         |
| 精确版本锁                         | `"better-sqlite3": "11.5.0"`，无 `^` 或 `~` 前缀                                                     |
| README 说明唯一理由                | `packages/adapters/event-store-sqlite/README.md` §"为何引入 `better-sqlite3`" 节明述四条不可替代理由 |

同步绑定需要 native 编译。根 `package.json` 的 `pnpm.onlyBuiltDependencies` 声明 `["better-sqlite3"]`，让 pnpm 在 install 时允许执行 better-sqlite3 的 `install` 脚本（gyp build）。这是 Phase 8 首次在根 `package.json` 配置 `pnpm.*` 字段。

`@types/better-sqlite3@7.6.11` 作为 devDependency 精确版本锁（类型定义包，不算运行时依赖但仍遵循版本锁纪律）。

## E. 元规则 H 的本 Step 落地细节

元规则 H（持久化 Adapter 必须管理自身 schema）在本 Step 首次实战：

- `init()` 依次执行 `EVENTS_TABLE_DDL` → `EVENTS_INDEX_DDL` → `SCHEMA_VERSION_TABLE_DDL` → `SCHEMA_VERSION_SEED_DML`，全部使用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` / `INSERT OR IGNORE`——重复 `init()` 不重建 schema、不重复 seed。
- `init()` 末尾读取 `schema_version.version` 并与 Adapter 代码常量 `SCHEMA_VERSION = "1.0.0"` 比对；不一致即抛 `TQ-INF-008` 错误。
- schema 建立失败（open failure）抛 `TQ-INF-005`。schema 版本不一致抛 `TQ-INF-008`。两条错误码的触发路径与第五节错误码对应表中的 `it` 块一一绑定。

## F. PersistentEventStoreContractOptions 字段选择

`PersistentEventStoreContractOptions` 当前两字段：

```ts
type PersistentEventStoreContractOptions = Readonly<{
  scratchDirectory: string;
  corruptSchemaVersion: (
    session: PersistentTestSession,
    newVersion: string
  ) => void | Promise<void>;
}>;
```

- **`scratchDirectory`**：testkit 用作"生成唯一数据库路径"的前缀。testkit 不创建、不清理该目录——Adapter test 通过 `mkdirSync(recursive)` + `afterAll(rmSync)` 负责生命周期。这个边界明确把"文件系统副作用"留在 Adapter test 文件里，testkit 保持无 I/O。
- **`corruptSchemaVersion`**：schema 版本不匹配测试（P2.3）需要"从 Adapter 外部"改写 schema_version。testkit 本身不得依赖任何持久化技术（元规则 D 严禁 testkit 引入 better-sqlite3），所以这项动作作为 options 回调注入。SQLite Adapter 测试用一次性的 better-sqlite3 连接执行 `UPDATE schema_version`；未来的 Postgres Adapter（Step 6）会注入一个用 `pg` 客户端执行的对应动作，testkit 零修改。

两个字段都是必填（不是 `readonly ... ?`）——因为 4 类契约的每一类都至少有一个 it 块必须调用它们；把它们标记为可选会让调用方有机会"跳过 P2.3"并谎报"已通过"，违反元规则 E 的意图。

## G. 并发场景下 SQLite 文件锁的选择

better-sqlite3 默认使用 SQLite 的 rollback journal 锁模式（非 WAL）。两个独立 Adapter 实例打开同一 `databasePath` 时：

- 两边都 `init()`：通常成功（SQLite 允许多个连接共享数据库，CREATE IF NOT EXISTS 是串行化写入）
- 一个 Adapter append 时，另一个 Adapter 的 listByCaseId（读）会等待 writer 释放 writer lock
- 在本 Step 的并发契约测试中，这表现为：P3.3 "两个独立 Adapter 实例都可见已提交事件"能稳定通过；P3.2 "Promise.all 并发 append" 在单进程内由 JavaScript 事件循环串行化（better-sqlite3 同步 API 本身就串行），无真正竞争。

对于多进程 writer 并发，本 Step 不做约束——该场景由未来的 Postgres Adapter（Step 6，真正的客户端-服务器架构）承担；SQLite 场景下，Tianqi 假定单进程单连接是典型部署。

## H. 元规则 A–H 触发情况

- **元规则 A（指令 vs 既有事实冲突）**：未触发。Step 5 指令与既有仓库事实无冲突。
- **元规则 B（adapter-testkit 签名兼容）**：未直接触发——`definePersistentEventStoreContractTests` 是本 Step 首次发布，无既有签名可兼容。其泛型约束 `T extends EventStoreAdapterUnderTest` 与 `defineEventStoreContractTests` 同形，options 对象包含两字段遵循"可扩展"原则。
- **元规则 C（EventStorePort 只写）**：被贯彻。SQLite Adapter 实现的 `EventStorePort` 仍只有 `append`；读取能力通过 `EventStoreContractProbe` 暴露（测试专用）。
- **元规则 D（adapter-testkit 依赖边界）**：被贯彻。adapter-testkit 新增的 persistent contract 源码仅依赖 `{contracts, ports, shared}` + vitest；schema_version 损毁通过 options 回调外置，testkit 零引入 better-sqlite3。
- **元规则 E（持久化契约独立函数）**：首次实战。持久化相关的 12 个 it 块一律走 `definePersistentEventStoreContractTests`，与 `defineEventStoreContractTests` 的 21 个基础 it 完全分离。event-store-sqlite 两行挂载；event-store-memory 不需要第二行（因不持久化）。
- **元规则 F（参考实现跨包引用禁令）**：被贯彻。event-store-sqlite 源码零 `import` 指向 `adapter-testkit/src/fixtures/...` 或 event-store-memory；实现从零写，schema 校验逻辑与前两者结构同构但独立落地。
- **元规则 G（第三方依赖准入）**：首次实战。better-sqlite3@11.5.0 逐条通过准入（见 §D）。
- **元规则 H（持久化 Adapter 自管 schema）**：首次实战。init() 内部幂等 DDL + schema_version 检查 + 版本不匹配抛 TQ-INF-008（见 §E）。

## I. 新增错误码 → it 块对应表

| 错误码       | 名称                             | 触发的 `it` 块                                                                               |
| ------------ | -------------------------------- | -------------------------------------------------------------------------------------------- |
| `TQ-INF-005` | `SQLITE_DATABASE_UNREACHABLE`    | P4.2 `test_health_check_on_unreachable_database_path_returns_healthy_false_without_throwing` |
| `TQ-INF-008` | `SQLITE_SCHEMA_VERSION_MISMATCH` | P2.3 `test_init_on_schema_version_mismatch_rejects_with_tq_inf_schema_version_mismatch`      |

号段沿用 Phase 8 既定规则（每个命名空间下一个可用号）：TQ-INF-005 / TQ-INF-008 是 TQ-INF 命名空间的次序延续。号段之间的 TQ-INF-006 / TQ-INF-007 暂不使用——指令候选中的 `SQLITE_SCHEMA_SETUP_FAILED` 与 `SQLITE_TRANSACTION_FAILED` 在本 Step 的 it 块中没有自然触发点，按"无对应断言即不新增"的纪律（Step 3 §D 立）不填充。真正遇到该场景的 Step 再新增。

## J. 风险点

- **better-sqlite3 原生模块的 CI 构建**：Phase 10 进入 CI/CD 阶段时，CI 环境必须具备 C++ 构建工具链（node-gyp / python / C++ compiler）。macOS 本地开发已验证；Linux CI 需预装 `build-essential`；Docker 镜像需用 build-stage 构建后复制 `node_modules/.pnpm/better-sqlite3@.../build/Release/better_sqlite3.node` 到 runtime 镜像。这些细节留给 Phase 10 runbook。
- **文件锁与多进程**：本 Step 假定单进程单连接。多进程 writer 写入同一 SQLite 文件可能遇到锁等待/超时；Tianqi 当前不预设该场景，Application 层应通过部署约束避免（例如部署时 enforce 单 leader）。
- **schema migration 机制缺席**：本 Step 只落地 `schema_version` 表作为锚点；真实的 schema 演进（ALTER TABLE, 字段新增, 索引重建）需要真实版本驱动时才构建。本 Step 不做 migration 框架——过早抽象违反天启宗旨第六条"克制 > 堆砌"。

## K. 对 Step 6（Postgres）的衔接

Step 6 将建立 `@tianqi/event-store-postgres`。从 Step 5 到 Step 6 的演进仅涉及两处换装：

1. Adapter 内部从 better-sqlite3 换成 `pg`（PostgreSQL 官方客户端）。schema SQL 需要相应调整（INTEGER PRIMARY KEY AUTOINCREMENT → BIGSERIAL；TEXT → JSONB 等）。
2. 契约挂载形状完全不变：

```ts
defineEventStoreContractTests("event-store-postgres", () =>
  createPostgresEventStore({ connectionString })
);
definePersistentEventStoreContractTests(
  "event-store-postgres",
  (session) => createPostgresEventStore({ connectionString: buildConnStringFromSession(session) }),
  { scratchDirectory, corruptSchemaVersion: postgresCorruptFn }
);
```

Step 6 复用本 Step 的 `PersistentEventStoreContractOptions` / `PersistentTestSession` / `definePersistentEventStoreContractTests`——元规则 B 保证签名兼容。
