# ADR-0001: Phase 8 Adapter 层架构与五件套基础设施落地

## Status

Accepted (Phase 8 CLOSED, 2026-04-26)

## Context

Phase 1-7 把 Tianqi 的领域层（risk-case / liquidation-case / adl-case 三态机 + 协同语义 + 审计）、应用层（orchestrator / saga / replay / observability）、策略层（policy bundle + config 版本化）完整定型，并通过 30 + 10 + 7 + 6 + 6 + 6 = 65 个 Step 把所有"业务正确性"做到了**只能在内存里跑**的状态。

Phase 8 的核心矛盾：

- 一边是**Phase 1-7 的领域纪律已经凝固**——OrchestrationPorts 形状、错误码命名空间、领域类型 brand、Result\<T,E\> 失败语义都已成为契约。任何让外部世界（数据库、消息中间件、配置文件、外部引擎）能跑起来的代码，都不允许触动这些契约。
- 一边是**外部世界的复杂性极强**——五件套（timeout / retry / circuit breaker / rate limit / trace propagation）必须真实，数据库 schema 自管，消息中间件的 at-least-once 语义、配置热加载与版本化、5 个外部业务引擎各自独立又共用 HTTP 基座……每一项都有"做不彻底"的危险。

Phase 8 的目标是：把架构上无懈可击但只能在内存里跑的项目，推进到架构不变 + 基础设施落地的状态。19 个 Step 之后，仓库从 8 个 workspace 包扩到 21 个，新增 13 个 Adapter / 5 个业务 Engine Port / 14 个错误码（TQ-INF-005-018 + TQ-CON-004-014），同时 domain / application / policy 三层零修改。

本 ADR 记录支撑这一过程的 14 条元规则、2 条惯例（含修订与弹性）、关键架构裁决，作为 Phase 9+ 工程师的"为什么这么做"档案。

## Decision

Phase 8 形成的工程纪律凝结为 **14 条元规则（A–P，去掉 K/L 因为是惯例）**与 **2 条惯例（K / L 含修订与弹性）**。每条都从实际冲突场景中长出来，不是先验设定。

### 14 条元规则

#### A — 指令与既有事实冲突时既有事实胜出

Phase 8 多个 Step 的指令描述声称 "XxxPort 在 Phase 1-7 已冻结"，但实地 `ls packages/ports/src/` 证伪。处置：本 Step 作为 **首次引入**，与"修改"区分；指令描述的"不得修改"约束因实际资产不存在而落空。共触发 7 次：

- Step 13（无 ExternalEnginePort）→ 指令 testkit 的 TestkitExternalEngineFoundation
- Step 15（无 MarginEnginePort）→ 首次引入到 packages/ports
- Step 16 第 3、4 次（无 PositionEnginePort + MatchEnginePort）→ 同处置
- Step 17 第 5、6 次（无 MarkPriceEnginePort + FundEnginePort）→ 同处置
- Step 18 第 7 次（margin-engine-http build metadata bug）→ 用 Step 15 §E 同款最小修复

#### B — testkit 签名兼容

Phase 8 全程贯彻：所有 Adapter / Port / 契约函数签名一旦发布即不得修改。Step 11 / 12 / 18 等多次接近签名变更的边界，最终都通过"扩展非破坏字段"或"只读 probe surface"绕开。Phase 8 19 个 Step 内**零既有签名变更**。

#### C — EventStorePort 只写不读（贯彻 Sprint B）

Step 4-6 三个 EventStore Adapter（memory / sqlite / postgres）实现的 Port 只暴露 `append(event)`，刻意不暴露 `query(...)`。这迫使 Application 层走 EventReplay 路径而非直接读 EventStore，保持事件流的严格只追加语义。

#### D — testkit 依赖边界 \{contracts, ports, shared\}

`@tianqi/adapter-testkit` 不得依赖 domain / application / policy / 任何其他 Adapter。Phase 8 全程贯彻 —— 即便是 Step 15 在 testkit 内新增 `createMockDownstreamServer` 这种横跨 5 业务 Engine 共享的工具，也保持 testkit 仅依赖 contracts / ports / shared。

#### E — 持久化契约独立函数

