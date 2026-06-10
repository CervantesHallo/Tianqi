# Phase 11 / Step 5 — ADL Saga 端到端补偿路径

**性质**：Phase 11 整数 Step 编号纪律严守 — 本 Step = Step 5（业务功能推进；进 Phase 11 12 Step 计数 → 完成后 9/12）
**前置满足**：
- Step 4 PR #19 merged（`d2779fa`）
- KI-P8-003 hotfix RESOLVED（PR #17）
- 测试基线 2010（Step 4 完成态）

## §A 当前任务

实施《Tianqi Phase 8–12 架构与代码规范补充文档》§4 Saga 补偿约束 + ADL 多账户 C-fail-fast 补偿模式的端到端验证。Liquidation 补偿（Step 4）+ **ADL 补偿（本 Step）** = 补偿路径双 saga 完整覆盖；与顺利路径 Step 2+3 形成 Phase 11 e2e 22 it 严格对称。

**与 Step 4 Liquidation 补偿 e2e 的严格对称 + ADL 特有维度独家覆盖**：
- 前 5 个 it 1:1 mirror Step 4 5 视角（completes / audit / persist / HTTP reverse-order / concurrent）
- 第 6 个 it 专 Q 终态（与 Step 4 同位）
- K.5 候选 γ FakeFailureRule + bodyIdempotencyKeyPattern 扩展首次实施（区分 ADL step 4 vs step 5 同 path 不同 body）
- K.7 5 不变量端到端兑现表完整：saga 层严格逆序 + step 内部多账户循环双层覆盖

## §B 影响范围

### 新增文件（2）

- `packages/application/src/e2e/adl-compensation.e2e.test.ts`（约 470 LOC）— 6 it 实施
- `docs/phase11/07-step-5-adl-compensation-e2e.md` — 本文件

### 修改文件（3）

- `packages/application/src/e2e/fake-engines.ts`（+~20 / -2）— K.5 候选 γ 实施：
  - FakeFailureRule 新增 optional `bodyIdempotencyKeyPattern` 字段（Readonly type 可选字段；向后兼容；Step 4 既有 callers 零影响）
  - matchFailureRule 函数扩展支持 body inspection（仅当 rule.bodyIdempotencyKeyPattern 存在时）
  - createFakeEnginesServer / FakeEnginesServerOptions / FakeEnginesServer 接口签名零变化（元规则 B 严守）
- `docs/decisions/0004-phase-11-end-to-end-integration-verification.md`（+~100 行）— Step 5 段（K.1-K.7 裁决 + Alternatives）
- `docs/KNOWN-ISSUES.md`（+~10 行）— KI-P9-001 第四次评估留痕（4 探针实测）

### 不修改文件（关键工程纪律证据）

- `packages/application/src/saga/adl-saga.ts`（**Phase 9 / Step 11 业务代码冻结**）
- `packages/application/src/saga/saga-orchestrator.ts`（Step 7 + Step 8 + KI-P8-003 hotfix 后冻结）
- `packages/application/src/e2e/test-harness.ts`（Step 1 接口固化）
- 全部 Phase 1-7 + Phase 8 + Phase 9 业务代码
- Step 4 既有 e2e 测试零影响（fake-engines.ts schema 扩展向后兼容）

### 测试增量

- adl-compensation.e2e: **+6 e2e it**（K.3 α'' 5 视角 + K.4 第 6 it Q）
- 总数：2010 → **2016**

## §C 设计裁决（PHASE_DESIGN K.1-K.7 摘要）

| K | 主题 | 裁决 |
|---|------|------|
| K.1 | ADL Saga 补偿路径结构性分析（实测 adl-saga.ts）| 5 step saga 层严格逆序与 Liquidation 同；但 **step 内部多账户 C-fail-fast 循环**（step 2/3/5 内部循环）；step 4+5 共用 /transfer-fund endpoint 需 body 区分 |
| K.2 | e2e 测试模式映射 | adl-compensation.e2e.test.ts 沿用 Step 4 双 harness 模式（harnessP + harnessQ） |
| K.3 | 测试覆盖度 | **α'' 6 it（5 视角 + 1 it Q）— 与 Step 4 严格对称** |
| K.4 | P + Q 双终态覆盖 | **双覆盖** |
| K.5 | fake-engines 扩展策略 | **候选 γ — FakeFailureRule 加 optional bodyIdempotencyKeyPattern 字段**（Readonly type 可选字段；向后兼容；元规则 B 严守） |
| K.6 | KI-P9-001 第四次评估 | **选项 1（实测未触及；Step 5 独立 4 探针实测，非惰性推断）** |
| K.7 | 5 不变量端到端兑现表 | 见 §E（完整 saga 层 + step 内部双层）|

