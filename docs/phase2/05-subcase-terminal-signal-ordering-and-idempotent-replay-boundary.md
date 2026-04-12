# Phase 2 / Step 5 - Subcase Terminal Signal Ordering And Idempotent Replay Boundary

## 本步范围冻结

### 本步要做

- 定义多专项终态信号的最小时间序语义
- 定义最小幂等重放边界
- 定义 duplicate / late / replayed 信号处理规则
- 增强协同入口，使其对时间序与重放边界行为稳定
- 增强审计与结果模型，表达信号类别与裁决结果
- 补测试覆盖正常/重复/晚到/边界路径

### 本步不做

- 完整 event sourcing 平台
- 完整 replay engine
- 分布式去重系统
- 全量时间序仲裁系统
- 外部消息系统接入
- saga / worker / scheduler
- UI / API / console
- 治理模板进一步细分

## 最小时间序语义

新增 `SubcaseTerminalSignalOrdering`，最小可判定字段：

- `signalOccurredAt`
- `subcaseLastUpdatedAt`
- `riskCaseLastUpdatedAt`
- `relationToSubcase`（older/equal/newer）
- `relationToRiskCase`（older/equal/newer）

并据此给出最小信号类别：

- `normal`
- `late`
- `replayed`
- `duplicate`（由 replay + 幂等判定收敛）

## 最小幂等重放边界

### duplicate

- 当 replay/重复信号对应等价或更低优先级业务事实时，不重复推进主案件。
- 输出稳定 `decision=duplicate`，并记录 `signalCategory=duplicate`。

### late

- 晚到低优先级信号：`decision=ignored`，不得覆盖已有更高优先级收敛结果。
- 晚到高优先级保守信号：仅在最小保守条件下允许升级（例如 failure -> manual intervention）。

### replayed

- replay completion 等无法合法覆盖当前状态的场景：`decision=rejected`。
- replay 行为不 silent ignore，必须给结构化可解释结果。

## 时间序版协同裁决规则

- 规则 A（重复）：同一业务事实重复到达 -> 不重复推进主案件（duplicate）
- 规则 B（晚到低优先级）：不覆盖已有更高优先级收敛（ignored）
- 规则 C（晚到高优先级）：仅允许保守升级在最小边界内生效（applied）
- 规则 D（重放边界）：同一 replay 输入行为稳定，不随调用时机漂移

## 协同入口增强

继续沿用并增强：

- `handleCoordinateRiskCaseAfterSubcaseTerminal`
- `handleTransitionLiquidationCase` / `handleTransitionADLCase` 的自动协同路径

增强点：

- 协同时加载 sibling subcase 上下文 + 时间序边界
- 统一输出 `applied/deferred/rejected/ignored/duplicate`
- 不新增分离逻辑路径，不散落 if/else

## 审计表达

协同审计 context 追加时间序与重放边界字段：

- `signal_category`
- `signal_reason`
- `signal_occurred_at`
- `subcase_last_updated_at`
- `risk_case_last_updated_at`
- `arbitration_decision`
- `selected_priority`
- 以及 Step 4 的冲突/活跃专项上下文

可直接解释“为何接受/拒绝/忽略/视为重复”。

## 结果模型表达

`resolution` 增强可见性：

- `signalCategory`
- `signalReason`
- `signalOccurredAt`
- `subcaseLastUpdatedAt`
- `riskCaseLastUpdatedAt`
- `decision`（包含 duplicate/ignored）
- `riskCaseTransitionApplied`

调用方无需拼装内部状态即可判定本次协同处理类别。

## 本步未做什么

- 未做完整 replay 平台
- 未做分布式消息去重
- 未做外部系统接入
- 未做复杂时间序引擎

## 下一步自然延伸

- Step 6 已完成：`docs/phase2/06-coordination-result-read-view-and-cross-command-consistency.md`。
- 下一步可在保持最小化原则下，补充协同结果跨会话持久化边界与最小回放校验占位。
