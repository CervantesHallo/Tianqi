# Phase 8 / Step 11 — Sprint D 同步落地两个 Config Adapter

## A. Step 11 定位

Step 11 是 Phase 8 第一次在同一个 Step 里同步落地**两个独立 Adapter**：

1. `@tianqi/config-memory` —— 进程内纯内存实现；类比 Sprint B 的 Step 4 / Sprint C 的 Step 8。
2. `@tianqi/config-file` —— YAML 文件冷启动 + 基础三动作骨架；类比 Sprint B 的 Step 5 / Sprint C 的 Step 9。

两个 Adapter 必须满足以下三重独立性：

- **源码独立**：两个包的源文件严格无相互 import；两个包均不从 `adapter-testkit/src/fixtures/reference-config.ts` 复制代码（META-RULE F 原始禁令）。仅共享来自 `@tianqi/ports` / `@tianqi/contracts` / `@tianqi/shared` 的公共类型与构造器。
- **契约挂载独立**：两份 `.contract.test.ts` 各自一行挂载 `defineConfigContractTests`，驱动 21 个契约 `it` 独立运行一遍。
- **semantics 声明差异化**：README § Semantics 的三条声明（持久化 / 激活原子性 / 多实例一致性）必须在两个 Adapter 之间显式对比，不得趋同化（docs §F 对比表）。

本 Step 完成后，Sprint D 的基础能力版落地；Step 12 收官热加载 / 预校验失败恢复 / 回滚链路完整语义。本 Step **不做**：热加载、fs.watch、chokidar、配置回写文件、YAML 源跨重启历史版本保留。

## B. 为何"双 Adapter 同步落地"优于"分两个 Step"

常规节奏是"每个 Adapter 独占一个 Step"（Sprint B / C 的 Step 4 / 5 / 6 和 Step 8 / 9 均如此）。本 Step 打破该节奏有三重考量：

1. **验证契约约束力**：Step 10 的 21 契约 `it` 需要在两个独立实现上都通过，才能证明契约不是"对单一实现的照搬"。若只落地 memory，契约可能隐藏"其实只在内存场景自洽"的设计缺陷——Step 11 把 config-file 和 config-memory 并排跑，真正暴露契约的约束能力。
2. **证明 1PC + compensation 的可移植性**：Step 10 定义了"翻指针 → 写审计 → 失败时补偿回滚"的模式。单一实现只是代码，双独立实现才是模式——两个包各自从零写一遍，证明模式能被不同人在不同代码库复用（而不是只有一种"正确"写法）。
3. **Sprint D 节奏所需**：Step 12 的热加载必然要改 config-file；如果 config-memory 压到 Step 12，Step 12 就变成"双 Adapter 的高级能力"，范围爆炸。本 Step 提前把 config-memory 锁定，让 Step 12 聚焦于文件系统特有问题。

## C. YAML `version` 字段与 Adapter 内部 counter 的关系裁决

**决策**：**Adapter 内部单调计数器是 ConfigVersion 的唯一事实来源**。YAML `version` 字段仅作"文件 schema 世代标记"，格式校验用（必须正整数，否则 `TQ-CON-008`），不参与 ConfigVersion 分配。

**拒绝"尊重 YAML version"方案**的理由：

1. **契约类别 2 会失败**：Step 10 的 `test_preview_of_identical_content_still_yields_a_new_distinct_version` 断言两次相同内容 preview 返回两个不同版本号。若首次版本来自 YAML（固定值），则运行期 preview 需要从某个基数继续递增——若从 YAML+1 开始，读 YAML 文件时如果 `version: 100`，内存 counter 从 101 开始，此时所有调试版本号 101/102/... 会跟 YAML 100 形成语义混乱。
2. **多实例状态污染**：两个 config-file 实例指向同一份 YAML，init 后都会读到 `version: 1`。它们的后续 counter 都从 2 开始，两实例的"version 2"内容不一致，跨实例版本号再不可比较。
3. **运维心智一致**：`version: 5` 写在 YAML 里，对运维意味着"这是 5 世代 config"——这个数字是供运维**肉眼审读的版本标号**，不是程序内部的 ConfigVersion。两个语义应当解耦。

**选型**：Adapter counter 从 1 开始递增；YAML `version` 仅做格式校验并在 `healthCheck.details.fileYamlVersion` 中作展示（供运维查看"这台实例当前冷启动读入的是 5 世代 config"）。

## D. TQ-INF-011 / TQ-CON-008 错误码裁决（惯例 K）

### TQ-INF-011 `CONFIG_FILE_UNREADABLE` — **新增**

