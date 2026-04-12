# Phase 5 / Step 3 — Replay 差异矩阵 + Replay 验收输入物（第一轮）+ Phase 5 收口模式启动

## 为什么 Step 3 进入收口模式

Step 1-2 完成了事件存储 + 单案件 replay + 批量 replay + comparison + baseline snapshot。但这些能力仍然是分散的。Phase 5 收口需要统一的差异矩阵和验收输入物，才能为后续 gate / final acceptance 提供结构化输入。

## 两组 Replay 场景矩阵

### 单案件 Replay 场景（S1-S5）

| # | 场景 | 预期 |
|---|------|------|
| S1 | 完整事件流 replay | succeeded / orchestration_completed |
| S2 | 缺少 Started 事件 | error（consistency check fail） |
| S3 | 无事件的 caseId | error（replay_input_invalid） |
| S4 | eventVersion 缺失 | error（consistency check fail） |
| S5 | finalState 与预期一致 | succeeded / orchestration_completed |

### 批运行 Replay 场景（B1-B5）

| # | 场景 | 预期 |
|---|------|------|
| B1 | 多案件全部 matched | matched=2, mismatch=0 |
| B2 | 一个 mismatch，其他成功 | matched=1, mismatch=1 |
| B3 | 一个 incomplete，其他成功 | matched=1, incomplete=1 |
| B4 | 一个 failed（case missing） | matched=1, failed=1 |
| B5 | 空 batch | matched=0, failed=0 |

合计 10 个场景，全部可执行测试。

## 差异矩阵比较维度

9 个 load-bearing 核心字段（`PHASE5_REPLAY_BASELINE_CORE_FIELDS`）：
- reconstructionStatus / finalState / eventCount
- comparisonStatus / hasDifference
- matchedCases / mismatchedCases / incompleteCases / failedCases

漂移分类：
- **Blocking**（6）：reconstructionStatus / finalState / comparisonStatus / hasDifference / failedCases / incompleteCases
- **Notice**（3）：eventCount / matchedCases / mismatchedCases

## Acceptance Input Snapshot

`Phase5ReplayAcceptanceInputSnapshot` 是 Step 4-6 的直接门禁输入。

## 本步不做

- 不做真实 event store 接入
- 不做 acceptance gate / final runner
- 不做 Phase 6 / 7

## 下一步建议

- Step 4：Phase 5 Acceptance Gate + Final Acceptance + 最终封板
