# Phase 8 / Step 12 — Sprint D 收官：@tianqi/config-file 热加载 + 持久化 + 预校验恢复

## A. Step 12 定位

Step 12 是 **Sprint D 收官战** —— 把 `@tianqi/config-file` 从 Step 11 的"基础能力版"升级到"运维可真正用于生产"的完整能力。三大维度同步落地：

1. **跨重启持久化**：除 `filePath` 外，Adapter 管理一个 `historyDirectory`，内含 `state.json` + `audit.jsonl` + `versions/v*.yaml`。重启后 `init()` 从 historyDirectory 恢复 activeVersion、版本 Map、audit 轨迹、counter 单调性。
2. **热加载**：新 FileConfigOptions 字段 `watchMode: "fs-watch" | "poll" | "manual" | "off"` + `autoActivate: "never" | "onLoad"` + `reload()` 方法。`fs.watch` / `watchFile` 自动触发 reload，或调用方显式触发。
3. **预校验失败恢复**：reload 触发的任何失败（文件不可读 / YAML 解析失败 / schema 校验失败 / 非 primitive 值 / audit 写失败）保留 activeVersion + auditTrail 不变 —— Step 10 的 1PC + compensation 不变量扩展到 reload 路径。

Sprint D 完整三步（Step 10 契约 → Step 11 基础双 Adapter → Step 12 config-file 收官）至此收束。`@tianqi/config-memory` **本 Step 不触碰**，保持 Step 11 的内存版语义；Step 12 的所有能力仅属于 config-file。

## B. 四个裁决问题（§C 指令要求）

### 1. watchMode 默认值

**选择：`"manual"`**。

拒绝 `"fs-watch"` 作为默认的理由：

- **平台差异风险**：macOS FSEvents（kqueue 背后）、Linux inotify、Windows ReadDirectoryChangesW 语义各异；FSEvents 会在某些场景下以空 filename 触发；mv 原子替换在 inotify 下表现为 `IN_MOVED_FROM` + `IN_MOVED_TO` 对。默认 fs-watch 意味着生产环境的 "默默失效" 类 bug 会依赖运维所在的 OS。
- **测试不确定性**：默认 `fs-watch` 意味着契约测试的"不触发自动 reload"条件难以断言（需要等待足够久证明没触发）；默认 `manual` 让 `test_watch_mode_off_does_not_observe_file_changes_on_its_own` 一类的断言确定性极强。
- **审计诚实性**：默认 `manual` 下所有 audit 条目的时间戳对应真实调用方决定的触发点；fs-watch 下时间戳夹杂"编辑器保存事件"的噪声，运维追踪哪次变更生效更难。
- **宗旨匹配**：宗旨第六条"克制 > 堆砌"——自动热加载是增值，不是基础要求；运维显式控制比默默触发更符合 Tianqi 的"可读性 > 工程技巧"。

运维若希望自动热加载，一行 `watchMode: "fs-watch"` 即可启用；默认不启用降低了"不小心踩到平台差异"的风险。

### 2. autoActivate 默认值

**选择：`"never"`**。

沿用 Step 11 的 META-RULE A 处置精神：init 不自动 activate，reload 也不自动 activate。reload 成功后新版本进入 `versions/` 但 active 指针不变。运维想立即生效 → 显式 `activate(newVersion)` 或配 `autoActivate: "onLoad"`。

**`never` 的工程价值**：Tianqi 风控场景对"配置切换"的严肃性要求极高；默认需要显式 activate 给运维留一个"审阅新内容再决定是否激活"的窗口。`probe.getByVersion(newVersionNumber)` 允许 dry-run 读新内容。

### 3. 事件通道（α/β/γ/δ 四选一）

**选择：γ（poll）** —— Adapter 不主动推送，消费者通过 `getActiveConfig().version` 或 `probe.getByVersion(N)` 检测版本变化。

拒绝 α（扩展 probe）：违反 META-RULE M "probe 只读不推送"。
拒绝 β（Adapter 暴露 subscribeToChanges）：扩张 Adapter surface；订阅生命周期管理复杂；META-RULE M 精神类似反对。
拒绝 δ（跨 Adapter 事件总线）：违反 Adapter 单职责；指令明示不推荐。

**γ 的契约可验证性**：持久化契约的 `waitForProbeVersion(adapter, N)` 轮询 `probe.getByVersion(N)`，有界尝试次数 + 20ms 间隔。无需等待任何 push 事件。

