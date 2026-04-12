# Step 29：最终边界补齐 + Final Gate / Pre-Close Checklist 冻结 + Step 30 封板确认跑法固化

## 定位

Step 29 是 Phase 2 封板前最后一次实质性补齐。Step 30 只允许做最终总验收、封板确认、冻结文档。

## 本步边界

### 本步做了

1. **识别并补齐 Z 系列最终边界场景**（Z1–Z4 全部落地）
2. **冻结 Final Acceptance Gate 为最终版**（`PHASE2_FINAL_ACCEPTANCE_GATE_RULESET`，version = vFinal）
3. **冻结 Pre-Close Checklist 为最终版**（`PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS`，6 项全阻断）
4. **固化 Step 30 最终验收跑法**（`PHASE2_STEP30_RUNBOOK`，7 步执行序列 + 4 必需产物）
5. **新增最终一致性校验器**（`validatePhase2CloseReadinessConsistency`）
6. **完整测试覆盖**（17 个测试：ready/notice/fail 路径 + Z1–Z4 + 一致性校验 + 结构校验 + 语义兼容）

### 本步没做

- 新业务模型 / 新平台
- UI / API / dashboard
- 自动审批 / 自动发布
- 外部接入
- 治理模板扩张

## Final Gate 冻结（vFinal）

`PHASE2_FINAL_ACCEPTANCE_GATE_RULESET` 包含：

| 维度 | 内容 |
|------|------|
| Blocking drift fields | riskLevel, manualActionHint, requiresAttention, requiresRepairAction, requiresManualReview, isCrossSessionConsistent, explanationStatus（7 项） |
| Notice-only drift fields | aggregateSummary, recommendedNextStep（2 项） |
| Failure semantic strictness | strict |
| Escalation threshold | 3（≥3 non-blocking drifts 升级为 fail） |
| Gate checks | 8 项（baseline_core_fields_stable 等） |
| Decision mapping | pass → ready_for_phase2_close, pass_with_notice → ready_with_notices, fail → not_ready_for_phase2_close |

Step 30 直接消费此规则集，不再修改。

## Pre-Close Checklist 冻结（最终版）

`PHASE2_FINAL_PRE_CLOSE_CHECKLIST_ITEMS` 共 6 项，全部为 blocking（Step 30 必须全 true）：

| checkId | 说明 |
|---------|------|
| matrixCompleted | 差异矩阵覆盖 ≥12 场景 + ≥3 failure 组合 |
| acceptanceInputBuilt | Acceptance input snapshot 已生成 |
| gateEvaluated | Acceptance gate 已评估 ≥8 项检查 |
| highRiskBoundaryCoveredRound1 | G1–G4 已覆盖 |
| highRiskBoundaryCoveredRound2 | H1–H4 已覆盖 |
| blockingIssuesResolvedOrAcknowledged | 所有 blocking issues 已解决或确认 |

`blockingIssuesResolvedOrAcknowledged` 在 Step 30 的解释：pipeline 执行完成后无未解决的 blockingIssues。若存在，则此项 false → finalAcceptanceStatus = not_ready_to_close。

## Step 30 最终验收跑法（Runbook）

`PHASE2_STEP30_RUNBOOK`（runbookId = phase2-step30-final-acceptance，version = vFinal）

执行顺序：

1. **run_difference_matrix** → 产出 Phase2AggregateDifferenceMatrix
2. **build_acceptance_input** → 产出 Phase2AcceptanceInputSnapshot
3. **run_acceptance_gate** → 产出 Phase2AcceptanceGateResult（8 项检查 + escalation）
4. **run_final_acceptance** → 产出 Phase2FinalAcceptanceResult（pipeline + pre-close checklist）
5. **validate_gate_ruleset** → 验证 PHASE2_FINAL_ACCEPTANCE_GATE_RULESET vFinal 已应用
6. **validate_preclose_checklist** → 验证 6 项 pre-close checklist 全通过
7. **output_close_decision** → 输出最终封板判定

必需产物：Phase2AggregateDifferenceMatrix、Phase2AcceptanceInputSnapshot、Phase2AcceptanceGateResult、Phase2FinalAcceptanceResult

封板判定规则：
- `ready_to_close` → Phase 2 封板
- `ready_with_notices` → 审阅 notice 后封板
- `not_ready_to_close` → 解决后重跑

## 最终边界补齐

| 场景 | 描述 | 预期结论 |
|------|------|---------|
| Z1 | persistence write failure but previously persisted readable | ready_with_notices（notice，非 blocking） |
| Z2 | state missing + fallback unavailable | not_ready_to_close（blocking） |
| Z3 | gate pass_with_notice + pre-close checklist incomplete | not_ready_to_close（checklist 未通过） |
| Z4 | multiple notice escalation + boundary overlap | not_ready_to_close（Rule C 升级 + checklist 未通过） |

全部 4 类均已进入 final acceptance 级测试。

## 最终决策规则

```
ready_to_close：
  pipelineStatus = ready
  AND gateStatus = pass
  AND final gate ruleset 无 blocking 命中
  AND 6 项 pre-close checklist 全通过
  AND blockingIssues 为空

ready_with_notices：
  无 blocking
  AND 存在 notices
  AND pre-close checklist 阻断项全通过

not_ready_to_close（任一命中）：
  gateStatus = fail
  OR pipelineStatus = not_ready
  OR pre-close checklist 存在未通过项
  OR blockingIssues 非空
  OR final gate ruleset 命中 blocking
```

## Close Readiness Consistency Validator

`validatePhase2CloseReadinessConsistency` 校验：
- final acceptance 结论与 gateStatus / pipelineStatus 不冲突
- pre-close checklist 与 close decision 不冲突
- blockingIssues 非空时不能 ready_to_close
- notices-only 情况不能误判为 not_ready_to_close
- gate 检查数 ≥ ruleset 要求的 8 项

## Step 28 语义保持

- 矩阵定义不变（12 场景 + 3 failure 组合）
- 8 项 gate check 不变
- escalation threshold 不变（= 3）
- `runPhase2FinalAcceptance`、`validatePhase2FinalAcceptanceConsistency` 未修改
- 所有 Step 28 测试继续通过

## Step 30 范围限定

Step 30 只做：
1. 最终总验收（按 PHASE2_STEP30_RUNBOOK 执行）
2. 最终封板判定
3. Phase 2 冻结文档
