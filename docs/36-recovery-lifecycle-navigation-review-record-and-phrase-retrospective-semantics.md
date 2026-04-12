# Recovery Lifecycle Navigation Review Record And Phrase Retrospective Semantics (Phase 1)

## 目标

Step 40 在 Step 39/38 基础上补两层轻量导航收口语义：

- navigation review record 最小模板
- navigation phrase retrospective 复盘占位

目标是稳定 lifecycle 导航层的小型回顾与短语复盘，不引入平台系统。

## Navigation Review Record Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_ALIGNMENT`

最小字段：

- `review_scope`
- `review_focus`（`doc_index_maintenance` / `classification_phrases` / `mixed`）
- `signals_observed`
- `consistency_status`
- `template_or_phrase_updates_needed`
- `follow_up_needed`
- `review_note`

定位：轻量回顾记录模板，只服务 lifecycle 导航收口层的小型回顾留痕。

## Navigation Phrase Retrospective Guidance

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_ALIGNMENT`

覆盖复盘点：

- doc index patch 导航短语是否仍清晰
- classification phrases 是否仍匹配当前 record 写法
- maintenance checklist 触发描述是否仍清楚
- theoretical/restricted 导航表述是否被弱化
- 近义导航短语并存是否导致含义发散

说明：人工复盘占位，不是自动检测器。

## 与 Step 39/38/26/27 的关系

- Step 39：维护触发清单与分类短语约定
- Step 38：doc index patch 与 record classification template
- Step 26/27：review phrase guidance 与 terminology drift signals

边界：

- 本轮不替代 Step 39 maintenance checklist
- 不替代 Step 38 doc index patch
- 不替代 Step 26/27 的 phrase guidance 与 drift signals
- 只回答“导航层写法是否开始发散、是否应复盘”

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_EXAMPLES.doc_index_maintenance_review`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES.classification_phrases_review`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_RETROSPECTIVE_EXAMPLES.theoretical_restricted_phrase_review`

## 当前阶段不做什么

- 不做知识库治理平台
- 不做自动导航检查器
- 不做短语扫描器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 41 的衔接

Step 41 在本文件基础上继续补充：

- navigation review/retrospective 最小归档索引模板
- navigation phrase example maintenance 触发约定

用于提升导航回顾的索引可查找性和示例维护触发清晰度，不改变 Step 40 的回顾与复盘边界。  
详见：`docs/37-recovery-lifecycle-navigation-archive-index-and-phrase-example-maintenance-semantics.md`。
