# Phase 7 / Step 2 — 回滚方案骨架 + Runbook 占位 + 发布门禁差异矩阵起点

## 为什么 Step 2 先做 Rollback Plan + Runbook Skeleton

Step 1 建立了"能不能发"（preflight）。Step 2 补齐"发坏了怎么办"（rollback plan）和"值班怎么做"（runbook）。三者共同组成发布门禁的完整主线。

## Rollback Plan 骨架

`RollbackPlanSkeleton` 包含结构化回滚步骤（`RollbackStep`：stepId/action/target/expectedOutcome/isBlocking）+ prerequisites + verification checks。

校验规则：
- targetConfigVersion 非空且与 rollbackTargetVersion 不同
- rollbackSteps 非空
- rollbackVerificationChecks 非空

## Runbook Skeleton

`ReleaseRunbookSkeleton` 包含 entryConditions / operationalChecks / rollbackEntryPoint / incidentEscalationRules。

校验规则：
- runbookId / rollbackEntryPoint 非空
- entryConditions / operationalChecks / incidentEscalationRules 非空

## 差异矩阵草案（7 场景 G1-G7）

| # | 场景 | preflight | rollback | runbook | 类型 |
|---|------|-----------|----------|---------|------|
| G1 | 全部通过 | passed | valid | ready | clean |
| G2 | notice path | passed | valid | ready | notice |
| G3 | rollback plan 缺失 | passed | invalid | ready | blocking |
| G4 | rollback target 无效 | passed | invalid | ready | blocking |
| G5 | runbook 缺关键字段 | passed | valid | not ready | blocking |
| G6 | 契约冻结不兼容 | blocked | valid | ready | blocking |
| G7 | 全部阻断 | blocked | invalid | not ready | blocking |

## 本步不做

- 不做真实 rollback executor
- 不做发布平台 / CI/CD
- 不做完整 runbook CMS
- 不做 acceptance gate / final close

## 下一步建议

- Step 3：Phase 7 Acceptance Gate + Final Acceptance + 最终封板
