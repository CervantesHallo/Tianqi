# Phase 2 / Step 20 - Suppression Repair Lifecycle 最小持久化槽与跨会话回读连续性

## 1. 本步范围冻结

### 1.1 本步要做

- 定义 suppression repair lifecycle 最小 persisted slot（仅 `current/previous`）
- 定义最小 lifecycle store port（`put/getBySuppressionKey`）
- 收敛 `repair / confirm / retry` 写路径到 persisted slot
- 新增跨会话 lifecycle continuity 校验（最小守卫）
- 让 diagnostic query 返回 lifecycle persistence/continuity 信息
- 增强测试与文档同步

### 1.2 本步不做

- 完整 repair workflow 平台
- 批量生命周期历史或 timeline 查询平台
- 自动重试调度
- 工单/审批系统
- UI/API/dashboard
- 外部数据库真实接入
- 治理模板继续扩张

## 2. Persisted Lifecycle Slot 设计

新增端口模型：

- `StoredDiagnosticAlertSuppressionStateRepairLifecycle`
- `StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot`

slot 字段：

- `schemaVersion`
- `suppressionKey`
- `currentLifecycle`
- `previousLifecycle`
- `updatedAt`

`currentLifecycle/previousLifecycle` 字段最小集合：

- `repairStatus`
- `repairAttempts`
- `lastRepairOutcome`
- `manualConfirmation`
- `lastReason`
- `lastAttemptedAt`
- `lastRepairedAt`
- `targetSuppressionKey`
- `schemaVersionBefore`
- `schemaVersionAfter`
- `canRetry`
- `canConfirmManually`

schema 版本固定：

- `DIAGNOSTIC_ALERT_SUPPRESSION_REPAIR_LIFECYCLE_SLOT_SCHEMA_VERSION = "1.0.0"`

## 3. 最小 Store Port 边界

新增：

- `DiagnosticAlertSuppressionStateRepairLifecycleStorePort`

最小能力：

- `put(slot)`：写入 current 并保留 previous 轮转
- `getBySuppressionKey(key)`：按 suppressionKey 读取 slot

为什么足够：

- Step 20 目标是“跨会话 continuity”，单 key 的 latest + previous 已可支撑 confirm/retry 连续性解释
- 当前不需要批量查询、分页、时间线回放平台能力

## 4. 写路径收敛（Repair/Confirm/Retry）

`DiagnosticAlertSuppressionStateRepairCommandHandler` 已增强：

- 每次正式命令入口先尝试从 persisted slot 同步到 registry（防止跨会话断层）
- 状态迁移统一走 `transitionAndPersist(...)`
- 迁移后写入 slot，采用 current->previous 轮转
- persist 失败时回滚本次 registry 迁移，避免 registry/store 语义分叉

双轨关系保持显式：

- registry：进程内快速态
- persisted slot：跨会话连续性边界

## 5. 跨会话 Continuity 校验

新增：

- `validateSuppressionRepairLifecycleContinuity(...)`

最小校验项：

- suppressionKey 一致性
- slot schema/version 有效
- persisted current 与 live lifecycle 关键字段冲突检测
- `repairAttempts` 不倒退（current>=previous，persisted>=live）
- `manualConfirmation` 与 `repairStatus` 合法关系
- `lastAttemptedAt/lastRepairedAt` 时间合法
- `previous -> current` 状态迁移合法

状态输出：

- `passed`
- `notice`（slot missing 场景）
- `failed`（冲突/倒退/非法迁移/时间非法）

## 6. 读路径表达

新增集中 helper：

- `readSuppressionRepairLifecycleWithContinuity(...)`
- `mapRepairLifecycleToStored(...)`
- `createNextSuppressionRepairLifecycleSlot(...)`

`DiagnosticAlertSuppressionPersistence` 新增：

- `suppressionStateRepairPersistence`
  - `source`: `in_memory_only | persisted | persisted_with_fallback`
  - `continuityStatus`
  - `continuityReasonCategory`
  - `continuityReason`
  - `historyAvailable`
  - `currentLifecycleReadable`
  - `previousLifecycleAvailable`

`CoordinationResultDiagnosticQueryResult` 同步新增：

- `suppressionStateRepairPersistence`

这样调用方可直接识别“是否跨会话连续”，无需自行拼接 registry/store。

## 7. Step 19 主语义保持

保持不变：

- lifecycle 状态集合与转移主语义
- confirm/retry 边界与非法迁移护栏
- continuity 冲突到 repair status 的最小映射语义

本步仅增强：

- lifecycle persisted slot
- 跨会话 continuity 回读与解释层

## 8. 测试覆盖

新增/增强覆盖：

- repair 成功后 slot 写入
- confirm 成功后 slot 更新
- retry 成功后 previous/current 轮转
- query 回读 persisted lifecycle continuity
- continuity：slot missing、attempt 倒退、非法迁移、时间异常
- 边界：Step 19 语义不回归，registry/store 共存语义稳定

## 9. 下一步自然延伸

建议 Step 21：

- 在不平台化前提下补“最小审计回读绑定”（lifecycle slot 与 repair command record 的最小关联键）
- 继续强化跨会话可解释性，但仍不引入批量 workflow/timeline 平台

