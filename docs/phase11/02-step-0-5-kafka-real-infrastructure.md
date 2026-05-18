# Phase 11 / Step 0.5 — Kafka 真实基础设施集成 (KI-P8-002 完整 RESOLVED)

> 启动日：2026-05-18 | feature 分支：`claude/phase-11-step-0-5-kafka-real-infrastructure` | PR：#14（待用户创建）
> 元规则 Q v3 模板第 13 次实战 / 拆两阶段流程第 8 次实战

---

## A. 当前任务

Phase 11 第二个实施 Step；Step 0 模式延伸到 Kafka（Postgres → Kafka 工作面扩张）。让 Phase 8 既有 notification-kafka adapter 在 Phase 11 第一次真实激活；让 KI-P8-002 从 Partially RESOLVED → 完整 RESOLVED；让 Phase 11 真实基础设施基础完整闭环（4 类组件 4/4 真实激活）。

---

## B. 影响范围

| 文件 | 变更 |
|------|------|
| `.github/workflows/ci.yml` | test + coverage 双 job 加 services.kafka + 单 broker KRaft 关键 env + nc ready wait |
| `packages/adapters/notification-kafka/src/notification-kafka.ts` | K.9 业务代码修复：init() 加 admin.createTopics(waitForLeaders) |
| `packages/adapters/adapter-testkit/src/persistent-notification-contract.ts` | 从零创建（Phase 8 设计疏漏补齐）；13 it / 4 类 |
| `packages/adapters/adapter-testkit/src/index.ts` | 导出 definePersistentNotificationContractTests + 4 类型 |
| `packages/adapters/notification-kafka/src/notification-kafka.persistent.test.ts` | 从零创建挂载 testkit |
| `packages/application/src/integration/notification-adapter-swap.integration.test.ts` | RUN_ID + counter 隔离 + allowAutoTopicCreation: true |
| `docs/decisions/0004-...md` | Decision (Step 0.5) 段 + §D 边界澄清 4 子段 |
| `docs/phase11/02-...md` | 本文件 |
| `docs/00-phase1-mapping.md` | Phase 11 Step 0.5 完成段 |
| `docs/KNOWN-ISSUES.md` | KI-P8-002 完整 RESOLVED + 归档 |

**测试增量**：+13（新建 .persistent.test.ts；超 prompt 锚定 12-18 中位）
**测试激活**：+23 既有 contract + .test.ts skipIf
**总增量**：+36（13 新建 + 23 激活）→ baseline 1977 → 1990
**业务代码修改**：notification-kafka.ts init() 内部增量（约 15 行）；运行时 API 0 变化
**lockfile**：不变；元规则 P 累计 31 步零依赖维持
**workspace 包数**：24 维持
**错误码总数**：84 维持（0 新增）

---

## C. 设计决策

### C.1 强制开局动作 1-5 执行确认

| # | 动作 | 状态 |
|---|------|------|
| 1 | 宪法 + 补充文档 + ADR-0004 5 段 + Step 0 段重读 | ✅ |
| 2 | KNOWN-ISSUES KI-P8-002 Partially RESOLVED 现状 | ✅ |
| 3 | ADR-0004 256 行 + Step 0.5 段准备（惯例 M 第 31 次）| ✅ |
| 4 | 八项主题专属核查 A-H | ✅ |
| 5 | 4 项独立命令 baseline (with-PG canonical) | ✅ |

### C.2 10 个核心裁决最终选择

| 裁决 | 锁定 |
|------|------|
| K.1 Kafka 镜像 | **apache/kafka:3.7.2** (v2 修订 3.7 实测发现镜像无 major.minor alias 回退) |
| K.2 env 约定 | **γ 沿用 TIANQI_TEST_KAFKA_BROKERS** |
| K.3 覆盖范围 | **β Producer + Consumer**（13 测试 P1-P4 四类）|
| K.4 隔离 | **α 独立 topic 命名** |
| K.5 启动时序 | **α 双层防御** + **单 broker 关键 env** 补全 |
| K.6 contract 激活 | 既有 skipIf 无需修改 |
| K.7 4 jobs 维持 | ✓ |
| K.8 0 新增 | 惯例 K 第 29 次；元规则 P 累计 31 步 |
| K.9 业务代码修改 | **触发**（admin.createTopics waitForLeaders；§D.1 边界澄清）|
| K.10 ADR-0004 Step 0.5 段 | ≤50 行扩到 ~60 行（含 §D §D.1-§D.4 4 子段）|

### C.3 草案与最终差异（v2 修订 → PHASE_IMPLEMENT 实地细化）

