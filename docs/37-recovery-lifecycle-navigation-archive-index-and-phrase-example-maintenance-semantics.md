# Recovery Lifecycle Navigation Archive Index And Phrase Example Maintenance Semantics (Phase 1)

## 目标

Step 41 在 Step 40/39/38 基础上补两层轻量导航收口语义：

- navigation review/retrospective 最小归档索引模板
- navigation phrase example maintenance 触发约定

目标是让导航回顾结果更易索引、导航短语示例更易维护，不引入平台系统。

## Navigation Archive Index Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_ALIGNMENT`

最小字段：

- `archive_id`
- `review_scope`
- `review_focus`
- `signals_observed_count`
- `consistency_status`
- `template_or_phrase_updates_needed`
- `follow_up_needed`
- `archived_at`
- `archive_note`

定位：轻量归档索引模板，用于 Step 40 导航回顾记录的可查找索引。

## 与 Step 40 Review/Retrospective 关系

- Step 40 review record 回答“回顾记录内容是什么”
- Step 41 archive index 回答“这条回顾记录如何被轻量索引”

archive index 不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE`
- `RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE`

## Navigation Phrase Example Maintenance Guidance

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_ALIGNMENT`

触发条件（最小）：

- navigation phrase retrospective guidance 变化
- classification phrases 变化
- doc index patch 索引项变化影响导航表述
- theoretical/restricted 表述变化
- 同一导航意图出现多个近义短语

说明：人工维护建议，不是自动提醒系统。

## 与既有 Guidance 的边界

本 guidance 不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`（Step 31）
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES`（Step 36）
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE`（Step 40）

它只回答：导航短语示例本身何时应回看。

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_EXAMPLES.navigation_archive_entry`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES.classification_phrase_change_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_EXAMPLE_MAINTENANCE_EXAMPLES.theoretical_restricted_trigger`

## 当前阶段不做什么

- 不做归档平台
- 不做自动导航样例巡检
- 不做短语索引器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 42 的衔接

Step 42 在本文件基础上继续补充：

- navigation archive index 最小更新节奏建议
- example maintenance trigger 复用短语清单

用于稳定导航归档更新时机和触发写法，不改变 Step 41 的 archive index 与示例维护边界。  
详见：`docs/38-recovery-navigation-archive-index-update-cadence-and-trigger-phrases-semantics.md`。
