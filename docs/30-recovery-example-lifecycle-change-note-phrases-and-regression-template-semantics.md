# Recovery Example Lifecycle Change Note Phrases And Regression Template Semantics (Phase 1)

## 目标

Step 34 只补两层轻量能力：

- lifecycle change note 复用短语清单
- 生命周期状态切换样例最小回归断言模板

用于继续收敛写法，不引入自动化平台。

## Lifecycle Change Note 复用短语清单

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASES`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_ALIGNMENT`

覆盖高频场景：

- `active -> historical_reference`
- `active -> retired`
- `historical_reference -> retired`
- `historical_reference -> active`（受限）
- `retired -> active`（理论受限/不推荐）
- replacement 已提供
- 仍有解释价值
- 不再作为首选写法
- 后续规则/短语/主流场景变化后复核

定位：短语清单仅服务于 `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE` 的填写一致性。

## 与既有模板关系

短语清单不替代：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE`
- `RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`

职责只是在高频说明语句上减少波动，不新增判定规则。

## 状态切换样例最小回归断言模板

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_ALIGNMENT`

覆盖状态切换：

- `active -> historical_reference`
- `active -> retired`
- `historical_reference -> retired`
- `historical_reference -> active`（受限）
- `retired -> active`（理论受限）

最小断言位：

- `transition_pair_allowed`
- `reason_provided`
- `replacement_or_none_provided`
- `still_useful_for_or_notes_provided`
- `boundary_semantics_checked`

## 与 Step 33 关系

- Step 33：冻结状态变化语义边界（什么是推荐/受限/不推荐）
- Step 34：冻结“样例如何持续满足这些边界”的回归断言骨架

`regression template` 复用 Step 33 语义，不新增判定规则。

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_PHRASE_EXAMPLES.active_to_historical_reference_reuse`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES.historical_reference_to_retired_minimal`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_REGRESSION_EXAMPLES.retired_to_active_theoretical`

## 当前阶段不做什么

- 不做自动文案生成
- 不做样例状态机平台
- 不做自动样例校验平台
- 不做重型规则引擎
- 不做真实 API/UI
- 不做 ADL 业务实现

## 与 Step 35 的衔接

Step 35 在本文件基础上继续补充：

- lifecycle completion checklist（减少填写遗漏）
- cross-template reference 短模板（减少 lifecycle 模板族漏对齐）

不改变 Step 33/34 的语义边界，只增强填写与引用收口。  
详见：`docs/31-recovery-lifecycle-completion-checklist-and-cross-template-reference-semantics.md`。
