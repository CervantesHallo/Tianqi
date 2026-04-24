# @tianqi/config-file

`ConfigPort` 的文件系统实现。Step 11 落地了 YAML 冷启动 + 三动作骨架；**Step 12 扩展到热加载 / 预校验失败恢复 / 跨重启历史版本保留**——真正可在生产系统中被运维使用的完整能力。

## YAML 文件格式

根节点必须是一个 mapping，恰好两个必填字段：

```yaml
version: 1 # 正整数。文件 schema 世代标号（格式校验 + healthCheck 展示），不与 Adapter 内部 ConfigVersion 合流。
values: # 对象。内容为 RuntimeConfig 接受的 string / number / boolean 平面字段。
  traceSampling: 0.25
  strict: true
  stage: canary
```

**`version` 字段的语义**：

- `version` 必须解析为正整数，否则 `init()` 抛 `TQ-CON-008`。
- **Adapter 内部 ConfigVersion 计数器与 `version` 字段无关**——Adapter 以自己的单调递增计数器（跨重启持久化于 `state.json`）分配 `ConfigVersion`。YAML 的 `version` 仅是"文件 schema 的世代标记"，供运维在多次修改同一份文件时肉眼对比。
- 选择理由见 `docs/phase8/11-config-memory-and-file-adapters.md` §C。Step 12 继承此决策。

## 使用

### 基础场景（manual 模式 + 首次冷启动）

```ts
import { createFileConfig } from "@tianqi/config-file";
import { createConfigVersion } from "@tianqi/shared";

const config = createFileConfig({
  filePath: "/etc/tianqi/config.yaml"
  // historyDirectory 默认 `${filePath}.tianqi-history`
  // watchMode 默认 "manual"
  // autoActivate 默认 "never"
});
await config.init();
// init() 已把 YAML 解析内容登记为内部 version 1（通过 preview）。默认不自动激活——
// META-RULE A 处置：Step 10 冻结契约 1.1 要求 getActiveConfig 在 init 之后未激活时
// 返回结构化错误，本 Adapter 必须服从。
const yamlBootstrap = createConfigVersion(1);
await config.activate(yamlBootstrap);

const active = await config.getActiveConfig();
if (active.ok) {
  console.log(active.value.values["traceSampling"]); // 0.25
}

await config.shutdown();
```

### 热加载场景（fs-watch 自动 + onLoad 激活）

```ts
const config = createFileConfig({
  filePath: "/etc/tianqi/config.yaml",
  watchMode: "fs-watch",
  autoActivate: "onLoad",
  watchDebounceMs: 100
});
await config.init();
// 运维编辑 /etc/tianqi/config.yaml 并保存 →
// fs.watch 事件 → 100ms 去抖 → reload() 内部 preview + activate →
// getActiveConfig() 立即返回新内容。
// 运维若想在 activate 前肉眼审阅新内容，把 autoActivate 设为 "never" 即可。
```

### 手动 reload（推荐用于 SIGHUP 模式）

```ts
const config = createFileConfig({
  filePath: "/etc/tianqi/config.yaml",
  watchMode: "manual"
});
await config.init();

// 部署脚本或 SIGHUP handler 触发：
process.on("SIGHUP", async () => {
  const result = await config.reload();
  if (!result.ok) {
    console.error("reload failed:", result.error.message);
    // 旧的 activeVersion 仍然生效，无需额外恢复。
  }
});
```

### 生产冻结场景（watchMode: "off"）

`watchMode: "off"` 禁止一切 reload：`fs.watch` / `watchFile` / `reload()` 调用都不再读文件。配置在 `init()` 冷启动时确定后，进程生命周期内不再变化——金融 / 合规等对配置稳定性要求极高的场景的首选。

## 契约覆盖

两行挂载驱动 `@tianqi/adapter-testkit` 的两份契约套件：

```ts
// 基础契约：21 个 it（Step 10 冻结）
defineConfigContractTests("config-file", async () => {
  const filePath = await writeFreshYaml();
  return createFileConfig({ filePath });
});

// 持久化契约：18 个 it（Step 12 新增）
definePersistentConfigContractTests("config-file", factory, options);
```

**基础 21 个 it** 覆盖：Read path / Preview-Activate-Rollback state machine / Version-keyed read via probe / Audit trail + activation atomicity / AdapterFoundation integration。

**持久化 18 个 it** 覆盖：

- **P1 跨重启恢复（5）**：active 指针 / 历史版本 / 完整 audit 轨迹 / counter 单调性 / 无 historyDirectory 时回退冷启动
- **P2 热加载语义（5）**：manual reload / autoActivate never / autoActivate onLoad / watchMode manual 不自动观察 / 未变化文件 reload 幂等 / 破损后修复的恢复
- **P3 热加载失败恢复（4）**：corrupt YAML / deleted YAML / 缺 version 字段 / 非 primitive 值类型 / 删除后重写的恢复
- **P4 auditFailureMode 与 reload 交互（4）**：reload 触发 activate 时 audit 故障回滚 / shutdown 后 getActiveConfig 仍拒绝 / healthCheck 暴露 history 诊断字段

