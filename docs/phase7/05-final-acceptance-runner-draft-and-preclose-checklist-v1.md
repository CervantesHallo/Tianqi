# Phase 7 / Step 5 — Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版 + 最终封板准备态建立

## 为什么 Step 5 先做 Final Acceptance Runner 雏形

Step 4 的 gate 回答"门禁是否通过"，但缺少 matrix → input → gate → checklist 串联的完整评估入口。Step 5 补齐这一链路，让 Step 6 只需执行最终 close decision。

## Pre-Close Checklist（6 项）

| # | itemId | 推导来源 |
|---|--------|----------|
| 1 | difference_matrix_completed | matrix.totalScenarios >= 10 |
| 2 | acceptance_input_built | input 三段非空 |
| 3 | acceptance_gate_evaluated | gate.checkResults.length >= 8 |
| 4 | preflight_matrix_coverage_confirmed | gate 中 phase7_matrix_covered |
| 5 | rollback_runbook_matrix_coverage_confirmed | gate 中 phase7_matrix_covered |
| 6 | blocking_issues_resolved_or_acknowledged | gate + input blockingIssues |

## 高风险边界（F 系列）

| # | 场景 | 预期 |
|---|------|------|
| F1 | matrix pass 但 gate 检查项缺失 | not_ready |
| F2 | gate pass_with_notice + checklist pass | ready_with_notices |
| F4 | preflight 够但 rollback/runbook 不足 | not_ready |
| F5 | gate pass 但 input 有未检出 blocking | not_ready |

## 本步不做

- 不做最终 close decision（Step 6）
- 不做真实发布平台 / rollback executor

## Step 6 只剩什么

- 最终 close decision runner + Phase 7 冻结文档 + 全量回归验证
