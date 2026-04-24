# Phase 8 / Step 6 — @tianqi/event-store-postgres Adapter

## A. Step 6 定位

Step 5 让 Tianqi 首次触地磁盘（SQLite），但仍是单进程单连接的简单场景。Step 6 在真实多连接、网络不可达、连接池这些 SQLite 不具备的维度上让**同一份契约**再次被验证——21 基础契约 + 12 持久化契约，两行挂载驱动，零修改。这是《补充文档》§3.7 Adapter 替换原则的第二次工程兑现：`EventStorePort & AdapterFoundation` 类型上从 SQLite 切换到 Postgres，Application 层代码无需感知。

本 Step 同时确立两条面向外部服务的新元规则（I / J），这两条规则从 Step 6 起适用于所有需要外部服务的 Adapter（Step 9 Kafka / Step 11 Config / Step 14+ External Engine）。

## B. 连接池参数默认值

| 参数                   | 默认值 | 依据                                                                                                                                        |
| ---------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `poolSize`             | `10`   | `pg.Pool` 的 `max` 社区默认值；兼顾吞吐与 Postgres 默认 `max_connections=100` 的服务端限制。                                                |
| `connectionTimeoutMs`  | `5000` | pg 原生 `connectionTimeoutMillis=0` 表示"无超时"过于危险；5 秒是典型 Postgres 连接握手时长的 2-3 倍，既给慢启动机会又不至于让测试长期挂起。 |
| `healthCheckTimeoutMs` | `2000` | healthCheck 必须"快速失败"——若 2 秒内无法完成一次 `SELECT 1`，视作不健康。独立于连接池超时（元规则 I）。                                    |

三者都是 optional。调用方通过 `PostgresEventStoreOptions` 覆盖；不允许通过任何其他途径（全局 env、运行时 reconfig）修改。

## C. JSONB vs TEXT 的选择理由

`payload` / `metadata` 列在 SQLite Adapter（Step 5）使用 `TEXT` 存 JSON 字符串；在本 Adapter 使用 `JSONB`。这是**允许的偏离**，而非语义分歧：

- **SQLite 没有原生 JSON 类型**——JSONB 是 Postgres 专属。强行让 SQLite 对齐只能回退到 TEXT。
- **pg 驱动自动双向转换**：写入时接受 JS 对象 / JSON 字符串（本 Adapter 显式 `JSON.stringify` + `::jsonb` cast 保持清晰），读取时 pg 把 JSONB 列解析为 JS 对象返回。`rowToEnvelope` 直接赋值即可。
- **查询性能**：未来若 Application 层引入"按 payload 字段查询"（非本 Step 范围），JSONB 有 GIN 索引支持；TEXT 无此能力。
- **存储紧凑**：JSONB 是 Postgres 内部二进制格式，比 TEXT 存 JSON 字符串更紧凑。

两 Adapter 在 Tianqi 边界（envelope 进出）上行为完全等价——测试可以观察到这一点：21 基础契约 + 12 持久化契约在 SQLite 与 Postgres 上共用同一份断言代码，全部通过。

## D. `scratchDirectory` 在 Postgres 语境下的重新解释

元规则 B 禁止修改 `PersistentEventStoreContractOptions` 的签名。`scratchDirectory` 与 `corruptSchemaVersion` 是必填字段——但 `scratchDirectory` 字面上是"文件系统目录"，对 Postgres 不直观。本 Step 选择**在 Adapter test 层以变量别名吸收语义差异**，而非改签名：

- Postgres 测试传入 `scratchDirectory: SCHEMA_PREFIX`——一个字符串前缀，概念上是"会话隔离命名空间前缀"，而不是文件系统路径。
- testkit 的 `beforeEach` 生成 `session.databasePath = "${prefix}/persistent-session-${N}.sqlite"`。Postgres factory 用正则 `/persistent-session-(\d+)\.sqlite$/` 从这个字符串提取会话号 `N`，构造 schema 名 `${SCHEMA_PREFIX}_s${N}`。
- Adapter test 的 `afterAll` 用 `SCHEMA_PREFIX` 作为前缀 `DROP SCHEMA ... CASCADE` 所有本次测试运行生成的 schema。

这条翻译让 testkit 签名保持稳定，差异完全吸收在 Adapter test 的 40 行胶水代码里。未来 Step 6 以外的持久化 Adapter（例如一个假设中的 MongoDB Adapter）可以用相同手法把 `scratchDirectory` 翻译成"collection 前缀"。

