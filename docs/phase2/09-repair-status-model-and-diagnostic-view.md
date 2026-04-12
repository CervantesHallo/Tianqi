# Phase 2 / Step 9 - Repair Status Model And Diagnostic View

## 本步范围冻结

### 本步要做

- 定义 repair 失败后的最小状态模型
- 定义最小人工确认与再尝试命令边界
- 固化状态迁移规则（success/fail/retry/confirm/noop）
- 定义按 factKey 聚合的最小诊断读视图
- 收敛 query/persistence/validation/repair observation 到统一诊断出口
- 补测试

### 本步不做

- 完整 repair workflow 平台
- 批量 repair / 批量人工确认
- 自动重试 worker/scheduler
- dashboard/UI/API 平台化实现
- 外部数据库/消息系统接入
- replay engine
- 治理模板扩张

## Repair 最小状态模型

新增 `CoordinationResultRepairStatus`：

- `not_repaired`
- `repair_failed_retryable`
- `repair_failed_manual_confirmation_required`
- `manually_confirmed`
- `repaired`

该状态集用于表达 Step 8 后续语义，不扩展成复杂工作流。

## Confirm / Retry 最小命令边界

新增：

- `ConfirmCoordinationResultRepairManuallyCommand`
- `RetryCoordinationResultRepairCommand`

约束：

- Confirm 仅标记人工确认，不伪装成持久化成功，不改业务事实
- Retry 仅针对单条 factKey 重新尝试 read-view 持久化，不做批量/自动重试

## 最小状态迁移规则

- 规则 A：`not_repaired -> repaired`（首次 repair 成功）
- 规则 B：repair 失败 -> `repair_failed_retryable` 或 `repair_failed_manual_confirmation_required`
- 规则 C：`repair_failed_retryable -> repaired`（retry 成功）
- 规则 D：`repair_failed_retryable / repair_failed_manual_confirmation_required -> manually_confirmed`
- 规则 E：
  - `repaired` 不能再人工确认
  - `manually_confirmed` 允许有限 retry（当前阶段显式命令触发）

## 最小诊断聚合视图

新增 `CoordinationResultDiagnosticView`，按 factKey 聚合：

- `factKey`
- `riskCaseId`
- `subcaseType`
- `subcaseId`
- `currentReadViewStatus`（persisted/fallback_only/missing）
- `validationStatus`
- `lastQueryObservation`
- `lastPersistenceObservation`
- `lastRepairObservation`
- `repairStatus`
- `repairAttempts`
- `lastRepairOutcome`
- `manualConfirmation`
- `diagnosticSummary`

## 最小诊断查询入口

新增：

- `GetCoordinationResultDiagnosticViewQuery`
- `CoordinationResultDiagnosticQueryHandler`

当前阶段仅支持单条 factKey 查询，不做复杂列表检索。

## Observation 收敛策略

通过 `CoordinationResultObservationRegistry` 最小收敛：

- 最近一次 query observation
- 最近一次 persistence observation
- 最近一次 repair observation

同时通过 `CoordinationResultRepairRecordRegistry` 收敛：

- 当前 repairStatus
- repairAttempts
- lastRepairOutcome
- manualConfirmation

## 错误语义

已覆盖：

- retry source missing
- retry blocked by non-retryable status
- manual confirmation blocked by invalid status
- diagnostic view not found
- invalid repair status transition
- retry after manually_confirmed（允许，成功时进入 repaired）

均返回结构化错误，不依赖模糊 message。

## 本步未做什么

- 未做完整 repair workflow/dashboard
- 未做批量修复/批量确认
- 未做自动重试系统
- 未接外部持久化/消息系统

## 下一步自然延伸

- Phase 2 / Step 10：在保持最小化原则下，补充“诊断视图最小风险分级与人工处理建议字段”，提升运维可解释性（仍不进入完整 workflow/dashboard 平台）。
- Phase 2 / Step 11：在不平台化前提下，补充判读规则可配置化边界与版本演进占位。
