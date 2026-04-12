# Phase 3 / Step 3：第一组真实策略实现落地 + 从配置版本选择到 Dry-Run 的真实策略闭环

## 为什么 Step 3 必须把真实策略实现拉起来

Step 1-2 建立了完整的策略骨架：接口契约、描述符、注册中心、配置版本根、bundle 解析、预校验和 dry-run。但所有闭环验证都依赖 stub 占位——stub 只证明"链路通"，不能证明"真实策略可执行"。

Step 3 的目标是让 Phase 3 从骨架闭环推进到**真实策略闭环**：配置版本根 → 真实策略 bundle → 真实 prevalidation → 真实 dry-run，每个环节都由真实业务策略驱动。

## 三类 v1 真实策略

### ScoreDescendingRankingPolicyV1

| 属性 | 值 |
|------|------|
| descriptor | `ranking / score-descending / 1.0.0` |
| 排序规则 | score 降序，同分时按 accountId 字典序稳定排序 |
| 输出 | rankedCandidates + explanation（含 top/bottom、tie 信息） |

### PrioritySequentialFundWaterfallPolicyV1

| 属性 | 值 |
|------|------|
| descriptor | `fund_waterfall / priority-sequential / 1.0.0` |
| 分配规则 | 按 priority 升序依次消耗，前一个不足进入下一个 |
| 输出 | allocations（含 remainingAmount）+ totalAllocated + shortfallAmount |
| shortfall | 总资金不足时显式表达 shortfallAmount > 0 |

### ThresholdCandidateSelectionPolicyV1

| 属性 | 值 |
|------|------|
| descriptor | `candidate_selection / threshold-filter / 1.0.0` |
| 筛选规则 | score >= threshold（threshold 来自配置创建时参数） |
| 输出 | selectedCandidates + rejectedCandidates（含原因）+ appliedThreshold |
| 工厂模式 | `createThresholdCandidateSelectionPolicyV1(threshold)` |

## 真实策略与 stub 的关系

| 维度 | Stub | 真实 v1 |
|------|------|---------|
| 版本 | `1.0.0-stub` | `1.0.0` |
| 目的 | 验证链路可达性 | 验证真实业务逻辑 |
| 删除？ | 不删除，保留作为对照和回归基线 | 主要实现 |
| 注册 | `registerDefaultStubPolicies` | `registerDefaultRealPoliciesV1` |
| 共存 | 同一 registry 支持 stub 和 real 策略同时注册 |

## 配置版本如何选中真实策略

- `REAL_POLICY_CONFIG_V1`（configVersion=`1.0.0`）指向三类真实策略的 descriptor
- `STUB_POLICY_CONFIG`（configVersion=`0.1.0-stub`）指向三类 stub 的 descriptor
- `resolvePolicyBundle(config, registry)` 根据 config 中的 descriptor 从 registry 解析对应实例
- `prevalidatePolicyConfiguration` 对真实策略配置不产生 stub 警告

## Dry-run 现在能验证什么

Step 2 的 dry-run 仅验证"可调用 + 契约字段非空"。Step 3 后，真实策略 dry-run 返回具有业务含义的结果：

- ranking：结果顺序正确（score 降序 + tie-break）
- waterfall：allocation 金额正确、shortfallAmount 正确
- selection：selected/rejected 集合正确、appliedThreshold 可断言
- 所有 explanation 包含具体决策依据（非占位空壳）

## 类型扩展

本步对 Step 1 的结果类型做了向前兼容扩展：

- `FundAllocationEntry` 新增 `remainingAmount`
- `FundWaterfallPolicyResult` 新增 `shortfallAmount`
- `CandidateSelectionPolicyResult` 新增 `rejectedCandidates` + `appliedThreshold`
- 新增 `RejectedCandidate` 类型

所有 stub 和现有测试已同步更新。

## 本步没做什么

- 没有多版本发布系统
- 没有配置热切换
- 没有 orchestrator / 执行编排
- 没有 UI / API / console
- 没有外部配置中心
- 没有 DB / MQ / RPC
- 没有复杂策略优化器
- 没有 Phase 4 执行层内容

## 下一步建议

Phase 3 / Step 4 可选方向：
- 配置版本切换能力（从 v1 切到 v2 的 bundle 热解析）
- 策略生命周期管理（注册/注销/版本升级）
- 更多策略变体（如不同排序权重、不同瀑布策略）
