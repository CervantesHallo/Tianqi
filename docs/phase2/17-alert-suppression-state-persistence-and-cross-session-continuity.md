# Phase 2 / Step 17 - Suppression State Persistence And Cross-Session Continuity

## 本步范围冻结

### 本步要做

- 定义 suppression state 的最小持久化模型（含 schemaVersion）
- 定义最小 suppression store port（`put/getBySuppressionKey`）
- 让 suppression 主路径支持 persisted state 读写
- 定义并接入最小跨会话 continuity 校验
- 在 diagnostic 读路径返回 suppression persistence/continuity 语义
- 补测试

### 本步不做

- 完整告警历史平台
- 时间窗口统计系统
- 外部通知平台
- dashboard/UI/API
- 外部数据库真实接入
- 治理模板扩张

## 最小 persisted suppression state

新增 `StoredDiagnosticAlertSuppressionState`：

- `schemaVersion`
- `suppressionKey`
- `factKey`
- `reasonCategory`
- `severity`
- `triggerSource`
- `firstSeenAt`
- `lastSeenAt`
- `repeatCount`
- `lastStatus`

说明：这是单条 suppression state 的持久化占位，不是完整告警历史明细。

## 最小 suppression store port

新增 `DiagnosticAlertSuppressionStorePort`：

- `put(state)`
- `getBySuppressionKey(key)`

当前阶段该接口足够支撑：

- 跨会话加载同 key 的累计状态
- 持久化更新 repeatCount/时间戳/最后状态
- continuity 校验前置读取

无需扩展历史检索、批量查询或窗口聚合。

## suppression 写路径收敛

新增 `applyDiagnosticAlertSuppressionWithPersistence(...)`：

- 统一执行 suppression + continuity + persisted write
- 先从 store 读取既有 state（若存在）
- 可水合内存 registry（用于跨会话 repeatCount 延续）
- 生成本次 suppression 结果
- continuity 通过/notice 时尝试写回 persisted state
- continuity failed 时不写回，返回结构化 fallback 语义

内存 registry 与 persisted state 关系：

- 内存 registry：进程内快速态
- persisted state：跨会话连续性边界
- 当前阶段双轨并存，以 persisted 为 continuity 参照，不做复杂 reconcile 引擎

## 跨会话 continuity 校验

新增 `validateSuppressionStateContinuity(...)`，最小校验项：

- suppressionKey 一致性
- factKey/reasonCategory/severity/triggerSource 语义一致性
- repeatCount 不倒退
- firstSeenAt/lastSeenAt 时间合法性
- lastStatus 与 repeatCount/severity 可解释一致性
- schemaVersion 完整性与兼容性

校验结果三态：

- `passed`
- `notice`
- `failed`

## 读路径增强

`CoordinationResultDiagnosticQueryResult` 新增：

- `alertSuppressionPersistence`

返回字段包含：

- source：`in_memory_only | persisted | persisted_with_fallback`
- read/write 状态
- continuity 状态与原因
- `isRepeatCountContinuous`

调用方无需自行推断“是否跨会话连续”。

## Step 16 语义保持

- `operationalHint` 规则不变
- `readAlert` 主规则不变
- suppression 主语义（`emitted/deduplicated/suppressed_with_notice`）保持不变
- continuity 异常只影响 suppression persistence 解释字段，不改变 hint/alert 判读主语义

## 测试覆盖

- suppression persistence 成功路径（首次写入、跨会话延续）
- continuity 路径（missing/pass/fail）
- schema/格式异常路径（missing/incompatible/malformed）
- query 路径中 `alertSuppressionPersistence` 的来源与连续性表达
- Step 16 主语义回归（emitted/deduplicated/suppressed_with_notice）

## 本步没做什么

- 未做完整告警历史时间线存储
- 未做时间窗口/阈值型降噪
- 未做通知分发和外部监控接入
- 未做 UI/API

## 下一步自然延伸

- Phase 2 / Step 18（已落地）：suppression persisted state 的最小版本兼容读取策略 + 异常 state 修复占位 + hint/alert continuity 读写护栏继续固化。
