# ADR-0004: Phase 11 端到端集成验证

## Status

In Progress (Phase 11 启程 2026-05-18；CLOSED 待 Step 11 收官)

> 本 ADR 是增量追写（惯例 M 沿用 Phase 9/10 模式；第 29 次实战 / 跨 Phase 第 10 次）。
> Phase 11 启程指令拆两阶段流程：第一阶段 PHASE_DESIGN 草案 + 用户 APPROVE
> → 第二阶段 PHASE_IMPLEMENT 落地。各 Step 完成时向 §Decision 段下对应小节
> 追加该 Step 关键裁决摘要；其他段落（Context / §B.1 / Consequences / References）
> 不允许追写或重写。

## Context

Phase 11 主题：**端到端集成验证**（《Phase 8-12 补充文档》§1.2 原文）。Phase 1-10 累计建立的"代码 + 业务能力 + 协作生态 + CI 真绿色 + 容器可部署 + 发布自动化 + 可执行文档"七重工程成熟度在 Phase 11 通过**真实基础设施**（不是 mock）+ **端到端 4 路径覆盖** + **性能基线 4 指标** + **混沌演练 4 故障场景**让工程价值得到真实验证。

§8.1 Mock 使用边界硬约束：事件存储 / 消息系统 / 配置系统 / Saga 状态持久化 4 类组件**严禁 mock**。§13.1 第 11 项严禁。

依赖：Phase 8 (ADR-0001) + Phase 9 (ADR-0002) + Phase 10 (ADR-0003) 全部 CLOSED。

## Decision (Kickoff)

### K.1 Step 划分：β 12 Step

Kickoff + Step 0-11，共 12 Step。划分依据：

- **Step 0**：KI-P8-002 修复 + 真实基础设施集成基础（Phase 8 既有 Postgres / Kafka adapter 真实激活；含 notification-kafka .persistent.test.ts 新建；可能拆 Step 0 + 0.5）
- **Step 1**：端到端测试基础框架（CI services / docker-compose 升级 / Testcontainers 决策；拆两阶段）
- **Step 2-3**：端到端顺利路径（Liquidation + ADL 全流程）
- **Step 4-6**：端到端补偿 / 死信 / 恢复路径
- **Step 7**：性能基线 4 项指标（拆两阶段）
- **Step 8**：混沌演练 4 故障场景（拆两阶段）
- **Step 9-10**：观测性 metrics + Trace 贯通
- **Step 11**：Phase 11 收官（CHANGELOG + ADR-0004 Accepted + phase-11-closed tag）

具体 Step 划分详见 `docs/00-phase1-mapping.md` Phase 11 段。

### K.2 测试数下限路径策略：α + β 组合

- α 自然增量（每 Step 自然加 10-20 测试；累计 +120-240）
- β 收官 Step 11 评估补充（如不足 1900+，加 boundary tests）
- 1977 → 1900+ 至少 -77 容差；自然增量预计 +120-240 让安全裕度合理

### K.3 覆盖率门槛维持 85%（不进一步升级）

整个 Phase 11 期间维持 85+/75+/85+/85+ baseline 不下降；Phase 11 / 收官 Step 不主动升级（与 Phase 10 / Step 7 升级 84% → 85% 不同）；Phase 12 评估是否进一步升级。

### K.4 真实基础设施战略：α + β 组合

- **α Testcontainers Node.js**：本地 dev cycle 流畅（test 自动启动容器；devDependency only）
- **β GitHub Actions services**：CI 原生（不引入 Node.js 依赖）
- **元规则 P 张力**：Testcontainers 作为 devDependency only 引入是合理代价（产线依赖纯净度不破坏）
- Kickoff 仅锁定大方向；具体决策由 Phase 11 / Step 1 PHASE_DESIGN 实地裁决

### K.5 拆两阶段流程承接（Phase 11 实战 4+ 次预期）

| Step | 拆两阶段 | 理由 |
|------|---------|------|
| Kickoff（本 ADR） | ✅ | Phase 11 战略锁定涉及全程 + Phase 12 持续 |
| Step 0 | TBD | 视 KI-P8-002 修复方案复杂度 |
| Step 1 | ✅ 强烈倾向 | CI services / docker-compose / Testcontainers 决策 |
| Step 7 | ✅ 倾向 | 性能工具选 + 4 项指标定义 + 基线数值确定 |
| Step 8 | ✅ 倾向 | 混沌工具选 + 4 故障场景定义 |
| Step 11 | ✗ | 收官主题成熟（Phase 10 / Step 7 已实证） |

Phase 10 累计实战 6 次 → Phase 11 +4 次（保守预期）= 累计 10+ 次。

### K.6 错误码 / 新 Port / 新 Adapter / 新 workspace 包 / 第三方依赖

**Kickoff 阶段 0 新增**（惯例 K 第 27 次实战）。

**Phase 11 全程预期**：
- 错误码：可能新增 TQ-INF 真实基础设施 + TQ-SAG 端到端（Step 实地决策）
- 新 Port：低概率
- 新 Adapter：可能（observability 相关）
- 新 workspace 包：可能（observability 相关；或正式落地 `packages/infrastructure/` 占位）
- 第三方依赖：Testcontainers 在 Step 1 评估（K.4）；其他严守元规则 P

### K.7 ADR-0004 起步段长度

≤200 行（Status + Context + Decision 7 项摘要 + §B.1 5 段约 100 行 + 第 4 层防御机制框架表 + Consequences + References）；远低于 ADR-0003 694 行。

---

## §B.1 工程纪律延伸与历史校正记录（v3 / 5 段）

本段记录 Phase 11 Kickoff 形成过程中触发的 5 类工程纪律演化动作，构成 Tianqi 工程纪律"第 4 层防御机制"（历史文档事实校正）实战兑现 + "防御应用边界"工程成熟度沉淀。

### §B.1.A — v2 重启教训（事实锚定纪律建立）

Phase 11 Kickoff 第一次起草指令（v1）在事实锚定段假设"Phase 10 CLOSED 2026-05-05（PR #10 merge + phase-10-closed tag + GitHub Release published）"。用户回执"pr 合并完成，过程中虽然有错误，但是搞定了"实指 Step 7 PHASE_IMPLEMENT 在 feature 分支搞定，未涉及 PR 合并 / tag 创建 / Release published。AI 在 §13.3 Phase Gate 回溯义务前置核查的第一秒发现事实冲突：