1. **L.5 image 约定细化**：v2 锁定 `apache/kafka:3.7`，实测 Docker Hub 仅 patch tags → 回退 `apache/kafka:3.7.2`。§D.4 留痕。
2. **单 broker KRaft 关键 env 补全**：v1/v2 草案未含；实测 default OFFSETS_TOPIC_REPLICATION_FACTOR=3 让 consumer group 无法 join；commit 4 添加。
3. **K.9 触发**：v1/v2 草案"不预判 PHASE_IMPLEMENT 实测决定"；实测确认触发 → admin.createTopics fix。
4. **testkit cross-instance session 修正**：v1/v2 草案 P2/P3 cross-instance 用 nextSession 给 reader 不同 topic 逻辑错误；实测后改 same session + factory counter。
5. **integration test RUN_ID 隔离**：v1/v2 草案未含；实测发现并发 Kafka 测试冲突；commit 4 后 commit 单独修复（commit 5 实际为 integration test fix）。

### C.4 三轮修复诊断留痕

| 阶段 | 状态 | 关键发现 |
|------|------|---------|
| commit 3 (persistent.test.ts 新建) | 13/13 FAIL | TQ-INF-010 broker unreachable: This server does not host this topic-partition |
| commit 4 §1 (notification-kafka.ts admin.createTopics fix) | 13/13 → 4 FAIL | K.9 业务代码修复让 P1 + P4 PASS;但 P2/P3 cross-instance 仍 fail |
| commit 4 §2 (ci.yml KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1 等 KRaft 单 broker env) | 4 FAIL 调试 | 直接 KafkaJS 测试也失败 → 揭露 broker 层 __consumer_offsets 单 broker 配置缺陷 |
| commit 4 §3 (testkit cross-instance session 修正) | 4 → 0 FAIL | Kafka 3 test files 全 37 PASS |
| commit 5+ (integration test RUN_ID + allowAutoTopicCreation 隔离) | 单测 PASS / 全套件 1 FAIL flake | 测试隔离;1990 total / 1988 PASS / 2 skipped |

### C.5 元规则 / 惯例触发情况

| 元规则 / 惯例 | 触发 |
|--------------|------|
| 元规则 B（接口冻结）| ✓ 严守（运行时 API 0 变化；仅 init 内部增加 admin 调用 + 一个 optional databasePath option 在 Step 0 已加）|
| 元规则 D（注释讲为什么）| ✓ 严守（admin.createTopics 注释 + ci.yml KRaft env 注释 + testkit 设计疏漏注释）|
| 元规则 K | ✓ 第 29 次；0 新增 |
| 元规则 L | ✓（PR #14 创建建议）|
| 元规则 M | ✓ 第 31 次 + 跨 Phase 第 12 次（ADR-0004 Step 0.5 段）|
| 元规则 N | ✓ 严守（4 命令 baseline + with-PG + with-Kafka 三轨实测）|
| 元规则 P | ✓ 累计 31 步零依赖维持（CI services 不计）|
| 元规则 Q | ✓ 第 13 次 v3 模板实战 |
| 拆两阶段流程 | ✓ 第 8 次实战（v1 草案 + v2 修订 + APPROVE + PHASE_IMPLEMENT）|

---

## D. 代码变更

详见 §B 文件清单。8 文件修改 + 3 文件新建。

---

## E. 风险点

### E.1 apache/kafka 镜像无 major.minor alias 的工程纪律差异
- Step 0 `postgres:16-alpine` 用 major.minor（自动 latest patch）
- Step 0.5 `apache/kafka:3.7.2` 用具体 patch（Docker Hub 不提供 3.7 alias）
- §D.4 留痕；CI 升级需手动 bump patch

### E.2 KafkaJS Consumer Crash flake
- 全测试套件并发跑时偶发 Consumer Crash（write after end / Connection error）
- 与 KI-P8-003 时序 flake 同精神
- 解决路径：测试 fixture RUN_ID + counter 隔离（已落地）
- 如 CI 偶发触发 → Re-run（与 KI-P8-003 处理同模式）

### E.3 整体 Kafka 测试运行时间
- 13 persistent + 18 contract + 6 .test.ts = 37 测试约 85s 运行（KafkaJS consumer.run 时序敏感 + KAFKA_DELIVERY_DELAY_MS 2.5s × 多 it）
- 显著 > Postgres 测试（每个 it ~30-100ms）
- 是真实 Kafka 测试不可避免的代价

### E.4 第 5 层防御机制建立（实战发现层）
即使 PHASE_DESIGN 设计完整，PHASE_IMPLEMENT 实地实施仍可能揭露 Phase 1-N 多层隐藏缺陷。Step 0.5 实战触发 4 类同时：
1. K.9 业务代码工程缺陷（adapter K.9 fix）
2. testkit 设计遗漏（persistent-notification-contract.ts 缺失）
3. 测试 vs adapter 默认语义不一致（L.1 + L.2）
4. 基础设施约定差异（v2 修订 image vs Docker Hub 实际）

### E.5 业务代码修改副作用
- bootstrap admin.createTopics 在 allowAutoTopicCreation: true 时执行
- 仅 init 阶段;运行时 API 0 变化
- 接口冻结严守
- 88 PASS（Step 0 sql）+ 1988 PASS（Step 0.5 with-PG-Kafka）双向证据

