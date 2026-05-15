# Phase 11 Kickoff v2/v3 — PHASE_DESIGN 草案

> **状态**：第一阶段（PHASE_DESIGN）草案 **v3 修订完成**；等待用户 APPROVE。
> **拆两阶段流程第 7 次实战 / 元规则 Q v3 模板第 11 次实战 / 首次 Phase 启程级别完整实战 v2**
> **v3 修订要点**：K.3 日期回填必做（+3 commits）+ K.1 24 包纪律延伸 + K.4 你独立关闭 PR #11；ADR-0004 §B.1 草案重写到 ~80 行（4 段）；PHASE_IMPLEMENT commit 规划升至 7 commits。
> 本草案在 APPROVE 后转入 ADR-0004 + 3 个回填 + KNOWN-ISSUES + docs/phase11/00 + mapping；草案文档本身在 PHASE_IMPLEMENT 完成时删除（设计沉淀）。

---

## A. 强制开局动作 1-5 执行确认

| 动作 | 内容 | 状态 |
|------|------|------|
| 1 | 深度重读宪法（1106 行）+ 补充文档关键节（§1.2 / §8.1-8.4 / §9.1 / §9.4 / §13.1 第 11 项 / §13.3）+ ADR-0001/0002/0003 | ✅ |
| 2 | KNOWN-ISSUES.md 5 项 open KI + 2 项 RESOLVED 盘点 | ✅ |
| 3 | ADR-0001/0002/0003 Accepted 实证 + ADR-0004 起步准备 | ✅ |
| 4 | 八项主题专属核查 A-H | ✅（详见 B 段） |
| 5 | 4 项独立命令 baseline 实测 | ✅（详见 C 段） |

**v2 事实锚定预核查**（执行前）：
- ✅ `git ls-remote origin refs/heads/main` → `cc74da3` ✓（Merge PR #10）
- ✅ `git ls-remote origin refs/tags/phase-10-closed` → `ab70043` ✓（release.yml 触发产物）
- ✅ `git ls-remote origin refs/tags/phase-9-closed` → `2bd7d2d` ✓
- ✅ feature 分支 `claude/phase-11-kickoff` 从 `cc74da3` 干净 main 拉取（H8 满足）

---

## B. 强制开局动作 4 核查结果（八项 A-H）

### B.1 §13.3 Phase 8/9/10 全部 CLOSED 实证（含 Phase 8 git tag 实测裁决）

| Phase | CLOSED 状态 | git tag | ADR | 真实证据 |
|-------|-----------|---------|-----|--------|
| Phase 8 | ✅ CLOSED 2026-04-26 (Step 19) | ❌ **缺失**（约定后置引入） | ADR-0001 Accepted | docs/phase8/19-phase-8-closure.md + KNOWN-ISSUES.md L13 |
| Phase 9 | ✅ CLOSED 2026-05-02 (Step 19) | ✅ phase-9-closed = `c9ebe88` | ADR-0002 Accepted | docs/phase9/ + ADR-0002 |
| Phase 10 | ✅ CLOSED 2026-05-13（仪式日期） | ✅ phase-10-closed = `ab70043` → `cc74da3` | ADR-0003 Accepted | docs/phase10/09-step-7-closure.md + GitHub Release published |

**Phase 8 git tag 处置裁决**：**选项 α 历史遗留，不触发回溯义务**。理由：
1. phase-*-closed tag 约定在 Phase 10 / Step 5 release.yml 落地（2026-05-04+），是后置发明
2. Phase 8 CLOSED 2026-04-26 时该约定尚未引入，无法预先遵守
3. Phase 8 CLOSED 真实证据齐备（ADR-0001 Accepted + docs/phase8/19 + KNOWN-ISSUES.md L13 显式登记）
4. 补打 phase-8-closed tag 现在没有工程价值（release.yml 触发是 Phase 10+ 引入；Phase 8 不需要再触发 release）
5. 在 ADR-0004 §B.1 留痕即足够；Phase 11+ 严守 phase-N-closed tag 约定

**ADR-0003 日期细节留痕**：ADR-0003 / CHANGELOG.md / KNOWN-ISSUES.md L206 等多文件统一标 "Phase 10 CLOSED 2026-05-05"，实为 Step 7 PHASE_IMPLEMENT 完成日（撰写时锁定）。真实 CLOSED 仪式日期 2026-05-13，间隔 8 天。这是 v2 重启教训的具体表现之一（撰写时假设关闭仪式同期，但实际推迟）。**不修改 ADR-0003 / CHANGELOG / KNOWN-ISSUES（已锁定文档），仅在 ADR-0004 §B.1 诚实留痕**。

### B.2 25 包 monorepo workspace 清单

**实测 24 个 workspace 包**（不是 prompt 锚定的 25 包）：

