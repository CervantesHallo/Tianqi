# Recovery Lifecycle Doc Index Maintenance And Record Classification Phrases Semantics (Phase 1)

## 目标

Step 39 在 Step 38 基础上补两层轻量收口语义：

- doc index patch 最小维护触发清单
- record classification 复用短语约定

目标是让 lifecycle 导航与归档分类写法更稳定，不引入平台系统。

## Doc Index Patch Maintenance Checklist

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_CHECKLIST`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_ALIGNMENT`

建议维护触发：

- 新增 lifecycle 收口层模板/常量
- lifecycle 文档重命名/拆分/合并
- lifecycle 模板族关系变化
- theoretical/restricted 样例位置变化
- 某索引项变为历史/受限推荐

关系边界：

- Step 38 doc index patch 回答“当前索引包含什么”
- maintenance checklist 回答“什么时候应检查索引是否更新”
- 不替代 `RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`

## Record Classification Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_ALIGNMENT`

覆盖分类：

- `cadence_only`
- `drift_only`
- `mixed`
- `theoretical_restricted`

每类提供：

- 推荐分类说明
- 推荐 `trigger_reason` 写法
- `impact_on_templates` 常见说明
- `follow_up_needed` 常见说明

关系边界：

- 服务于 Step 38 classification template
- 不替代 Step 37 record template
- 不替代 Step 36 drift phrases
- 不替代 `RECOVERY_REVIEW_PHRASE_GUIDANCE`

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_MAINTENANCE_EXAMPLES.doc_rename_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES.mixed_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_RECORD_CLASSIFICATION_PHRASE_EXAMPLES.theoretical_restricted_reuse`

## 当前阶段不做什么

- 不做知识库平台
- 不做自动索引维护
- 不做分类自动推荐器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 40 的衔接

Step 40 在本文件基础上继续补充：

- navigation review record 最小模板
- lifecycle navigation phrase retrospective 复盘占位

用于压实导航层回顾写法与复盘触发，不改变 Step 39 的维护触发与分类短语边界。  
详见：`docs/36-recovery-lifecycle-navigation-review-record-and-phrase-retrospective-semantics.md`。