触发场景：`init()` 读取 `filePath` 时文件不存在、权限失效、IO 错误。

惯例 K 判断："同一错误场景能用完全相同的诊断动作解决吗？"

- 与 `TQ-INF-001 INFRASTRUCTURE_UNAVAILABLE`（Phase 1 冻结）诊断路径不同：INFRASTRUCTURE_UNAVAILABLE 是顶层泛化码，用于无法归类的底层故障；文件不可读有非常具体的诊断工具链（`ls / stat / chmod / df / mount`），值得专属码。
- 与 `TQ-INF-005 SQLITE_DATABASE_UNREACHABLE` / `TQ-INF-009 POSTGRES_UNREACHABLE` 工具链明显不同：DB unreachable 用 `psql` / `sqlite3` / `dig` / `telnet`；文件 unreadable 用 `stat / chmod / mount -l`。

**决定新增**。与 inf.ts 其他 Adapter 专属码（TQ-INF-005 SQLite / TQ-INF-009 Postgres / TQ-INF-010 Kafka）对称。

### TQ-CON-008 `CONFIG_FILE_SCHEMA_INVALID` — **新增**

触发场景：YAML 解析成功但结构不符合约定：根非对象 / `version` 缺失或非正整数 / `values` 缺失或非平面对象 / `values.*` 含非 primitive 值。

惯例 K 判断：与 `TQ-CON-005 EVENT_SCHEMA_VIOLATION` 是否等价？

- **形式上相似**：都是"数据形状不合规"。
- **语料库不同**：event schema 是程序生成的 JSON，schema 定义在 `@tianqi/contracts/src/domain-event-envelope.ts`，开发者读域事件包文档；config schema 是运维手动编辑的 YAML，schema 定义在 `@tianqi/config-file/README.md`，运维读 Adapter 包文档。错误消息要分别指向不同 docs，不同 runbook，不同人来排查。
- **修复动作不同**：event schema violation → 查源发送者代码；config schema invalid → 编辑 YAML 文件。

**决定新增**。`con.test.ts` 同时固化 `TQ-CON-005 ≠ TQ-CON-008` 的层级隔离断言（永久留痕）。

### 其他场景复用

- `TQ-INF-003` / `TQ-INF-004`：未 init / 已 shutdown —— 复用（Lifecycle 共性，与 Sprint B/C 一致）。
- `TQ-CON-006` / `TQ-CON-007`：版本不存在 / audit 触发回滚 —— 复用 Step 10 建立的 Config-Adapter 专属码。

**不新增** `TQ-INF-012 CONFIG_FILE_WRITE_FAILED` / `TQ-CON-009 CONFIG_PERMANENT_VERSION_DRIFT`：本 Step 没有回写文件 / 跨重启历史保留这两个断言，按"无对应断言即不新增"纪律（Step 3 §D 已立规矩）不填充。

## E. 两 Adapter 的 1PC + compensation 独立实现

`recordActivation` 的核心代码在两个包中**形态相似、实现独立**：

```ts
// Both adapters (independent files, copied-from-scratch)
const previousActive = activeVersion;
activeVersion = targetVersion;                   // 先翻指针
if (auditFailureMode) {                          // 模拟故障
  activeVersion = previousActive;                // 补偿回滚
  return err(probeError("TQ-CON-007", ...));
}
auditTrail.push({ fromVersion, toVersion, ... }); // 写审计
return ok(undefined);
```

**独立性证据**：

- `grep` 两个包的源码，互不 import（`config-memory` 源码无 `config-file` 字样；`config-file` 源码仅在注释中提到 `config-memory` 作为"独立写一遍"的说明）。
- 两包各自声明自己的 `ConfigAuditEntry` / `ConfigContractProbeError` / `TestkitProbe` 结构类型（不从 `@tianqi/adapter-testkit` import——META-RULE F）。
- `nextVersionNumber` 计数器、`auditFailureMode` 标志位、`versions` Map、`auditTrail` 数组均在各自闭包中独立分配。

**独立实现的价值**：如果 Step 12 某一 Adapter（可能是 config-file）的 activation 语义需要微调（例如加持久化锁），另一 Adapter 不需要联动——两份代码独立演化而不是被抽象劫持。

## F. 两 Adapter § Semantics 三条声明对比（元规则 N 在 Config 领域）

Config 没有"投递语义"，但元规则 N 要求显式声明对等约束。本 Step 固化三条对等维度：

