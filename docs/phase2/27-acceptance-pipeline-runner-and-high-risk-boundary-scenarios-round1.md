# Phase 2 / Step 27: 差异矩阵 → Acceptance Input → Acceptance Gate 端到端流水线打通 + 剩余高风险边界场景补齐（第一轮）

## 本步做了什么

### 1. 端到端 Pipeline 结果模型 (Phase2AcceptancePipelineResult)

将三层能力统一封装为一个结构化结果：
- pipelineRunId
- differenceMatrix（Step 25 产物）
- acceptanceInput（Step 25 产物）
- acceptanceGate（Step 26 产物）
- pipelineStatus: ready / ready_with_notices / not_ready
- pipelineSummary（人类可读结论）
- blockingIssues / nonBlockingNotices
- recommendedNextActions（结构化行动建议）

### 2. 端到端 Pipeline Runner (runPhase2AcceptancePipeline)

一次调用完成三步串联：
1. 运行 `runPhase2AggregateDifferenceMatrix` → 差异全景矩阵
2. 运行 `buildPhase2AcceptanceInputSnapshot` → 验收输入物
3. 运行 `runPhase2AcceptanceGate` → 门禁判定

输出统一 `Phase2AcceptancePipelineResult`。

### 3. pipelineStatus 映射规则

| gateStatus | pipelineStatus | 含义 |
|-----------|---------------|------|
| pass | ready | 可封板 |
| pass_with_notice | ready_with_notices | 有 notice 需确认后可封板 |
| fail | not_ready | 有阻断项须修复 |

### 4. Pipeline Consistency 校验 (validatePhase2AcceptancePipelineConsistency)

校验三层之间的结构一致性：
- matrix.overallStatus 与 gate.gateStatus 不冲突
- acceptanceInput.blockingIssues 与 gate.failedChecks 一致
- pipelineStatus 与 gateStatus 映射正确
- pipeline blocking/notices 计数与 gate 一致

### 5. 高风险边界场景（4 类全部落地）

| 边界 | 场景 | 预期 pipeline 行为 |
|------|------|-------------------|
| G1 | Missing read view | riskLevel/manualActionHint/requiresAttention drift → not_ready |
| G2 | Persistence failure but readable fallback | aggregateSummary non-blocking drift → ready_with_notices |
| G3 | History incompatible version | isCrossSessionConsistent/explanationStatus drift → not_ready |
| G4 | Repair lifecycle continuity invalid | requiresRepairAction/requiresManualReview/requiresAttention drift → not_ready |

## 本步没做什么

- UI / API / dashboard
- 自动发布/自动审批
- 外部 CI/CD 接入
- 新平台 / 批量并发执行平台
- 治理模板扩展

## Pipeline Runner 如何串联 Step 25/26

```
scenarioInputProvider + failureCombinationInputProvider + aggregateViewProvider
  │
  ▼
runPhase2AggregateDifferenceMatrix (Step 25)
  │
  ▼
buildPhase2AcceptanceInputSnapshot (Step 25)
  │
  ▼
runPhase2AcceptanceGate (Step 26)
  │
  ▼
Phase2AcceptancePipelineResult (Step 27)
```

## 下一步如何继续朝 Step 30 封板推进

- Step 28-29: 剩余边界补齐 + 最终 gate 收紧 + 总验收 runner 固化
- Step 30: 总验收与封板确认 — 一次 pipeline 运行 → 全面覆盖 → 最终封板
