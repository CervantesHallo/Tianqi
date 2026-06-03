# Phase 11 / Step 3 — ADL Saga 端到端顺利路径

**性质**：Phase 11 整数 Step 编号纪律严守 — 本 Step = Step 3（业务功能推进；进 Phase 11 12 Step 计数 → 完成后 7/12）
**前置满足**：
- Step 2 PR #16 merged（`9ae3da9`）
- KI-P8-003 独立 hotfix RESOLVED（PR #17 merge commit `d9673dd`；CI 3 次连续 PASS + main CI 4/4 PASS）
- §S1.7 实测核查 PASS（两 commit 全部 in main）

## §A 当前任务

实施《Tianqi Phase 8–12 架构与代码规范补充文档》§8.2 端到端场景最低覆盖第二条——ADL Saga 全流程顺利路径 e2e 测试。第一条 Liquidation Saga e2e 由 Step 2 完成；本 Step 完成第二条 ADL Saga e2e；两者共同形成 Phase 11 顺利路径基线，让 Step 4-6（补偿/死信/恢复）有稳定参考基线。

与 Step 2 模式严格对称（PHASE_DESIGN K.3 α'）：相同 5 个测试视角（completes / audit / persist / HTTP order / concurrent），仅业务流程切到 ADL（多账户公平减仓 + 保险资金联动）。

## §B 影响范围

### 新增文件（2）

- `packages/application/src/e2e/adl-saga.e2e.test.ts`（约 290 LOC）— ADL e2e 5 it 实施
- `docs/phase11/05-step-3-adl-e2e-happy-path.md` — 本文件

### 修改文件（3）

- `packages/application/src/e2e/fake-engines.ts`（+34 / -1）— happyResponses 扩展 2 个 key（`/query-mark-price-batch` + `/query-position`）；不改 export 签名（元规则 B 严守）
- `docs/decisions/0004-phase-11-end-to-end-integration-verification.md`（+~80 行）— Step 3 段增量追写（惯例 M 增量追写继续；含 K.1-K.6 裁决 + Step 3 Alternatives 5 项）
- `docs/KNOWN-ISSUES.md`（+~5 行）— KI-P9-001 Phase 11 / Step 3 ADL e2e 第二次评估留痕（选项 1 未触及）

### 不修改文件（关键工程纪律证据）

- `packages/application/src/saga/adl-saga.ts`（**Phase 9 / Step 11 业务代码冻结**；元规则 B 严守）
- `packages/application/src/saga/saga-orchestrator.ts`（Step 8 + KI-P8-003 hotfix 后冻结；不再触碰）
- `packages/application/src/e2e/test-harness.ts`（Step 1 接口固化 + Step 2 fix iteration #2 增量后冻结；不改 createE2eHarness 接口签名）
- `packages/adapters/adapter-testkit/src/kafka-topic-warmup.ts`（Step 2 fix iteration #2 沉淀；不改 warmupKafkaTopics 接口）
- `packages/application/src/e2e/liquidation-saga.e2e.test.ts`（Step 2 锁定 5 it；不改）
- 全部 Phase 1-7 代码、Phase 8 Adapter、Phase 9 saga 业务代码、Phase 10 CI workflow

### lockfile 变动

- `pnpm-lock.yaml` — 零变动（Phase 11 已 33 步零新依赖；含 KI-P8-003 hotfix）

### 测试增量

- adl-saga.e2e: **+5 e2e it**（与 Step 2 严格对称）
- 总数：1999 → **2004**

## §C 设计裁决（PHASE_DESIGN K.1-K.6 摘要）

