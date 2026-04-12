# Audit And Metrics Semantics (Phase 1)

## Compensation 状态变更审计事件

当前采用统一事件：

- `CompensationStatusChanged`

采用统一事件而不是拆分多个事件的原因：

- 当前 Phase 1 只需冻结最小审计语义
- 统一事件可稳定承载 before/after 变化，不引入过多契约分叉

最小字段：

- `resultReference`
- `caseId`
- `commandName`
- `beforeStatus`
- `afterStatus`
- `reason`
- `traceId`
- `occurredAt`

## 事件产生与不产生规则

- 产生成功事件：
  - `pending -> resolved`
  - `pending -> manual_intervention_required`
- 不产生成功事件：
  - 非法状态变更
  - 查询 missing
  - 依赖失败（query/mutation unavailable）

## 审计事件层级边界

- 当前事件放在 application/recovery 侧，不进入 domain 事件与 contracts 对外事件。
- 原因：这是恢复编排审计语义，不是核心领域真相事件，也不是对外契约。

## Observability -> Metrics 映射占位

映射入口：`projectCommandResultQueryToMetrics(...)`

映射维度：

- `outcome`：`found | missing | unavailable`
- `validation`：`passed | missing_version | unsupported_version | not_performed`
- `versionMismatch`：`true | false`
- `snapshotMissing`：`true | false`
- `fallbackApplied`：`true | false`（当前阶段固定 `false`）

输出结构：

- `metricName`（固定占位）
- `labels`（稳定维度）
- `value`（当前固定 `1`）

## 当前阶段不做什么

- 不接真实 audit store
- 不接真实 metrics backend
- 不接 OpenTelemetry / Prometheus SDK
- 不实现 tracing 系统
- 不实现真实 recovery worker
