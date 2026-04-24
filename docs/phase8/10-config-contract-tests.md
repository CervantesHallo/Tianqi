# Phase 8 / Step 10 — adapter-testkit Config 契约测试套件

## A. Step 10 定位

Step 10 是 **Sprint D 的立契约起点**——角色等同于 Sprint B 的 Step 3（EventStore 契约）和 Sprint C 的 Step 7（Notification 契约）：把 `packages/ports/src/config-port.ts` 中冻结的 `ConfigPort` 语义翻译为可被任意 Config Adapter 复用的契约 `it` 块，并铺设 Sprint D 剩余 Step（正式 Config Adapter 落地）共享的 probe 模式与错误码。

本 Step 完成后，任何 Config Adapter 只需要 `defineConfigContractTests("<name>", factory)` 一行挂载即可被 21 个 `it` 块判决合格与否。与前两个 Sprint 的起点一致，本 Step 零正式 Adapter，参考实现严格限定在 `src/fixtures/`。

## B. ConfigPort 签名映射与 META-RULE A 三次触发

`ConfigPort` 冻结签名（读自 `packages/ports/src/config-port.ts`）：

```ts
export type RuntimeConfig = {
  readonly version: ConfigVersion;
  readonly values: Record<string, string | number | boolean>;
};

export type ConfigPortError = { readonly message: string };

export type ConfigPort = {
  getActiveConfig(): Promise<Result<RuntimeConfig, ConfigPortError>>;
};
```

Port 形状**比任何前序 Port 都极简**——仅一个只读方法。`补充文档 §5` 所要求的"preview / activate / rollback / 审计 / 版本读取 / 激活原子性"能力均不在 Port 接口上。**三处 META-RULE A 冲突**——均按"服从既有事实，testkit 侧新增观察原语（元规则 M）"处置：

**触发 1 — Port 无 preview / activate / rollback 方法**：

- 指令第五节的类别 2 / 4 要求 preview 与 activate / rollback 的语义契约。
- 既有事实：`ConfigPort` 只有 `getActiveConfig()`。Port 是运行时读取接口，变更路径在 Port 之外。
- **处置**：在 adapter-testkit 内新增 `ConfigContractProbe`，提供 `preview / activate / rollback / getByVersion / getAuditTrail / setAuditFailureMode` 六个观察与受控变更原语。probe 带 `__configProbe: true` 品牌字段，与 `__testkitProbe` / `__notificationProbe` 区分开。contract suite 的 `ConfigAdapterUnderTest = ConfigPort & AdapterFoundation & ConfigContractProbe` 要求被测 Adapter 同时实现 Port、Foundation 与 probe。preview / activate / rollback **不是** `ConfigPort` 的扩展；生产路径不依赖 probe。

**触发 2 — `RuntimeConfig` 无 `preview_ok` / `active_ok` / 任何 lifecycle 状态字段**：

- 指令类别 3 要求"preview 后读未激活版本仍可见"，但 Port 读取接口只返回当前 active config。
- **处置**：probe 的 `getByVersion(version)` 承载版本定位读；它是 testkit-only 观察原语，与 `getActiveConfig()` 分工明确：前者读历史快照，后者读 active 指针。

**触发 3 — 没有审计数据结构定义**：

- 指令类别 4 要求审计条目契约，但 Phase 1–7 没有任何 `ConfigAuditEntry` 型别留在 contracts 或 ports 中。
- **处置**：在 `src/config-contract-probe.ts` 内定义 testkit-专属的 `ConfigAuditEntry`（`fromVersion / toVersion / at / cause`）。**严格不对外扩散**——不加入 `@tianqi/contracts` 或 `@tianqi/ports`，因为它只是契约测试语言，不是生产数据结构。未来若 Saga 层需要读审计轨迹，那是独立 Step 的职责。

## C. 5 大类别覆盖范围与《宪法》的映射

