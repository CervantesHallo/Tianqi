# Phase 6 / Step 2 — 故障演练骨架：Fault Injection 场景矩阵 + Drill Runner + Baseline Snapshot

## 为什么 Step 2 先做 Fault Drill Runner 与 Baseline Snapshot

Phase 6 原始目标包含"故障演练"。Step 1 建立了 tracing/metrics/benchmark spine，但故障演练还未落地。Step 2 补齐这一能力，让系统第一次拥有结构化故障注入 + 集中 drill runner + 基线快照。

## Fault Injection 覆盖的故障类型

遵循总文档 §20 混沌/故障测试要求：
1. **timeout** — 外部依赖超时
2. **duplicate_message** — 重复消息
3. **out_of_order_message** — 乱序消息
4. **partial_write_success** — 部分写成功

## 两组 Drill 场景矩阵

### Orchestration Drill（O-F1 ~ O-F4）

| # | 场景 | 故障类型 | 预期结果 |
|---|------|----------|----------|
| O-F1 | Strategy execution ranking timeout | timeout | handled_as_expected |
| O-F2 | Duplicate orchestration request | duplicate_message | handled_as_expected (idempotency) |
| O-F3 | Partial audit publish failure | partial_write_success | degraded_but_continued |
| O-F4 | Fund waterfall timeout → compensation | timeout | handled_as_expected |

### Replay Drill（R-F1 ~ R-F4）

| # | 场景 | 故障类型 | 预期结果 |
|---|------|----------|----------|
| R-F1 | Out-of-order event sequence | out_of_order_message | handled_as_expected (consistency rejected) |
| R-F2 | Duplicate replay request | duplicate_message | handled_as_expected (idempotent) |
| R-F3 | Partial event append visibility | partial_write_success | degraded_but_continued |
| R-F4 | Malformed event stream | out_of_order_message | handled_as_expected (rejected) |

## Baseline Snapshot

`Phase6FaultDrillBaselineSnapshot`：
- overallStatus = passed / passed_with_notice / failed
- handled + degraded + failed = scenarioCount

## 本步不做

- 不做真实 chaos 平台
- 不做外部 APM / fault platform 接入
- 不做 distributed chaos
- 不做 acceptance gate / final close
- 不做 Phase 7

## 下一步建议

- Step 3：Phase 6 差异矩阵 + Acceptance Gate + Final Acceptance + 最终封板