| K | 主题 | 裁决 | 关键证据 |
|---|------|------|----------|
| K.1 | ADL Saga 业务流 | 5 step 严格顺序；4 Engine（无 MarginEngine）；ADLSagaPorts=LiquidationSagaPorts 类型别名复用 | adl-saga.ts 666 LOC 实测 + docs/phase9/11 §C 设计裁决 |
| K.2 | Liquidation e2e + fake-engines 实测 | Step 2 = 5 it（用户 prompt 描述 1 it 与实测不一致 → §B.1.A 诚实报告）；fake-engines 复用 2 endpoint + 扩展 2 endpoint | liquidation-saga.e2e.test.ts 行 142/176/224/261/297 5 个 it 实测 |
| K.3 | 测试覆盖度 | **α' = 5 it 与 Step 2 严格对称**（completes / audit / persist / HTTP order / concurrent） | §8.2 顺利路径完整覆盖 + Step 4-6 责任分明 |
| K.4 | fake-engines 扩展策略 | **仅扩展 happyResponses map（2 新 key）**；不改 export 签名；不新增 fake 函数 | 元规则 B 严守 + 单 server 多路径分发设计原则保持 |
| K.5 | docs/phase11/05-step-3 骨架 | 本 doc（§A-§G） | 与 Step 1/2 doc 结构对称 |
| K.6 | KI-P9-001 第二次评估 | **选项 1：未触及，维持 OPEN** | adl-saga.ts 0 引用 state-transition-saga / risk-case-state-machine；ADL 内部状态机由 saga-orchestrator 管理与 StateTransition Saga 完全独立 |

## §D 测试设计（5 it 视角对照）

| # | ADL e2e it 名 | 验证视角 | Step 2 对称 |
|---|---------------|---------|-------------|
| 1 | `test_happy_path_completes_through_5_steps_with_completed_status` | Saga 终态 `completed` + 5 step 全 succeeded | Step 2 it 1 |
| 2 | `test_happy_path_audit_events_emitted_for_each_of_5_steps_plus_saga_lifecycle` | saga.started + saga.completed + 5 个 saga.step.* events with stepName payload | Step 2 it 2 |
| 3 | `test_happy_path_saga_state_persists_to_real_postgres_after_completion` | listIncomplete 不含 completed saga | Step 2 it 3 |
| 4 | `test_happy_path_4_engine_endpoints_called_via_real_http_in_expected_order` | 4 distinct paths 顺序首次出现 + 多账户 call 次数 ≥ 期望（query-position ≥ 2 / place-order ≥ 2 / transfer-fund ≥ 3） | Step 2 it 4（差异：ADL 4 endpoint 不含 release-margin）|
| 5 | `test_happy_path_two_concurrent_adl_sagas_both_complete_independently` | 并发 2 saga 同 completed + 不同 sagaId + ≥ 16 calls | Step 2 it 5 |

### EXPECTED_STEP_PATHS (ADL 4 distinct paths)

```ts
const EXPECTED_STEP_PATHS = [
  "/query-mark-price-batch",   // step 1: fetch-mark-prices
  "/query-position",            // step 2: verify-targets (× N)
  "/place-order",               // step 3: submit-deleveraging-orders (× N)
  "/transfer-fund"              // step 4 + 5: insurance × 1 + settle × N
] as const;
```

### EXPECTED_STEP_NAMES (ADL 5 step names; audit event payload)

```ts
const EXPECTED_STEP_NAMES = [
  "fetch-mark-prices",
  "verify-targets",
  "submit-deleveraging-orders",
  "insurance-fund-deduction",
  "settle-account-funds"
] as const;
```

## §E ADL 业务流概览（实测自 adl-saga.ts）

### 5 Step 序列

| # | Step | Engine 调用 | 写? | Compensate | 多账户循环 |
|---|------|-------------|-----|------------|-----------|
| 1 | fetch-mark-prices | MarkPriceEngine.queryMarkPriceBatch (单调用 N symbols) | ❌ | noop | 否 |
| 2 | verify-targets | PositionEngine.queryPosition × N targets | ❌ | noop | 是（C-fail-fast）|
| 3 | submit-deleveraging-orders | MatchEngine.placeOrder × N targets | ✅ | cancel-orders 反向 N | 是（C-fail-fast）|
| 4 | insurance-fund-deduction | FundEngine.transferFund (单笔) | ✅ | reverse-insurance 单笔 | 否 |
| 5 | settle-account-funds | FundEngine.transferFund × N targets | ✅ | reverse-settlements 反向 N | 是（C-fail-fast）|

