# Recovery Sink Invocation And Failure Semantics (Phase 1)

## Recovery 侧 Sink 调用位置

- `recovery append` 成功后：
  - 产出 `RecoveryRecordChanged(eventKind=RecoveryRecordAppended)`
  - 调用 `AuditEventSinkPort.append(...)`
- `manual resolve` 成功后：
  - 产出 `RecoveryRecordChanged(eventKind=RecoveryRecordManuallyResolved)`
  - 调用 `AuditEventSinkPort.append(...)`
- `recovery query` 收敛后（found/missing/unavailable）：
  - 生成 diagnostics
  - 生成 `projectRecoveryQueryToMetrics(...)`
  - 调用 `MetricsSinkPort.record(...)`

## Recovery 侧 Sink 结果模型

最小统一状态（恢复侧专用）：

- `succeeded`
- `failed`（含 `errorSummary`）
- `not_attempted`

说明：

- recovery 侧 sink 结果不携带额外 recovery reference，避免“故障上的故障”递归建模。

## 并列收敛矩阵

### A. recovery append 成功 + audit sink 失败

- append 仍视为成功（record 已持久化）
- recovery record 仍存在
- 结果中 `recovery.auditSink=failed` 显式暴露旁路失败

### B. manual resolve 成功 + audit sink 失败

- manual resolve 主结果仍 `success=true`
- 不回滚 `open -> manually_resolved`
- 结果中 `auditSink=failed` 显式暴露

### C. recovery query 任一结果 + metrics sink 失败

- query 主结果保持原语义（found/missing/unavailable）
- 结果中 `metricsSink=failed` 显式暴露

### D. 主路径失败

- append/manual resolve 主路径失败：`auditSink=not_attempted`
- query 主路径无独立“未收敛”分支；当前 found/missing/unavailable 均尝试 metrics sink

## 与现有模型边界

- recovery sink failure != recovery record failure
- recovery metrics sink failure != query failure
- recovery sink failure 当前不再生成二级 recovery reference（防止递归复杂化）

## 当前阶段不做什么

- 不接真实 audit backend
- 不接真实 metrics backend
- 不接 tracing backend
- 不实现 recovery console
- 不实现 recovery sink failure 的二次 recovery 系统