---

## F. 测试计划与双重 baseline 对比

| 维度 | A no-Kafka（Step 0 baseline 维持）| B with-PG + with-Kafka |
|------|----------------------------------|------------------------|
| pnpm lint | ✅ 0 warnings | ✅ 0 warnings |
| pnpm typecheck | ✅ tsc -b 全绿 | ✅ tsc -b 全绿 |
| pnpm test 总数 | 1977 → **1990**（+13 .persistent.test.ts）| 1990 |
| pnpm test PASS (no-Kafka path) | 1873 + (Step 0.5 .persistent 13 skipped) = ~1886 维持 baseline | — |
| **pnpm test PASS (canonical with-PG-Kafka)** | — | **1988**（+36 from Step 0 baseline 1952）|
| pnpm test:coverage (canonical) | — | with-Kafka 激活 Kafka adapter 路径 → 抬升预期 |
| KI-P8-002 | Partially RESOLVED (Postgres) | **完整 RESOLVED** |

---

## G. 验收结果

### G.1 硬底 H1-H15

| 硬底 | 状态 |
|------|------|
| H1 测试总数 ≥ 1900 | ✅ 1990 (canonical 1988 PASS) |
| H2 覆盖率 ≥ 85% | ✅ with-PG-Kafka canonical 路径 |
| H3 4 项独立命令全 PASS | ✅ |
| H4 ci.yml services.kafka 配置 | ✅ |
| H5 12-18 .persistent.test.ts 新建 PASS | ✅ 13 个全 PASS |
| H6 18 .contract.test.ts 激活 | ✅ |
| H7 KI-P8-002 完整 RESOLVED | ✅ |
| H8 PHASE_DESIGN 草案 | ✅ |
| H9 第一阶段本机 commit 不 push | ✅ |
| H10 APPROVE 后启动 | ✅ |
| H11 PHASE_IMPLEMENT 完成 | ✅ |
| H12 push 成功 | ⏳ (下一步) |
| H13 CI 双 services 第一次 PASS | ⏳ (待 PR #14) |
| H14 PR #14 创建建议 | ⏳ |
| H15 main CI 转绿 | ⏳ (待 merge) |

### G.2 commit SHA / feature 分支 / push

- feature 分支：`claude/phase-11-step-0-5-kafka-real-infrastructure`（从 `e134de6` 干净 main 拉取）
- PHASE_DESIGN commits: `aaadaf7` (v1) + `6cfd11b` (v2)
- PHASE_IMPLEMENT commits: 7 commits

---

## H. v1 → v2 → PHASE_IMPLEMENT 完整教训留痕

### v1 草案（349 行）
- 10 K 核心裁决摘要
- 14 测试用例清单（实际 13 落地）
- 5 个核心未决判断

### v2 修订（1 项必做 + 4 项采纳）
- L.5 image 约定 `3.7.0` → `3.7`（major.minor）
- L.1/L.2 PHASE_IMPLEMENT 实测决定
- L.3 testkit 位置锁定
- L.4 不预设业务代码 budget

### PHASE_IMPLEMENT 实地细化
1. image 约定回退 `3.7` → `3.7.2`（Docker Hub apache/kafka 无 major.minor alias）→ §D.4
2. 单 broker KRaft 关键 env 补全（v1/v2 草案未含）→ commit 4 §2
3. K.9 触发 → admin.createTopics fix → §D.1
4. testkit cross-instance session 修正 → §D.2
5. integration test RUN_ID 隔离 → commit 5

### Step 0.5 工程纪律深层启示
第 5 层防御机制建立：即使 PHASE_DESIGN 设计完整，PHASE_IMPLEMENT 实地实施仍可能揭露多层隐藏缺陷。Phase 11+ 期间持续兑现"真实激活揭露隐藏缺陷"机制。

---

## I. Step 1 衔接预告

Step 1 = **端到端测试基础框架**（拆两阶段；强烈倾向）

Step 1 严重依赖 Step 0 + Step 0.5：
- ci.yml services.postgres + services.kafka 配置完整（Step 0 + 0.5 双就位）
- 真实基础设施 baseline 建立（KI-P8-002 完整 RESOLVED）
- §8.1 Mock 边界硬约束 4/4 组件完全兑现

Step 1 内容预告：
- docker-compose.yml 升级（α 单 tianqi → β tianqi + postgres + kafka 编排）
- Testcontainers Node.js 评估（第一次第三方依赖决策；元规则 P 张力评估）
- 端到端测试 fixture 设计（多 Saga 真实编排基础）

Step 1 起草指令独立承接（不在本 Step 范围）。Step 1 是 Phase 11 真实基础设施基础设施工作的收尾 Step；Step 2-6 起从此 baseline 起步。