| 维度                  | config-memory             | config-file                                                                                     |
| --------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| **1. 持久化保证**     | 不持久化，进程退出全丢失  | YAML 冷启动；**运行期新版本不回写**，进程重启后 version 2+ 丢失，仅 YAML 内容能恢复为 version 1 |
| **2. 激活原子性保证** | 单进程 1PC + compensation | 单进程 1PC + compensation（同构但独立实现）                                                     |
| **3. 多实例一致性**   | 不提供；两实例完全独立    | 不提供；两实例指向同一文件仅 init 共享，运行期独立                                              |

**两个 Adapter 的初始状态对比**（post-init 行为差异）：

| 观察点               | config-memory      | config-file                                                                                             |
| -------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| `versions.size`      | 0                  | 1（YAML bootstrap，已经 preview）                                                                       |
| `activeVersion`      | null               | null（META-RULE A：Step 11 §B.3 literal 要求 init 自动 activate，但 Step 10 契约 1.1 不允许；契约胜出） |
| 调用方"立即可用"需要 | preview + activate | activate(createConfigVersion(1)) 一行                                                                   |

**README 差异化呈现**：两包 README 的 § Semantics 部分均有"与另一 Adapter 的差异"子表。运维拿任一 Adapter 都能马上读到"这台与隔壁那台在持久化上的差异是什么"。

## G. META-RULE A 处置：config-file init 是否自动 activate

Step 11 §B.3 literal：

> 调用 probe.preview(values) 产生一个版本
> 调用 probe.activate(该版本) 使其生效

Step 10 frozen 契约 1.1：

> `test_get_active_config_before_any_activation_returns_structured_error_not_empty_value` —— 期待 `await adapter.getActiveConfig()` 在 `await adapter.init()` 之后返回 `result.ok === false`。

两处直接冲突。Step 11 Gate G6 又要求"21 契约全绿"。METARULE A：既有事实（冻结契约）胜出。

**处置**：config-file `init()` 读 + 解析 + 校验 + **preview** YAML（把 YAML 内容登记为内部 version 1），但**不自动 activate**。调用方 `init()` 返回后需显式 `await adapter.activate(createConfigVersion(1))` 才让 YAML 生效。

**留痕**：

- 源码 `src/config-file.ts` 在 init() 内有 10+ 行注释明示该处置与依据。
- README `## 使用` 章节的代码范例显式展示"调用方 init → activate 两步"。
- 本 docs §G 永久留痕。

**心智模型附加价值**：这个处置把"预览 YAML 内容→ 审阅 → 决定激活"变成自然流程。运维可以在 activate 前先 `getByVersion(1)` 检查一下实际读进来的 values——一个不期而至但颇合理的"dry run"能力。

## H. healthCheck 探测动作选择（元规则 I 第三次实战）

**探测方法**：`fs.promises.access(filePath, fs.constants.R_OK)` + `Promise.race` 超时。

三个候选均被评估：

- `fs.access(path, R_OK)` —— ✅ 选定。文档明确"为 check readability 设计"，最小负载，无数据读取。
- `fs.stat(path)` —— 拒绝。返回 size / mtime / inode 等额外字段，更"贵"；而且我们不需要这些字段。
- `readFile(path, "utf8")` —— 拒绝。会真实加载文件到内存，且触发 YAML 重解析压力，违反"只读探测 / 不触发业务写"（META-RULE I）。

**独立超时**：`healthCheckTimeoutMs`（默认 2000ms，可配）；用 `Promise.race(probe, scheduleTimer)` 模式，与 Sprint B Postgres / Sprint C Kafka 的 healthCheck 保持同一手法（Step 5 后一致复用）。

**不抛异常**：`probe.catch` 内部把错误转为 `{ readable: false, error: string }`；healthCheck 总返回结构化 `AdapterHealthStatus`。

**details 字段**：`{ lifecycle, filePath, fileReadable, activeVersion, versionCount, fileYamlVersion, lastError, healthCheckTimeoutMs }`——含 filePath 但不含任何凭据（config 文件路径本身不是机密）。`fileYamlVersion` 专门暴露"冷启动读入的是哪一世代 YAML"（§C 决策的运维观测面）。

## I. Step 5 state guard 教训的两处独立复用

两个 Adapter 各自都在 `assertRunning(action)` 内复用 Step 5 硬模板：

```ts
const assertRunning = (action: string): void => {
  // Step 5 lesson: check shut_down before created so shutdown wins over init-missing.
  if (state === "shut_down") {
    throw new Error(`TQ-INF-004: ${action} after shutdown`);
  }
  if (state === "created") {
    throw new Error(`TQ-INF-003: ${action} before init`);
  }
};
```

