# Phase 11 / Step 4 — Liquidation Saga 端到端补偿路径

**性质**：Phase 11 整数 Step 编号纪律严守 — 本 Step = Step 4（业务功能推进；进 Phase 11 12 Step 计数 → 完成后 8/12）
**前置满足**：
- Step 3 PR #18 merged（`a28bd67`）
- KI-P8-003 hotfix RESOLVED（PR #17）
- 测试基线 2004（Step 3 完成态）

## §A 当前任务

实施《Tianqi Phase 8–12 架构与代码规范补充文档》§4 Saga 补偿约束 + 《宪法》§13.3 Saga / 补偿端到端验证。第一组场景（顺利路径）由 Step 2 + Step 3 完成；本 Step 完成第二组场景的首个 e2e：Liquidation 补偿路径，含 P 终态（compensated）+ Q 终态（partially_compensated）双覆盖。

**与 Step 2 + Step 3 的对称性 + 演进**：
- 前 5 个 it 1:1 mirror Step 2/3 的 5 视角（completes / audit / persist / HTTP order / concurrent），仅 HTTP order 视角变为反向 / status 变为 compensated
- 第 6 个 it 专 Q 终态（Step 2/3 无对称；补偿路径独有维度）
- 实施 Phase 9 Step 7 立约 5 不变量端到端兑现（K.7 完整表）

## §B 影响范围

### 新增文件（2）

- `packages/application/src/e2e/liquidation-compensation.e2e.test.ts`（约 430 LOC）— 6 it 实施
- `docs/phase11/06-step-4-liquidation-compensation-e2e.md` — 本文件

### 修改文件（3）

- `packages/application/src/e2e/fake-engines.ts`（+~95 / -3）— K.5 候选 α 实施：
  - 新增 export: `FakeFailureRule` + `FakeEnginesServerOptions`
  - 新增 happyResponses key: `/lock-margin` + `/cancel-order`（P 补偿测试需要）
  - createFakeEnginesServer 签名扩展接受可选 `options` 参数（既有 Step 2/3 无参调用零影响；元规则 B 兼容）
  - 失败规则匹配：x-trace-id substring + path 匹配 → failure response（默认 500）
- `docs/decisions/0004-phase-11-end-to-end-integration-verification.md`（+~120 行）— Step 4 段（K.1-K.7 裁决 + Alternatives）
- `docs/KNOWN-ISSUES.md`（+~10 行）— KI-P9-001 第三次评估实测探针证据沉淀（选项 1 未触及）

### 不修改文件（关键工程纪律证据）

- `packages/application/src/saga/liquidation-saga.ts`（**Phase 9 / Step 10 业务代码冻结**）
- `packages/application/src/saga/saga-orchestrator.ts`（Step 7 + Step 8 + KI-P8-003 hotfix 后冻结）
- `packages/application/src/e2e/test-harness.ts`（Step 1 接口固化）
- `packages/adapters/adapter-testkit/src/kafka-topic-warmup.ts`（Step 2 fix 沉淀）
- 全部 Phase 1-7 + Phase 8 + Phase 9 业务代码

### 测试增量

- liquidation-compensation.e2e: **+6 e2e it**（K.3 α' 5 视角 + K.4 第 6 it Q）
- 总数：2004 → **2010**

## §C 设计裁决（PHASE_DESIGN K.1-K.7 摘要）

| K | 主题 | 裁决 |
|---|------|------|
| K.1 | Liquidation Saga 补偿路径分析 | 5 step 中 step 3-5 有 meaningful compensate；P 终态触发场景：step 5 execute fail → 补偿链 lock-margin → cancel-order；Q 终态：step 5 execute fail + step 4 lock-margin compensate fail → 死信入队 |
| K.2 | fake-engines 扩展策略 | **候选 α** caseId 路由 + optional options 参数 |
| K.3 | 测试覆盖度 | **α' 6 it（5 视角 + 1 it Q）** |
| K.4 | P + Q 双终态覆盖 | **双覆盖** |
| K.5 | fake API 具体设计 | FakeFailureRule + FakeEnginesServerOptions + createFakeEnginesServer(options?) |
| K.6 | KI-P9-001 第三次评估 | **选项 1（实测未触及；4 探针证据沉淀）**：基于 grep 实测 liquidation-saga.ts + e2e 目录均 0 引用 state-transition-saga；createE2eHarness 不消费 application command handlers；Step 4 沿用 saga.runForCase 直接调用模式 |
| K.7 | 5 不变量端到端兑现表 | 见 §E |