### 多账户复杂度封装

C-fail-fast 模式（Phase 9 / Step 11 裁决 1）：多账户复杂度封装在 step 内部循环；任一账户失败 → 整个 step 失败 → 触发逆序补偿。对编排器透明（编排器视角看到 saga 5 step；不感知多账户）。

本 Step 3 顺利路径覆盖默认 2 个 targets（双账户多账户场景；step 内部循环验证 ≥ 2 次循环）；补偿 / 死信 / 恢复路径中的多账户失败场景由 Step 4-6 承接。

### ADLSagaPorts 类型复用（裁决 3）

`ADLSagaPorts = LiquidationSagaPorts` 类型别名 100% 复用——ADL 与 Liquidation 都消费"5 业务 Engine + 3 saga 基础设施"；业务差异通过 Input 字段集表达。e2e 测试仍需传入 5 engine 全集（含 margin，ADL 不调用但类型签名要求；harness.engines 已就绪 5 个真实 HTTP adapter）。

## §F 与 Step 2 / Step 4-6 衔接

### 与 Step 2 形成顺利路径基线

| 维度 | Step 2 Liquidation | Step 3 ADL |
|------|---------------------|------------|
| 测试视角数 | 5 | 5（K.3 α' 严格对称）|
| 业务复杂度 | 单账户 5 step | 多账户 5 step + 保险资金联动 |
| 测试增量 | +5 (1996→1999) | +5 (1999→2004) |
| 共享 fixture 框架 | createE2eHarness | createE2eHarness（同接口）|
| 共享 fake-engines | 5 endpoint | 5 endpoint + 2 新 |
| 共享 warmupKafkaTopics | testkit helper | testkit helper（同）|

→ 顺利路径基线建立（2 个业务 Saga × 5 视角 = 10 e2e 实证）；Step 4 补偿路径可在此基线上启动。

### 与 Step 4-6 衔接

| Step | 主题 | 与本 Step 关系 |
|------|------|----------------|
| Step 4 | 端到端补偿路径（Liquidation 补偿全流程）| 基于 Step 2 顺利路径基线；KI-P9-001 第三次评估 |
| Step 5 | 端到端死信路径 | 基于 Step 4 补偿基线；KI-P9-001 第四次评估 |
| Step 6 | 端到端恢复路径 | 基于 Step 5 死信基线；KI-P9-001 第五次评估 |
| Step 7-9 | 性能/混沌/InsuranceFund / StateTransition 独立 e2e | 在 Step 6 完整 4 路径基线上展开 |
| Step 10-11 | 观测性 + Phase 收官 | Step 1-9 全部就位后展开 |

### KI-P9-001 评估机会序列

| 评估机会 | 时机 | 结果 |
|----------|------|------|
| 第一次 | Phase 11 / Step 2 Liquidation e2e | 未触及（顺利路径不涉及 StateTransition；docs/decisions/0004 ADR §K.6 裁决 6 β 采纳）|
| **第二次** | **Phase 11 / Step 3 ADL e2e（本 Step）** | **未触及（K.6 选项 1）** — ADL Saga 与 StateTransition Saga 独立 application 层模块 |
| 第三次 | Phase 11 / Step 4 Liquidation 补偿 e2e | TBD（Step 4 起草指令承接）|
| 第四次 | Phase 11 / Step 5 死信 e2e | TBD |
| 第五次 | Phase 11 / Step 6 恢复 e2e | TBD |

## §G 验收

### 硬底（H1-H4）

- ✅ H1：测试总数 2004 ≥ 1700（硬底；超过 304）
- ✅ H2：覆盖率不退化（本地全量 1873 PASS + 131 skipped；Postgres / Kafka services 已 KI-P8-002 + e2e 本地 skip 模式锁定，CI 时全量跑）
- ✅ H3：lint / typecheck / build 全绿
- ⏳ H4：CI 全绿 + push to main → 待 push 后实测

