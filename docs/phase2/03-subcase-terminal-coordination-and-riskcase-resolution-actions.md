# Phase 2 / Step 3 - Subcase Terminal Coordination And RiskCase Resolution Actions

## 本步范围冻结

### 本步要做

- 定义专项终态与主案件之间的最小协同规则
- 定义 `RiskCaseResolutionAction` 最小收敛动作语义
- 在 `LiquidationCase / ADLCase` 进入终态时驱动主案件收敛动作
- 提供显式协同入口 `handleCoordinateRiskCaseAfterSubcaseTerminal`
- 固化协同失败路径的结构化错误语义
- 增强审计与结果模型，使“专项终态 -> 主案件动作”可追溯
- 新增成功/失败/边界测试

### 本步不做

- liquidation 完成判定全量算法
- ADL 执行结果归并全量算法
- 多专项并发协调系统
- 复杂 case graph / workflow engine
- 真实账户/仓位/撮合/基金系统接入
- UI / API / console
- worker / scheduler / saga
- 治理模板继续扩展

## 主案件最小收敛动作

新增 `RiskCaseResolutionAction`（最小动作集）：

- `MarkRiskCaseUnderReviewAfterSubcaseCompletion`
- `MarkRiskCaseResolvedAfterSubcaseCompletion`
- `MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure`

动作集保持克制，仅覆盖“专项终态后主案件如何最小回应”。

## 专项终态 -> 主案件协同规则

### LiquidationCase

- `Completed`：
  - 若 `RiskCase` 状态允许关闭（`Classified` 或 `Settling`），执行 `MarkRiskCaseResolvedAfterSubcaseCompletion`，推进至 `Closed`。
  - 若 `RiskCase` 仍在中间处理态（`Liquidating/FundAbsorbing/EvaluatingADL/PlanningADL/ExecutingADL`），执行 `MarkRiskCaseUnderReviewAfterSubcaseCompletion`（保留当前状态，显式记录收敛动作）。
- `Failed`：
  - 执行 `MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure`，推进至 `ManualInterventionRequired`。

### ADLCase

- `Executed`：
  - 与 liquidation completion 一致，优先尝试收敛到 `Closed`，否则进入 under-review 动作语义。
- `Failed`：
  - 与 liquidation failure 一致，推进 `RiskCase` 至 `ManualInterventionRequired`。

## 主案件收敛入口

应用层新增/增强：

- `handleCoordinateRiskCaseAfterSubcaseTerminal`（显式协同入口）
- `handleTransitionLiquidationCase` / `handleTransitionADLCase` 在专项进入终态后自动触发协同收敛

这样既支持“终态自动协同”，也支持“显式重放/补偿式协同入口”。

## 错误语义固化

以下场景返回结构化错误并保持稳定错误码：

- 专项非终态触发协同：`TQ-APP-002`
- 来源 `RiskCase` 缺失：`TQ-APP-003`
- 主案件状态不支持当前协同动作：`TQ-APP-002`
- 终态语义与主案件状态冲突：`TQ-APP-002`
- 重复收敛（例如已 `Closed` 再做 completion 协同）：`TQ-APP-001`

## 审计联动表达

- 专项迁移审计继续保留（关联 `RiskCase`）。
- 专项终态触发主案件收敛时，新增主案件协同审计：
  - `caseType=RiskCase`
  - `action=RiskCaseResolutionAction`
  - `relatedCaseType=专项 case`
  - `relatedCaseId=专项 case id`
  - 明确 `beforeState/afterState/reason`

从而可追溯“专项终态导致主案件动作”的完整链路。

## 结果模型增强

`CoreCaseFlowResult` 成功结果新增/增强：

- `resolution`：显式返回专项终态触发的主案件收敛动作结果
  - `subcaseType/subcaseId/subcaseTerminalState`
  - `action`
  - `riskCaseId`
  - `beforeState/afterState`
  - `riskCaseTransitionApplied`
- `auditRecords[]`：同时包含专项迁移审计与主案件协同审计

## 本步未做什么

- 未做多专项优先级与冲突仲裁
- 未做复杂编排与事务一致性平台
- 未做外部系统接入
- 未进入策略层全量计算

## 下一步自然延伸

- Step 4 已完成：`docs/phase2/04-multi-subcase-minimal-ordering-and-conflict-resolution.md`。
- 下一步可在保持最小化原则下，补充多专项信号时间序语义与最小幂等重放边界。
