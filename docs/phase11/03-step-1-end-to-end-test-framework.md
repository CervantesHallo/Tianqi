# Phase 11 / Step 1 — 端到端测试基础框架（createE2eHarness）

> 启动日：2026-05-19 | feature 分支：`claude/phase-11-step-1-end-to-end-test-framework` | PR：#15（待用户创建）
> 元规则 Q v3 模板第 14 次实战 / 拆两阶段流程第 9 次实战

---

## A. 当前任务

Phase 11 第三个实施 Step；真实基础设施基础设施层（Step 0 + 0.5）与主题核心层（Step 2-8）的桥梁 Step。建立 `createE2eHarness` fixture 框架为 Step 2-6 端到端 4 路径覆盖 + Step 7 性能基线 + Step 8 混沌演练提供共享基础。

---

## B. 影响范围

| 文件 | 变更 |
|------|------|
| `docs/KNOWN-ISSUES.md` | +5 行（commit 1: re-apply KI-P8-003 第二次兑现留痕；§B.1.A f9e2831 sync to main） |
| `docker-compose.yml` | +60 / -5（commit 2: α → β 加 postgres + kafka 服务） |
| `packages/application/package.json` | +5（saga-state-store-postgres + dead-letter-store-postgres workspace deps + kafkajs/pg/@types/pg devDeps） |
| `pnpm-lock.yaml` | +15（自动同步） |
| `packages/application/src/e2e/test-harness.ts` | 新建 255 行（commit 3） |
| `packages/application/src/e2e/test-harness.e2e.test.ts` | 新建 137 行（commit 4；4 self-check tests） |
| `docs/decisions/0004-...md` | +78 行（commit 5: Step 1 段 8 子段 + 11 拒绝候选） |
| `docs/phase11/03-...md` | 本文件（commit 6） |
| `docs/00-phase1-mapping.md` | Phase 11 Step 1 完成段（commit 6） |
| `docs/phase11/PHASE-11-STEP-1-DESIGN-DRAFT.md` | 删除（commit 6；设计沉淀到 ADR + 本记录） |

**测试增量**：+4（self-check tests）→ 1990 → 1994 total
**业务代码 git diff**：0（Phase 1-10 业务代码 0 修改；仅 Step 1 新建 e2e 框架）
**lockfile**：+15 行（kafkajs + pg + @types/pg 移到 application devDeps；元规则 P 累计 32 步零新依赖维持 — 这些是 transitive deps 已在 Phase 8 引入 adapter packages，仅 application package.json 显式声明）
**workspace 包数**：24 维持
**错误码总数**：84 维持（0 新增）

---

## C. 设计决策

### C.1 强制开局动作 1-5 执行确认

| # | 内容 | 状态 |
|---|------|------|
| 1 | 宪法 §13/§15/§20.2 + 补充文档 §8.2-8.4/§9.1/§9.4/§13.1 + ADR-0004 全段重读 | ✅ |
| 2 | KNOWN-ISSUES KI 盘点（KI-P8-002 RESOLVED / KI-P8-003 已知重复 / KI-P9-001 Step 4-6 触发预告） | ✅ |
| 3 | ADR-0004 360+ 行 + Step 1 段准备 | ✅ |
| 4 | 八项主题专属核查 A-H | ✅ |
| 5 | 4 项独立命令 baseline (with-PG-Kafka canonical) | ✅ |

**🚨 §B.1.A 关键留痕**：强制开局动作 1 揭露 `f9e2831` 未入 main（PR #14 merge commit 5521739 second-parent = 8c45c13）。Step 1 PR 第一个 commit (`9e8e2e3`) re-apply 5 行 diff 修复 §B.1.A 违规。详见 ADR-0004 §S1.7。

### C.2 8 个核心裁决最终选择

| # | 裁决 | 锁定 |
|---|------|------|
| K.1 | Testcontainers 引入 | **α 不引入**（元规则 P 32 步零依赖严守；与 Kickoff K.4 倾向变化；详见 §S1.1 一致性留痕）|
| K.2 | docker-compose 升级 | **β 加 postgres + kafka**（与 ci.yml 1:1）|
| K.3 | e2e fixture 框架 | **α 共享 helper** `packages/application/src/e2e/test-harness.ts` |
| K.4 | ci.yml | **α 维持 4 jobs**（e2e 在现有 test job） |
| K.5 | CONTRIBUTING.md | **α 不升级**（Step 11 收官） |
| K.6 | 0 新增（除 K.1 评估） | 惯例 K 第 30 次 |
| K.7 | 测试数 | 1990 + 4 = 1994 ✓（远超 1900 下限） |
| K.8 | ADR-0004 Step 1 段 | **78 行**（含 §S1.7 push≠merge 教训 + Step 1 Alternatives 11 拒绝候选） |

