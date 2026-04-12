# Phase 5 / Step 2 — 多案件 Replay 批运行骨架 + 重建一致性比对 + Replay 基线快照输出

## 为什么 Step 2 先做 Batch Replay / Comparison / Baseline Snapshot

Step 1 只支持单案件 replay。Phase 5 的收口需要"多案件批量回放 → 比对 → 基线快照"作为验收输入物。batch replay 是 replay 从单个到规模化的最小推进，comparison 是一致性校验从"事件流合法性"到"结果正确性"的推进。

## 当前 Batch Replay 覆盖范围

`runBatchCaseReplay` 接受多个 caseId + 可选预期终态，逐个调用 Step 1 的 `runCaseReplay`，失败 case 不阻断其他 case，收敛为 `BatchCaseReplayResult`。

## Comparison 比较粒度

当前只比较 `finalState`（预期终态 vs 重建终态）：
- `matched`：一致
- `mismatched`：不一致
- `incomplete`：重建不完整
- `failed`：replay 本身失败

## Baseline Snapshot 用途

`ReplayBaselineSnapshot` 是后续 Step 3-5 的验收输入前身：
- overallStatus = passed / passed_with_notice / failed
- 聚合 matched / mismatched / incomplete / failed 计数
- 可直接驱动 acceptance gate 判定

## 本步不做

- 不做真实 DB / Kafka / Object Storage 接入
- 不做大规模批量 replay 平台
- 不做 UI / API / dashboard
- 不做自动修复
- 不做 Phase 6 / 7

## 下一步建议

- Step 3：Phase 5 差异矩阵 + Acceptance Gate + 最终封板
