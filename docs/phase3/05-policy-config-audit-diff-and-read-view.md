# Phase 3 / Step 5：配置版本变更审计链路 + 激活前后 Bundle 对比 + 配置版本化可回读性落地

## 为什么 Step 5 先补配置变更审计和读侧

Step 4 建立了配置版本的激活/切换/回滚能力。但变更操作缺乏留痕，调用方无法得知"从什么版本切到了什么版本"、"每个策略类型是否变化"、"最近一次操作是什么"。

Phase 3 的文档要求配置变更必须审计、配置不得散落在代码常量中。Step 5 补齐审计链、差异对比和统一读侧视图，让配置版本化形成完整的可追溯闭环。

## 配置版本审计记录模型

`PolicyConfigVersionAuditRecord`：

| 字段 | 说明 |
|------|------|
| auditId | 唯一审计标识 |
| actionType | `activate` / `rollback` |
| fromVersion | 变更前版本（首次激活为 null） |
| toVersion | 变更后版本 |
| triggeredAt | 触发时间 |
| triggeredBy | 操作人 |
| preflightStatus | preflight 是否通过 |
| resultStatus | `activated` / `rejected` / `already_active` |
| summary | 人可读摘要 |
| bundleDiffSummary | bundle 差异摘要 |

通过 `buildActivationAuditRecord` / `buildRollbackAuditRecord` 从激活/回滚结果构建，调用方记录到 `PolicyConfigVersionAuditRegistry`。

## Bundle Diff 比较什么

`diffPolicyConfigs(from, to)` 基于 descriptor（policyType + policyName + policyVersion）比较两个 `PolicyConfigurationRoot`：

- 逐类型（ranking / fund_waterfall / candidate_selection）比较
- 产出 `rankingPolicyChanged` / `fundWaterfallPolicyChanged` / `candidateSelectionPolicyChanged` 布尔标志
- 产出 `changedDescriptors` 变更清单（含 from/to descriptor）
- 产出 `diffSummary` 人可读摘要

**不比较**：策略内部算法结果，仅比较策略选择差异。

## Read View 解决什么问题

`buildPolicyConfigVersionReadView(activationRegistry, auditRegistry)` 提供统一的读侧入口：

| 字段 | 说明 |
|------|------|
| currentActiveVersion | 当前激活版本号（无则 null） |
| currentStatus | 当前版本状态 |
| currentDescriptors | 三类策略的当前 descriptor |
| previousVersion | 上一个版本号 |
| lastAuditAction | 最近一次操作类型 |
| lastAuditSummary | 最近一次操作摘要 |
| lastChangedAt | 最近一次变更时间 |
| rollbackAvailable | 是否可回滚 |

调用方不需要自行拼装 activation registry + version record + audit registry。无 active 版本时返回所有字段为 null 的空视图。

## 本步没做什么

- 没有完整配置中心
- 没有批量历史查询平台
- 没有 UI / API / console
- 没有外部 DB / MQ / RPC
- 没有 orchestrator / 执行层
- 没有 Phase 7 发布平台

## 下一步建议

Phase 3 / Step 6 可选方向：
- Phase 3 封板收口（基线冻结 + 最终验收）
- 策略配置序列化/反序列化
- 配置版本发布守卫增强
