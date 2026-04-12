# Console/API DTO Fork Policy And Display Impact Checklist (Phase 1)

## 当前策略（冻结）

- 当前仍以统一 `RecoveryExternalDto` 为主
- future console/api 分叉仅允许**轻量扩展字段**，不允许重定义共享核心字段语义
- 分叉发生在 external adapter 层，不得反向污染 `RecoveryDisplayView`
- 所有 adapter 输出都必须复用 `assertRecoveryDisplayViewCompatibility(...)`

## 共享核心字段集合

即使 future console/api 发生轻量分叉，以下字段必须共享且语义一致：

- `viewVersion`
- `recoveryReference`
- `sinkKind`
- `mainOutcome`
- `recordStatus`
- `retryEligibility`
- `hasNote`
- `needsAttention`
- `sinkStatus`

## 可局部分叉字段策略

- console 可扩展：`RecoveryConsoleDtoExtension`（例如 `consoleBadge?`）
- api 可扩展：`RecoveryApiDtoExtension`（例如 `apiContractTag?`）
- 分叉字段必须是附加可选字段，不得删除或覆盖共享核心字段
- 当前阶段不引入双轨大 DTO 系统

## Display->DTO 变更影响清单模板

模板：`createRecoveryDisplayChangeImpactChecklistTemplate()`

检查项：

- `touches_shared_core_fields`
- `touches_external_dto_fields`
- `requires_view_version_bump`
- `requires_adapter_test_updates`
- `requires_version_rehearsal_update`
- `requires_docs_update`

用途：作为改动评审清单，不是运行时流程系统。

## 当前阶段不做什么

- 不实现真实 API 层
- 不实现真实前端 console DTO 套件
- 不引入 OpenAPI / GraphQL / REST 框架
- 不做大规模双轨 DTO 体系
