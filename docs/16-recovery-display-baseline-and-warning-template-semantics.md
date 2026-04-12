# Recovery Display Baseline And Warning Template Semantics (Phase 1)

## Baseline 的目的

`RecoveryDisplayView -> RecoveryExternalDto` 需要稳定回归基线，避免多人并行改 adapter 时出现无感漂移。

当前 baseline 覆盖：

- append 路径 external DTO
- manual resolve 路径 external DTO
- query 路径 external DTO

## Warning Template 的目的

`RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE` 用于提醒开发与评审：

- 是否触及共享核心字段
- 是否影响 compatibility policy
- 是否更新 adapter/baseline 测试
- 是否更新 version rehearsal
- 是否更新 docs/impact checklist
- 是否需要 bump viewVersion

它是变更提示模板，不是运行时逻辑。

## Warning 与 Impact Checklist 对齐

对齐基线：

- warning 模板由 `RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT` 映射到
  `createRecoveryDisplayChangeImpactChecklistTemplate()` 的检查项。
- 两套表达允许语气不同，但约束来源必须一致，禁止出现冲突规则。

## Baseline 何时必须更新

- 仅新增可选字段且 DTO 不暴露时：通常不要求更新 external DTO baseline
- 共享核心字段值域变化：必须更新 baseline 与相关测试
- 字段删除/重命名：Phase 1 禁止（视为门禁失败）
- `viewVersion` 变化：必须同步更新 baseline 与 rehearsal 测试

## 当前阶段不做什么

- 不引入重型 snapshot 治理框架
- 不实现 PR bot / CI 自动审查平台
- 不做组织级流程引擎