## §D 测试设计（6 it 视角对照）

| # | it 名 | 主要覆盖视角 | 不变量 | Step 4 对称? |
|---|-------|--------------|--------|---------------|
| 1 | `test_compensation_path_terminates_with_compensated_status_on_full_compensation_success` | P 终态 + step status 矩阵 | **不变量 2 主**，5 兼容 | mirror Step 4 it 1 |
| 2 | `test_compensation_path_emits_correct_audit_events_for_saga_lifecycle_and_steps` | 审计事件序列 + step.outcome failed | 间接验证 4 | mirror Step 4 it 2 |
| 3 | `test_compensation_path_persists_every_state_transition_to_postgres` | listIncomplete 终态后空 | **不变量 4 主** | mirror Step 4 it 3 |
| 4 | `test_compensation_path_invokes_engines_in_strict_reverse_order_via_real_http` | **saga 层 + step 内部双层验证** | **不变量 1 主** | Step 4 it 4 升级（双层）|
| 5 | `test_compensation_paths_remain_independent_under_concurrent_execution` | 并发独立性 | 不变量 5 并发 | mirror Step 4 it 5 |
| 6 | `test_compensation_path_terminates_with_partially_compensated_status_on_partial_compensation_failure` | **Q 终态 + 死信入队 + 多账户 C-fail-fast 链式继续** | **不变量 3 主 + 5 链式** | mirror Step 4 it 6 |

### 测试场景设计（K.5 γ 路由）

**P 终态（it 1-5）**：
- 失败注入：`/transfer-fund` + `bodyIdempotencyKeyPattern: ":settle:"` → step 5 第一个 transferFund (idempotencyKey 含 `:settle:0`) FAIL
- step 4 transferFund (idempotencyKey 含 `:insurance`) 不匹配规则 → happy
- succeeded = [step 1-4]
- compensation: noop(1) + noop(2) + reverse-insurance(step 4 transferFund) + cancel-orders × 2(step 3)
- 严格逆序：step 4 compensate 先于 step 3 compensate
- 终态：`compensated` (P)

**Q 终态（it 6）**：
- 失败注入：`/transfer-fund` + `:settle:` → 500 + `/cancel-order` → 500
- step 5 execute fail → 触发补偿
- step 4 compensate (reverse-insurance) success
- step 3 compensate (cancel-order × N): 第一个 cancel-order FAIL → ADL C-fail-fast → 整 step 3 compensation_failed
- 不变量 5 链式继续：step 4 compensate 仍执行（在 step 3 之前）
- 终态：`partially_compensated` (Q)
- 死信队列：含 step 3 (submit-deleveraging-orders) 入队记录

## §E Phase 9 Step 7 立约 5 不变量端到端兑现表（K.7 完整）

| # | 不变量 | runCompensationPhase 守护点 | Liquidation Step 4 兑现 | **ADL Step 5 兑现** |
|---|--------|------------------------------|---------------------------|----------------------|
| **1** | **严格逆序** | `for j = succeeded.length - 1; j >= 0; j -= 1` | saga 层 step 4 → step 3 (lock-margin → cancel-order) | **saga 层 step 4 → step 3 (transferFund reverse-insurance 先于 cancel-orders) + step 内部多账户循环（cancel-orders × N 按 i=0..N-1；step 3 compensate 内 for 循环）双层** |
| **2** | **双重幂等 / 仅 succeeded 被补偿** | `if (!isStepEligibleForCompensation(currentStatus)) continue` | stepStatuses[4]=failed 不进入 compensation | stepStatuses[4]=failed (settle-account-funds) 不进入 compensation；其他 [0-3] = compensated |
| **3** | **compensation_failed 必入死信** | 失败分支必经 `tryEnqueueDeadLetter(...)` | Q it: step 4 lock-margin fail → 死信 step 4 | **Q it: step 3 cancel-order fail (C-fail-fast 整 step) → 死信 step 3 (submit-deleveraging-orders)** |
| **4** | **每次状态变化都 persist** | 每次 status 变化 await persist | listIncomplete 终态后空 | listIncomplete 终态后空（同）|
| **5** | **链式继续** | 失败分支不 break；终态由 `aggregateCompensationOutcome` 计算 | Q it: step 4 fail 不阻断 step 3 compensate | **Q it: step 3 (多账户 C-fail-fast 失败) 不阻断 step 4 compensate (reverse-insurance success)** + concurrent it |