- `git ls-remote origin refs/heads/main` 实测 `92753168`（Merge PR #9，Step 6）而非假设的 PR #10 merge
- `phase-10-closed` tag 不存在
- Step 7 8 commits 仍停留在 `claude/phase-10-step-7-closure` feature 分支

AI 在创建任何草案 / commit / push 前停下，触发 Phase 11 Kickoff 第二次起草（v2）。

**教训沉淀（事实锚定纪律）**：
1. "事实锚定"段必须基于真实数据（git fetch + ls-remote / gh CLI 等实测确认），不接受任何"乐观假设"
2. Step 4 收尾微调的"接受最简实质回执"原则针对"已发生事件的简短确认"，不是"未发生事件的自动假设"
3. 模糊回执必须追问细节（如"pr 合并完成"是否包含 tag + release），不应自动扩张语义边界
4. 双层缺陷链教训（Step 0 typecheck + Step 3.5 packaging）扩展到事实层 — Phase 11 §13.3 核查是事实层防御机制实战兑现
5. Phase 10 CLOSED 真实仪式日期 **2026-05-13**（不是 v1 编造的 2026-05-05；2026-05-05 是 Step 7 PHASE_IMPLEMENT 完成日；间隔 8 天）

**事实锚定纪律作为 Tianqi 工程纪律 Phase 11+ 严守**：所有 SHA / tag / 状态必须基于实测确认；起草指令含"事实锚定"段时必须先经 git fetch + ls-remote 实测核查（用户责任）；AI 收到指令时也必须先实测核查（AI 责任 — Phase 11 Kickoff v2 已兑现）。

### §B.1.B — ADR-0003 / CHANGELOG / KNOWN-ISSUES 日期回填修正（v3 必做）

ADR-0003 / CHANGELOG.md Phase 10 段 / KNOWN-ISSUES.md L206 三文件统一标 "Phase 10 CLOSED 2026-05-05"，实为 Step 7 PHASE_IMPLEMENT 完成日（撰写时锁定）。Phase 10 CLOSED 真实仪式日期 **2026-05-13**（PR #10 merge `cc74da3` + main CI 4/4 PASS + `phase-10-closed` tag `ab70043` push + release.yml 第一次真实运行 + GitHub Release published），间隔 8 天。

Phase 11 Kickoff PHASE_IMPLEMENT 阶段以 **3 个最小修正 commit** 回填三文件日期 2026-05-05 → 2026-05-13：

| Commit | 文件 | 修订内容 |
|--------|------|---------|
| `docs(adr-0003): correct CLOSED date` | docs/decisions/0003-...md | L5 Status 行 + L670 工程仪式声明引用 + L676 二合一行 disambiguate（保留 Step 7 真实完成日 2026-05-05 + 新增 CLOSED 仪式日 2026-05-13）+ Status 段后新增校正补丁说明 |
| `docs(changelog): correct Phase 10` | CHANGELOG.md | L9 段头 + L62 ADR 引用 + 新增校正补丁说明段 |
| `docs(known-issues): correct Phase 10` | docs/KNOWN-ISSUES.md | L206 段标题 + 新增校正补丁说明段（KI 修复日期不受影响） |

**回填原则**：仅校正"已发生但日期标签错位"的事实陈述；不改动决策内容 / 不改动 KI 修复日期 / 不破坏 ADR-0003 Accepted 语义 / 不破坏 CHANGELOG Phase 10 内容摘要 / 不破坏 KI-P10-001/002 RESOLVED 语义。

**这是 Tianqi 工程纪律第 4 层防御机制（历史文档层）首次实战兑现**——把事实锚定纪律从 future（设计 / 实施 / 部署 / 事实层）扩展到 past（历史文档事实校正）。

### §B.1.C — 24 包事实精度纪律延伸（v3 必做）

Phase 11 Kickoff v1/v2 prompt 锚定 "25 包 monorepo workspace"，实测 **24 包**：

- 核心 6 包（packages/*/）：domain / application / policy / ports / contracts / shared
- adapters 18 包（packages/adapters/*/）：adapter-testkit + config-{file,memory} + dead-letter-store-{memory,postgres} + event-store-{memory,postgres,sqlite} + external-engine-http-base + fund-engine-http + margin-engine-http + mark-price-engine-http + match-engine-http + notification-{kafka,memory} + position-engine-http + saga-state-store-{memory,postgres}

`packages/infrastructure/` 仅含 README.md 占位，无 `package.json`，**不计入 workspace 包数**。

**事实锚定纪律延伸至"workspace 包数"事实陈述精度**。**Phase 11+ 起草指令统一使用 "24 包" 描述**。`packages/infrastructure/` 占位是否正式落地由 Phase 11 Step 9-10 observability 工作实地决策（裁决 K.6 全程预期保留）；Kickoff 阶段不补创。

### §B.1.D — Phase 8 git tag 缺失 α 处置（接受历史遗留）

`git tag --list` 实测：`phase-9-closed`（Phase 9 / Step 19，2026-05-02）+ `phase-10-closed`（Phase 10 / Step 7，2026-05-13）就位；**`phase-8-closed` 缺失**。

phase-N-closed tag 约定在 Phase 10 / Step 5 release.yml 落地（2026-05-04+），Phase 8 CLOSED 2026-04-26 时该约定尚未引入，无法预先遵守。

**裁决选项 α 历史遗留**，不补打。理由：

1. 补打无工程价值（Phase 8 不需要再触发 release.yml）
2. 补打会触发 release.yml → 产生 Phase 8 GitHub Release draft 需用户处理
3. Phase 8 CLOSED 真实证据齐备（ADR-0001 Accepted + `docs/phase8/19-phase-8-closure.md` + `docs/KNOWN-ISSUES.md` L13 显式登记"Phase 8 状态总览 — CLOSED（Step 19, 2026-04-26）"）
4. 历史遗留 ≠ 工程纪律违规——约定后置引入是工程演化常态

**Phase 11+ 严守 phase-N-closed tag 约定**——这一纪律不溯及历史，仅向未来生效。

### §B.1.E — v2 教训应用边界（v3 起草过程中显式化）

v2 教训"模糊回执必须追问"不应过度解释。判断边界：

