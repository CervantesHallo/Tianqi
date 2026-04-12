# Phase 4 / Step 5 — Acceptance Gate 定义 + 编排门禁清单固化 + Gate Runner 第一版

## 为什么 Step 5 先做 Gate / Checklist

Step 4 产出了 `Phase4AcceptanceInputSnapshot`（差异矩阵 + 漂移摘要 + blocking/notice 分类），但尚未有"判定器"回答：**当前是否可以进入 Phase 4 封板收口**。Gate 是可重复、可回归的自动化门禁；final close 是人工确认。gate 必须先稳定，才能支撑 close。

## Gate 模型

`Phase4AcceptanceGateResult` 包含 gateId / gateStatus（三态）/ checkResults / passedChecks / failedChecks / warningChecks / blockingIssues / nonBlockingNotices / gateSummary / recommendedDecision（三态）。

## 门禁清单（8 类检查项）

| # | checkId | 语义 | 推导来源 |
|---|---------|------|----------|
| 1 | risk_case_orchestration_stable | RiskCase 编排主路径无 blocking drift | blockingIssues（R 前缀 + resultStatus/sagaStatus） |
| 2 | liquidation_case_orchestration_stable | LiquidationCase 编排无 blocking drift | blockingIssues（L 前缀 + resultStatus/sagaStatus） |
| 3 | replay_semantics_stable | 幂等重放语义稳定 | blockingIssues（idempotencyStatus） |
| 4 | compensation_semantics_stable | 补偿语义稳定 | blockingIssues（pendingCompensation/compensationStatus） |
| 5 | saga_resume_semantics_stable | Saga/恢复语义稳定 | blockingIssues（sagaStatus） |
| 6 | orchestration_matrix_covered | 矩阵覆盖（RC>=5, LC>=5） | scenarioIds.length |
| 7 | no_blocking_core_field_drift | 无 blocking 级核心字段漂移 | blockingIssues.length |
| 8 | cross_path_consistency_passed | 差异矩阵整体一致 | differenceMatrixOverallStatus |

## 判定规则

- **pass**：全部 blocking check = pass，无 warning
- **pass_with_notice**：无 blocking failure，有 warning
- **fail**：任一 blocking check fail

## 本步不做

- 不做 final acceptance runner / close decision
- 不做真实 infra
- 不做 UI / API
- 不扩路径

## 下一步建议

- Step 6：Final Acceptance Runner + Pre-Close Checklist
- Step 7：Phase 4 最终封板
