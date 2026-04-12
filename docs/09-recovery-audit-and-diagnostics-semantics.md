# Recovery Audit And Diagnostics Semantics (Phase 1)

## Recovery 审计事件模型

当前采用统一事件：

- `RecoveryRecordChanged`

通过 `eventKind` 区分：

- `RecoveryRecordAppended`
- `RecoveryRecordManuallyResolved`

最小字段：

- `recoveryReference`
- `eventKind`
- `beforeStatus`（仅 manual resolve）
- `afterStatus`
- `sinkKind`
- `resultReference`
- `caseId`（audit 场景）
- `traceId`
- `occurredAt`
- `note`（可选）

## 成功与失败路径事件语义

会产生成功事件：

- sink failed 且 recovery record append 成功
- `MarkSinkFailureManuallyResolvedCommand` 成功

不会产生成功事件：

- recovery append 失败
- manual resolve missing/unavailable/invalid_transition

## 边界说明

- recovery 审计事件属于 application/recovery 侧，不属于 domain 事件。
- recovery 审计事件和 compensation 审计事件并列存在：
  - compensation 事件描述补偿状态变化
  - recovery 事件描述 recovery record 生命周期变化
- recovery 事件在成功路径可进入 `AuditEventSinkPort` 占位调用，但不接真实 backend。

## Recovery Query Diagnostics

`RecoveryQueryDiagnostics` 最小字段：

- `outcome`：`found | missing | unavailable`
- `statusCategory`：`open | manually_resolved | none`
- `retryEligibilityCategory`：`eligible_for_retry | manual_repair_only | not_applicable`
- `hasNote`：`true/false`
- `storeAccessed`：当前固定 `true`
- `fallbackApplied`：当前固定 `false`

## Diagnostics -> Metrics Projection

映射入口：`projectRecoveryQueryToMetrics(...)`

映射维度：

- `outcome`
- `statusCategory`
- `retryEligibilityCategory`
- `hasNote`
- `fallbackApplied`

当前阶段不做真实 metrics 上报，仅冻结 projection 语义，供 future exporter 直接消费。

## 当前阶段不做什么

- 不接真实 audit store
- 不接真实 metrics backend
- 不接 tracing backend
- 不实现真实 recovery console
