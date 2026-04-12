# Phase 5 / Step 1 — 审计与回放骨架启动：最小事件存储边界 + 单案件回放输入 + 案件重建骨架

## Phase 5 原始目标

Phase 5 严格只有四项：
1. 事件存储
2. 回放器
3. 案件重建
4. 一致性校验

## 为什么 Step 1 先做 Event Store / Replay Input / Reconstruction Skeleton

Phase 4 已有编排审计事件，但事件发布后即丢失（"瞬时事件"语义）。Phase 5 的首要任务是把事件从"发布即消失"推进到"可存储、可回放输入"的正式边界。有了存储边界，才能做单案件 replay 和 reconstruction。

## 当前最小 Replay 主路径

```
ReplayCaseCommand
  → store.listByCaseId(caseId)
  → validateReplayConsistency(input)
  → reconstructCaseFromReplayInput(input)
  → CaseReplayResult
```

## 事件存储模型

`StoredAuditEvent` 遵循总文档 §10.2 事件字段规范 + 存储增强：
- eventId / eventType / eventVersion / traceId / caseId / occurredAt / producer / payload / metadata
- storedAt / sequenceNumber（存储层增强）

`AuditEventStorePort`：append / listByCaseId / getByEventId

## 案件重建骨架

`reconstructCaseFromReplayInput` 按事件流顺序重建最小 case snapshot：
- 从事件类型推导状态（Started → step_completed → orchestration_completed/failed）
- 从第一个事件推导 caseType
- 缺少 Started 事件 → incomplete
- caseId 冲突 → failed
- eventVersion 缺失 → failed

## 一致性校验骨架

`validateReplayConsistency` 检查 4 条不变量：
1. 事件流中所有 caseId 与 input.caseId 一致
2. 所有事件有 eventVersion
3. sequenceNumber 单调递增
4. 存在 Started 事件

## Phase 4 集成

Phase 4 的 `buildOrchestrationAuditEvent` 产出的事件可直接 append 到 `AuditEventStorePort`，形成可回放事件流。已通过端到端测试验证。

## 本步不做

- 不做真实 DB / Kafka / Object Storage 接入
- 不做批量 replay 平台
- 不做完整时间线 UI
- 不做 Phase 6 / 7

## 下一步建议

- Step 2：多案件 replay + 重建一致性比对 + 差异矩阵
- Step 3：Phase 5 收口