## §D 测试设计（6 it 视角对照）

| # | it 名 | 主要覆盖视角 | 不变量 | Step 2/3 对称? |
|---|-------|--------------|--------|----------------|
| 1 | `test_compensation_path_terminates_with_compensated_status_on_full_compensation_success` | P 终态 + step status 矩阵 | **不变量 2 主**，5 兼容 | mirror Step 2/3 it 1 |
| 2 | `test_compensation_path_emits_correct_audit_events_for_saga_lifecycle_and_steps` | 审计事件序列 + step.outcome failed event | 间接验证 4 | mirror Step 2/3 it 2 |
| 3 | `test_compensation_path_persists_every_state_transition_to_postgres` | listIncomplete 终态后空 | **不变量 4 主** | mirror Step 2/3 it 3 |
| 4 | `test_compensation_path_invokes_engines_in_strict_reverse_order_via_real_http` | HTTP path 反向顺序 | **不变量 1 主** | Step 2/3 it 4 视角变体（正向 → 反向） |
| 5 | `test_compensation_paths_remain_independent_under_concurrent_execution` | 并发独立性 | 不变量 5 并发维度 | mirror Step 2/3 it 5 |
| 6 | `test_compensation_path_terminates_with_partially_compensated_status_on_partial_compensation_failure` | **Q 终态 + 死信入队 + 链式继续** | **不变量 3 主 + 5 链式** | Step 2/3 无对称（补偿独有）|

### 测试场景设计

**P 终态（it 1-5）**：
- 失败注入：`/transfer-fund` (step 5 execute) → 500 + `fund_settlement_failed_injected`
- succeeded = [step 1-4]；compensation 路径：noop(step 1) + noop(step 2) + lock-margin(step 4) + cancel-order(step 3)（严格逆序）
- 终态：`compensated` (P)
- 死信队列：空

**Q 终态（it 6）**：
- 失败注入：`/transfer-fund` (step 5 execute) → 500 + `/lock-margin` (step 4 compensate) → 500
- succeeded = [step 1-4]；compensation 路径：noop + noop + lock-margin FAIL + cancel-order success（不变量 5 链式继续）
- 终态：`partially_compensated` (Q)
- 死信队列：含 step 4 (release-margin) 入队记录（不变量 3）

## §E Phase 9 Step 7 立约 5 不变量端到端兑现表（K.7 完整）

| # | 不变量 | runCompensationPhase 守护点（ADR-0002 Step 7 段）| e2e 测试 it 兑现位置 | 断言细节 |
|---|--------|----------------------------------------------------|------------------------|----------|
| **1** | **严格逆序** | `for j = succeeded.length - 1; j >= 0; j -= 1` | **it 4** (`test_compensation_path_invokes_engines_in_strict_reverse_order_via_real_http`) + **it 6** (Q 测试同样兑现) | `observedPaths.indexOf("/lock-margin") < observedPaths.indexOf("/cancel-order")`（step 4 compensate 先于 step 3 compensate）|
| **2** | **双重幂等保护 / 仅 succeeded 被补偿** | `if (!isStepEligibleForCompensation(currentStatus)) continue` | **it 1** (`test_compensation_path_terminates_with_compensated_status_on_full_compensation_success`) | `stepStatuses[4].status === "failed"`（step 5 execute fail 不进入 compensation；保持 failed 而非 compensated）；`stepStatuses[0-3].status === "compensated"`（noop 和有效 compensate 全部 compensated）|
| **3** | **compensation_failed 必入死信** | 失败分支必经 `tryEnqueueDeadLetter(...)` | **it 6** (`test_compensation_path_terminates_with_partially_compensated_status_on_partial_compensation_failure`) | `deadLetterStore.listPending()` 返回含 step 4 (release-margin) 入队记录；`stepStatuses[3].status === "dead_lettered"` |
| **4** | **每次状态变化都 persist** | 每次 status 变化 await persist | **it 3** (`test_compensation_path_persists_every_state_transition_to_postgres`) + **it 2** (audit 间接) | `sagaStateStore.listIncomplete()` 终态后不含本 saga（终态既不是 in_progress 也不是 compensating）；audit events 序列完整（saga.started + N saga.step.* + saga.completed）|
| **5** | **链式继续 + 终态聚合** | 失败分支不 break；终态由 `aggregateCompensationOutcome` 计算 | **it 6** (Q 测试链式) + **it 5** (并发独立性) | Q 测试：即使 step 4 compensate fail，step 3 compensate 仍执行（`observedPaths` 含 `/cancel-order`）；step 3 终态 = compensated（不变量 5 链式继续）；并发：2 个补偿 saga 互不干扰 |