两处代码文本几乎一样但**独立写成**（非 copy-paste）。每处都保留"Step 5 lesson"注释。Step 5 后第 N 次致敬，证明 Phase 8 各 Adapter 这条约定已成为反射动作。

## J. 惯例 L 两份自测表（Adapter 自有测试）

### config-memory 自测表（5 项）

| 测试                                                                | 若放入契约套件仍有意义吗？                       | 判断 |
| ------------------------------------------------------------------- | ------------------------------------------------ | ---- |
| `test_factory_without_options_returns_valid_instance`               | 否——契约不关心"有没有 options"                   | 保留 |
| `test_factory_with_empty_options_behaves_identically_to_no_options` | 否——契约测的是 Adapter 行为不是工厂重载          | 保留 |
| `test_two_instances_do_not_share_state`                             | 否——契约只测单实例                               | 保留 |
| `test_health_check_details_include_lifecycle_and_version_count`     | 否——契约只测 `healthy` 字段，不规定 details 形状 | 保留 |
| `test_object_keys_exposes_only_union_of_three_contracts_no_extras`  | 否——契约不防"多了无关方法"的白盒检查             | 保留 |

### config-file 自测表（6 项）

| 测试                                                               | 若放入契约套件仍有意义吗？                       | 判断 |
| ------------------------------------------------------------------ | ------------------------------------------------ | ---- |
| `test_factory_requires_file_path_at_type_layer`                    | 否——契约不关心工厂参数                           | 保留 |
| `test_init_with_nonexistent_file_rejects_with_tq_inf_011`          | 否——contract 不涉及 filesystem                   | 保留 |
| `test_init_with_invalid_yaml_rejects_with_tq_con_008`              | 否——contract 不涉及 YAML 解析                    | 保留 |
| `test_init_with_missing_version_field_rejects_with_tq_con_008`     | 否——contract 不涉及文件 schema                   | 保留 |
| `test_health_check_reflects_file_readability_without_throwing`     | 否——契约只测 `healthy` 字段的 init/shutdown 切换 | 保留 |
| `test_object_keys_exposes_only_union_of_three_contracts_no_extras` | 否——同前                                         | 保留 |

两张表共 11 项，全部通过"契约场景不重复"自测。config-file 恰好 6 项触顶但不越界。

## K. 元规则 A–J + M + N 触发情况

- **A**：**触发一次**（§G）——Step 11 §B.3 literal 要求 init 自动 activate 与 Step 10 契约 1.1 冲突，冻结契约胜出，config-file init 只 preview 不 activate。
- **B**：贯彻——两 Adapter 未改动 `ConfigPort` / `AdapterFoundation` / `ConfigContractProbe` / `defineConfigContractTests` 任何签名；两 Adapter 自己的 factory 签名遵循 `createInMemoryEventStore` / `createInMemoryNotification` 既有风格。
- **C**：不适用——不触碰 EventStorePort。
- **D**：贯彻——adapter-testkit 依赖面未变；`@tianqi/config-file` 仅对外新增 `yaml` 依赖。
- **E**：不适用——本 Step 无持久化契约函数（Step 12 可能为 config-file 新增）。
- **F**：**首次扩展到 Adapter 之间**——不仅禁止跨包 import `reference-config`（原始禁令），还禁止 config-memory 与 config-file 相互 import。grep 两包源码证明独立性。
- **G**：**第四次实战**——yaml@2.8.3 精确锁，ISC 许可（等价 MIT），纯 JS 无 native；与 better-sqlite3 / pg / kafkajs 并列为 Phase 8 第四个第三方生产依赖；未扩张 `pnpm.onlyBuiltDependencies` 白名单。
- **H**：不适用——本 Step 不管理持久化 schema。若未来 config-file 添加"运行期版本回写"（Step 12 及以后），会触发 H。
- **I**：**第三次实战**——config-file healthCheck 使用 `fs.access(R_OK)` 只读探测；独立 `healthCheckTimeoutMs`；`Promise.race` + `scheduleTimer` 超时；不抛异常；details 含 `fileReadable / fileYamlVersion / lastError`。
- **J**：不触发——本 Step 不涉及外部服务测试（config-file 用 `os.tmpdir()` 的本地临时文件，不需要 `TIANQI_TEST_*` 环境保护）。
- **K（惯例）**：新增 `TQ-INF-011` / `TQ-CON-008`（§D 决策）；复用 `TQ-INF-003` / `TQ-INF-004` / `TQ-CON-006` / `TQ-CON-007`。
- **L（惯例）**：第三次实战——两 Adapter 各自自测表（§J）。
- **M**：贯彻——两 Adapter 实现 `ConfigContractProbe` 的六个方法但不对外暴露（probe 仍是 testkit-only 观察原语；production 调用方不应依赖 `__configProbe`）。两 Adapter 局部声明 probe 形状而非 import。
- **N**：**第四次实战**——两 Adapter README 均有 § Semantics 三条声明；两者差异化通过对比表显式呈现（§F）。

