# Result Reuse And Recovery Semantics (Phase 1)

## Duplicate + Result Reference 语义

### 场景 A：duplicate + 有 resultReference + 可回读

- 行为：按引用调用 `CommandResultStorePort.getByReference(...)`
- 若命中快照：返回成功结果（`success=true`），并保留：
  - `idempotency.status = duplicate`
  - `idempotency.reuse = reference_available`
- 说明：当前是“快照复用占位”，不是完整重放执行

### 场景 B：duplicate + 有 resultReference + 不可回读

- 两种不可回读：
  - 引用存在但快照缺失
  - 引用查询依赖失败
- 收敛：
  - 缺失 -> `TQ-APP-006`
  - 依赖失败 -> `TQ-APP-004`

### 场景 C：duplicate + 无 resultReference

- 收敛：`TQ-APP-006`
- 语义：显式声明“当前阶段无可复用历史结果引用”

## Publish 失败补偿标记语义

当出现“save succeeded + mapping succeeded + publish failed”时：

- 返回：
  - `TQ-APP-005`
  - `processing.outcome = failed_after_persistence`
  - `compensation` marker（`required=true`, `reason=publish_failed`, `status=pending`）
- 意义：冻结“待补偿/待重试”状态，不吞失败

## 按引用查询语义

- 入口：`CommandResultQueryHandler.getCommandResultByReference(...)`
- 返回三态：
  - `found`：返回结构化快照
  - `missing`：引用不存在
  - `unavailable`：依赖失败（`TQ-APP-004`）

## 当前阶段不做什么

- 不接真实 result store
- 不实现真实 outbox / retry worker
- 不实现真实 audit store
- 不实现自动补偿流程
