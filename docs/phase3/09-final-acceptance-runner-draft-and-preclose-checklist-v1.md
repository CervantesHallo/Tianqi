# Phase 3 / Step 9 — 最终封板准备：高风险边界补齐 + Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版

## 为什么 Step 9 先做 Final Acceptance Runner 雏形

Step 8 产出了 `Phase3AcceptanceGateResult`（门禁判定），但尚未有"最终封板准备入口"将 matrix → input → gate → pre-close checklist 串联为一次完整的准备态评估。Step 9 补齐这一链路，使 Step 10 只需执行最终 close decision。

## Pre-Close Checklist 覆盖范围

`Phase3PreCloseChecklist` 包含 6 项检查，每项均为 blocking：

| # | itemId | 语义 | 推导来源 |
|---|--------|------|----------|
| 1 | difference_matrix_completed | 差异矩阵已执行完成（>= 11 场景）| matrix.totalScenarios |
| 2 | acceptance_input_built | 验收输入物已构建 | input 三段非空 |
| 3 | acceptance_gate_evaluated | 门禁已完整评估（>= 8 检查项）| gate.checkResults.length |
| 4 | strategy_matrix_coverage_confirmed | 策略矩阵覆盖已确认 | 镜像 gate 中 strategy_matrix_covered |
| 5 | config_version_matrix_coverage_confirmed | 配置版本矩阵覆盖已确认 | 镜像 gate 中 config_version_matrix_covered |
| 6 | blocking_issues_resolved_or_acknowledged | 所有阻断项已解决或确认 | gate.blockingIssues + input.blockingIssues |

## finalAcceptanceStatus 判定规则

| 状态 | 条件 |
|------|------|
| ready_to_close_preparation | gateStatus = pass AND checklist 无 blocking fail |
| ready_with_notices | gateStatus = pass_with_notice 或 checklist 有 warning，且无 blocking fail |
| not_ready_to_close_preparation | gateStatus = fail 或 checklist 有 blocking fail |

## 本轮补齐的高风险边界

| 编号 | 场景 | 预期结论 |
|------|------|----------|
| F1 | matrix 全通过，但 gate 检查项缺失 | not_ready（acceptance_gate_evaluated fail）|
| F2 | gate = pass_with_notice，checklist 全通过 | ready_with_notices |
| F4 | 策略覆盖足够，配置版本覆盖不足 | not_ready（config_version_matrix_coverage_confirmed fail）|
| F5 | gate pass，但 input 有未检出的 blocking issue | not_ready（blocking_issues_resolved_or_acknowledged fail）|

## 一致性校验

`validatePhase3FinalAcceptanceConsistency` 检查 5 条不变量：
1. gate fail → finalAcceptanceStatus 必须 not_ready
2. gate pass + checklist 无 blocking fail → finalAcceptanceStatus 不能 not_ready
3. 全部 clean → finalAcceptanceStatus 必须 ready_to_close_preparation
4. blockingIssues 非空 → finalAcceptanceStatus 不能 ready_to_close_preparation
5. 无 blocking 来源 → finalAcceptanceStatus 不能 not_ready

## 本步不做

- 不做最终 close decision（Step 10）
- 不做外部配置中心 / 发布平台 / UI / API
- 不做执行编排层
- 不扩策略 v2

## Step 10 只剩什么

- 最终 close decision runner
- Phase 3 冻结文档
- 全量回归验证
