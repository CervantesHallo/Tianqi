# Recovery Baseline History And Review Trace Semantics (Phase 1)

## 目标

本文件冻结两个轻量模板：

- baseline 历史变更记录模板（用于复盘“为什么改”）
- review trace 最小字段（用于复盘“按什么规则审、审到了什么”）

它们是文档与常量层的协作语义，不是审计数据库或审批流程系统。

## Baseline History Entry 模板

常量：`RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE`

字段：

- `change_date`
- `change_summary`
- `classification`
- `affected_paths`
- `shared_core_fields_touched`
- `baseline_updated`
- `rehearsal_updated`
- `docs_updated`
- `view_version_bumped`
- `rationale`
- `review_notes`

用途：在每次 baseline 相关变更时，提供统一可复制的记录格式，支持多人协作回看。

## Review Trace 最小字段

常量：`RECOVERY_REVIEW_TRACE_TEMPLATE`

字段：

- `review_scope`
- `rule_basis`
- `compatibility_checked`
- `baseline_checked`
- `rehearsal_checked`
- `docs_checked`
- `risk_note`
- `follow_up_needed`

用途：记录“本次审阅看了哪些规则、做了哪些核对、风险结论是什么”。

## 与既有模板/规则的对齐关系

### history template <-> baseline reason template

- 一一对应映射：`RECOVERY_DTO_BASELINE_HISTORY_TO_REASON_ALIGNMENT`
  - `classification` -> `change_classification`
  - `shared_core_fields_touched` -> `touched_shared_core_fields`
  - `rehearsal_updated` -> `updated_version_rehearsal`
  - `docs_updated` -> `updated_docs`
  - `view_version_bumped` -> `requires_view_version_bump`
  - `rationale` -> `baseline_rationale`
- 归档补充字段：`RECOVERY_DTO_BASELINE_HISTORY_ARCHIVE_FIELDS`
  - `change_date`
  - `change_summary`
  - `affected_paths`
  - `baseline_updated`
  - `review_notes`

### review trace <-> checklist/hints/rationale

- 对齐映射：`RECOVERY_REVIEW_TRACE_ALIGNMENT`
- 每个 trace 字段均映射到：
  - checklist 检查项（`RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS`）
  - review hints 动作（`RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS`）
  - rationale 模板字段（`RECOVERY_DTO_BASELINE_UPDATE_REASON_TEMPLATE`）

结论：不引入新语言体系，仅补充“可复盘留痕字段”。

## 最小样例

### 样例 1：`non_breaking_external` baseline history entry

参考：`RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.non_breaking_external`

- classification：`non_breaking_external`
- baseline/rehearsal/docs：均更新
- viewVersion：不提升（给出兼容理由）
- review_notes：记录核对了可选/默认兼容与 baseline 快照

### 样例 2：`internal_only` review trace

参考：`RECOVERY_REVIEW_TRACE_EXAMPLES.internal_only`

- review_scope：仅 adapter 内部重构
- rule_basis：`internal_only` 分类 + checklist + hints
- compatibility/baseline/rehearsal/docs：均已核对
- follow_up_needed：`false`

### 可选理论样例：`breaking_external`

参考：

- `RECOVERY_DTO_BASELINE_HISTORY_ENTRY_EXAMPLES.breaking_external_theoretical`
- `RECOVERY_REVIEW_TRACE_EXAMPLES.breaking_external_theoretical`

说明：仅用于受限高风险语义演示，Phase 1 默认升级审查或拒绝。

## 与门禁关系（必须区分）

history/review trace 不替代：

- compatibility 断言
- baseline/rehearsal 回归测试
- PR checklist

它们用于提升“人工评审留痕一致性”，不是“勾选即通过”的自动门禁。

## 当前阶段不做什么

- 不做审计数据库
- 不做审批流系统
- 不做自动归档平台
- 不做 review 平台 API/UI
- 不做 ADL 业务实现

## 未来对接建议（轻量）

若后续接入更正式治理系统，可直接把：

- baseline history entry 作为“变更记录输入对象”
- review trace 字段作为“审阅证据最小字段”

并保持与当前 classification/checklist/hints/rationale 常量同源，避免双轨语义。

## 与 Step 24 的衔接

Step 24 已补充“何时填”的节奏语义：

- `RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE`
- `RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE`
- `RECOVERY_CADENCE_LEVELS`（required/recommended/optional）

详见：`docs/20-recovery-review-trace-and-baseline-history-cadence-semantics.md`。
