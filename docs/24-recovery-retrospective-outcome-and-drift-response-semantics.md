# Recovery Retrospective Outcome And Drift Response Semantics (Phase 1)

## 目标

本阶段补齐人工复盘收尾语义：

- 复盘结论最小记录模板
- 漂移信号处理建议短语

目标是让复盘不只“看过了”，还能留下可复用的简短结论与处理建议。

## Retrospective Outcome 模板

常量：`RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE`

字段：

- `retrospective_scope`
- `signals_observed`
- `consistency_status`
- `actions_recommended`
- `template_updates_needed`
- `follow_up_needed`
- `notes`

用途：记录一次复盘结束后的最小结论，不是工单或流程模型。

## Drift Response 推荐短语

常量：`RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES`

覆盖场景：

- 轻微术语分叉，暂不更新模板
- 多处术语分叉，建议更新 phrase guidance
- 规则来源项过时，建议更新 document reference source options
- consistency checklist 覆盖不足，建议补齐
- classification/hints/cadence 口径分叉，建议触发联动检查
- `breaking_external` 受限措辞弱化，建议立即恢复并补 review trace 说明

用途：建议怎么写处理意见，不是自动处置规则。

## 与既有体系关系

关系常量：`RECOVERY_RETROSPECTIVE_OUTCOME_AND_RESPONSE_ALIGNMENT`

- outcome 引用 retrospective checklist 发现
- response 对齐 terminology drift signals
- `template_updates_needed` 对齐 maintenance guidance + review cadence guidance
- `follow_up_needed` 与 review trace / baseline history 补写建议衔接

明确边界：

- outcome 不替代 retrospective checklist
- response 不替代 phrase guidance
- 二者都不形成新判定层

## 最小样例

常量：

- `RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_EXAMPLES.minor_drift_no_template_update`
- `RECOVERY_DRIFT_SIGNAL_RESPONSE_EXAMPLES.outdated_document_reference_sources`

说明：

- 样例 1：发现轻微术语漂移，但模板暂不更新
- 样例 2：发现 document reference 来源项过时，建议更新模板来源选项
- 理论样例：`breaking_external` 受限措辞恢复

## 当前阶段不做什么

- 不做复盘平台
- 不做自动 drift 处理系统
- 不做工单流转
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来若接入更正式治理系统，可复用：

- outcome 模板作为复盘结论输入结构
- drift response phrases 作为人工建议短语库

并继续保持与 checklist/drift signals/phrase guidance 同源，避免平行语义分叉。

## 与 Step 29 的衔接

Step 29 已补充：

- `RECOVERY_RETROSPECTIVE_ARCHIVE_INDEX_TEMPLATE`（复盘归档最小索引）
- `RECOVERY_RETROSPECTIVE_COMPARISON_TEMPLATE`（历次结论最小对比占位）
- `RECOVERY_RETROSPECTIVE_COMPARISON_SEMANTICS`（最小对比语义）

详见：`docs/25-recovery-retrospective-archive-index-and-comparison-semantics.md`。
