# Recovery Navigation Review Note Comparison Maintenance And Phrases Semantics (Phase 1)

## 目标

Step 44 在 Step 43/42/40/26/28 基础上补两层轻量导航维护语义：

- review note / phrase comparison 最小维护触发清单
- trigger phrase comparison 复用短语约定

目标是稳定“何时回看 review note/comparison”以及“对比说明如何统一写法”。

## Maintenance Checklist

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_CHECKLIST`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_ALIGNMENT`

建议触发：

- `reason_for_keep_or_adjust` 推荐写法变化
- `comparison_note` 推荐写法变化
- Step 42 `trigger phrases` 变化
- Step 40 retrospective guidance 关注点变化
- theoretical/restricted 边界措辞变化
- 样例出现“语义一致但详略分叉”反馈

关系边界：

- Step 43 模板回答“结构是什么”
- 本清单回答“什么时候应回看这些结构与样例”
- 不替代 Step 43 review note/comparison 模板
- 不替代全局 cadence/drift/phrase guidance

## Comparison Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_ALIGNMENT`

覆盖场景：

- 语义未变
- 作用域未变
- restricted 边界未变
- 仅措辞收敛
- 导航清晰度受影响
- 需要补 comparison note
- theoretical_restricted 路径保持受限边界

关系边界：

- 服务 Step 43 comparison template
- 不替代 Step 42 trigger phrases
- 不替代 Step 26 review phrase guidance
- 不替代 Step 28 drift response phrases

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_NOTE_AND_COMPARISON_MAINTENANCE_EXAMPLES.review_note_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES.comparison_phrase_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASE_COMPARISON_PHRASE_EXAMPLES.theoretical_restricted_phrase_reuse`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做短语 diff 平台
- 不做模板治理系统
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 45 的衔接

Step 45 在本文件基础上继续补充：

- review note/comparison 维护触发样例回看节奏建议
- comparison phrase 历史示例最小归档占位

用于稳定示例回看时机与历史保留写法，不改变 Step 44 的维护触发与 comparison phrases 边界。  
详见：`docs/41-recovery-navigation-review-note-comparison-example-review-cadence-and-archive-semantics.md`。