### 参考下限（R1-R3）

- ✅ R1：adl-saga.e2e 测试数 5 ≤ 5（K.3 α' 与 Step 2 严格对称；测试增量边界严守）
- ✅ R2：Step 1 + Step 2 接口零变化（createE2eHarness / fakeEngineHttp / warmupKafkaTopics 接口签名全部不动；元规则 B 严守）
- ✅ R3：错误码新增 0（不引入新错误码）

### 完成项（G1-G15）

- ✅ G1：Phase 11 强制开局动作完成（重读两份文档 + KNOWN-ISSUES + ADR-0001/0002/0003/0004）
- ✅ G2：ADL Saga 业务流实测分析（K.1）
- ✅ G3：Liquidation e2e + fake-engines 实测分析（K.2）
- ✅ G4：测试覆盖度裁决 K.3 α'（5 it 与 Step 2 严格对称）
- ✅ G5：fake-engines 扩展裁决 K.4（仅扩展 happyResponses；不改 export）
- ✅ G6：KI-P9-001 第二次评估 K.6 选项 1（未触及，维持 OPEN）
- ✅ G7：adl-saga.e2e.test.ts 创建（5 it 全部实施）
- ✅ G8：fake-engines.ts 扩展（2 新 happyResponses key；不改 export）
- ✅ G9：本 doc 创建
- ✅ G10：ADR-0004 Step 3 段增量追写（惯例 M 严守）
- ✅ G11：KI-P9-001 第二次评估留痕（docs/KNOWN-ISSUES.md）
- ✅ G12：不修改 Step 1-2 接口（createE2eHarness / fakeEngineHttp / warmupKafkaTopics 零变化；元规则 B 严守）
- ✅ G13：不修改 Phase 9 ADL Saga 业务代码（元规则 B 严守）
- ⏳ G14：commit + push + PR 创建（待执行）
- ⏳ G15：CI 全绿 + merge + §S1.7 实测核查（待执行）

## §H Step 4 衔接预告

Step 4 = **端到端补偿路径（Liquidation 补偿全流程）**

Step 4 严重依赖：
- Liquidation + ADL 顺利路径基线已建立（本 Step 完成后达成）
- fakeEngineHttp 已就绪
- e2e 测试模式已成熟（2 个顺利路径 e2e 文件作为参考）

Step 4 主题预告（不在本 Step 范围）：
- 补偿路径触发条件（《补充文档》§4 + Phase 9 Step 7 立约 5 不变量）
- 补偿路径终态（P/Q：compensated / partially_compensated）
- fake-engines.ts 可能扩展按 caseId 选择性失败注入
- KI-P9-001 第三次评估（补偿涉及 RiskCase 状态机更深）

Step 4 起草指令独立承接（不在本 Step 范围）。

## §I 对作品级代码库的意义

Tianqi 第一原则"清晰、可控、可信"在 Step 3 的具体兑现：

1. **清晰**：与 Step 2 模式严格对称（5 视角 1:1 mirror）让 Step 1-3 形成稳定的 e2e 测试范式；后续 Step 4-9 套用同样模板即可
2. **可控**：业务代码 0 改动（Phase 9 ADL Saga 完全冻结；元规则 B 严守）；fake-engines 仅 internal const 扩展（不改 export）；范围严守仅 KI-P9-001 第二次评估留痕
3. **可信**：§B.1.A 事实锚定（实测发现 Step 2 = 5 it 而非 1 it，诚实报告）+ §S1.7 push≠merge（hotfix merge 实测确认后才启动）+ K.6 KI-P9-001 实测 ADL Saga 0 引用 state-transition-saga（选项 1 有实证支撑）

Step 1-3 完成后，Phase 11 主题核心层（端到端测试框架 + 2 个顺利路径基线）就位；Step 4-6 端到端 4 路径覆盖 + Step 7-9 性能/混沌/独立 e2e + Step 10-11 观测性 + 收官 = Phase 11 完整 12 Step 进度推进。
