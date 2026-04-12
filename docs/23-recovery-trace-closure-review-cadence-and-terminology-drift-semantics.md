# Recovery Trace Closure Review Cadence And Terminology Drift Semantics (Phase 1)

## 目标

本阶段新增轻量复盘语义：

- 收口层最小质量回看节奏建议
- 术语漂移监控信号占位
- 最小复盘检查项

目标是让团队不仅知道“何时更新模板”，也知道“何时回看整体语义是否仍健康”。

## 回看节奏建议

常量：`RECOVERY_TRACE_CLOSURE_REVIEW_CADENCE_GUIDANCE`

建议触发回看场景：

- 多次 adapter/display 相关改动累积后
- classification/cadence/warning/impact 规则变化后
- 新增规则来源文档或新增模板层后

说明：这是人工建议节奏，不是日历/提醒/自动流程系统。

## 术语漂移监控信号

常量：`RECOVERY_TERMINOLOGY_DRIFT_SIGNALS`

最小信号包括：

- 同一 classification 出现多套不一致表述
- “无需更新 baseline”表述分叉
- “无需 bump viewVersion”表述分叉
- “未使用来源及原因”粒度分叉
- `breaking_external` 的 `restricted_high_risk` 措辞被弱化
- `required/recommended/optional` 被未定义术语替代

说明：这是人工观察信号，不是自动术语扫描器。

## 最小复盘清单

常量：`RECOVERY_TRACE_CLOSURE_RETROSPECTIVE_CHECKLIST`

复盘关注项：

- phrase guidance 是否仍贴合实际填写
- consistency checklist 是否仍覆盖关键门禁
- document reference 来源项是否过时
- baseline history/review trace 样例是否仍具代表性
- classification/hints/cadence 是否仍一致
- 是否出现术语漂移信号

## Review Cadence 与 Maintenance Guidance 的区别

- maintenance guidance 回答：何时更新收口层模板（update）
- review cadence 回答：何时回看收口层整体健康（review）

两者相关但不等价，不能混用。  
关系常量：`RECOVERY_TRACE_REVIEW_CADENCE_AND_MAINTENANCE_RELATION`

## 最小样例

常量：`RECOVERY_TRACE_CLOSURE_REVIEW_EXAMPLES`

- `rule_change_triggered_review`：规则变化后触发一次收口层回看
- `terminology_drift_triggered_retrospective`：发现术语漂移后触发一次复盘
- `breaking_external_theoretical`：理论高风险受限语义样例（保留 `restricted_high_risk`）

## 当前阶段不做什么

- 不做自动术语扫描器
- 不做治理看板
- 不做日历/提醒系统
- 不做自动复盘平台
- 不做 API/UI 治理系统
- 不做 ADL 业务实现

## 未来复用建议（轻量）

未来如接入更正式治理流程，可复用：

- review cadence guidance 作为人工复盘触发来源
- drift signals 作为术语一致性观察项
- retrospective checklist 作为轻量复盘输入

并保持与 classification/checklist/hints/rationale/history/trace/cadence 同源，避免引入平行判定逻辑。

## 与 Step 28 的衔接

Step 28 已补充：

- `RECOVERY_TRACE_RETROSPECTIVE_OUTCOME_TEMPLATE`（复盘收尾结论模板）
- `RECOVERY_DRIFT_SIGNAL_RESPONSE_PHRASES`（漂移信号处理建议短语）
- `RECOVERY_RETROSPECTIVE_OUTCOME_AND_RESPONSE_ALIGNMENT`（与既有体系对齐）

详见：`docs/24-recovery-retrospective-outcome-and-drift-response-semantics.md`。
