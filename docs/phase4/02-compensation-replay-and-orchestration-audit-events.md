# Phase 4 / Step 2 — Saga 补偿执行骨架 + 幂等结果重放 + 编排审计事件产出

## 为什么 Step 2 先补这三类能力

Step 1 建立了 orchestrator 主链路，但存在三个缺口：
1. **补偿**：策略步骤失败时只标记 `compensation_required`，无执行骨架
2. **重放**：幂等 guard 只能拒绝，无法稳定返回先前结果
3. **审计**：无结构化审计事件，不符合"强审计、可回放、可追溯"要求

三者同步落地的原因：补偿结果需要写入审计事件；重放需要有可记录的完整结果（包含补偿信息）；审计需要覆盖成功/失败/补偿三条路径。

## 补偿骨架当前状态

`executeOrchestrationCompensation` 是正式骨架：
- 遍历 `CompensationPlan` 中需要补偿的步骤
- **逆序执行**（后完成的先补偿）
- 每步生成 `CompensationStepExecutionResult`（stepName / compensationAction / compensationStatus / reason）
- 当前阶段不执行真实 side effect，但结构完整、可序列化、可挂到结果模型

## 幂等结果重放与 Step 1 的区别

| 维度 | Step 1 | Step 2 |
|------|--------|--------|
| 重复请求 | 返回 `duplicate_rejected` 错误 | 直接返回先前结果 |
| 结果存储 | 无 | `OrchestrationResultReplayRegistry` |
| 幂等状态 | accepted / duplicate_rejected | + replayed_same_result |
| 业务链路 | 重复时报错 | 重复时不执行，直接重放 |

## 编排审计事件模型

`RiskCaseOrchestrationAuditEvent` 遵循总文档 §10.2 事件字段规范：

| 字段 | 来源 |
|------|------|
| eventId | 自动生成 |
| eventType | 6 类事件枚举 |
| eventVersion | `1.0.0`（显式版本） |
| traceId | = orchestrationId |
| caseId | 来自命令 |
| orchestrationId | 来自命令 |
| occurredAt | 来自命令 |
| producer | `risk-case-orchestrator` |
| payload | 结构化内容 |
| metadata | 生成来源标记 |

6 类事件：Started / StepCompleted / Failed / CompensationPlanned / CompensationExecuted / Completed

## 本步不做

- 不做真实补偿外部调用
- 不做完整 event store / replay 平台
- 不做真实 DB / MQ / Kafka / HTTP 接入
- 不做 Phase 5 完整审计与回放系统

## 下一步建议

- Step 3：更多编排路径（liquidation case 编排）+ saga 恢复/重入
- Step 4：orchestrator 差异矩阵 + 编排验收体系
