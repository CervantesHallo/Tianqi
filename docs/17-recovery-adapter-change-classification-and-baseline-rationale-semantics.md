# Recovery Adapter Change Classification And Baseline Rationale Semantics (Phase 1)

## 三类改动定义

### `internal_only`

- 不影响 external DTO
- 不触及共享核心字段
- baseline 通常不要求更新
- viewVersion 通常不要求 bump

### `non_breaking_external`

- 影响 external DTO，但仍符合兼容规则
- 典型场景：新增可选字段或有默认值字段
- 需要明确核对 baseline/rehearsal/docs 是否更新
- 是否 bump viewVersion 需要给出说明

### `breaking_external`

- 删除字段 / 重命名字段
- 改变共享核心字段语义
- 破坏核心值域兼容
- Phase 1 视为高风险受限改动（`restricted_high_risk`），通常要求 viewVersion bump，且默认不建议进入当前阶段

## Baseline 更新原因模板

模板：`RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE`

用于标准化回答：

- 改动分类是什么
- baseline 更新原因是什么
- 是否触及共享核心字段 / external DTO
- 是否更新 adapter tests / rehearsal / docs
- 是否需要 viewVersion bump

## 与现有规则的对齐关系

- 分类策略：`RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY`
- warning 模板：`RECOVERY_SHARED_CORE_FIELD_CHANGE_WARNING_TEMPLATE`
- impact checklist：`createRecoveryDisplayChangeImpactChecklistTemplate()`
- PR checklist 模板：`docs/15-recovery-display-pr-checklist-template.md`
- 对齐映射：`RECOVERY_WARNING_TO_IMPACT_CHECKLIST_ALIGNMENT` + `RECOVERY_CLASSIFICATION_ALIGNMENT`

这些是同一套门禁规则的不同视图，不应出现彼此矛盾。

## PR 使用示例（最小）

### internal_only 示例

- 仅重排 adapter 内部变量，不改 DTO 字段
- baseline：不更新
- viewVersion：不变

### non_breaking_external 示例

- external DTO 新增可选字段（保持共享核心字段不变）
- baseline：按需要更新
- rehearsal/docs：需要同步核对

### breaking_external 示例（理论示例 / Phase 1 受限）

- 重命名 `mainOutcome` 或删除 `sinkStatus`
- baseline：必须更新
- viewVersion：必须 bump
- Phase 1：默认不接受

## 当前阶段不做什么

- 不做 PR 自动打标系统
- 不做 release governance 平台
- 不做 semver 自动管理工具
- 不做重型流程框架

## 与 Step 22 的衔接

- 本文定义“分类与模板语义”。
- Step 22 在 `docs/18-recovery-adapter-review-hints-and-baseline-rationale-examples.md` 补充了：
  - classification -> review hints（人可执行动作）
  - baseline 更新原因三类实例
  - PR 极简填写建议与“hints 不替代门禁”的边界说明