**γ 的运维心智**：消费者代码若关心"配置变了"的推送，自己包一层"每秒读一次 `getActiveConfig().version` 并比对上次"即可——这是 50 行业务代码，不需要 Adapter 内建。Tianqi 把"何时观察"交给消费者。

### 4. historyDirectory vs filePath 冲突处置

**选择：A**——historyDirectory 权威，filePath 新内容作为新 preview。

具体 init 流程：

- 无 state.json → 冷启动（Step 11 语义）。preview YAML 为 v1，autoActivate 策略决定是否 activate。
- 有 state.json → 恢复 activeVersion、版本 Map、audit、counter。读 filePath：
  - filePath 内容哈希 == state.json 的 `lastLoadedYamlHash` → 无新 preview。
  - filePath 内容哈希 != `lastLoadedYamlHash` → preview 新 ConfigVersion（v\_{nextVersionNumber}），不自动 activate（除非 `autoActivate: "onLoad"`）。state.json 更新。

**不选 B**（filePath 权威 + trash history）：会毁掉审计轨迹，违反 Config 领域的"每次切换可追溯"硬约束。

**不选 C**（init 失败等待手动）：Adapter 自己无法区分"合法演化（运维编辑 YAML）"与"不合法漂移（手改 state.json）"；强制人工 intervention 会让自动化部署流水线卡死。A 方案把 filePath 当作"下一份候选配置"——既保留历史又支持演化。

## C. 是否引入文件监听库（元规则 G 合规）

**决定：不引入**。全部使用 `node:fs.watch` + `node:fs.watchFile`。

拒绝 `chokidar`：最大且最流行的文件监听库，但为跨平台差异做了大量 polyfill（~3000 LoC 依赖链），对 Tianqi 只看一个 YAML 的场景过于厚重。
拒绝 `watchpack`：webpack 生态的内部工具，接口不稳定。
拒绝 `node-watch`：轻量但不活跃（最近 release > 2 年前）。

`node:fs.watch` 的缺陷（单事件多次触发、空 filename 等）由本 Adapter 的 **100ms 去抖**吸收 —— 多次 fs 事件合并为单次 reload。Step 12 不需要比这更复杂的机制。

## D. 持久化契约 3 大类别（扩展到 4）

执行中发现 12 个 it 块后仍有 6 个显著场景未覆盖，于是扩展到 18 个 it 块，组织为 4 大类别：

| 类别                              | it 数 | 主映射                             | 关键断言                                                             |
| --------------------------------- | ----: | ---------------------------------- | -------------------------------------------------------------------- |
| P1 跨重启恢复                     |     5 | §5.5 重启一致性                    | active / 版本 / audit / counter / 无历史时冷启动                     |
| P2 热加载语义                     |     5 | §5.3 加载三分离 + 热加载要求       | manual reload / never / onLoad / off 不观察 / 幂等 / 修复恢复        |
| P3 热加载失败恢复                 |     4 | §5.4 切换原子 + 1PC + compensation | corrupt / deleted / missing version / 非 primitive / 重写恢复        |
| P4 auditFailureMode × reload 交互 |     4 | Step 10 1PC 在 reload 路径         | onLoad audit 故障 / shutdown 后仍拒绝 / healthCheck history 诊断字段 |

**18 > 9 最小下限**；扩展的 9 块不是"凑数"，每块都对应 config-file 在真实运维场景下会遇到的具体情况。

## E. 1PC + compensation 扩展到 reload 失败场景

Step 10 的不变量：audit 轨迹长度 ≥ 合法 active 切换次数。Step 12 扩展后，该不变量在 reload 路径下依然成立：

| 失败点                              | 已写入？               | 回滚动作                                                                                                               | 返回码                    |
| ----------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| readFile                            | 否                     | 无需                                                                                                                   | `reload()` err TQ-INF-011 |
| parseYaml                           | 否                     | 无需                                                                                                                   | `reload()` err TQ-CON-008 |
| validateParsed                      | 否                     | 无需                                                                                                                   | `reload()` err TQ-CON-008 |
| preview 磁盘写入（versions/）       | 部分                   | versions 文件本身独立；失败只是未能落盘新 version；Map 不添加                                                          | `reload()` err 附磁盘原因 |
| activate (onLoad) audit 追加失败    | 指针已翻               | 指针回滚到 previous                                                                                                    | `reload()` err TQ-CON-007 |
| activate (onLoad) state.json 写失败 | 指针已翻，audit 已追加 | 指针回滚（**audit 多一行**）；**此场景下 audit 长度短暂 > active 切换次数，但不变量仍保持"audit ≥ active 切换"方向**） | `reload()` err TQ-CON-007 |

