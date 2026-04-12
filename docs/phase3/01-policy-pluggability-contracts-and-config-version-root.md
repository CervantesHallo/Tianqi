# Phase 3 / Step 1：策略可插拔骨架启动 — 最小契约落地 + 配置版本根模型建立

## Phase 3 原始目标

Phase 3 只包括四项：
1. **RankingPolicy** — ADL 候选排序策略
2. **FundWaterfallPolicy** — 资金瀑布分配策略
3. **CandidateSelectionPolicy** — 候选筛选策略
4. **配置版本化** — 策略配置的版本化管理

## 为什么 Step 1 先立策略边界和配置版本根

Phase 3 后续所有策略实现、配置切换、编排接入，都必须建立在这套边界之上。如果先写具体算法再补边界，会导致：
- 策略实现散落，无统一契约
- 配置切换无法做到版本化和可审计
- 后续步骤无法挂载到统一骨架上

因此 Step 1 先把三类策略接口、统一身份模型、输入输出契约、注册/解析骨架、配置版本根一次性立起来。

## 三类策略接口

### RankingPolicy
- **职责**：对一组 ADL 候选账户按评分排序
- **方法**：`rank(input: RankingPolicyInput): RankingPolicyResult`
- **输入**：caseId + candidates（accountId + score）
- **输出**：rankedCandidates + explanation + decisionSummary

### FundWaterfallPolicy
- **职责**：按优先级从多个资金来源分配所需金额
- **方法**：`allocate(input: FundWaterfallPolicyInput): FundWaterfallPolicyResult`
- **输入**：caseId + requestedAmount + availableSources（sourceId + sourceType + availableAmount + priority）
- **输出**：allocations + totalAllocated + explanation + decisionSummary

### CandidateSelectionPolicy
- **职责**：按选择条件筛选 ADL 候选账户
- **方法**：`select(input: CandidateSelectionPolicyInput): CandidateSelectionPolicyResult`
- **输入**：caseId + candidates + selectionCriteria
- **输出**：selectedCandidates + excludedCount + explanation + decisionSummary

## 统一策略身份模型

```
PolicyType: "ranking" | "fund_waterfall" | "candidate_selection"

PolicyDescriptor: {
  policyType: PolicyType
  policyName: string
  policyVersion: string
}
```

所有策略实例必须携带 `descriptor`。任何策略引用必须通过 `PolicyDescriptor`，不得用裸字符串。

## 统一策略输入/输出设计

**输入**：强类型参数对象，只含决策必需信息，不混入执行层依赖，可序列化。

**输出**：所有策略结果统一具备：
- `policyName` — 策略名称
- `policyVersion` — 策略版本
- `explanation` — 决策解释（可审计、可回放）
- `decisionSummary` — 决策摘要
- 具体策略结果字段

## 最小策略注册/解析骨架

`createPolicyRegistry()` 创建内存级注册中心：
- **register(descriptor, policy)** — 注册策略实例，校验 name/version 非空 + type 一致性
- **resolve(descriptor)** — 按三元组查找策略，未注册返回结构化错误
- **listByType(policyType)** — 列出指定类型的所有已注册描述符

结构化错误覆盖：
- `policy_not_registered`（TQ-POL-002）
- `policy_type_mismatch`（TQ-POL-003）
- `policy_version_invalid`（TQ-POL-004）
- `policy_config_incomplete`（TQ-POL-005）
- `policy_config_unresolvable`（TQ-POL-006）

## 配置版本根模型

```
PolicyConfigurationRoot: {
  configVersion: string
  ranking: PolicyDescriptor
  fundWaterfall: PolicyDescriptor
  candidateSelection: PolicyDescriptor
  configSource: string
  createdAt: string
}
```

`validatePolicyConfigurationRoot(config, registry)` 校验：
1. 三类策略的 policyType 字段一致性
2. 所有 policyName / policyVersion 非空
3. configVersion 非空
4. 三类策略引用在 registry 中可解析

## 本步没做什么

- 没有真实排序算法
- 没有真实资金瀑布计算
- 没有真实候选筛选规则
- 没有 orchestrator / saga
- 没有外部配置中心接入
- 没有 UI / API / console
- 没有数据库 / 消息系统接入

## 下一步建议

Phase 3 / Step 2 可选方向：
- 实现第一个真实 RankingPolicy（如 score-descending）
- 实现第一个真实 FundWaterfallPolicy（如 priority-first-fill）
- 实现第一个真实 CandidateSelectionPolicy（如 threshold-filter）
- 补配置版本切换能力

所有后续实现必须挂载到本步建立的 PolicyDescriptor + PolicyRegistry + PolicyConfigurationRoot 骨架上。
