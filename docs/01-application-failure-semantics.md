# Application Failure Semantics (Phase 1)

## 正常时序

### CreateRiskCaseCommand

1. reserve idempotency key
2. domain create
3. repository save
4. domain event -> contract event mapping
5. publisher publish
6. return application result

### TransitionRiskCaseCommand

1. reserve idempotency key
2. repository load by case id
3. domain transition
4. repository save
5. domain event -> contract event mapping
6. publisher publish
7. return application result

## Duplicate 结果复用语义

- duplicate + `resultReference` available:
  - 当前阶段返回 conflict，并附带 `idempotency.resultReference`
  - 用于 future 结果回读，不在本阶段做完整结果重放
- duplicate + no `resultReference`:
  - 返回 `TQ-APP-006`
  - 明确表示当前无法复用历史结果

## 关键失败分叉语义冻结

### A. repository save 失败

- 返回 `TQ-APP-004`
- publish 不允许执行（`processing.publish = not_attempted`）
- `processing.outcome = failed_before_persistence`

### B. save 成功但 mapper 失败

- 返回 contracts-source 错误（例如 `TQ-CON-*`）
- `processing.persistence = succeeded`
- `processing.mapping = failed`
- `processing.publish = not_attempted`
- 语义：已持久化但发布前失败，后续需补偿机制（本阶段不实现）

### C. save 成功 + mapper 成功，但 publish 失败

- 返回 `TQ-APP-005`
- `processing.persistence = succeeded`
- `processing.mapping = succeeded`
- `processing.publish = failed`
- `processing.outcome = failed_after_persistence`
- 语义：命令整体按失败返回，但显式标注“持久化已成功，发布未完成”

## 当前阶段不做什么

- 不接真实 MQ/Kafka/Redis Stream
- 不实现 outbox
- 不实现 event store / audit store
- 不实现自动补偿任务系统
