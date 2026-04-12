# Phase 5 / Step 4 — Acceptance Gate 定义 + Replay 门禁清单固化 + Gate Runner 第一版

## 为什么 Step 4 先做 Gate / Checklist

Step 3 产出了 `Phase5ReplayAcceptanceInputSnapshot`（差异矩阵 + 漂移摘要 + blocking/notice），但尚未有"判定器"。Gate 是可重复、可回归的自动化门禁；final close 是人工确认。gate 必须先稳定，才能支撑 close。

## Gate 模型

`Phase5ReplayAcceptanceGateResult`：gateId / gateStatus（三态）/ checkResults / passedChecks / failedChecks / warningChecks / blockingIssues / nonBlockingNotices / gateSummary / recommendedDecision（三态）

## 门禁清单（8 类检查项）

| # | checkId | 语义 | 推导来源 |
|---|---------|------|----------|
| 1 | single_case_replay_stable | 单案件 replay 无 blocking drift | blockingIssues（S 前缀） |
| 2 | batch_replay_stable | 批运行 replay 无 blocking drift | blockingIssues（B 前缀） |
| 3 | reconstruction_semantics_stable | 重建语义稳定 | blockingIssues（reconstructionStatus/finalState） |
| 4 | comparison_semantics_stable | 比对语义稳定 | blockingIssues（comparisonStatus/hasDifference） |
| 5 | replay_consistency_stable | 聚合一致性稳定 | blockingIssues（failedCases/incompleteCases） |
| 6 | replay_matrix_covered | 矩阵覆盖（SC>=5, BT>=5） | scenarioIds.length |
| 7 | no_blocking_core_field_drift | 无 blocking 级核心字段漂移 | blockingIssues.length |
| 8 | single_and_batch_consistency_passed | 差异矩阵整体一致 | differenceMatrixOverallStatus |

## 判定规则

- **pass**：全部 blocking check = pass，无 warning
- **pass_with_notice**：无 blocking failure，有 warning
- **fail**：任一 blocking check fail

## 本步不做

- 不做 final acceptance runner / close decision
- 不做真实 event store
- 不做 UI / API
- 不扩 replay 能力

## 下一步建议

- Step 5：Final Acceptance Runner + Pre-Close Checklist
- Step 6：Phase 5 最终封板
