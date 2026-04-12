# Recovery Example Cadence Archive Phrases And Archive Reference Semantics (Phase 1)

## 目标

Step 46 在 Step 45 的示例回看/归档基础上补两层局部收敛：

- example cadence/archive 维护短语清单
- comparison example archive 归档引用短模板

目标是让局部写法更统一、引用更可复用，不引入平台或自动系统。

## Example Cadence Archive Phrases

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_ALIGNMENT`

作用：

- 固定 example cadence/archive 高频表达，减少同语义多写法
- 服务 Step 45 的 cadence guidance 与 archive template 填写一致性

关系边界：

- 不替代 Step 44 maintenance checklist
- 不替代 Step 32 example lifecycle/historical note
- 不替代 Step 43 phrase comparison template
- 只负责 cadence/archive 相关句式统一，不新增判定逻辑

## Comparison Example Archive Reference Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_ALIGNMENT`

最小字段：

- `example_reference`
- `related_phrase_reference`
- `related_lifecycle_status_reference`
- `related_replacement_reference`
- `omitted_reference_reason`
- `restricted_boundary_reference`

关系边界：

- 不替代 Step 25 `RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`
- 不替代 Step 35 `RECOVERY_RETROSPECTIVE_EXAMPLE_CROSS_TEMPLATE_REFERENCE_TEMPLATE`
- 只服务 comparison example archive 的局部引用收敛
- document reference 管全局来源引用，archive reference 仅管 archive 局部引用

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_EXAMPLE_CADENCE_AND_ARCHIVE_PHRASE_EXAMPLES.cadence_phrase_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES.comparison_archive_reference_entry`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_NAVIGATION_COMPARISON_EXAMPLE_ARCHIVE_REFERENCE_EXAMPLES.theoretical_restricted_reference_entry`

## 当前阶段不做什么

- 不做引用关系平台
- 不做自动短语推荐器
- 不做知识图谱/数据库
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 47 的衔接

Step 47 在本文件基础上继续补充：

- cadence/archive phrases 最小维护触发清单
- archive reference 填写偏差短语提醒占位

用于稳定“何时回看 phrases”与“局部引用偏差提醒写法”，不改变 Step 46 的 phrases/reference 主边界。  
详见：`docs/43-recovery-example-cadence-archive-phrase-maintenance-and-archive-reference-filling-drift-semantics.md`。
