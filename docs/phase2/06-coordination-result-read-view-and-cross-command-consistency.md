# Phase 2 / Step 6 - Coordination Result Read View And Cross-Command Consistency

## 本步范围冻结

### 本步要做

- 收敛协同裁决结果的最小回读视图
- 为协同结果建立统一 read view 映射出口
- 增加最小应用层读取入口
- 增加跨命令路径一致性校验（自动协同 vs 显式协同）
- 对齐审计 context 与读视图语义
- 补测试

### 本步不做

- 完整 query/read model 平台
- 完整 replay engine
- 完整 event sourcing / snapshot 系统
- 外部数据库/消息系统接入
- UI / API / console
- 复杂 reporting / analytics 平台
- 新一轮治理模板扩张

## 最小协同裁决结果回读视图

新增 `RiskCaseCoordinationResultView`，最小稳定字段：

- `riskCaseId`
- `subcaseType`
- `subcaseId`
- `signalCategory`
- `decision`
- `resolutionAction`
- `beforeState`
- `afterState`
- `conflictDetected`
- `hasOtherActiveSubcases`
- `selectedPriority`
- `auditRecordSummary`
- `occurredAt`

并补充 `sourceCommandPath` 以便识别视图来源（自动协同或显式协同命令）。

## 核心路径结果表达收敛

通过统一 projector `projectCoreCaseFlowResultToCoordinationResultView(...)` 收敛：

- 专项迁移触发自动协同路径
- 显式协同命令路径
- duplicate / late / replayed 场景

create/非终态迁移等非协同路径不生成 coordination read view，调用方无需自行拼装。

## 最小跨命令一致性校验

新增 `assertCoordinationResultViewsConsistent(...)`，并在 registry 记录时执行。

最小一致性规则：

- 同一业务事实（`riskCaseId + subcaseType + subcaseId + occurredAt`）必须一致或等价
- 允许等价映射：`applied <-> duplicate`（重放/重复语义）
- 若关键语义冲突（动作/状态/标识不一致），返回结构化错误并拒绝写入 registry

## 审计与读视图对齐

读视图由 `RiskCase` 协同审计摘要映射生成，显式对齐：

- `resolution.decision` <-> `audit.context.arbitration_decision`
- `resolution.signalCategory` <-> `audit.context.signal_category`
- 关键字段不一致时 projector 返回结构化错误，防止读写语义漂移

## 最小读取入口

新增：

- `GetRiskCaseCoordinationResultQuery`
- `CoordinationResultQueryHandler`
- `CoordinationResultRegistry`（内存级最小 registry，不引入外部平台）

读取入口输入：

- `riskCaseId + subcaseType + subcaseId`

输出：

- 统一 `RiskCaseCoordinationResultView`
- 或结构化 not-found/validation 错误

## 本步未做什么

- 未实现完整 query 平台
- 未实现完整 replay/event sourcing
- 未接外部存储与消息基础设施
- 未进入分析报表平台

## 下一步自然延伸

- Step 7 已完成：`docs/phase2/07-coordination-result-persistence-boundary-and-replay-validation-placeholder.md`。
- 下一步可在保持最小化原则下补充协同结果读取观测指标与最小修复/回补边界。
