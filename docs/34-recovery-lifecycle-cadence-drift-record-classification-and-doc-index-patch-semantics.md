# Recovery Lifecycle Cadence/Drift Record Classification And Doc Index Patch Semantics (Phase 1)

## 目标

Step 38 在 Step 37 基础上补两层轻量能力：

- cadence/drift 归档条目最小分类短模板
- lifecycle 收口层跨文档索引补丁

目标是让归档记录更易写、收口资产更易导航，不引入平台系统。

## Cadence/Drift Record Classification Template

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_ALIGNMENT`

覆盖最小分类：

- `cadence_only`
- `drift_only`
- `mixed`
- `theoretical_restricted`

每类都给出：

- 适用场景
- 推荐 `record_type`
- 推荐 `trigger_reason` 写法
- 是否通常涉及 `impact_on_templates`
- 是否通常涉及 `follow_up_needed`

定位：分类短模板，不是判定引擎。

## 与 Step 37 Record Template 关系

- Step 37 record template 回答：记录结构长什么样
- Step 38 classification template 回答：这条记录大致属于哪类、推荐怎么写

classification template 不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CLOSURE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_FILLING_DRIFT_PHRASES`

## Lifecycle Doc Index Patch

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_ALIGNMENT`

最小索引覆盖：

- lifecycle change note
- lifecycle review cadence
- lifecycle phrases
- regression template
- lifecycle completion checklist
- cross-template reference
- cadence/drift record
- drift example review guidance
- lifecycle phrases/examples/theoretical restricted examples

定位：局部导航补丁，不是知识库平台。

## 与 Document Reference Template 边界

- `RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`：面向单次评审/改单次引用
- lifecycle doc index patch：面向 lifecycle 收口层整体导航

二者用途不同，doc index patch 不替代 document reference template。

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES.drift_only`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_DOC_INDEX_PATCH_EXAMPLES.minimal_reference`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CADENCE_DRIFT_RECORD_CLASSIFICATION_EXAMPLES.theoretical_restricted`

## 当前阶段不做什么

- 不做知识库平台
- 不做自动索引器
- 不做归档分类引擎
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 39 的衔接

Step 39 在本文件基础上继续补充：

- doc index patch 最小维护触发清单
- record classification 复用短语约定

用于稳定索引维护时机和分类写法，不改变 Step 38 的分类与导航边界。  
详见：`docs/35-recovery-lifecycle-doc-index-maintenance-and-record-classification-phrases-semantics.md`。