| 类别                                   | `it` 块数 | 主映射                               | 关键断言                                                                                                                                                             |
| -------------------------------------- | --------: | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Read path through getActiveConfig()  |         4 | §5.4 Config Port 只读接口语义        | 未激活时结构化错误而非空值；激活后圆一致；多次激活取最新；返回值对调用方变更免疫                                                                                     |
| 2 Preview/activate/rollback state mach |         6 | §5.3 版本 lifecycle（补充文档）      | preview 版本单调；相同内容仍得新版本（无隐式去重）；preview 不改 active；activate 未知版本 TQ-CON-006 且不改 active；rollback 恢复历史；rollback 未知版本 TQ-CON-006 |
| 3 Version-keyed read via probe         |         3 | §5.3 + 元规则 M（testkit 观察原语）  | getByVersion 精确还原；未知版本 TQ-CON-006；历史版本在新激活后仍可读                                                                                                 |
| 4 Audit trail + activation atomicity   |         5 | §5.3 审计 + 补充文档 §5.4 原子性要求 | 每次 activate 入账按序；rollback 与 activate cause 分离；audit 写失败回滚 active + TQ-CON-007；audit 快照不可变；失败模式关闭后路径恢复                              |
| 5 AdapterFoundation integration        |         3 | Step 2 AdapterFoundation + 元规则 M  | getActiveConfig 未 init 返回 TQ-INF-003；shutdown 后返回 TQ-INF-004；healthCheck 不抛异常                                                                            |

**5 类而非 4 或 6 的依据**：

- 合并"激活 state machine"与"preview 独立性"会让类别 2 变成"杂物抽屉"——分开使 preview 独立性（不改 active）与激活失败不破坏 active 成为各自类别 2/4 的第一公民断言。
- 拆掉"审计与原子性"为单独类别是本 Step 的独特结构：与 Sprint B/C 不同，Config Adapter 的关键正确性断言是"版本切换与审计写入要么都成功要么都回滚"——这比单纯的 publish/subscribe 或 append/read 更接近 Saga 语义，值得独立 5 个 `it` 块。
- 每类至少 3、至多 6 个 `it` 块，均衡良好。

## D. ConfigContractProbe 字段选择

**最终形状**（testkit 必要的最小面）：

```ts
export type ConfigContractProbe = {
  readonly __configProbe: true;
  preview(values: RuntimeConfig["values"]): ConfigVersion;
  activate(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  rollback(version: ConfigVersion): Promise<Result<void, ConfigContractProbeError>>;
  getByVersion(version: ConfigVersion): Result<RuntimeConfig, ConfigContractProbeError>;
  getAuditTrail(): readonly ConfigAuditEntry[];
  setAuditFailureMode(enabled: boolean): void;
};
```

六个方法 + 一个品牌字段。考虑过的其他字段均被拒绝：

- `getActiveVersion()`：被 `getActiveConfig()` 返回值的 `.version` 字段替代——Port 已经承担这个职责，probe 不重复。
- `setActiveVersion(version)`：会绕过 audit trail，违反"所有 active 切换必须入审计"的契约不变量。activate/rollback 是带 audit 的唯一切换通路。
- `listAllVersions()`：契约不需要枚举——每个 `it` 都有它自己新 preview 出来的版本引用。
- `peekNextActivation()`：会暴露"未 commit 但即将写入"的中间状态，违反元规则 M 硬约束。

`setAuditFailureMode(enabled)` 是本 probe 唯一的**主动故障注入接口**，承载类别 4 的原子性断言。它明示 probe-only 语义：production Adapter 实现可以选择"没有该字段"或者"字段存在但 no-op"——后者更简洁，参考实现采纳。

## E. preview 不去重决策与单调版本号

**决策**：preview 不做内容去重。相同 values 连续两次 preview 返回两个不同的版本号。

理由（克制 > 堆砌）：

1. **诚实可追溯**：审计轨迹要求"谁在什么时候 preview 了什么"——如果两次 preview 相同内容返回同一版本，审计轨迹就丢失了"有两次独立动作"这个事实。
2. **无隐式副作用**：内容哈希去重会让调用方不确定自己拿到的是新版本还是老版本，引入 "为什么我的 preview 和别人的是同一个 ID" 的定位难题。
3. **实现简单**：单调整数递增，没有哈希计算。

