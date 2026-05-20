# Phase 11 / Step 2 — 端到端顺利路径 Liquidation 全流程

> 启动日：2026-05-20 | feature 分支：`claude/phase-11-step-2-liquidation-end-to-end` | PR：#16（待用户创建）
> 元规则 Q v3 模板第 15 次实战 / 本 Step 不拆两阶段（Step 1 fixture 决策已锁定；Step 2 主题相对成熟）

---

## A. 当前任务

Phase 11 主题核心层（端到端 4 路径覆盖）第一个工程价值实现 Step。createE2eHarness fixture 框架（Step 1 创建）+ fakeEngineHttp 接口（Step 1 预留 → Step 2 实施）+ 5 个 Liquidation Saga 端到端测试在真实 Postgres + 真实 Kafka + 真实 HTTP wire path 下完整跑通。

---

## B. 影响范围

| 文件 | 变更 |
|------|------|
| `packages/application/src/e2e/fake-engines.ts` | 新建 210 行（commit 1：5 happy-path endpoint；Node.js http 模块） |
| `packages/application/src/e2e/test-harness.ts` | +79 / -5（commit 2：fakeEngineHttp 接口实施 + engines 字段） |
| `packages/application/src/e2e/liquidation-saga.e2e.test.ts` | 新建 339 行（commit 3：5 e2e tests） |
| `docs/decisions/0004-...md` | +53 行（commit 4：Step 2 段 8 子段 + 6 拒绝候选） |
| `docs/phase11/04-...md` | 本文件（commit 5） |
| `docs/00-phase1-mapping.md` | Phase 11 Step 2 完成段（commit 5） |

**测试增量**：+5 e2e tests → 1994 → 1999 total
**业务代码 git diff**：0（Phase 1-10 业务代码 0 修改）
**lockfile**：0 变更（元规则 P 累计 32 步零依赖维持）
**workspace 包数**：24 维持
**错误码总数**：84 维持（0 新增）

---

## C. 设计决策

### C.1 强制开局动作 1-5 执行确认

| # | 内容 | 状态 |
|---|------|------|
| 1 | 宪法 + 补充文档 + ADR-0004 全段 + Step 1 fixture 文件重读 | ✅ |
| 2 | KNOWN-ISSUES 4 项 open 盘点（KI-P9-001 Step 2 首次评估时机） | ✅ |
| 3 | ADR-0004 510 行 + Step 2 段准备（惯例 M 第 33 次 + 跨 Phase 第 14 次） | ✅ |
| 4 | 八项主题专属核查 A-H | ✅ |
| 5 | 4 项独立命令 baseline (with-PG-Kafka canonical) | ✅ |

**🚨 §S1.7 教训严守应用**：执行前实测 `origin/main` HEAD = `a72cb52`（PR #15 merge）；`9e8e2e3` (KI-P8-003 sync) + `c764d9f` (Step 1 final) 验证真入 main（merge-base --is-ancestor）。Step 1 §S1.7 "push≠merge" 教训实地应用 — 不假设、不推断、实测确认。

### C.2 7 个核心裁决最终选择

| # | 裁决 | 锁定 |
|---|------|------|
| 1 | e2e 测试文件位置 | **β `packages/application/src/e2e/`** |
| 2 | 测试用例数 | **5 测试**（5-7 中位） |
| 3 | fakeEngineHttp 实施 | **α 在 src/e2e/ 创建 fake-engines.ts**（Node.js http） |
| 4 | createE2eHarness 扩展 | **接口实施**（Step 1 预留 → Step 2 兑现） |
| 5 | 0 新增 | 惯例 K 第 31 次实战 |
| 6 | KI-P9-001 评估 | **β Liquidation 顺利路径未触发；维持监控；推迟 Step 4-6** |
| 7 | ADR-0004 Step 2 段 | **50 行**（含 KI-P9-001 评估 + S2.5 工程价值描述） |

### C.3 createE2eHarness fakeEngineHttp 接口实施细节

Step 1 接口预留 (`fakeEngineHttp?: { port: number }` placeholder) → Step 2 真实类型 (`fakeEngineHttp?: FakeEnginesServer`)。

`E2eHarness` 新增 `engines?` 字段（5 Engine HTTP adapter；仅当 fakeEngineHttp 传入时创建）。adapter 全部 baseUrl 指向 fakeServer.url（单 server 多路径分发）。cleanup 扩展 shutdown 5 adapter（顺序：notification → engines → stores）。

**向后兼容**：不传 fakeEngineHttp = harness.engines = undefined（Step 0/0.5/Step 1 self-check 模式延续工作）。

### C.4 Liquidation 顺利路径覆盖测试用例清单（5 测试）

