# Sink Failure Recovery Reference Semantics (Phase 1)

## Recovery Reference 是什么

`recoveryReference` 是旁路 sink 失败时返回的最小可追踪句柄，用于 future retry/replay/manual repair 定位。

它不是任务实体，不包含调度、重试次数或执行状态机。

## 最小字段

- `sinkKind`：`audit | metrics`
- `recoveryId`：稳定恢复键（字符串品牌类型）
- `sourceCommandName` 或 `sourceQueryName`
- `resultReference`（query/audit 通用定位）
- `caseId`（audit 场景）
- `failedAt`
- `traceId`
- `failureCategory`（当前固定：`sink_dependency_failure`）

## Retry Eligibility 语义

- `eligible_for_retry`
  - 当前默认用于 `audit sink failed` 与 `metrics sink failed`
  - 原因：两类 sink 目前都是旁路输出，失败不会改变主业务真相，可在 future 以同一恢复键重放
- `manual_repair_only`
  - 预留语义，当前阶段不主动产出
- `not_applicable`
  - sink 成功或未尝试时使用

## 构造规则

### audit sink failed

- 在 `CompensationCommandHandler` 主业务成功后若 `AuditEventSinkPort.append` 失败：
  - 返回 `auditSink.status=failed`
  - 返回 `recoveryReference(sinkKind=audit, sourceCommandName, caseId, resultReference, traceId, failedAt, recoveryId)`

### metrics sink failed

- 在 `CommandResultQueryHandler` 查询结果收敛后若 `MetricsSinkPort.record` 失败：
  - 查询状态保持 `found/missing/unavailable`
  - 返回 `metricsSink.status=failed`
  - 返回 `recoveryReference(sinkKind=metrics, sourceQueryName, resultReference, traceId, failedAt, recoveryId)`

### 不生成 Recovery Reference 的路径

- sink `succeeded`
- sink `not_attempted`
- 主业务失败且 sink 未尝试

## 与其他模型的边界

- `CompensationMarker`：描述 publish 分叉后的补偿语义（命令处理链路）
- `observability`：描述 query 读取与快照校验语义（读取诊断）
- `recoveryReference`：仅描述 sink 失败后的恢复定位键（旁路失败恢复）

三者相关但不互相替代，不合并成一个“万能故障对象”。

## 当前阶段不做什么

- 不实现真实 retry worker
- 不实现真实 replay 工具
- 不实现真实后台修复任务
- 不实现真实 recovery store
