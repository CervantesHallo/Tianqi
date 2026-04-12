# Recovery Lifecycle Checklist/Cross-reference Review Cadence And Filling Drift Semantics (Phase 1)

## 目标

Step 36 继续稳固 lifecycle 收口层，仅补两类语义：

- checklist / cross-template reference 的最小复盘节奏建议
- 高填写偏差场景的提醒短语占位

目标是让人工维护更稳定，不引入自动化系统。

## Lifecycle Closure Review Cadence（局部）

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_ALIGNMENT`

触发建议（最小）：

- lifecycle 状态边界语义变化
- historical note template 语义变化
- maintenance guidance 语义变化
- regression template 语义变化
- 多次出现“语义一致但字段写法发散”的反馈
- theoretical/restricted 边界描述变化

说明：人工复盘建议，不是提醒系统。

## 与既有 Guidance 的边界

本 cadence 不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE`

它只回答：`checklist` 与 `cross-template reference` 何时应局部回看。

## Filling Drift Phrases（偏差提醒）

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_ALIGNMENT`

覆盖偏差：

- reason 太泛
- replacement 缺失且未明确 none
- still_useful_for / notes 过空
- historical_note_reference 缺失
- maintenance_guidance_reference 缺失
- theoretical / restricted 边界缺失
- omitted_references_reason 过于含糊
- 写法语义正确但未复用既有 lifecycle phrases

定位：仅用于提醒填写偏差，不做自动规则判定。

## 与既有 Phrase/Template 的边界

drift phrases 不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES`
- `RECOVERY_REVIEW_PHRASE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE`

它们只负责指出“填写偏差应如何提醒”。

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_EXAMPLES.checklist_review_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES.cross_template_reference_missing_historical_note`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_EXAMPLES.retired_to_active_theoretical_boundary_missing`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做表单 lint 平台
- 不做模板治理系统
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 37 的衔接

Step 37 在本文件基础上继续补充：

- cadence/drift 最小归档记录模板
- 偏差提醒复用样例回看约定

用于让回看与提醒具备最小留痕和样例回看触发点，不改变 Step 36 语义边界。  
详见：`docs/33-recovery-lifecycle-cadence-drift-record-and-example-review-semantics.md`。
