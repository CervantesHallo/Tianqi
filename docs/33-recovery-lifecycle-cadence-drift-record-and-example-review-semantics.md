# Recovery Lifecycle Cadence/Drift Record And Example Review Semantics (Phase 1)

## 目标

Step 37 在 Step 36 基础上补两层轻量语义：

- cadence/drift 最小归档记录模板
- 偏差提醒复用样例回看约定

目标是让 lifecycle 收口层的回看与提醒有最小留痕和可复用回看点，不引入平台系统。

## Cadence/Drift Record Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_ALIGNMENT`

最小字段：

- `record_scope`
- `record_type`（`cadence_review` / `filling_drift` / `mixed`）
- `trigger_reason`
- `signals_observed`
- `impact_on_templates`
- `follow_up_needed`
- `recommended_action`
- `archived_note`

定位：轻量归档模板，只服务 lifecycle 收口层 cadence/drift 小型复盘留痕。

## Drift Example Review Guidance

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_REVIEW_ALIGNMENT`

最小触发条件：

- filling drift phrases 变化
- checklist / cross-template reference 字段变化
- theoretical / restricted 边界措辞变化
- 同一偏差提醒被多种短语表达

说明：人工回看建议，不是自动提醒系统。

## 二者关系与 Step 36 关系

- record template 回答：这次 cadence/drift 回看发生了什么
- example review guidance 回答：哪些 drift 复用样例该被回看

二者相关但不等价，且都不替代 Step 36 的：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES`

## 与既有模板边界

record template 不替代：

- `RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_COMPLETION_CHECKLIST`

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_EXAMPLES.cadence_review_record`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES.cross_template_reference_drift_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DRIFT_EXAMPLE_REVIEW_EXAMPLES.retired_to_active_theoretical_trigger`

## 当前阶段不做什么

- 不做归档平台
- 不做自动 drift 记录器
- 不做自动样例巡检
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 38 的衔接

Step 38 在本文件基础上继续补充：

- cadence/drift 归档条目最小分类短模板
- lifecycle 收口层跨文档索引补丁

用于稳定归档写法并增强局部导航，不改变 Step 37 的 record/review 语义边界。  
详见：`docs/34-recovery-lifecycle-cadence-drift-record-classification-and-doc-index-patch-semantics.md`。
