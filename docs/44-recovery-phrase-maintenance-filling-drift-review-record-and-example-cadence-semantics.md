# Recovery Phrase Maintenance Filling Drift Review Record And Example Cadence Semantics (Phase 1)

## 目标

Step 48 在 Step 47 基础上补两层局部收口语义：

- phrase-maintenance / filling-drift 最小回看记录模板
- 局部引用偏差样例回看节奏建议

目标是让局部回看留痕与样例回看时机可复制，不引入自动系统。

## Phrase-Maintenance / Filling-Drift Review Record Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_ALIGNMENT`

作用：

- 记录 phrase-maintenance / filling-drift 局部回看结果
- 服务 Step 47 maintenance checklist 与 filling drift phrases 的轻量留痕

关系边界：

- 不替代 Step 40 navigation review record
- 不替代 Step 43 cadence/trigger review note
- 不替代 Step 46 phrases / archive reference template
- 仅服务 lifecycle 局部回看留痕

## Local Reference Drift Example Review Cadence Guidance

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_ALIGNMENT`

作用：

- 只回答“局部引用偏差样例何时建议回看”
- 与 Step 47 filling drift phrases 同源，支撑局部示例写法收敛

关系边界：

- 不替代 Step 47 filling drift phrases
- 不替代 Step 46 archive reference template
- 不替代 Step 35 lifecycle cross-template reference
- 不替代 Step 25 document reference template
- 仅人工节奏建议，不是自动提醒系统

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_PHRASE_MAINTENANCE_AND_FILLING_DRIFT_REVIEW_RECORD_EXAMPLES.filling_drift_review_record`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES.drift_phrase_changed_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_EXAMPLE_REVIEW_CADENCE_EXAMPLES.theoretical_restricted_trigger`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做引用偏差 lint 平台
- 不做样例巡检平台
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 49 的衔接

Step 49 在本文件基础上继续补充：

- review-record / example-cadence 最小维护触发短语清单
- 局部引用回看记录归档索引占位

用于稳定局部触发写法与局部归档索引写法，不改变 Step 48 的 review-record/example-cadence 主边界。  
详见：`docs/45-recovery-review-record-example-cadence-trigger-phrases-and-local-reference-review-archive-index-semantics.md`。