持久化 Adapter（sqlite / postgres / config-file）的契约不能与基础内存契约混挂载，避免把"持久化才有的失败模式"带入内存 Adapter 测试。Step 5 引入 `definePersistentEventStoreContractTests`（类比 Step 12 引入 `definePersistentConfigContractTests`），共 18 个持久化专属 it。

#### F — 参考实现跨包引用禁令 → 扩展到 Adapter 之间互不依赖（Sprint E 实战）

Phase 8 早期（Sprint A-D）这条规则只针对 testkit 内的 reference 实现；Sprint E 实战发现需要把它扩展到**所有业务 Adapter 之间互不依赖**。具体形态：

- 5 业务 Engine（margin / position / match / mark-price / fund）零相互 import
- 5 业务 Engine 各自独立 mock-downstream-server 实例（共享 testkit 工厂，不共享实例）
- 5 业务 Engine 各自独立 response parser、translateBaseError、helper（22 个 parser × 5 = 各包独立）

唯一允许的"特许例外"是基座 Adapter（external-engine-http-base），由 META-RULE O 单独管控。

#### G — 第三方依赖准入五条件

Phase 8 共触发 6 次第三方依赖引入，每次都过五条件审计：MIT/Apache 许可 / 维护活跃 / 无 native build 或 native build 在 `pnpm.onlyBuiltDependencies` 白名单 / 精确版本锁 / 无可手写替代：

- Step 5：better-sqlite3@11.5.0（native build → 入 onlyBuiltDependencies）
- Step 6：pg@8.13.1
- Step 9：kafkajs（at-least-once 语义复杂手写不现实）
- Step 11：yaml@2.8.3（YAML 解析）
- Step 14：undici@8.1.0（HTTP/1.1 客户端 + 连接池）
- Step 18：@vitest/coverage-v8@3.2.4（工具链；与 vitest 严格版本对齐）

每次都明确**拒绝**了若干替代候选（zod / opossum / p-retry / bottleneck / axios / got 等），理由记录在对应 docs/phase8/\* 中。

#### H — 持久化 Adapter 自管 schema

Sprint B SQLite/Postgres + Sprint D config-file 的 historyDirectory 都属于 Adapter 内部状态，由 Adapter 自管 schema 与版本号。一旦 schema 漂移，Adapter 用专属错误码（TQ-INF-008 SQLite schema mismatch / TQ-CON-009 config history state inconsistent）显式 surface，不假装"还能继续跑"。

#### I — 外部服务 healthCheck 语义

外部服务 Adapter（postgres / kafka / external-engine-http-base）的 healthCheck 必须：

1. 独立 timeout（默认 healthCheckTimeoutMs = 1000）
2. 不抛异常（健康检查本身永远不能 throw）
3. 用最廉价的探测动词（OPTIONS / SELECT 1 / Topic metadata fetch）
4. 业务状态（如熔断 open/half-open）影响 healthy 字段

Step 6 / 9 / 14 三次实战形成统一形态。

#### J — 测试用外部服务隔离

postgres / kafka 等 Adapter 的 contract test 需要真实服务才能跑，通过 `TIANQI_TEST_POSTGRES_URL` / `TIANQI_TEST_KAFKA_BROKERS` 环境变量控制 skip。无环境变量时 vitest skip，CI 默认绿；提供环境变量时全部跑。

#### M — 异步分发契约的观察原语

Sprint C 引入 NotificationContractProbe 暴露 `lastDeliveredMessage` / `outstandingMessages` 等观察原语，让契约测试能断言异步分发结果。**只读**——所有 probe 方法绝不暴露写操作。Sprint E 5 业务 Engine 各自有 6 个 read-only probe getter，全数贯彻此规约。

#### N — 传递语义显式声明

每个 Adapter README 必须含 `§ Semantics` 章节声明三条传递语义保证：

1. 稳定性继承（基于哪些机制；自身实现 0 / 委托给 X）
2. 请求幂等假设（每个业务方法标明"天然幂等读"vs"依赖幂等键"）
3. 错误转译契约（永不泄漏 raw status / 网络错误名）

13 个 Adapter README 全部贯彻。

#### O — 基座 Adapter 的特许依赖（七条准入）

