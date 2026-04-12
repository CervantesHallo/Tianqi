# Phase 2 / Step 23 - Aggregate Regression Baselines And Failure Semantics Freeze (Round 1)

## 1. 本步边界冻结（封板回归基线）

### 1.1 本步要做

- 定义 Phase 2 关键路径回归 baseline 模型（测试/验收用途，不进入运行时业务模型）
- 固化 aggregate 端到端关键场景 expected baseline（6 类验收级场景）
- 固化关键 failure 语义 expected baseline（history/command-link/suppression/validation）
- 增加跨命令/跨会话一致性回归校验工具
- 补齐可执行测试，形成 Step 30 前可重复门禁

### 1.2 本步不做

- 新平台（dashboard/timeline/batch 系统）
- 新 UI/API/console
- 新治理模板平台化扩展
- 复杂性能平台
- 外部接入（外部 DB/MQ/工作流/工单）

## 2. 为什么先冻结 baseline

- Step 22 已完成 aggregate 聚合能力，当前主要风险不是“字段不足”，而是“语义漂移”。
- Step 23 先把关键路径和关键失败语义冻结为可回归 baseline，避免 Step 24-29 期间出现隐性漂移。
- 封板前验收需要一组可重复执行、可比较结果、可复现问题的门禁资产；本步即构建该资产。

## 3. Baseline 模型与封板核心字段

新增：

- `CoreCaseDiagnosticAggregateBaseline`
- `PHASE2_AGGREGATE_BASELINE_CORE_FIELDS`

baseline 模型最小字段包含：

- `baselineId/scenarioName/inputShape`
- `expectedAggregateSummary`
- `expectedRequiresAttention/expectedRequiresRepairAction/expectedRequiresManualReview`
- `expectedIsCrossSessionConsistent/expectedExplanationStatus`
- `expectedRiskLevel/expectedManualActionHint`
- `expectedReadAlertSeverity/expectedRepairStatus/expectedCommandLinkStatus`（按场景适用）

封板核心字段（load-bearing）冻结为：

- `riskLevel`
- `manualActionHint`
- `requiresAttention`
- `requiresRepairAction`
- `requiresManualReview`
- `isCrossSessionConsistent`
- `explanationStatus`
- `aggregateSummary`
- `recommendedNextStep`

## 4. 六类验收级场景 baseline（可执行）

固定场景：

- **A 正常稳定路径**：`fully_explained`，无 repair/continuity 问题，`requiresAttention=false`
- **B retryable repair 路径**：repair failed 但可重试，`requiresRepairAction=true`
- **C manual review 路径**：manual confirmation / validation conflict 语义触发 `requiresManualReview=true`
- **D history continuity 异常路径**：history replay/consistency failed，`isCrossSessionConsistent=false`
- **E command-link 异常路径**：latest command record 缺失或不一致，aggregate 显式 `inconsistent`
- **F suppression continuity 异常路径**：suppression continuity failed，aggregate attention/consistency 同步降级

说明：

- 这些场景已落为测试基线，不是文档枚举。
- 后续 Step 24-29 回归默认以此场景集合为基础矩阵。

## 5. 关键 failure 语义 baseline 冻结

冻结 failure baseline：

- `history_replay_failed`
- `command_link_missing_record`
- `command_link_status_mismatch`
- `suppression_state_incompatible_version`
- `suppression_state_manual_confirmation_required`
- `diagnostic_validation_conflict`

每类 failure baseline 都绑定：

- 结构化状态语义
- aggregate 摘要预期
- attention/repair/manual-review 预期
- 跨入口稳定性校验（防止同类 failure 在不同 query 入口漂移）

## 6. 跨命令/跨会话一致性回归校验

新增集中校验工具：

- `assertCoreCaseAggregateBaselineConsistency(...)`
- `assertCoreCaseAggregateFailureSemanticFrozen(...)`

校验要点：

- aggregate 对 baseline 的关键字段一致性
- 同一事实在不同命令路径（repair/retry/confirm）下核心字段不漂移
- diagnostic base query 与 aggregate query 的 load-bearing 字段不冲突
- command-link/continuity/replay/repair 子链路与 aggregate 结论不自相矛盾

跨会话最小回归场景：

- 先写 persisted history/suppression/lifecycle/command-link 数据
- 再以新 query handler 会话读取
- 校验 `requiresAttention/requiresRepairAction/requiresManualReview/isCrossSessionConsistent/explanationStatus`

## 7. 本步未做

- 未引入新平台或新外部系统
- 未扩展 UI/API
- 未进入批处理、性能平台、治理平台化改造

## 8. 下一步收口方向（Step 24+）

- 围绕 `PHASE2_AGGREGATE_BASELINE_CORE_FIELDS` 做场景矩阵扩展与回归加严
- 增加 Step 30 总体验收前的对比清单（baseline 差异解释、漂移定位路径）
- 继续坚持“封板回归优先”，不再做分散语义碎片化增量

