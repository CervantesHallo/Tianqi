# Recovery Example Lifecycle And Historical Note Semantics (Phase 1)

## 目标

本阶段补齐样例演进语义：

- 样例何时 active / historical_reference / retired
- 历史样例保留说明模板
- 样例退役/替换与样例维护 guidance 的关系

目标是防止样例默默过期，不是构建样例库平台。

## 样例 Lifecycle 最小约定

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE`

关键语义：

- 字段稳定性变化导致样例不再代表推荐写法 -> 退役或替换
- controlled summary 规则变化导致措辞不再推荐 -> 替换或标注历史参考
- 出现更代表主流场景的新样例 -> 旧样例可保留为历史参考
- theoretical/restricted 示例用 note 标注，不新增状态层级

## 最小状态集合

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES`

- `active`: 当前推荐写法
- `historical_reference`: 仍有解释价值，但不再首选
- `retired`: 当前不建议继续作为写法参考

## 历史样例说明模板

常量：`RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE`

字段：

- `example_status`
- `reason`
- `recommended_replacement`
- `still_useful_for`
- `not_recommended_for`

用途：说明样例为何保留/退役、该替换到哪个样例。

## 与 existing maintenance guidance 的关系

对齐常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_ALIGNMENT`

- maintenance guidance 回答：何时检查样例是否需要更新
- lifecycle guidance 回答：当前样例是否继续推荐、历史保留还是退役
- 二者相关但不替代
- historical_reference 不等于当前首选
- retired 不等于删除上下文，而是“不再推荐写法”

## 最小样例

常量：`RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_EXAMPLES`

- `historical_reference_example`: 旧写法可帮助理解，但不再首选
- `retired_example`: 因规则变化退役，并给出 replacement
- `breaking_external_theoretical`: theoretical/restricted note 标注示例

## 当前阶段不做什么

- 不做样例库平台
- 不做自动样例迁移/清理系统
- 不做重型版本化框架
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来若接入更正式样例治理工具，可复用：

- lifecycle guidance 作为样例状态判断依据
- historical note 模板作为状态说明入口

并持续与 field stability / maintenance guidance / phrase guidance 同源。

## 与 Step 33 的衔接

Step 33 已补充：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS`

用于冻结生命周期状态变化说明和 historical/retired 回看节奏语义。  
详见：`docs/29-recovery-example-lifecycle-change-note-and-review-cadence-semantics.md`。