### C.3 §B.1.A f9e2831 同步 + push≠merge 教训沉淀（核心工程教训）

**Tianqi 工程旅程第二次类似事件**：
- 1st event: Phase 11 Kickoff v1 起草时假设 Phase 10 CLOSED but PR #10 未 merge（ADR-0004 §B.1.A 已记录）
- **2nd event (本 Step)**: Step 0.5 KI 留痕 f9e2831 push 但未 merge

**教训沉淀**：push 到 feature 分支 ≠ merge 到 main；post-push 必须实测 main HEAD 才能完成事实锚定。Phase 11+ 协作纪律延伸 — 用户回执"已 merge"/"全绿"后，AI 在下一 Step Kickoff 强制实测 main HEAD。

### C.4 Kickoff K.4 vs Step 1 K.1 一致性留痕

Phase 11 Kickoff K.4 决议 α+β 组合（Testcontainers 本地 + GitHub Actions services CI）。Step 1 PHASE_DESIGN 实地评估发现 **α 不引入** 更合适。**Kickoff 决议 = 大方向；Step 实地裁决 = 细节锁定；不冲突**。这是拆两阶段 + Kickoff 不锁定的工程价值——实地评估让 Kickoff 倾向被精确修正。

### C.5 元规则 / 惯例触发情况

| 元规则 / 惯例 | 触发 |
|--------------|------|
| 元规则 B（接口冻结） | ✓ 严守（Phase 1-10 业务代码 0 修改；新建 e2e 框架不修既有接口） |
| 元规则 D（注释讲为什么） | ✓ 严守（test-harness.ts 大量注释 + ADR §S1.7 教训沉淀） |
| 元规则 K（错误码 / Port / Adapter / 包 / 依赖新增） | ✓ 第 30 次实战；0 新错误码 / 0 新 Port / 0 新 Adapter / 0 新 workspace 包 / 0 新第三方依赖 |
| 元规则 L（PR 工程规范） | ✓（PR #15 创建建议） |
| 元规则 M（ADR 增量追写） | ✓ 第 32 次 + 跨 Phase 第 13 次（ADR-0004 Step 1 段 78 行） |
| 元规则 N（测试是门禁） | ✓ 严守（self-check 4 测试 + 4 命令终测） |
| 元规则 P（无第三方依赖） | ✓ 累计 32 步零依赖维持（kafkajs + pg 是 Phase 8 既有 transitive；application package.json 显式声明不算新增） |
| 元规则 Q（开局动作） | ✓ 第 14 次 v3 模板实战 |
| 惯例 K | ✓ 第 30 次（0 新增） |
| 惯例 L | ✓（4 jobs 独立维持） |
| 惯例 M | ✓ 第 32 次 + 跨 Phase 第 13 次 |
| 拆两阶段流程 | ✓ 第 9 次实战（v1 PHASE_DESIGN + APPROVE + PHASE_IMPLEMENT） |

---

## D. 代码变更

详见 §B 文件清单。6 commits 落地：

1. `9e8e2e3` docs(known-issues): re-apply KI-P8-003 second occurrence record (§B.1.A sync)
2. `535a588` ci(compose): upgrade docker-compose.yml with postgres + kafka services (K.2 β)
3. `4c09d85` test(e2e): create createE2eHarness fixture framework (K.3 α)
4. `962cf45` test(e2e): add 4 self-check tests verifying harness usability
5. `9b0bd48` docs(decisions): append ADR-0004 Step 1 section + Step 1 Alternatives
6. (本 commit) docs: add Phase 11 Step 1 execution record + mapping + delete draft

---

## E. 风险点

### E.1 createE2eHarness fakeEngineHttp + clockMode v1 仅接口预留
Step 2-6 + Step 7 实地使用时可能发现 v1 接口不够灵活 → fixture API 演进 v1 → v2；通过 Step 起草指令实地裁决。

### E.2 cleanup 并发触发（finally + afterAll defensive）
self-check 测试既有 finally `cleanup()` 又有 afterAll defensive cleanup；二次调用 idempotent（test 4 验证不抛）。如 Step 2-6 实战发现 cleanup 鲁棒性不足 → 增强。

