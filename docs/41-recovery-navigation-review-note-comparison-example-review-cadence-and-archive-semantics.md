# Recovery Navigation Review Note Comparison Example Review Cadence And Archive Semantics (Phase 1)

## 目标

Step 45 在 Step 44/43/32/37 基础上补两层轻量导航收口语义：

- review note/comparison 示例回看节奏建议
- comparison phrase 历史示例最小归档占位

目标是让示例回看时机更清晰、历史示例保留更稳定，不引入平台系统。

## Example Review Cadence Guidance

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_ALIGNMENT`

建议回看触发：

- maintenance checklist 触发项变化
- comparison phrases 推荐写法变化
- Step 43 review note/comparison 模板语义变化
- theoretical/restricted 高风险表述变化
- 样例出现“语义一致但详略分叉”反馈

关系边界：

- 不替代 Step 44 maintenance checklist
- 不替代 Step 43 review note/comparison 模板
- 不替代 Step 37 example review guidance
- 只回答 review note/comparison 示例本身何时建议回看
- 仅人工语义建议，不是提醒系统或自动巡检器

## Comparison Phrase Historical Archive Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_ALIGNMENT`

最小字段：

- `example_id`
- `comparison_scope`
- `phrase_category`
- `historical_status`
- `replacement_example`
- `archive_reason`
- `still_useful_for`
- `archived_note`

关系边界：

- 不替代 Step 32 example lifecycle guidance
- 不替代 historical note template
- 不替代 Step 43 phrase comparison template
- 只服务 comparison phrase 示例的轻量历史保留
- 不是样例数据库或历史平台

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_EXAMPLE_REVIEW_CADENCE_EXAMPLES.maintenance_trigger_changed`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES.comparison_phrase_archive_entry`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_EXAMPLE_ARCHIVE_EXAMPLES.theoretical_restricted_archive_entry`

## 当前阶段不做什么

- 不做自动样例巡检
- 不做历史样例平台
- 不做短语示例数据库
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 46 的衔接

Step 46 在本文件基础上继续补充：

- example cadence/archive 维护短语清单
- comparison example archive 归档引用短模板

用于稳定高频写法与局部引用表达，不改变 Step 45 的 cadence/archive 主边界。  
详见：`docs/42-recovery-example-cadence-archive-phrases-and-archive-reference-semantics.md`。
