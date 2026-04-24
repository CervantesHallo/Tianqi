# @tianqi/config-file

`ConfigPort` 的文件系统实现：从一份 YAML 文件读取初始配置，进程运行期通过 probe 接口增量产生新版本。本 Adapter 覆盖 Step 11 "基础能力"范围——热加载、文件监听、历史版本跨重启保留等能力属于 Step 12 职责，**本 Step 不做**。

## YAML 文件格式

根节点必须是一个 mapping，恰好两个必填字段：

```yaml
version: 1 # 正整数。文件 schema 版本标记（格式校验用），不与 Adapter 内部 ConfigVersion 合流。
values: # 对象。内容为 RuntimeConfig 接受的 string / number / boolean 平面字段。
  traceSampling: 0.25
  strict: true
  stage: canary
```

**`version` 字段的语义**：

- `version` 必须解析为正整数，否则 `init()` 抛 `TQ-CON-008`。
- **Adapter 内部 ConfigVersion 计数器与 `version` 字段无关**——Adapter 以自己的单调递增计数器（从 1 开始）分配 `ConfigVersion`。YAML 的 `version` 仅是"文件 schema 的世代标记"，供运维在多次修改同一份文件时肉眼对比用。
- 这条选择的理由见 `docs/phase8/11-config-memory-and-file-adapters.md` §C。

## 使用

```ts
import { createFileConfig } from "@tianqi/config-file";
import { createConfigVersion } from "@tianqi/shared";

const config = createFileConfig({ filePath: "/etc/tianqi/config.yaml" });
await config.init();
// init() 已把 YAML 解析内容登记为内部 version 1（通过 preview）。默认不自动激活
// —— 调用方显式 activate 才进入生效状态。这是 META-RULE A 处置：Step 10 冻结契约
// 1.1 要求 getActiveConfig 在 init 之后未激活时返回结构化错误，本 Adapter 必须服从。
const yamlBootstrap = createConfigVersion(1);
await config.activate(yamlBootstrap);

const active = await config.getActiveConfig();
if (active.ok) {
  console.log(active.value.values["traceSampling"]); // 0.25
}

await config.shutdown();
```

`healthCheckTimeoutMs` 可选（默认 2000ms），控制 `healthCheck` 探测 `fs.access` 的独立超时。不设业务数据读取，不触发 YAML 重解析——元规则 I 硬约束。

## 契约覆盖

一行挂载驱动 `@tianqi/adapter-testkit` 的 `defineConfigContractTests` 21 个 `it` 块：

```ts
defineConfigContractTests("config-file", async () => {
  // 每次 factory 调用前写入一份全新 YAML 到 tmpdir，契约的原子性断言才能互不污染。
  const filePath = await writeFreshYaml();
  return createFileConfig({ filePath });
});
```

覆盖 5 类：Read path / Preview-Activate-Rollback state machine / Version-keyed read via probe / Audit trail + activation atomicity / AdapterFoundation integration。实现与 `@tianqi/config-memory` **独立**——两个 Adapter 各自从零实现 1PC + compensation 模式，证明该模式可移植而非 copy-paste。

## Semantics（元规则 N 在 Config 领域的三条声明）

1. **持久化保证**：**仅从 YAML 文件冷启动读取**。`init()` 成功后 YAML 内容以 version 1 缓存于进程内存；进程运行期间 `preview` / `activate` / `rollback` 产生的所有新版本**不回写 YAML 文件**。**进程重启后 version 2+ 全部丢失**；只有 YAML 文件里当前那份内容能重新恢复为 version 1。热加载与文件回写是 Step 12 的完整语义，本 Adapter 不提供。
2. **激活原子性保证**：单进程内 **1PC + compensation**，与 `@tianqi/config-memory` 同构但实现**完全独立**（两个包之间无任何代码复用，证明模式可移植性）。`activate` / `rollback` 返回 `ok` 时活跃指针与审计轨迹已同步；返回 `TQ-CON-007` 时指针回滚，审计轨迹长度不变。
3. **多实例一致性**：**不提供**。两个指向同一 YAML 文件的 `createFileConfig` 实例只在 `init()` 时看到相同 bootstrap 数据，运行期各自独立演化——一方的 `activate` 不会被另一方观察到。跨实例共享需要更高层的分布式 Config Adapter（本 Step 不涉及）。

**与 `@tianqi/config-memory` 的差异**：

| 维度                      | config-memory              | config-file                                                        |
| ------------------------- | -------------------------- | ------------------------------------------------------------------ |
| 初始数据源                | 无（完全空白）             | YAML 文件（cold start）                                            |
| 初始版本数（post-init）   | 0                          | 1（YAML bootstrap 经 preview 已登记）                              |
| 初始活跃版本（post-init） | 无                         | 无（调用方需显式 activate）                                        |
| 重启行为                  | 所有状态丢失               | YAML bootstrap 恢复；运行期新版本全部丢失                          |
| 可观测性                  | healthCheck 仅含进程内指标 | healthCheck 额外含 `filePath` / `fileReadable` / `fileYamlVersion` |

## 依赖

- **`yaml@2.8.3`**（精确版本锁，ISC 许可，纯 JS 无 native build）：Tianqi 仓库 Phase 8 第四个第三方生产依赖（元规则 G 第四次实战）。
  - 选型理由：`yaml`（by eemeli）在 Node 生态内是最活跃的 YAML 1.2 兼容解析器，实现了完整 spec，错误消息结构化；被 vite / vitest 等工具链内部使用。不选 `js-yaml`（语义 YAML 1.1，部分 edge case 与 YAML 1.2 行为不同）。
  - 未新增到根 `pnpm.onlyBuiltDependencies` 白名单——`yaml` 纯 JS 实现，无 postinstall native build。

## 错误码

- `TQ-INF-003` / `TQ-INF-004`：未 init / 已 shutdown（复用，惯例 K——Lifecycle 共性）
- `TQ-INF-011`：`init()` 无法读取 `filePath`（文件不存在、权限失效、IO 错误——本 Step 新增，诊断工具链是 `ls / stat / chmod`）
- `TQ-CON-006`：`activate` / `rollback` / `getByVersion` 目标版本未登记
- `TQ-CON-007`：审计落地失败触发活跃指针回滚
- `TQ-CON-008`：YAML 语法合法但结构不符合约定（`version` 非正整数 / `values` 缺失或含非 primitive 值——本 Step 新增，诊断语料库与 `TQ-CON-005 EVENT_SCHEMA_VIOLATION` 不同）

所有错误消息前缀均为 `TQ-*:`——契约测试的 `.toMatch(/^TQ-*:/)` 正则断言只关心错误码字符串，不关心常量名。

## Step 12 衔接

- 本 Step 的 `init()` 仅做冷启动读取；**文件变更的热加载**由 Step 12 落地（预期新增 `fs.watch` 或 SIGHUP 通道，可能引入 `chokidar` 依赖）。
- 本 Step 的 `activate` / `rollback` 产生的版本不回写文件；**历史版本跨重启保留**由 Step 12 决定（可能写 `.tianqi-state.json` sidecar 或完全取消此需求）。
- 本 Step 的 `preview` 不做内容校验（只做形状校验）；**运行期内容深度校验**由 Step 12 判断是否需要（可能引入 `zod` / `ajv`）。