外部引擎 HTTP 调用涉及五件套（timeout / retry / circuit breaker / rate limit / trace propagation），Sprint E 5 业务 Engine 都需要这些能力但又不允许互相依赖。解决方案：引入"基座 Adapter" `@tianqi/external-engine-http-base`，作为元规则 F 的特许例外，但必须通过七条准入条件：

1. `-base` 后缀命名
2. 不实现任何业务 Port（仅提供基础设施能力）
3. README 显式声明"基座 Adapter"身份
4. 独立的 21 个稳定性契约 it 验收（Step 13 套件）
5. 消费方必须显式 `workspace:*` 依赖
6. 消费方仅通过公开导出 import（不得 deep import 内部模块）
7. 元规则 F 对非基座 Adapter 之间依然有效

Phase 8 内**最多一个基座**——Sprint E 唯一实战 external-engine-http-base。

#### P — 业务 Engine Adapter 的契约双层挂载

每个业务 Engine 的测试覆盖分两层：

- **下层**：Step 13 的 21 个稳定性契约一行挂载 `defineExternalEngineContractTests`，证明基座稳定性通过 `workspace:*` 跨包传递时行为不变
- **上层**：业务自有测试 ≤10 个 it 分 3 段（身份 / 业务正向 / 业务错误），不与契约 it 重复

5 业务 Engine × 21 契约 + 各自 8-10 自有 = Sprint E 收尾时 105 + 47 = 152 个 it 分布在 5 业务 Engine 上。

### 2 条惯例（含修订与弹性）

#### K — 错误码共性 vs 专属

新错误码引入时必须裁决：是复用已有码还是分配新码？标准是**诊断读者是否相同**：相同 → 复用；不同 → 分配新码。Phase 8 共 5 次扩展（Step 10/11/15/16/17），最终形成 7 个 schema-violation 类码的层级隔离：

| 码         | 诊断读者                   |
| ---------- | -------------------------- |
| TQ-CON-005 | event-schema 包 maintainer |
| TQ-CON-008 | Tianqi 运维 / YAML 编辑者  |
| TQ-CON-009 | Tianqi on-call deep-ops    |
| TQ-CON-010 | 下游 Margin 服务团队       |
| TQ-CON-011 | 下游 Position 服务团队     |
| TQ-CON-012 | 下游 Match 服务团队        |
| TQ-CON-013 | 下游 MarkPrice 服务团队    |
| TQ-CON-014 | 下游 Fund 服务团队         |

`con.test.ts` 的 7 码两两不重断言永久守卫这条规约。

#### L — Adapter 自有测试覆盖边界（含修订与弹性）

每个 Adapter 自有测试覆盖**Adapter 自身独有**的特性，不与契约测试重复。Sprint A-D 形成基础版（≤6 个自有 it）；Sprint E 业务 Engine 修订版（3 段组织，身份 ≤3 + 业务正向 ≤5 + 业务错误 ≤2，上限 10）；Step 17 引入弹性应用（业务方法少时正向段不堆砌冗余测试，留 slot 不用 = 克制 > 堆砌）。

具体落地：

- margin（Step 15）：4 业务方法 → 9 自有 it（留 1 slot）
- position / match（Step 16）：5 业务方法 → 各 10 自有 it（打满）
- mark-price（Step 17）：3 业务方法 → 8 自有 it（留 2 slot）
- fund（Step 17）：4 业务方法 → 9 自有 it（留 1 slot）

### 关键架构裁决

#### 1. "基座 + 业务"两层架构

Sprint E 起始时面临选择：5 业务 Engine 各自实现五件套，还是共享一个"基座"？后者节省代码但风险是基座变成"上帝对象"。决断：引入 META-RULE O 七条准入条件管控基座，让基座只承担**稳定性能力**而不承担**业务语义**。结果：5 业务 Adapter 主体 ~1970 行业务翻译 + 0 行稳定性逻辑（grep 验证），基座 ~600 行五件套 + 0 行业务逻辑。

#### 2. 1PC + compensation 模式（Step 11-12 Config Adapter）

Config 激活与审计 append 必须原子——但跨内存与磁盘的真原子事务做不到。决断：1PC（先 commit 内存激活，再 append 磁盘审计）+ compensation（audit append 失败 → 回滚激活 + 抛 TQ-CON-007）。这避免了"激活成功但审计丢失"导致 active 指针超前于审计轨迹的不一致状态。Step 12 在 reload 路径上保持同模板。