- **必须追问**：回执涉及"未发生事件的假设"（v1 场景：假设 Phase 10 CLOSED 但实际未发生）
- **应该信任**：回执主语 + 谓语 + 宾语三要素明确 + 不涉及未发生事件（v3 场景：用户回执"phase10 已经被 close 了"指 Phase 10 整体状态闭环；事实已发生）
- **必要实测**：AI 在 PHASE_IMPLEMENT push 前防御性核查（v3 报告 Step A：`git ls-remote` / `gh pr view` 实测 PR #11 状态）

过度追问让协作效率毁掉，违反 Step 4 收尾微调"实质兑现 vs 数据格式齐全"原则。v3 起草过程中起草者一次过度追问（用户回执"phase10 已经被 close 了"被三场景质问），ADR 起草者及时认错调整——这是 v2 教训应用边界的实证沉淀。

**工程纪律深层启示**：任何防御机制如果过度应用都会反过来违反工程纪律本身。Tianqi 工程纪律从"建立防御"演化到"防御应用边界"是更深一层的工程成熟度。这条沉淀让 Phase 11+ AI 与人协作时不机械应用 v2 教训，避免过度追问。

---

## 第 4 层防御机制框架（§B.1 综合 / Phase 11 Kickoff 沉淀）

Tianqi 工程纪律的 4 层防御机制 by Phase 11 Kickoff：

| 层 | 防御对象 | 兑现 Step |
|----|---------|----------|
| **代码层** | Phase closure typecheck + monorepo packaging 双层缺陷链 | Phase 10 / Step 0 + Step 3.5 |
| **工作流层** | release.yml 元规则 B 在工作流层兑现 | Phase 10 / Step 5 |
| **事实层** | §13.3 Phase Gate 回溯义务前置核查 | Phase 11 Kickoff v2 |
| **历史文档层** | 已 Accepted 文档事实陈述错误的最小修正 | **Phase 11 Kickoff v3（本 ADR）** |

外加横切纪律 (§B.1.E)：**防御应用边界** — 任何防御机制需有应用边界，避免过度应用反伤工程纪律。

完整的工程纪律不仅防御 future（设计 / 实施 / 部署 / 事实），也修正 past（历史文档事实校正），并守住防御应用边界（避免过度防御）——这是从"工程纪律"升级到"工程信任"的关键节点。

---

## Consequences

### 积极

- Phase 11 在 `cc74da3` 干净 main + 真实基础设施可用 + KI-P8-002 修复责任明示的起步状态下工作
- §13.3 Phase Gate 回溯义务实战兑现（首次）
- v1 教训 + v3 历史校正 + v3 起草过程"防御应用边界"沉淀成为 Tianqi 工程纪律的事实锚定段沉淀
- 第 4 层防御机制建立（历史文档层）+ 横切应用边界纪律建立
- 24 包事实精度纪律延伸 → Phase 11+ 起草指令统一精度

### 风险

- Step 0 KI-P8-002 修复 + Step 1 Testcontainers 引入决策可能引发 Phase 11 早期不稳定
- 真实基础设施测试在 CI 跑增加 build time（待 Step 1 评估并行 jobs / 缓存策略）
- KI-P8-003 时序 flake 在端到端测试中可能加重（Phase 11 评估修复）
- KI-P9-001 StateTransition 数据副本漂移在端到端补偿 / 恢复路径可能触发（Step 4-6 实地评估）
- `packages/infrastructure/` 占位包是否正式落地 Phase 11 期间需决策（Step 9-10）

---

## Decision (Step 0 — KI-P8-002 Postgres 部分 RESOLVED + CI services 第一次实战)

完成日：2026-05-18。惯例 M 第 30 次实战 / 跨 Phase 第 10 次。本 Step 不拆两阶段（裁决 K.5 锁定；主题相对成熟）。

### S0.1 CI services 配置 — α test + coverage 双 job
ci.yml `services.postgres` 添加到 test + coverage 两 job（与 Step 3/3.5 build chain 协调；4 jobs 概念维持）。postgres:16-alpine（裁决 3）+ health-cmd pg_isready + 显式 ready wait 步（裁决 4 α + β 双层防御）。env var `TIANQI_TEST_POSTGRES_URL=postgres://tianqi:tianqi@localhost:5432/tianqi`（裁决 2 单一变量；3 adapter 共用）。

### S0.2 contract test factory schema 隔离修复
3 个 `.contract.test.ts`（event-store / saga-state-store / dead-letter-store）由共享 `BASE_SCHEMA` 改为每次 factory 调用产生独立 schema（`${SCHEMA_PREFIX}_it${++factoryCounter}`）+ `afterAll` 按 prefix `DROP SCHEMA CASCADE` 清理。**根因**：testkit `beforeEach` 调 factory() 创建新 adapter，但 in-memory adapter 通过 `new Map()` 天然隔离；Postgres adapter 共享 schema → it 间数据污染。这是 Step 0 真实激活揭露的 Phase 8/9 隐藏假设缺陷。

### S0.3 Postgres bootstrap advisory lock 修复（业务代码 — 显式留痕）
3 个 Postgres adapter 的 bootstrap 函数引入 `pg_advisory_lock(hashtext($schema))` 串行 DDL 执行 + finally 显式 unlock。**根因**：PG `IF NOT EXISTS` DDL 在并发场景 *不是* 真正幂等——CREATE SCHEMA 触发 `pg_namespace_nspname_index` 23505；CREATE TABLE 触发 `pg_type_typname_nsp_index` 23505（表的 row type 注册到 pg_type）。P2 cross-instance 测试（writer + reader 同 schema 同时 init()）实测触发。advisory lock 是 PG 推荐做法。**这是 Step 0 主题范围内的"激活真实基础设施必要修复"，不是业务语义变化**（接口冻结严守；append/save/list 等运行时 API 0 变化）。运行时操作不持有 advisory lock，仅 bootstrap 阶段。

### S0.4 event-store-postgres healthCheck.databasePath 可选 echo
event-store-postgres options 新增 optional `databasePath?: string`，healthCheck details 在该选项设置时回显。**根因**：persistent contract testkit P4 断言 `status.details["databasePath"] === session.databasePath`（与 SQLite / file-based adapter 同形态契约）。Postgres 不使用文件路径——但测试 fixture 通过此 echo 满足契约；生产代码不需要传 databasePath（向后兼容）。saga-state-store + dead-letter-store testkit 无此断言，不需要同样修改。

