# Phase 2 / Step 2 - Core Case Linkage And Consistency Rules

## 本步范围冻结

### 本步要做

- 冻结 `RiskCase -> LiquidationCase / ADLCase` 的最小关联语义
- 落地 source/parent/reference 的最小一致性约束（不是只保留字段）
- 在专项案件创建前执行来源 `RiskCase` 存在性与状态校验
- 在专项案件迁移前执行主案件状态一致性校验
- 增强统一审计语义，使专项案件动作可追溯到主案件
- 增强应用层结果模型，使联动校验与审计摘要可直接断言
- 新增成功/失败/边界测试并通过全量门禁

### 本步不做

- liquidation 全量业务计算
- ADL 全量候选筛选与排序
- 复杂策略编排与策略引擎
- 真实账户/仓位/撮合/基金系统接入
- saga / worker / scheduler
- UI / API / console
- 治理模板继续细碎扩张

## 三类案件最小关系模型

- `RiskCase` 是上游主案件，作为专项案件的来源语义根。
- `LiquidationCase` 与 `ADLCase` 均为独立模型，但必须通过 `sourceRiskCaseId` 绑定到已存在 `RiskCase`。
- 当前关系基线采用 `RiskCase -> 0..n LiquidationCase` 与 `RiskCase -> 0..n ADLCase`（不做 0..1 唯一约束）。

## 创建一致性约束

- `CreateLiquidationCaseFromRiskCaseCommand` / `CreateADLCaseFromRiskCaseCommand` 必须加载来源 `RiskCase`。
- 来源 `RiskCase` 不存在时返回结构化错误 `TQ-APP-003`。
- 来源 `RiskCase` 状态必须满足派生规则：当前最小集仅允许 `Classified`。
- 不满足状态规则时返回结构化错误 `TQ-APP-002`。
- 旧入口 `handleCreateLiquidationCase` / `handleCreateADLCase` 保持兼容，但内部统一走 from-risk-case 约束路径，避免绕过。

## 迁移一致性约束

- 专项案件迁移前必须加载其 `sourceRiskCaseId` 对应主案件。
- 主案件状态需满足专项迁移可解释规则（最小集）：
  - 允许：`Classified/Liquidating/FundAbsorbing/EvaluatingADL/PlanningADL/ExecutingADL/Settling`
  - 禁止：`Closed/Failed/ManualInterventionRequired`（以及其他未纳入最小集状态）
- 主案件状态不一致时拒绝专项迁移，返回结构化错误 `TQ-APP-002`。

## 最小联动规则落地

- 专项创建不再是“仅写入一个独立对象”，而是强制依赖主案件存在与状态合法。
- 专项迁移不再只受专项状态机控制，还受主案件状态一致性约束控制。
- 这形成了最小闭环：`主案件约束 -> 专项动作 -> 联动审计可回放`。

## 最小审计联动表达

- 统一沿用 `CaseAuditRecord`，补充可选字段：
  - `relatedCaseType`
  - `relatedCaseId`
- 专项创建时生成两条最小联动审计：
  - 专项审计（`caseType=LiquidationCase/ADLCase`，`relatedCaseType=RiskCase`）
  - 主案件联动审计（`caseType=RiskCase`，`relatedCaseType=专项 case`）
- 专项迁移时审计附带主案件关联上下文（`relatedCaseType=RiskCase` + `relatedCaseId`）。

## 应用层入口与结果模型增强

- 新增显式入口：
  - `handleCreateLiquidationCaseFromRiskCase`
  - `handleCreateADLCaseFromRiskCase`
- `CoreCaseFlowResult` 成功态增强：
  - `linkage.riskCaseId`
  - `linkage.derivedCaseId`（专项创建/迁移场景）
  - `linkage.consistencyChecks[]`
  - `auditRecords[]`（支持多条联动审计，不再局限单条）

## 本步未做什么

- 未引入全量 cross-case matrix
- 未引入复杂 case graph 聚合平台
- 未引入外部审计存储与回放引擎
- 未引入策略执行编排基础设施

## 下一步自然延伸

- Step 3 已完成：`docs/phase2/03-subcase-terminal-coordination-and-riskcase-resolution-actions.md`。
- 下一步可在保持最小化原则下，补充多专项并存时的最小顺序/冲突约束，仍不进入全量策略实现与外部系统接入。
