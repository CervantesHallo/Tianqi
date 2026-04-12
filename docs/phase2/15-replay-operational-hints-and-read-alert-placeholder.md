# Phase 2 / Step 15 - Replay Operational Hints And Read Alert Placeholder

## 本步范围冻结

### 本步要做

- 为 replay notice/failed 增加最小运维处理建议字段
- 为读侧结果增加最小告警占位
- 收敛 replay validation + attribution + hint + alert 的统一输出
- 补测试

### 本步不做

- 完整告警平台
- 工单系统
- 自动通知系统
- 自动修复策略执行
- dashboard/UI/API
- 外部监控接入
- 治理模板扩张

## 最小运维处理建议模型

新增 `DiagnosticReplayOperationalHint`：

- `no_operational_action_needed`
- `review_version_compatibility`
- `inspect_history_slot_schema`
- `inspect_fact_key_mapping`
- `inspect_snapshot_conflict`
- `manual_diagnostic_review_required`

建议由 replay validation reasonCategory 同源推导，不引入复杂建议引擎。

## 最小读侧告警占位

新增 `DiagnosticReadAlert`：

- `severity`（`info | warning | critical`）
- `alertCode`
- `alertSummary`
- `operationalHint`
- `triggerSource`
- `requiresAttention`

当前阶段为单条告警占位，不扩展告警列表/路由系统。

## Hint / Alert 规则

### replay -> hint

- `passed` -> `no_operational_action_needed`
- `notice + version_mismatch` -> `review_version_compatibility`
- `notice/failed + schema_incompatible` -> `inspect_history_slot_schema`
- `failed + fact_key_mismatch` -> `inspect_fact_key_mapping`
- `notice/failed + current/previous/status/rules conflict` -> `inspect_snapshot_conflict`
- failed 且无法归类 -> `manual_diagnostic_review_required`

### replay -> alert

- `passed` -> `severity=info`, `requiresAttention=false`
- `notice` -> `severity=warning`, `requiresAttention=true`
- `failed` -> `severity=critical`, `requiresAttention=true`

`alertCode` 由 `status + reasonCategory` 稳定映射生成。

## 读路径增强

`CoordinationResultDiagnosticQueryHandler` 在 comparison 路径下新增返回：

- `operationalHint`
- `operationalHintReason`
- `readAlert`

同时保留：

- `historyReplayValidation`
- `historyConflictAttribution`
- `historyComparisonNotice`

persisted 与 fallback 历史来源返回同 shape 语义，避免调用方分叉处理逻辑。

## 测试覆盖

- `buildDiagnosticReplayOperationalHint`：
  - passed/notice/failed 映射
  - version/schema/fact key 分类建议
- `buildDiagnosticReadAlert`：
  - info/warning/critical 与 requiresAttention 映射
- query handler：
  - notice 场景返回 `operationalHint + readAlert`
  - persisted/fallback 返回统一字段结构
  - 默认读取语义保持稳定

## 本步未做什么

- 未做告警平台、工单系统、自动通知
- 未做自动修复执行
- 未做 UI/API 呈现层

## 下一步自然延伸

- Phase 2 / Step 16（已落地）：在保持最小化原则下，补充 replay hint/alert 的最小抑制与去重占位，避免同 factKey 高频重复告警噪声。