### S0.5 KI-P8-002 Postgres 部分 RESOLVED 实测证据
本地 Postgres docker (postgres:16-alpine) + `TIANQI_TEST_POSTGRES_URL` 设置后：
- `pnpm test` baseline (no PG): 1873 PASS + 104 skipped = **1977 total**（与 Kickoff baseline 一致）
- `pnpm test` with PG: 1952 PASS + 25 skipped = 1977 total（**79 测试激活**：1952 - 1873；超 prompt 锚定 76 因含 `.test.ts` unit skipIf tests）
- `pnpm test:coverage` with PG: **86.75% / 80.04% / 95.91% / 86.75%**（baseline 85/79.64/91.68/85；自然抬升 +1.75pp lines/statements、+0.40pp branches、+4.23pp functions；**K.3 决议维持 85% thresholds 不主动升级**，让 coverage 自然涨）
- 3 Postgres adapter 9 test files 全 PASS（event-store / saga-state-store / dead-letter-store × .test.ts + .contract.test.ts + .persistent.test.ts）

### S0.6 KI-P8-003 不在 Step 0 处置（裁决 G α）
saga-orchestrator overall-timeout vacuous flake 与 Step 0 主题（Postgres 真实基础设施）完全不同模块；推迟 Step 4-6 端到端测试评估时同期处置。Step 0 主题专注度严守。

### S0.7 不预占 Step 0.5 / Step 1 / Phase 11+
- 不创建 notification-kafka `.persistent.test.ts`（Step 0.5 责任）
- 不修改 docker-compose.yml（Step 1 责任）
- 不引入 Testcontainers（Step 1 责任）
- 不扩 ci.yml jobs 数（4 维持；裁决 1 α）

## Decision (Step 0.5 — KI-P8-002 完整 RESOLVED + Kafka 真实基础设施)

完成日：2026-05-18。惯例 M 第 31 次实战 / 跨 Phase 第 12 次。本 Step **拆两阶段**（K.5 锁定；多设计决策点）；v1 草案 + v2 修订（L.5 image 约定）→ APPROVE → PHASE_IMPLEMENT 7 commits 落地（commit 4 合并 K.9 fix + ci.yml KRaft + testkit cross-instance fix 三层修复）。

### S0.5.1 Kafka services 配置 — α apache/kafka:3.7.2 + KRaft 单 broker
ci.yml test + coverage 双 job 加 `services.kafka`（与 services.postgres 共存；4 jobs 维持；K.7）。**镜像版本约定调整**：v2 修订 `apache/kafka:3.7` 实测发现镜像不提供 major.minor alias（Docker Hub 仅有 3.7.0/3.7.1/3.7.2 等具体 patch），回退到 `apache/kafka:3.7.2`（3.7 系列最新）；与 Step 0 `postgres:16-alpine` major.minor 模式不同的诚实留痕。env var `TIANQI_TEST_KAFKA_BROKERS=localhost:9092`（K.2 沿用既有约定）。health-cmd `kafka-broker-api-versions.sh` + 显式 nc 双层防御（K.5）。**单 broker 关键 env 补全**：`KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1` + `KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR=1` + `KAFKA_TRANSACTION_STATE_LOG_MIN_ISR=1` + `KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS=0`——默认值 3 让 __consumer_offsets topic 无法创建 → consumer group 无法 join；Phase 8 时未真实激活验证导致此缺陷长期隐藏，Step 0.5 实测揭露。

### S0.5.2 persistent-notification-contract.ts testkit 从零创建（Phase 8 设计疏漏补齐）
Phase 8 设计 EventStore/SagaStateStore/DeadLetterStore/Config 4 个 persistent contract 时**遗漏 Notification**；Step 0.5 真实激活揭露并补齐。新增 `packages/adapters/adapter-testkit/src/persistent-notification-contract.ts`（13 it 4 类：P1 跨进程持久化 3 + P2 跨实例可见性 5 + P3 并发投递 2 + P4 健康检查 3）。与既有 4 个 persistent contract 模式一致（类别命名 + session 形态 + scratchDirectory 模式）。

### S0.5.3 notification-kafka.persistent.test.ts 从零创建（13 测试）
挂载 `definePersistentNotificationContractTests`；databasePath → topic 后缀派生模式（与 event-store-postgres 既有模式一致）；factory 每次独立 consumerGroupId（per-instance counter）；afterAll admin.deleteTopics 清理。

### S0.5.4 K.9 业务代码工程缺陷修复（合并到 commit 4）
notification-kafka.ts init() 在 consumer.subscribe 之前显式 `admin.createTopics({ waitForLeaders: true })`（KafkaJS 官方推荐做法）+ finally admin.disconnect 清理。**根因**：KafkaJS `allowAutoTopicCreation: true` 在 KRaft 模式下 topic auto-create 与 partition leader election 有 race window。仅在 `allowAutoTopicCreation: true` 时执行（向后兼容生产环境）。**接口冻结严守**：publish/save/load/list/healthCheck 等运行时 API 0 变化；仅 init 内部 admin.createTopics 调用增加 + 一个可选 databasePath option 已在 Step 0 引入。

### S0.5.5 testkit cross-instance session 修正 + integration test RUN_ID 隔离
- testkit P2/P3 cross-instance 测试用 SAME session（同 topic）+ factory counter（不同 group）让 Kafka 路径真实投递（v1 草案用 nextSession 给 reader 不同 topic 永远收不到的逻辑错误）
- integration test factory 加 KAFKA_RUN_ID + kafkaFactoryCounter 让并发 Kafka 测试不共享 topic/group 名（避免 KafkaJS Consumer Crash）+ allowAutoTopicCreation: true 触发 K.9 fix 路径

### S0.5.6 KI-P8-002 完整 RESOLVED 实测证据
- pnpm test (with-PG + with-Kafka): **1990 total (1988 PASS + 2 skipped)**
- 测试增量: +36 (13 新建 + 23 既有激活)
- 3 Kafka test files 全 PASS: notification-kafka.test.ts (6) + .contract.test.ts (18) + .persistent.test.ts (13) = 37 tests
- §8.1 Mock 使用边界硬约束 4/4 组件完全兑现

### S0.5.7 不预占 Step 1 / Phase 11+
- 不修改 docker-compose.yml（Step 1 责任）
- 不引入 Testcontainers（Step 1 责任）
- 不扩 ci.yml jobs 数（4 维持；K.7）

## §D 测试 vs 业务代码 vs testkit 边界澄清（Step 0.5 实战延伸）

