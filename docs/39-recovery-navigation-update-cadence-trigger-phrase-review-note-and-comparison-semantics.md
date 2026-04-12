# Recovery Navigation Update Cadence Trigger Phrase Review Note And Comparison Semantics (Phase 1)

## 目标

Step 43 在 Step 42/41/40 基础上补两层轻量导航收口语义：

- update cadence / trigger phrases 最小回顾记录示例模板
- navigation trigger phrase 历史对比占位

目标是让导航维护写法更可回顾、可对比，不引入平台系统。

## Review Note Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_ALIGNMENT`

字段：

- `review_scope`
- `review_subject`（`update_cadence` / `trigger_phrases` / `mixed`）
- `observed_variation`
- `current_recommended_phrase_or_trigger`
- `reason_for_keep_or_adjust`
- `follow_up_needed`
- `note`

定位：轻量回顾说明模板，只服务 Step 42 的 update cadence guidance 与 trigger phrases。

## Trigger Phrase Comparison Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_ALIGNMENT`

字段：

- `previous_phrase_reference`
- `current_phrase_reference`
- `meaning_changed`
- `scope_changed`
- `restricted_boundary_changed`
- `comparison_note`

定位：历史对比占位，不是 diff 引擎。

## 与既有资产关系

- review note 不替代 Step 40 navigation review record template
- 不替代 Step 41 navigation archive index template
- 不替代 retrospective outcome / archive/comparison
- comparison template 不替代 Step 29 retrospective comparison template
- 不替代 phrase guidance / drift signals
- 只回答“trigger phrase 本次相较上次是否有值得记录的变化”

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_CADENCE_TRIGGER_REVIEW_NOTE_EXAMPLES.update_cadence_review`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES.trigger_phrase_comparison`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLES.theoretical_restricted_comparison`

## 当前阶段不做什么

- 不做历史对比平台
- 不做自动短语 diff
- 不做治理看板
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 44 的衔接

Step 44 在本文件基础上继续补充：

- review note / phrase comparison 最小维护触发清单
- trigger phrase comparison 复用短语约定

用于稳定回看时机与对比写法，不改变 Step 43 的 review note/comparison 结构边界。  
详见：`docs/40-recovery-navigation-review-note-comparison-maintenance-and-phrases-semantics.md`。
