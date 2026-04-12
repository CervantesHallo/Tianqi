# Phase 2 / Step 4 - Multi-Subcase Minimal Ordering And Conflict Resolution

## 本步范围冻结

### 本步要做

- 定义同一 `RiskCase` 下多专项并存时的最小顺序约束
- 定义多专项终态信号到来时的最小冲突裁决规则
- 定义主案件收敛动作的最小优先级语义
- 增强协同入口，使其可基于“同主案件下其他专项案件上下文”进行裁决
- 增强审计与结果模型，显式表达裁决原因
- 补充成功/受限/边界测试

### 本步不做

- 全量多案件调度系统
- workflow engine / saga / scheduler
- liquidation / ADL 全量策略计算
- 分布式并发一致性平台
- 真实外部系统接入
- UI / API / console
- 治理模板进一步细化

## 多专项最小顺序模型

新增最小模型：

- `SubcaseTerminalSignal`
- `RiskCaseSubcaseCoordinationContext`
- `RiskCaseSubcaseSnapshot`
- `SubcaseTerminalOutcome(success/failure/non_terminal)`

协同时显式收集同 `RiskCase` 下全部专项快照（`LiquidationCase` + `ADLCase`），最小上下文包括：

- 当前触发信号（哪个专项、什么状态）
- 是否存在其他未终态专项
- 终态 success/failure 信号数量
- 是否存在终态冲突（同时有 success 与 failure）

## 最小冲突裁决规则

### 规则 A：存在未终态专项

- 如果当前是 completion 类信号且存在其他未终态专项，则不允许直接 close。
- 动作为 `MarkRiskCaseUnderReviewAfterSubcaseCompletion`（deferred，不推进 `RiskCase` 状态）。

### 规则 B：终态信号冲突

- 若同一 `RiskCase` 下同时存在 success 与 failure 终态信号，则按保守规则处理：
  - `ManualInterventionRequired` 优先于 `Resolved`
  - 即 failure 信号优先，动作为 `MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure`

### 规则 C：重复/过期低优先级信号

- 当 `RiskCase` 已体现更高优先级收敛结果后，再收到更低优先级终态信号：
  - 本阶段采用 **rejected**（拒绝覆盖）策略
  - 保留当前主案件状态，并在审计/结果中显式记录裁决原因

## 最小优先级语义

新增 `RISK_CASE_RESOLUTION_PRIORITY` 与 helper：

- `MarkRiskCaseUnderReviewAfterSubcaseCompletion` = 1
- `MarkRiskCaseResolvedAfterSubcaseCompletion` = 2
- `MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure` = 3

并新增 `getRiskCaseCurrentPriority`：

- `ManualInterventionRequired` = 3
- `Closed` = 2
- 其他状态 = 0

用于判断旧信号是否可覆盖当前收敛结果。

## 裁决入口落地

继续沿用并增强：

- `handleCoordinateRiskCaseAfterSubcaseTerminal`
- `handleTransitionLiquidationCase` / `handleTransitionADLCase` 的终态自动协同路径

新增 sibling subcase 加载能力（通过 repository `listBySourceRiskCaseId`）后，协同入口不再只看单一专项信号，而是基于同主案件最小上下文做裁决。

## 审计联动表达

在 `CaseAuditRecord` 增加 `context`（最小 metadata）后，协同审计可记录：

- 触发专项类型/ID/状态
- 总专项数
- 是否存在其他未终态专项
- success/failure 信号数量
- 是否冲突
- 使用的裁决规则
- 决策结果（applied/deferred/rejected）
- 选中优先级

这样可直接解释“为什么本次接受/延后/拒绝该终态信号”。

## 结果模型增强

`CoreCaseFlowResult.success.resolution` 增强字段：

- `decision`（`applied/deferred/rejected`）
- `hasOtherSubcases`
- `hasOtherActiveSubcases`
- `conflictDetected`
- `selectedPriority`
- `arbitrationRule`

调用方无需自行拼装多个对象即可理解裁决。

## 本步未做什么

- 未实现多专项并发锁与分布式时序一致性
- 未实现复杂仲裁策略平台
- 未进入全量 liquidation / ADL 策略计算
- 未接外部系统

## 下一步自然延伸

- Step 5 已完成：`docs/phase2/05-subcase-terminal-signal-ordering-and-idempotent-replay-boundary.md`。
- 下一步可在保持最小化原则下，补充协同裁决结果回读视图收敛与跨命令一致性校验。
