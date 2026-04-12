# Phase 7 / Step 3 — 差异矩阵 + 验收输入物（第一轮）+ Phase 7 收口模式启动

## 为什么 Step 3 进入收口模式

Step 1-2 完成了 preflight/contract freeze/rollback plan/runbook skeleton 全部业务能力。收口模式意味着不再扩能力，转向可验收、可回归、可门禁。

## 两组场景矩阵

### Preflight / Contract Freeze（P1-P5）

| # | 场景 | 预期 |
|---|------|------|
| P1 | Clean preflight passed | passed |
| P2 | Audit chain incomplete → blocked | blocked |
| P3 | Config validation blocked | blocked |
| P4 | Contract baseline broken | blocked |
| P5 | Audit/replay gating blocked | blocked |

### Rollback / Runbook Readiness（R1-R5）

| # | 场景 | 预期 |
|---|------|------|
| R1 | Valid rollback + ready runbook | valid / ready |
| R2 | Valid rollback + minimal runbook | valid / ready |
| R3 | Rollback target invalid | invalid |
| R4 | Rollback steps missing | invalid |
| R5 | Runbook escalation missing | not_ready |

合计 10 个场景。

## 核心字段

9 个 load-bearing 字段（`PHASE7_BASELINE_CORE_FIELDS`）：
- preflightStatus / contractBaselineStatus / rollbackPlanStatus / runbookStatus
- blockingIssueCount / noticeCount / summaryStatus / rollbackReady / runbookReady

## 本步不做

- 不做 acceptance gate / final close
- 不做真实发布平台
- 不做 rollback executor

## 下一步建议

- Step 4：Phase 7 Acceptance Gate + Final Acceptance + 最终封板