与 `@tianqi/config-memory` 的契约挂载**完全独立**——两个 Adapter 各自从零实现 1PC + compensation。持久化层由 config-file 独占。

## Semantics（元规则 N 在 Config 领域的三条声明）

本节替换 Step 11 的相同声明。**Step 12 的升级是诚实的**——持久化从"进程内存丢失"变为"跨重启保留"，但核心不变量（1PC + compensation）保持。

1. **持久化保证**：
   - `historyDirectory/state.json`：Adapter 内部状态（nextVersionNumber / activeVersion / lastLoadedYamlHash / fileYamlVersion）。原子写（tmp + rename）。
   - `historyDirectory/versions/v{N}.yaml`：每个 `preview` 产生的版本独立落盘。
   - `historyDirectory/audit.jsonl`：append-only JSONL，每次 `activate` / `rollback` 成功时追加一行。
   - **跨重启完整保留**：init() 读 state.json 恢复 activeVersion、从 versions/ 恢复 Map、从 audit.jsonl 恢复 auditTrail。
   - **保留策略**：`historyRetention.maxVersions` 默认 100。超限时删除最老的非活跃版本文件；audit.jsonl 永不裁剪（运维可手动清理）。
   - **无 historyDirectory 回退**：若 historyDirectory 在 init 时不存在，按 Step 11 语义冷启动（preview YAML 为 v1，不 activate）；第一次 init 结束时自动创建 historyDirectory。
2. **激活原子性保证**：
   - **Step 10 硬模板扩展到 reload 路径**：reload 触发的 activate（autoActivate: "onLoad" 时）仍走 `flip pointer → append audit → 若失败则 rollback pointer` 的 1PC + compensation。
   - **reload 失败保留前置状态**：文件不可读 / YAML 解析失败 / schema 校验失败 / 值类型非法 →任一失败下，activeVersion 与 auditTrail 保持不变，`lastError` 字段记录失败原因供 healthCheck 暴露。
   - **磁盘写失败触发 TQ-CON-007**：如果 audit.jsonl 追加失败（磁盘满 / 权限失效），recordActivation 回滚 activeVersion 到 previous，返回 TQ-CON-007。
3. **多实例一致性**：**不提供**。两个指向同一 `filePath` + `historyDirectory` 的 `createFileConfig` 实例的行为未定义（写竞态未处理）——部署必须约束**单进程写入**某个 historyDirectory。多进程只读消费一份 config 是 OK 的，但只能有一个进程对其做 `preview` / `activate` / `rollback` / `reload`。违反此约束导致 state.json / audit.jsonl 内容漂移，须手动清理。

## § Hot Reload

### watchMode 模式矩阵

| 模式         | 自动触发 reload() | 调用 `reload()` 生效 | 推荐场景                                     |
| ------------ | ----------------- | -------------------- | -------------------------------------------- |
| `"fs-watch"` | ✅ fs.watch 事件  | ✅                   | 开发环境 / 非生产运维频繁编辑                |
| `"poll"`     | ✅ watchFile 轮询 | ✅                   | 网络挂载 / Docker overlay 等 fs.watch 不可靠 |
| `"manual"`   | ❌                | ✅                   | **默认**。SIGHUP / 部署脚本显式触发          |
| `"off"`      | ❌                | ❌ 立即返回 ok       | 生产冻结 / 合规强要求场景                    |

**默认 `manual`** 的理由：

- 确定性 —— 无时序不确定性，无平台差异（macOS FSEvents / Linux inotify / Windows ReadDirectoryChangesW 各有怪癖）。
- 明示 —— reload 时机由调用方决定，审计轨迹中的时间戳对应真实触发而非文件系统事件。
- 测试可预期 —— 契约测试无需等待 fs 事件，可以直接调 `reload()`。

### autoActivate 策略

- `"never"`（默认）：reload 成功后新版本被 preview 但不自动 activate。运维可通过 `probe.getByVersion(N)` 审阅新内容，再手动 `activate(N)`。
- `"onLoad"`：reload 成功后立即走 1PC + compensation 的 activate 路径。若 audit 写入失败，新版本仍保留在 versions/ 中，但 activeVersion 不变，返回 TQ-CON-007。

### Debounce 行为

`watchDebounceMs` 默认 100ms。fs.watch 常因编辑器保存、`mv` 原子替换等触发多次事件；100ms 窗口内的多次触发合并为一次 reload。

### 运维最佳实践

- **Atomic mv**：`mv -f new.yaml /etc/tianqi/config.yaml`（同挂载点内 rename 是原子的）避免 partial write。
- **文本编辑器保存**：现代编辑器（vim / VSCode）默认走 mv 模式；避免 `>` redirection 直接覆盖（会触发读者读到空文件）。
- **反向回退**：运维认为新 config 有问题时，改回原文件内容（或 `git checkout` 上个版本）再 reload —— Adapter 会把它作为新的 ConfigVersion 登记，历史轨迹保留两次编辑。
- **观察 lastError**：定期 `healthCheck()` 并读 `details.lastError`；非 `"none"` 即意味着最近一次 reload 失败，需要查 runbook 对应 TQ-INF-011 / TQ-CON-008。