- **核心 6 包**（packages/*/）：domain / application / policy / ports / contracts / shared
- **adapters 18 包**：adapter-testkit / config-file / config-memory / dead-letter-store-{memory,postgres} / event-store-{memory,postgres,sqlite} / external-engine-http-base / fund-engine-http / margin-engine-http / mark-price-engine-http / match-engine-http / notification-{kafka,memory} / position-engine-http / saga-state-store-{memory,postgres}

**`packages/infrastructure/`** 仅含 README.md 占位（无 package.json）→ **不计入 workspace 包数**。

**§B.2 留痕**：prompt 锚定的"25 包"包含 infrastructure 占位；实际 24 包。Phase 11 可能在 Step 9-10 引入 observability 相关包（裁决 K.6 全程预期）。

### B.3 Phase 8 既有真实基础设施 adapter 现状

| Adapter | .contract.test.ts | .persistent.test.ts | env var 依赖 |
|---------|-------------------|---------------------|-------------|
| event-store-postgres | ✅ 21 tests | ✅ 12 tests | `TIANQI_TEST_POSTGRES_URL` |
| event-store-sqlite | ✅ | ✅ | `TIANQI_TEST_SQLITE_PATH` |
| saga-state-store-postgres | ✅ 13 tests | ✅ 8 tests | `TIANQI_TEST_POSTGRES_URL` |
| dead-letter-store-postgres | ✅ 14 tests | ✅ 8 tests | `TIANQI_TEST_POSTGRES_URL` |
| notification-kafka | ✅ 18 tests | ❌ **缺失** | `TIANQI_TEST_KAFKA_*`（待定） |
| config-file | ✅ | ✅ | （YAML 文件路径） |

**核心发现**：
- 5 个 `.persistent.test.ts` 文件已就位（KI-P8-002 落地基础完整 80%）
- **notification-kafka 暂无 `.persistent.test.ts`** — Phase 11 / Step 0 新增工作面
- 当前 test 跑 104 skipped 即对应这些 contract + persistent tests（env var 未设置）

### B.4 既有 .integration.test.ts 现状

**11 个 `.integration.test.ts` 文件**（用 memory adapter；不依赖真实基础设施）：

- **4 个 adapter-swap**（packages/application/src/integration/）：
  - config-adapter-swap / event-store-adapter-swap / notification-adapter-swap / external-engine-integration
- **7 个 saga**（packages/application/src/saga/）：
  - liquidation-saga / adl-saga / insurance-fund-saga / state-transition-saga / saga-manual-intervention / cross-saga-coordination / **saga-end-to-end** ← Phase 11 Step 2-6 端到端 4 路径基线

**Phase 11 端到端测试策略选择**：
- 沿用 saga-end-to-end.integration.test.ts 模式扩展（顺利 / 补偿 / 死信 / 恢复 4 路径独立 Step）
- **关键升级**：从 memory adapter 切到 postgres / kafka 真实 adapter（KI-P8-002 修复责任）

### B.5 CI workflow 真实基础设施支持评估

**当前 ci.yml**（Phase 10 / Step 3 落地）：4 jobs（lint / typecheck / test / coverage）；**不含 services**。

**Phase 11 真实基础设施集成测试候选**：
- **α GitHub Actions services**（原生 services 启动 Postgres / Kafka 容器；标准且无第三方 Node 依赖）
- **β Testcontainers in test code**（test 启动 docker 容器；本地 dev cycle 流畅）
- **γ docker-compose 启动后跑 test**（CI 内 docker compose up + test；与 docker-compose.yml 升级耦合）

**Kickoff 不裁决**；Step 1 PHASE_DESIGN 实地决策。**倾向 α + β 组合**（K.4 推荐）。

### B.6 性能基线工具评估（§8.3 4 项指标）

vitest 自身**不含**性能测试 baseline 工具。候选：

- **α vitest + performance.now() + 自定义统计**（不引入第三方依赖）
- **β 第三方 benchmark 库**（mitata / tinybench；元规则 P 评估）
- **γ Node.js 内置 perf_hooks**（不引入第三方依赖）

**Kickoff 不裁决**；Step 7 PHASE_DESIGN 实地决策。**优先 α / γ 路径**（元规则 P 严守）。

### B.7 混沌演练工具评估（§8.4 4 故障场景）

候选：

- **α 自定义 fault injection**（test 内注入故障；不引入第三方依赖）
- **β 第三方混沌工具**（toxiproxy / chaos-mesh；重型 + 元规则 P 严守）
- **γ docker-compose 编排级故障注入**（docker stop service 模拟故障）

**Kickoff 不裁决**；Step 8 PHASE_DESIGN 实地决策。**优先 α / γ 路径**（元规则 P 严守）。

### B.8 元规则 P 严守评估

**当前 production deps 已含**（Phase 8 落地，非 Phase 11 新增）：
- `pg` 8.13.1（postgres 客户端；postgres adapter 包）
- `kafkajs` 2.2.4（kafka 客户端；notification-kafka）
- `better-sqlite3` 11.5.0（sqlite；event-store-sqlite）

**root devDependencies**（基线）：
- @eslint/js / @types/node / @typescript-eslint/eslint-plugin / @typescript-eslint/parser / @vitest/coverage-v8 / eslint / eslint-config-prettier / prettier / typescript / vitest

**Phase 11 预期可能引入**：
- **Testcontainers Node.js**（Step 1 评估；devDependency only；不破坏产线依赖纯净度）
- 性能 / 混沌工具：优先零依赖路径（vitest + perf_hooks + 自定义 fault injection）

**累计步数**：Phase 8 至 Phase 10 / Step 7 final = 累计 30+ 步零新 root 依赖。**Kickoff 阶段 0 新增**（K.6 兑现）；Step 1 Testcontainers 决策是 Phase 11 第一次依赖引入潜在点。

---

## C. 强制开局动作 5 — 4 项独立命令 baseline 实测

| 命令 | 结果 | 数值 | 与 prompt 锚定对比 |
|------|------|------|--------------------|
| pnpm lint | ✅ PASS | 0 warnings | ✓ |
| pnpm typecheck | ✅ PASS | tsc -b 全绿 | ✓ |
| pnpm test | ✅ PASS | 1873 passed \| 104 skipped \| **1977 total** | ✓（精确匹配） |
| pnpm test:coverage | ✅ PASS | **85% / 79.63% / 91.68% / 85%** | ✓（branches 0.01pp 精度差异；本质吻合） |

**KI-P8-003 处置说明**：本次本地 baseline 一次通过，未触发 KI-P8-003 时序 flake。Phase 10 / Step 7 main CI 第七次运行实战兑现（saga-orchestrator overall-timeout vacuous 分支；Re-run PASS）已留痕在 KNOWN-ISSUES.md 段。Phase 11 评估修复路径（具体 Step 起草指令承接）。

---

## D. 7 个 K 核心裁决摘要

### K.1 Phase 11 Step 划分 — **β 12 Step（Kickoff + 11 实施 Step）**

| Step | 主题 | 拆两阶段 |
|------|------|---------|
| Kickoff | 主题确认 + Step 划分 + 真实基础设施战略决策 | ✅（本指令） |
| Step 0 | KI-P8-002 修复 + 真实基础设施集成基础（Phase 8 既有 Postgres / Kafka adapter 真实激活；含 notification-kafka .persistent.test.ts 新建） | TBD |
| Step 1 | 端到端测试基础框架（CI services / docker-compose 升级 / Testcontainers 决策） | ✅ 强烈倾向 |
| Step 2 | 端到端顺利路径 — Liquidation 全流程 | — |
| Step 3 | 端到端顺利路径 — ADL 全流程 | — |
| Step 4 | 端到端补偿路径（任一 Step 失败触发完整逆序补偿） | — |
| Step 5 | 端到端死信路径（补偿失败 → 死信 → 人工解决） | — |
| Step 6 | 端到端恢复路径（进程中断 → 持久化状态恢复） | — |
| Step 7 | 性能基线 4 项指标（p50/p95/p99 + 吞吐 + 存储写入 + Saga 端到端延迟） | ✅ 倾向 |
| Step 8 | 混沌演练 4 故障场景（存储连接抖动 / 消息系统节点切换 / 外部引擎超时 / 时钟异常） | ✅ 倾向 |
| Step 9 | Adapter 可观测 metrics 落地（§11.1） | — |
| Step 10 | Saga 可观测 metrics + Trace 贯通（§11.2 + §11.3） | — |
| Step 11 | Phase 11 收官（CHANGELOG + ADR-0004 Accepted + phase-11-closed tag + 等） | ✗（收官主题成熟，Phase 10 / Step 7 已实证） |

### K.2 测试数下限路径策略 — **α + β 组合**

- α 自然增量（每 Step 自然加 10-20 测试；累计 +120-240）
- β 收官 Step 11 评估补充（如不足 1900+，加 boundary tests）
- ✗ γ 各 Step 锁定测试目标（违反主题专注）

**Phase 11 测试数预期**：1977 → 1900+ 至少 -77 容差；自然增量预计 +120-240 让安全裕度合理。

### K.3 覆盖率门槛维持 85%（不进一步升级）

- 整个 Phase 11 期间维持 85+/75+/85+/85+ baseline 不下降
- Phase 11 / 收官 Step 不主动升级（与 Phase 10 / Step 7 升级 84% → 85% 不同）
- Phase 12 评估是否进一步升级

### K.4 真实基础设施战略 — **α + β 组合**（Testcontainers 本地 + GitHub Actions services CI）

- **α Testcontainers Node.js**：本地 dev cycle 流畅（test 自动启动容器）
- **β GitHub Actions services**：CI 原生（不引入 Node.js 依赖）
- **元规则 P 张力**：Testcontainers 作为 **devDependency only** 引入是合理代价（产线依赖纯净度不破坏）
- **Kickoff 仅锁定大方向；Step 1 PHASE_DESIGN 实地裁决**

### K.5 拆两阶段流程承接（Phase 11 预期实战 4+ 次）

| Step | 拆两阶段 | 理由 |
|------|---------|------|
| Kickoff（本指令） | ✅ | Phase 11 战略锁定涉及全程 + Phase 12 持续；Phase 10 Kickoff 已实证价值 |
| Step 0 | TBD | 视 KI-P8-002 修复方案复杂度 |
| Step 1 | ✅ 强烈倾向 | CI services / docker-compose 升级 / Testcontainers 决策 |
| Step 7 | ✅ 倾向 | 性能工具选 + 4 项指标定义 + 基线数值确定 |
| Step 8 | ✅ 倾向 | 混沌工具选 + 4 故障场景定义 |
| Step 11 | ✗ | 收官主题成熟（Phase 10 / Step 7 已实证） |

**Phase 10 累计实战 6 次**（Phase 9/Step 6/14 + Phase 10/Kickoff/Step 3/3.5/5）→ Phase 11 +4 次（保守预期）= 累计 10+ 次。

### K.6 错误码 / 新 Port / 新 Adapter / 新 workspace 包 / 第三方依赖

**Kickoff 阶段 0 新增**（惯例 K 第 27 次实战）。

**Phase 11 全程预期**：
- 错误码：可能新增 TQ-INF 真实基础设施 + TQ-SAG 端到端（Step 实地决策）
- 新 Port：低概率
- 新 Adapter：可能（observability 相关）
- 新 workspace 包：可能（observability 相关）
- 第三方依赖：**Testcontainers 在 Step 1 评估**（K.4）；其他严守元规则 P

### K.7 ADR-0004 创建 + Status: In Progress

**ADR-0004 主题**：Phase 11 端到端集成验证
**ADR-0004 Status**：In Progress（Phase 11 启动至 CLOSED；与 ADR-0003 模式一致）
**ADR-0004 起步段长度**：≤80 行（K.7 锁定）；含：

1. Phase 11 主题（§1.2 原文锁定）
2. 7 个 K 核心裁决摘要
3. Phase 8 + 9 + 10 CLOSED 实证（含 Phase 8 git tag α 处置）
4. 与 ADR-0001/0002/0003 关系
5. KI-P8-002 修复责任明示
6. KI-P8-003 实战兑现留痕（Phase 10 / Step 7 main CI 第七次运行）
7. **§B.1 Phase 11 Kickoff v2 重启教训完整记录**（v1 事实锚定造假 + AI §13.3 核查实战发现 + 教训沉淀）
8. Phase 11+ 后续 ADR-0005（Phase 12 发布就绪）承接预告

---

## E. Phase 11 Step 划分草案（K.1 详细 — Kickoff 锁定大方向；各 Step 起草指令实地裁决）

（同 D.K.1 表；不重复）

**Step 间依赖**：
- Step 0 是 Step 1-10 前置（KI-P8-002 修复让 Phase 8 既有 Postgres / Kafka adapter 真实激活，是真实基础设施基础）
- Step 1 是 Step 2-6 前置（端到端测试基础框架）
- Step 2-6 并行性可能（顺利 / 补偿 / 死信 / 恢复 4 路径相对独立）
- Step 7 + 8 是 Step 2-6 后置（性能 + 混沌建立在完整端到端链上）
- Step 9 + 10 是 Step 2-8 增强（观测性贯通在完整链路上）
- Step 11 是收官（所有 Step 完成后）

---

## F. ADR-0004 Kickoff 段草案（K.7 详细；§B.1 v3 重写到 ~80 行 / 4 段）

```markdown
# ADR-0004: Phase 11 端到端集成验证

## Status

In Progress (Phase 11 启程 2026-05-16；CLOSED 待 Step 11 收官)

> 本 ADR 是增量追写（惯例 M 沿用 Phase 9/10 模式；第 29 次实战 / 跨 Phase 第 10 次）。
> Phase 11 启程指令拆两阶段流程：第一阶段 PHASE_DESIGN 草案 + 用户 APPROVE
> → 第二阶段 PHASE_IMPLEMENT 落地。各 Step 完成时向 §Decision 段下对应小节
> 追加该 Step 关键裁决摘要。

## Context

Phase 11 主题：**端到端集成验证**（《Phase 8-12 补充文档》§1.2 原文）。Phase 1-10 累计建立的"代码 + 业务能力 + 协作生态 + CI 真绿色 + 容器可部署 + 发布自动化 + 可执行文档"七重工程成熟度在 Phase 11 通过**真实基础设施**（不是 mock）+ **端到端 4 路径覆盖** + **性能基线 4 指标** + **混沌演练 4 故障场景**让工程价值得到真实验证。

§8.1 Mock 使用边界硬约束：事件存储 / 消息系统 / 配置系统 / Saga 状态持久化 4 类组件**严禁 mock**。§13.1 第 11 项严禁。依赖：Phase 8 (ADR-0001) + Phase 9 (ADR-0002) + Phase 10 (ADR-0003) 全部 CLOSED。

## Decision (Kickoff)

### K.1-K.7（7 项核心裁决摘要；每项 ≤10 行）
- **K.1** Step 划分 **β 12 Step**（Kickoff + Step 0-11；见 docs/00-phase1-mapping.md Phase 11 段）
- **K.2** 测试数下限路径 **α + β 组合**（自然增量 + Step 11 收官评估补充；1977 → 1900+）
- **K.3** 覆盖率维持 **85%**（不进一步升级；Phase 12 评估）
- **K.4** 真实基础设施 **α + β 组合**（Testcontainers 本地 + GitHub Actions services CI；Step 1 实地裁决）
- **K.5** 拆两阶段流程 Phase 11 **实战 4+ 次预期**（Kickoff + Step 1/7/8 强烈倾向；Step 0 TBD；Step 11 不拆）
- **K.6** Kickoff 阶段 **0 新增**（惯例 K 第 27 次实战；元规则 P 30+ 步零依赖暂维持；Step 1 Testcontainers 评估）
- **K.7** ADR-0004 起步段 ≤120 行（含 §B.1 ~80 行 4 段）

## §B.1 工程纪律延伸与历史校正记录（v3 / 4 段）

本段记录 Phase 11 Kickoff 形成过程中触发的 4 类工程纪律延伸 + 历史文档校正动作，构成 Tianqi 工程纪律"第 4 层防御机制"（历史文档事实校正）实战兑现。

### §B.1.A — v2 重启教训（事实锚定纪律建立）

Phase 11 Kickoff 第一次起草指令（v1）在事实锚定段假设"Phase 10 CLOSED 2026-05-05（PR #10 merge + phase-10-closed tag + GitHub Release published）"。用户回执"pr 合并完成，过程中虽然有错误，但是搞定了"实指 Step 7 PHASE_IMPLEMENT 在 feature 分支搞定，未涉及 PR 合并 / tag 创建 / Release published。AI 在 §13.3 Phase Gate 回溯义务前置核查的第一秒发现事实冲突（`git ls-remote origin refs/heads/main` 实测 `92753168` = Merge PR #9 Step 6，非假设的 PR #10 merge；`phase-10-closed` tag 不存在；Step 7 commits 仍停留在 feature 分支），在创建任何草案 / commit / push 前停下，触发 v2 重启。教训 5 条沉淀（详见 docs/phase11/00-phase-11-kickoff.md）。**事实锚定纪律 Phase 11+ 严守**：所有 SHA / tag / 状态必须基于 git fetch + ls-remote / gh CLI 等实测确认；不接受"乐观假设"。

### §B.1.B — ADR-0003 / CHANGELOG / KNOWN-ISSUES 日期回填修正（v3 必做）

ADR-0003 / CHANGELOG.md Phase 10 段 / KNOWN-ISSUES.md L206 三文件统一标 "Phase 10 CLOSED 2026-05-05"，实为 Step 7 PHASE_IMPLEMENT 完成日（撰写时锁定）。Phase 10 CLOSED 真实仪式日期 **2026-05-13**（PR #10 merge `cc74da3` + main CI 4/4 PASS + `phase-10-closed` tag `ab70043` push + release.yml 第一次真实运行 + GitHub Release published），间隔 8 天。Phase 11 Kickoff PHASE_IMPLEMENT 阶段以 **3 个最小修正 commit** 回填三文件日期 2026-05-05 → 2026-05-13。**回填原则**：仅校正"已发生但日期标签错位"的事实陈述；不改动决策内容 / 不破坏 ADR-0003 Accepted 语义。**这是 Tianqi 工程纪律第 4 层防御机制（历史文档层）首次实战兑现**——把事实锚定纪律从 future（设计 / 实施 / 部署 / 事实层）扩展到 past（历史文档事实校正）。

### §B.1.C — 24 包事实精度纪律延伸（v3 必做）

Phase 11 Kickoff v1/v2 prompt 锚定 "25 包 monorepo workspace"，实测 **24 包**（核心 6 + adapters 18；`packages/infrastructure/` 仅含 README.md 占位，无 package.json，不计入 workspace）。事实锚定纪律延伸至"workspace 包数"事实陈述精度。**Phase 11+ 起草指令统一使用 "24 包" 描述**。infrastructure/ 占位是否正式落地由 Phase 11 Step 9-10 observability 工作实地决策（裁决 K.6 全程预期保留）；Kickoff 阶段不补创。

### §B.1.D — Phase 8 git tag 缺失 α 处置（接受历史遗留）

`git tag --list` 实测：`phase-9-closed` (Phase 9 / Step 19) + `phase-10-closed` (Phase 10 / Step 7) 就位；**`phase-8-closed` 缺失**。phase-N-closed tag 约定在 Phase 10 / Step 5 release.yml 落地（2026-05-04+），Phase 8 CLOSED 2026-04-26 时该约定尚未引入。**裁决选项 α**：历史遗留，不补打。理由：(1) 补打无工程价值（Phase 8 不需要再触发 release.yml）；(2) 补打会触发 release.yml → 产生 Phase 8 GitHub Release draft 需用户处理；(3) Phase 8 CLOSED 真实证据齐备（ADR-0001 Accepted + docs/phase8/19 + KNOWN-ISSUES.md L13）。**Phase 11+ 严守 phase-N-closed tag 约定**——这一纪律不溯及历史，仅向未来生效。

## 第 4 层防御机制框架（B.1 综合）

Tianqi 工程纪律的 4 层防御机制 by Phase 11 Kickoff：

| 层 | 防御对象 | 兑现 Step |
|----|---------|----------|
| 代码层 | Phase closure typecheck + monorepo packaging 双层缺陷链 | Phase 10 / Step 0 + Step 3.5 |
| 工作流层 | release.yml 元规则 B 在工作流层兑现 | Phase 10 / Step 5 |
| 事实层 | §13.3 Phase Gate 回溯义务前置核查 | Phase 11 Kickoff v2 |
| **历史文档层** | **已 Accepted 文档事实陈述错误的最小修正** | **Phase 11 Kickoff v3（本 ADR）** |

完整的工程纪律不仅防御 future（设计 / 实施 / 部署 / 事实），也修正 past（历史文档事实校正）——这是从"工程纪律"升级到"工程信任"的关键节点。

## Consequences

### 积极
- Phase 11 在 `cc74da3` 干净 main + 真实基础设施可用 + KI-P8-002 修复责任明示的起步状态下工作
- §13.3 Phase Gate 回溯义务实战兑现（首次）
- v1 教训 + v3 历史校正成为 Tianqi 工程纪律的事实锚定段沉淀
- 第 4 层防御机制建立（历史文档层）

### 风险
- Step 0 KI-P8-002 修复 + Step 1 Testcontainers 引入决策可能引发 Phase 11 早期不稳定
- 真实基础设施测试在 CI 跑增加 build time（待 Step 1 评估）
- KI-P8-003 时序 flake 在端到端测试中可能加重（Phase 11 评估修复）

## References

- ADR-0001 / ADR-0002 / ADR-0003
- 《Phase 8-12 补充文档》§1.2 / §8 / §9 / §11 / §13
- docs/phase11/00-phase-11-kickoff.md
- docs/KNOWN-ISSUES.md（KI-P8-002 / KI-P8-003 Phase 11 责任明示）
- §B.1 v3 修订（4 段 / ~80 行）
```

**段长度初估**：≤180 行（Status + Context + Decision 7 项摘要 + §B.1 4 段 ~80 行 + 第 4 层防御机制框架表 + Consequences + References）；远低于 ADR-0003 694 行。

---

## G. KNOWN-ISSUES.md 更新草案（5 项 KI Phase 11 责任明示 + KI-P8-003 实战兑现留痕）

### G.1 KI-P8-002 段更新

新增 Phase 11 启程留痕：

```
- **Phase 11 修复责任承接（2026-05-15）**：Phase 11 Kickoff（ADR-0004）明示 KI-P8-002 修复责任在 Phase 11；具体 Step：
  - Step 0：Phase 8 既有 Postgres / Kafka adapter 真实激活 + notification-kafka 新建 .persistent.test.ts
  - Step 1：CI services / Testcontainers / docker-compose 升级（基础设施战略）
  - Step 2-6：端到端 4 路径在真实基础设施上验证
```

### G.2 KI-P8-003 段更新

新增 Phase 10 实战兑现 + Phase 11 评估留痕：

```
- **Phase 10 / Step 7 main CI 第七次运行实战兑现（2026-05-13）**：saga-orchestrator overall-timeout vacuous 分支偶发 flake（expected 'timed_out' received 'compensated'；测试运行 14ms 时序紧边界）；Re-run PASS。Phase 9 / Step 17 "Phase 9 实战 0 显式 flake"评估在 Phase 10 已被修正——比 Phase 11 预判早一个相位显化。**Phase 11 评估修复路径**（与 KI-P8-002 同期，因为真实 Kafka 接入会同步重写时序断言）。
```

### G.3 KI-P9-001 段更新

新增 Phase 11 端到端 4 路径触发评估留痕：

```
- **Phase 11 端到端 4 路径触发评估（2026-05-15）**：StateTransition Saga 数据副本漂移监控在 Phase 11 端到端补偿 / 死信 / 恢复路径可能触发；Step 4-6 实地评估处置。
```

### G.4 KI-P8-001 + KI-P8-005 段维持

- KI-P8-001：维持 Phase 13+ TBD（不在 Phase 11 主题边界）
- KI-P8-005：维持结构性现象（不阻塞 Phase 11）

---

## H. 风险点与 fallback 方案

| 风险 | 影响 | Fallback |
|------|------|---------|
| Phase 8 git tag 缺失被误判触发回溯 | 不必要的补打 tag 工作 | α 选项历史遗留处置已在 §B.1 留痕；Phase 11+ 严守新约定 |
| Testcontainers Phase 11 / Step 1 引入破坏元规则 P "30+ 步零依赖" | 第一次新增 root dep（如引入） | devDependency only 限制；ADR-0004 显式权衡留痕；Step 1 PHASE_DESIGN 实地裁决 |
| 真实基础设施 CI services 增加 CI 时间 | CI 单次跑从 ~3min 增至 ~5-10min | Step 1 评估并行 jobs / 缓存策略；如不可接受降级为本地 Testcontainers 跑 / CI 单 job 跑 |
| KI-P8-003 时序 flake 在端到端测试中加重 | Phase 11 CI 频繁红 | Phase 11 评估修复（与 KI-P8-002 同期）；短期 Re-run 缓解 |
| KI-P9-001 StateTransition 数据副本漂移在端到端补偿 / 恢复路径触发 | Step 4-6 工作面扩张 | Step 4-6 PHASE_DESIGN 实地评估处置 |
| ADR-0003 日期细节 "2026-05-05" vs 真实仪式 "2026-05-13" 被外部读者误解 | 历史档案精确度问题 | ADR-0004 §B.1 明确留痕；Phase 11+ 起步指令必须严守事实锚定纪律 |
| notification-kafka .persistent.test.ts 缺失增加 Step 0 工作量 | Step 0 工作面扩张 | Step 0 PHASE_DESIGN 实地评估；可拆分为 Step 0 (Postgres) + Step 0.5 (Kafka) 两 Step |
| `packages/infrastructure/` 占位包是否需要正式落地 | 24 → 25 包预期差异 | Step 9-10 observability 工作时实地决策；Kickoff 不裁决 |

---

## I. 本机 commit SHA（PHASE_DESIGN 阶段；未 push）

待 Write 工具完成后执行 `git add docs/phase11/PHASE-11-KICKOFF-DESIGN-DRAFT.md && git commit` 单 commit；SHA 在最终输出时报告。

---

## J. 草案文档位置

`docs/phase11/PHASE-11-KICKOFF-DESIGN-DRAFT.md`（本文件）

PHASE_IMPLEMENT 阶段（APPROVE 后）删除；内容沉淀到 ADR-0004 + docs/phase11/00-phase-11-kickoff.md + docs/KNOWN-ISSUES.md + docs/00-phase1-mapping.md。

---

## K. 核心未决判断（请重点审视）

### K.1 24 包事实精度纪律延伸（v3 修订锁定）

**v3 修订**：ADR-0004 §B.1 含"24 包事实精度纪律延伸"段（5-8 行）。Phase 11+ 起草指令统一使用 **"24 包"** 描述。不补创 infrastructure/ 包；该占位由 Phase 11 Step 9-10 observability 工作实地决策。

**留痕方向**：prompt 锚定 "25 包" 是历史口径（可能含 infrastructure/ 占位预期）；实测 24 包；事实锚定纪律延伸到"workspace 包数"事实陈述精度。

### K.2 Phase 8 git tag α 不补打（接受，不阻塞）

**v3 锁定**：选项 α 历史遗留处置；ADR-0004 §B.1 含 Phase 8 git tag 处置预措辞（~20 行）。不补打；Phase 11+ 严守 phase-N-closed tag 约定。

### K.3 ADR-0003 / CHANGELOG / KNOWN-ISSUES 日期回填修正（v3 必做）

**v3 修订**：PHASE_IMPLEMENT 阶段新增 **3 个 commit** 最小修正 3 文件日期 2026-05-05 → 2026-05-13。ADR-0004 §B.1 含回填留痕段（10-15 行）。

**回填范围**：
- `docs/decisions/0003-phase-10-engineering-and-collaboration.md` L7 + ADR Step 7 收尾日期段
- `CHANGELOG.md` Phase 10 段头部日期
- `docs/KNOWN-ISSUES.md` L206 "Resolved Known Issues (Phase 10 Closed, 2026-05-05)" 标题 + KI-P10-001/002 段内日期引用

**纪律延伸价值**（用户原话）：把"事实锚定纪律"扩展到历史文档层面 → 第 4 层防御机制建立。

### K.4 PR #11 dangling 处理 — 用户独立操作（v3 锁定）

**v3 锁定**：PHASE_IMPLEMENT 实施前你在 **GitHub Web UI 关闭 PR #11**（30 秒）。Phase 11 第一个 PR 序号 = **#12**（GitHub 自动）。

**AI 责任**：PHASE_IMPLEMENT 第二阶段 push 前用 `gh pr list` 或直接 `git ls-remote` 核查 PR #11 已关闭再 push（防御性核查）。

### K.5 notification-kafka .persistent.test.ts 缺失（接受，不阻塞）

**v3 锁定**：Phase 11 / Step 0 起草指令实地评估；可能拆分 Step 0 (Postgres) + Step 0.5 (Kafka)。Kickoff 阶段不裁决。

---

## 等待用户回执

请回 **APPROVE** / **REQUEST_CHANGES + 反馈** / **REJECT + 方向调整**。

如 REQUEST_CHANGES，请明示：
- K.1 / K.2 / K.3 / K.4 / K.5 五个未决判断中需要调整哪些
- 是否需要在 PHASE_DESIGN 阶段补充其他核查（譬如更多 adapter 现状 / 现有 .integration.test.ts 详细内容 / 等）
- 是否需要调整 Phase 11 Step 划分（K.1 β 12 Step vs α 8 / γ 16）
- 是否需要调整真实基础设施战略（K.4 α + β vs 单 α / 单 β / γ）

收到 APPROVE 后立即启动第二阶段 PHASE_IMPLEMENT（7 commits 规划）：

**前置核查**（push 前）：
- AI 用 `git ls-remote origin refs/pull/11/head` 或 `gh pr list` 核查 PR #11 已关闭（K.4 防御性核查）
- 如 PR #11 仍 open → STOP + 提示用户先关闭

**Commit 规划 7 项**（拆细 atomic commits，沿用 Phase 10 模式）：

| # | Commit | 内容 | 文件 |
|---|--------|------|------|
| 1 | `docs(adr-0003): correct CLOSED date 2026-05-05 → 2026-05-13` | ADR-0003 日期回填（§B.1.B / K.3） | docs/decisions/0003-phase-10-engineering-and-collaboration.md |
| 2 | `docs(changelog): correct Phase 10 CLOSED date 2026-05-05 → 2026-05-13` | CHANGELOG Phase 10 段日期回填 | CHANGELOG.md |
| 3 | `docs(known-issues): correct Phase 10 Closed date 2026-05-05 → 2026-05-13` | KNOWN-ISSUES.md L206 回填 + KI-P10-001/002 段内日期引用 | docs/KNOWN-ISSUES.md |
| 4 | `docs(decisions): create ADR-0004 for Phase 11 end-to-end integration verification` | ADR-0004 In Progress（含 §B.1 v3 四段 + 第 4 层防御机制框架） | docs/decisions/0004-...md |
| 5 | `docs(known-issues): update KI status with Phase 11 responsibility + KI-P8-003 实战兑现` | 5 项 open KI 责任明示 + KI-P8-003 Phase 10 / Step 7 main CI 第七次运行留痕 | docs/KNOWN-ISSUES.md |
| 6 | `docs: add Phase 11 kickoff execution record` | docs/phase11/00-phase-11-kickoff.md 创建（含 v3 修订完整留痕） + PHASE-11-KICKOFF-DESIGN-DRAFT.md 删除 | docs/phase11/00-phase-11-kickoff.md (+) / PHASE-11-KICKOFF-DESIGN-DRAFT.md (-) |
| 7 | `docs(mapping): mark Phase 11 as In Progress with Step structure` | Phase 11 启程段 + Step 划分锁定（Kickoff + Step 0-11） | docs/00-phase1-mapping.md |

**Push 流程**：
- `git push -u origin claude/phase-11-kickoff`
- CI 在 Phase 11 第一个 PR 第一次自身运行实测（自 phase-10-closed tag 后的第一个 PR；零依赖变更预期 4/4 PASS）

**PR #12 创建建议**：
- 标题：`Phase 11 Kickoff: end-to-end integration verification + 4-layer defense extension (v3)`
- 描述：按 §24.1 七项；含 7 commits 摘要 + v3 修订 3 项要点（K.1/K.3 必做 + K.4 用户独立）+ §B.1 四段引用 + Phase 11 全程 12 Step 预告

**预期回执流程**：你 APPROVE → AI PHASE_IMPLEMENT 7 commits + push → PR #12 自动创建 → CI 4/4 PASS → 你 merge → main CI 转绿 → Phase 11 Kickoff 完成 → Step 0 起草指令承接。
