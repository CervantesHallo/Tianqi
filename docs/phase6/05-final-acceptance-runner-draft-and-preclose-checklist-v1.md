# Phase 6 / Step 5 — Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版 + 最终封板准备态建立

## 为什么 Step 5 先做 Final Acceptance Runner 雏形

Step 4 的 gate runner 回答"门禁是否通过"，但缺少 matrix → input → gate → checklist 串联的完整评估入口。Step 5 补齐这一链路，让 Step 6 只需执行最终 close decision。

## Pre-Close Checklist 覆盖范围

| # | itemId | 语义 | 推导来源 |
|---|--------|------|----------|
| 1 | difference_matrix_completed | 差异矩阵已执行（>= 10 场景）| matrix.totalScenarios |
| 2 | acceptance_input_built | 验收输入物已构建 | input 三段非空 |
| 3 | acceptance_gate_evaluated | 门禁已完整评估（>= 8 检查项）| gate.checkResults.length |
| 4 | observability_matrix_coverage_confirmed | Observability 矩阵覆盖 | gate 中 phase6_matrix_covered |
| 5 | fault_drill_matrix_coverage_confirmed | Fault drill 矩阵覆盖 | gate 中 phase6_matrix_covered |
| 6 | blocking_issues_resolved_or_acknowledged | 所有阻断项已解决 | gate + input blockingIssues |

## finalAcceptanceStatus 判定规则

| 状态 | 条件 |
|------|------|
| ready_to_close_preparation | gateStatus=pass AND checklist 无 blocking fail |
| ready_with_notices | gateStatus=pass_with_notice 或 checklist 有 warning，且无 blocking fail |
| not_ready_to_close_preparation | gateStatus=fail 或 checklist 有 blocking fail |

## 高风险边界（F 系列）

| # | 场景 | 预期 |
|---|------|------|
| F1 | matrix pass 但 gate 检查项缺失 | not_ready |
| F2 | gate pass_with_notice + checklist pass | ready_with_notices |
| F4 | observability 够但 drill 不足 | not_ready |
| F5 | gate pass 但 input 有未检出 blocking | not_ready |

## 本步不做

- 不做最终 close decision（Step 6）
- 不做真实 APM / chaos 平台
- 不做 Phase 7

## Step 6 只剩什么

- 最终 close decision runner
- Phase 6 冻结文档
- 全量回归验证