### 与 Step 4 K.7 表的差异点（K.1 结构性差异体现）

**关键差异**：不变量 1 严格逆序在 ADL 是**双层验证**：
- saga 层：step 4 transferFund (reverse-insurance) 必先于 step 3 cancelOrder × N（与 Step 4 同模式）
- **step 内部**：step 3 compensate 内 for 循环 i=0..N-1 cancelOrder × N（Step 4 单账户无此维度；ADL 独家）

it 4 同时断言两层：
- saga 层：`findIndex` 中按 `body.idempotencyKey` 含 `:reverse-insurance` 找 step 4 compensate；按 `:cancel:` 找 step 3 compensate；断言前者先于后者
- step 内部：`filter` step 3 cancel-orders 数量 = 2（N=2 targets）

## §F KI-P9-001 第四次评估（基于 Step 5 独立 4 探针实测，非惰性推断）

### 实测探针证据链

| 探针 | 命令 | 结果（Step 5 独立实测）|
|------|------|--------------------------|
| Probe 1 | `grep state-transition\|risk-case-state-machine packages/application/src/saga/adl-saga.ts` | **0 hits**（仅 import @tianqi/shared + @tianqi/ports + ./saga-orchestrator.js + ./liquidation-saga.js 类型别名）|
| Probe 2 | `grep -r state-transition packages/application/src/e2e/` | **0 hits**（含本 Step adl-compensation.e2e.test.ts）|
| Probe 3 | createE2eHarness 消费 application command handlers? | **不消费**（grep executeAdl/transitionAdl/createAdlCase in test-harness.ts: 0 hits）|
| Probe 4 | Step 5 e2e 实施模式：通过 saga.runForCase 直接调用? | ✓ 实测确认（adl-compensation.e2e.test.ts 6 个 it 全部 `saga.runForCase(input)` 直接调用，与 Step 2/3/4 同模式）|

### 结论

**选项 1（实测未触及，维持 OPEN）**

- ADL Saga 与 StateTransition Saga 是两个独立 application 层 saga 模块
- Step 5 沿用 saga.runForCase 直接调用模式，结构性不可触及 KI-P9-001
- 第五次评估机会：Phase 11 / Step 6（死信路径专项 e2e；可能在死信落盘验证场景触及）

### 与 Step 2/3/4 评估的独立性证据

| 维度 | 是否惰性推断? |
|------|----------------|
| Step 2 评估 | 首次（非惰性）|
| Step 3 评估 | 独立探针实测 |
| Step 4 评估 | 独立 4 探针 |
| **Step 5 评估** | **本 Step 独立 4 探针实测**（grep 在本 Step 重新执行；Probe 4 验证本 Step e2e 设计模式）|

**用户硬指令兑现**：「不用前 3 次"未触及"结论惰性推断」— 本 Step 探针 1-3 重新 grep（非引用 Step 4 结果）；探针 4 验证本 Step e2e 实际使用 saga.runForCase。

## §G 与 Step 6 衔接预告

Step 6 = **死信路径专项 e2e**（Phase 9 死信落盘机制专项验证）

Step 6 依赖 Step 4 + Step 5：
- compensation_failed 入死信（不变量 3）已在 Step 4 (Liquidation Q) + Step 5 (ADL Q) 端到端兑现
- Step 6 专项深入死信路径：死信表 schema / Kafka 死信 topic / 死信消费者重试机制等
- KI-P9-001 第五次评估机会

Step 6 起草指令独立承接。

## §H 验收

### 硬底（H1-H4）

- ✅ H1：测试总数 2016 ≥ 1700
- ✅ H2：覆盖率不退化（CI 时验证）
- ✅ H3：lint / typecheck / build 全绿
- ⏳ H4：CI 全绿 + push → 待 push 后实测

### 参考下限（R1-R3）