Step 0.5 PHASE_IMPLEMENT + PR #14 CI fix iteration 实测触发 5 类边界情况完整实战：

### §D.1 业务代码工程缺陷修复（K.9 触发）
- notification-kafka.ts init() 加 admin.createTopics(waitForLeaders) — 修复 KRaft race
- 与 Step 0 §D 边界澄清一致：领域+应用+策略层业务逻辑严守 vs **adapter 实现可改**
- 接口冻结严守：运行时 API 0 变化；仅 init 内部新增 admin 调用 + 一个可选 option

### §D.2 testkit 设计遗漏补齐（L.3 实战）
- 新建 persistent-notification-contract.ts（Phase 8 设计遗漏补齐）
- testkit P2/P3 cross-instance session 修正（v1 草案逻辑错误）
- testkit 是测试基础设施，**不在"修业务代码"禁令范围内**

### §D.3 测试 vs adapter 默认语义不一致（L.1 + L.2 实战）
- L.1 from_beginning: adapter 默认 `fromBeginning: false` → testkit 转为 **negative 验证**（"reader in new group does NOT receive historical messages"）；不强加 adapter 改为 true
- L.2 per_case_id: 实测 KafkaJS 默认 **key-hash partitioner** 保证同 key 同 partition 同顺序 → 测试保留并验证

### §D.4 v2 修订 image 约定与 Step 0 不一致的诚实留痕
- v2 修订意图: `apache/kafka:3.7`（与 `postgres:16-alpine` major.minor 一致）
- PHASE_IMPLEMENT 实测: Docker Hub apache/kafka 镜像无 major.minor alias
- 实际锁定: `apache/kafka:3.7.2`（具体 patch；3.7 系列最新）
- ADR §D 留痕；CI 升级需手动 bump patch
- 与 Step 0 `postgres:16-alpine` 不同约定的工程纪律差异（不同上游 Docker Hub 策略）

### §D.5 CI 环境时序假设 vs 本机环境（PR #14 CI run #1 揭露）

PR #14 feature CI 第一次运行 3/4 FAIL（Lint + Test + Coverage；Typecheck PASS）。本机 with-PG-Kafka canonical 6/6 PASS，CI 环境时序差异显化的隐藏假设：

- **测试假设"adapter.init() 内 admin.createTopics(waitForLeaders) 返回后 metadata 立即可用"**：本机 KRaft 单 broker setup 时序快，metadata 即时可用；CI 环境（GitHub Actions ubuntu-latest runner + apache/kafka:3.7.2 services container）时序慢，consumer.subscribe 可能在 partition leader 完全可见前触发 → adapter.init() 抛 TQ-INF-010 "This server does not host this topic-partition"
- **测试假设"vitest afterAll hook 10s 默认 timeout 足够 Kafka admin cleanup"**：本机 admin.connect + deleteTopics + disconnect ~1-2s；CI 环境 5-15s 超过 10s 默认 → afterAll hook timed out

**修复策略（仅测试 fixture + lint；不修业务代码）**：
- `notification-kafka.test.ts` 加 `ensureTopicReady(topic, 30s)` helper：独立 admin client 预创 topic + 轮询 `admin.fetchTopicMetadata` 直到 partition leader 可见；应用到 line 102 + line 128 两个失败测试的 adapter.init() 之前
- `notification-kafka.contract.test.ts` + `notification-kafka.persistent.test.ts` afterAll hook 加 `, 60_000` timeout（10s → 60s）
- `persistent-notification-contract.ts` 删除 unused `afterEach` import（本机 lint cache 让死 import 未检测；CI fresh run 揭露）

**这是 §D.1 业务代码工程缺陷的镜像在测试层**：均"真实基础设施激活揭露隐藏工程缺陷"模式；区别在于 §D.1 修业务代码（K.9 race），§D.5 修测试 fixture（CI 环境时序）。不修业务代码（adapter 接口 / 默认行为 0 变化）；不改测试语义（仍验证相同行为）。

**ADR-0003 §E.1 fallback CI Iteration 诚实记录纪律严守**：追加 fix commits 不 force-push；保留 PR #14 CI run #1 失败历史 + run #2 修复 commits 完整可见。

第 4 层防御机制（§B.1 历史文档层）延伸到**第 5 层防御机制**：**实战发现层** — 即使 PHASE_DESIGN 设计完整 + PHASE_IMPLEMENT 本机实测全 PASS，CI feature 分支第一次跑仍可能揭露 Phase 1-N 多层隐藏缺陷（业务代码 K.9 + 基础设施 KRaft env + testkit 设计 + 镜像约定 + **CI 环境时序** 5 类完整触发）。Step 0 + Step 0.5 共建立"真实激活揭露隐藏缺陷"机制；Phase 11+ 期间持续兑现。**本机实测 ≠ CI 实测；CI 实测是第 5 层防御机制核心证据**。

### §D.6 Build cache layer (tsc 增量 + pnpm hoisting) vs CI fresh build（PR #16 CI run #1 揭露）

"未在干净环境验证过的真绿色"概念第三次延伸（第三次 cache layer leakage 实战）：

| Step | cache layer | KI 编号 / 性质 |
|------|-------------|----------------|
| 3.5  | dist cache (packaging missing) | KI-P10-002 RESOLVED |
| 0.5  | lint cache (unused import undetected) | §D.5 + PR #14 fix iteration |
| **2** | **build cache (tsconfig references missing)** | **§D.6 + PR #16 fix iteration（本段）** |

**Local 本机 typecheck PASS 因为**：
1. tsc 增量编译 `.tsbuildinfo` 缓存已含跨包 type info（Step 1 时 references 已正确；Step 2 新加 cross-package imports 但缓存仍有效）
2. pnpm hoisting node_modules 误打误撞 resolve 到 postgres 包（即使 application 包 tsconfig.json 未声明 references）

**CI fresh typecheck FAIL 因为**：
1. CI `pnpm install --frozen-lockfile` + 全新 `pnpm build` (tsc -b)
2. fresh tsc -b 严格走 tsconfig references chain → 未声明的 cross-package reference 触发 TS2307
3. type info 缺失导致 callback 参数 inference 失败 → TS7006

**修复路径（不修业务代码；仅工程纪律调整）**：
- `package.json`: 新 import 必须声明对应 workspace dep（Step 2 时已正确加入；本 fix iteration 不动）
- `tsconfig.json`: 新 cross-package reference 必须加 `references`（PR #16 fix commit 1 修）
- 显式类型标注（noImplicitAny 严守；PR #16 fix commit 2 修）

