# Phase 2 / Step 7 - Coordination Result Persistence Boundary And Replay Validation Placeholder

## 本步范围冻结

### 本步要做

- 定义 coordination result read view 的最小持久化模型
- 定义最小 schema/version 边界
- 定义最小 persistence port
- 让自动协同与显式协同写路径都接入持久化边界
- 让读路径形成单一语义（优先 persistence，缺失时回退 registry）
- 新增最小 replay validation 占位
- 补测试

### 本步不做

- 完整 event store
- 完整 replay engine
- 完整 snapshot/migration 平台
- 外部数据库或消息系统真实接入
- 分布式一致性方案
- UI / API / console
- analytics/reporting 平台
- 治理模板继续扩张

## 最小持久化模型

新增 `StoredRiskCaseCoordinationResult`（位于 ports）：

- `schemaVersion`
- `factKey`
- `riskCaseId`
- `subcaseType`
- `subcaseId`
- `signalCategory`
- `decision`
- `resolutionAction`
- `beforeState`
- `afterState`
- `conflictDetected`
- `hasOtherActiveSubcases`
- `selectedPriority`
- `auditRecordSummary`
- `occurredAt`
- `sourceCommandPath`

该模型是最小持久化边界，不是领域对象，不直接暴露聚合。

## schema/version 边界

新增：

- `COORDINATION_RESULT_STORE_SCHEMA_VERSION = "1.0.0"`
- `validateCoordinationResultStoreSchemaVersion(...)`

当前阶段就引入 schema/version 的原因：

- 防止后续 replay/query 扩展时读写字段漂移无检测
- 让未知版本在当前阶段立即结构化失败
- 为未来最小迁移策略保留入口（但本步不实现 migration 平台）

## 最小 persistence port

新增 `CoordinationResultStorePort`，最小方法集：

- `put(record)`
- `getByFactKey(factKey)`
- `getLatestByRiskCaseAndSubcase(...)`

这个集合对当前阶段足够，因为：

- 写路径只需 upsert/幂等写入
- 一致性校验需要按 factKey 读取
- 查询入口只需按 riskCase+subcase 读取最新视图

不扩展为完整 repository/query 平台。

## 写路径收敛到持久化边界

`CoreCaseFlowCommandHandler.persistCoordinationReadView(...)` 现已统一处理：

1. 先 projector 生成统一 read view
2. 先写 registry（保留 Step 6 读语义）
3. 若配置 persistence store：
   - 先按 `factKey` 读取已存记录
   - 对已存记录做 replay compatibility 校验
   - 做跨命令一致性校验（等价映射仍允许）
   - 同 factKey 且一致时直接去重返回，不重复覆盖，避免语义漂移
   - 缺失时写入持久化边界

持久化写入失败返回结构化 dependency failure。

## 最小读路径语义

`CoordinationResultQueryHandler` 对外保持单一语义：

1. 优先读 persistence store（若配置）
2. store 命中时先做 replay compatibility 校验，再返回 persisted view
3. store 未命中时回退 registry（兼容当前阶段无外部持久化场景）
4. 两边都缺失返回结构化 not-found

该顺序保证“可持久化优先、无持久化可回退”。

## replay validation 占位

新增 `validateCoordinationResultReplayCompatibility(...)`，最小校验：

- schema/version 是否可读
- `factKey` 与当前字段组合是否一致
- stored result 与其内嵌 audit summary 关键字段是否一致
- 若有当前审计摘要输入，校验 related-case/action/occurredAt 等关键字段不冲突

本步不做：

- 批量 replay
- replay 执行引擎
- 自动 migration

## 错误语义

已覆盖并结构化返回：

- persistence write failure（dependency failure）
- persistence read miss（最终 not-found 或 fallback）
- schemaVersion missing / unknown（snapshot version missing/unsupported code）
- replay validation failed（invalid command）
- stored result 与 audit summary 冲突（invalid command）

## 本步未做什么

- 未实现完整 event sourcing/replay 平台
- 未实现外部存储接入
- 未实现分布式一致性
- 未实现 UI/API/console

## 下一步自然延伸

- Step 8 已完成：`docs/phase2/08-coordination-result-observation-and-minimal-repair-boundary.md`。
- 下一步可在保持最小化原则下补充 repair 失败后的最小人工确认/再尝试状态模型与读侧诊断聚合视图。
