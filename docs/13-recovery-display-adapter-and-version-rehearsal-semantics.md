# Recovery Display Adapter And Version Rehearsal Semantics (Phase 1)

## 为什么需要 Adapter 边界

`RecoveryDisplayView` 是 application 内部统一展示真相。  
外部消费者（future console/API adapter）不应直接绑定内部展示结构。

本阶段新增 `RecoveryExternalDto`，用于最小稳定外部消费形态。

当前仍以统一 DTO 为主，future console/api 仅允许在共享核心字段之外做轻量可选扩展。

## Display 与 External DTO 关系

- 输入：`RecoveryDisplayView`
- 适配器：`mapRecoveryDisplayViewToExternalDto(...)`
- 输出：`RecoveryExternalDto`

关键边界：

- adapter 只做只读映射，不回写 display
- adapter 不承载执行语义
- adapter 必须先执行 `assertRecoveryDisplayViewCompatibility(...)`

## DTO 最小字段集合

- `viewVersion`
- `recoveryReference`
- `sinkKind`
- `mainOutcome`
- `recordStatus`
- `retryEligibility`
- `hasNote`
- `needsAttention`
- `sinkStatus`（audit/metrics 的最小状态）
- `summary`（`hasRecoveryRecord/latestSinkStatus/queryOutcome`）
- `observedAt`（最小时间戳）

## 不外露的内部字段（当前阶段）

- 完整 `diagnosticsSummary`
- 完整 `timestamps` 结构
- `manualInterventionRequired` 原始内部判定字段
- 其他执行态细节（auditEvents/error 等）

## 版本关系冻结

- DTO 不引入独立版本轴
- DTO `viewVersion` 跟随 `RecoveryDisplayView.viewVersion`
- display 不兼容时，adapter 必须失败（抛出 compatibility 错误），禁止静默降级

## 版本升级预演模板

测试模板目标：

- 当前 `1.0.0` display 可稳定映射到 DTO
- future 新增字段（遵循可选/默认）时，adapter 仍可运行
- future 非法删除/重命名/语义破坏时，可在同一模板中扩展为失败门禁

当前只做模板，不做真实版本升级或迁移框架。

## 当前阶段不做什么

- 不做真实 API 层
- 不做真实前端 console
- 不引入 OpenAPI/GraphQL/REST 框架
- 不做真实版本迁移系统
