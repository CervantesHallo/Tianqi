# Recovery Retrospective Archive Index And Comparison Semantics (Phase 1)

## 目标

本阶段补齐复盘归档语义：

- retrospective outcome 的最小归档索引模板
- 历次结论的最小对比占位模板

目标是让复盘结论可轻量归档、可轻量对比，而不是引入历史数据库或自动 diff 平台。

## Archive Index 模板

常量：`RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE`

字段：

- `retrospective_id`
- `retrospective_scope`
- `change_window_summary`
- `signals_observed_count`
- `consistency_status`
- `template_updates_needed`
- `follow_up_needed`
- `archived_at`
- `comparison_note`

用途：为每次 retrospective outcome 提供最小检索索引，便于后续人工回看定位。

## Comparison 模板

常量：`RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE`

字段：

- `previous_reference`
- `current_reference`
- `signals_changed`
- `consistency_changed`
- `template_update_need_changed`
- `follow_up_changed`
- `notable_summary`

用途：表达“本次 vs 上次”最小差异维度，不做自动比较算法。

## 最小对比语义

常量：`RECOVERY_RETROSPECTIVE_COMPARISON_SEMANTICS`

- `signals_changed`: 本次观测信号集合/数量相对上次是否变化
- `consistency_changed`: `consistency_status` 是否变化
- `template_update_need_changed`: `template_updates_needed` 是否变化
- `follow_up_changed`: `follow_up_needed` 是否变化

判定方式：`manual_reporting_only`（人工填报/人工判断）。

## 与现有体系关系

对齐常量：`RECOVERY_RETROSPECTIVE_ARCHIVE_AND_COMPARISON_ALIGNMENT`

- archive index 基于 `RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE`
- comparison 基于 retrospective outcome 的最小摘要
- 二者都不替代 retrospective checklist 或 outcome 本身
- 二者都不引入新判定逻辑，仅提供归档/回看辅助层

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES.no_significant_change`
- `RECOVERY_RETROSPECTIVE_COMPARISON_EXAMPLES.new_update_need_and_follow_up`
- `RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_EXAMPLES.*`

覆盖场景：

- 与上次无明显变化
- 新增模板更新需求与 follow-up
- `breaking_external` 理论高风险语义样例（`restricted_high_risk` 不弱化）

## 当前阶段不做什么

- 不做归档数据库
- 不做 diff/趋势分析平台
- 不做自动对比系统
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来若接入归档系统或趋势分析工具，可复用：

- archive index 作为历史条目最小索引结构
- comparison 模板作为结论变化最小维度结构

并保持与 retrospective outcome/checklist/drift/phrase/cadence 同源，不创建平行判定体系。

## 与 Step 30 的衔接

Step 30 已补充：

- `RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY`
- `RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY`
- `RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE`

用于冻结 archive/comparison 字段稳定性和变更说明短模板。  
详见：`docs/26-recovery-archive-comparison-field-stability-and-change-note-semantics.md`。