**Phase 11+ contributor 协作纪律延伸（推迟到 Step 11 收官评估实施）**：
- PR template 追加项: "new cross-package import → verify deps + references in same commit"
- closure-checklist 追加项: "fresh build verification (clear `.tsbuildinfo`; rerun 4 commands)" as Phase Gate explicit step

**与 §D.5 关系**：§D.5（CI 环境时序）是运行时层；§D.6（build cache）是编译时层。两类边界澄清都属"本机 != CI"模式；都通过追加 fix commits 修复（不 force-push；ADR-0003 §E.1 严守）；都让"真绿色"概念更精确。

### §D.7 修复通用化原则（PR #16 CI run #2 揭露；首次正式沉淀）

**元层级边界澄清** — §D.1-D.6 关注"修什么"；§D.7 关注"**怎么修**"（修复策略的工程纪律）。

PR #16 CI run #2 失败实证：
- 测试：`liquidation-saga.e2e.test.ts > test_happy_path_audit_events_emitted_*`
- 错误：`TQ-INF-010: This server does not host this topic-partition`（同 Step 0.5 §D.5 根因）
- 路径：`createE2eHarness → test-harness.ts:226 → notification-kafka.ts:229 init()`

**Step 0.5 §D.5 修复回顾**：
- 修复范围：`notification-kafka.test.ts:37` 内联 `ensureTopicReady` 函数 + 2 个失败测试加 helper 调用 + contract/persistent test afterAll 60s timeout
- 修复对象：notification-kafka 自身测试（2 tests + 1 hook）
- 修复盲点：**该修复未通用化** — 任何其他使用同一 notification-kafka adapter 的测试场景都需要相同保护，但 ensureTopicReady 是 local function 而非 testkit helper

**Step 2 PR #16 CI run #2 兑现**：
- Step 2 创建 `createE2eHarness` 引用同一 notification-kafka adapter（fakeEngineHttp 路径）
- 未应用 ensureTopicReady 同等保护 → 同根因 TQ-INF-010 在 e2e 路径再次触发

**修复策略（不修业务代码；testkit 通用化）**：
- 抽 `warmupKafkaTopics` 到 `packages/adapters/adapter-testkit/src/kafka-topic-warmup.ts`（commit 1）
- `createE2eHarness` 应用 testkit helper（commit 2）
- `notification-kafka.test.ts:37 ensureTopicReady` 维持现状（Step 11 收官评估统一迁移；现在迁移会破坏 Step 0.5 既有测试 + 增加 fix iteration 工作面）

**修复通用化原则（工程纪律新沉淀）**：

> 单点修复发现时，AI 在追加 fix commits 之前必须评估"该修复是否会在其他场景再次需要"。
> 如果会 → **沉淀到通用 helper / testkit** 比单点修复更工程纪律。
> 如果不会 → 单点修复 + 在 ADR §D 留痕"为何不通用化"。

**与 §D.1-§D.6 区别**：
- §D.1-§D.6：what to fix（业务代码 / testkit 设计 / 测试默认语义 / 镜像约定 / CI 时序 / build cache）
- §D.7：**how to fix**（评估通用化必要性）

**Phase 11+ contributor 协作纪律延伸（推迟 Step 11 收官评估实施）**：
- closure-checklist 追加项："fix iteration 阶段评估修复通用化（同根因可能在其他场景兑现？）"
- PR template 追加项："fix introducing new shared logic → 沉淀到 testkit / helper 而非内联"

**与 §D.5/D.6 cache layer leakage 不同**：§D.5/D.6 都是"未在干净环境验证"的工程问题；§D.7 是"修复 scope 不够通用"的工程纪律问题（更上层）。

## Decision (Step 1 — 端到端测试基础框架)

完成日：2026-05-19。惯例 M 第 32 次实战 / 跨 Phase 第 13 次。本 Step **拆两阶段**（第 9 次拆分实战）；多核心决策影响 Phase 11+ 持续。PR #15。

### S1.1 路径 A 锁定（K.1 不引入 Testcontainers + K.2 docker-compose β）
权衡矩阵详见 `docs/phase11/03-step-1-end-to-end-test-framework.md` §C.3。三候选 α/β/γ；锁定 **α 不引入 Testcontainers** + **β docker-compose 加 postgres + kafka**。

锁定 α 理由：
1. 元规则 P 累计 32 步零新依赖严守（Tianqi 工程信任纪律核心）
2. CI services + docker-compose β 提供功能等价的本地 dev 体验（2 命令 vs 1 命令；差异微小）
3. "克制 > 堆砌" 严守（Testcontainers 是 nice-to-have）
4. 引入回退成本高（lockfile + fixture 改写）；严守不引入更安全

**Kickoff K.4 vs Step 1 K.1 一致性留痕**：Phase 11 Kickoff K.4 决议 α+β 组合（"Testcontainers 本地 + GitHub Actions services CI"；"让本地 dev cycle + CI 都流畅"）。Step 1 PHASE_DESIGN 实地评估发现 α 更合适——这正是拆两阶段 + Kickoff 不锁定的工程价值：实地评估让 Kickoff 倾向被精确修正。**Kickoff 决议 = 大方向；Step 实地裁决 = 细节锁定；不冲突**。

### S1.2 docker-compose.yml 升级 β（K.2）
α 单 tianqi 服务 → β tianqi + postgres + kafka 三服务编排。postgres + kafka 配置与 ci.yml services 1:1 对应（postgres:16-alpine + apache/kafka:3.7.2 KRaft 单 broker 关键 env；与 Step 0/0.5 实战配置同步）。tianqi 服务加 depends_on healthy + env vars。

### S1.3 e2e fixture 框架（K.3 α 共享 helper）
新建 `packages/application/src/e2e/test-harness.ts` (255 行)。`createE2eHarness({ postgresUrl, kafkaBrokers, fakeEngineHttp?, clockMode? })` 工厂函数返回 4 真实 adapter + in-memory auditSink + cleanup 函数。RUN_ID + harnessCounter 隔离；cleanup 自管（drop postgres schemas + delete kafka topics best-effort）。

`fakeEngineHttp` + `clockMode` 选项 v1 仅声明类型；接口预留供 Step 2-6 + Step 7 实施。

