# Recovery Record Store And Manual Resolution Semantics (Phase 1)

## Recovery Record 何时 append

仅在 sink 已失败且已生成 `recoveryReference` 时 append：

- `CompensationCommandHandler`：主业务成功 + `audit sink failed`
- `CommandResultQueryHandler`：query 收敛后 + `metrics sink failed`

以下路径不 append：

- sink `succeeded`
- sink `not_attempted`

## Append 失败并列收敛语义

### A. 主业务成功 + sink failed + append 成功

- 主业务结果保持成功/既有 query 状态
- sink 状态保持 `failed`
- `recovery.recoveryRecord.status = persisted`

### B. 主业务成功 + sink failed + append 失败

- 主业务结果保持成功/既有 query 状态（不被旁路覆盖）
- sink 状态保持 `failed`
- `recovery.recoveryRecord.status = persist_failed`
- 返回最小错误摘要，禁止静默吞掉 append failure

### C. sink succeeded / not_attempted

- 不 append recovery record
- 不伪造 persisted 状态

## Manual Resolve 命令语义

命令：`MarkSinkFailureManuallyResolvedCommand`

职责：

- 按 `recoveryReference` 定位单条 recovery record
- 仅允许 `open -> manually_resolved`
- 可附带 `note`

不做：

- 不执行真实 retry/replay
- 不触发后台修复任务
- 不做批量人工修复

## Recovery 单条查询语义

入口：`SinkFailureRecoveryQueryHandler.getByRecoveryReference(...)`

返回：

- `found`：返回 recovery record 视图
- `missing`：记录不存在
- `unavailable`：依赖失败（结构化 application error）

## 模型边界

- recovery record 不是 compensation marker
- recovery record 不是 sink invocation status
- recovery record 不是 query observability
- recovery record 不是 command result 本体

它只负责 sink failure 的恢复定位与人工回写语义占位。

## 当前阶段不做什么

- 不实现真实 retry worker
- 不实现真实 replay tool
- 不实现真实后台修复系统
- 不实现批量 recovery 管理平台
- 不接真实数据库
