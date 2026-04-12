# Phase 2 / Step 10 - Diagnostic Risk Level And Manual Action Hints

## 本步范围冻结

### 本步要做

- 为诊断视图新增最小风险分级（low/medium/high）
- 为诊断视图新增最小人工处理建议字段
- 固化风险分级与建议的最小判定规则与优先级
- 让 query/persistence/repair/validation 聚合状态稳定映射到分级与建议
- 通过集中 helper/projector 收敛判读逻辑，避免散落 if/else
- 补齐低/中/高风险、优先级与边界路径测试

### 本步不做

- 完整运维 workflow 平台
- dashboard/UI/API 实现
- 批量策略编排与自动工单
- 自动恢复系统
- 外部监控/告警系统接入
- 治理模板扩张

## 最小风险分级模型

新增 `CoordinationResultDiagnosticRiskLevel`：

- `low`
- `medium`
- `high`

分级服务当前诊断语义（read-view 状态、validation、repair 生命周期、persistence 失败信号），不引入复杂评分引擎。

## 最小人工处理建议模型

新增 `CoordinationResultManualActionHint`：

- `no_action_needed`
- `retry_repair_recommended`
- `manual_confirmation_recommended`
- `investigate_validation_conflict`
- `investigate_missing_read_view`
- `investigate_persistence_failure`

建议字段与 repair/validation/read-view/persistence 信号同源，目标是提供最小、稳定、可测试的人工下一步建议。

## 最小判读规则（含优先级）

集中于 `buildCoordinationDiagnosticAssessment(...)`。

### 高风险（优先级最高）

- `validationStatus = failed` -> `high + investigate_validation_conflict`
- `currentReadViewStatus = missing` -> `high + investigate_missing_read_view`
- `repairStatus = repair_failed_manual_confirmation_required` -> `high + manual_confirmation_recommended`

### 中风险

- `repairStatus = repair_failed_retryable` -> `medium + retry_repair_recommended`
- `currentReadViewStatus = fallback_only`：
  - 有 persistence failure -> `medium + investigate_persistence_failure`
  - 否则 -> `medium + retry_repair_recommended`
- `repairStatus = manually_confirmed` 且未修复为 persisted -> `medium + retry_repair_recommended`
- persisted 可读但存在 persistence failure 观测 -> `medium + investigate_persistence_failure`

### 低风险

- 不命中 high/medium 规则 -> `low + no_action_needed`

### 冲突裁决

- `high > medium > low`
- 在建议冲突时，优先保守人工建议：
  - `investigate_validation_conflict` 高于 retry/manual confirmation
  - `manual_confirmation_recommended` 高于普通 retry

## 诊断视图增强

`CoordinationResultDiagnosticView` 新增：

- `riskLevel`
- `manualActionHint`
- `riskReason`
- `actionHintReason`

调用方可直接消费“风险级别 + 建议动作 + 原因”，不再需要自行拼接内部状态推导。

## 边界与错误语义

- 信息不足时采用保守可解释策略：
  - 如果读视图缺失，直接 `high + investigate_missing_read_view`
  - 如果未命中风险信号，则落入 `low + no_action_needed`
- `validation failed` 永远压过 retryable repair 建议
- `manual_confirmation_required` 在无更高冲突时进入高风险建议
- 建议字段由集中规则生成，避免与 repairStatus 人工拼接导致语义漂移

## 测试覆盖

新增/增强：

- `coordination-result-diagnostic-assessment.test.ts`
  - low 路径：persisted + passed + repaired
  - medium 路径：retryable / fallback-only
  - high 路径：validation failed / missing read-view / manual-confirm-required
  - 优先级路径：validation conflict 覆盖 retryable
  - 边界路径：persistence failure 建议
- `coordination-result-diagnostic-query-handler.test.ts`
  - 诊断 query 结果直接断言 `riskLevel/manualActionHint`
  - 覆盖 persisted low、fallback medium、validation conflict high

## 本步未做什么

- 未引入 dashboard/workflow 平台能力
- 未做批量 repair 或自动重试
- 未接入外部告警、工单、监控系统
- 未引入复杂评分或机器学习判读

## 下一步自然延伸

- Phase 2 / Step 11：在保持最小化原则下，补充“诊断判读规则最小可配置化边界 + 规则版本占位 + 语义兼容护栏”。
