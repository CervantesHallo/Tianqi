# Phase 2 / Step 22 - Core Case Diagnostic Aggregate View And End-to-End Read Convergence

## 1. 本步边界冻结（收口导向）

### 1.1 本步要做

- 定义核心案件端到端诊断聚合视图（单条）
- 将 diagnostic/history/alert/suppression/repair/command-link 收敛为同一查询结果
- 定义最小全链路摘要规则与解释字段
- 提供统一 aggregate query 入口
- 增加 aggregate consistency 最小守卫与测试

### 1.2 本步不做

- dashboard
- timeline 平台
- batch query 平台
- UI/API/console
- 外部数据库/消息系统接入
- workflow/工单平台
- 治理模板扩展

## 2. 统一聚合读模型

新增：

- `CoreCaseDiagnosticAggregateView`

聚合内容分组：

- **A. 核心案件诊断主视图**：`factKey/riskCaseId/subcaseType/subcaseId/currentReadViewStatus/validationStatus/riskLevel/manualActionHint/riskReason/actionHintReason/assessmentRulesVersion`
- **B. 历史/回放解释**：`historySource/historyAvailable/historyReplayValidation/historyConflictAttribution/historyComparisonNotice/comparisonResult`
- **C. hint/alert 输出**：`readAlert/alertSuppression/alertSuppressionPersistence`
- **D. suppression repair 生命周期**：`suppressionStateRepair/suppressionStateRepairPersistence`
- **E. latest command accountability**：`suppressionStateRepairCommandLink`
- **F. 全链路摘要**：`aggregateSummary/requiresAttention/requiresRepairAction/requiresManualReview/isCrossSessionConsistent/explanationStatus/primaryReason/secondaryReason/recommendedNextStep`

说明：

- 聚合模型不是简单嵌套已有对象，而是新增了高层决策/解释字段，调用方可直接消费。

## 3. 最小聚合规则（代码化）

新增规则收敛于 `buildCoreCaseDiagnosticAggregateView(...)`：

- `requiresAttention=true` 当满足任一：
  - `readAlert.requiresAttention=true`
  - `riskLevel=high`
  - `historyReplayValidation.status=failed`
  - `suppressionStateRepair.repairStatus` 为失败态（retryable/manual-confirm-required）
- `requiresRepairAction=true` 当满足任一：
  - `suppressionStateRepair.canRetry=true`
  - `alertSuppressionPersistence.stateRepairRecommended=true`
  - `manualActionHint=retry_repair_recommended`
- `requiresManualReview=true` 当满足任一：
  - `manualActionHint=manual_confirmation_recommended`
  - `manualActionHint=investigate_validation_conflict`
  - `readAlert.severity=critical`
  - `suppressionStateRepair.repairStatus=repair_failed_manual_confirmation_required`
- `isCrossSessionConsistent=true` 需要同时满足：
  - history consistency 非 failed
  - suppression continuity 非 failed
  - command-link consistency 非 failed（若存在）
- `explanationStatus`：
  - `inconsistent`（跨会话不一致）
  - `attention_required`（需关注）
  - `partially_explained`（可解释但需处理）
  - `fully_explained`（稳定无行动）

## 4. 统一 Aggregate Query 入口

新增：

- `GetCoreCaseDiagnosticAggregateViewQuery`
- `CoreCaseDiagnosticAggregateQueryHandler`

策略：

- 输入保持单条 `factKey`（可选 `includeHistoryComparison`）
- 内部复用 `CoordinationResultDiagnosticQueryHandler`
- 输出统一 `CoreCaseDiagnosticAggregateQueryResult`

## 5. 与旧 Query 关系

- 保留原 `CoordinationResultDiagnosticQueryHandler` 作为基础层
- 新 aggregate query 作为端到端消费入口
- 调用方无需再手工拼多路结果

## 6. Aggregate Consistency 最小守卫

新增：

- `validateCoreCaseDiagnosticAggregateConsistency(...)`

最小校验：

- `riskLevel/manualActionHint` 与摘要字段不冲突
- `readAlert` 与 `requiresAttention` 不冲突
- `suppressionStateRepair` 与 `requiresRepairAction/requiresManualReview` 不冲突
- command-link failure 时 `isCrossSessionConsistent` 不能为 true
- replay validation failed 时 `explanationStatus` 不能是 `fully_explained`

## 7. 解释层增强

新增统一解释字段：

- `aggregateSummary`
- `primaryReason`
- `secondaryReason`
- `recommendedNextStep`

用于直接回答：

- 现在最主要问题是什么
- 下一步应该做什么
- 为什么

## 8. 本步未做

- dashboard / batch query / timeline 平台
- 完整 workflow 编排
- UI/API/console
- 外部数据库接入

## 9. 下一步收口建议

- Step 23 建议围绕“总体验收前稳定化”推进：聚焦 aggregate view 与核心案件流关键路径一致性回归基线，继续朝 Step 30 封板倒排。