类别 2 的 `test_preview_of_identical_content_still_yields_a_new_distinct_version` 断言固化此决策。

**版本号形状**：`ConfigVersion = Brand<number, "ConfigVersion">`（`@tianqi/shared` 中 Phase 1 冻结）。`createConfigVersion(n)` 要求正整数。参考实现用 `nextVersionNumber` 从 1 开始单调递增，preview 每次后 `+= 1`。

## F. 错误码复用 vs 新增的裁决

**决定**：**复用** `TQ-INF-003` / `TQ-INF-004`；**新增** `TQ-CON-006 ADAPTER_CONFIG_VERSION_NOT_FOUND` 与 `TQ-CON-007 ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED` 两码。

惯例 K 判断标准："若两个 Adapter 的同一错误场景能用完全相同的诊断动作解决，则共性；否则专属。"

- **`TQ-INF-003 / TQ-INF-004` 复用**：与 EventStore / Notification 的 Lifecycle 语义完全同构——"Adapter 尚未 init 被调用" vs "Adapter 已 shutdown 被调用"，诊断动作一致（先 init / 新建实例）。不新增 `TQ-INF-015 CONFIG_NOT_INITIALIZED`。

- **`TQ-POL-007 CONFIG_VERSION_NOT_FOUND` 不复用 — 新增 `TQ-CON-006`**：这是本 Step 最细腻的判断。TQ-POL-007 是 Phase 1 冻结的 Policy 层错误码，语义是"Policy 调用方指定了不存在的版本"。Adapter 层面也会返回"版本不存在"，但**诊断动作不同**：
  - Policy 层 TQ-POL-007 → "Policy 调用方应使用有效版本或先创建版本"——远端配置源 / Saga 编排问题。
  - Adapter 层 TQ-CON-006 → "存储层没有这个版本快照"——本地持久化 / 首次启动未同步 / 回滚目标未 preview 问题。

  两者诊断工具链不同，惯例 K 判"专属"。此外 **Adapter 不得返回 Policy 层错误码**（层级隔离硬约束：TQ-POL-\* 是 Policy 层专属），所以即使语义相似，Adapter 层必须有自己的 TQ-CON-\* 对应码。

- **新增 `TQ-CON-007 ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED`**：激活时 audit 写失败触发的 active 指针回滚——没有任何既有码对应这个场景。放在 TQ-CON-\* 而非 TQ-SAG-\* 是因为：Adapter 不是 Saga 编排者，它只维护"active 与 audit 同步"这一单 Adapter 内不变量；Saga 码留给跨 Adapter / 跨步骤的工作流失败。

**不新增** `TQ-INF-011 CONFIG_PERSISTENCE_UNAVAILABLE` / `TQ-CON-008 CONFIG_VALUES_INVALID`——前者将在未来 Config Adapter 落地（Step 11+）时根据具体存储后端需要再裁决，本 Step 没有对应 `it` 块；后者目前没有值校验契约断言，按"无对应断言即不新增"纪律不填充（Step 3 §D 已立规矩）。

## G. 激活原子性与 TQ-CON-007 语义裁决

参考实现的 `recordActivation(targetVersion, cause)` 是类别 4 的核心："flip active pointer → append audit → 若 audit 失败则 rollback active"。

这等价于**单 Adapter 内 1PC + compensation**：

- 正常路径：pointer 从 `previousActive` 翻到 `targetVersion`，audit 追加一条。
- 故障路径（`auditFailureMode=true`）：pointer 翻到 `targetVersion` 后，audit 写入失败；立即把 pointer 回滚到 `previousActive`；返回 `TQ-CON-007`。
- 最终不变量：audit 轨迹长度 ≥ active 指针合法切换次数；两者永不漂移。

这个模式对真实 Adapter（Step 11+）的要求：