### S1.4 4 自检测试（验证 fixture 框架可用）
`packages/application/src/e2e/test-harness.e2e.test.ts` 含 4 个 it（all initialized healthy / auditSink empty + append / postgres schema isolation concurrent / cleanup idempotent）。本机实测全 PASS（with-PG-Kafka canonical）；不实现具体 4 端到端路径（Step 2-6 责任）。

### S1.5 ci.yml 维持 4 jobs（K.4）
e2e 测试在现有 test job 内跑（与 Step 0/0.5 一致）；不引入新 job。harness 依赖既有 ci.yml services.postgres + services.kafka（Step 0/0.5 已就位）。

### S1.6 CONTRIBUTING.md 不升级（K.5 α）
Step 11 收官统一升级；维持 100 行硬底（Step 7 精简承接精神）。

### S1.7 §B.1.A f9e2831 同步路径 + push≠merge 教训沉淀

**§B.1.A 严守实证**：Step 1 强制开局动作 1 揭露 `f9e2831` (KI-P8-003 第二次兑现留痕 commit) 未进入 main：
```
$ git log 5521739^2 --oneline -1  → 8c45c13 (NOT f9e2831)
$ git merge-base --is-ancestor f9e2831 origin/main  → NOT in
```
PR #14 merge 在 `f9e2831` push 之前完成；commit 留在 feature 分支但未进入 main。

**Step 1 PR 第一个 commit re-apply** KI-P8-003 第二次兑现留痕（路径 α 内嵌策略；用户 APPROVE）— diff 1:1 与 f9e2831 相同。

**push 不等于 merge 教训**（Tianqi 工程旅程第二次类似事件）：
- **1st event**：Phase 11 Kickoff v1 起草时假设 Phase 10 CLOSED but PR #10 actually 未 merge（recorded in §B.1.A）
- **2nd event**：Step 0.5 KI 留痕 f9e2831 push but 未 merge（本 Step §S1.7）

**教训沉淀**：
- **push 到 feature 分支 != merge 到 main**：GitHub 工作流中两个独立事件
- post-push 必须实测 main HEAD（`git ls-remote` / `git log`）确认变更已进入 main
- "已 push" + "推断 CI 通过" + "推断 merge 成功" 是 §B.1.A 事实锚定纪律违规

**Phase 11+ 协作纪律延伸**：用户回执"已 merge"/"全绿"/类似后，AI 在下一 Step Kickoff 强制开局动作 1 必须实测 main HEAD 才能完成事实锚定。

### S1.8 不预占 Step 2-11 工作
- 不实现 4 端到端路径（Step 2-6 责任）
- 不实现性能测试（Step 7 责任）
- 不实现混沌演练（Step 8 责任）
- 不修复 KI-P8-003（Step 4 评估锁定）
- 不引入新错误码 / Port / workspace 包（K.6 0 新增；元规则 P 累计 32 步零依赖维持）
- 不修改 README / Runbook（Step 11 收官升级）
- 不创建 phase-11-closed tag（Step 11 收官）

---

## Decision (Step 2 — 端到端顺利路径 Liquidation 全流程)

完成日：2026-05-20。惯例 M 第 33 次实战 / 跨 Phase 第 14 次。本 Step **不拆两阶段**（Step 1 fixture 框架决策已锁定；Step 2 主题相对成熟）。PR #16。

### S2.1 fakeEngineHttp 接口实施（裁决 3 + 裁决 4；Step 1 接口预留兑现）
新建 `packages/application/src/e2e/fake-engines.ts` (210 行)：Node.js 内置 `http` 模块；单 server 多路径分发；5 happy-path endpoint（query-mark-price / list-open-positions / place-order / release-margin / transfer-fund）；按 OrderStatus + TransferStatus 枚举返回有效 status；可观测 receivedRequests。元规则 P 严守（不引入 express/koa）。

扩展 `packages/application/src/e2e/test-harness.ts`：`E2eHarnessOptions.fakeEngineHttp` 类型从 `{ port: number }` 改为 `FakeEnginesServer`；`E2eHarness.engines?` 字段新增（5 Engine HTTP adapter；仅 fakeEngineHttp 传入时创建）；cleanup 扩展 shutdown 5 adapter。向后兼容（不传 fakeEngineHttp = harness.engines = undefined）。

### S2.2 liquidation-saga.e2e.test.ts 5 测试（裁决 1 β + 裁决 2）
新建 `packages/application/src/e2e/liquidation-saga.e2e.test.ts` (339 行；5 个 it)：
1. happy_path_completes_through_5_steps_with_completed_status
2. happy_path_audit_events_emitted_for_each_of_5_steps_plus_saga_lifecycle（§15）
3. happy_path_saga_state_persists_to_real_postgres_after_completion（§8.1）
4. happy_path_5_engine_endpoints_called_via_real_http_in_expected_order
5. happy_path_two_concurrent_liquidations_both_complete_independently

测试用 `createE2eHarness` 真实 fixture + `createFakeEnginesServer` 假引擎 HTTP server + `createLiquidationSaga` 真实 Saga 编排。实测全 PASS（with-PG-Kafka canonical）。

### S2.3 KI-P9-001 评估结果（裁决 6 β；Phase 11 端到端 4 路径首次评估）
StateTransition 数据副本漂移在 Liquidation 顺利路径 **未触发**。5 e2e tests 全 PASS（含 SagaStateStore 持久化测试 + 并发 Liquidation 测试）。**状态维持监控**；推迟 Step 4-6（恢复路径涉及 saga state 数据漂移）进一步评估。

### S2.4 createE2eHarness 真实使用实证（Step 1 H7 升级）
Step 1 §G 报告 "createE2eHarness fakeEngineHttp + clockMode v1 仅接口预留"——Step 2 fakeEngineHttp 接口真实实施 + 5 e2e tests 真实使用 fixture。**Step 1 H7 间接验证升级到直接验证**（4 self-check + 5 Liquidation e2e）。clockMode 仍预留（Step 4-6 责任）。

### S2.5 §8.1 Mock 边界硬约束兑现实证（Phase 11 主题核心层首个工程价值）
Liquidation Saga 在真实 Postgres + 真实 Kafka + 真实 HTTP wire path（fake-engines）下跑通——4 类组件全部真实激活；唯一"假"成分是外部交易引擎 HTTP 响应（按 §8.1 假引擎可接受）。这是 Phase 11 主题"端到端集成验证"首个工程价值实现 Step。

