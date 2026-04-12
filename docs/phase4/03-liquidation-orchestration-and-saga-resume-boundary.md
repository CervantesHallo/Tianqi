# Phase 4 / Step 3 — 第二条核心编排路径：LiquidationCase 编排 + Saga 恢复/重入骨架 + 多路径一致性

## 为什么 Step 3 先补第二条核心编排路径

Step 1-2 只有 RiskCase 主路径。Phase 2 的 LiquidationCase 尚未进入正式应用层编排。如果始终只有一条路径，orchestrator 的通用性和 saga/replay/audit 的一致性就无法被验证。双路径是 orchestrator 家族可扩展性的最低证明。

## 为什么 Saga 恢复/重入现在必须出现

Step 1-2 的 saga 失败后只能停在结果态，缺少"从已有 saga 状态继续执行"的能力。总文档 §13.3 要求 saga 管理多步动作——仅有一次性执行不够，最小恢复骨架是 saga 从玩具到正式组件的关键。

## LiquidationCase 主路径 L1

```
ExecuteLiquidationCaseOrchestrationCommand
  → replay check
  → idempotency guard
  → load liquidation case (via liquidationCaseRepository port)
  → load active config (via policyConfig port)
  → resolve & dry-run bundle (via policyBundle port)
  → execute candidate selection (via strategyExecution port)
  → execute ranking (via strategyExecution port)
  → execute fund waterfall (via strategyExecution port)
  → finalize
  → RiskCaseOrchestrationResult (shared result model)
```

7 步 saga，与 RiskCase 路径共享同一结果模型。

## Saga 恢复/重入规则

| 当前状态 | 可恢复 | 原因 |
|----------|--------|------|
| failed | 是 | 可从失败步骤后继续 |
| compensation_required | 否 | 必须先执行补偿 |
| completed | 否 | 已完成，禁止重复 |
| started | 否 | 活跃中，不可重入 |
| in_progress | 否 | 活跃中，不可重入 |

`canResumeSaga()` 返回结构化 `SagaResumeEligibility`。`prepareSagaForResume()` 将 failed saga 重置为 in_progress。

## 多路径一致性

`assertOrchestrationPathConsistency()` 校验 6 条不变量：
1. 两条路径的结果都包含 10 个必需字段
2. completed 状态不可有未决补偿
3. compensation_required 必须有补偿计划或结果
4. replayed 必须对应 replayed_same_result
5. 审计事件 summary 在两条路径上都存在
6. 不变量总计 6 条

## 本步不做

- 不做 ADLCase 编排
- 不做真实 DB / MQ / Kafka / HTTP 接入
- 不做完整 saga 恢复平台
- 不做 worker / scheduler
- 不做 Phase 5 审计/回放平台

## 下一步建议

- Step 4：orchestrator 差异矩阵 + 编排验收体系
- Step 5：Phase 4 acceptance gate + 封板准备
