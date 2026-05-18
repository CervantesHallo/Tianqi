# Phase 11 / Step 1 — PHASE_DESIGN 草案（端到端测试基础框架）

> **状态**：第一阶段（PHASE_DESIGN）草案；等待用户 APPROVE。
> **拆两阶段流程第 9 次实战 / 元规则 Q v3 模板第 14 次实战**
> 本草案在 APPROVE 后转入 ci.yml (如必要) + docker-compose.yml + e2e fixture 框架 + ADR + docs；草案文档本身在 PHASE_IMPLEMENT 完成时删除（设计沉淀）。

---

## 🚨 §B.1.A 事实锚定关键留痕（强制开局动作 1 揭露）

**严守 §B.1.A 事实锚定纪律**：执行 `git fetch origin main` 实测发现 PR #14 merge commit (`5521739`) 的 second-parent = **`8c45c13`**，**NOT `f9e2831`**。

**事实证据**：
```
$ git log --first-parent origin/main -1
5521739 Merge pull request #14 ...

$ git log 5521739^2 --oneline -1
8c45c13 docs(decisions): extend ADR-0004 §D with category 5 (CI environment timing assumption)

$ git merge-base --is-ancestor f9e2831 origin/main && echo "in main" || echo "NOT in main"
NOT in main

$ git show origin/main:docs/KNOWN-ISSUES.md | grep "Phase 11.*Step 0.5.*CI run #2"
(empty — 第二次兑现留痕不在 main)
```

**根因分析**：PR #14 merge 在 GitHub UI 上的执行时序在 `f9e2831` push 之前 — 用户 merge 后我才 push KI-P8-003 第二次兑现 record；该 commit 留在 feature 分支但未进入 main。

**§B.1.A 违规具体表现**：main 上 `docs/KNOWN-ISSUES.md` KI-P8-003 段仅含 Phase 10 / Step 7 第一次兑现留痕，**缺失** Phase 11 / Step 0.5 第二次兑现留痕；与 ADR-0004 §B.1 防御应用边界严守"必须真正 RESOLVED 不接受 with caveat" + KI-P8-003 留痕指令"second occurrence must be faithfully recorded on main, not deferred"违规。

**处置方案候选**（请用户在 APPROVE 时表态）：

