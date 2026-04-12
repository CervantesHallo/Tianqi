# Phase 2 / Step 16 - Hint/Alert Minimal Suppression And Dedup Placeholder

## 本步范围冻结

### 本步要做

- 定义 hint/alert 的最小抑制与去重语义
- 定义基于 `factKey + reasonCategory` 的最小 dedup 主键语义
- 定义最小 suppression 结果模型（`emitted/deduplicated/suppressed_with_notice`）
- 在 diagnostic 查询路径返回 suppression 信息（是否发出、是否去重、repeatCount 等）
- 补齐单测与 query handler 测试

### 本步不做

- 完整告警降噪平台
- 时间窗口聚合系统
- 外部通知系统
- 告警规则中心
- dashboard/UI/API
- 外部监控接入
- 治理模板继续扩张

## 最小 suppression key

新增 `DiagnosticAlertDedupKey`：

- `factKey`
- `reasonCategory`
- `severity`
- `triggerSource`

当前阶段主键策略：

- **主键语义优先**：`factKey + reasonCategory`
- `severity/triggerSource` 作为 key 模型上下文字段保留，用于解释和后续扩展
- 不扩展复杂指纹系统，不引入多维聚合键

## 最小 suppression result

新增 `DiagnosticAlertSuppressionResult`：

- `status`: `emitted | deduplicated | suppressed_with_notice`
- `suppressionKey`
- `reason`
- `firstSeenAt`
- `lastSeenAt`
- `repeatCount`

语义目标：

- 可解释（为什么 dedup/suppress）
- 可测试（重复计数和时间戳可断言）
- 可扩展（后续可替换为持久化 store）

## 最小 suppression registry 占位

新增内存级 `DiagnosticAlertSuppressionRegistry`：

- `recordOrSuppress(...)`
- `getBySuppressionKey(...)`
- 维护每个 key 的 `firstSeenAt/lastSeenAt/repeatCount`

当前阶段使用内存实现，先把去重语义立住，不引入完整历史持久化平台。

## Suppression 规则（代码化）

- 规则 A：同一 `factKey + reasonCategory` 首次出现 -> `emitted`
- 规则 B：同一 `factKey + reasonCategory` 重复出现且非 critical -> `deduplicated`
- 规则 C：同一 key 重复出现且 `severity=critical` -> `suppressed_with_notice`
- 规则 D：同一 `factKey` 但不同 `reasonCategory` -> 独立 key，不合并
- 规则 E：notice/failed 共享同一 suppression 框架；severity 影响展示状态，不改变主键优先语义

## 读路径增强

`CoordinationResultDiagnosticQueryResult` 新增：

- `alertSuppression?: DiagnosticAlertSuppressionResult`

调用方可直接获得：

- 本次 alert 是否发出（`emitted`）
- 是否去重（`deduplicated`）
- 是否抑制但保留提示（`suppressed_with_notice`）
- `suppressionKey` 与 `repeatCount`

当读路径未生成 `readAlert` 时，不返回 `alertSuppression`（避免调用方误判）。

## 与 Step 15 的关系

- `operationalHint` 判读规则保持不变
- `readAlert` 的 `severity/code/summary` 主规则保持不变
- 本步仅在输出层增加 suppression 语义
- 未修改 replay validation 的核心业务判读逻辑

## 测试覆盖

- suppression helper/registry：
  - 首次 `emitted`
  - 重复 `deduplicated`
  - critical 重复 `suppressed_with_notice`
  - 同 `factKey` 不同 `reasonCategory` 不合并
- query handler：
  - persisted/fallback 来源下 suppression 字段 shape 一致
  - 重复请求同 key 时 `repeatCount` 递增
  - 无历史对比/无 alert 时不返回 suppression
  - replay `passed` 下 info alert 的 suppression 语义稳定

## 本步没做什么

- 未做告警去重持久化历史
- 未做时间窗、阈值、节流策略平台化
- 未做通知分发、工单联动、外部告警接入
- 未做 UI/API 呈现

## 下一步自然延伸

- Phase 2 / Step 17（已落地）：最小 suppression 状态持久化占位 + 跨会话 repeatCount 连续性校验 + hint/alert 去重读写一致性继续固化。
