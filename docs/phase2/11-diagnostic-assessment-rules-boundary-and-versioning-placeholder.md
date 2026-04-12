# Phase 2 / Step 11 - Diagnostic Assessment Rules Boundary And Versioning Placeholder

## 本步范围冻结

### 本步要做

- 定义诊断判读规则最小可配置边界（集中规则对象）
- 定义规则版本常量与版本类型占位
- 让集中判读逻辑显式绑定规则版本
- 让诊断视图直接暴露规则版本
- 增加兼容断言工具与回归护栏测试
- 补测试并验证默认规则不破坏 Step 10 语义

### 本步不做

- 完整规则平台
- 完整动态配置中心
- 多版本并行执行系统
- 历史诊断批量迁移平台
- UI/API/console
- 外部配置服务接入
- 治理模板扩张

## 最小规则配置边界

新增 `CoordinationDiagnosticAssessmentRules`，只提取关键判读开关：

- `highRiskRules`
  - `validationFailedDirectHigh`
  - `readViewMissingDirectHigh`
  - `repairFailedManualConfirmationRequiredDirectHigh`
- `mediumRiskRules`
  - `persistenceFailureReadableDirectMedium`
  - `repairFailedRetryableDirectMedium`
  - `fallbackOnlyDirectMedium`
  - `manuallyConfirmedDirectMedium`
- `lowRiskRules`
  - `persistedValidationPassedRepairedDirectLow`

并提供默认对象 `DEFAULT_COORDINATION_DIAGNOSTIC_ASSESSMENT_RULES`。

## 规则版本占位

新增：

- `COORDINATION_DIAGNOSTIC_RULES_VERSION = "1.0.0"`
- `CoordinationDiagnosticAssessmentRulesVersion`

规则对象携带 `version`，assessment 输出与诊断视图均带 `assessmentRulesVersion`，保证规则升级不再“无痕变化”。

## 集中判读器增强

`buildCoordinationDiagnosticAssessment(...)` 现支持：

- 接收显式规则对象；未传时使用默认规则
- 输出中带 `assessmentRulesVersion`
- 规则判断继续集中，不散落到 query handler

默认规则下，Step 10 语义保持稳定：

- low/medium/high 判读路径保持
- 关键 action hint 映射保持

## 兼容护栏与断言工具

新增 `assertDiagnosticAssessmentCompatibility(...)`，用于：

- 校验规则对象关键字段完整性（shape）
- 校验规则版本与期望版本一致
- 校验关键输入场景下 risk/hint 映射不漂移
- 校验 assessment 输出携带有效版本与原因字段

兼容样例按规则版本声明（当前 `1.0.0`）：

- stable low
- retryable medium
- validation conflict high
- manual confirmation required high
- missing read-view high

## 测试覆盖

- `coordination-result-diagnostic-assessment.test.ts`
  - 默认规则版本输出一致性
  - low/medium/high 与关键建议回归
- `coordination-result-diagnostic-assessment-compatibility.test.ts`
  - 默认规则兼容断言通过
  - 规则结构缺失触发失败
  - 映射变更但版本不变触发失败
  - 版本不一致触发失败
- `coordination-result-diagnostic-query-handler.test.ts`
  - 诊断视图断言 `assessmentRulesVersion + riskLevel + manualActionHint`

## 本步未做什么

- 未做规则 DSL 或规则引擎
- 未做外部配置热更新
- 未做多版本并行判读
- 未做历史结果批量重算/迁移

## 下一步自然延伸

- Phase 2 / Step 12：在保持最小化原则下，补充“诊断结果版本兼容读取策略 + 历史结果对比校验占位”，继续增强规则演进下读侧稳定性。