- **路径 α（推荐）**：Step 1 PHASE_IMPLEMENT 第一个 commit 重新应用 KI-P8-003 第二次兑现留痕（同 `f9e2831` 内容）。Step 1 PR 含 1 个 KI-P8-003 同步 commit + Step 1 主题 commits。优点：单一 PR；时序紧凑。缺点：Step 1 PR 含非主题工作。
- **路径 β**：单独 micro-PR (PR #15) 先 sync KI-P8-003 留痕到 main，然后 Step 1 PR 从更新后 main 起步（变成 PR #16）。优点：纯净分离；KI 留痕 PR 干净。缺点：增加一个 PR；用户 merge 工作量 +1。
- **路径 γ**：放弃 main 同步 (违反 §B.1.A) — **不推荐**。

**Step 1 PHASE_DESIGN 草案默认采用路径 α**（推荐）— 若用户回执 REQUEST_CHANGES + β/γ，将相应调整。

---

## A. 强制开局动作 1-5 执行确认

| 动作 | 内容 | 状态 |
|------|------|------|
| 1 | 宪法 §13/§15/§20.2 + 补充文档 §8.2-8.4/§9.1/§9.4/§12.3-12.4/§13.1 + ADR-0004 §B.1 5 段 + Step 0/Step 0.5 段 + §D 5 类边界澄清 重读 | ✅ |
| 2 | KNOWN-ISSUES KI-P8-002 RESOLVED + KI-P8-003 已知重复(2 次) + KI-P9-001 端到端 4 路径触发预告盘点 | ✅ |
| 3 | ADR-0004 360+ 行 + Step 1 段准备（惯例 M 第 32 次 + 跨 Phase 第 13 次） | ✅ |
| 4 | 八项主题专属核查 A-H | ✅（详见 B 段） |
| 5 | 4 项独立命令 baseline (with-PG-Kafka canonical) | ✅（详见 C 段） |

**v3 事实锚定核查**：
- origin/main HEAD = `5521739`（Merge PR #14；Phase 11 / Step 0.5 CLOSED）✓
- feature 分支 `claude/phase-11-step-1-end-to-end-test-framework` 从 `5521739` 干净 main 拉取 ✓
- **关键发现**: `f9e2831` 未入 main（详见上方 §B.1.A 留痕）

---

## B. 强制开局动作 4 核查结果（八项 A-H）

### B.1 既有 docker-compose.yml 实测

Phase 10 / Step 4 落地的 α 单 tianqi 服务结构（28 行；含详细注释）。注释明示："real infrastructure binding is Phase 11 responsibility, not Step 4 scope" — Step 1 正好承接此前留痕。

仅 `tianqi` 服务（build context + image + container_name + HEALTHCHECK）。**无 postgres / kafka 服务**。

### B.2 既有 integration test fixture 现状

**11 个 .integration.test.ts**：
- 4 个 adapter-swap（config / event-store / external-engine / notification）— Phase 11 / Step 0.5 已加 RUN_ID 隔离
- 7 个 saga 业务（liquidation / adl / insurance-fund / state-transition / saga-manual-intervention / cross-saga-coordination / **saga-end-to-end**）

**`saga-end-to-end.integration.test.ts`（899 行）关键发现**：
- Phase 9 / Step 16 实战；4 类场景全覆盖（正向 / 失败补偿 / 超时补偿 / 死信 + 人工介入 + 跨 Saga 协调）
- **裁决 4 (A 仅 memory)**：明确"仅 memory adapter"路径；不含真实 Postgres/Kafka 真实激活
- **Step 1 fixture 框架基于此模式扩展**：保留 4 类场景结构，切换到真实 adapter

### B.3 Testcontainers Node.js 评估（核心决策）

**业界包**：`@testcontainers/postgresql` + `@testcontainers/kafka`（或仅 `testcontainers` core + GenericContainer）

**元规则 P 张力**：
- 累计 32 步零新依赖（Phase 8-10 + Phase 11 Kickoff/Step 0/Step 0.5）
- Testcontainers 是 Tianqi 全程**第一次主动引入业界 devDep 工具**
- 与 Phase 8 既有 KafkaJS / pg / better-sqlite3 **本质不同**（那些是 production deps 业务必需）

**价值评估**：
| 价值 | 说明 |
|------|------|
| 本地 dev cycle 自动容器 | 与 Step 0/0.5 已建立的"手动 docker run + 设 env vars"路径冗余 |
| 测试 fixture 自包含 | 边际价值（已有 RUN_ID + counter 模式实现 test 隔离）|
| 与 CI services 双路径 | 边际（CI 已稳定）|

**成本评估**：
| 成本 | 严重度 |
|------|--------|
| 元规则 P 第一次破坏（32 步零依赖记录终止）| 高（工程信任纪律核心）|
| Testcontainers 学习曲线 | 低（API 简单）|
| 本地测试启动慢 | 中（容器启动 5-10s × N 测试；除非 globalSetup 复用）|
| Phase 12 发布就绪 readiness 不增加 | 中性（Testcontainers 仅 devDep）|

### B.4 docker-compose.yml 升级评估

**β 加 postgres + kafka 服务的具体增量**：与 ci.yml services 1:1 一致（postgres:16-alpine + apache/kafka:3.7.2 KRaft 单 broker 关键 env）。约 +40-60 行。

**β vs Testcontainers 关系**：
- docker-compose β = **显式编排**（用户运行 `docker compose up -d postgres kafka` 后跑测试）
- Testcontainers = **隐式启动**（fixture 内启动容器）
- 不互斥；可同时存在

**β 本身价值**（不依赖 Testcontainers）：
- 本地 dev "一键启动测试基础设施"
- 与 CI services 配置 1:1 对应（read once + reuse）
- 多种本地 dev workflow 都受益（不仅 e2e 测试）

### B.5 端到端测试 fixture 设计前置

**Step 2-6 端到端 4 路径需要的 fixture 共性**：
1. 多 Saga 真实编排（Liquidation + ADL + 等）
2. 真实 EventStore（postgres）+ SagaStateStore（postgres）+ DeadLetterStore（postgres）+ Notification（kafka）
3. 模拟外部交易引擎（按 §8.1 假引擎可接受；HTTP 协议）
4. 时间控制（Saga timeout 等场景需要时间快进；可能用 fake-timers）
5. 审计事件 sink（验证 §15 审计要求兑现）

**Step 1 范围**：基础 fixture 框架 + **1-2 个最简 fixture 自检测试**（让框架真实可用）；不实现具体 4 路径。

**候选位置**：
- **α 共享 helper**：`packages/application/src/e2e/test-harness.ts`（推荐；不引入新 workspace 包）
- β 独立 workspace 包：`packages/e2e-tests/`（违反 K.6 0 新增；§B.1.C 24 → 25 包）
- γ 命名约定：`packages/application/src/**/*.e2e.test.ts`（测试分散；不利于共享 fixture）

**API 签名草案（α）**：

```typescript
export type E2eHarnessOptions = Readonly<{
  postgresUrl: string;
  kafkaBrokers: readonly string[];
  // optional: fake external engine HTTP server config
  fakeEngineHttp?: { port: number; behaviors: FakeEngineBehavior[] };
  // optional: clock control (Phase 11 / Step 0.5 KI-P8-003 学习—fast/slow ≥1:10)
  clockMode?: "real" | "controlled";
}>;

export type E2eHarness = Readonly<{
  eventStore: EventStorePort & AdapterFoundation;
  sagaStateStore: SagaStateStorePort & AdapterFoundation;
  deadLetterStore: DeadLetterStorePort & AdapterFoundation;
  notification: NotificationPort & AdapterFoundation;
  sagaOrchestrator: SagaOrchestrator;  // Phase 9 既有
  auditSink: AuditEventSink;  // Phase 9 既有 + in-memory 实现验证
  // cleanup function — deletes all created schemas / topics / state
  cleanup: () => Promise<void>;
}>;

/**
 * Create end-to-end test harness with real Postgres + Kafka adapters.
 * Phase 11 / Step 1 — fixture framework foundation for Step 2-6 (4 paths).
 */
export const createE2eHarness = async (options: E2eHarnessOptions): Promise<E2eHarness>;
```

### B.6 ci.yml 升级评估

当前 ci.yml 4 jobs（含 services.postgres + services.kafka）。

**端到端测试在现有 test job 内跑**（推荐）：
- 与 Step 0/0.5 模式一致
- 不引入新 job（维持 4 jobs；§B.1.C 与 24 包同精神）
- 端到端测试用 `.e2e.test.ts` 命名约定或位于 `src/e2e/` 子目录；vitest 自动 include

**不推荐路径**：
- β 单独 e2e job（5 jobs；破坏既定结构）
- γ workflow_dispatch（PR 验证不完整；违反 Step 3 CI 强制门禁精神）

### B.7 CONTRIBUTING.md 文档升级评估

当前 96 行（Step 7 精简 ≤ 100）。

**Step 1 是否追加"如何本地跑端到端测试"段**？

| 候选 | 评估 |
|------|------|
| α 不追加（推荐） | Step 11 收官时统一文档升级；维持 100 行硬底；Step 1 主题专注框架建立 |
| β 同步追加 | 端到端测试启动指引（~10-15 行）会突破 100 行硬底；Step 5 honest 留痕模式 |
| γ 不追加但 README/Runbook 升级 | Step 6 锁定文档（通常不动）|

**Step 1 推荐 α**。如 K.2 β（docker-compose 升级）已提供"一键启动"路径，本地 dev 运行端到端测试是 `docker compose up -d postgres kafka && pnpm test`（2 命令；不需要文档解释）。

### B.8 Testcontainers vs CI services 双路径协调（关键判断）

**3 候选路径**：

| 路径 | CI services | 本地 Testcontainers | docker-compose 升级 | 元规则 P |
|------|-------------|--------------------|--------------------|---------|
| **A**（推荐）| 主路径（Step 0/0.5 已建）| ✗ 不引入 | ✓ β 升级（一键启动）| **严守 32 步** |
| B | 主路径 | ✓ 辅助本地 dev | ✓ β 升级（互补）| 32 → 34 deps（**第一次破坏**）|
| C | ✗ 废弃 | 主路径 | ✗ | 32 → 34 deps + 重写 Step 0/0.5（**不推荐**）|

**Step 1 推荐路径 A**（核心论证见 D 段 K.1 详细）。

理由总结：
1. 元规则 P 累计 32 步零依赖是 Tianqi 工程信任纪律核心 — Step 1 引入第三方依赖需极强论证
2. Testcontainers 的"边际价值"对 Tianqi 较低（CI services + docker-compose β 已覆盖核心 use case）
3. "克制 > 堆砌"原则严守（Testcontainers 是 nice-to-have 而非 must-have）
4. 路径 A 让本地 dev 体验 = `docker compose up -d postgres kafka && pnpm test`（2 命令）— 不复杂
5. 如未来 Phase 12+ 真需要 Testcontainers，独立 Phase 评估引入；不在 Phase 11 第一次主动破坏

---

## C. 强制开局动作 5 — 4 项独立命令 baseline (with-PG-Kafka canonical)

| 命令 | 结果 |
|------|------|
| pnpm lint | ✅ 0 errors |
| pnpm typecheck | ✅ tsc -b 全绿 |
| pnpm test | ✅ **183 files PASS / 1988 tests + 2 skipped = 1990 total** |
| pnpm test:coverage | ✅ **87.13% / 80.18% / 96.28% / 87.13%** |

完全匹配 Step 0.5 final baseline。

---

## D. 8 个核心裁决摘要（K.1-K.8）

| # | 裁决 | 推荐 | 论证强度 |
|---|------|------|---------|
| K.1 | **Testcontainers Node.js 引入** | **α 不引入**（元规则 P 严守）| **核心 — 详见 §E** |
| K.2 | docker-compose.yml 升级 | **β 加 postgres + kafka** | 强（与 ci.yml services 1:1）|
| K.3 | e2e fixture 框架 | **α 共享 helper** `packages/application/src/e2e/test-harness.ts` | 强（不引入新 workspace 包）|
| K.4 | ci.yml 升级 | **α 维持 4 jobs**（e2e 测试在现有 test job 内）| 强（与 Step 0/0.5 一致）|
| K.5 | CONTRIBUTING.md 升级 | **α 不追加**（Step 11 收官升级）| 强（100 行硬底维持）|
| K.6 | 错误码 / Port / Adapter / 包 / 依赖 | **0 新增**（除 K.1 评估外）| 惯例 K 第 30 次实战 |
| K.7 | Phase 11 CLOSED 测试数前置 | 当前 1990 + Step 1 ~+5-15 = ≈2000；远超 1900 下限 | 评估通过 |
| K.8 | ADR-0004 Step 1 段 | ≤80 行（含 Testcontainers 详细论证 + §B.1.A f9e2831 留痕） | 惯例 M 第 32 次实战 |

---

## E. Testcontainers 引入详细论证（K.1 核心）

### E.1 三候选完整权衡矩阵

| 维度 | α 不引入 | β 完整引入 | γ 部分引入 |
|------|---------|-----------|-----------|
| 元规则 P 累计步数 | **32 步严守** | 32 → 34（第一次破坏）| 32 → 33（轻度破坏）|
| 工程信任纪律 | **核心严守** | 第一次系统性破坏 | 系统性破坏（轻度）|
| 本地 dev 体验 | 2 命令（docker compose up + pnpm test）| 1 命令（pnpm test 自启动）| 1 命令（自启动）|
| 测试运行时间影响 | 0（外部容器已启动）| +5-10s/容器启动（除非 globalSetup 复用）| 同 β |
| CI services 配置变更 | 0 | 0（CI 仍用 services）| 0 |
| Phase 11+ Step 实施复杂度 | 测试需 expect env vars | fixture 自包含 | fixture 自包含 |
| 学习曲线 | 0 | 低（API 简单）| 同 β |
| 与 Step 0/0.5 既建模式 | **延续一致** | 引入第二维度 | 引入第二维度 |
| 引入回退成本 | N/A | 高（package.json + lockfile + fixture 改写）| 中 |

### E.2 元规则 P "克制 > 堆砌" 工程纪律观

Tianqi 累计 32 步零新依赖（Phase 8 → Phase 11 Kickoff/Step 0/Step 0.5）是工程信任纪律的具体兑现：
- 第三方依赖 = 第三方维护风险（CVE / breaking change / abandonment）
- Tianqi 现有 production deps（pg / kafkajs / better-sqlite3）都是 Phase 8 引入的"业务必需"
- Testcontainers 是 Tianqi 全程**第一次主动引入"业界工具 / 非业务必需"devDep**

**路径 A（不引入）的工程信任价值**：
1. 累计 32 步零依赖记录延续到 33+ 步（Step 1 → Step 2 → ...）
2. Phase 11 主题"端到端集成验证"在零依赖增量条件下完成
3. Phase 12+ 如需要 Testcontainers，独立评估 + 独立 Phase 引入（不混入 Phase 11 主题）

### E.3 路径 A 的"功能等价性"证据

路径 A + docker-compose β 提供的本地 dev 体验：

```bash
# 启动测试基础设施（K.2 docker-compose β 后）
docker compose up -d postgres kafka

# 等 ready（与 CI 同模式）
until docker compose exec postgres pg_isready -U tianqi; do sleep 1; done
until docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092; do sleep 3; done

# 设 env vars + 跑测试
export TIANQI_TEST_POSTGRES_URL="postgres://tianqi:tianqi@localhost:5432/tianqi"
export TIANQI_TEST_KAFKA_BROKERS="localhost:9092"
pnpm test

# 测试完清理
docker compose down
```

**vs 路径 B（Testcontainers）**：
```bash
# 启动 + 跑测试（一行）
pnpm test
```

**差异**：路径 A 多 1-2 步骤；路径 B 节省"启动 + ready check"等待时间。

**结论**：路径 A 的"额外步骤代价"对 Tianqi 工程纪律核心（元规则 P）的破坏不值得。

### E.4 推荐：路径 A（严守元规则 P）

**Step 1 推荐路径 A 不引入 Testcontainers**。

---

## F. docker-compose.yml 升级草案（K.2 β）

在现有 α 单 tianqi 服务基础上添加 postgres + kafka 服务。完整新版（约 75-80 行）：

```yaml
# Tianqi docker-compose — Phase 11 / Step 1 (per ADR-0004 Step 1 裁决 K.2 β)
#
# β 升级（Step 1 落地）：从 Step 4 单 tianqi 服务扩展到 tianqi + postgres
# + kafka 三服务编排。让本地 dev cycle 与 CI services 配置 1:1 对应。
#
# 用法:
#   docker compose build                # 构建 tianqi runtime image
#   docker compose up -d postgres kafka # 启动测试基础设施(不启动 tianqi)
#   pnpm test                            # 在 host 跑测试,使用本地 5432/9092
#   docker compose down                  # 清理
#
#   或全栈:
#   docker compose up -d                 # 启动 tianqi + postgres + kafka

services:
  tianqi:
    build:
      context: .
      target: runtime
    image: tianqi:dev
    container_name: tianqi-dev
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: tianqi-postgres
    environment:
      POSTGRES_USER: tianqi
      POSTGRES_PASSWORD: tianqi
      POSTGRES_DB: tianqi
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tianqi"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka:
    image: apache/kafka:3.7.2
    container_name: tianqi-kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_NODE_ID: 1
      KAFKA_PROCESS_ROLES: broker,controller
      KAFKA_LISTENERS: PLAINTEXT://0.0.0.0:9092,CONTROLLER://0.0.0.0:9093
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      KAFKA_CONTROLLER_QUORUM_VOTERS: 1@localhost:9093
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: "1"
      KAFKA_TRANSACTION_STATE_LOG_MIN_ISR: "1"
      KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: "0"
      CLUSTER_ID: tianqi-test-kraft-cluster
    healthcheck:
      test: ["CMD-SHELL", "/opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092"]
      interval: 15s
      timeout: 10s
      retries: 10
      start_period: 30s
```

**与 ci.yml services 1:1 对应**（postgres + kafka 配置完全一致；可直接 copy-paste 对照）。

---

## G. 端到端测试 fixture 框架草案（K.3 α）

### G.1 文件位置

`packages/application/src/e2e/test-harness.ts`（与既有 `src/saga/` / `src/integration/` 兄弟目录；不引入新 workspace 包）

### G.2 完整 API 设计

详见 §B.5 API 签名草案。核心要点：

- `createE2eHarness(options)` 单工厂函数
- 真实 Postgres + Kafka adapter（zero mock）
- 唯一 RUN_ID + counter 隔离（Step 0/0.5 模式延伸）
- `cleanup()` 函数 drop schemas + delete topics
- 可选 `fakeEngineHttp` 配合 `external-engine-http-base` 既有 helper
- 可选 `clockMode: "controlled"` 配合 fake-timers（Step 4-6 时序场景用）

### G.3 自检测试（Step 1 落地范围）

`packages/application/src/e2e/test-harness.e2e.test.ts`（或类似命名）。约 3-5 个 it：

```
- test_create_harness_returns_all_adapters_initialized
- test_harness_publish_via_notification_visible_to_consumer
- test_harness_save_saga_state_persists_across_instances
- test_harness_cleanup_drops_postgres_schemas_and_kafka_topics
```

**不实现具体 4 端到端路径**（Step 2-6 责任）。Step 1 仅验证 fixture 框架可用。

### G.4 与既有 saga-end-to-end.integration.test.ts 关系

- saga-end-to-end (Phase 9 / Step 16) = memory adapter 模式（裁决 4 A 锁定）
- test-harness (Phase 11 / Step 1) = **真实 adapter 模式**（§8.1 Mock 边界严守）
- 两者共存：memory 模式快速验证编排逻辑；真实 adapter 模式验证基础设施集成
- Step 2-6 端到端 4 路径用 test-harness（真实 adapter）

---

## H. ADR-0004 Step 1 段草案（K.8 ≤80 行）

```markdown
## Decision (Step 1 — 端到端测试基础框架)

完成日：2026-05-XX。惯例 M 第 32 次实战 / 跨 Phase 第 13 次。本 Step
**拆两阶段**（第 9 次拆分实战）；多核心决策影响 Phase 11+ 持续。

### S1.1 路径 A 锁定（K.1 不引入 Testcontainers + K.2 docker-compose β）
权衡矩阵详见草案 §E。三候选 α / β / γ：
- α (推荐 / 锁定): 不引入 Testcontainers + docker-compose 升级 β
- β: 引入 Testcontainers (devDep only) + docker-compose β
- γ: Testcontainers 主路径 + 废弃 CI services

锁定 α 理由：
1. 元规则 P 累计 32 步零新依赖严守 (Tianqi 工程信任纪律核心)
2. CI services + docker-compose β 提供功能等价的本地 dev 体验
3. "克制 > 堆砌" 严守 (Testcontainers 是 nice-to-have)
4. 引入回退成本高 (lockfile + fixture 改写); 严守不引入更安全

### S1.2 docker-compose.yml 升级 β (K.2)
单 tianqi 服务 → tianqi + postgres + kafka 三服务编排。
与 ci.yml services 配置 1:1 对应; 本地 dev "一键启动测试基础设施"。

### S1.3 e2e fixture 框架 (K.3 α 共享 helper)
新建 `packages/application/src/e2e/test-harness.ts` (createE2eHarness API)。
真实 Postgres + Kafka adapter; cleanup 自管; 可选 fakeEngineHttp + clockMode。
3-5 个自检测试验证框架可用。

### S1.4 ci.yml 维持 4 jobs (K.4)
e2e 测试在现有 test job 内跑 (与 Step 0/0.5 一致); 不引入新 job。

### S1.5 CONTRIBUTING.md 不升级 (K.5 α)
Step 11 收官统一升级; 维持 100 行硬底。

### S1.6 0 新增 (K.6)
错误码 / Port / Adapter / 包 / 第三方依赖 全部 0 新增。
惯例 K 第 30 次实战; 元规则 P 累计 32 → 33+ 步零依赖延续 (Step 1 不增量)。

### S1.7 §B.1.A 事实锚定纪律严守 (KI-P8-003 第二次兑现留痕同步)
PR #14 merge 在 f9e2831 push 之前完成 → f9e2831 (KI-P8-003 第二次兑现
留痕) 未入 main。Step 1 PHASE_IMPLEMENT 第一个 commit 重新应用 KI-P8-003
第二次兑现留痕 (路径 α 内嵌; 路径 β 单独 PR 由用户决定)。

### S1.8 不预占 Step 2-11 工作
- 不实现 4 端到端路径 (Step 2-6)
- 不实现性能测试 (Step 7)
- 不实现混沌演练 (Step 8)
- 不修复 KI-P8-003 (Step 4 评估)
- 不收官 (Step 11)
```

---

## I. 风险点与 fallback 方案

| 风险 | Fallback |
|------|---------|
| §B.1.A f9e2831 同步路径选择（α 内嵌 vs β 独立 PR）| 用户 APPROVE 时表态；草案默认 α |
| docker-compose β 升级后既有 `docker compose up tianqi` 行为变化 | depends_on healthy 让 tianqi 容器等 postgres + kafka ready；如不需要可单独 `docker compose up postgres kafka` 跳过 tianqi |
| K.1 路径 A 后 Phase 11+ Step 真实需要 Testcontainers | 独立 Step 评估引入；非本 Step 范围 |
| e2e fixture 框架不够通用让 Step 2-6 需扩展 | Step 2 起草指令评估扩展；fixture API v1 → v2 |
| ci.yml e2e 测试运行时间增加 | 端到端测试用 timeout 充分；KI-P8-003 fast/slow ≥1:10 模式延伸 |
| 路径 A 与 Phase 11 Kickoff K.4 倾向 (α + β 组合 / β 是 Testcontainers) 不一致 | Kickoff K.4 倾向"Testcontainers 本地 + GitHub Actions services CI" — Step 1 实地裁决倾向 α 不引入；ADR-0004 §B.1.E 防御应用边界严守"防御过度应用反伤工程纪律"原则 — Kickoff 阶段裁决 = 大方向；Step 1 实地裁决 = 细节锁定；不冲突 |

---

## J. 本机 commit SHA（PHASE_DESIGN 阶段；未 push）

待 Write 工具完成后执行 `git add docs/phase11/PHASE-11-STEP-1-DESIGN-DRAFT.md && git commit` 单 commit；SHA 在最终输出时报告。

---

## K. 草案文档位置

`docs/phase11/PHASE-11-STEP-1-DESIGN-DRAFT.md`（本文件）

PHASE_IMPLEMENT 阶段（APPROVE 后）删除；内容沉淀到 ADR-0004 Step 1 段 + docs/phase11/03-step-1-end-to-end-test-framework.md + mapping。

---

## L. 核心未决判断（请重点审视）

### L.1 §B.1.A f9e2831 同步路径选择（核心）

**选项**：
- **α（推荐）**：Step 1 PR 第一个 commit 重新应用 KI-P8-003 第二次兑现留痕（同 f9e2831 内容）
- β：单独 micro-PR (PR #15) 先 sync；Step 1 = PR #16
- γ：放弃 sync（违反 §B.1.A；不推荐）

**请审视**：同意 α？还是希望 β 独立 PR？

### L.2 K.1 Testcontainers 引入决策（核心）

**Step 1 推荐 α 不引入**。理由：元规则 P 累计 32 步零依赖严守 + 工程信任纪律核心 + CI services + docker-compose β 功能等价。

但 Phase 11 Kickoff K.4 倾向"α + β 组合"含 Testcontainers — Step 1 实地裁决倾向变化。

**请审视**：
- 接受 α 不引入（推荐）？
- 还是坚持 Kickoff K.4 倾向引入 Testcontainers β/γ？
- 如选 β/γ：是 `@testcontainers/postgresql + @testcontainers/kafka` 完整 β，还是 `testcontainers` core γ？

### L.3 K.2 docker-compose β 升级范围

**Step 1 推荐 β**（加 postgres + kafka）。

**请审视**：是否同意 β？还是仅升级 postgres / 仅升级 kafka（半升级）？

### L.4 K.3 fixture 框架范围 + 自检测试数

**Step 1 推荐 createE2eHarness API + 3-5 自检测试**。

**请审视**：API 签名（§B.5 草案）是否满足 Step 2-6 预期 use case？自检测试 3-5 是否合理？

### L.5 K.5 CONTRIBUTING.md 不升级

**Step 1 推荐 α 不升级**（Step 11 收官升级）。

**请审视**：同意？还是要 β 同步追加端到端测试启动指引（突破 100 行硬底）？

---

## 等待用户回执

请回 **APPROVE** / **REQUEST_CHANGES + 反馈** / **REJECT + 方向调整**。

收到 APPROVE 后立即启动第二阶段 PHASE_IMPLEMENT。

**PR #15 commit 规划草案**（基于 α + α + β + α + α + α）：

1. `docs(known-issues): re-apply KI-P8-003 second occurrence record (§B.1.A f9e2831 sync to main)`
2. `ci(compose): upgrade docker-compose.yml with postgres + kafka services (K.2 β)`
3. `test(e2e): create createE2eHarness test framework (K.3 α; packages/application/src/e2e/)`
4. `test(e2e): add 3-5 self-check tests verifying harness usability`
5. `docs(decisions): append ADR-0004 Step 1 section`
6. `docs: add Phase 11 Step 1 execution record + mapping`

总计 **6 commits**（PR #15）。如 K.1 β/γ 引入 Testcontainers → +1 commit `chore(deps): add testcontainers devDep`（lockfile 变动）。
