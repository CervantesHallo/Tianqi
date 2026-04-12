# Phase 3 / Step 2：策略配置快照解析 + PolicyBundle 组装 + 最小预校验 / Dry-Run 骨架落地

## 为什么 Step 2 先做 bundle 解析与配置预校验

Step 1 建立了三类策略接口、描述符、注册中心和配置版本根。但这些零件尚未连成链路：一个配置版本根无法直接"变成"一套可执行的策略组合。

Step 2 的目标是把"配置 → 解析 → bundle → 预校验 → dry-run"这条链路首次闭环，让 Phase 3 从契约骨架进入第一次真正可运行的状态。

## PolicyBundle 是什么

`PolicyBundle` 是三类策略实例的统一组合入口：

| 字段 | 说明 |
|------|------|
| configVersion | 来源配置版本号 |
| rankingPolicyDescriptor | 排序策略描述符 |
| fundWaterfallPolicyDescriptor | 瀑布策略描述符 |
| candidateSelectionPolicyDescriptor | 筛选策略描述符 |
| rankingPolicy | 排序策略实例 |
| fundWaterfallPolicy | 瀑布策略实例 |
| candidateSelectionPolicy | 筛选策略实例 |

后续所有应用层调用必须通过 bundle 获取策略实例，不允许分别散落 resolve。

## 配置快照如何解析成 bundle

`resolvePolicyBundle(config, registry)` 执行顺序：
1. 调用 `validatePolicyConfigurationRoot` 校验配置结构完整性
2. 逐一从 registry 解析三类策略
3. 组装成 `PolicyBundle` 返回
4. 任何步骤失败都返回 `PolicyBundleResolutionFailure`（含结构化错误列表和摘要）

## Prevalidation 校验什么

`prevalidatePolicyConfiguration(config, registry)` 返回结构化结果：

| 字段 | 说明 |
|------|------|
| configVersion | 配置版本号 |
| isValid | 是否通过 |
| resolvedPolicyTypes | 成功解析的策略类型列表 |
| resolvedPolicyKeys | 成功解析的策略 key 列表 |
| errors | 结构化错误列表 |
| warnings | 警告列表（如引用 stub 版本） |
| summary | 人可读摘要 |

校验范围：
- 三类策略是否齐全
- descriptor 格式是否正确（name/version 非空）
- policyType 是否匹配配置槽位
- configVersion 是否存在
- 引用策略是否在 registry 中已注册
- 是否引用了 stub 版本（产生 warning）

## Dry-run 当前验证什么

`dryRunPolicyBundle(bundle)` 使用最小 stub 输入调用三类策略：
- 验证 bundle 中三类策略实例均可调用（不抛异常）
- 验证输出契约：policyName / policyVersion / explanation 均非空
- 捕获运行时异常并转为结构化错误

**不验证**：真实策略质量、业务正确性、外部系统可用性。

## Stub policy 为什么此时必须存在

没有真实策略实现的情况下，dry-run 和测试无法闭环。三个 stub 提供确定性输出：

| Stub | 行为 |
|------|------|
| defaultRankingPolicyStub | 按 score 降序排序 |
| defaultFundWaterfallPolicyStub | 按 priority 升序逐源分配 |
| defaultCandidateSelectionPolicyStub | 过滤 score > 0 的候选 |

所有 stub 输出稳定、带 explanation、符合统一契约，后续可被真实实现替换。

## 本步没做什么

- 没有真实排序 / 瀑布 / 筛选算法
- 没有 orchestrator / saga / 执行层
- 没有外部配置中心接入
- 没有 UI / API / console
- 没有 DB / MQ / RPC

## 下一步建议

Phase 3 / Step 3 可选方向：
- 实现第一个真实策略替换 stub
- 配置版本切换能力
- 策略生命周期管理
