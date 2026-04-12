# Recovery Lifecycle Completion Checklist And Cross-template Reference Semantics (Phase 1)

## 目标

Step 35 增加两层轻量收口语义：

- lifecycle change note / regression template 最小填写检查清单
- lifecycle 模板族跨模板引用对齐短模板

目标是减少填写遗漏与跨模板漏对齐，不是实现治理平台。

## Lifecycle Completion Checklist

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_ALIGNMENT`

最小检查项覆盖：

- `from_status` / `to_status` 是否明确
- `reason` 是否提供
- `recommended_replacement` 或 none 是否明确
- `still_useful_for` / `notes` 最小语义是否提供
- 是否与 `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS` 对齐
- 是否检查 historical note 引用
- 是否检查 maintenance guidance 引用
- 是否检查 regression 样例补充需求
- 是否显式标注 theoretical / restricted 边界

定位：人工填写清单，仅用于减少遗漏。

## Cross-template Reference 短模板

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_ALIGNMENT`

最小字段：

- `transition_key`
- `lifecycle_change_note_reference`
- `historical_note_reference`
- `maintenance_guidance_reference`
- `regression_template_reference`
- `omitted_references_reason`
- `theoretical_or_restricted_boundary`

定位：只解决 lifecycle 局部模板族的引用对齐。

## 与 Step 33/34 及既有模板关系

- Step 33 冻结状态变化语义边界
- Step 34 冻结短语清单与回归断言骨架
- Step 35 冻结填写检查与跨模板引用收口

这些模板不替代：

- `RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS`

`cross-template reference` 也不替代 `RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`。  
后者继续负责更大范围规则来源追踪；本模板仅处理 lifecycle 模板族局部对齐。

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST_EXAMPLES.active_to_historical_reference`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES.historical_reference_to_retired`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_EXAMPLES.retired_to_active_theoretical`

## 当前阶段不做什么

- 不做自动填写校验器
- 不做模板关系图平台
- 不做生命周期治理系统
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 36 的衔接

Step 36 在本文件基础上继续补充：

- checklist / cross-template reference 何时回看（局部 cadence）
- 常见填写偏差提醒短语（filling drift phrases）

用于稳固 lifecycle 收口层，不改变 Step 33/34/35 的语义边界。  
详见：`docs/32-recovery-lifecycle-checklist-cross-reference-review-cadence-and-filling-drift-semantics.md`。