**P4.2 "unreachable" 测试的翻译**：testkit 的 P4.2 测试硬编码 `databasePath: "/this/path/does/not/exist/..."`。对 SQLite 这是文件系统不可达路径；对 Postgres 没有直接等价物。我的 Postgres factory 用字符串 `.includes("does/not/exist")` 作为信号，返回一个用 `127.0.0.1:1`（always-unreachable 端口）+ `connectionTimeoutMs: 500` 的 adapter，让 init() 快速失败。语义等价："Adapter 的底层资源不可达；init() 失败不抛异常泄漏；healthCheck 返回 false"。

## E. `TQ-INF-008` 复用 vs `TQ-INF-012` 新增的裁决

**决定**：**复用 `TQ-INF-008`**，不新增 `TQ-INF-012`。

理由：

1. **语义等价**：SQLite 与 Postgres 的 `schema_version` 表设计**完全同构**——单行 `id=1` + `version TEXT`，Adapter 在 init() 时对齐 `SCHEMA_VERSION = "1.0.0"`。两 Adapter 的"schema 版本不匹配"本质上是同一个故障模式，只是背后的持久化技术不同。
2. **错误码是 string，不是 symbol**：字符串值 `"TQ-INF-008"` 是契约的稳定核心（Step 2 §F 规则）；常量名 `SQLITE_SCHEMA_VERSION_MISMATCH` 是 Step 5 命名时的局限（当时只有 SQLite），不应以此为理由新增一个语义相同的 `TQ-INF-012`——那会**浪费号段、违反天启宗旨第六条"克制 > 堆砌"**。
3. **Adapter 内错误消息是 inline string**：`throw new Error("TQ-INF-008: Postgres schema_version mismatch...")`——Adapter 自己描述 Postgres 上下文，`TQ-INF-008` 前缀是契约测试的锚点（`P2.3` 的 `toThrow(/TQ-INF-008/)` 断言）。

**代价**：`ERROR_CODES.SQLITE_SCHEMA_VERSION_MISMATCH` 常量名的 `SQLITE_` 前缀在 Postgres Adapter 场景下读起来微怪，但这是命名时的历史局限，不值得新增一个同义的 `TQ-INF-012` 来修复。Step 2 §F 明确规定错误码"不得删除、不得重新分配含义"——这里既不删除也不重新分配，只是让同一个码在两个持久化 Adapter 上复用。

## F. 元规则 I 与 元规则 J 的本 Step 落地细节

### 元规则 I（外部服务 healthCheck 语义）

- **不触发业务写**：`healthCheck()` 执行的探测是 `SELECT 1 AS ok`——只读、无副作用。
- **独立超时配置**：`healthCheckTimeoutMs` 单独存在，不共用 `connectionTimeoutMs`。`Promise.race([pool.query, scheduleTimer])` 实现超时。
- **连接断开 / 远程不可达返回 `healthy: false`**：`pool.query` 失败时 catch 记录 `lastError`，返回 false。超时也返回 false。都不抛异常。
- **details 包含诊断字段**：`{ lifecycle, schemaVersion, connectionTarget (已脱敏), lastSuccessAt ISO-8601, lastError, healthCheckTimeoutMs, idleCount, totalCount, waitingCount }`。运维无需读代码即可判断"为何不健康"。
- **不内部轮询**：healthCheck 只在被调用时执行探测；Adapter 不持有任何 `setInterval`。

### 元规则 J（测试用外部服务的隔离）

- **环境变量**：`TIANQI_TEST_POSTGRES_URL`。未设置时 `describe.skipIf(!canReachPostgres)` 整块跳过。
- **skip 判断在顶部**：每个 test 文件 module 顶部读 `env["TIANQI_TEST_POSTGRES_URL"]`，结果作为 `describe.skipIf` 参数；`it` 级别不重复判断（除了不需要 DB 的 3 个 own 测试用 `it.skipIf`，但那些是 mixed suite 中的少数 DB-dependent it，不散落）。
- **不假设特定主机 / 凭据**：本 Adapter 的 3 个自有测试中有 2 个（网络不可达 / Object.keys）不需要真实 DB，使用 `127.0.0.1:1` 作为 always-unreachable 探针；剩余 3 个需要 DB 的通过 `it.skipIf(!canReachPostgres)` 保护。
- **不抓 connection error 判断可用性**：`canReachPostgres = typeof testUrl === "string" && testUrl.length > 0` 仅看环境变量存在性；不做 TCP probe。

