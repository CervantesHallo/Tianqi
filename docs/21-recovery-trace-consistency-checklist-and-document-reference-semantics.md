# Recovery Trace Consistency Checklist And Document Reference Semantics (Phase 1)

## 目标

本文件冻结留痕体系的最终人工收口层：

- 轻量留痕一致性检查清单（人工最终总览）
- 跨文档引用收敛模板（说明本次评审依据来源）

目标是减少“模板分散、口径不一”，不是替代既有规则门禁。

## 轻量一致性检查清单

常量：`RECOVERY_TRACE_CONSISTENCY_CHECKLIST`

最小检查项：

- `classification_declared`
- `warning_template_checked`
- `impact_checklist_checked`
- `pr_checklist_completed`
- `baseline_reason_filled_or_not_required_explained`
- `review_trace_filled_or_cadence_explained`
- `baseline_history_archived_or_cadence_explained`
- `docs_synced`
- `view_version_bump_decision_recorded`
- `rehearsal_and_baseline_tests_updated_or_not_required_explained`

用途：在评审结束前做一次人工总览，确认关键留痕项未遗漏。

## 跨文档引用收敛模板

常量：`RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`

字段：

- `change_classification`
- `used_sources`
- `not_used_sources_with_reason`
- `reference_summary`

可选来源集合：

- `classification_policy`
- `warning_template`
- `impact_checklist`
- `pr_checklist`
- `baseline_rationale_template`
- `review_hints`
- `cadence_guidance`
- `baseline_history_and_review_trace_docs`

用途：明确“这次改动依据了哪些规则来源、哪些未用、为什么未用”。

## 与现有模板体系的关系

### 一致性清单的定位

一致性清单不是替代 checklist，而是最终总览层。  
对齐常量：`RECOVERY_TRACE_CONSISTENCY_ALIGNMENT`

### 跨文档引用模板的定位

跨文档引用模板不是替代 rationale/history/trace，而是依据来源说明层。  
对齐常量：`RECOVERY_TRACE_DOCUMENT_REFERENCE_ALIGNMENT`

### 明确不替代

该收口层不替代：

- `RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS`
- `RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE`
- `RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE`
- `RECOVERY_REVIEW_TRACE_TEMPLATE`
- cadence guidance（Step 24）

## 最小样例

### 样例 1：`non_breaking_external` 一致性清单

参考：`RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES.non_breaking_external`

- classification/warning/impact/PR checklist 均已覆盖
- baseline reason、review trace、baseline history 均已填写
- docs 与 tests 更新决策均已记录

### 样例 2：`internal_only` 跨文档引用模板

参考：`RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES.internal_only`

- used：classification policy / impact checklist / PR checklist / cadence guidance
- not_used：baseline rationale、history docs（并写明原因）
- summary：说明为何使用“最小引用集合”

### 理论受限样例：`breaking_external`

参考：

- `RECOVERY_TRACE_CONSISTENCY_CHECKLIST_EXAMPLES.breaking_external_theoretical`
- `RECOVERY_TRACE_DOCUMENT_REFERENCE_EXAMPLES.breaking_external_theoretical`

说明：仅用于 Phase 1 受限高风险语义演示，通常升级审查或拒绝。

## 当前阶段不做什么

- 不做知识库/文档平台
- 不做自动引用校验器
- 不做审计数据库
- 不做审批平台
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

后续若接入更正式治理系统，可直接复用：

- 一致性清单作为“人工收口检查输入”
- 文档引用模板作为“评审依据来源清单”

并保持与 classification/checklist/hints/rationale/history/trace/cadence 同源，避免新增平行规则。

## 与 Step 26 的衔接

Step 26 已补充：

- `RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE`（收口层何时必须检查更新）
- `RECOVERY_REVIEW_PHRASE_GUIDANCE`（统一短语推荐）
- `RECOVERY_REVIEW_PHRASE_EXAMPLES`（最小可复制样例）

详见：`docs/22-recovery-trace-closure-maintenance-and-review-phrase-guidance.md`。
