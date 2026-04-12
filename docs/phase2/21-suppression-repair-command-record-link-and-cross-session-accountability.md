# Phase 2 / Step 21 - Lifecycle Slot 与 Repair Command Record 最小审计关联回读占位

## 1. 收口模式与本步边界冻结

### 1.1 Phase 2 收口模式

- Phase 2 进入 Step 21-30 的收口预算阶段
- 后续每一步必须交付一整块可感知业务能力
- 优先围绕核心案件流闭环、状态迁移可解释性、跨会话连续性

### 1.2 本步要做

- 定义 suppression repair command record 最小模型
- 定义 lifecycle slot 与 latest command record 的最小关联字段
- 定义跨会话 command-link consistency 校验
- 让 query 直接回读“最近一次 lifecycle 变化对应哪条命令”
- 补测试

### 1.3 本步不做

- 完整审计平台
- 完整 timeline/history 平台
- 批量命令追踪平台
- 工单系统
- UI/API/console
- 外部数据库真实接入
- 治理模板扩展

## 2. 最小 Repair Command Record 模型

新增模型（ports）：

- `StoredDiagnosticAlertSuppressionRepairCommandRecord`

字段：

- `commandRecordId`
- `commandType`（`repair | confirm | retry`）
- `suppressionKey`
- `triggeredAt`
- `triggeredBy`
- `outcome`
- `outcomeReason`
- `resultingRepairStatus`
- `schemaVersionBefore`
- `schemaVersionAfter`
- `linkedLifecycleVersion`

说明：

- 该模型仅服务 suppression repair lifecycle 追责链，不泛化为全局审计平台。

## 3. 最小 Record Store 边界

新增 store port：

- `DiagnosticAlertSuppressionRepairCommandRecordStorePort`

最小接口：

- `put(record)`
- `getLatestBySuppressionKey(key)`

原因：

- Step 21 目标是 latest command 与当前 lifecycle 的关联可读
- 不需要历史列表查询能力

## 4. 写路径收敛（Repair/Confirm/Retry）

`DiagnosticAlertSuppressionStateRepairCommandHandler` 已统一：

- 每次 lifecycle transition 时构造 command record
- 先写 command record，再写 lifecycle slot，并把 `lastCommandRecordId` 写入 slot
- repair/confirm/retry 成功与失败路径都落 command record（当 store 配置可用）
- command record 写失败时不破坏主业务 repair lifecycle 语义，仅在解释层体现缺失关联

## 5. Lifecycle Slot 关联增强

`StoredDiagnosticAlertSuppressionStateRepairLifecycleSlot` 新增：

- `lastCommandRecordId`

用于表达：

- 当前 `currentLifecycle` 最近一次变化对应哪条命令记录

## 6. Command-Link Consistency 校验

新增：

- `validateSuppressionRepairLifecycleCommandLink(...)`

最小校验：

- slot `lastCommandRecordId` 与 latest command record 一致
- command `resultingRepairStatus` 与 lifecycle `currentRepairStatus` 一致
- command `suppressionKey` 与 lifecycle key 一致
- `triggeredAt <= lifecycle.updatedAt`

状态：

- `passed`
- `missing_record`
- `status_mismatch`
- `key_mismatch`
- `timeline_invalid`

这些异常只影响追责解释层，不改变 Step 19/20 主业务语义。

## 7. 读路径增强

`CoordinationResultDiagnosticQueryResult` 新增：

- `suppressionStateRepairCommandLink`
  - `lastCommandType`
  - `lastCommandOutcome`
  - `lastCommandTriggeredAt`
  - `commandLinkConsistencyStatus`
  - `commandLinkConsistencyReason`

效果：

- 调用方可直接看到“当前 lifecycle 最近由哪类命令动作导致”

## 8. 为什么只做 latest record 追责链

- 当前目标是最小跨会话追责闭环，不是历史审计平台
- `latest record + lifecycle slot` 已足够回答“当前状态是谁导致”
- 扩到 timeline 会显著扩大设计边界，超出收口阶段预算

## 9. 下一步自然延伸

- Step 22 建议合并一整块能力：将 suppression repair accountability 与核心案件流诊断聚合审计输出进一步合流，补最小 end-to-end 追责查询闭环（仍不平台化）。

