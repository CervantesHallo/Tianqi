# Phase 6 / Step 1 — 观测与压测骨架启动：Trace Context + Metrics 契约 + Benchmark Harness

## Phase 6 原始目标

Phase 6 严格只有四项：
1. tracing
2. metrics
3. 关键路径性能基准
4. 故障演练

## 为什么 Step 1 先做 Tracing + Metrics + Benchmark Spine

Phase 4 的 orchestrator 和 Phase 5 的 replayer 缺统一的 trace propagation 和 metrics 契约。没有这些，后续无法做有证据的性能回归。benchmark harness 是性能基准的最小可运行骨架。

## Trace Propagation 覆盖范围

`TraceContext` 遵循 §14.1 要求（trace_id / case_id / module / action）：
- `startTraceContext`：创建根 trace
- `deriveChildTraceContext`：派生子 span（保留 parentSpanId）
- `buildTraceContextSummary`：汇总 span 链

已集成到 Phase 4 orchestration 和 Phase 5 replay 路径。

## Metrics 契约覆盖范围

`MetricRecord` 支持 counter / gauge / histogram，遵循 §14.2 要求：
- `buildCounterMetric`：请求计数等
- `buildLatencyMetric`：耗时分布
- `MetricsPort`：record + getRecorded（内存实现）

已集成到 orchestration（request/success/failure/duration）和 replay（request/success/duration/mismatch）路径。

## Benchmark Harness 覆盖范围

`runBenchmark` 支持：
- 定义场景（iterations / setup / run）
- 输出结构化结果（success/failure/avgDuration/min/max）
- 验证函数（失败不被吞掉）

两条 benchmark 场景：
- B1：Phase 4 RiskCase orchestration path
- B2：Phase 5 single-case replay path

## 本步不做

- 不做外部 APM / Prometheus / OpenTelemetry 真接入
- 不做 dashboard
- 不做故障演练编排平台
- 不做完整压测集群
- 不做 Phase 7

## 下一步建议

- Step 2：故障演练骨架 + 差异矩阵 + Phase 6 收口
