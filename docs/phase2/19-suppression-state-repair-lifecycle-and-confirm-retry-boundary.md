# Phase 2 / Step 19 - Suppression State Repair Lifecycle And Confirm/Retry Boundary

## 本步范围冻结

### 本步要做

- 定义 suppression state repair 的最小生命周期状态模型
- 定义 `confirm / retry` 的最小命令边界（单条）
- 固化 repair lifecycle 状态迁移规则
- 固化 continuity 冲突到 repair lifecycle 的最小映射规则
- 让 diagnostic 读路径直接返回 suppression repair lifecycle 状态
- 补齐集中 helper/registry，避免规则散落
- 补齐测试闭环

### 本步不做

- 完整 repair workflow 平台
- 批量 repair / 批量 confirm / 批量 retry
- 自动重试系统 / 自动确认系统
- UI / API / dashboard / 工单平台接入
- 外部数据库/消息系统新接入
- 治理模板扩张

## 最小生命周期状态模型

新增 `DiagnosticAlertSuppressionStateRepairStatus`：

- `not_repaired`
- `repair_failed_retryable`
- `repair_failed_manual_confirmation_required`
- `manually_confirmed`
- `repaired`

新增 `DiagnosticAlertSuppressionStateRepairLifecycleState`（单条 suppressionKey 维度）：

- `repairStatus`
- `repairAttempts`
- `lastRepairOutcome`
- `manualConfirmation`
- `lastReason`
- `lastAttemptedAt / lastRepairedAt`
- `targetSuppressionKey`
- `schemaVersionBefore / schemaVersionAfter`

当前阶段仅覆盖单条 repair 生命周期，不引入复杂平台状态机。

## Confirm / Retry 命令边界

新增：

- `ConfirmDiagnosticAlertSuppressionStateRepairManuallyCommand`
- `RetryDiagnosticAlertSuppressionStateRepairCommand`

命令语义：

- `Confirm` 仅表示人工知悉/接管，不伪装修复成功，不改变 suppression 主业务事实
- `Retry` 仅针对单条、显式触发，不做批量/自动，不改变原始 hint/alert 业务事实

## 状态迁移规则（最小固化）

- 规则 A：`not_repaired -> repaired`（首次 repair 成功）
- 规则 B：repair 失败按原因进入：
  - `repair_failed_retryable`
  - `repair_failed_manual_confirmation_required`
- 规则 C：`repair_failed_retryable -> repaired`（retry 成功）
- 规则 D：`repair_failed_retryable / repair_failed_manual_confirmation_required -> manually_confirmed`（confirm 成功）
- 规则 E：
  - `repaired` 不能再 confirm
  - 当前阶段允许 `manually_confirmed -> retry`，retry 成功后进入 `repaired`
- 规则 F：continuity 冲突映射：
  - 结构/可修复类 -> `repair_failed_retryable`
  - 语义冲突/关键字段冲突 -> `repair_failed_manual_confirmation_required`

## Continuity -> Repair Lifecycle 映射

集中映射函数：`mapContinuityFailureToRepairStatus(...)`。

当前策略：

- 以下归为 `repair_failed_retryable`：
  - `schema_missing`
  - `persisted_state_malformed`
  - `repeat_count_regressed`
  - `invalid_timeline`
  - 其他可安全重试的 continuity 失败
- 以下归为 `repair_failed_manual_confirmation_required`：
  - `suppression_key_mismatch`
  - `semantic_mismatch`
  - `incompatible_version`（当前阶段定义为需人工确认）

说明：`compatible_with_notice` 仍可连续读取，不直接作为失败映射对象。

## 读路径增强

`CoordinationResultDiagnosticQueryResult` 新增 `suppressionStateRepair`（以及 `alertSuppressionPersistence.suppressionStateRepair`）：

- 当前 lifecycle 状态
- 是否可 `retry`
- 是否可 `confirm manually`
- 最近一次 outcome/原因/时间
- schema version before/after（若适用）

调用方无需手工拼 `continuity + repair`。

## 集中化实现

新增集中组件：

- `DiagnosticAlertSuppressionStateRepairLifecycleRegistry`
- `mapContinuityFailureToRepairStatus(...)`
- 生命周期能力函数：
  - `canRetrySuppressionStateRepairUnderStatus(...)`
  - `canConfirmSuppressionStateRepairManuallyUnderStatus(...)`

并将 confirm/retry/transition 逻辑集中在
`DiagnosticAlertSuppressionStateRepairCommandHandler` 与 lifecycle registry。

## 测试覆盖

新增/增强覆盖：

- repair 成功 -> `repaired`
- repair 失败（可重试类）-> `repair_failed_retryable`
- repair 失败（语义冲突类）-> `repair_failed_manual_confirmation_required`
- `retry` 成功 -> `repaired`
- `confirm` 成功 -> `manually_confirmed`
- `repaired` 非法 confirm 被阻断
- 非 retryable 状态 retry 被阻断
- continuity 轻度问题 -> retryable
- continuity 语义冲突 -> manual_confirmation_required
- `incompatible_version` 映射为 manual_confirmation_required
- query 结果可直接断言 lifecycle 字段
- Step 18 compatibility/repair 语义不回退

## 本步没做什么

- 没做完整 workflow 编排平台
- 没做批处理与自动化调度
- 没做外部系统接入与 UI/API 扩展

## 下一步自然延伸

- Phase 2 / Step 20：在最小化前提下补充 suppression repair lifecycle 的跨会话持久化与审计回读占位，让 confirm/retry 生命周期在重启后可连续回读。