- 关系库实现：用事务把 `UPDATE config_active SET version=?` 与 `INSERT INTO config_audit ...` 放同一事务，commit 失败自动 rollback。
- 文件/KV 实现：需要显式 compensation（写入 active.json → 若 append audit.log 失败则把 active.json 回写）。
- Memory 参考实现：用 try/catch 包住 audit append；catch 里手动 rollback pointer。

## H. 审计 cause 字段：activate vs rollback

**决策**：audit 条目带 `cause: "activate" | "rollback"` 字段区分两类切换。

理由：从语义上 rollback 就是"激活一个历史版本"，但从**审计可读性**上两者应当可区分：

- 运维看审计轨迹时能立即看出"这次切回是回滚还是正常演进"。
- Saga 层读审计做回放时能识别"这里有一次补偿"。

类别 4 的 `test_audit_trail_marks_rollback_cause_distinctly_from_activate` 固化此决策。activate 到已激活过的版本是否允许？参考实现允许（等价于"再次激活已激活版本"——audit 照样记一条 cause=activate）。契约层不限制这种"重复激活"；若未来某个 Adapter 想拒绝，可以在其内部加 precondition 而不破坏契约。

## I. 元规则 A–N 触发情况

- **元规则 A（指令 vs 既有事实冲突）**：**触发三次**（详见 §B）。均按"服从既有事实，testkit 侧补观察原语"处置。
- **元规则 B（testkit 签名兼容纪律）**：未直接触发——`defineConfigContractTests` 是本 Step 首次发布的函数。其泛型 `T extends ConfigAdapterUnderTest` 与参数顺序遵循 Sprint B/C 同构形状；`options` 参数空 `Readonly<Record<string, never>>` 留出扩展空间。
- **元规则 C（EventStorePort 只写）**：不适用（本 Step 不触碰 EventStorePort）。
- **元规则 D（adapter-testkit 依赖边界）**：**贯彻**。adapter-testkit 新增 Config 相关源码依赖仍在 `{contracts, ports, shared}` + vitest 白名单内；无第三方运行时依赖新增。
- **元规则 E（持久化契约独立函数）**：不适用——本 Step 不定义 `definePersistentConfigContractTests`。若 Step 11+ 的 Config Adapter 有持久化契约（如"配置写入后重启仍能读"），按 Step 5 的持久化套件模式新开独立函数。本 Step 不预设。
- **元规则 F（参考实现跨包引用禁令）**：**贯彻**。`src/fixtures/reference-config.ts` 不通过 `src/index.ts` 导出、不在 `package.json exports`。未来任何 Adapter 的 test 文件严禁 `import { createReferenceConfig }`。
- **元规则 G（第三方依赖准入）**：不触发（本 Step 无新第三方依赖）。
- **元规则 H（持久化 Adapter 自管 schema）**：不适用。
- **元规则 I（外部服务 healthCheck 语义）**：不直接触发（参考实现是内存模拟，没有外部服务）。Step 11+ 若接入真实配置中心（etcd / Consul / Nacos）将触发。
- **元规则 J（测试用外部服务隔离）**：不直接触发。Step 11+ 将按 `TIANQI_TEST_CONFIG_ENDPOINT` 等环境变量保护。
- **元规则 K（错误码共性 vs 专属）**：**详细触发**（详见 §F）。复用 `TQ-INF-003/004`；新增 `TQ-CON-006/007` 两码（含 TQ-POL-007 vs TQ-CON-006 的"层级隔离"判断）。
- **元规则 L（Adapter 自有测试的覆盖边界）**：不直接适用——本 Step 不涉及正式 Adapter。Step 11+ 的 Config Adapter 落地时适用。
- **元规则 M（testkit 观察原语约束）**：**首次在 Config 语境实战**。`ConfigContractProbe` 的 6 个方法均为观察/受控变更原语；不暴露"未 commit 但即将写入"的中间状态（§D 明示拒绝 `peekNextActivation()`）。`setAuditFailureMode` 是唯一故障注入接口，仅在类别 4 使用。
- **元规则 N（传递语义显式声明）**：不适用——Config 不是消息系统，没有投递语义维度。但 Step 11+ Adapter README 仍需显式声明两条：**持久化保证**（preview 后是否即刻落盘）+ **激活原子性保证**（active 与 audit 是否强一致）。