### E.3 KafkaJS Connection Crash 在并发 harness 创建时
self-check test 3 并发两个 harness 创建偶尔 KafkaJS 警告 "Consumer Crash"，但测试结果 PASS（与 Step 0.5 §D.5 同精神；timing-sensitive race 但 retry 内置）。如 Step 2-6 实战频繁触发 → 考虑 ensureTopicReady 内嵌 harness。

### E.4 application package.json deps 显式声明（kafkajs / pg）
之前 application 通过 workspace dep（event-store-postgres / notification-kafka）间接使用 kafkajs / pg。Step 1 test-harness.ts 直接 import 这些包做 cleanup → 必须显式声明 devDeps。元规则 P 累计步数维持（这些是 transitive deps 上升到顶层，不是新引入）。

### E.5 docker-compose β tianqi 服务 env vars
tianqi 服务连接 postgres/kafka 用 service name DNS（`postgres:5432` / `kafka:9092`）；host 上连接用 `localhost:5432` / `localhost:9092`（端口 publish）。文档已在 docker-compose.yml 注释明示。

---

## F. 测试计划与双轨 baseline

| 维度 | A no-PG-Kafka | B with-PG-Kafka canonical |
|------|---------------|-------------------------|
| pnpm lint | ✅ 0 warnings | ✅ 0 warnings |
| pnpm typecheck | ✅ 全绿 | ✅ 全绿 |
| pnpm test 总数 | 1990 + 4 = **1994** | 1990 + 4 = **1994** |
| pnpm test PASS (no-infra) | maintained baseline (e2e 4 测试 skipped) | — |
| **pnpm test PASS (canonical)** | — | **1992 PASS + 2 skipped**（4 新增 e2e 测试激活）|
| pnpm test:coverage (canonical) | — | **87.16% / 80.10% / 96.29% / 87.16%**（slight delta vs Step 0.5 baseline；e2e 代码 +97 lines 但只在 with-PG-Kafka 路径覆盖；接近持平）|

---

## G. 验收结果

### G.1 硬底 H1-H12

| 硬底 | 状态 |
|------|------|
| H1 测试 ≥ 1900 | ✅ 1994 |
| H2 覆盖率 ≥ 85% | ✅ canonical 87.16% |
| H3 4 命令全 PASS | ✅ |
| H4 PHASE_DESIGN 草案 | ✅ |
| H5 本机 commit 不 push | ✅ |
| H6 APPROVE 后启动 | ✅ |
| H7 e2e fixture 框架创建 | ✅ |
| H8 ADR-0004 Step 1 段 | ✅（78 行；惯例 M 第 32 次） |
| H9 push 成功 | ⏳（commit 6 后 push） |
| H10 CI 第一次 PR 运行 PASS | ⏳（待 PR #15 创建） |
| H11 PR #15 创建建议 | ✅ (本记录 §H 输出) |
| H12 main CI 转绿 | ⏳（待 PR #15 merge） |

### G.2 commit SHA / feature 分支

- feature 分支：`claude/phase-11-step-1-end-to-end-test-framework`（从 `5521739` 干净 main 拉取）
- PHASE_DESIGN: `c403e7f`（draft；commit 6 删除）
- PHASE_IMPLEMENT 6 commits：`9e8e2e3` → `535a588` → `4c09d85` → `962cf45` → `9b0bd48` → 本 commit

---

## H. PR #15 创建建议

**标题**：
```
Phase 11 / Step 1: End-to-End Test Framework (createE2eHarness)
```

**描述要点**：
- Summary: createE2eHarness fixture 框架 + docker-compose β + KI-P8-003 §B.1.A sync
- Why: Phase 11 主题"端到端集成验证"基础设施层与主题核心层之间桥梁
- Test Plan: 4 self-check tests PASS (1994 total) / coverage 87.16%
- §B.1.A push≠merge 教训留痕
- 6 commits（含 KI-P8-003 留痕 + docker-compose + harness + self-check + ADR + docs）

---

## I. Step 2 衔接预告

Step 2 = **端到端顺利路径（Liquidation 全流程）**

Step 2 严重依赖 Step 1：
- createE2eHarness fixture 框架就位（本 Step）
- docker-compose β 协调（本 Step）
- Testcontainers 决策 α 锁定（本 Step；§S1.1）
- §S1.7 push≠merge 教训沉淀（Step 2 强制开局动作 1 必须实测 main HEAD）

Step 2 实地评估：
- 接入 external-engine-http-base 假引擎 HTTP 服务（fakeEngineHttp 接口实施）
- Liquidation Saga 全流程端到端测试（多 step 编排 + 真实 EventStore + 真实 Notification + 假引擎）

Step 2 起草指令独立承接（不在本 Step 范围）。
