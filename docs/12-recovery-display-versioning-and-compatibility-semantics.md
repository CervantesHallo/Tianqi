# Recovery Display Versioning And Compatibility Semantics (Phase 1)

## 当前 Display 版本

- `RecoveryDisplayView.viewVersion = "1.0.0"`

该版本仅用于 recovery 展示语义，不属于 domain/contracts 版本体系。

## Diagnostics Summary 版本归属

`RecoveryDiagnosticsSummary` 在当前阶段**跟随 `RecoveryDisplayView` 版本**，不单独引入 diagnostics version。

原因：

- 当前阶段目标是最小稳定展示层
- 拆分独立 diagnostics version 会引入额外协商复杂度
- 先保证 display 整体向后兼容，再考虑细分版本轴

## 向后兼容策略（冻结）

- 新增字段：允许，但必须是可选字段或具备明确默认值
- 删除字段：Phase 1 禁止
- 重命名字段：Phase 1 禁止
- 语义变化：必须提升 `viewVersion`
- 三路径 mapper（append/manual/query）不得省略公共核心字段

## 公共核心字段集合

三路径 mapper 都必须稳定提供：

- `viewVersion`
- `recoveryReference`
- `sinkKind`
- `recordStatus`
- `retryEligibility`
- `mainOutcome`
- `hasNote`
- `diagnosticsSummary`
- `timestamps`

按路径可缺省字段（允许）：

- `auditSinkStatus`
- `metricsSinkStatus`
- `timestamps.recordCreatedAt`
- `timestamps.observedAt`

## 一致性门禁

测试门禁覆盖：

- 三路径 `viewVersion` 一致
- 公共核心字段存在性
- `diagnosticsSummary` 最小 shape 一致
- `mainOutcome` 值域受限
- 兼容策略常量不被悄悄漂移

## 当前阶段不做什么

- 不做完整 API versioning 系统
- 不做前端 adapter 层
- 不引入重型 schema framework