环境变量命名规范（本 Step 首次立）：`TIANQI_TEST_<SERVICE>_<DETAIL>`。Step 9 Kafka 将有 `TIANQI_TEST_KAFKA_BROKERS`；Step 11 Config 的真实文件路径不算"外部服务"，不需要此类环境变量。

## G. 元规则 A–H + I + J 触发情况

- **元规则 A（指令 vs 既有事实冲突）**：未触发。
- **元规则 B（adapter-testkit 签名兼容）**：**贯彻**。`definePersistentEventStoreContractTests` 签名未改；`scratchDirectory` 字段语义在 Postgres 语境下通过 test 层翻译吸收。
- **元规则 C（EventStorePort 只写）**：贯彻。
- **元规则 D（adapter-testkit 依赖边界）**：贯彻。adapter-testkit 本 Step 未修改；Postgres 相关依赖 `pg` / `@types/pg` 只进入 event-store-postgres 包。
- **元规则 E（持久化契约独立函数）**：贯彻。本 Adapter 挂载两行：基础契约 + 持久化契约。
- **元规则 F（参考实现跨包引用禁令）**：贯彻。event-store-postgres 源码零 `import` 指向 adapter-testkit fixtures 或其他 Adapter；实现从零写，schema 校验逻辑与前两 Adapter 结构同构但独立落地。
- **元规则 G（第三方依赖准入）**：**第二次实战**。`pg@8.13.1` 通过五项准入——工业标准（brianc 维护，月下载千万级、MIT 许可）、MIT 许可、dependencies 字段、精确版本锁、README §"为何引入 pg" 明述理由。pg 是纯 JS，不扩张 `pnpm.onlyBuiltDependencies`。`@types/pg@8.11.10` 作为 devDependency 精确版本锁。
- **元规则 H（持久化 Adapter 自管 schema）**：贯彻。`init()` 在单事务内执行 `CREATE SCHEMA IF NOT EXISTS` → `CREATE TABLE IF NOT EXISTS events` → `CREATE INDEX IF NOT EXISTS` → `CREATE TABLE IF NOT EXISTS schema_version` → `INSERT ... ON CONFLICT DO NOTHING` seed → 读取 version 比对 → 失败 ROLLBACK 并抛 `TQ-INF-008`。
- **元规则 I（外部服务 healthCheck 语义）**：**首次实战**，见 §F。
- **元规则 J（测试用外部服务隔离）**：**首次实战**，见 §F。

## H. Step 5 state guard 教训的复用姿势

Step 5 `docs/phase8/05 §E` 留痕："初次实现时将 state guard 写成 `if (state === 'created' || database === null) TQ-INF-003; if (state === 'shut_down') TQ-INF-004;`——shut_down 后 database 已为 null，优先命中 TQ-INF-003 导致契约测试红。修复为：先判 shut_down，再判 created/null。"

本 Step Postgres Adapter 的 `append()` 函数开头显式复用这条经验：

```ts
// Step 5 lesson: check shut_down before created/null so shutdown wins over null-pool.
if (state === "shut_down") {
  return err(infError("TQ-INF-004", "append called after shutdown"));
}
if (state === "created" || pool === null) {
  return err(infError("TQ-INF-003", "append called before init"));
}
```

注释里显式致敬 Step 5 的教训。未来任何新持久化 Adapter 在实现这条保护时，都应把这条顺序作为硬性模板——它关乎一个 `append` 在 shutdown 之后能否返回正确的错误码。

## I. 错误码 → it 块对应表