**值得注意**：最后一行场景下，audit 会记录 `activate` 但 active 回滚。这看似"audit 与 active 不同步"，但它其实还是符合不变量 —— 审计轨迹记录了"曾经尝试过"；活跃指针不前进。P4.1 契约测试 `test_audit_failure_mode_during_reload_path_rolls_back_auto_activate_onload` 模拟这一场景并验证 **audit 长度在故障注入下保持不变**（因为 `auditFailureMode=true` 走 in-memory 分支，fail 在 append 前就返回）。真实磁盘失败路径则落入"audit 多一行但 active 回滚"的可接受状态——运维排查时能看到"曾尝试 activate 版本 N 但失败"，有价值。

## F. 错误码新增 vs 复用裁决（惯例 K）

### TQ-INF-012 `CONFIG_HISTORY_DIRECTORY_UNREADABLE` — **新增**

触发场景：`init()` / 运行期持久化写入中 historyDirectory 的 mkdir / readdir / 文件 I/O 失败。

惯例 K 判断：与 `TQ-INF-011 CONFIG_FILE_UNREADABLE` 是否等价？

- **形式上相似**：都是文件系统 I/O 失败。
- **修复动作不同**：filePath 是单文件（`chmod 644 /etc/tianqi/config.yaml`）；historyDirectory 是目录树（`chmod -R +rwX /etc/tianqi/config.yaml.tianqi-history/`）；后者还可能遇到 "挂载点设为只读" / "配额耗尽" 等新场景。
- **诊断工具链差异**：文件的 `ls -l path.yaml`、`stat path.yaml`；目录的 `ls -la dir/`、`df -h dir/`、`lsattr +i dir/`。

决定新增。

### TQ-CON-009 `CONFIG_HISTORY_STATE_INCONSISTENT` — **新增**

触发场景：init 时发现 state.json 与 versions/ 或 audit.jsonl 矛盾（state.json 说 activeVersion=5 但 versions/v000005.yaml 缺失等）。

惯例 K 判断：与 `TQ-CON-008` 是否等价？

- **形式上相似**：都是"数据形状不对"。
- **读者不同**：TQ-CON-008 是运维编辑 YAML 的错；TQ-CON-009 是 Adapter 自己管理的 historyDirectory 内部漂移（通常是运维手改了 state.json 或手删了 version 文件）。
- **运维的根本修复路径**：TQ-CON-008 → 改 YAML；TQ-CON-009 → 整个 historyDirectory 删掉重启让 Adapter 冷启动。

决定新增。`con.test.ts` 同时固化 `TQ-CON-008 ≠ TQ-CON-009` 的语料分离断言（永久留痕）。

### 其他场景复用

- `TQ-INF-003` / `TQ-INF-004`：Lifecycle 共性 — 复用。
- `TQ-INF-011`：filePath I/O 失败 — 复用 Step 11 已立的码，reload 路径同样使用。
- `TQ-CON-006` / `TQ-CON-007` / `TQ-CON-008`：版本不存在 / audit 触发回滚 / schema 违规 — 复用。

**不新增** `TQ-INF-013 CONFIG_FILE_WRITE_FAILED`：写 YAML 回 filePath 是 Step 12 明禁的；当前没有写 filePath 的路径，因此没有对应 it 块，按 Step 3 §D "无对应断言即不新增"纪律不填充。

## G. Step 11 自有测试归并策略

Step 11 的 6 个自有测试全部保留（≤6 上限不越界）：

| 测试                                                                 | Step 12 后是否需要改动？                  |
| -------------------------------------------------------------------- | ----------------------------------------- |
| test_factory_requires_file_path_at_type_layer                        | 不动                                      |
| test_init_with_nonexistent_file_rejects_with_tq_inf_011              | 不动（reload 路径的等价版本在 P3 契约中） |
| test_init_with_invalid_yaml_rejects_with_tq_con_008                  | 不动                                      |
| test_init_with_missing_version_field_rejects_with_tq_con_008         | 不动                                      |
| test_health_check_reflects_file_readability_without_throwing         | 不动                                      |
| **test_object_keys_exposes_only_union_of_three_contracts_no_extras** | **改 → 新增 `reload` 到期望 key 集合**    |

Object.keys 测试期望 key 集扩展到 13 个（+`reload`），测试名改为 `..._plus_reload_no_extras` 以反映 Step 12 的扩展意图。**未新增**任何自有测试；热加载 / 持久化 / reload 失败恢复场景全部下沉到 `definePersistentConfigContractTests`。

