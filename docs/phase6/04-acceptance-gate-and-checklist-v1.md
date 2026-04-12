# Phase 6 / Step 4 — Acceptance Gate 定义 + 观测/故障演练门禁清单固化 + Gate Runner 第一版

## 为什么 Step 4 先做 Gate / Checklist

Step 3 产出了 `Phase6AcceptanceInputSnapshot`（差异矩阵 + 漂移摘要 + blocking/notice），但尚未有"判定器"。Gate 是可重复、可回归的自动化门禁；final close 是人工确认。gate 先稳定，才能支撑 close。

## Gate 模型

`Phase6AcceptanceGateResult`：gateId / gateStatus（三态）/ checkResults / passedChecks / failedChecks / warningChecks / blockingIssues / nonBlockingNotices / gateSummary / recommendedDecision（三态）

## 门禁清单（8 类检查项）

| # | checkId | 语义 | 推导来源 |
|---|---------|------|----------|
| 1 | trace_propagation_stable | Trace propagation 无 blocking drift | blockingIssues（tracePropagationStatus） |
| 2 | metrics_recording_stable | Metrics recording 无 blocking drift | blockingIssues（metricRecordingStatus） |
| 3 | benchmark_output_stable | Benchmark 输出稳定 | blockingIssues（benchmarkStatus） |
| 4 | fault_drill_semantics_stable | Fault drill 语义稳定 | blockingIssues（drillStatus/failedUnexpectedlyCount） |
| 5 | fault_drill_consistency_stable | Fault drill 一致性稳定 | blockingIssues（overallStatus） |
| 6 | phase6_matrix_covered | 矩阵覆盖（OBS>=5, DRILL>=5） | scenarioIds.length |
| 7 | no_blocking_core_field_drift | 无 blocking 级核心字段漂移 | blockingIssues.length |
| 8 | observability_and_drill_consistency_passed | 差异矩阵整体一致 | differenceMatrixOverallStatus |

## 判定规则

- **pass**：全部 blocking check = pass，无 warning
- **pass_with_notice**：无 blocking failure，有 warning
- **fail**：任一 blocking check fail

## 本步不做

- 不做 final acceptance runner / close decision
- 不做真实 APM / chaos 平台
- 不做 Phase 7

## 下一步建议

- Step 5：Final Acceptance Runner + Pre-Close Checklist + 最终封板
