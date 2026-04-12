# Phase 2 / Step 14 - Persisted History Replay Validation And Conflict Attribution

## 本步范围冻结

### 本步要做

- 为 persisted history slot 增加最小 replay validation 占位
- 定义最小冲突归因字段（attribution）
- 让 diagnostic 读路径输出 replay validation + attribution
- 固化跨版本/跨快照冲突的最小 notice/failed/passed 规则
- 补测试

### 本步不做

- 完整 replay engine
- 完整历史重放系统
- 完整冲突调查平台
- 批量历史修复/迁移
- 外部数据库接入
- UI/API/console
- 治理模板扩张

## Replay Validation 最小模型

新增 `DiagnosticHistoryReplayValidationResult`：

- `status`: `passed | notice | failed`
- `reasonCategory`:
  - `version_mismatch`
  - `schema_incompatible`
  - `fact_key_mismatch`
  - `current_snapshot_conflict`
  - `previous_snapshot_conflict`
  - `status_field_conflict`
  - `rules_version_conflict`
- `reason`
- `conflictAttribution?`

## Conflict Attribution 最小字段

新增 `DiagnosticHistoryConflictAttribution`：

- `conflictCategory`
- `conflictField`
- `expectedValue`
- `actualValue`
- `snapshotSource`（`currentResult | previousResult | liveResult`）
- `attributionSummary`

当前阶段仅输出单条最小归因，不扩展多冲突平台。

## Consistency 校验增强

`validateDiagnosticHistorySlotConsistency(...)` 已收敛调用 `validateDiagnosticHistoryReplay(...)`，统一输出：

- `status/reason`
- `replayValidation`
- `conflictAttribution?`

覆盖最小场景：

- schema/version 问题（失败）
- factKey mismatch（失败）
- 兼容版本差异（notice）
- risk/hint/status 关键字段冲突（notice + attribution）

## 读路径增强

`CoordinationResultDiagnosticQueryHandler` 在 `includeHistoryComparison=true` 下，结构化返回：

- `historyReplayValidation`
- `historyConflictAttribution`
- `historyComparisonNotice`

并保持来源统一语义：

- persisted 与 in-memory fallback 都返回统一 shape
- fallback 场景也返回 replayValidation（notice）

## 冲突处理最小规则

- `schema_incompatible / fact_key_mismatch` -> failed（拒绝伪装正常 comparison）
- `assessmentRulesVersion` 在支持集合内但不一致 -> notice（comparison 可继续）
- `riskLevel/manualActionHint/状态字段` 的 persisted vs live 冲突 -> notice + attribution
- persisted/fallback 返回字段统一，不分叉两套结构

## Persisted Slot 最小增强

`StoredCoordinationDiagnosticResultSnapshot` 新增最小来源语义：

- `provenance`: `live_diagnostic_query | persisted_history_rotation`

用于后续 attribution 来源稳定化，不扩展为完整历史模型。

## 测试覆盖

- replay validation passed/notice/failed
- version 冲突归因与字段冲突归因
- persisted 与 fallback 场景的统一返回结构
- includeHistoryComparison=false 不引入额外失败
- 默认读取语义保持稳定

## 本步未做什么

- 未实现完整 replay/history 平台
- 未做批量重放与修复
- 未接外部数据库/消息系统
- 未做 UI/API 可视化

## 下一步自然延伸

- Phase 2 / Step 15：在保持最小化原则下，补充 replay notice/failure 的最小运维处理建议字段与读侧告警占位。