## L. 风险点

1. **YAML 解析错误的 edge case 边界**：目前 `config-file` 的 `validateParsed` 只做形状校验（version + values）。YAML 特性如 anchors / aliases / tags / 多文档（`---`）未显式处置——`parseYaml` 默认把首文档取出，多文档场景下后续文档被丢弃；anchors 正常展开。若 YAML 内含这些高级结构，行为是"取首文档，展开 anchor，其它忽略"。本 Step 不拒绝也不支持，只在 README 暗示"用简单平面 YAML"。Step 12 可能加 lint。
2. **config-file 的"重启丢失非初始版本"心智模型**：运维视角下"运行期 activate 的版本在重启后消失"是高风险陷阱。README 的 § Semantics 第 1 条与"与 config-memory 差异"对比表均显式强调；Step 12 补上持久化后这条风险消失。
3. **healthCheck 的文件探测在高频调用下的文件系统压力**：`fs.access` 是轻量调用，但业务若每 100ms 轮询 healthCheck 仍可能堆积 syscall。`healthCheckTimeoutMs` 仅保护单次调用，不限制频率。调用方应自己节流（例如 healthCheck 每秒最多一次）——README 未显式规劝；若 Step 12 发现这是问题，再加节流。
4. **两独立实现可能出现细节漂移**：两套 `recordActivation` 逻辑若在未来某次修改中其中一方改了但另一方没跟上，bug 会只影响一个 Adapter。防护机制：契约测试是唯一捕获面（两个 Adapter 同样跑 21 个 `it`）。若契约某断言漏掉某行为维度，漂移不被捕获——这正是 Step 10 契约的价值；Step 10 契约越完整，两独立实现越安全。
5. **init 不自动 activate 的心智成本**：调用方第一次用 config-file 会在 `await adapter.init()` 后 `await adapter.getActiveConfig()` 遇到错误，困惑。README 使用范例**每次出现时**都必须包含 `activate(createConfigVersion(1))` 一步；README 首屏的 § 使用 部分已满足。

## M. Step 12 衔接

- **热加载**：Step 12 将在 `config-file` 加 `fs.watch` 或 SIGHUP 触发重新 `preview`；可能引入 `chokidar` 依赖（视选型）。本 Step 的 `preview` 方法契约不变，Step 12 只是调用方变成"自动而非调用方主动"。
- **预校验失败恢复**：Step 12 处理"文件被改坏时仍保留当前生效版本不变"。本 Step 没有这条 `it`（contract 也未覆盖"重新读文件后失败时保留旧版本"）；Step 12 可能为 config-file 新增 `definePersistentConfigContractTests`（元规则 E）。
- **回滚链路**：Step 12 决定是否把 auditTrail / versions 跨重启持久化（可能写 `.tianqi-state.json` sidecar），让 rollback 到历史版本在重启后仍有效。
- **config-memory 不动**：Step 12 理论上不需要修改 config-memory；内存 Adapter 的职责范围已经完整。

## N. 测试增量明细

| 来源                                                             | 新增 `it` 数 |
| ---------------------------------------------------------------- | -----------: |
| `con.test.ts`（TQ-CON-008 工厂 + TQ-CON-005 vs TQ-CON-008 分离） |            2 |
| `inf.test.ts`（TQ-INF-011 工厂）                                 |            1 |
| `config-memory.contract.test.ts`（21 契约挂载）                  |           21 |
| `config-memory.test.ts`（惯例 L 自测）                           |            5 |
| `config-file.contract.test.ts`（21 契约挂载）                    |           21 |
| `config-file.test.ts`（惯例 L 自测）                             |            6 |
| **合计**                                                         |       **56** |

**测试总数**：1350 → 1406（+56）。Gate G12 下限 1382，1406 远超。

## O. workspace 与第三方依赖增量

- workspace 包数：13 → **15**（`@tianqi/config-memory` + `@tianqi/config-file`）。
- 根 `tsconfig.json` 项目引用 +2。
- 第三方生产依赖白名单：better-sqlite3 / pg / kafkajs + **yaml@2.8.3**（第四个，元规则 G 第四次实战；纯 JS，未扩张 `pnpm.onlyBuiltDependencies`）。
- `pnpm-lock.yaml` +53 −10。
