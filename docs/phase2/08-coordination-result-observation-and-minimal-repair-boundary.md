# Phase 2 / Step 8 - Coordination Result Observation And Minimal Read-View Repair Boundary

## 本步范围冻结

### 本步要做

- 定义 coordination result 最小 observation 语义与投影
- 增加最小 metrics sink port 占位
- 在 query / persistence / validation 路径输出 observation
- 定义单条 read-view 修复命令边界
- 支持单条回补写入与幂等 noop
- 输出最小 repair record（可解释、可测试、可查询）
- 补测试

### 本步不做

- 完整 metrics 平台
- 外部监控系统接入
- 批量修复平台
- 完整 replay / repair engine
- 外部数据库真实接入
- UI / API / console
- worker / scheduler / saga
- 治理模板继续扩张

## 最小 Observation 语义

新增 `CoordinationResultReadObservation`（由 `buildCoordinationResultObservation(...)` 统一构建），核心信号：

- `storeReadHit`
- `registryFallbackUsed`
- `validationPassed`
- `validationFailed`
- `persistenceWriteSucceeded`
- `persistenceWriteFailed`
- `repairAttempted`
- `repairSucceeded`
- `repairFailed`

并附带最小上下文字段（`scope/factKey/riskCaseId/subcaseType/subcaseId`）。

## 最小 Metrics Sink 占位

新增 `CoordinationMetricsSinkPort.record(observation)`。

约束：

- 仅做最小记录占位，不接外部 metrics 基础设施
- sink 失败旁路暴露，不覆盖主业务结果（query/repair 结果仍返回）

## Query / Persistence / Validation 观测收敛

### Query 路径

`CoordinationResultQueryHandler` 统一输出 observation：

- store hit
- store miss + registry fallback
- validation passed/failed
- query miss

同时返回 `metricsSink` 状态（`succeeded/failed/not_attempted`）。

### Persistence 写路径

`CoreCaseFlowCommandHandler.persistCoordinationReadView(...)` 在关键分支发出 observation：

- persistence write succeeded/failed
- existing store hit + validation passed/failed

用于识别“业务已处理但 read-view 持久化失败”场景。

## 最小 Repair Command 边界

新增：

- `RepairCoordinationResultReadViewCommand`
- `CoordinationResultRepairCommandHandler`
- `CoordinationResultRepairCommandResult`
- `CoordinationResultRepairRecordRegistry`

目标：修补 read-view 持久化层，不重算业务，不修改业务事实。

支持定位方式：

- `factKey`
- 或 `riskCaseId + subcaseType + subcaseId + occurredAt`

## 最小 Repair 规则

### 可修复

- store miss 且 registry 有 source -> 写入持久化边界
- 写路径曾失败但 registry 仍有 source -> 单条回补成功

### 拒绝修复/失败

- registry source missing
- schema/version 不兼容
- replay validation 冲突
- 已存结果与修复 source 关键语义不一致

### 幂等/noop

- 已持久化且通过一致性校验 -> `already_persisted`（noop，不重复写）

## 审计/修复表达

当前阶段通过最小 repair record 表达修复语义：

- 修复目标 factKey
- 来源（按 factKey 或组合键）
- 结果（`repaired/already_persisted/failed`）
- 是否落盘成功
- `reason/repairedAt/triggeredBy`

并可通过 `CoordinationResultRepairRecordRegistry.getByFactKey(...)` 查询。

## Query / Persistence / Repair / Validation 关系

1. 写路径产出 read-view 并尝试持久化，同时记录 persistence observation
2. 读路径优先读 store，校验后返回；miss 时 fallback registry
3. repair 路径仅修补持久化层，不改变业务事实
4. replay validation 作为读/修复公共边界，阻止不兼容或冲突数据继续流转

## 本步未做什么

- 未做批量 repair
- 未做 replay 执行平台
- 未做外部 metrics/存储接入
- 未做 worker/scheduler 驱动

## 下一步自然延伸

- Step 9 已完成：`docs/phase2/09-repair-status-model-and-diagnostic-view.md`。
- 下一步可在保持最小化原则下补充诊断视图最小风险分级与人工处理建议字段。
