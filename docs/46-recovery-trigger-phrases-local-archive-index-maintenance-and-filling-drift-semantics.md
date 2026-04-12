# Recovery Trigger Phrases Local Archive Index Maintenance And Filling Drift Semantics (Phase 1)

## 目标

Step 50 在 Step 49 基础上补两层局部收口语义：

- trigger-phrases / local-archive-index 最小维护触发清单
- local archive index 填写偏差短语提醒占位

目标是让“何时回看局部触发与索引写法”与“局部索引填写偏差提醒”更稳定，不引入自动系统。

## Trigger-Phrases / Local-Archive-Index Maintenance Checklist

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_CHECKLIST`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_ALIGNMENT`

作用：

- 只回答 trigger phrases 与 local archive index 何时建议回看
- 与 Step 49 trigger phrases/index、Step 48 review record/cadence、Step 47 maintenance/drift 语义同源

关系边界：

- 不替代 Step 49 trigger phrases
- 不替代 Step 49 local archive index template
- 不替代 Step 48 review record / example review cadence
- 不替代 Step 47 maintenance checklist / filling drift phrases

## Local Archive Index Filling Drift Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_ALIGNMENT`

作用：

- 提醒 local archive index 高频填写偏差
- 统一局部索引填写写法，降低写法分叉

关系边界：

- 服务 Step 49 `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_REFERENCE_REVIEW_ARCHIVE_INDEX_TEMPLATE`
- 不替代 Step 41 navigation archive index
- 不替代 Step 29 retrospective archive/comparison
- 不替代 Step 26/28 全局短语与漂移响应体系
- 只负责局部归档索引填写收敛

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_TRIGGER_PHRASES_AND_LOCAL_ARCHIVE_INDEX_MAINTENANCE_EXAMPLES.review_record_semantics_changed_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES.missing_archive_id_reminder`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_LOCAL_ARCHIVE_INDEX_FILLING_DRIFT_PHRASE_EXAMPLES.theoretical_restricted_boundary_reminder`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做局部归档 lint 平台
- 不做索引治理平台
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现