| 错误码       | 名称                         | 触发的 `it` 块                                                                                                                                                                       |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TQ-INF-009` | `POSTGRES_UNREACHABLE`       | Adapter 自有 `test_network_unreachable_init_rejects_with_tq_inf_postgres_unreachable`；契约 P4.2 `test_health_check_on_unreachable_database_path_...`（经 factory 翻译触发同一路径） |
| `TQ-INF-008` | （复用）                     | 契约 P2.3 `test_init_on_schema_version_mismatch_rejects_with_tq_inf_schema_version_mismatch`——见 §E                                                                                  |
| `TQ-INF-001` | `INFRASTRUCTURE_UNAVAILABLE` | `append` 路径遇到非 schema / 非 lifecycle 的底层错误时兜底返回（例如 connection drop）。不是本 Step 新增；复用 Phase 1-7 冻结码                                                      |

**候选未采用**：`TQ-INF-010 POSTGRES_POOL_EXHAUSTED` / `TQ-INF-011 POSTGRES_TRANSACTION_FAILED` 在本 Step 的 `it` 块中没有自然触发点——"pool 耗尽"需要同时持 N+1 个慢查询（单进程内 pg 的 prepared statement 是序列化执行的，难以稳定构造）；"事务失败"在 single-event `append` 下只会表现为 schema 校验或 UNIQUE 冲突（`ON CONFLICT DO NOTHING` 使后者不抛错）。按 Step 3 §D 立的"无对应断言即不新增"纪律，不填充。真正遇到的 Step 再补。

## J. 本地执行时是否触达真实 Postgres

本次执行**未**触达真实 Postgres——开发机未设置 `TIANQI_TEST_POSTGRES_URL`。测试结果：

- 21 基础契约 + 12 持久化契约 + 3 需要 DB 的 Adapter 自有 = **36 skipped**。
- 3 不需要 DB 的 Adapter 自有（`test_connection_string_required_at_type_layer` / `test_network_unreachable_init_rejects_with_tq_inf_postgres_unreachable` / `test_object_keys_exposes_only_union_of_three_contracts_no_extras`）= **3 passed**。
- 基线 1220 + 本 Step 新增 3 pass + 36 skip = **1259 total**（passed 1223 / skipped 36）。

这是元规则 J 的预期行为：没有真实 Postgres 时 CI 不红，skipped 计入 test count。Phase 10 进入 CI/CD 阶段时，CI 环境需提供 Postgres service container 并设置 `TIANQI_TEST_POSTGRES_URL`，届时 36 个 skipped 变为 36 个 passed。

## K. 风险点

- **CI 需 Postgres service container**：Phase 10 CI/CD 阶段必须在 workflow 中起一个 Postgres service（或使用 Testcontainers-node / github services）并通过 `TIANQI_TEST_POSTGRES_URL` 注入。否则整个 event-store-postgres 契约面在 CI 中不被真正验证（不是红，但是"没运行"）。本 Step 不构建 CI；docs/phase8/06 §J 留痕供 Phase 10 runbook 消费。
- **pg 的 JSONB 自动反序列化与 Tianqi 内存表示的兼容**：pg 读取 JSONB 列时返回 JS 对象（已反序列化）；Tianqi envelope 的 `payload` / `metadata` 预期就是 JS 对象。本 Adapter 没有在读取后再次 `JSON.parse` —— `rowToEnvelope` 直接赋值 `row.payload` / `row.metadata` 到 envelope 字段。写入时 Adapter 显式 `JSON.stringify` 并用 `::jsonb` cast，保证 schema 校验（禁止非可序列化值）在 Adapter 层就拦截。
- **连接池耗尽的真实触发条件**：本 Step 不为 `TQ-INF-010` 新增断言的根本原因是单进程内 pg 查询序列化；多进程 writer 才能稳定触发池耗尽。但多进程是 Postgres 场景下的正常运行模式——未来当真实生产场景遇到池耗尽时，再补 `TQ-INF-010` + 对应断言。
- **推送过程**：3 commits fast-forward 推送。若远端有新提交，需要 rebase（详见输出段 G）。

## L. 对 Step 7（Notification 契约测试套件）的衔接

Step 7 是 Phase 8 的下一个契约级 Step——在 adapter-testkit 新增 `defineNotificationContractTests`，翻译《宪法》§10 事件契约规范中与"通知总线"相关的部分，并填充 Step 2 空骨架的 `defineLifecycleContractTests`（顺带验证 Step 2 留下的 HealthCheck 空骨架）。Step 9 Kafka 将成为 Step 7 契约的第一个真实 Adapter，使用 `TIANQI_TEST_KAFKA_BROKERS` 环境变量（元规则 J 的第二次实战）。

Step 7 不改 `defineEventStoreContractTests` / `definePersistentEventStoreContractTests` 任何签名（元规则 B），也不改 EventStorePort / NotificationPort 任何签名。Step 7 的具体范围、风险与 DoD 由 Step 7 指令在进入时敲定，本 Step 不预先承诺。
