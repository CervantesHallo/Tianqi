# Phase 2 / Step 12 - Diagnostic Result Read Compatibility And History Comparison Placeholder

## 本步范围冻结

### 本步要做

- 定义诊断结果最小版本兼容读取策略
- 定义当前结果与单条历史结果的最小对比校验占位
- 定义最小历史结果来源边界（history slot）
- 让诊断读路径可输出 compatibility/comparison 结构化结果
- 补兼容读取、历史对比、边界路径测试

### 本步不做

- 完整历史迁移平台
- 完整多版本读模型系统
- 批量历史诊断重算
- dashboard/UI/API
- 外部配置中心
- 外部数据库迁移系统
- 治理模板扩张

## 最小版本兼容读取策略

新增 `evaluateCoordinationDiagnosticResultReadCompatibility(...)` 与状态：

- `compatible_read`
- `compatible_with_notice`
- `incompatible_version`
- `missing_version`

最小规则：

- 默认版本（当前 `1.0.0`）-> `compatible_read`
- 显式支持集合中的非默认版本（当前含 `0.9.0`）-> `compatible_with_notice`
- 缺失版本 -> `missing_version`
- 未知版本 -> `incompatible_version`

支持集合通过 `DIAGNOSTIC_RESULT_SUPPORTED_READ_VERSIONS` 显式声明，不允许“全部版本默认兼容”。

## 最小历史结果对比占位

新增 `compareCoordinationDiagnosticViews(...)` 与 `CoordinationDiagnosticComparison`：

- `hasDifference`
- `differenceSummary`
- `versionChanged`
- `riskLevelChanged`
- `manualActionHintChanged`
- `statusChanged`

对比字段：

- `assessmentRulesVersion`
- `riskLevel`
- `manualActionHint`
- `validationStatus`
- `repairStatus`
- `currentReadViewStatus`

## 最小历史来源边界

新增 `CoordinationResultDiagnosticHistoryRegistry`（in-memory history slot）：

- 每个 `factKey` 维护 `latest` 与 `previous` 槽位
- 当前阶段仅支持“当前结果读取 + 单条历史结果读取 + 当前vs历史最小对比”

当前阶段采用该最小边界即可支撑 Step 12 目标，无需进入完整历史仓储系统。

## 读路径增强

`CoordinationResultDiagnosticQueryHandler` 现支持：

- 正常读取当前诊断结果
- 对当前结果执行版本兼容判断
- `includeHistoryComparison=true` 时尝试读取历史槽并执行最小对比
- 返回结构化：
  - `readCompatibility`
  - `compatibilityReason`
  - `historyAvailable`
  - `comparisonResult`（可选）

边界行为：

- 当前结果版本缺失/不兼容 -> 结构化失败
- 历史结果版本不兼容 -> 比较路径结构化失败（不伪装成功）

## 默认版本语义稳定性

在默认版本下，Step 10/11 诊断语义保持：

- low/medium/high 主规则不变
- key action hint 映射不变
- 新增 compatibility/comparison 仅为读侧增强，不改既有判读核心结果

## 测试覆盖

新增/增强：

- `coordination-result-diagnostic-read-compatibility.test.ts`
  - `compatible_read / compatible_with_notice / missing_version / incompatible_version`
- `coordination-result-diagnostic-history-comparison.test.ts`
  - 同值无差异
  - version/risk/hint/status 差异识别
- `coordination-result-diagnostic-query-handler.test.ts`
  - 成功读取包含 `readCompatibility`
  - 历史缺失时 `historyAvailable=false`
  - 存在历史时返回 `comparisonResult`
  - 历史版本不兼容时返回结构化失败

## 本步未做什么

- 未做批量历史重算/迁移
- 未做多版本并行判读平台
- 未做外部持久化历史仓储
- 未做 UI/API 展示层

## 下一步自然延伸

- Phase 2 / Step 13：在保持最小化原则下，补充“诊断历史槽最小持久化占位 + 跨会话读取一致性校验”，为跨进程/重启后的历史对比稳定性打基础。
