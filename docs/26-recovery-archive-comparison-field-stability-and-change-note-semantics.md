# Recovery Archive Comparison Field Stability And Change Note Semantics (Phase 1)

## 目标

本阶段补齐 archive/comparison 维护语义：

- 字段稳定性最小分层
- controlled summary 最小写法
- archive/comparison 变更说明短模板

目标是减少归档描述风格漂移，不是实现自动摘要或归档平台。

## 字段稳定性分层

常量：

- `RECOVERY_RETROSPECTIVE_ARCHIVE_FIELD_STABILITY_POLICY`
- `RECOVERY_RETROSPECTIVE_COMPARISON_FIELD_STABILITY_POLICY`

分层：

- `stable_core_fields`: 高敏感字段，变动需重点审查
- `controlled_summary_fields`: 可写摘要字段，但受最小写法约束
- `free_text_fields`: 当前保留为空（不鼓励自由扩展）

## Controlled Summary 最小写法

常量：`RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_WRITING_GUIDANCE`

适用字段：

- `change_window_summary`
- `comparison_note`
- `notable_summary`

写法约定：

- 推荐 `1-2` 句
- 先写“是否有变化”，再写“变化是什么”
- 避免未定义新术语
- 优先复用 `RECOVERY_REVIEW_PHRASE_GUIDANCE` 与
  `RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES`
- 不写长篇叙述

## 变更说明短模板

常量：`RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_TEMPLATE`

字段：

- `touched_fields`
- `touched_stability_tier`
- `affects_existing_examples`
- `requires_docs_update`
- `requires_tests_update`
- `affects_manual_comparison_readability`
- `note`

用途：说明本次 archive/comparison 改动影响点，不是审批表。

## 与既有体系关系

对齐常量：`RECOVERY_RETROSPECTIVE_ARCHIVE_CHANGE_NOTE_ALIGNMENT`

- 字段稳定性约定是对 archive/comparison 模板的补充约束
- controlled summary 写法与 phrase/drift 短语同源
- stable core 变更视为高敏感
- 不替代 `retrospective outcome` / `retrospective checklist`

## 最小样例

常量：`RECOVERY_RETROSPECTIVE_CONTROLLED_SUMMARY_EXAMPLES`

- `comparison_note_no_significant_change`
- `notable_summary_new_update_and_follow_up`
- `breaking_external_theoretical`（理论受限语义）

## 当前阶段不做什么

- 不做自动摘要系统
- 不做文本风格分析器
- 不做归档平台
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来如接入更正式归档工具，可复用：

- 字段稳定性分层作为模板演进边界
- controlled summary 写法作为输出最小约束
- change note 模板作为模板改动说明入口

并继续保持与 retrospective/checklist/drift/phrase 同源，不创建平行治理体系。

## 与 Step 31 的衔接

Step 31 已补充：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT`

用于冻结样例维护节奏与 change note 高频复用短语。  
详见：`docs/27-recovery-archive-comparison-example-maintenance-and-change-note-phrases.md`。