#### 3. 双路径分发 + originInstance 自环去重（Step 8-9 Notification）

In-memory NotificationAdapter 的 publish 同时走"本地 in-process subscriber"与"测试 probe"两路径。如果同一进程内既有 publisher 又有 subscriber，会出现自我接收的回环。决断：每个 Adapter 实例分配唯一 originInstance ID，subscriber 收到自家发出的消息时静默丢弃。这条规则在 Step 9 Kafka Adapter 接入真实 broker 时不变形——Kafka 自身不会"自我接收"。

#### 4. probe pattern（贯穿全 Phase）

Adapter 的可观测性原语（contract probe）严格只读 + 仅在测试包暴露 + 不能让 production 代码消费。这条规则在 Step 13 引入 ExternalEngineContractProbe 时进一步收紧：probe 不仅是只读，还必须有 `__xxxProbe: true` 品牌字段防止类型混淆。

#### 5. 401-599 timeout 数字回避（Step 14 §G 实战）

External Engine 错误转译纪律严禁 raw HTTP status 泄漏，正则 `\b[45]\d\d\b` 守卫。但实战发现 timeout 配置 `totalMs: 500` 会被这条正则误伤（500 像状态码）。决断：所有 timeout 数字（如 200/300/1000）避开 400-599 区间。Step 15-17 全 contract mount 继承。

#### 6. 元数据修复 vs 根本性整理（Step 15 §E + Step 19）

Step 14 的 `rootDir: "."` + `include: ["src/**", "test/**"]` 让产物落在 `dist/src/`，main/types 必须用绕路写法 `dist/src/index.js`。Step 15 首次以 workspace:\* 消费时发现 + 用最小修复（仅改 main/types），把"根本性整理"留到 Step 19。Step 19 把 6 个 Adapter 包统一迁回 `rootDir: "src"` + 测试文件平铺到 src/，与 Sprint B-D 既有 Adapter 风格对齐。这是 Phase 8 内**唯一一次**正式的代码迁移。

#### 7. Convention L 弹性应用（Step 17）

读取型 Engine（mark-price 纯读 / fund 读为主）业务方法少，自有测试相应少 = 正确的精炼。决断：不强制打满 10 个 it 上限；剩余 slot 留空 = 克制 > 堆砌。这条裁决让 Sprint E 5 业务 Engine 自有测试总数 = 9 + 10 + 10 + 8 + 9 = 46 个 it，呈现"业务复杂度决定测试规模"的自然形态。

#### 8. KNOWN-ISSUES.md 显式登记机制（Step 18）

Phase 8 收官前发现部分 KI 项无法在 Phase 8 内解决（Phase 11+ 真实基础设施 / Phase 9 domain 边界覆盖等）。决断：建立 `docs/KNOWN-ISSUES.md` 显式登记机制，每条登记必须含数值 / 修复责任 Phase / 修复责任 Step（若已确定）。这避免了"模糊措辞掩盖未达项"的反模式。Phase 8 收官时 5 项 KI 登记，4 项 open（Phase 9-11 修复），1 项已修复（Step 19 KI-P8-004）。

## Consequences

### 正面

- **Adapter 替换原则（§3.7）通过 Step 18 集成测试运行时验证**：4 套集成测试用同一份"thin application-layer-style consumer"驱动 memory / sqlite / postgres 三个 EventStore + memory / kafka 两个 Notification + memory / file 两个 Config，证明切换零业务代码改动。
- **21 个 workspace 包，每个职责单一、契约稳定**：8 → 21 包扩张，零职责合并，零跨包代码共享（基座除外）。
- **1668 测试，覆盖率 86%/80%/95%/86% 全面达标**：从 Phase 1-7 收官时的 1106 增加到 1668（+562），覆盖率门槛 80%/75% 达标且每包数据有据可查。
- **5 个业务 Engine 模板复制 5 次成功**：margin → position → match → mark-price → fund 同形结构呈现"按模板填空"特征，证明工程纪律可批量传承。
- **33 个错误码全部按层级隔离与诊断分离原则永久固化**：TQ-INF 18 个 + TQ-CON 14 个 + TQ-SAG 1 个，命名空间清晰，新增不冲突。

