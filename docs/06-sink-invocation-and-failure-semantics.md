# Sink Invocation And Failure Semantics (Phase 1)

## Sink 调用位置

- `CompensationCommandHandler`
  - 仅在补偿状态变更成功后调用 `AuditEventSinkPort.append(...)`
- `CommandResultQueryHandler`
  - 每次查询结果（found/missing/unavailable）都生成 projection，并调用 `MetricsSinkPort.record(...)`

## Sink 状态最小模型

- `succeeded`
- `failed`
- `not_attempted`
- `retryEligibility`：
  - `eligible_for_retry`
  - `manual_repair_only`
  - `not_applicable`

## 失败并列收敛语义

### A. 主业务成功，audit sink 失败

- compensation 命令仍返回 `success=true`
- 结果里 `auditSink.status=failed`，并包含最小错误摘要与 `recoveryReference`
- `retryEligibility=eligible_for_retry`（当前阶段语义冻结，不执行真实重试）
- 语义：主业务与旁路审计分层，不允许静默吞失败

### B. query 成功，metrics sink 失败

- 查询结果状态（found/missing/unavailable）保持原判定
- 结果里 `metricsSink.status=failed`，并包含最小错误摘要与 `recoveryReference`
- `retryEligibility=eligible_for_retry`
- 语义：查询语义不被旁路 metrics 上报覆盖，但失败必须显式暴露

### C. audit sink 成功，metrics sink 不适用

- 在 compensation command 结果中只返回 `auditSink`
- metrics sink 不属于该结果模型（not_applicable by boundary）

### D. 主业务失败

- compensation command 失败路径：`auditSink.status=not_attempted`
- `not_attempted` 路径不生成 recovery reference，`retryEligibility=not_applicable`
- 查询路径不属于主业务变更命令，仍尝试 metrics sink 并显式报告其状态

## 当前阶段不做什么

- 不接真实 audit backend
- 不接真实 metrics backend
- 不接 OpenTelemetry/Prometheus SDK
- 不做 tracing backend
- 不做重型 telemetry pipeline
