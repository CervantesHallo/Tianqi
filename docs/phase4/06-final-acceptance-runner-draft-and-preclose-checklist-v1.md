# Phase 4 / Step 6 — Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版 + 最终封板准备态建立

## 为什么 Step 6 先做 Final Acceptance Runner 雏形

Step 5 的 gate runner 回答"门禁是否通过"，但缺少将 matrix → input → gate → pre-close checklist 串联为完整准备态评估的入口。Step 6 补齐这一链路，让 Step 7 只需执行最终 close decision。

## Pre-Close Checklist 覆盖范围

| # | itemId | 语义 | 推导来源 |
|---|--------|------|----------|
| 1 | difference_matrix_completed | 差异矩阵已执行（>= 10 场景）| matrix.totalScenarios |
| 2 | acceptance_input_built | 验收输入物已构建 | input 三段非空 |
| 3 | acceptance_gate_evaluated | 门禁已完整评估（>= 8 检查项）| gate.checkResults.length |
| 4 | risk_case_matrix_coverage_confirmed | RC 矩阵覆盖已确认 | gate 中 orchestration_matrix_covered |
| 5 | liquidation_case_matrix_coverage_confirmed | LC 矩阵覆盖已确认 | gate 中 orchestration_matrix_covered |
| 6 | blocking_issues_resolved_or_acknowledged | 所有阻断项已解决 | gate.blockingIssues + input.blockingIssues |

## finalAcceptanceStatus 判定规则

| 状态 | 条件 |
|------|------|
| ready_to_close_preparation | gateStatus=pass AND checklist 无 blocking fail |
| ready_with_notices | gateStatus=pass_with_notice 或 checklist 有 warning，且无 blocking fail |
| not_ready_to_close_preparation | gateStatus=fail 或 checklist 有 blocking fail |

## 本轮补齐的高风险边界

| # | 场景 | 预期 |
|---|------|------|
| F1 | matrix pass 但 gate 检查项缺失 | not_ready |
| F2 | gate pass_with_notice + checklist 全通过 | ready_with_notices |
| F4 | RC 覆盖够但 LC 不足 | not_ready |
| F5 | gate pass 但 input 有未检出 blocking | not_ready |

## 本步不做

- 不做最终 close decision（Step 7）
- 不做真实 infra
- 不做 UI / API
- 不扩路径

## Step 7 只剩什么

- 最终 close decision runner
- Phase 4 冻结文档
- 全量回归验证