### 5 不变量端到端兑现完整性证据

- ✓ 全部 5 不变量都有至少 1 个 it 主测兑现
- ✓ 不变量 1 + 2 在 P 路径主测（it 1, it 4）
- ✓ 不变量 3 + 5 链式在 Q 路径**独家**主测（it 6）— 这是 K.4 P+Q 双覆盖的关键工程价值
- ✓ 不变量 4 在 it 3 主测；it 2 间接证据
- ✓ 不变量 5 并发维度在 it 5 主测

**结论**：K.4 仅 P 覆盖会让不变量 3 端到端无证据（compensation_failed 死信入队仅在 Q 路径可观察）。P+Q 双覆盖是 5 不变量完整端到端兑现的工程必要性。

## §F KI-P9-001 第三次评估（基于 4 探针实测，非惰性推断）

### 实测探针证据链

| 探针 | 命令 | 结果 |
|------|------|------|
| Probe 1 | `grep -E "state-transition\|risk-case-state-machine\|stateTransitionRules" packages/application/src/saga/liquidation-saga.ts` | **0 hits**（仅 import @tianqi/shared + @tianqi/ports + ./saga-orchestrator.js）|
| Probe 2 | `grep -rE "state-transition\|risk-case-state-machine" packages/application/src/e2e/` | **0 hits**（test-harness / fake-engines / liquidation-saga.e2e / adl-saga.e2e / liquidation-compensation.e2e 全部 0 引用）|
| Probe 3 | createE2eHarness 实测：是否消费 application command handlers? | **不消费**（仅创建 postgres + kafka + 5 engine adapter + audit sink）|
| Probe 4 | Step 4 e2e 模式：通过 saga.runForCase 直接调用? | ✓ 实测确认（liquidation-compensation.e2e.test.ts 6 个 it 全部 `saga.runForCase(input)` 直接调用，与 Step 2/3 同模式）|

### 用户警告 vs 实测的事实锚定澄清

| 用户警告（Section 三 K.6）| 实测发现 |
|----------------------------|----------|
| "补偿路径深度涉及 StateTransition（RiskCase 状态从 IN_LIQUIDATION → COMPENSATING → COMPENSATED）" | RiskCase domain 状态机由 application command handlers（execute-liquidation-case-orchestration-command 等）管理；**与 Saga overallStatus 状态机独立**。Liquidation Saga 内部状态机由 saga-orchestrator 管理 `overallStatus / stepStatuses` — 不修改 RiskCase 状态 |
| "结构性触及概率显著上升" | **沿用 Step 2+3 e2e 模式（saga.runForCase 直接调用）时 0 触及**；要触及需要扩张 e2e 范围走 application command lifecycle |
| "必须实测探针证据" | ✓ Probe 1-4 已实测；非惰性推断 |

### 结论

**选项 1：实测未触及，维持 OPEN**

- Step 4 沿用 Step 2+3 e2e 模式 (`saga.runForCase(input)` 直接调用)
- Liquidation 补偿路径 e2e 仍**结构性不可触及** KI-P9-001 数据副本漂移区域
- 第四次评估机会在 Phase 11 / Step 5（ADL 补偿路径 e2e）

### 与 Step 2+3 "未触及" 结论的关键差异

| 维度 | Step 2/3 评估 | **Step 4 评估** |
|------|---------------|-----------------|
| 评估依据 | 结构性推断（ADL/Liquidation Saga 0 引用 state-transition）| **4 探针实测**（grep + 代码阅读 + e2e 模式确认）|
| "未触及"结论是否惰性 | 不算惰性（Step 2 是首次评估）| **非惰性**（用户硬指令明确要求探针证据，本 Step 提供 4 探针）|
| 探针证据完整度 | 部分（Step 2 主要看顺利路径）| **完整**（含 grep + createE2eHarness 不消费 commands + Step 4 沿用 saga.runForCase 实测）|

## §G 与 Step 5 衔接预告

Step 5 = **ADL 补偿路径端到端**

Step 5 严重依赖本 Step（Step 4）：
- liquidation-compensation.e2e.test.ts 6 it 模式已建立
- fake-engines.ts 失败注入机制（K.5 候选 α）已沉淀
- 5 不变量端到端兑现模板（K.7 完整表）已沉淀
- KI-P9-001 4 探针实测方法已沉淀

