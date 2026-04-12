# Recovery Review Trace And Baseline History Cadence Semantics (Phase 1)

## 目标

本阶段冻结“什么时候必须填模板”的最小节奏语义，解决多人协作下“知道有模板但不知道何时填写”的问题。

范围仅包含：

- review trace 更新节奏建议
- baseline history 归档节奏建议
- 与 classification/checklist/review hints/baseline rules 的对齐关系

不包含自动提醒、审批平台、任务系统或流程引擎。

## 最小分层语义

常量：`RECOVERY_CADENCE_LEVELS`

- `required`: 必须执行，不能以口头说明替代
- `recommended`: 默认应执行，若不执行需给出明确理由
- `optional`: 可选执行，但仍需满足基础归类说明

## Review Trace 更新节奏

常量：`RECOVERY_REVIEW_TRACE_UPDATE_CADENCE_GUIDANCE`

- `internal_only`: `optional`
  - 触及 adapter 规则判断、compatibility 断言路径、共享核心字段判断时应补写
  - 若不补写，至少说明为何属于 `internal_only`
- `non_breaking_external`: `required`
  - 默认必须补写 review trace
  - 默认应与 baseline reason 同时出现
  - 不补写默认不允许，除非有明确例外理由
- `breaking_external`: `required`
  - 当前阶段理论上必须完整补写
  - 必须显式标记 `restricted_high_risk`
  - 不得以“口头说明”替代

## Baseline History 归档节奏

常量：`RECOVERY_BASELINE_HISTORY_ARCHIVE_CADENCE_GUIDANCE`

全局必归档条件：

- `baseline_updated=true`
- `view_version_bumped=true`

分类节奏：

- `internal_only`: `optional`
  - 未触及 external DTO 时通常可不归档
  - 若分类依据可能产生歧义，建议归档简版说明
- `non_breaking_external`: `recommended`
  - external DTO 暴露变化时通常应归档
  - 一旦触发全局条件则升级为必须归档
- `breaking_external`: `required`
  - Phase 1 受限高风险场景必须归档
  - 必须包含明确高风险说明与规则依据

## 与现有规则的关系（必须区分）

cadence guidance 是“何时执行模板”的建议层，不替代：

- checklist：`RECOVERY_DISPLAY_CHANGE_IMPACT_CHECKLIST_ITEMS`
- baseline rules：`RECOVERY_DTO_BASELINE_UPDATE_RULES`
- review hints：`RECOVERY_ADAPTER_CHANGE_REVIEW_HINTS`

对齐常量：`RECOVERY_CADENCE_GUIDANCE_ALIGNMENT`

## 最小样例

常量：`RECOVERY_CADENCE_GUIDANCE_EXAMPLES`

- `non_breaking_external_required_pair`
  - review trace：`required`
  - baseline history：`required`
  - 场景：external DTO 变化且 baseline 已更新
- `internal_only_optional_lightweight`
  - review trace：`optional`
  - baseline history：`optional`
  - 场景：仅内部重构，至少保留归类依据说明
- `breaking_external_theoretical_required`
  - 理论受限示例，保持 `required + restricted_high_risk`

## 当前阶段不做什么

- 不做自动提醒系统
- 不做审批节奏平台
- 不做工单/任务系统
- 不做 API/UI 治理平台
- 不做 ADL 业务实现

## 未来对接建议（轻量）

若未来接入更正式治理流程，可把 cadence guidance 作为“触发条件层”，继续复用既有 checklist/hints/rules，不新增平行语义体系。

## 与 Step 25 的衔接

Step 25 已补充最终人工收口层：

- `RECOVERY_TRACE_CONSISTENCY_CHECKLIST`
- `RECOVERY_TRACE_DOCUMENT_REFERENCE_TEMPLATE`
- 对齐常量与最小样例（用于统一“最后检查”和“依据来源说明”）

详见：`docs/21-recovery-trace-consistency-checklist-and-document-reference-semantics.md`。