## H. healthCheck 诊断字段扩展（元规则 I 再次实战）

Step 12 healthCheck details 新增三个字段（含 Step 11 已有的 filePath / fileYamlVersion / lastError 等）：

```ts
{
  (lifecycle,
    filePath,
    historyDirectory,
    fileReadable,
    historyDirectoryWritable, // ← 新增：access(historyDirectory, R_OK | W_OK)
    watchMode, // ← 新增：运维可观察到当前 watchMode
    autoActivate, // ← 新增：运维可观察到当前 autoActivate
    activeVersion,
    versionCount,
    auditEntries,
    fileYamlVersion,
    lastError,
    healthCheckTimeoutMs,
    historyDirectoryPath); // ← 新增：绝对路径（resolvePath），避免相对路径歧义
}
```

探测动作保持元规则 I 硬约束：只读（`access(R_OK)` / `access(R_OK | W_OK)`）、独立超时（`Promise.race` + `scheduleTimer`）、不抛异常、不触发业务写 / YAML 重解析。P4.3 契约 `test_health_check_reports_history_directory_diagnostics_in_running_state` 固化新字段存在性。

## I. Step 5 state guard 教训的持续复用

`assertRunning(action)` 保持 Step 5 硬模板：

```ts
if (state === "shut_down") throw TQ-INF-004;
if (state === "created") throw TQ-INF-003;
```

Step 12 新增的 `reload()` 方法内部走 `applyReload`，其第一步是 `if (state !== "running")` → 返回 `TQ-INF-004`。这是 state guard 的变体（返回结构化错误而非抛异常），遵循 `reload()` 返回 `Result<void, ConfigPortError>` 的签名。

**P4.2 契约** `test_get_active_config_after_shutdown_still_rejects_despite_persisted_state` 显式测试：即使 state.json 在磁盘上有合法 activeVersion，shutdown 后 `getActiveConfig()` 必须返回 TQ-INF-004，不得从持久化层"越过" lifecycle。这是 Step 5 教训在持久化语境下的最新一次致敬。

## J. 元规则 A–J + M + N 触发情况

- **A（指令 vs 既有事实冲突）**：未在本 Step 触发 —— Step 11 的三次 META-RULE A 处置（YAML version 解耦 / init 不自动 activate / ConfigAuditEntry testkit-专属）全部继承，无新冲突。
- **B（testkit 签名兼容）**：贯彻 —— `definePersistentConfigContractTests` 是本 Step 首次发布；`ConfigPort` / `AdapterFoundation` / `ConfigContractProbe` / `defineConfigContractTests` 签名零改动。`FileConfigOptions` 仅增量追加可选字段（`historyDirectory` / `watchMode` / 等均可选），向后兼容。
- **C（EventStorePort 只写）**：不触发。
- **D（adapter-testkit 依赖边界）**：贯彻 —— 新增 `persistent-config-contract.ts` 只依赖 ports/contracts/shared + vitest。
- **E（持久化契约独立函数）**：**首次在 Config 领域实战** —— `definePersistentConfigContractTests` 是独立函数，不扩展 `defineConfigContractTests` 签名。与 Step 5 `definePersistentEventStoreContractTests` 的模式完全一致。
- **F（参考实现跨包引用禁令）**：贯彻 —— testkit 不依赖 config-file；config-file 不依赖 reference-config。
- **G（第三方依赖准入）**：**零触发** —— 本 Step 未引入任何新第三方依赖（`node:fs` 是 runtime 标准库，不计数）。
- **H（持久化 Adapter 自管 schema）**：**首次在 Config 领域实战** —— historyDirectory 的 layout（state.json `layoutVersion: 1` + versions/v{N}.yaml + audit.jsonl）由 Adapter 自管；`PersistedState` 类型含 `layoutVersion` 字段为未来演化预留迁移路径。
- **I（外部服务 healthCheck）**：**Step 12 加强版** —— `probeHistoryWritable` 新增 `access(R_OK | W_OK)` 探测；`probeFileReadable` 保留 Step 11 形态。两个探测并发执行（`Promise.all`）共用同一 `healthCheckTimeoutMs` 窗口。
- **J（测试外部服务隔离）**：**持久化契约对应** —— `scratchDirectory` 由 mount 处传入（tmpdir），不假设任何真实路径；`writeYamlContent` / `corruptYaml` / `deleteYaml` 回调由 Adapter-specific 测试文件实现，testkit 不依赖任何持久化后端。
- **M（testkit 观察原语不推送）**：贯彻 —— 事件通道选 γ (poll)，probe 不新增任何推送接口；`waitForProbeVersion` 轮询符合观察语义。
- **N（显式声明传递语义）**：**第五次实战** —— config-file README § Semantics 三条均被重写；持久化保证升级；激活原子性扩展到 reload 路径；多实例一致性显式不支持并要求部署层约束单进程写入。

