# Recovery Display View And Diagnostics Summary Semantics (Phase 1)

## 为什么需要统一展示模型

Recovery 侧已有三条结果路径：

- recovery append 结果（来自 sink failure 处理）
- manual resolve 命令结果
- recovery query 结果

如果直接让调用方依赖原始结果模型，会造成字段名/语义分散。  
本阶段新增统一只读展示层：

- `RecoveryDisplayView`
- `RecoveryDiagnosticsSummary`

并固定 `viewVersion=1.0.0`（display 语义版本）。

用于 future recovery console / ops panel 读取，不承载执行语义。

## 三路径映射规则

- `mapRecoveryAppendToDisplayView(...)`
  - append persisted -> `mainOutcome=append_success`
  - append persist_failed -> `mainOutcome=append_failed`
- `mapManualResolveToDisplayView(...)`
  - success -> `mainOutcome=manual_resolved`
  - failure -> `mainOutcome=manual_resolve_failed`
- `mapRecoveryQueryToDisplayView(...)`
  - found -> `mainOutcome=query_found`
  - missing -> `mainOutcome=query_missing`
  - unavailable -> `mainOutcome=query_unavailable`

统一字段：

- `recoveryReference`
- `sinkKind`
- `recordStatus`
- `retryEligibility`
- `mainOutcome`
- `auditSinkStatus` / `metricsSinkStatus`
- `hasNote`
- `diagnosticsSummary`
- `timestamps`（最小集）

## Diagnostics Summary 包含与不包含

包含：

- `hasRecoveryRecord`
- `recordStatus`
- `retryEligibility`
- `hasNote`
- `latestSinkStatus`
- `queryOutcome`
- `manualInterventionRequired`
- `needsAttention`

不包含：

- 历史时间线
- 执行步骤明细
- 底层依赖原始错误对象

## needsAttention 最小规则

至少满足以下任一条件即 `true`：

- query outcome 为 `unavailable`
- `manualInterventionRequired=true`
- `append_failed` 且未持久化 recovery record
- record 为 `open` 且 `retryEligibility != not_applicable`
- `manual_resolve_failed`

其余场景为 `false`。

## 当前阶段不做什么

- 不实现 recovery console
- 不实现列表/分页/搜索
- 不实现完整时间线审计 UI 模型
- 不接真实前端或 API 层
