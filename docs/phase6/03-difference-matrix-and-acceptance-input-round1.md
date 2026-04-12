# Phase 6 / Step 3 — 差异矩阵 + 验收输入物（第一轮）+ Phase 6 收口模式启动

## 为什么 Step 3 进入收口模式

Step 1-2 完成了 tracing/metrics/benchmark spine + fault drill runner/baseline。Phase 6 收口模式意味着不再扩能力，转向可验收、可回归、可门禁。

## 两组场景矩阵

### Observability / Benchmark（T1-T5）

| # | 场景 | 预期 |
|---|------|------|
| T1 | Trace propagation stable | pass |
| T2 | Metrics recording stable | pass |
| T3 | Orchestration benchmark normal | pass |
| T4 | Replay benchmark normal | pass |
| T5 | Observability consistency clean | pass |

### Fault Drill（F1-F5）

| # | 场景 | 预期 |
|---|------|------|
| F1 | Orchestration timeout handled | handled_as_expected |
| F2 | Orchestration partial_write degraded | degraded_but_continued |
| F3 | Replay out-of-order handled | handled_as_expected |
| F4 | Replay duplicate handled | handled_as_expected |
| F5 | Drill baseline snapshot stable | failedUnexpectedlyCount=0 |

合计 10 个场景。

## 核心字段

11 个 load-bearing 字段（`PHASE6_BASELINE_CORE_FIELDS`）：
- tracePropagationStatus / metricRecordingStatus / benchmarkStatus / drillStatus / overallStatus
- traceSpanCount / metricCount / avgDurationMs
- handledAsExpectedCount / degradedButContinuedCount / failedUnexpectedlyCount

## 本步不做

- 不做 acceptance gate / final close
- 不做外部 APM / chaos 平台
- 不做 Phase 7

## 下一步建议

- Step 4：Phase 6 Acceptance Gate + Final Acceptance + 最终封板（合并为加速收口）