## J. 参考实现与 Step 11+ 正式 Adapter 的职责分离

与 Sprint B / C 的 reference-\* 纪律完全对齐：

- **导出面分离**：`createReferenceConfig` 不通过 `src/index.ts` 导出、不在 `package.json exports`；其他包无合法 import 路径。
- **目录分离**：位于 `src/fixtures/`；Step 11+ 正式 Adapter 位于 `packages/adapters/config-*/src/`。
- **职责分离**：参考实现唯一消费者是 `src/config-contract.test.ts` 自测；Step 11+ Adapter 的消费者是 Application 层。
- **迭代分离**：参考实现仅在"契约断言调整"时修订；Step 11+ Adapter 仅在"语义 bug / 性能"时修订。

## K. 对 Sprint D 后续 Step 的衔接

**Step 11+ Config Adapter**（具体后端 TBD——可能是 in-memory 正式版、文件、etcd、Nacos）的测试挂载形状：

```ts
defineConfigContractTests("config-<backend>", () => createConfigAdapter(options));
```

一行驱动 21 个契约 `it`，外加 ≤6 个 Adapter 自有测试（惯例 L）。自有测试不重复契约场景；只覆盖该后端专属维度（连接字符串校验、持久化格式、网络故障处置等）。

**Adapter README 必须声明**（元规则 N 硬约束对 Config 的变体）：

- 持久化保证（preview 后是否即刻落盘 / 启动时是否自动恢复 active）。
- 激活原子性保证（active 与 audit 是否强一致 / 故障恢复窗口是否可能出现 active != audit 末条）。
- 多实例一致性（单机 vs 分布式 active 指针同步语义）。

## L. 风险点

- **参考实现被 Step 11+ 误用**：Sprint B/C 已建立的元规则 F 严禁跨包 import `reference-config`。Step 11+ 的 code review 必须显式检查此项。
- **ConfigContractProbe 扩展压力**：Step 11+ 真实后端（etcd watch / 分布式 lock）可能诱使在 probe 上加新字段（如 `waitForPropagation()`）。元规则 B 禁止拆换签名——新字段只能按 options 扩展机制追加可选成员。
- **TQ-CON-006 vs TQ-POL-007 概念混淆**：两码语义接近但层级隔离。code review 必须核实："Adapter 返回 TQ-POL-\* 码"即为层级违规，无论语义多相似。docs/phase8/10 §F 与 `con.test.ts` 新增的 `test_distinguishes_TQ-CON-006_from_frozen_TQ-POL-007` 是永久留痕。
- **审计 cause 字段扩展**：未来可能出现"系统触发（非人工）""自动回滚（异常检测）"等新 cause。当前契约锁定 `"activate" | "rollback"` 两值；扩展需要新 Step 裁决不破坏既有断言。
- **Step 11+ Config Adapter 可能需要 persistent 契约函数**：若配置落盘后"重启仍能恢复 active" 成为硬要求，需按元规则 E 新开 `definePersistentConfigContractTests`。本 Step 不预设。

## M. 测试覆盖总结

- 新增 `src/config-contract.ts` 21 个契约 `it` 块（5 类别：4/6/3/5/3）。
- 新增 `src/config-contract.test.ts` 一行挂载驱动参考实现通过。
- 新增 `src/errors/con.test.ts` 4 个 `it` 块（TQ-CON-006/007 工厂 + 层级分离验证 + cause chain）。
- 新增 `src/exports.test.ts` 1 个 `it` 块（三 contract suite 函数性导出统一自测）。

测试总数 1324 → 1350（+26 = 21 契约 + 4 con.test + 1 exports）。本 Step 未实现任何正式 Config Adapter / 未修改 `ConfigPort` 或 `RuntimeConfig` 签名 / 未改既有 Phase 1-7 错误码（含 TQ-POL-007）/ 未触碰 domain/application/policy/shared/infrastructure / 未引入任何第三方依赖。
