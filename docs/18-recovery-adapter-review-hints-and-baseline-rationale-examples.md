# Recovery Adapter Review Hints And Baseline Rationale Examples (Phase 1)

## 目标与边界

本阶段新增的是“人工评审辅助语义”：

- classification -> review hints（人可执行动作）
- baseline 更新原因实例（可直接参考）
- PR 填写最小指导（减少主观解释空间）

不做自动决策系统，不做 PR bot，不做审批流引擎。

## Classification -> Review Hints

实现位置：`RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS`

### `internal_only`

- `confirm_no_external_dto_field_change`
- `confirm_baseline_update_not_required`
- `confirm_view_version_bump_not_required`
- `confirm_docs_update_not_required_or_explain_why`

### `non_breaking_external`

- `review_baseline_update_need`
- `review_rehearsal_update_need`
- `review_docs_update_need`
- `confirm_added_fields_optional_or_defaulted`
- `explain_why_view_version_bump_not_required`

### `breaking_external`

- `mark_restricted_high_risk`
- `require_explicit_breaking_reason`
- `require_phase1_exception_rationale`
- `require_view_version_bump`
- `recommend_escalated_review_or_reject_in_phase1`

## 与 Classification Policy 对齐

- review hints 不是独立规则，`aligns_with_policy` 必须与
  `RECOVERY_ADAPTER_CHANGE_CLASSIFICATION_POLICY` 一致。
- 评审动作是 classification 的“人可执行版”，不允许出现口径分裂。
- 测试会校验三类 hints 与 policy 的一一对应关系。

## Baseline 更新原因实例

实现位置：`RECOVERY_DTO_BASELINE_UPDATE_REASON_EXAMPLES`

每类示例至少包含：

- `classification`
- `change_summary`
- `touched_shared_core_fields`
- `touched_external_dto_fields`
- `updated_baseline`
- `updated_rehearsal`
- `updated_docs`
- `requires_view_version_bump`
- `conclusion`

示例覆盖：

- `internal_only`: internal refactor only，baseline/rehearsal/viewVersion 均不更新
- `non_breaking_external`: 可选/默认字段新增，baseline/rehearsal/docs 更新，viewVersion 不变并给出理由
- `breaking_external`: 理论高风险示例，viewVersion/baseline 必须更新，Phase 1 默认升级审查或拒绝

## PR 填写最小建议

提交者至少写清：

1. 为什么属于当前 classification（external DTO/shared core 字段触达证据）
2. baseline 更新原因（按模板字段逐项给出 yes/no）
3. 若“无需更新 baseline”，需说明未触及哪些字段与依据哪条规则
4. 若“无需 bump viewVersion”，需说明为何仍兼容（可选/默认/语义不变）

评审者至少核对：

1. `RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS` 的动作是否被覆盖
2. 与 checklist/warning/baseline 规则是否一致
3. breaking_external 是否被明确标记为高风险受限

## 与现有门禁的关系（必须区分）

review hints 仅辅助人工一致性，不替代：

- 测试门禁（adapter baseline、rehearsal、回归断言）
- compatibility 断言（display compatibility gate）
- PR checklist（变更影响项逐项核对）

它的作用是帮助团队更稳定地使用这些门禁，而不是“勾选即通过”。

## 当前阶段不做什么

- 不实现 PR 自动评论机器人
- 不实现自动化审批流
- 不实现 release workflow 引擎
- 不引入重型治理框架
- 不实现 API/UI 评审系统

## 与 Step 23 的衔接

Step 23 已补充：

- baseline 历史变更记录模板：`RECOVERY_DTO_BASELINE_HISTORY_ENTRY_TEMPLATE`
- review trace 最小字段模板：`RECOVERY_REVIEW_TRACE_TEMPLATE`
- 二者与 checklist/hints/rationale 的对齐映射与最小样例

详见：`docs/19-recovery-baseline-history-and-review-trace-semantics.md`。