| # | 测试 | 验证维度 |
|---|------|---------|
| 1 | happy_path_completes_through_5_steps_with_completed_status | Saga 终态 + 5 step succeeded |
| 2 | happy_path_audit_events_emitted_for_each_of_5_steps_plus_saga_lifecycle | §15 审计要求 |
| 3 | happy_path_saga_state_persists_to_real_postgres_after_completion | §8.1 真实 Postgres 持久化 |
| 4 | happy_path_5_engine_endpoints_called_via_real_http_in_expected_order | §8.2 真实 HTTP wire path |
| 5 | happy_path_two_concurrent_liquidations_both_complete_independently | 并发独立性 |

**实测全 PASS**（with-PG-Kafka canonical apache/kafka:3.7.2 + postgres:16-alpine）。

### C.5 KI-P9-001 评估结果（裁决 6 β 详细）

KI-P9-001 = StateTransition Saga 数据副本漂移（Phase 9 / Step 13 引入；Phase 11 端到端 4 路径可能触发）。

**Step 2 是 Phase 11 端到端 4 路径首次评估时机**（动作 4 G）。评估方法：5 个 e2e tests 全 PASS（包括 SagaStateStore 持久化测试 + 2 并发 Liquidation 测试）；test #3 显式验证 listIncomplete 返回不含 completed sagaId（真实 Postgres 持久化语义）；test #5 验证并发 saga 不同 sagaId 互不干扰。

**评估结论**：Liquidation 顺利路径未触发 KI-P9-001。**状态**：维持监控；推迟 Step 4-6（恢复路径涉及 saga state 数据漂移）进一步评估。**不主动修复**（裁决 6 β；违反主题专注度）。

### C.6 三处工程问题 + 处置（PHASE_IMPLEMENT 实测发现）

1. **fake-engines OrderStatus 枚举不匹配** → `status: "submitted"` 改为 `"filled"` (`/place-order`)
2. **fake-engines TransferStatus 枚举不匹配** → `status: "submitted"` 改为 `"completed"` (`/transfer-fund`)
3. **测试断言 event prefix 误用** → `eventType.startsWith("step.")` 改为 `startsWith("saga.step.")`

3 问题都属 "测试 fixture 与 Phase 8 既有 adapter 契约对齐"；不修业务代码；ADR-0004 §D 已有边界澄清（"测试 vs adapter 默认语义不一致" 分类）。

### C.7 元规则 / 惯例触发情况

| 元规则 / 惯例 | 触发 |
|--------------|------|
| 元规则 B（接口冻结） | ✓ 严守（Phase 1-10 业务代码 0 修改） |
| 元规则 D（注释讲为什么） | ✓ 严守（fake-engines + test-harness 大量注释） |
| 元规则 K（错误码 / Port / Adapter / 包 / 依赖新增） | ✓ 第 31 次实战；0 新增 |
| 元规则 L（PR 工程规范） | ✓（PR #16 创建建议） |
| 元规则 M（ADR 增量追写） | ✓ 第 33 次 + 跨 Phase 第 14 次（ADR-0004 Step 2 段 50 行） |
| 元规则 N（测试是门禁） | ✓ 严守（5 e2e tests + 4 命令终测） |
| 元规则 P（无第三方依赖） | ✓ 累计 32 步零依赖维持（Node.js 内置 http；无 express/koa） |
| 元规则 Q（开局动作） | ✓ 第 15 次 v3 模板实战 |
| 惯例 K | ✓ 第 31 次（0 新增） |
| 惯例 L | ✓（4 jobs 独立维持） |
| 惯例 M | ✓ 第 33 次 + 跨 Phase 第 14 次 |
| 拆两阶段流程 | ✗ 不触发（Step 2 主题成熟；Step 1 fixture 决策已锁定） |
| §B.1.A + §S1.7 实地应用 | ✓ 强制开局动作 1 实测 main HEAD + 验证 commits 真入 main |

---

## D. 代码变更

详见 §B 文件清单。5 commits 落地：

1. `f88fdf8` test(e2e): create fake-engines.ts HTTP server for Liquidation 5 endpoints
2. `c25c883` test(e2e): implement fakeEngineHttp interface in createE2eHarness
3. `71b2f2c` test(e2e): create liquidation-saga.e2e.test.ts (5 tests)
4. `4b87d08` docs(decisions): append ADR-0004 Step 2 section
5. (本 commit) docs: add Phase 11 Step 2 execution record + mapping

---

## E. 风险点

### E.1 fakeEngineHttp 接口设计可能不够灵活（Step 3-6 演进）
v1 仅支持 happy-path 单一响应（按 path 固定 JSON）。Step 3 ADL 可能新增 endpoint（adjust-position 等）；Step 4-6 补偿 / 死信 / 恢复路径需要选择性失败注入。**Phase 11+ 演进路径**：扩展 fakeEngineHttp 选项支持 fault injection（如 `failNextNCalls(path, n)`）；按需 Step 3 起评估。

