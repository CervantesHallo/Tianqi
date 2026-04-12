# Phase 7 / Step 4 — Acceptance Gate 定义 + 发布门禁清单固化 + Gate Runner 第一版

## 为什么 Step 4 先做 Gate / Checklist

Step 3 产出了 `Phase7AcceptanceInputSnapshot`，但尚未有"判定器"。Gate 是可重复、可回归的自动化门禁。

## Gate 模型

`Phase7AcceptanceGateResult`：gateId / gateStatus（三态）/ checkResults / passedChecks / failedChecks / warningChecks / blockingIssues / nonBlockingNotices / gateSummary / recommendedDecision（三态）

## 门禁清单（8 类检查项）

| # | checkId | 语义 | 推导来源 |
|---|---------|------|----------|
| 1 | config_preflight_stable | 配置预检无 blocking drift | blockingIssues（preflightStatus） |
| 2 | contract_freeze_stable | 契约冻结无 blocking drift | blockingIssues（contractBaselineStatus） |
| 3 | rollback_plan_ready | 回滚方案就绪 | blockingIssues（rollbackPlanStatus） |
| 4 | runbook_ready | Runbook 就绪 | blockingIssues（runbookStatus） |
| 5 | release_guard_consistency_stable | 发布守卫一致性 | blockingIssues（summaryStatus） |
| 6 | phase7_matrix_covered | 矩阵覆盖（PF>=5, RR>=5） | scenarioIds.length |
| 7 | no_blocking_core_field_drift | 无 blocking 级核心字段漂移 | blockingIssues.length |
| 8 | preflight_and_rollback_runbook_consistency_passed | 差异矩阵整体一致 | differenceMatrixOverallStatus |

## 本步不做

- 不做 final acceptance runner / close decision
- 不做真实发布平台 / rollback executor
- 不做 Phase 7 最终封板

## 下一步建议

- Step 5：Final Acceptance Runner + Pre-Close Checklist + 最终封板
