# Compensation Command Semantics (Phase 1)

## 支持的单条命令

- `ResolveCompensationCommand`
- `MarkCompensationManualInterventionRequiredCommand`

这两个命令都只处理单条记录，不提供批量能力。

## 合法/非法状态变更矩阵（最小冻结）

- 合法：
  - `pending -> resolved`
  - `pending -> manual_intervention_required`
  - `manual_intervention_required -> resolved`（允许：表示人工接管后确认处理完成）
- 非法：
  - `not_required -> resolved`
  - `resolved -> pending`

## 语义边界

- `resolved`：仅表示补偿/恢复已经被确认完成，不等于已经实现自动重试系统。
- `manual_intervention_required`：仅表示需要人工接管，不等于已经实现工单系统。

## Missing / 依赖失败收敛

- 记录缺失：`TQ-APP-003`
- 查询/更新依赖失败：`TQ-APP-004`
- 非法状态变更：`TQ-APP-002`

## 查询 Observability 语义

`CommandResultQueryHandler` 输出最小 observability：

- `validation`: `passed | missing_version | unsupported_version | not_performed`
- `versionMismatch`: `true/false`
- `snapshotMissing`: `true/false`
- `fallbackApplied`: 当前固定为 `false`（本阶段不支持 fallback）

## 当前阶段不做什么

- 不实现真实 retry worker
- 不实现真实 manual intervention 执行系统
- 不实现真实 metrics/tracing backend
- 不实现真实 audit store
