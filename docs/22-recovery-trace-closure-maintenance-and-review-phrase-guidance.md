# Recovery Trace Closure Maintenance And Review Phrase Guidance (Phase 1)

## 目标

本阶段冻结两类最小语义：

- 收口层最小维护约定（何时必须检查并更新收口层）
- 统一短语规范（减少同义不同写法导致的评审波动）

目标是稳定人工协作口径，不是实现自动文本治理系统。

## 收口层最小维护约定

常量：`RECOVERY_TRACE_CLOSURE_MAINTENANCE_GUIDANCE`

触发即检查（人工）：

- `classification_policy_changed`
- `warning_template_changed`
- `impact_checklist_changed`
- `cadence_guidance_changed`
- `baseline_history_or_review_trace_fields_changed`
- `document_reference_source_options_changed`
- `rule_source_document_added`
- `shared_core_fields_changed`

每个触发项均明确：

- 必检目标（consistency checklist / document reference template / phrase guidance）
- 触发原因
- 关联规则来源

## 统一短语规范

常量：`RECOVERY_REVIEW_PHRASE_GUIDANCE`

推荐短语覆盖：

- 无需更新 baseline
- 无需 bump viewVersion
- internal_only 归类说明
- non_breaking_external 归类说明
- breaking_external（Phase 1 受限）说明
- 未使用某规则来源及原因
- 按 cadence 可不补写说明

短语定位：可复制、简短、稳定；不是自动判定规则。

## 与现有模板体系关系

短语规范服务于：

- PR checklist
- review hints
- baseline rationale
- review trace
- document reference

对齐常量：`RECOVERY_REVIEW_PHRASE_GUIDANCE_ALIGNMENT`

但不替代上述模板或判定逻辑。  
照抄短语不等于完成评审门禁。

## 最小样例

常量：`RECOVERY_REVIEW_PHRASE_EXAMPLES`

- `non_breaking_external`：统一短语填写样例
- `unused_source_reason`：document reference 中“未使用来源及原因”样例
- `breaking_external_theoretical`：仅理论受限语义示例（`restricted_high_risk`）

## 当前阶段不做什么

- 不做自动文本标准化系统
- 不做文案 lint 平台
- 不做审稿/审批系统
- 不做 API/UI 治理工具
- 不做 ADL 业务实现

## 未来复用建议（轻量）

若后续接入自动化工具，可复用：

- maintenance guidance 作为“人工触发条件来源”
- phrase guidance 作为“推荐表达词典”

并继续保持与现有 classification/checklist/hints/rationale/history/trace/cadence 同源，不创建平行语义体系。

## 与 Step 27 的衔接

Step 27 已补充：

- `RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE`（何时建议回看收口层健康）
- `RECOVERY_TERMINOLOGY_DRIFT_SIGNALS`（术语漂移最小观察点）
- `RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST`（最小复盘清单）

详见：`docs/23-recovery-trace-closure-review-cadence-and-terminology-drift-semantics.md`。
