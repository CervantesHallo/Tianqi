# Phase 2 / Step 18 - Suppression State Read Compatibility And Minimal Repair Placeholder

## 本步范围冻结

### 本步要做

- 定义 suppression persisted state 最小版本兼容读取策略
- 定义 suppression persisted state compatibility 结果模型
- 定义单条 suppression state 最小 repair 命令与 handler 占位
- 让 continuity 读路径显式返回 compatibility/repair 相关信息
- 补测试

### 本步不做

- 完整 suppression state migration 平台
- 批量 repair 平台
- 外部数据库真实接入
- 告警平台/通知系统
- UI/API/console
- 治理模板扩张

## 最小版本兼容读取策略

新增 `DiagnosticAlertSuppressionStateReadCompatibility`，状态包括：

- `compatible_read`
- `compatible_with_notice`
- `missing_version`
- `incompatible_version`
- `malformed_state`

并补充 `state_missing` 作为 store miss 的显式语义占位。

当前策略：

- 当前默认版本：`1.0.0`
- 显式支持集合：`["1.0.0", "0.9.0"]`
- 同版本 -> `compatible_read`
- 支持旧版本 -> `compatible_with_notice`
- 缺失版本 -> `missing_version`
- 未支持版本 -> `incompatible_version`
- 结构不合法 -> `malformed_state`

## 最小 repair 命令占位

新增：

- `RepairDiagnosticAlertSuppressionStateCommand`
- `DiagnosticAlertSuppressionStateRepairCommandHandler`
- `DiagnosticAlertSuppressionStateRepairCommandResult`

命令目标：仅修补 suppression persisted state，可读/可连续，不改业务事实。

## 最小 repair 规则

### 可修复

- 缺失 `schemaVersion` -> 补齐到 `1.0.0`
- 支持旧版本（如 `0.9.0`）-> 升级到 `1.0.0`
- `repeatCount` 非法 -> 最小安全修正为 `1`
- 时间字段异常 -> 保守修正为可读时间线（`lastSeenAt >= firstSeenAt`）
- `lastStatus` 不一致 -> 依据 `repeatCount + severity` 归一化

### 不可修复

- `suppressionKey` 与 `factKey/reasonCategory` 语义冲突
- 关键语义字段缺失导致无法推断
- 版本不在最小支持集合且不允许当前策略修补

### noop

- 已是合法且兼容状态 -> `noop`

repair 输出结构化三态：

- `repaired`
- `failed`
- `noop`

## Continuity / Compatibility / Repair 协同

Step 17 的 suppression persistence 输出增强：

- `stateReadCompatibility`
- `stateCompatibilityReason`
- `stateRepairAvailable`
- `stateRepairRecommended`
- `stateRepairStatus`（当前读路径默认 `not_attempted`）
- `repairedSchemaVersion`（若发生修复可回填）

读路径可直接说明 persisted state 是否可读、是否建议修复、是否连续，不需要调用方二次推理。

## 本步没做什么

- 未做完整迁移平台与版本批量升级
- 未做批量 repair/自动 repair 编排
- 未做外部 DB、通知平台、UI/API

## 下一步自然延伸

- Phase 2 / Step 19：suppression state repair 生命周期最小状态模型 + 手动确认/重试边界 + continuity 冲突处置语义继续固化。