## § Persistence Layout

**historyDirectory 目录结构**（约定一次，不会变化）：

```
<historyDirectory>/
├── state.json              # 元状态（原子写，JSON）
├── audit.jsonl             # append-only 审计轨迹（JSONL）
└── versions/
    ├── v000001.yaml        # 每个 ConfigVersion 的独立 YAML 快照
    ├── v000002.yaml
    └── ...
```

### 各文件职责

| 文件               | 格式                       | 更新时机                           | 运维可否手改 |
| ------------------ | -------------------------- | ---------------------------------- | ------------ |
| `state.json`       | JSON 对象                  | 每次 preview / activate / rollback | **不应**     |
| `audit.jsonl`      | JSONL（每行一个 entry）    | 每次 activate / rollback 成功      | **不应**     |
| `versions/v*.yaml` | YAML（与 filePath 同格式） | 每次 preview 产生新版本            | **只读**     |

手改 `state.json` 或 `audit.jsonl` 会导致下次 `init()` 抛 `TQ-CON-009 CONFIG_HISTORY_STATE_INCONSISTENT` —— 正确的运维操作是"改 filePath 的 YAML 然后 reload"，让 Adapter 自己产生新版本。

### 运维手动操作指南

- **查看当前活跃版本**：`cat /etc/tianqi/config.yaml.tianqi-history/state.json`
- **查看版本 5 内容**：`cat /etc/tianqi/config.yaml.tianqi-history/versions/v000005.yaml`
- **查看审计尾部**：`tail -20 /etc/tianqi/config.yaml.tianqi-history/audit.jsonl | jq .`
- **回滚到某版本**：**不要手改 state.json**。改用代码：`await config.rollback(createConfigVersion(5))`。
- **清理 historyDirectory**：**整个目录删除 + 进程重启**——Adapter 会从 filePath 冷启动。切勿只删某几个 version 文件。

### 磁盘空间考量

单个 version 文件通常 < 1KB；maxVersions=100 默认意味着 < 100KB 的版本存储成本。audit.jsonl 每次 activate / rollback 追加一行（约 80 字节），一年运维 1000 次切换产生 ~80KB。本 Adapter 不自动清理 audit.jsonl；若运维关心超长 audit，可在运维窗口内手动 truncate（Adapter 下次 `init()` 会检测到 audit.jsonl 比 activeVersion 短并抛 `TQ-CON-009`，此时需要同步调整 state.json —— 本 Adapter 不推荐此操作）。

## 依赖

- **`yaml@2.8.3`**（精确版本锁，ISC 许可，纯 JS 无 native build）：Phase 8 第四个第三方生产依赖（元规则 G 第四次实战）。
- Step 12 未引入任何新第三方依赖（不使用 chokidar / watchpack / node-watch；全部依靠 `node:fs.watch` / `node:fs.watchFile`）。

## 错误码

- `TQ-INF-003` / `TQ-INF-004`：未 init / 已 shutdown（复用，惯例 K——Lifecycle 共性）
- `TQ-INF-011`：`init()` / `reload()` 无法读取 `filePath`
- `TQ-INF-012`：historyDirectory 无法创建 / 列出 / 写入（**Step 12 新增**）
- `TQ-CON-006`：`activate` / `rollback` / `getByVersion` 目标版本未登记
- `TQ-CON-007`：audit 落地失败触发活跃指针回滚
- `TQ-CON-008`：YAML 结构不符合约定（`version` 非正整数 / `values` 非平面对象 / 非 primitive 值）
- `TQ-CON-009`：historyDirectory 内部状态不一致（state.json ↔ versions/ ↔ audit.jsonl 相互矛盾，**Step 12 新增**）

## 与 `@tianqi/config-memory` 的差异对比

| 维度                | config-memory    | config-file (Step 12)                                                                                                                          |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 初始数据源          | 无（完全空白）   | YAML 文件（cold start）                                                                                                                        |
| 持久化              | **不持久化**     | **historyDirectory 全量持久化** —— state.json + audit.jsonl + versions/v\*.yaml                                                                |
| 跨重启恢复          | 所有状态丢失     | **完全恢复**：activeVersion / 版本 Map / audit 轨迹 / counter 单调性                                                                           |
| 热加载              | 不支持           | `fs.watch` / `watchFile` / 手动 `reload()` 三种模式 + autoActivate 策略                                                                        |
| reload 失败回滚     | N/A              | **reload 失败保持 activeVersion + audit 不变**（1PC + compensation 扩展）                                                                      |
| healthCheck details | 仅进程内指标     | `filePath` / `fileReadable` / `historyDirectory` / `historyDirectoryWritable` / `watchMode` / `autoActivate` / `fileYamlVersion` / `lastError` |
| 多实例一致性        | 不提供；完全独立 | 不提供；部署必须约束单进程写入 historyDirectory                                                                                                |