### 负面 / 待改进

- **domain 75.16% 行覆盖率略低于整体**（KI-P8-001 → Phase 9）：domain 是 Phase 1-7 冻结代码，Phase 8 没有触动其测试；Phase 9 引入新业务流时应同步补 domain 边界覆盖。
- **postgres / kafka 真实基础设施集成未在 CI 中验证**（KI-P8-002 → Phase 11）：本 Phase 阶段允许 mock，Phase 11 起按 §8.1 必须接入真实集群。
- **偶发时序敏感 flake**（KI-P8-003 → Phase 9 / 11）：契约测试与集成测试在高并发下偶发失败，根因是 100ms 级别熔断 reset 时序断言敏感度。

### 中性

- **ports 0% 行覆盖率**（KI-P8-005，结构性现象）：ports 包是纯类型定义 + brand constructor 组合，类型在编译时擦除，runtime 行只有 brand constructor（由 ports 消费方间接覆盖）。不需要修复；登记仅为澄清 0% 数字的语义。

## Alternatives Considered

### 1. 是否引入 zod / joi / ajv 做 schema 校验？

**拒绝**。理由：每个 Adapter 的 response shape 都不同（Margin 4 字段 / Position 5 字段嵌数组 / Match 5 字段含 enum / Fund 4 字段含 enum / MarkPrice 3 字段），手写 parser 共 ~550 行，每个 parser ~30-40 行，可读性极强。引入 zod 等于多一个第三方依赖（违反元规则 G "无可手写替代"准入条件），换来的是声明式语法但失去对 reason 域 moniker 的精确控制。

### 2. 是否引入 opossum / p-retry / bottleneck 等成熟稳定性库？

**拒绝**（Step 14 实战）。理由：基座的五件套需要在错误转译层严格控制 reason 域 moniker（永不泄漏 raw HTTP status / 网络错误名），第三方库的错误形态不可控且会泄漏内部细节。手写五件套共 ~600 行，行为可控、错误转译可精确，符合宗旨"短路径 > 泛化能力"。

### 3. 是否扩展 Step 13 契约到业务方法层（建立 defineMarginEngineContractTests 等）？

**拒绝**（META-RULE P 直接规定）。理由：契约测试的目的是"跨实现共享验证"，但每个业务方法只有一个实现，跨实现共享无意义。给每个业务 Engine 建一个契约函数等于把"业务方法等同于一种独立的稳定性契约"，会模糊"稳定性 vs 业务逻辑"的边界。Step 15 / 16 / 17 五业务 Engine 各自只用上层自有测试，不建立业务方法契约函数。

### 4. 是否在 Sprint A 把 testkit 拆成 testkit-core + testkit-event-store + testkit-notification + ...？

**拒绝**。理由：拆包会引入跨包依赖管理成本，但每个 Phase 8 Sprint 的契约函数都不大（21 / 18 / 21 / 21 个 it），合并到一个 testkit 反而便于读者一站式查阅。元规则 D（testkit 依赖边界 \{contracts, ports, shared\}）在合并形态下也容易守住。

### 5. 是否把 Sprint E 5 业务 Engine 合并成一个"engine-pack" 包？

**拒绝**（META-RULE F 严格反对）。理由：合并即破坏单职责原则，一个业务 Engine 的 wire 改动会传播到其他 Engine 的 production 包。Sprint E 同步落地两个 Adapter（Step 16 / 17）正是 META-RULE F 的实战压力测试——零相互 import / 零共享 helper / 零共享 mock 实例。

## References

- 《Tianqi 项目架构与代码规范总文档》§3 / §6 / §22
- 《Tianqi Phase 8–12 架构与代码规范补充文档》§3 / §5 / §6 / §9.3
- `docs/phase8/01-19` 共 19 份执行记录
- `docs/phase8/19-phase-8-closure.md`（Phase 8 收官记录 + 完整组件清单）
- `docs/KNOWN-ISSUES.md`（Phase 8 5 项未达项登记）
- `packages/adapters/README.md`（13 个 Adapter 入驻表）
- `CHANGELOG.md`（Phase 8 高层级变更摘要）
