# Phase 2 / Step 25: 封板差异全景矩阵生成 + 全量基线批运行器 + 封板验收输入物固化

## 本步做了什么

### 1. 封板差异全景矩阵模型 (Phase2AggregateDifferenceMatrix)

统一汇总 12 条场景报告 + 3 条 failure 组合报告，产出：
- matrixRunId、scenarioReports、failureCombinationReports
- totalScenarios / matchedScenarios / mismatchedScenarios
- totalFailureCombinations / matchedFailureCombinations / mismatchedFailureCombinations
- coreFieldDriftSummary：按字段统计漂移次数及是否 blocking
- overallStatus：passed / passed_with_notice / failed
- matrixSummary：一行可读总结

### 2. 全量批运行器 (runPhase2AggregateDifferenceMatrix)

- 批量跑完全部 12 条 scenario matrix 条目
- 批量跑完全部 3 条 failure combination matrix 条目
- 为每条矩阵条目自动构建合成 baseline（scenarioMatrixEntryToSyntheticBaseline / failureCombinationToSyntheticBaseline）
- 生成单条 difference report 集合
- 汇总出 matrix 级总览
- 规则集中在 runner 内部，测试不再需要 for-loop 手拼

### 3. 封板验收输入物模型 (Phase2AcceptanceInputSnapshot)

- baselineCoreFields：9 个封板核心字段
- scenarioMatrixIds / failureCombinationIds：覆盖的矩阵条目
- differenceMatrixOverallStatus：从矩阵继承
- keyDriftFindings：逐字段漂移详情
- blockingIssues：阻断性问题列表
- nonBlockingNotices：非阻断性通知列表
- recommendedPreCloseActions：封板前建议动作

### 4. 增强差异报告 builder

每条 `Phase2AggregateBaselineDifferenceReport` 新增：
- `driftCategory`: none / blocking_core_field_drift / blocking_failure_semantic_mismatch / non_blocking_summary_drift / non_blocking_notice
- `blocking`: 是否为阻断性漂移
- `noticeOnly`: 是否仅为通知类漂移

每条 `Phase2AggregateBaselineDifferenceSummary` 新增：
- `blocking`: 该字段漂移是否为阻断性

### 5. overallStatus / blocking / notice 规则

| 条件 | overallStatus |
|------|--------------|
| 所有 reports matched，无 blocking | passed |
| 无 blocking，但存在 noticeOnly | passed_with_notice |
| 任一 report blocking=true | failed |
| 任一 failureSemanticMatch=false | failed |

**blocking 判定**：riskLevel / manualActionHint / requiresAttention / requiresRepairAction / requiresManualReview / isCrossSessionConsistent / explanationStatus 任一漂移，或 failureSemanticMatch=false。

**non-blocking 判定**：aggregateSummary / recommendedNextStep 的轻微漂移，且所有 blocking 字段一致。

### 6. Step 24 语义保持

- `PHASE2_AGGREGATE_SCENARIO_MATRIX` (12 条) 未修改
- `PHASE2_AGGREGATE_FAILURE_COMBINATION_MATRIX` (3 条) 未修改
- Step 23 的 6 baselines + 6 failure baselines 未修改
- `PHASE2_AGGREGATE_BASELINE_CORE_FIELDS` 未修改
- 差异报告 builder 向后兼容：新字段为新增，不影响已有字段语义

## 为什么要先有差异全景矩阵和验收输入物

1. Step 26-30 需要一个可执行、可消费的验收基准，而不是散落的单条报告
2. 全景矩阵让我们一次运行就能知道"所有场景是否稳定"
3. 验收输入物让 Step 30 的封板确认有明确输入：blocking 还是 pass
4. 差异报告的 blocking/notice 分类让封板决策有客观依据

## 本步没做什么

- dashboard / UI / API
- 外部报告系统
- 新平台
- 新治理模板
- 外部接入
- 性能平台

## 下一步如何继续倒排到 Step 30 封板

- Step 26-27：acceptance gate 定义 + acceptance runner 雏形
- Step 28-29：最终验收场景补充 + 封板门禁清单固化
- Step 30：总验收与封板确认