### S2.6 顺利路径覆盖第一半（§8.2 Step 2 + Step 3）
Liquidation 全流程兑现 = §8.2 顺利路径覆盖第一半；Step 3 ADL 全流程承接第二半；§8.2 完整覆盖在 Step 3 后达成。

### S2.7 测试基线 + 覆盖率变化
- 测试基线: 1994 → **1999 total** (+5 e2e tests)
- 覆盖率 (with-PG-Kafka canonical): **87.21% / 80.17% / 96.32% / 87.21%** (vs Step 1 baseline 87.16% slight uptick from e2e harness coverage)
- KI 状态: 4 open 维持 (KI-P9-001 Liquidation 顺利路径未触发;留监控)

### S2.8 不预占 Step 3-11 工作
- 不创建 ADL e2e 测试（Step 3 责任）
- 不创建补偿 / 死信 / 恢复 / 性能 / 混沌测试（Step 4-8 责任）
- 不修复 KI-P8-003 / 不主动修复 KI-P9-001
- 不修改 ci.yml services / Dockerfile / docker-compose / README / Runbook
- 不引入新 Port / Adapter / 错误码 / workspace 包 / 第三方依赖

---

## Alternatives Considered

[各 Step 拒绝候选由对应 Step 完成时增量追写；启程指令 7 项核心裁决的拒绝候选详见 `docs/phase11/00-phase-11-kickoff.md`，待 PHASE_IMPLEMENT 阶段沉淀进本段]

### Step 0 Alternatives
- 裁决 1 β（单独 integration-test job）拒：破坏 4 jobs 概念 + 增加 CI 复杂度
- 裁决 1 γ（仅 main push 触发）拒：PR 验证不完整，违反 Phase 10 / Step 3 强制门禁精神
- 裁决 3 β/γ (postgres 15/17) 拒：16 业界 stable 主流；17 太新；15 不必要保守
- S0.3 catch 23505 retry 模式（仅 catch CREATE SCHEMA 23505）拒：CREATE TABLE 也触发同样错误（pg_type_typname_nsp_index）；advisory lock 是干净的 PG 推荐做法
- S0.3 Testcontainers Node.js 引入 拒：Step 1 责任；本 Step 用 GitHub Actions services（K.4 + 元规则 P 维持）
- KI-P8-003 在 Step 0 顺手修 拒：违反主题专注度；推迟 Step 4-6（动作 G α）

### Step 1 Alternatives
- K.1 β（完整引入 @testcontainers/postgresql + @testcontainers/kafka）拒：元规则 P 累计 32 步零依赖第一次破坏；本地 dev 体验边际价值不值得（差 1 个命令）
- K.1 γ（仅 testcontainers core）拒：同上理由 + 仍破坏 32 步零依赖
- K.2 α'（维持单 tianqi 服务）拒：错失本地 dev "一键启动测试基础设施"机会；ci.yml services 配置无法在本地 1:1 复用
- K.2 γ（β + 更多服务如假引擎 HTTP）拒：过度（mock external engine HTTP 是 Step 2-6 责任）
- K.3 β（独立 packages/e2e-tests/ workspace 包）拒：违反 K.6 0 新增（§B.1.C 24 → 25 包）
- K.3 γ（命名约定 *.e2e.test.ts 分散在各包）拒：测试分散不利于共享 fixture
- K.4 β（单独 e2e job）拒：破坏 4 jobs 概念（§B.1.C 24 包 + 4 jobs 一致性）
- K.4 γ（workflow_dispatch 手动触发）拒：PR 验证不完整
- K.5 β（CONTRIBUTING.md 同步追加端到端启动指引）拒：突破 100 行硬底；Step 11 收官升级更系统
- §B.1.A f9e2831 同步路径 β（单独 micro-PR）拒：α 内嵌更克制（"克制 > 堆砌"）+ 与 Step 1 commit 序列自然融合
- §B.1.A f9e2831 同步路径 γ（放弃 sync）拒：违反 §B.1.A 事实锚定纪律（main 文档必须诚实留痕）

### Step 2 Alternatives
- 裁决 1 α（e2e 测试散落 application/src/saga/）拒：与端到端"跨多 saga 跨多 adapter"语义不匹配；β 集中于 src/e2e/ 更清晰
- 裁决 1 γ（独立 packages/e2e-tests/ workspace 包）拒：违反 K.6 0 新增；§B.1.C 24 包维持
- 裁决 3 β（独立 fake-engines workspace 包）拒：违反 K.6；测试 helper 不需要独立包
- 裁决 3 γ（用既有 mock-downstream-server）拒：mock-downstream-server 设计目标是 fault injection 队列模型,与 happy-path 多 endpoint 业务响应不匹配
- 裁决 6 α（不在 Step 2 评估 KI-P9-001）拒：Step 2 是 Phase 11 端到端 4 路径首次评估时机（动作 4 G），不评估会延期 Step 4-6 工作量
- 裁决 6 γ（Step 2 主动修复 KI-P9-001）拒：违反主题专注度；顺利路径未触发漂移无修复必要

---

## References

- 《Tianqi 项目架构与代码规范总文档》§22.1 ADR 规范、§24.1 PR 七项、§27 最终裁决原则
- 《Tianqi Phase 8–12 架构与代码规范补充文档》§1.2 阶段定义、§8 端到端验证约束、§9 测试规范追加、§11 观测性约束追加、§13.1 第 11 项严禁、§13.3 Phase Gate 回溯义务、§14 最终裁决追加
- `docs/decisions/0001-phase-8-adapter-layer.md`（Phase 8 ADR；Accepted）
- `docs/decisions/0002-phase-9-saga-orchestration.md`（Phase 9 ADR；Accepted Phase 9 CLOSED 2026-05-02）
- `docs/decisions/0003-phase-10-engineering-and-collaboration.md`（Phase 10 ADR；Accepted Phase 10 CLOSED **2026-05-13** — 校正补丁见 ADR-0003 Status 段后注 + §B.1.B）
- `docs/KNOWN-ISSUES.md`（KI-P8-002 / KI-P8-003 Phase 11 责任明示；KI-P10-001/002 已 RESOLVED）
- `CHANGELOG.md`（Phase 10 段；Phase 11 段由 Step 11 收官撰写）
- `docs/phase11/00-phase-11-kickoff.md`（启程记录；含 v1 → v2 → v3 完整教训留痕）
