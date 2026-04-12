# Compensation And Snapshot Versioning (Phase 1)

## Compensation 最小状态集合

- `pending`
- `not_required`
- `resolved`
- `manual_intervention_required`

## 状态语义冻结

- publish 成功 -> `not_required`
- publish 失败 -> `pending`
- 经人工/系统确认处理完成 -> `resolved`
- 无法自动恢复 -> `manual_intervention_required`

当前阶段只冻结状态语义与允许转换，不实现自动推进 worker。

## 最小转换约束

- `pending` -> `resolved` / `manual_intervention_required`
- `manual_intervention_required` -> `resolved`
- `not_required` 与 `resolved` 不允许回退到 `pending`

## Snapshot Schema Version 策略

- `StoredCommandResultSnapshot` 必须带 `schemaVersion`
- 当前支持版本：`1.0.0`
- 缺失版本 -> `TQ-APP-007`
- 未知版本 -> `TQ-APP-008`

## 兼容边界原则

- 读取兼容由 application 查询层负责（`CommandResultQueryHandler` + 版本校验）
- 当前阶段不做复杂迁移器
- future 版本升级时，先增加读取兼容，再发布新写入版本

## 当前阶段不做什么

- 不实现真实 snapshot migration framework
- 不实现真实 retry worker / outbox
- 不实现真实 manual intervention 执行系统
