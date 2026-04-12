# Phase 3 / Step 8 — Acceptance Gate 定义 + 策略配置封板门禁清单固化 + Gate Runner 雏形落地

## 为什么 Step 8 先做 Gate / Checklist

Step 7 产出了完整的 Phase3AcceptanceInputSnapshot（差异矩阵 + 漂移摘要 + blocking/notice 分类），但尚未存在"判定器"来回答：**当前是否可以进入 Phase 3 封板收口**。Step 8 的目标是将 acceptance input 转化为结构化的 gate 判定结果，为 Step 9–10 的最终封板确认提供直接前置输入。

先定义 gate 再做 final close 的原因：gate 是可重复、可回归的自动化门禁；final close 是人工确认动作。gate 必须先稳定，才能支撑 close。

## Gate 模型

`Phase3AcceptanceGateResult` 包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| gateId | string | 本次门禁运行 ID |
| gateStatus | `pass` / `pass_with_notice` / `fail` | 门禁判定三态 |
| checkResults | Phase3AcceptanceGateChecklistItem[] | 全部检查项结果 |
| passedChecks | number | 通过检查数 |
| failedChecks | number | 失败检查数 |
| warningChecks | number | 警告检查数 |
| blockingIssues | string[] | 阻断项理由 |
| nonBlockingNotices | string[] | 非阻断 notice |
| gateSummary | string | 人可读总结 |
| recommendedDecision | 三态 | 推荐决策 |

`recommendedDecision` 映射：
- `pass` → `ready_for_phase3_close_preparation`
- `pass_with_notice` → `ready_with_notices`
- `fail` → `not_ready_for_phase3_close_preparation`

## 门禁清单（8 类检查项）

每个 `Phase3AcceptanceGateChecklistItem` 包含 `checkId`、`status`（pass/warning/fail）、`reason`、`blocking`、`relatedArtifacts`。

| # | checkId | 语义 | 推导来源 |
|---|---------|------|----------|
| 1 | policy_bundle_resolution_stable | 策略 bundle 解析在策略场景中无 preflightPassed 漂移 | blockingIssues（S 前缀 + preflightPassed） |
| 2 | policy_dry_run_stable | dry-run 在所有场景中无 dryRunPassed 漂移 | blockingIssues（dryRunPassed） |
| 3 | strategy_matrix_covered | 策略场景数 >= 5 | strategyScenarioIds.length |
| 4 | config_version_matrix_covered | 配置版本场景数 >= 6 | configVersionScenarioIds.length |
| 5 | no_blocking_core_field_drift | 无任何 blocking 级核心字段漂移 | blockingIssues.length |
| 6 | activation_chain_consistent | 激活链路字段一致 | blockingIssues（activationStatus/currentActiveVersion/rollbackAvailable） |
| 7 | audit_diff_readview_consistent | 审计/diff/readview 一致 | blockingIssues（auditAction）+ notices（diffSummary/policySelectionSummary） |
| 8 | no_blocking_failure_semantic_mismatch | 差异矩阵整体状态非 failed | differenceMatrixOverallStatus |

## Gate Runner 如何消费 Acceptance Input

`runPhase3AcceptanceGate(gateId, acceptanceInput)` 接收 `Phase3AcceptanceInputSnapshot`，依次执行 8 个独立 evaluator，每个 evaluator 从 acceptance input 的特定字段推导出 `Phase3AcceptanceGateChecklistItem`。汇总后按以下规则判定：

### gateStatus 判定

- **fail**：任一 `blocking: true` 且 `status: "fail"` 的检查项存在
- **pass_with_notice**：无 blocking failure，但至少一个 warning 检查项存在
- **pass**：所有检查项均 pass

### recommendedDecision 映射

- pass → ready_for_phase3_close_preparation
- pass_with_notice → ready_with_notices
- fail → not_ready_for_phase3_close_preparation

## 本步不做

- 不做最终封板确认（Step 9–10）
- 不做 final acceptance runner
- 不做外部配置中心 / 发布平台 / UI / API
- 不做执行编排层
- 不扩算法或策略实现

## 下一步建议

- Step 9：Phase 3 最终封板准备 + 剩余边界补齐
- Step 10：Phase 3 最终总验收 + 封板确认 + 冻结文档
