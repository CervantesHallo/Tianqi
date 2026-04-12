# Recovery Archive Comparison Example Maintenance And Change Note Phrases (Phase 1)

## 目标

本阶段补齐 archive/comparison 的轻量维护收敛：

- 样例何时建议维护
- change note 高频复用短语
- 样例与短模板继续同源对齐

目标是减少“模板没变但样例过时/写法发散”，不是实现自动文案平台。

## 样例维护最小节奏

常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_GUIDANCE`

建议触发：

- field stability policy 变化
- controlled summary 写法规则变化
- phrase guidance / drift response phrases 变化
- 出现现有样例未覆盖的主流场景

说明：人工维护建议，不是自动提醒系统。

## Change Note 复用短语清单

常量：`RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASES`

覆盖场景：

- 未触及 stable core fields
- 仅触及 controlled summary 且核心语义不变
- 需要更新样例
- 需要更新 docs
- 需要更新 tests
- 不影响人工对比可读性
- 影响人工对比可读性需补说明
- 理论 `breaking/restricted` 场景

用途：统一高频说明句式，不替代 change note 模板。

## 与既有规则关系

对齐常量：`RECOVERY_RETROSPECTIVE_EXAMPLE_AND_CHANGE_NOTE_ALIGNMENT`

- 样例维护 guidance 仅回答“样例何时刷新”
- change note phrases 仅减少句式波动
- 二者不替代 baseline/history/trace/cadence 主规则
- 二者继续复用 `RECOVERY_REVIEW_PHRASE_GUIDANCE` 与
  `RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES`

## 最小样例

常量：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES.controlled_summary_only_no_example_update`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_MAINTENANCE_EXAMPLES.mainstream_scenario_requires_example_update`
- `RECOVERY_RETROSPECTIVE_CHANGE_NOTE_PHRASE_EXAMPLES.*`

覆盖：

- 仅触及 controlled summary，不更新样例
- 新增主流场景，补最小样例
- 理论 `restricted_high_risk` 语义不弱化

## 当前阶段不做什么

- 不做自动文案生成器
- 不做样例管理平台
- 不做自动提醒系统
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

若未来接入更正式治理工具，可复用：

- 样例维护 guidance 作为更新触发条件来源
- change note phrases 作为高频说明语句库

并保持与 field stability / controlled summary / change note template 同源，不创建新主规则层。

## 与 Step 32 的衔接

Step 32 已补充：

- `RECOVERY_RETROSPECTIVE_EXAMPLE_LIFECYCLE_GUIDANCE`
- `RECOVERY_RETIRED_OR_HISTORICAL_EXAMPLE_NOTE_TEMPLATE`
- `RECOVERY_RETROSPECTIVE_EXAMPLE_STATUSES`

用于冻结样例退役/替换与历史保留说明语义。  
详见：`docs/28-recovery-example-lifecycle-and-historical-note-semantics.md`。
