# Recovery Example Cadence Archive Phrase Maintenance And Archive Reference Filling Drift Semantics (Phase 1)

## 目标

Step 47 在 Step 46 的 phrase/reference 资产基础上补两层局部收敛：

- cadence/archive phrases 最小维护触发清单
- archive reference 填写偏差短语提醒占位

目标是让“何时回看短语”和“如何提示局部引用填写偏差”更稳定，不引入自动系统。

## Phrase Maintenance Checklist

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_CHECKLIST`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_ALIGNMENT`

作用：

- 只回答 cadence/archive phrases 何时建议回看
- 保持与 Step 46 phrases、Step 45 cadence/archive、Step 32 lifecycle/historical note、Step 43 comparison 语义同源

关系边界：

- 不替代 Step 46 phrases 本体
- 不替代 Step 45 cadence guidance / archive template
- 不替代 Step 32 lifecycle/historical note
- 仅人工维护触发清单，不是提醒系统

## Archive Reference Filling Drift Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_ALIGNMENT`

作用：

- 提示 comparison example archive 局部引用填写偏差
- 统一高频提醒句式，减少局部写法分叉

关系边界：

- 服务 Step 46 `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE`
- 不替代 Step 35 lifecycle cross-template reference
- 不替代 Step 25 document reference template
- 不替代 Step 26/28 全局短语与漂移响应体系
- 只负责 comparison example archive 局部引用填写收敛

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_MAINTENANCE_EXAMPLES.cadence_guidance_changed_trigger`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES.missing_phrase_reference_reminder`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_ARCHIVE_REFERENCE_FILLING_DRIFT_PHRASE_EXAMPLES.theoretical_restricted_boundary_reminder`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做引用 lint 平台
- 不做短语推荐器
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 48 的衔接

Step 48 在本文件基础上继续补充：

- phrase-maintenance / filling-drift 最小回看记录模板
- 局部引用偏差样例回看节奏建议

用于稳定局部回看留痕写法与样例回看时机，不改变 Step 47 的 maintenance/drift 主边界。  
详见：`docs/44-recovery-phrase-maintenance-filling-drift-review-record-and-example-cadence-semantics.md`。