### E.2 PHASE_IMPLEMENT 实测发现 3 处工程问题
ADR-0004 §D "测试 vs adapter 默认语义不一致" 分类延伸（详见 §C.6）。这是 Phase 11 "真实激活揭露隐藏假设"模式的延续——Step 0/0.5 揭露 adapter 缺陷；Step 2 揭露 fake-engines 与 adapter 契约对齐细节。

### E.3 KafkaJS Connection Crash 偶发警告
Liquidation Saga test #5 并发 2 saga 可能出现 KafkaJS Consumer Crash stderr 警告（与 Step 0.5 §D.5 同精神；timing-sensitive race；不影响测试结果 PASS）。

### E.4 KI-P9-001 未触发 ≠ 已修复
Step 2 顺利路径稳定 PASS 不代表 KI-P9-001 已 RESOLVED。**Step 4-6 必修复评估**（恢复路径涉及 saga state 数据漂移直接触发）。

### E.5 CI 第一次 e2e 测试运行可能时序敏感
本机实测全 PASS 但 CI 环境时序差异（Step 0.5 §D.5 教训）可能让 e2e 测试偶发触发。如 CI 首次运行偶发 → Re-run（与 KI-P8-003 处理模式一致）。

---

## F. 测试计划与双轨 baseline

| 维度 | A no-PG-Kafka | B with-PG-Kafka canonical |
|------|---------------|-------------------------|
| pnpm lint | ✅ | ✅ |
| pnpm typecheck | ✅ | ✅ |
| pnpm test 总数 | 1999 (含 5 e2e skipped) | 1999 (5 e2e 激活) |
| pnpm test PASS | maintained baseline | **1997 PASS + 2 skipped** |
| pnpm test:coverage canonical | — | **87.21% / 80.17% / 96.32% / 87.21%** |

---

## G. 验收结果

### G.1 硬底 H1-H13

| 硬底 | 状态 |
|------|------|
| H1 测试 ≥ 1900 | ✅ 1999 |
| H2 覆盖率 ≥ 85% | ✅ 87.21% canonical |
| H3 4 命令全 PASS | ✅ |
| H4 fake-engines.ts 创建 | ✅ |
| H5 createE2eHarness fakeEngineHttp 接口实施 | ✅ |
| H6 liquidation-saga.e2e.test.ts + 5 tests PASS | ✅ |
| H7 KI-P9-001 评估完成 | ✅（裁决 6 β；维持监控） |
| H8 ADR-0004 Step 2 段 | ✅（50 行；惯例 M 第 33 次） |
| H9 push 成功 | ⏳ (commit 5 后 push) |
| H10 CI Step 2 PR 第一次双 services PASS | ⏳ (待 PR #16 创建) |
| H11 PR #16 创建建议 | ✅ (本记录 §H) |
| H12 main CI 转绿 | ⏳ (待 PR #16 merge) |
| H13 §S1.7 实测核查 | ⏳ (PR #16 merge 后强制实测;§S1.7 push≠merge 教训严守) |

### G.2 §S1.7 main HEAD 实测核查输出（Phase 11+ 协作纪律延伸应用）

**Step 2 强制开局动作 1 已实测**：
```
origin/main HEAD: a72cb52 ✓
git merge-base --is-ancestor 9e8e2e3 origin/main → in main ✓
git merge-base --is-ancestor c764d9f origin/main → in main ✓
```

**PR #16 merge 后** 用户回执前必须再次实测（H13）：
```bash
git fetch origin main
git ls-remote origin refs/heads/main  # 应是新 PR #16 merge commit
git merge-base --is-ancestor 71b2f2c origin/main  # Liquidation e2e tests commit
git merge-base --is-ancestor 4b87d08 origin/main  # ADR-0004 Step 2 commit
```

---

## H. PR #16 创建建议

**标题**：
```
Phase 11 / Step 2: Liquidation Saga End-to-End Happy Path (createE2eHarness 真实使用)
```

**描述要点**：
- Summary: 5 e2e tests for Liquidation Saga 5-step happy path; fakeEngineHttp 接口实施; KI-P9-001 评估
- Why: Phase 11 主题核心层首个工程价值实现; §8.1 + §8.2 + §15 完整兑现
- 5 commits + 测试基线 1994 → 1999 + coverage 87.21%
- KI-P9-001 维持监控 (Liquidation 顺利路径未触发)

---

## I. Step 3 衔接预告

Step 3 = **端到端顺利路径（ADL 全流程）**

Step 3 严重依赖 Step 2：
- createE2eHarness fakeEngineHttp 接口已实施（本 Step）
- fake-engines.ts helper 已创建（ADL 可能复用 + 扩展 endpoint）
- liquidation-saga.e2e.test.ts 模式可复用到 adl-saga.e2e.test.ts

预期 Step 3 工作量小于 Step 2（fixture 框架已就位 + ADL Saga 与 Liquidation 模式相似）。Step 3 完成后 §8.2 顺利路径覆盖完整达成。

Step 3 起草指令独立承接（不在本 Step 范围）。