## K. 惯例 K + L 应用情况

- **K（错误码共性 vs 专属）**：新增 TQ-INF-012 / TQ-CON-009；复用 TQ-INF-003/004/011、TQ-CON-006/007/008。§F 留痕。
- **L（Adapter 自有测试覆盖边界）**：config-file 自有测试保持 6 上限不越界；所有新场景下沉到 `definePersistentConfigContractTests`（§G 归并表）。

## L. Sprint D 收官回顾

Sprint D 三步合计：

| Step     | 角色                                                                                | 测试净增 |
| -------- | ----------------------------------------------------------------------------------- | -------: |
| Step 10  | 立契约起点（defineConfigContractTests 21 个 it）                                    |      +26 |
| Step 11  | 同步落地 config-memory + config-file 基础版                                         |      +56 |
| Step 12  | config-file 收官（definePersistentConfigContractTests 18 个 it + config-file 扩展） |      +25 |
| **合计** |                                                                                     | **+107** |

Sprint D 产出：

- `@tianqi/contracts` 新增 6 个错误码：TQ-CON-006/007/008/009 + TQ-INF-011/012
- `@tianqi/adapter-testkit` 新增 2 个契约函数：`defineConfigContractTests` + `definePersistentConfigContractTests`，覆盖 39 个 it 块
- 2 个独立 Adapter：`@tianqi/config-memory`（纯内存）+ `@tianqi/config-file`（完整持久化 + 热加载）
- 1 份引入依赖：`yaml@2.8.3`（Phase 8 第四个）

与 Sprint B / C 对比：

| Sprint            | Adapter 数 |          契约 it 数 | 持久化契约                                    |                   新依赖 |
| ----------------- | ---------: | ------------------: | --------------------------------------------- | -----------------------: |
| B（EventStore）   |          3 | 21 基础 + 12 持久化 | ✅（definePersistentEventStoreContractTests） | 2（better-sqlite3 + pg） |
| C（Notification） |          2 |             18 基础 | ❌                                            |             1（kafkajs） |
| D（Config）       |          2 | 21 基础 + 18 持久化 | ✅（definePersistentConfigContractTests）     |                1（yaml） |

Sprint D 的独特贡献：**"配置切换"这一运维高度关注的操作首次在 Tianqi 仓库获得可运行的 1PC + compensation 保证**，跨重启持久化 + 热加载 + 预校验失败恢复三维全部可验证。

## M. 运维手工干预指南

本节专门给 config-file 的真实运维人员。REAMDE 的 § Persistence Layout 已涵盖常规查询；本节补充异常场景：

### 场景 1：reload 频繁失败

- 查 `healthCheck().details.lastError`，匹配 TQ-\* 码到对应 runbook：
  - `TQ-INF-011`：`ls -l <filePath>`、`stat`、`mount` 检查挂载点
  - `TQ-INF-012`：`ls -la <historyDirectory>`、`chmod -R +rwX`、`df -h`
  - `TQ-CON-008`：YAML 语法 / 结构问题 —— `yamllint` 本地校验
  - `TQ-CON-009`：historyDirectory 内部漂移 —— 见场景 3

### 场景 2：想回滚到历史版本

- **不要手改 state.json**。正确做法：业务代码调 `rollback(createConfigVersion(N))`；如果业务代码无此入口，临时：停止服务 → `cp historyDirectory/versions/v000003.yaml /etc/tianqi/config.yaml` → 重启。重启后 Adapter 会把 v3 内容作为新的 ConfigVersion preview（不是 v3 本身被复活），因为 Adapter 的"回滚"概念是 active 指针移动而不是改旧版本文件。

### 场景 3：historyDirectory 内部漂移（TQ-CON-009）

- 若运维不在意丢失运行期产生的版本 2+：`rm -rf <historyDirectory>` + 重启 → 冷启动，YAML 成为新的 v1。
- 若运维在意：停服 → 手动编辑 `state.json` 让 `activeVersion` 指向一个确实存在的 `versions/v*.yaml` → 重启。**此操作风险很高**，推荐记录到变更单并在维护窗口内操作。

