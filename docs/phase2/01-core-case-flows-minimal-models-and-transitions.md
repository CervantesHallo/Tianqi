# Phase 2 / Step 1 - Core Case Flows Minimal Models And Transitions

## 本步范围冻结

### 本步要做

- 建立 `RiskCase` / `LiquidationCase` / `ADLCase` 三类最小模型
- 定义三类 case 的最小状态集合
- 建立三类 case 的基本状态迁移入口（合法/非法约束 + 结构化错误）
- 新增最小统一审计记录模型 `CaseAuditRecord`
- 让迁移成功路径产出最小审计记录，形成迁移-审计闭环
- 新增最小应用层入口（创建/迁移/结果收敛）与测试

### 本步不做

- 全量 liquidation 计算细节
- 全量 ADL 排序算法
- 保险基金瀑布细节
- 真实外部系统接入
- 泛化 execution framework
- UI / API / console
- 分布式 worker / scheduler
- 复杂补偿机制扩展
- 新一轮治理模板微拆分

## 三类 Case 的最小建模关系

- `RiskCase`：风险处置域中的基础案件对象（沿用既有聚合与状态机）
- `LiquidationCase`：liquidation 专项案件，保留独立身份字段并关联 `sourceRiskCaseId`
- `ADLCase`：ADL 专项案件，保留独立身份字段并关联 `sourceRiskCaseId`

当前采用“独立模型 + 共享基础字段（id/trace/config/source）”方式，不引入复杂继承体系，优先保证最小可演进。

## 最小状态集合（Step 1）

- `RiskCase`（Step 1 最小子集）：`Detected` -> `Validating` -> `Classified` -> `Closed`
- `LiquidationCase`：`Initiated` -> `InProgress` -> `Completed`（含 `Failed`）
- `ADLCase`：`Initiated` -> `Queued` -> `Executed`（含 `Failed`）

状态命名保持语义直观，优先支持最小迁移闭环，不一次铺开全量流程状态。

## 最小迁移与审计语义

- 迁移入口：
  - `RiskCaseStateMachine`（补最小 `Classified -> Closed` 直接收敛路径）
  - `LiquidationCaseStateMachine`
  - `ADLCaseStateMachine`
- 约束：
  - 非法迁移返回结构化 `DomainError`
  - 终态禁止继续迁移
  - 时间回退、reason 为空、configVersion 不匹配均拒绝
- 审计：
  - 统一最小模型 `CaseAuditRecord`
  - 字段：`auditId/caseType/caseId/action/beforeState/afterState/reason/traceId/occurredAt`
  - 三类 case 迁移成功均可产出审计记录

## 应用层最小入口

- `CoreCaseFlowCommandHandler`
  - `handleCreateLiquidationCase`
  - `handleCreateADLCase`
  - `handleTransitionRiskCase`
  - `handleTransitionLiquidationCase`
  - `handleTransitionADLCase`

结果统一为结构化 `CoreCaseFlowResult`，包含 `caseView`、可选 `transition` 与可选 `auditRecord`。

## 本步未做什么

- 未接真实 audit sink/backend
- 未接真实外部系统
- 未进入 liquidation/ADL 策略细节
- 未进入编排器/分布式执行

## 下一步自然延伸

- Step 2 已完成：`docs/phase2/02-core-case-linkage-and-consistency-rules.md`。
- 下一步可在不扩展到策略层的前提下，补充跨案件终态收敛动作与更细粒度协同约束。