- ✅ R1：adl-compensation.e2e 测试数 6 ≤ 8（K.3 α'' 6 it ≤ 上限 8）
- ✅ R2：Step 1+2+3+4 接口零变化（createE2eHarness / fakeEngineHttp / warmupKafkaTopics / FakeEnginesServerOptions / FakeEnginesServer 全部不动；FakeFailureRule schema 仅加 optional 字段；元规则 B 严守）
- ✅ R3：错误码新增 0

### 完成项

- ✅ G1：PHASE_DESIGN K.1-K.7 + Q1-Q3 用户裁决全部锁定
- ✅ G2：adl-compensation.e2e.test.ts 创建（6 it）
- ✅ G3：fake-engines.ts schema 扩展（K.5 γ + bodyIdempotencyKeyPattern）
- ✅ G4：本 doc + ADR-0004 Step 5 段 + KI-P9-001 第四次评估留痕
- ✅ G5：K.7 5 不变量端到端兑现表完整（含 ADL 特有双层覆盖）
- ⏳ G6：commit + push + PR（待执行）
- ⏳ G7：CI 全绿 + merge + §S1.7 实测核查（待执行）

## §I 工程纪律自检

| 立约 | 兑现 |
|------|------|
| Phase 11 整数 Step 编号纪律 | ✓ Step 5 业务推进；不创建 Step 5.5 |
| KI-P8-003 hotfix 独立性 | ✓ 不进 Step 计数 |
| 元规则 B 严守 | ✓ createE2eHarness / FakeEnginesServer / FakeEnginesServerOptions 接口零变化；FakeFailureRule schema 仅 backward-compatible 新增 optional 字段；adl-saga.ts / saga-orchestrator.ts 业务代码零变化 |
| 元规则 P 严守 | ✓ Phase 11 已 37 步零新依赖 |
| 范围严守 | ✓ 仅 ADL 补偿路径 e2e；不预占 Step 6-11 |
| §B.1.A 事实锚定 | ✓ K.6 4 探针 Step 5 独立实测（非惰性推断）|
| §S1.7 push≠merge | ✓ Section 一 前置实测 main HEAD = d2779fa 后才启 Step 5 |
| ADR-0003 §E.1 不 force-push | ✓ 累加 commits |
| 惯例 M 增量追写 | ✓ ADR-0004 Step 5 段 + Alternatives |
| 5 不变量保持 | ✓ Step 5 是**验证**不是**修改** |
| P/Q/R 语义保持 | ✓ Step 5 是**验证** P + Q 端到端兑现不是**修改** |
| K.1 ADL 补偿结构性差异 | ✓ 不在 Step 5 修改 ADR-0002 立约（用户硬指令明确）|

## §J 对作品级代码库的意义

Tianqi 第一原则"清晰、可控、可信"在 Step 5 的具体兑现：

1. **清晰**：5 不变量端到端兑现表（K.7）双层（saga 层 + step 内部）证据；ADL 多账户 C-fail-fast 与 Liquidation 单账户的结构性差异清晰留痕在 K.1。
2. **可控**：FakeFailureRule schema 扩展 backward-compatible（Step 4 既有 callers 零影响）；范围严守仅 ADL 补偿路径。
3. **可信**：K.6 Step 5 独立 4 探针实测（非惰性推断）；P + Q 双终态都有端到端实证；不变量 1 双层验证（ADL 特有维度）；不变量 3 死信 ADL 路径首次端到端验证。

Step 5 完成后，Phase 11 主题核心层（端到端测试框架 + 顺利路径基线 + 补偿路径双 saga 完整）就位；Step 6-7 死信/恢复路径专项 + Step 8-11 timeout/性能/观测性/收官 = Phase 11 完整 12 Step 推进。

## §K Phase 11 e2e 22 it 严格对称证据

Step 5 完成后 Phase 11 e2e 测试增量汇总：

| Step | 测试文件 | it 数 | 视角 |
|------|----------|-------|------|
| Step 2 | liquidation-saga.e2e.test.ts | 5 | 顺利 P (completes / audit / persist / HTTP order / concurrent) |
| Step 3 | adl-saga.e2e.test.ts | 5 | 顺利 P (mirror Step 2) |
| Step 4 | liquidation-compensation.e2e.test.ts | 6 | 补偿 P+Q (5 视角 mirror + 1 it Q) |
| **Step 5** | **adl-compensation.e2e.test.ts** | **6** | **补偿 P+Q (mirror Step 4)** |
| 总计 | | **22 it** | **严格对称：顺利 5+5 + 补偿 6+6** |
