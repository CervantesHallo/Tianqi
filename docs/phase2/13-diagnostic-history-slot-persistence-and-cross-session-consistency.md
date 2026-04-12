# Phase 2 / Step 13 - Diagnostic History Slot Persistence And Cross-Session Consistency

## 本步范围冻结

### 本步要做

- 定义诊断历史槽最小持久化模型（current/previous）
- 定义最小 history store port（put/getByFactKey）
- 让诊断读路径在结果形成后写入 persisted history slot
- 定义跨会话读取一致性校验
- `includeHistoryComparison=true` 时优先读取 persisted history slot，并暴露 fallback 来源
- 补测试

### 本步不做

- 完整历史仓储平台
- 完整时间线查询
- 批量历史重建
- 外部数据库真实接入
- dashboard/UI/API
- 复杂迁移系统
- 治理模板扩张

## Persisted History Slot 最小模型

新增 `StoredCoordinationDiagnosticHistorySlot`（ports）：

- `schemaVersion`
- `factKey`
- `currentResult`
- `previousResult`
- `updatedAt`

其中 `currentResult/previousResult` 为最小 persisted snapshot，不暴露内部聚合对象。

## 最小 History Store Port

新增 `CoordinationDiagnosticHistoryStorePort`：

- `put(slot)`
- `getByFactKey(factKey)`

当前场景只需要“单 factKey 写入 + 单 factKey 读取”即可支撑 current vs previous 对比，不扩展为完整历史仓储。

## current/previous 轮转规则

在诊断查询形成 `currentView` 后尝试持久化：

- 读取已存在 slot
- 若存在：`existing.currentResult -> next.previousResult`
- `next.currentResult = currentView snapshot`
- 仅保留单条 previous，不维护完整时间线

## 跨会话一致性校验

新增 `validateDiagnosticHistorySlotConsistency(...)`，最小校验：

- `factKey` 一致
- slot `schemaVersion` 可读且支持
- persisted `current/previous` 的 `assessmentRulesVersion` 存在且可兼容读取
- persisted current 与 live current 关键字段冲突时返回 `notice`（不做重型 reconcile）

关键字段：

- `assessmentRulesVersion`
- `riskLevel`
- `manualActionHint`
- `validationStatus`
- `repairStatus`
- `currentReadViewStatus`

## 读路径增强（persisted 优先 + fallback 可见）

`CoordinationResultDiagnosticQueryHandler` 在 `includeHistoryComparison=true` 时：

1. 优先读取 persisted history slot
2. 不可用时回退 in-memory history registry
3. 返回结构化来源：
   - `historySource = persisted`
   - `historySource = in_memory_fallback`
   - `historySource = unavailable`
4. 返回：
   - `historyAvailable`
   - `comparisonResult`
   - `historyConsistency`
   - `historyNotice`

## 错误与结果语义

已覆盖：

- history slot missing（结构化来源 `unavailable` 或 fallback）
- history slot schemaVersion missing -> 结构化失败（`TQ-APP-007`）
- history slot schemaVersion unsupported -> 结构化失败（`TQ-APP-008`）
- factKey mismatch -> 结构化失败
- persisted current 与 live current 冲突 -> `historyConsistency=notice`
- fallback used -> `historySource=in_memory_fallback` 且 reason/notice 可见

## 测试覆盖

- persisted history slot 写入成功
- 第二次写入时 current/previous 轮转
- includeHistoryComparison 优先读 persisted 并产生 comparison
- persisted 缺失时 fallback 来源可见
- schemaVersion 缺失/不兼容稳定失败
- 一致性冲突返回 notice
- 默认读取语义不被破坏

## 本步未做什么

- 未做完整历史平台/时间线系统
- 未做批量历史重算
- 未接外部数据库/消息系统
- 未做 UI/API

## 下一步自然延伸

- Phase 2 / Step 14：在保持最小化原则下，补充 persisted history slot 最小回放校验占位与跨版本冲突归因字段。
