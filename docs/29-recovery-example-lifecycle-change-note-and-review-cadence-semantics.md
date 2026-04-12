# Recovery Example Lifecycle Change Note And Review Cadence Semantics (Phase 1)

## 目标

本阶段补齐样例生命周期收尾语义：

- lifecycle change note 最小说明模板
- historical/retired 样例回看节奏建议
- 生命周期状态变化边界

目标是减少“状态变了但原因不清”的维护噪音，不是实现生命周期管理系统。

## Lifecycle Change Note 模板

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_TEMPLATE`

字段：

- `from_status`
- `to_status`
- `reason`
- `recommended_replacement`
- `still_useful_for`
- `review_after`
- `notes`

用途：记录“这次状态变化为什么发生”，不是审批单。

## Lifecycle Review Cadence 占位

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_REVIEW_CADENCE_GUIDANCE`

语义：

- `historical_reference`：规则/短语/主流场景变化后建议回看
- `retired`：replacement 变化或受限语义变化后建议回看
- `active`：继续由 `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE` 覆盖

说明：人工建议，不是自动提醒系统。

## 与 Historical Note / Maintenance Guidance 的关系

对齐常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_ALIGNMENT`

- lifecycle change note：回答“状态为什么变化”
- historical note template：回答“当前状态为何保留”
- maintenance guidance：回答“何时检查是否需要更新”

三者相关但不替代，避免混用。

## 状态变化语义边界（Phase 1）

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_STATUS_TRANSITION_SEMANTICS`

- `active -> historical_reference`：推荐（旧样例仍有上下文价值）
- `active -> retired`：推荐（规则变化后不再代表推荐写法）
- `historical_reference -> retired`：推荐（历史样例不再有解释价值）
- `historical_reference -> active`：受限允许（需显式理由与对齐复核）
- `retired -> active`：不推荐（仅理论受限说明，不作为常规路径）

## 最小样例

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_CHANGE_NOTE_EXAMPLES`

- `active_to_historical_reference`
- `historical_reference_to_retired`
- `retired_to_active_theoretical`（受限理论示例）

## 当前阶段不做什么

- 不做样例生命周期管理系统
- 不做自动提醒/巡检器
- 不做重型工作流状态机
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来如接入更正式样例治理工具，可复用：

- lifecycle change note 模板作为状态变化记录输入
- lifecycle review cadence 作为回看触发条件
- transition semantics 作为人工边界规则

并保持与 historical note / maintenance guidance 同源，不引入平行状态体系。

## 与 Step 34 的衔接

Step 34 在本文件基础上继续补充：

- lifecycle change note 复用短语清单
- 状态切换样例最小回归断言模板

用于收敛高频句式并固定样例回归检查骨架，不改变 Step 33 状态边界语义。  
详见：`docs/30-recovery-example-lifecycle-change-note-phrases-and-regression-template-semantics.md`。