### 场景 4：audit.jsonl 过长

- Adapter 不自动清理 audit.jsonl。若文件 > 100MB 影响运维：维护窗口内 `truncate -s 0 audit.jsonl` + `rm -rf historyDirectory`（因为 audit 清空后 state.json / versions/ 与 audit 会不一致 → 下次 init 会 TQ-CON-009）。正确路径是整体冷启动。

## N. 风险点

1. **多进程写 historyDirectory 的竞态**：本 Step 明确不处理。README 声明"部署必须约束单进程写入"。未来若需多进程场景，须引入分布式锁（Step 13 或更后考虑）。
2. **fs.watch 跨平台差异**：macOS FSEvents 会报空 filename；Linux inotify 有 IN_CLOSE_WRITE vs IN_MODIFY 差异；Windows ReadDirectoryChangesW 不支持 rename-only 的 atomic replace。缓解：100ms debounce + 默认 watchMode="manual"。
3. **运维误操作 historyDirectory**：手改 state.json 或手删 version 文件 → 下次 init 抛 TQ-CON-009。缓解：README 明示"整个目录删除重启"是唯一推荐路径。
4. **debounce 时间窗对测试稳定性**：100ms debounce 在慢 CI 上可能不够。缓解：契约测试使用 `manual` 模式避免依赖 debounce；真实 fs-watch 行为由 adapter-specific test 或集成测试覆盖（本 Step 未加，因为会引入 CI 稳定性风险）。
5. **磁盘满时的降级**：atomicWriteFile 在磁盘满时抛错 → recordActivation 回滚 → TQ-CON-007。preview 的 fire-and-forget 失败仅记录到 lastError，下次 healthCheck 暴露。Adapter 不会"沉默吞"磁盘故障。
6. **audit.jsonl 无上限**：长期运行累积；需运维手工管理。
7. **版本文件 retention 只删非活跃版本**：若 activeVersion 从 v1 漂到 v200 再回滚到 v50，v50 必须仍在磁盘上——maxVersions=100 可能不够。缓解：运维设置 maxVersions 需考虑实际 rollback 深度。

## O. 对 Step 13 的衔接

Sprint D 完成后，Phase 8 剩下 Sprint E（External Engine Adapter）。Step 13+ 将：

- 落地 `ExternalEngine*Port` 的契约套件与 Adapter（可能对接 Python 风控引擎 / 外部规则引擎 / 外部风险决策 API）
- 复用 Sprint B-D 建立的 `AdapterFoundation` + 元规则 I（外部服务 healthCheck）+ 元规则 J（测试外部服务隔离）+ 1PC + compensation 模式
- 不触碰 Config 层（Sprint D 已锁定）

Step 12 给 Step 13+ 留下的资产：

- `definePersistentConfigContractTests` 是 Phase 8 第二个持久化契约函数（第一是 Step 5 的 EventStore 版）；Step 13+ 若涉及持久化外部引擎状态，可沿用该模式。
- 1PC + compensation 扩展到"非 lifecycle-internal mutation path"（即 reload）的经验：任何 Adapter 的外部触发操作都可以沿用"读入 → 校验 → 产生新状态 → 持久化 → 若失败则回滚"的模板。
- watchMode 默认 manual 的哲学：Tianqi 偏好显式触发；Step 13+ 若涉及外部引擎状态变化的通知，默认模式应倾向于 pull / 手动 ack，而非 push / 自动 subscribe。

## P. 测试增量明细

| 来源                                                                         | 新增 it 数 |
| ---------------------------------------------------------------------------- | ---------: |
| `con.test.ts`（TQ-CON-009 工厂 + TQ-CON-008 vs TQ-CON-009 分离）             |          2 |
| `inf.test.ts`（TQ-INF-012 工厂 + TQ-INF-011 vs TQ-INF-012 分离）             |          2 |
| `persistent-config-contract.test.ts`（testkit 自测函数类型导出）             |          1 |
| `exports.test.ts`（新增持久化契约套件并排导出）                              |          1 |
| `config-file.persistent.test.ts`（18 个持久化契约 it 在 config-file 上挂载） |         18 |
| **合计**                                                                     |     **24** |

（`config-file.test.ts` 的 Object.keys 断言更新但数量不变；`config-file.contract.test.ts` 的 21 基础契约不受影响。）

**测试总数**：1406 → **1431**（+25，一项是自有 Object.keys 改名计为 0 净增）。Gate G13 下限 1430，通过。
