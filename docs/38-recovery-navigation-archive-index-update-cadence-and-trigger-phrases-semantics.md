# Recovery Navigation Archive Index Update Cadence And Trigger Phrases Semantics (Phase 1)

## 目标

Step 42 在 Step 41/40/39/38 基础上补两层轻量导航维护语义：

- navigation archive index 更新节奏建议
- navigation example maintenance trigger 复用短语清单

目标是稳定“何时回看 archive index”与“为何回看导航示例”的写法，不引入自动系统。

## Navigation Archive Index Update Cadence

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_ALIGNMENT`

建议回看触发：

- navigation review record 字段或语义变化
- navigation phrase retrospective 关注点变化
- archive index 样例无法覆盖主流导航回顾场景
- theoretical/restricted 导航条目语义变化

说明：人工建议，不是提醒系统。

关系边界：

- 不替代 Step 41 archive index template
- 不替代 Step 40 navigation review record
- 不替代 Step 27 closure review cadence
- 只回答 navigation archive index 本身何时建议回看

## Navigation Trigger Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_ALIGNMENT`

覆盖触发场景：

- classification phrases 变化
- doc index patch 索引项变化
- navigation phrase retrospective guidance 变化
- theoretical/restricted 表述变化
- 同一导航意图出现多个近义短语
- 当前样例无法覆盖主流导航场景

定位：复用短语清单，不是提醒引擎。

关系边界：

- 服务 Step 41 example maintenance guidance
- 不替代 Step 40 retrospective guidance
- 不替代 Step 39 classification phrases
- 不替代 Step 38 doc index patch

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_INDEX_UPDATE_CADENCE_EXAMPLES.archive_index_update_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES.trigger_phrase_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_EXAMPLES.theoretical_restricted_trigger_phrase_reuse`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做导航维护平台
- 不做短语推荐器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 43 的衔接

Step 43 在本文件基础上继续补充：

- update cadence / trigger phrases 最小回顾记录示例模板
- navigation trigger phrase 历史对比占位

用于让导航维护写法更可回顾、可对比，不改变 Step 42 的 cadence 与 trigger 边界。  
详见：`docs/39-recovery-navigation-update-cadence-trigger-phrase-review-note-and-comparison-semantics.md`。
