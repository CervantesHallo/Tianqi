# Phase 4 / Step 4 — 编排差异矩阵 + 编排验收输入物（第一轮）+ Phase 4 收口模式启动

## 为什么 Step 4 进入收口模式

Step 1-3 完成了双路径编排（RiskCase + LiquidationCase）、saga 补偿/恢复、幂等重放、审计事件。但这些能力仍然是分散测试，缺少统一的回归矩阵和后续门禁输入物。Phase 4 收口模式的含义是：不再扩路径，转向可验收、可总览、可回归。

## 两组场景矩阵

### RiskCase 编排场景（R1-R5）

| # | 场景 | 预期 |
|---|------|------|
| R1 | 主路径成功 | succeeded / completed / accepted |
| R2 | Replay 成功重放 | succeeded / replayed_same_result |
| R3 | 可补偿失败 | compensation_required / completed compensation |
| R4 | Active config 缺失 | error |
| R5 | Bundle 解析失败 | error |

### LiquidationCase 编排场景（L1-L5）

| # | 场景 | 预期 |
|---|------|------|
| L1 | 主路径成功 | succeeded / completed / accepted |
| L2 | Replay 成功重放 | succeeded / replayed_same_result |
| L3 | 可补偿失败 | compensation_required / completed compensation |
| L4 | Case 不可编排 | error |
| L5 | Case 不存在（saga resume 不可能）| error |

合计 10 个场景，全部可执行测试。

## 差异矩阵比较维度

9 个 load-bearing 核心字段（`PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS`）：
- resultStatus / sagaStatus / idempotencyStatus / configVersion
- pendingCompensation / auditEventSummary / resultSummary
- replayedFromPreviousResult / compensationStatus

漂移分类：
- **Blocking**（7 字段）：resultStatus / sagaStatus / idempotencyStatus / configVersion / pendingCompensation / auditEventSummary / compensationStatus
- **Notice**（2 字段）：resultSummary / replayedFromPreviousResult

## Acceptance Input Snapshot

`Phase4AcceptanceInputSnapshot` 是 Step 5-7 的直接门禁输入，包含：
- baselineCoreFields / scenario IDs / matrix overall status
- keyDriftFindings / blockingIssues / nonBlockingNotices / recommendedNextActions

## 本步不做

- 不做 ADLCase 编排路径
- 不做真实 infra 接入
- 不做 acceptance gate / final runner
- 不做 Phase 5 / 7

## 下一步建议

- Step 5：Phase 4 Acceptance Gate + 门禁清单
- Step 6：Final Acceptance Runner + Pre-Close Checklist
- Step 7：Phase 4 最终封板
