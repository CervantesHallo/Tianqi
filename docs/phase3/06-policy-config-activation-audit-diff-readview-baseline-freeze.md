# Phase 3 / Step 6：配置版本激活审计内聚化 + Bundle Diff / Read View 接入正式链路 + 配置版本化第一轮回归基线冻结

## 为什么 Step 6 先把 audit/diff/read view 内聚进正式链路

Step 5 建立了审计记录模型、bundle diff 和 read view，但它们仍然是"外部 helper"语义——调用方需要自行在 activation/rollback 完成后手动拼装审计记录、计算 diff、组装 read view。

Step 6 通过 `orchestratePolicyConfigActivation` 和 `orchestratePolicyConfigRollback` 将这三者内聚为正式链路的一部分：

- 激活/回滚执行后自动计算 bundle diff
- 自动构建并记录审计记录
- 自动组装当前 read view
- 统一返回 `PolicyConfigActivationOutcome`（含 activationResult + auditRecord + bundleDiff + readView）

调用方不再需要手工拼装。

## 第一轮配置版本化基线冻结了什么

冻结了 5 类关键场景的预期行为：

| 场景 | 预期 |
|------|------|
| P1: 首次激活成功 | activated / no diff / rollback=false |
| P2: 版本切换成功 | activated / all 3 changed / rollback=true |
| P3: preflight 失败 | rejected / no diff / active 不变 |
| P4: 回滚成功 | activated / all 3 revert / audit=rollback |
| P5: already_active | already_active / no diff / 无副作用 |

这些场景作为 `PHASE3_CONFIG_VERSION_BASELINE_SCENARIOS` 常量冻结，后续 Step 7–10 的回归必须围绕这些基线执行。

## Load-bearing 字段

`PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS` 冻结了以下 8 个字段：

| 字段 | 说明 |
|------|------|
| activationStatus | 激活结果状态 |
| configVersion | 配置版本号 |
| previousVersion | 前一个激活版本 |
| preflightPassed | preflight 是否通过 |
| auditAction | 审计动作类型 |
| diffSummary | diff 摘要 |
| currentActiveVersion | 当前激活版本 |
| rollbackAvailable | 是否可回滚 |

## 一致性校验

`assertPolicyConfigVersionBaselineConsistency` 验证 outcome 的内部一致性：

- readView.currentActiveVersion === activationResult.currentActiveVersion
- activated 时 rollbackAvailable 与 previousActiveVersion 一致
- already_active 不应产出 bundleDiff
- rejected 不应改变 currentActiveVersion
- audit.resultStatus === activationResult.activationStatus
- readView.lastAuditAction === auditRecord.actionType
- bundleDiff 版本号与 activation 版本号一致

## 本步没做什么

- 没有外部配置中心
- 没有发布平台
- 没有 UI / API / console
- 没有 orchestrator / 执行编排
- 没有批量历史查询平台

## 下一步建议

Phase 3 / Step 7 可选方向：
- Phase 3 封板收口（差异矩阵 + 最终验收）
- 策略配置序列化/反序列化边界
- 更多策略变体 v2 实现