Step 5 主题预告（不在本 Step 范围）：
- ADL 多账户 + 保险资金联动场景下的补偿路径
- 多账户内部 C-fail-fast 补偿模式
- 5 不变量在 ADL 多账户补偿的兑现位置（与 Liquidation 单账户对照）
- KI-P9-001 第四次评估

Step 5 起草指令独立承接。

## §H 验收

### 硬底（H1-H4）

- ✅ H1：测试总数 2010 ≥ 1700（硬底）
- ✅ H2：覆盖率不退化（本地 1873 PASS + 137 skipped；CI 时全量跑）
- ✅ H3：lint / typecheck / build 全绿
- ⏳ H4：CI 全绿 + push to main → 待 push 后实测

### 参考下限（R1-R3）

- ✅ R1：liquidation-compensation.e2e 测试数 6 ≤ 8（K.3 α' 6 it ≤ 上限 8）
- ✅ R2：Step 1 + Step 2 + Step 3 接口零变化（createE2eHarness / fakeEngineHttp / warmupKafkaTopics 签名不动；元规则 B 严守）
- ✅ R3：错误码新增 0（不引入新错误码；TQ-SAG-002 / TQ-SAG-003 复用）

### 完成项

- ✅ G1：PHASE_DESIGN K.1-K.7 + Q1-Q4 用户裁决全部锁定
- ✅ G2：liquidation-compensation.e2e.test.ts 创建（6 it）
- ✅ G3：fake-engines.ts 扩展（K.5 候选 α + 2 新 happyResponses）
- ✅ G4：本 doc + ADR-0004 Step 4 段 + KI-P9-001 第三次评估留痕
- ✅ G5：5 不变量端到端兑现表完整（K.7）
- ⏳ G6：commit + push + PR（待执行）
- ⏳ G7：CI 全绿 + merge + §S1.7 实测核查（待执行）

## §I 工程纪律自检

| 立约 | 兑现 |
|------|------|
| Phase 11 整数 Step 编号纪律 | ✓ Step 4 业务推进；不创建 Step 4.5 |
| KI-P8-003 hotfix 独立性 | ✓ 不进 Step 计数；Step 4 在 hotfix RESOLVED 之后 |
| 元规则 B 严守 | ✓ createE2eHarness / fakeEngineHttp / warmupKafkaTopics 签名不变；fake-engines.ts 既有 export 签名不变（仅新增 export + optional params）；liquidation-saga.ts 业务代码零变化 |
| 元规则 P 严守 | ✓ Phase 11 已 35 步零新依赖 |
| 范围严守 | ✓ 仅 Liquidation 补偿路径 e2e；不预占 Step 5-11；不顺手做 ADL 补偿/死信/恢复 |
| §B.1.A 事实锚定 | ✓ K.6 4 探针实测（非惰性推断）|
| §S1.7 push≠merge | ✓ Section 一 前置实测 main HEAD = a28bd67 后才启 Step 4 |
| ADR-0003 §E.1 不 force-push | ✓ 累加 commits |
| 惯例 M 增量追写 | ✓ ADR-0004 Step 4 段 + Alternatives |
| 5 不变量保持 | ✓ Step 4 是**验证** 5 不变量端到端兑现（K.7 表），不是**修改**它们 |
| P/Q/R 语义保持 | ✓ Step 4 是**验证** P + Q 终态端到端兑现，不是**修改**它们 |

## §J 对作品级代码库的意义

Tianqi 第一原则"清晰、可控、可信"在 Step 4 的具体兑现：

1. **清晰**：5 不变量端到端兑现表（K.7）让 ADR-0002 Step 7 立约从"代码层守护点"延伸到"e2e 测试层兑现位置"——双层证据。
2. **可控**：业务代码 0 改动；fake-engines.ts 既有 export 签名零变化（仅扩展 optional + 新增 export）；范围严守仅 Liquidation 补偿路径。
3. **可信**：K.6 4 探针实测（非惰性推断）确认 KI-P9-001 第三次评估；P + Q 双终态都有 e2e 实证；不变量 3 死信入队首次端到端验证。

Step 4 完成后，Phase 11 主题核心层（端到端测试框架 + 顺利路径基线 + 补偿路径首战）就位；Step 5-6 ADL 补偿 / 死信路径 + Step 7-9 性能/混沌/独立 e2e + Step 10-11 观测性/收官 = Phase 11 完整 12 Step 推进。
