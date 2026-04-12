# Recovery Review Record Example Cadence Trigger Phrases And Local Reference Review Archive Index Semantics (Phase 1)

## 目标

Step 49 在 Step 48 基础上补两层局部收口语义：

- review-record / example-cadence 最小维护触发短语清单
- 局部引用回看记录归档索引占位

目标是让“为何回看样例”与“局部回看记录如何归档”更统一，不引入自动系统。

## Review-Record / Example-Cadence Trigger Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_ALIGNMENT`

作用：

- 统一局部 review-record/example-cadence 高频触发写法
- 服务 Step 48 review record template 与 example review cadence guidance 的样例回看说明

关系边界：

- 不替代 Step 47 maintenance checklist / filling drift phrases
- 不替代 Step 46 archive reference template
- 不替代 Step 35 lifecycle cross-template reference
- 不替代 Step 25 document reference template
- 只负责“为什么要回看局部 review/cadence 样例”的句式收敛

## Local Reference Review Archive Index Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_ALIGNMENT`

作用：

- 为 Step 48 局部回看记录提供轻量归档索引占位
- 提供可复制的局部归档索引字段骨架

关系边界：

- 不替代 Step 41 navigation archive index
- 不替代 Step 29 retrospective archive/comparison 体系
- 不替代 Step 48 review record template
- 只服务局部引用回看记录索引

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_REVIEW_RECORD_AND_EXAMPLE_CADENCE_TRIGGER_PHRASE_EXAMPLES.trigger_phrase_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES.local_reference_review_archive_entry`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_EXAMPLES.theoretical_restricted_local_reference_review_archive_entry`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做局部归档平台
- 不做短语推荐器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 50 的衔接

Step 50 在本文件基础上继续补充：

- trigger-phrases / local-archive-index 最小维护触发清单
- local archive index 填写偏差短语提醒占位

用于稳定局部回看时机与局部索引填写提醒，不改变 Step 49 的 trigger phrases/index 主边界。  
详见：`docs/46-recovery-trigger-phrases-local-archive-index-maintenance-and-filling-drift-semantics.md`。
