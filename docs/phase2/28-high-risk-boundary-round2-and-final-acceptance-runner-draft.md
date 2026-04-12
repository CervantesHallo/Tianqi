# Phase 2 / Step 28: 剩余高风险边界场景补齐（第二轮） + Acceptance Gate 收紧（第一轮） + Final Acceptance Runner 雏形固化

## 本步做了什么

### 1. Acceptance Gate 收紧（Rule C: Notice 升级机制）

在 Step 26 的 8 条 checklist 基础上，新增 notice 升级规则：
- 当非阻断性漂移 ≥ `PHASE2_NOTICE_ESCALATION_THRESHOLD`（当前=3）时，`pass_with_notice` 升级为 `fail`
- 升级时在 blockingIssues 中注入 `notice_escalation` 明确原因
- 单一 notice 仍为 `pass_with_notice`（既有行为不变）

**收紧规则汇总**：

| 规则 | 条件 | gate 结论 |
|------|------|----------|
| Rule A | blocking core field drift / failure semantic mismatch | fail（已在 Step 26 实现）|
| Rule B | aggregateSummary/recommendedNextStep 非阻断漂移 | pass_with_notice（已在 Step 26 实现）|
| Rule C | ≥3 个非阻断漂移同时出现 | 升级为 fail（本步新增）|

### 2. Final Acceptance Runner (runPhase2FinalAcceptance)

封装 pipeline 并叠加 pre-close checklist 判定：
1. 内部调用 `runPhase2AcceptancePipeline`
2. 构建 pre-close checklist（6 项）
3. 综合判定 `finalAcceptanceStatus`
4. 输出结构化 `Phase2FinalAcceptanceResult`

**状态映射**：

| pipeline + checklist 状态 | finalAcceptanceStatus |
|--------------------------|---------------------|
| pipeline=ready, 全部 checklist 通过 | ready_to_close |
| pipeline=ready_with_notices, 全部 checklist 通过 | ready_with_notices |
| pipeline=not_ready 或 checklist 有未通过 | not_ready_to_close |

### 3. Pre-close Checklist (Phase2PreCloseChecklist)

| 检查项 | 数据来源 |
|--------|---------|
| matrixCompleted | pipeline.differenceMatrix 场景/组合覆盖 |
| acceptanceInputBuilt | pipeline.acceptanceInput 非空 |
| gateEvaluated | pipeline.acceptanceGate ≥8 checks |
| highRiskBoundaryCoveredRound1 | 外部输入标记 |
| highRiskBoundaryCoveredRound2 | 外部输入标记 |
| blockingIssuesResolvedOrAcknowledged | pipeline.blockingIssues 为空 |

### 4. 第二轮高风险边界场景（4 类全部落地）

| 边界 | 场景 | 预期行为 |
|------|------|---------|
| H1 | 跨步骤一致性异常（repair path requiresRepairAction drift）| not_ready_to_close |
| H2 | 历史基线版本兼容 notice（aggregateSummary notice drift）| ready_with_notices |
| H3 | Failure semantic mismatch but core fields stable（recommendedNextStep 漂移）| not_ready_to_close |
| H4 | Command-link 与 continuity 同时异常（isCrossSessionConsistent + requiresAttention + requiresRepairAction drift）| not_ready_to_close, 多个 gate check 失败 |

### 5. Final Acceptance Consistency Validator

校验 pipeline ↔ final acceptance ↔ pre-close checklist 三者之间不冲突。

## 本步没做什么

- UI / API / dashboard
- 自动发布/自动审批
- 外部 CI/CD 接入
- 新平台 / 外部接入
- 治理模板扩张

## Step 29-30 如何继续完成封板

- Step 29: 最终边界补齐 + 最终 gate/guideline 冻结
- Step 30: 总验收与封板确认 — 一次 `runPhase2FinalAcceptance` → 全面覆盖 → 最终封板
