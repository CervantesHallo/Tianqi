# Tianqi Phase 1 Mapping

## 跨 Phase 通用文档

与某一特定 Phase 无关、贯穿整个仓库生命周期的工程约定统一登记于本节。

- [`docs/commit-convention.md`](./commit-convention.md) —— 仓库 commit 消息风格约定（Conventional Commits + Trailer，基于 `git log` 实际样本固化）。

## Phase 2 启动状态（当前焦点）

- Phase 1 骨架与治理收口资产已冻结为基线，不再作为当前主增量方向。
- Phase 2 已正式启动，当前主线切换为核心案件流最小业务闭环。
- Phase 2 / Step 1 已落地：
  - `RiskCase / LiquidationCase / ADLCase` 最小模型
  - 三类 case 最小状态集合与基本状态迁移入口
  - 最小统一审计记录模型与迁移审计闭环
  - 最小应用层入口（专项 case 创建 + 三类 case 迁移）
- Phase 2 / Step 2 已落地：
  - `RiskCase` 与 `LiquidationCase / ADLCase` 的最小关联一致性约束
  - 专项案件创建/迁移的主案件状态联动校验
  - 审计记录中的跨案件关联字段（`relatedCaseType/relatedCaseId`）
  - 应用层结果模型中的联动可见性（`linkage` + `auditRecords`）
- Phase 2 / Step 3 已落地：
  - 专项终态触发主案件最小收敛动作（`RiskCaseResolutionAction`）
  - 终态协同规则（completion/failure -> risk resolution/manual intervention）
  - 显式协同入口与自动协同路径（专项终态迁移时自动触发）
  - 终态协同错误语义固化（非终态/冲突/重复收敛/来源缺失）
  - 结果模型中的收敛动作可见性（`resolution`）
- Phase 2 / Step 4 已落地：
  - 多专项并存最小顺序模型（`SubcaseTerminalSignal` + `RiskCaseSubcaseCoordinationContext`）
  - 终态信号冲突裁决规则（failure 信号优先，保守动作优先）
  - 最小优先级语义（`ManualInterventionRequired > Resolved > UnderReview`）
  - 裁决入口支持 sibling subcase 上下文（`listBySourceRiskCaseId`）
  - 审计 context 与结果模型裁决字段（冲突/优先级/裁决规则可见）
- Phase 2 / Step 5 已落地：
  - 多专项终态信号最小时间序语义（`SubcaseTerminalSignalOrdering`）
  - 最小幂等重放边界（duplicate/late/replayed）
  - 时间序版裁决规则（ignored/duplicate/rejected/applied 稳定行为）
  - 协同审计 context 补充信号时间与边界关系字段
  - 结果模型可见信号类别与时间边界解释（`signalCategory/signalReason/...`）
- Phase 2 / Step 6 已落地：
  - 协同裁决结果最小回读视图（`RiskCaseCoordinationResultView`）
  - 协同结果统一 projector（`projectCoreCaseFlowResultToCoordinationResultView`）
  - 跨命令最小一致性校验（`assertCoordinationResultViewsConsistent` + registry 记录校验）
  - 最小读取入口（`CoordinationResultQueryHandler`）
  - 审计摘要与读视图映射一致性保护（发现矛盾即结构化失败）
- Phase 2 / Step 7 已落地：
  - 协同裁决结果最小持久化边界（`StoredRiskCaseCoordinationResult` + `CoordinationResultStorePort`）
  - 持久化 schema/version 边界（`COORDINATION_RESULT_STORE_SCHEMA_VERSION`）
  - 写路径接入持久化并保留 Step 6 一致性校验（同 factKey 去重防漂移）
  - 读路径单一语义（优先 persistence，miss 回退 registry）
  - 最小 replay validation 占位（schema/factKey/audit 关键字段一致性）
- Phase 2 / Step 8 已落地：
  - 协同结果最小 observation 语义（query/persistence/repair 同源信号）
  - 最小 metrics sink 占位（`CoordinationMetricsSinkPort`）
  - query 路径 observation 输出与旁路 sink 状态暴露
  - read-view 最小修复命令边界（`CoordinationResultRepairCommandHandler`）
  - repair 成功/失败/noop 规则与最小 repair record 可查询语义
- Phase 2 / Step 9 已落地：
  - repair 最小状态模型（not_repaired/retryable/manual_confirm_required/manually_confirmed/repaired）
  - confirm/retry 最小命令边界与状态迁移规则
  - 读侧诊断聚合视图（`CoordinationResultDiagnosticView`）
  - factKey 维度 observation 聚合（query/persistence/repair）
  - 诊断查询入口（`CoordinationResultDiagnosticQueryHandler`）
- Phase 2 / Step 10 已落地：
  - 诊断视图最小风险分级（`low/medium/high`）
  - 诊断视图最小人工处理建议（`manualActionHint`）
  - 集中判读 helper（`buildCoordinationDiagnosticAssessment`）
  - 风险与建议原因字段（`riskReason/actionHintReason`）
  - 诊断 query 返回直接可断言的 risk/hint 结果
- Phase 2 / Step 11 已落地：
  - 判读规则最小可配置化边界（`CoordinationDiagnosticAssessmentRules`）
  - 规则版本占位（`COORDINATION_DIAGNOSTIC_RULES_VERSION`）
  - 诊断视图绑定规则版本（`assessmentRulesVersion`）
  - 集中兼容断言工具（`assertDiagnosticAssessmentCompatibility`）
  - 关键 risk/hint 映射兼容护栏测试
- Phase 2 / Step 12 已落地：
  - 诊断结果最小版本兼容读取策略（`compatible_read/compatible_with_notice/incompatible_version/missing_version`）
  - 单条历史结果最小对比模型（version/risk/hint/status 差异）
  - 最小历史来源边界（`CoordinationResultDiagnosticHistoryRegistry`）
  - 诊断 query 结构化输出 compatibility + comparison
  - 历史版本不兼容时结构化失败护栏
- Phase 2 / Step 13 已落地：
  - 诊断历史槽最小持久化模型（`StoredCoordinationDiagnosticHistorySlot`）
  - 最小 history store port（`CoordinationDiagnosticHistoryStorePort`）
  - current/previous persisted slot 轮转写入
  - 跨会话读取一致性校验（factKey/schema/version/关键字段冲突 notice）
  - includeHistoryComparison 的 persisted 优先 + fallback 来源显式输出
- Phase 2 / Step 14 已落地：
  - persisted history slot 最小 replay validation 三态（passed/notice/failed）
  - 跨版本/跨快照冲突最小归因字段（field/source/expected/actual）
  - consistency 校验统一输出 replayValidation + conflictAttribution
  - diagnostic query 统一返回 historyReplayValidation/historyConflictAttribution/historyComparisonNotice
  - persisted 与 fallback 历史来源同 shape 语义收敛
- Phase 2 / Step 15 已落地：
  - replay notice/failed 最小运维处理建议字段（operationalHint）
  - 读侧最小告警占位（readAlert：severity/code/summary/hint/attention）
  - replay validation -> hint/alert 集中 builder
  - query 返回 hint/reason/alert，补齐“冲突解释后的行动语义”
  - persisted/fallback 场景下 hint/alert 结构统一
- Phase 2 / Step 16 已落地：
  - hint/alert 最小抑制与去重占位（`DiagnosticAlertSuppressionResult`）
  - factKey 级最小降噪主键语义（`factKey + reasonCategory`）
  - suppression registry 占位（内存级 firstSeen/lastSeen/repeatCount）
  - diagnostic query 增强输出 `alertSuppression`
  - emitted/deduplicated/suppressed_with_notice 规则闭环
- Phase 2 / Step 17 已落地：
  - suppression state 最小持久化占位（`StoredDiagnosticAlertSuppressionState` + schema version）
  - suppression store port 最小边界（`put/getBySuppressionKey`）
  - suppression 写路径接入 persisted state（读-校验-写）
  - 跨会话 continuity 校验（key/语义/repeatCount/timeline/status）
  - diagnostic query 新增 `alertSuppressionPersistence` 语义
- Phase 2 / Step 18 已落地：
  - suppression persisted state 最小版本兼容读取策略（compatible/notice/missing/incompatible/malformed）
  - suppression state compatibility 结构化结果模型
  - 单条 suppression state 最小 repair 命令边界（repaired/failed/noop）
  - continuity 输出补充 compatibility/repair 建议信息
  - compatibility/repair 规则集中 helper 收敛
- Phase 2 / Step 19 已落地：
  - suppression state repair 最小生命周期状态模型（not_repaired/retryable/manual_confirm/manually_confirmed/repaired）
  - suppression state repair 手动确认/重试命令边界（单条 confirm/retry）
  - continuity 冲突到 repair lifecycle 的最小映射规则固化
  - 读路径返回 suppression repair lifecycle（无需调用方二次拼接）
  - lifecycle 规则集中 helper/registry 收敛与非法迁移护栏
- Phase 2 / Step 20 已落地：
  - suppression repair lifecycle 最小 persisted slot（current/previous + schemaVersion）
  - suppression repair lifecycle 最小 store port（put/getBySuppressionKey）
  - repair/confirm/retry 写路径接入 persisted slot 并保持 registry/store 语义一致
  - 跨会话 lifecycle continuity 校验（key/attempt/timeline/transition/live-conflict）
  - diagnostic query 返回 suppression lifecycle persistence/continuity 可见性字段
- Phase 2 / Step 21 已落地：
  - suppression repair command record 最小模型（repair/confirm/retry）
  - lifecycle slot 关联 latest command（`lastCommandRecordId`）
  - command-link consistency 校验（missing/status/key/timeline）
  - query 直接返回 latest command link 可读信息
  - 跨会话最小追责链闭环（不扩展为完整审计平台）
- Phase 2 / Step 22 已落地：
  - 核心案件端到端诊断聚合视图（aggregate view）落地
  - diagnostic/history/alert/suppression/repair/command-link 收敛到单次查询结果
  - 最小全链路摘要规则（attention/repair/manual-review/consistency/explanationStatus）
  - aggregate consistency 最小守卫（聚合语义不冲突）
  - 端到端读模型收口入口建立（保留基础 query 作为底层）
- Phase 2 / Step 23 已落地：
  - 核心案件流 + aggregate 关键路径回归 baseline 模型冻结（验收级）
  - 封板级 load-bearing 字段集合冻结（`PHASE2_AGGREGATE_BASELINE_CORE_FIELDS`）
  - 六类验收场景 baseline 固化（A-F）
  - 关键 failure 语义 baseline 冻结（history/command-link/suppression/validation）
  - 跨命令/跨会话 aggregate 一致性回归校验工具与测试落地
- 详细说明见：
  - `docs/phase2/01-core-case-flows-minimal-models-and-transitions.md`
  - `docs/phase2/02-core-case-linkage-and-consistency-rules.md`
  - `docs/phase2/03-subcase-terminal-coordination-and-riskcase-resolution-actions.md`
  - `docs/phase2/04-multi-subcase-minimal-ordering-and-conflict-resolution.md`
  - `docs/phase2/05-subcase-terminal-signal-ordering-and-idempotent-replay-boundary.md`
  - `docs/phase2/06-coordination-result-read-view-and-cross-command-consistency.md`
  - `docs/phase2/07-coordination-result-persistence-boundary-and-replay-validation-placeholder.md`
  - `docs/phase2/08-coordination-result-observation-and-minimal-repair-boundary.md`
  - `docs/phase2/09-repair-status-model-and-diagnostic-view.md`
  - `docs/phase2/10-diagnostic-risk-level-and-manual-action-hints.md`
  - `docs/phase2/11-diagnostic-assessment-rules-boundary-and-versioning-placeholder.md`
  - `docs/phase2/12-diagnostic-result-read-compatibility-and-history-comparison-placeholder.md`
  - `docs/phase2/13-diagnostic-history-slot-persistence-and-cross-session-consistency.md`
  - `docs/phase2/14-persisted-history-replay-validation-and-conflict-attribution.md`
  - `docs/phase2/15-replay-operational-hints-and-read-alert-placeholder.md`
  - `docs/phase2/16-diagnostic-alert-suppression-and-dedup-placeholder.md`
  - `docs/phase2/17-alert-suppression-state-persistence-and-cross-session-continuity.md`
  - `docs/phase2/18-suppression-state-read-compatibility-and-minimal-repair-placeholder.md`
  - `docs/phase2/19-suppression-state-repair-lifecycle-and-confirm-retry-boundary.md`
  - `docs/phase2/20-suppression-repair-lifecycle-slot-and-cross-session-read-continuity.md`
  - `docs/phase2/21-suppression-repair-command-record-link-and-cross-session-accountability.md`
  - `docs/phase2/22-core-case-diagnostic-aggregate-view-and-end-to-end-read-convergence.md`
  - `docs/phase2/23-aggregate-regression-baselines-and-failure-semantics-freeze-round1.md`

## 分层映射（总文档 -> 当前 packages）

- `shared` -> `packages/shared`：强类型基础（ID、版本、Result）
- `contracts` -> `packages/contracts`：错误码、事件信封、事件类型占位、DTO 占位
- `domain` -> `packages/domain`：`RiskCase` 聚合、状态/阶段枚举、显式状态机、领域错误、领域事件表达
- `ports` -> `packages/ports`：外部系统端口接口定义（仅抽象，不含实现，含 repository/idempotency/publisher/result-store/compensation-query/compensation-mutation/audit-sink/metrics-sink/sink-failure-recovery-store）
- `application` -> `packages/application`：最小命令入口（create/transition）+ 结果回读 + 补偿查询/变更入口 + 审计事件表达 + metrics 映射 + sink 调用编排占位
- `policy` -> `packages/policy`：策略接口占位（无业务细节）
- `infrastructure` -> `packages/infrastructure`：**DEPRECATED（Phase 8 起）** —— Adapter 统一落点为 `packages/adapters/*`。本目录仅保留 Phase 1 / Step 1 占位，禁止新增任何源文件、脚本、测试或子目录，统一清理时点不在 Phase 8 范围内。详见 `packages/infrastructure/README.md` 顶部 DEPRECATED 段。
- `adapters` -> `packages/adapters/*`：Phase 8 起承载所有 Port 在真实基础设施上的具体 Adapter；Step 1 已落地 `@tianqi/adapter-testkit` 共享契约测试工具包骨架

## 当前已落地

- TypeScript + pnpm monorepo 工程基础与门禁（lint/typecheck/test）
- 最小领域聚合闭环：
  - `RiskCase.create(...)`
  - `RiskCase.rehydrate(...)`
  - `RiskCaseStateMachine.transition(...)`
  - `TransitionContext` / `TransitionGuard` / `TransitionResult(before/after)`
  - 聚合变化的最小领域事件输出（创建事件与状态迁移事件）
- 契约基础：
  - 分层错误码（DOM/APP/POL/INF/CON）
  - `DomainEventEnvelope` 必填字段校验
  - `RiskCaseCreated` / `RiskCaseStateTransitioned` 事件占位
  - `mapRiskCaseDomainEventToContractEnvelope(...)` 显式映射路径
- 应用层闭环基础：
  - `CreateRiskCaseCommand` / `TransitionRiskCaseCommand`
  - `IdempotencyKey` 显式建模
  - `RiskCaseCommandHandler` 统一入口（依赖注入 `RiskCaseRepositoryPort` / `IdempotencyPort` / `DomainEventPublisherPort` / `CommandResultStorePort`）
  - `CommandResultQueryHandler` 按引用回读单条结果（含 snapshot schema version 校验）
  - `CompensationQueryHandler` 单条补偿状态查询入口
  - `CompensationCommandHandler` 单条补偿状态变更入口（resolve/manual escalation）
  - 应用层 `success/failure + riskCase + events + transition + processing + compensation` 结果模型
  - `CompensationStatus` 最小状态模型（pending/not_required/resolved/manual_intervention_required）
  - 查询结果含最小 observability（validation/mismatch/missing/fallback）
  - 补偿状态变更成功路径产出 `CompensationStatusChanged` 审计事件表达
  - `projectCommandResultQueryToMetrics(...)` 提供 query observability 到 metrics labels 的映射占位
  - `auditSink/metricsSink` 最小状态：`succeeded/failed/not_attempted`
  - 旁路 sink 失败不覆盖主业务 success，但必须在结果模型中显式暴露
  - sink failed 返回最小 `recoveryReference`（audit/metrics）+ `retryEligibility`
  - sink failed 时追加 `SinkFailureRecoveryStorePort.append`（单条记录）
  - 新增 `SinkFailureRecoveryCommandHandler`（manual resolve 回写）与 `SinkFailureRecoveryQueryHandler`（单条查询）
  - recovery record 变化审计事件：`RecoveryRecordChanged`（`RecoveryRecordAppended` / `RecoveryRecordManuallyResolved`）
  - recovery query 诊断模型与 `projectRecoveryQueryToMetrics(...)` 占位
  - recovery append/manual resolve 成功后已接入 `AuditEventSinkPort` 占位调用
  - recovery query（found/missing/unavailable）已接入 `MetricsSinkPort` 占位调用
  - recovery 侧 sink 失败采用并列收敛：不覆盖主结果，显式暴露 `succeeded/failed/not_attempted`
  - recovery 侧统一展示模型：`RecoveryDisplayView`
  - 三路径映射冻结：append/manual resolve/query -> 统一 display view
  - recovery 聚合诊断摘要：`RecoveryDiagnosticsSummary` + `needsAttention` 最小规则
  - `RecoveryDisplayView.viewVersion=1.0.0`，并冻结最小兼容策略（新增字段可选/默认、禁止删除/重命名、语义变化需提升版本）
  - 三路径 mapper 一致性断言门禁（核心字段集合 + outcome 值域 + diagnostics summary shape）
  - 新增 `RecoveryExternalDto` 与 `mapRecoveryDisplayViewToExternalDto(...)` adapter 边界
  - adapter 强制复用 display compatibility 门禁，DTO 跟随 `viewVersion`
  - 版本升级预演测试模板（当前 1.0.0 + future 可选字段新增 rehearsal）
  - console/api 轻量分叉策略冻结：统一 DTO 为主，分叉仅可选扩展字段
  - 共享核心字段集合冻结：`viewVersion/recoveryReference/sinkKind/mainOutcome/recordStatus/retryEligibility/hasNote/needsAttention/sinkStatus`
  - display->dto 变更影响清单模板（核心字段触达、版本提升、测试/文档更新）
  - external DTO 回归基线（append/manual resolve/query）测试已冻结
  - 共享核心字段变更告警模板与 impact checklist 对齐映射已冻结
  - 最小 PR checklist 模板已提供，可直接复制到 PR 描述
  - adapter 变更最小分类：`internal_only / non_breaking_external / breaking_external`
  - baseline 更新原因模板已冻结，并与 checklist/warning/version 规则对齐
  - PR 评审可直接套用分类 + baseline rationale + checklist 统一口径
  - `compensation marker / query observability / sink recovery reference` 保持模型边界分离
  - `duplicate/not_found/domain_failure/save_failure/mapper_failure/publish_failure` 失败路径收敛
  - duplicate 结果复用占位：`resultReference` + `reuse` + 回读语义
- adapter classification 已补充最小 review hints（classification -> reviewer actions）
- baseline 更新原因已补充三类实例（internal/non-breaking/breaking）
- PR 填写歧义收敛：新增极简填写建议（分类选择、baseline 理由、无需更新说明）
- review hints 与 checklist/tests/compatibility 的关系已明确：仅辅助人工，不替代门禁
- baseline 历史变更记录模板已冻结（change_date/change_summary/classification/affected_paths 等）
- review trace 最小字段已冻结（review_scope/rule_basis/compatibility_checked 等）
- history template 与 baseline reason template 对齐映射已冻结（含一一对应与归档补充字段）
- review trace 与 checklist/hints/rationale 的对齐映射已冻结，并补最小样例
- review trace 最小更新节奏建议已冻结（required/recommended/optional 三层）
- baseline history 最小归档节奏建议已冻结（含全局必归档条件与分类节奏）
- cadence guidance 与 checklist/review hints/baseline rules 的关系已明确：仅“何时执行模板”层
- 非自动化节奏执行边界已冻结（不做提醒器/审批平台/任务系统）
- 轻量留痕一致性检查清单已冻结（人工最终总览）
- 跨文档引用收敛模板已冻结（说明本次评审依据来源）
- checklist/hints/rationale/history/trace/cadence 关系已补最终收口层
- 留痕收口层边界已冻结：不替代既有模板，不进入知识库/自动校验系统
- 收口层最小维护约定已冻结（何时必须检查/更新收口层模板）
- 统一评审短语规范已冻结（减少同义描述波动）
- 收口层触发条件已冻结（classification/warning/impact/cadence/fields/source-options 变化）
- 非自动文本治理边界已冻结（不做文案 lint/审稿审批系统）
- 收口层最小质量回看节奏建议已冻结（何时建议回看整体健康）
- 术语漂移监控信号占位已冻结（语言层一致性观察点）
- 最小复盘检查项已冻结（phrase/checklist/reference/examples/alignment/drift）
- review cadence 与 maintenance guidance 区别已冻结（review 健康 vs update 模板）
- retrospective outcome 最小记录模板已冻结（复盘收尾结论）
- drift signal response 建议短语已冻结（发现漂移后的处理意见表达）
- outcome/response 与 checklist/drift/phrase/maintenance/cadence 的对齐已冻结
- 人工复盘收尾语义已补闭环（从触发回看到结论记录与建议短语）
- retrospective archive index 最小模板已冻结（复盘结果可检索归档）
- retrospective comparison 最小模板已冻结（本次 vs 上次差异占位）
- comparison 最小语义已冻结（signals/consistency/template-update/follow-up）
- 归档与对比层边界已冻结：仅辅助回看，不替代 outcome/checklist
- archive/comparison 字段稳定性约定已冻结（stable core / controlled summary）
- controlled summary 最小写法约定已冻结（1-2 句、先有无变化再写变化）
- archive/comparison 变更说明短模板已冻结（字段触达 + 稳定层级 + 影响说明）
- 归档描述收敛语义已补齐（短语同源、风格波动受控）
- archive/comparison 样例维护最小节奏已冻结（何时建议刷新样例）
- change note 复用短语清单已冻结（高频场景说明句式）
- 样例维护与短模板关系已冻结（不替代主规则，仅收敛表达）
- 理论 restricted 高风险短语在样例维护层保持不弱化
- 样例 lifecycle 最小约定已冻结（何时 active/historical_reference/retired）
- 历史样例保留说明模板已冻结（status/reason/replacement/use-scope）
- lifecycle guidance 与 maintenance guidance 的边界已冻结（状态判断 vs 更新时机）
- 样例演进语义已补齐（退役/替换/历史保留）
- lifecycle change note 最小模板已冻结（状态变化原因短说明）
- lifecycle review cadence 占位已冻结（historical/retired 回看触发）
- 样例状态变化语义边界已冻结（推荐/受限/不推荐路径）
- 生命周期收尾语义已补齐（change note + historical note + maintenance 分工）
- lifecycle change note 复用短语清单已冻结（高频状态切换表达收敛）
- 状态切换样例最小回归断言模板已冻结（统一检查骨架）
- phrases 与 regression template 的边界已冻结（收敛写法，不新增判定规则）
- lifecycle completion checklist 已冻结（减少填写遗漏）
- cross-template reference 短模板已冻结（减少 lifecycle 模板族漏对齐）
- checklist/reference 与 Step 33/34 边界已冻结（复用既有语义，不新增判定规则）
- lifecycle closure review cadence 已冻结（何时回看 checklist/reference）
- filling drift phrases 已冻结（高频填写偏差提醒占位）
- cadence/drift 与既有 guidance/phrases 边界已冻结（局部提醒，不替代主规则）
- cadence/drift 最小归档记录模板已冻结（局部复盘留痕）
- 偏差提醒复用样例回看约定已冻结（何时回看 drift 示例）
- record/review 与 Step 36 边界已冻结（补留痕与样例回看，不替代 cadence/drift 主规则）
- cadence/drift 归档条目最小分类短模板已冻结（分类写法同源收敛）
- lifecycle 收口层跨文档索引补丁已冻结（局部导航可复用）
- classification/doc-index 与 Step 37 边界已冻结（分类与导航，不替代 record/template 引用）
- doc index patch 最小维护触发清单已冻结（何时检查索引更新）
- record classification 复用短语约定已冻结（分类写法收敛）
- maintenance/phrases 与 Step 38/37/36 边界已冻结（补维护时机与写法，不替代主模板）
- navigation review record 最小模板已冻结（导航层小型回顾留痕）
- navigation phrase retrospective 占位已冻结（导航短语发散复盘触发）
- navigation review/retrospective 与 Step 39/38/26/27 边界已冻结（补导航复盘，不替代主规则）
- navigation archive index 最小模板已冻结（导航回顾轻量索引）
- navigation phrase example maintenance 触发约定已冻结（导航示例何时回看）
- archive-index/example-maintenance 与 Step 40/39/38 边界已冻结（补索引与示例维护，不替代主模板）
- navigation archive index update cadence 已冻结（归档索引何时回看）
- navigation trigger phrases 已冻结（示例维护触发写法收敛）
- update-cadence/trigger-phrases 与 Step 41/40/39/38 边界已冻结（补更新时机与触发写法，不替代主模板）
- navigation cadence/trigger review note 最小模板已冻结（导航维护回顾写法）
- navigation trigger phrase comparison 占位已冻结（触发短语历史变化记录）
- review-note/comparison 与 Step 42/41/40 边界已冻结（补回顾与对比，不替代主模板）
- review-note/comparison 维护触发清单已冻结（何时回看回顾与对比层）
- trigger phrase comparison 复用短语约定已冻结（对比说明写法收敛）
- maintenance/phrases 与 Step 43/42/40/26/28 边界已冻结（补回看触发与说明写法，不替代主模板）
- review-note/comparison 示例回看节奏建议已冻结（示例何时回看）
- comparison phrase 历史示例最小归档占位已冻结（旧示例轻量保留）
- example-cadence/archive 与 Step 44/43/32/37 边界已冻结（补示例回看与历史保留，不替代主模板）
- example cadence/archive 维护短语清单已冻结（高频写法同源收敛）
- comparison example archive 归档引用短模板已冻结（局部引用写法统一）
- phrases/archive-reference 与 Step 45/35/25/32/43 边界已冻结（补写法与局部引用，不替代主模板）
- cadence/archive phrase 最小维护触发清单已冻结（短语何时回看）
- archive reference 填写偏差短语提醒占位已冻结（局部引用填写偏差收敛）
- phrase-maintenance/filling-drift 与 Step 46/45/35/25/32/43 边界已冻结（补回看触发与偏差提醒，不替代主模板）
- phrase-maintenance/filling-drift 最小回看记录模板已冻结（局部回看留痕写法）
- 局部引用偏差样例回看节奏建议已冻结（局部样例何时回看）
- review-record/example-cadence 与 Step 47/46/35/25 边界已冻结（补回看留痕与样例节奏，不替代主模板）
- review-record/example-cadence 最小维护触发短语清单已冻结（局部触发写法收敛）
- 局部引用回看记录归档索引占位已冻结（局部回看记录可索引）
- trigger-phrases/local-archive-index 与 Step 48/47/46/41/35/25 边界已冻结（补触发写法与局部索引，不替代主模板）
- trigger-phrases/local-archive-index 最小维护触发清单已冻结（局部回看时机收敛）
- local archive index 填写偏差短语提醒占位已冻结（局部索引填写偏差收敛）
- maintenance/filling-drift 与 Step 49/48/47/41/29/35/25 边界已冻结（补回看触发与填写提醒，不替代主模板）

## 当前未落地

- ADL 候选筛选与排序细节
- 资金池瀑布策略细节
- 真实外部适配器（DB/MQ/Redis/Kafka/配置中心等）
- 审计事件存储与回放实现
- saga/补偿流程实现

## 下一阶段建议（封板回归模式）

- Phase 2 已进入 Step 21-30 收口预算，后续每步必须交付整块能力，避免语义碎拆。
- Step 22 起进入“端到端聚合收口阶段”，Step 23 起进入“封板回归基线阶段”。
- Step 24 完成场景矩阵加密（12 类）、failure 组合矩阵固化（3 组）、差异报告雏形落地。
- Step 25 完成封板差异全景矩阵 + 批运行器 + 验收输入物固化。Phase 2 已进入验收输入物固化阶段。
- Step 26 完成 Acceptance Gate 模型定义 + 封板门禁清单（8 条）固化 + Acceptance Runner 第一版落地。Phase 2 已进入封板门禁定义阶段。
- Step 27 完成端到端封板流水线打通（matrix → input → gate → pipeline result）+ 4 类高风险边界场景补齐 + pipeline consistency 校验。Phase 2 已进入端到端封板流水线阶段。
- Step 28 完成第二轮高风险边界场景补齐（4 类）+ Acceptance Gate 收紧（Rule C notice 升级）+ Final Acceptance Runner 雏形 + Pre-close Checklist。Phase 2 已进入最终验收 runner 成形阶段。
- Step 29 完成最终边界补齐（Z1-Z4 全部落地）+ Final Gate 冻结（vFinal，7 blocking / 2 notice / escalation=3）+ Pre-Close Checklist 冻结（6 项全阻断）+ Step 30 Runbook 固化（7 步序列）+ Close Readiness 一致性校验器。Phase 2 业务能力已停止新增。
- Step 30 完成最终总验收（按 PHASE2_STEP30_RUNBOOK 严格执行 7 步）+ Phase2FinalCloseDecision 模型落地 + 12 项 artifact 核验 + 最终一致性校验 + Phase 2 冻结文档。

**Phase 2 已正式封板。Steps 1–30 全部完成。后续进入 Phase 3。Phase 2 不再继续扩展。**

## Phase 3：策略可插拔与配置版本化

Phase 3 原始目标：RankingPolicy / FundWaterfallPolicy / CandidateSelectionPolicy / 配置版本化。

- Step 1 完成策略可插拔骨架启动：三类核心策略接口（RankingPolicy / FundWaterfallPolicy / CandidateSelectionPolicy）+ 统一策略身份模型（PolicyDescriptor）+ 统一输入输出契约（含 explanation / decisionSummary）+ 最小策略注册/解析骨架（createPolicyRegistry）+ 配置版本根模型（PolicyConfigurationRoot + validator）+ 5 类结构化错误（TQ-POL-002 ~ 006）。
- Step 2 完成策略配置快照解析 + PolicyBundle 组装 + 最小预校验 / Dry-Run 骨架：统一 PolicyBundle 模型 + resolvePolicyBundle 配置解析器 + prevalidatePolicyConfiguration 预校验（含 resolvedPolicyTypes/Keys/warnings/summary）+ dryRunPolicyBundle 最小 dry-run 骨架（可调用 + 契约验证）+ 三类 stub 策略实现（defaultRankingPolicyStub / defaultFundWaterfallPolicyStub / defaultCandidateSelectionPolicyStub）+ bundle/dry-run 级结构化错误语义（bundle_resolution_failed / dry_run_failed）。
- Step 3 完成第一组真实策略实现落地 + 真实策略 bundle 闭环：ScoreDescendingRankingPolicyV1（score 降序 + accountId 字典序 tie-break）+ PrioritySequentialFundWaterfallPolicyV1（priority 升序依次消耗 + shortfallAmount 显式表达）+ ThresholdCandidateSelectionPolicyV1（score >= threshold 筛选 + rejectedCandidates 可解释）+ 结果类型扩展（shortfallAmount / remainingAmount / rejectedCandidates / appliedThreshold）+ 注册 helper（registerDefaultStubPolicies / registerDefaultRealPoliciesV1）+ 真实配置快照 fixture（REAL_POLICY_CONFIG_V1）+ stub/real 共存验证。
- Step 4 完成配置版本激活链路启动：配置版本生命周期模型（draft/validated/active/rolled_back/rejected）+ PolicyConfigVersionRecord + 统一 preflight 守卫（runPolicyConfigActivationPreflight：validation → bundle resolution → dry-run 三阶段汇总）+ 激活命令边界（activatePolicyConfigVersion + allowOverrideActive 显式守卫）+ PolicyConfigActivationResult 切换结果模型 + 最小 active config registry（createPolicyConfigActivationRegistry）+ 最小回滚占位（rollbackToPreviousPolicyConfigVersion + preflight 前置校验）+ 5 类配置版本结构化错误（TQ-POL-007 ~ 011）。
- Step 5 完成配置版本变更审计链路 + 激活前后 Bundle 对比 + 配置版本化可回读性落地：配置版本变更审计记录模型（PolicyConfigVersionAuditRecord：auditId/actionType/fromVersion/toVersion/triggeredAt/triggeredBy/preflightStatus/resultStatus/summary/bundleDiffSummary）+ 审计记录构建器（buildActivationAuditRecord / buildRollbackAuditRecord）+ 最小审计存储边界（PolicyConfigVersionAuditRegistryOperations：record/getLatest/getLatestByTargetVersion）+ 最小 Bundle 差异模型（PolicyBundleDiff：基于 descriptor 的三类策略选择变化对比 + changedDescriptors + diffSummary）+ 统一配置版本回读视图（PolicyConfigVersionReadView：currentActiveVersion/currentStatus/currentDescriptors/previousVersion/lastAuditAction/lastAuditSummary/lastChangedAt/rollbackAvailable）+ 2 类审计/读侧结构化错误语义（audit_write_failed / config_read_view_unavailable）。
- Step 6 完成配置版本激活审计内聚化 + Bundle Diff / Read View 接入正式链路 + 第一轮回归基线冻结：正式编排层（orchestratePolicyConfigActivation / orchestratePolicyConfigRollback → PolicyConfigActivationOutcome 统一产出 activationResult + auditRecord + bundleDiff + readView）+ 第一轮配置版本化基线模型（PolicyConfigVersionBaseline：5 类场景 P1~P5 冻结）+ Load-bearing 字段常量（PHASE3_CONFIG_VERSION_BASELINE_CORE_FIELDS：8 字段）+ 集中一致性校验（assertPolicyConfigVersionBaselineConsistency：6 条跨字段不变量）+ 基线回归测试覆盖。
- Step 7 完成策略配置主线差异矩阵 + 配置版本化验收输入物（第一轮）+ Phase 3 收口模式启动：两组场景矩阵（策略可插拔 S1~S5 + 配置版本化 C1~C6 = 11 场景）+ 差异报告模型（Phase3PolicyConfigDifferenceReport）+ 差异矩阵模型（Phase3PolicyConfigDifferenceMatrix：含 actualSnapshots + overallStatus 三态）+ 9 字段 load-bearing 核心常量（PHASE3_POLICY_CONFIG_BASELINE_CORE_FIELDS）+ blocking/notice 漂移分类规则（7 blocking + 2 notice）+ 集中 runner（runPhase3PolicyConfigDifferenceMatrix：批量执行 → 差异报告 → 矩阵汇总 → 验收输入物）+ Phase3AcceptanceInputSnapshot（第一轮验收输入物）+ 矩阵级一致性校验（assertPhase3PolicyConfigBaselineConsistency：6 条跨场景不变量）。
- Step 8 完成 Acceptance Gate 定义 + 策略配置封板门禁清单固化 + Gate Runner 雏形落地：Phase3AcceptanceGateResult 模型（gateId/gateStatus 三态/checkResults/passedChecks/failedChecks/warningChecks/blockingIssues/nonBlockingNotices/gateSummary/recommendedDecision 三态）+ Phase3AcceptanceGateChecklistItem 模型（8 类门禁检查项：policy_bundle_resolution_stable / policy_dry_run_stable / strategy_matrix_covered / config_version_matrix_covered / no_blocking_core_field_drift / activation_chain_consistent / audit_diff_readview_consistent / no_blocking_failure_semantic_mismatch）+ Gate Runner 第一版（runPhase3AcceptanceGate：消费 Phase3AcceptanceInputSnapshot → 8 项检查 → gateStatus/recommendedDecision 判定）+ 集中 checklist 映射规则（8 个独立 evaluator 从 acceptance input 推导）+ gate summary builder（buildPhase3AcceptanceGateSummary）+ 端到端测试覆盖（matrix runner → gate runner 全链路）。
- Step 9 完成最终封板准备 — 高风险剩余边界补齐 + Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版：Phase3FinalAcceptanceResult 模型（finalRunId/differenceMatrix/acceptanceInput/acceptanceGate/preCloseChecklist/finalAcceptanceStatus 三态/finalAcceptanceSummary/blockingIssues/nonBlockingNotices/recommendedNextActions）+ Phase3PreCloseChecklist（6 项：difference_matrix_completed / acceptance_input_built / acceptance_gate_evaluated / strategy_matrix_coverage_confirmed / config_version_matrix_coverage_confirmed / blocking_issues_resolved_or_acknowledged）+ Final Acceptance Runner（runPhase3FinalAcceptance：matrix → input → gate → checklist → 判定）+ assemblePhase3FinalAcceptance（可测试组装入口）+ determineFinalAcceptanceStatus 判定规则 + validatePhase3FinalAcceptanceConsistency（5 条不变量）+ buildPhase3FinalAcceptanceSummary + 4 类高风险边界测试（F1/F2/F4/F5）。
- **Step 10 完成最终总验收 + 封板确认 + Phase 3 冻结：Phase3FinalCloseDecision 模型（closeDecisionId/phase/decision 三态/decisionSummary/differenceMatrixStatus/acceptanceGateStatus/finalAcceptanceStatus/finalChecklistStatus/blockingIssues/nonBlockingNotices/artifactsVerified/missingArtifacts/readyForNextPhase/freezeConfirmedAt）+ PHASE3_FINAL_REQUIRED_ARTIFACTS（12 项 artifact 核验覆盖 Step 1~10）+ verifyPhase3Artifacts（编程化 artifact 存在性验证）+ runPhase3FinalCloseDecision（完整链路：matrix → input → gate → final acceptance → consistency → artifacts → close decision）+ validatePhase3FinalCloseDecisionConsistency（6 条不变量）+ 封板判定规则（phase3_closed / phase3_closed_with_notices / phase3_not_closed）。**

**Phase 3 已封板。Decision: phase3_closed。Ready for Next Phase: YES。Phase 3 不再接受新能力。**

Phase 4 原始目标：应用层 orchestrator / saga·补偿 / 幂等保护 / 外部系统适配。

- Step 1 完成执行编排骨架启动：ExecuteRiskCaseOrchestrationCommand（命令模型）+ RiskCaseOrchestrationResult（结构化结果模型：orchestrationId/caseId/configVersion/policyBundleSummary/sagaStatus/idempotencyStatus/executedSteps/pendingCompensation/auditSummary/resultStatus 四态/resultSummary）+ OrchestrationSagaState（saga 骨架：sagaId/caseId/sagaStatus 五态/currentStep/completedSteps/failedStep/compensationPlan/startedAt/completedAt）+ CompensationPlan / CompensationRequirement（补偿边界骨架）+ OrchestrationIdempotencyKey / IdempotencyGuardResult / createOrchestrationIdempotencyRegistry（幂等键 + 幂等 guard + 内存级 registry）+ OrchestrationPorts（RiskCaseRepositoryPort / PolicyConfigPort / PolicyBundlePort / StrategyExecutionPort：仅消费 ports 不碰 infra）+ executeRiskCaseOrchestration（orchestrator 主链路：幂等 → load case → load config → resolve bundle → candidate selection → ranking → fund waterfall → finalize → 7 步 saga）+ 8 类结构化错误（TQ-APP-009 ~ 016）。
- Step 2 完成 Saga 补偿执行骨架 + 幂等结果重放 + 编排审计事件产出：executeOrchestrationCompensation（补偿执行骨架：逆序遍历 CompensationPlan → CompensationStepExecutionResult per step → OrchestrationCompensationResult）+ OrchestrationResultReplayRegistry（幂等结果存储/重放：recordResult / getRecordedResult → 相同幂等键直接返回 replayed_same_result 不重复执行）+ RiskCaseOrchestrationAuditEvent（审计事件模型：eventId/eventType/eventVersion=1.0.0/traceId/caseId/orchestrationId/occurredAt/producer/payload/metadata → 6 类事件 Started/StepCompleted/Failed/CompensationPlanned/CompensationExecuted/Completed）+ OrchestrationAuditPort（审计端口边界）+ 结果模型增强（compensationResult / auditEventSummary / replayedFromPreviousResult）+ 3 类新错误语义（compensation_execution_failed / replay_record_missing / audit_publish_failed）+ 审计端口失败不阻断编排。
- Step 3 完成第二条核心编排路径落地 + Saga 恢复/重入骨架 + 多路径一致性建立：ExecuteLiquidationCaseOrchestrationCommand + executeLiquidationCaseOrchestration（LiquidationCase 编排主路径 L1：replay → idempotency → load liquidation case → load config → resolve bundle → candidate selection → ranking → fund waterfall → finalize → 7 步 saga，共享 RiskCaseOrchestrationResult 结果模型）+ LiquidationCaseView / LiquidationCaseRepositoryPort（ports 消费边界）+ canResumeSaga / prepareSagaForResume（saga 恢复/重入骨架：failed 可恢复、compensation_required/completed/started/in_progress 不可恢复）+ assertOrchestrationPathConsistency（多路径一致性校验：6 条不变量，验证 RiskCase / LiquidationCase 结果 shape / saga / compensation / replay / audit 一致性）+ saga_resume_rejected 结构化错误。
- Step 4 完成编排差异矩阵 + 编排验收输入物（第一轮）+ Phase 4 收口模式启动：两组场景矩阵（RiskCase R1~R5 + LiquidationCase L1~L5 = 10 场景）+ Phase4OrchestrationDifferenceReport（差异报告模型）+ Phase4OrchestrationDifferenceMatrix（差异矩阵模型：含 overallStatus 三态 + 场景报告 + drift summary）+ 9 字段 load-bearing 核心常量（PHASE4_ORCHESTRATION_BASELINE_CORE_FIELDS）+ blocking/notice 漂移分类规则（7 blocking + 2 notice）+ runPhase4OrchestrationDifferenceMatrix（集中 runner：批量执行 → 差异报告 → 矩阵汇总 → 验收输入物）+ Phase4AcceptanceInputSnapshot（第一轮验收输入物）+ assertPhase4OrchestrationBaselineConsistency（矩阵级一致性校验：6 条不变量）。
- Step 5 完成 Acceptance Gate 定义 + 编排门禁清单固化 + Gate Runner 第一版落地：Phase4AcceptanceGateResult 模型（gateId/gateStatus 三态/checkResults/passedChecks/failedChecks/warningChecks/blockingIssues/nonBlockingNotices/gateSummary/recommendedDecision 三态）+ Phase4AcceptanceGateChecklistItem（8 类编排门禁：risk_case_orchestration_stable / liquidation_case_orchestration_stable / replay_semantics_stable / compensation_semantics_stable / saga_resume_semantics_stable / orchestration_matrix_covered / no_blocking_core_field_drift / cross_path_consistency_passed）+ runPhase4AcceptanceGate（消费 Phase4AcceptanceInputSnapshot → 8 项检查 → gateStatus/recommendedDecision 判定）+ buildPhase4AcceptanceGateSummary + 端到端测试（matrix runner → gate runner 全链路 pass）。
- Step 6 完成 Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版 + 最终封板准备态建立：Phase4FinalAcceptanceResult 模型（finalRunId/differenceMatrix/acceptanceInput/acceptanceGate/preCloseChecklist/finalAcceptanceStatus 三态/finalAcceptanceSummary/blockingIssues/nonBlockingNotices/recommendedNextActions）+ Phase4PreCloseChecklist（6 项：difference_matrix_completed / acceptance_input_built / acceptance_gate_evaluated / risk_case_matrix_coverage_confirmed / liquidation_case_matrix_coverage_confirmed / blocking_issues_resolved_or_acknowledged）+ runPhase4FinalAcceptance（全链路 runner：matrix → input → gate → checklist → 判定）+ assemblePhase4FinalAcceptance（可测试组装入口）+ determinePhase4FinalAcceptanceStatus 判定规则 + validatePhase4FinalAcceptanceConsistency（5 条不变量）+ buildPhase4FinalAcceptanceSummary + 4 类高风险边界测试（F1/F2/F4/F5）。
- **Step 7 完成最终总验收 + 封板确认 + Phase 4 冻结：Phase4FinalCloseDecision 模型（closeDecisionId/phase/decision 三态/decisionSummary/differenceMatrixStatus/acceptanceGateStatus/finalAcceptanceStatus/finalChecklistStatus/blockingIssues/nonBlockingNotices/artifactsVerified/missingArtifacts/readyForNextPhase/freezeConfirmedAt）+ PHASE4_FINAL_REQUIRED_ARTIFACTS（11 项 artifact 核验覆盖 Step 1~7）+ verifyPhase4Artifacts（编程化 artifact 存在性验证）+ runPhase4FinalCloseDecision（完整链路：matrix → input → gate → final acceptance → consistency → artifacts → close decision）+ validatePhase4FinalCloseDecisionConsistency（6 条不变量）+ 封板判定规则（phase4_closed / phase4_closed_with_notices / phase4_not_closed）。**

**Phase 4 已封板。Decision: phase4_closed。Ready for Next Phase: YES。Phase 4 不再接受新能力。**

Phase 5 原始目标：事件存储 / 回放器 / 案件重建 / 一致性校验。

- Step 1 完成审计与回放骨架启动：StoredAuditEvent（事件存储模型：eventId/eventType/eventVersion/traceId/caseId/occurredAt/producer/payload/metadata + storedAt/sequenceNumber）+ AuditEventStorePort（append/listByCaseId/getByEventId + 内存实现）+ CaseReplayInput / ReplayCaseCommand（单案件回放输入模型）+ CaseReplayResult（回放结果模型）+ reconstructCaseFromReplayInput（案件重建骨架：事件流 → 状态推导 → CaseReconstructionResult 三态 succeeded/failed/incomplete）+ runCaseReplay（单案件回放入口：store → consistency → reconstruction → result）+ validateReplayConsistency（一致性校验骨架：4 条不变量）+ Phase 4 编排审计事件正式接入 store 边界（端到端验证）+ 5 类结构化错误（TQ-APP-017 ~ 021）。
- Step 2 完成多案件 Replay 批运行骨架 + 重建一致性比对 + Replay 基线快照输出：RunBatchCaseReplayCommand（批运行命令：batchReplayId/caseIds/expectations/replayReason/traceId）+ BatchCaseReplayResult（批结果：requestedCaseIds/completedCaseIds/failedCaseIds/totalCases/successfulCases/failedCases/caseResults）+ CaseReconstructionComparison（比对模型：hasDifference/expectedFinalState/actualFinalState/comparisonStatus 四态 matched/mismatched/incomplete/failed）+ ReplayBaselineSnapshot（基线快照：matchedCases/mismatchedCases/incompleteCases/failedCases/overallStatus 三态 + comparisonResults）+ runBatchCaseReplay（批运行入口：消费单案件 replay 不重写主逻辑）+ buildReplayBaselineSnapshot（快照构建器）+ assertBatchReplayConsistency（批量一致性校验：5 条不变量）。
- Step 3 完成 Replay 差异矩阵 + Replay 验收输入物（第一轮）+ Phase 5 收口模式启动：两组场景矩阵（单案件 S1~S5 + 批运行 B1~B5 = 10 场景）+ Phase5ReplayDifferenceReport（差异报告模型）+ Phase5ReplayDifferenceMatrix（差异矩阵模型：含 overallStatus 三态 + 场景报告 + drift summary）+ 9 字段 load-bearing 核心常量（PHASE5_REPLAY_BASELINE_CORE_FIELDS）+ blocking/notice 漂移分类规则（6 blocking + 3 notice）+ runPhase5ReplayDifferenceMatrix（集中 runner：批量执行 → 差异报告 → 矩阵汇总 → 验收输入物）+ Phase5ReplayAcceptanceInputSnapshot（第一轮验收输入物）+ assertPhase5ReplayBaselineConsistency（矩阵级一致性校验：6 条不变量）。
- Step 4 完成 Acceptance Gate 定义 + Replay 门禁清单固化 + Gate Runner 第一版落地：Phase5ReplayAcceptanceGateResult 模型（gateId/gateStatus 三态/checkResults/passedChecks/failedChecks/warningChecks/blockingIssues/nonBlockingNotices/gateSummary/recommendedDecision 三态）+ Phase5ReplayAcceptanceGateChecklistItem（8 类 replay 门禁：single_case_replay_stable / batch_replay_stable / reconstruction_semantics_stable / comparison_semantics_stable / replay_consistency_stable / replay_matrix_covered / no_blocking_core_field_drift / single_and_batch_consistency_passed）+ runPhase5ReplayAcceptanceGate（消费 Phase5ReplayAcceptanceInputSnapshot → 8 项检查 → gateStatus/recommendedDecision 判定）+ buildPhase5ReplayAcceptanceGateSummary + 端到端测试（matrix runner → gate runner 全链路 pass）。
- Step 5 完成 Final Acceptance Runner 雏形 + Replay Pre-Close Checklist 第一版 + 最终封板准备态建立：Phase5ReplayFinalAcceptanceResult 模型（finalRunId/differenceMatrix/acceptanceInput/acceptanceGate/preCloseChecklist/finalAcceptanceStatus 三态/finalAcceptanceSummary/blockingIssues/nonBlockingNotices/recommendedNextActions）+ Phase5ReplayPreCloseChecklist（6 项：difference_matrix_completed / acceptance_input_built / acceptance_gate_evaluated / single_case_matrix_coverage_confirmed / batch_replay_matrix_coverage_confirmed / blocking_issues_resolved_or_acknowledged）+ runPhase5ReplayFinalAcceptance（全链路 runner：matrix → input → gate → checklist → 判定）+ assemblePhase5ReplayFinalAcceptance（可测试组装入口）+ determinePhase5ReplayFinalAcceptanceStatus 判定规则 + validatePhase5ReplayFinalAcceptanceConsistency（5 条不变量）+ buildPhase5ReplayFinalAcceptanceSummary + 4 类高风险边界测试（F1/F2/F4/F5）。
- **Step 6 完成最终总验收 + 封板确认 + Phase 5 冻结：Phase5ReplayFinalCloseDecision 模型（closeDecisionId/phase/decision 三态/decisionSummary/differenceMatrixStatus/acceptanceGateStatus/finalAcceptanceStatus/finalChecklistStatus/blockingIssues/nonBlockingNotices/artifactsVerified/missingArtifacts/readyForNextPhase/freezeConfirmedAt）+ PHASE5_FINAL_REQUIRED_ARTIFACTS（11 项 artifact 核验覆盖 Step 1~6）+ verifyPhase5ReplayArtifacts（编程化 artifact 存在性验证）+ runPhase5ReplayFinalCloseDecision（完整链路：matrix → input → gate → final acceptance → consistency → artifacts → close decision）+ validatePhase5ReplayFinalCloseDecisionConsistency（6 条不变量）+ 封板判定规则（phase5_closed / phase5_closed_with_notices / phase5_not_closed）。**

**Phase 5 已封板。Decision: phase5_closed。Ready for Next Phase: YES。Phase 5 不再接受新能力。**

Phase 6 原始目标：tracing / metrics / 关键路径性能基准 / 故障演练。

- Step 1 完成观测与压测骨架启动：TraceContext（统一 trace 上下文：traceId/spanId/parentSpanId/caseId/requestId/module/action/startedAt）+ startTraceContext / deriveChildTraceContext / buildTraceContextSummary（trace 创建/派生/汇总）+ MetricRecord（metrics 契约：metricName/metricType 三态 counter/gauge/histogram/value/unit/tags/recordedAt/traceId/caseId）+ MetricsPort（record/getRecorded + 内存实现）+ buildCounterMetric / buildLatencyMetric（metric 构建器）+ BenchmarkScenario / BenchmarkResult / runBenchmark（benchmark harness 骨架：iterations/success/failure/avgDuration/min/max）+ validateObservabilityConsistency（5 条不变量：traceId 不丢失 / metric traceId 与 trace 一致 / benchmark 统计自洽）+ Phase 4 orchestration + Phase 5 replay 路径正式接入 trace + metrics（端到端验证）+ 2 条 benchmark 场景（B1 orchestration / B2 replay）。
- Step 2 完成故障演练骨架启动：FaultInjectionScenario（故障注入模型：faultId/faultType 四态 timeout/duplicate_message/out_of_order_message/partial_write_success/targetModule/targetAction/activationRule/description）+ FaultDrillResult（drillRunId/scenarioId/targetPath/faultType/drillStatus 三态 handled_as_expected/degraded_but_continued/failed_unexpectedly/observedOutcome/traceSpanCount/metricCount/durationMs/summary）+ 两组 drill 场景矩阵（Orchestration O-F1~O-F4 + Replay R-F1~R-F4 = 8 场景）+ runPhase6FaultDrill（集中 drill runner）+ Phase6FaultDrillBaselineSnapshot（基线快照：overallStatus 三态 + 聚合统计）+ validateFaultDrillConsistency（5 条不变量）+ 复用 Step 1 tracing/metrics spine。
- Step 3 完成差异矩阵 + 验收输入物（第一轮）+ Phase 6 收口模式启动：两组场景矩阵（Observability T1~T5 + Fault Drill F1~F5 = 10 场景）+ Phase6DifferenceReport（差异报告模型）+ Phase6ObservabilityDifferenceMatrix（差异矩阵模型：含 overallStatus 三态 + 场景报告 + drift summary）+ 11 字段 load-bearing 核心常量（PHASE6_BASELINE_CORE_FIELDS）+ blocking/notice 漂移分类规则（6 blocking + 4 notice）+ runPhase6DifferenceMatrix（集中 runner：批量执行 → 差异报告 → 矩阵汇总 → 验收输入物）+ Phase6AcceptanceInputSnapshot（第一轮验收输入物）+ assertPhase6BaselineConsistency（矩阵级一致性校验：6 条不变量）。
- Step 4 完成 Acceptance Gate 定义 + 观测/故障演练门禁清单固化 + Gate Runner 第一版落地：Phase6AcceptanceGateResult 模型（gateId/gateStatus 三态/checkResults/passedChecks/failedChecks/warningChecks/blockingIssues/nonBlockingNotices/gateSummary/recommendedDecision 三态）+ Phase6AcceptanceGateChecklistItem（8 类门禁：trace_propagation_stable / metrics_recording_stable / benchmark_output_stable / fault_drill_semantics_stable / fault_drill_consistency_stable / phase6_matrix_covered / no_blocking_core_field_drift / observability_and_drill_consistency_passed）+ runPhase6AcceptanceGate（消费 Phase6AcceptanceInputSnapshot → 8 项检查 → gateStatus/recommendedDecision 判定）+ buildPhase6AcceptanceGateSummary + 端到端测试（matrix runner → gate runner 全链路 pass）。
- Step 5 完成 Final Acceptance Runner 雏形 + Phase 6 Pre-Close Checklist 第一版 + 最终封板准备态建立：Phase6FinalAcceptanceResult 模型（finalRunId/differenceMatrix/acceptanceInput/acceptanceGate/preCloseChecklist/finalAcceptanceStatus 三态/finalAcceptanceSummary/blockingIssues/nonBlockingNotices/recommendedNextActions）+ Phase6PreCloseChecklist（6 项：difference_matrix_completed / acceptance_input_built / acceptance_gate_evaluated / observability_matrix_coverage_confirmed / fault_drill_matrix_coverage_confirmed / blocking_issues_resolved_or_acknowledged）+ runPhase6FinalAcceptance（全链路 runner：matrix → input → gate → checklist → 判定）+ assemblePhase6FinalAcceptance（可测试组装入口）+ determinePhase6FinalAcceptanceStatus 判定规则 + validatePhase6FinalAcceptanceConsistency（5 条不变量）+ buildPhase6FinalAcceptanceSummary + 4 类高风险边界测试（F1/F2/F4/F5）。
- **Step 6 完成最终总验收 + 封板确认 + Phase 6 冻结：Phase6FinalCloseDecision 模型（closeDecisionId/phase/decision 三态/decisionSummary/differenceMatrixStatus/acceptanceGateStatus/finalAcceptanceStatus/finalChecklistStatus/blockingIssues/nonBlockingNotices/artifactsVerified/missingArtifacts/readyForNextPhase/freezeConfirmedAt）+ PHASE6_FINAL_REQUIRED_ARTIFACTS（12 项 artifact 核验覆盖 Step 1~6）+ verifyPhase6Artifacts（编程化 artifact 存在性验证）+ runPhase6FinalCloseDecision（完整链路：matrix → input → gate → final acceptance → consistency → artifacts → close decision）+ validatePhase6FinalCloseDecisionConsistency（6 条不变量）+ 封板判定规则（phase6_closed / phase6_closed_with_notices / phase6_not_closed）。**

**Phase 6 已封板。Decision: phase6_closed。Ready for Next Phase: YES。Phase 6 不再接受新能力。**

Phase 7 原始目标：配置发布守卫 / 契约冻结 / 回滚方案 / Runbook 与应急手册。

- Step 1 完成生产门禁骨架启动：Phase7PublishPreflightResult 模型（preflightId/targetConfigVersion/contractBaselineVersion/preflightStatus 三态 passed/passed_with_notice/blocked/blockingIssues/nonBlockingNotices/checkedAt/summary）+ ContractFreezeBaseline 模型（baselineId/apiContractVersionSet/eventContractVersionSet/errorCodeVersionSet/frozenAt）+ 三类发布阻断规则（配置 5 项 + 契约 3 项 + 审计回放 2 项 = 10 项阻断检查）+ runPhase7PublishPreflight（发布前总入口：config check → contract check → audit check → 汇总判定）+ validatePhase7PreflightConsistency（5 条不变量）+ 4 类结构化错误（TQ-APP-022 ~ 025）。
- Step 2 完成回滚方案骨架 + Runbook 占位 + 发布门禁差异矩阵起点：RollbackPlanSkeleton（rollbackPlanId/targetConfigVersion/rollbackTargetVersion/rollbackPrerequisites/rollbackSteps[stepId/action/target/expectedOutcome/isBlocking]/rollbackVerificationChecks/requiresManualApproval）+ validateRollbackPlan（5 项校验）+ ReleaseRunbookSkeleton（runbookId/runbookVersion/releaseScope/entryConditions/operationalChecks/rollbackEntryPoint/incidentEscalationRules）+ validateRunbookSkeleton（5 项校验）+ Phase7DifferenceMatrixDraft（7 场景 G1~G7：clean/notice/blocked 三类覆盖 preflight/rollback/runbook 组合）+ runPhase7DifferenceMatrixDraft（集中 draft runner）。
- Step 3 完成差异矩阵 + 验收输入物（第一轮）+ Phase 7 收口模式启动：两组场景矩阵（Preflight P1~P5 + Rollback/Runbook R1~R5 = 10 场景）+ Phase7MatrixDifferenceReport（差异报告模型）+ Phase7ReleaseGuardDifferenceMatrix（差异矩阵模型：含 overallStatus 三态 + 场景报告 + drift summary）+ 9 字段 load-bearing 核心常量（PHASE7_BASELINE_CORE_FIELDS）+ blocking/notice 漂移分类规则（6 blocking + 3 notice）+ runPhase7DifferenceMatrix（集中 runner：批量执行 → 差异报告 → 矩阵汇总 → 验收输入物）+ Phase7AcceptanceInputSnapshot（第一轮验收输入物）+ assertPhase7BaselineConsistency（矩阵级一致性校验：6 条不变量）。
- Step 4 完成 Acceptance Gate 定义 + 发布门禁清单固化 + Gate Runner 第一版落地：Phase7AcceptanceGateResult 模型（gateId/gateStatus 三态/checkResults/passedChecks/failedChecks/warningChecks/blockingIssues/nonBlockingNotices/gateSummary/recommendedDecision 三态）+ Phase7AcceptanceGateChecklistItem（8 类门禁：config_preflight_stable / contract_freeze_stable / rollback_plan_ready / runbook_ready / release_guard_consistency_stable / phase7_matrix_covered / no_blocking_core_field_drift / preflight_and_rollback_runbook_consistency_passed）+ runPhase7AcceptanceGate（消费 Phase7AcceptanceInputSnapshot → 8 项检查 → gateStatus/recommendedDecision 判定）+ buildPhase7AcceptanceGateSummary + 端到端测试（matrix runner → gate runner 全链路 pass）。
- Step 5 完成 Final Acceptance Runner 雏形 + Pre-Close Checklist 第一版 + 最终封板准备态建立：Phase7FinalAcceptanceResult 模型（finalRunId/differenceMatrix/acceptanceInput/acceptanceGate/preCloseChecklist/finalAcceptanceStatus 三态/finalAcceptanceSummary/blockingIssues/nonBlockingNotices/recommendedNextActions）+ Phase7PreCloseChecklist（6 项：difference_matrix_completed / acceptance_input_built / acceptance_gate_evaluated / preflight_matrix_coverage_confirmed / rollback_runbook_matrix_coverage_confirmed / blocking_issues_resolved_or_acknowledged）+ runPhase7FinalAcceptance（全链路 runner：matrix → input → gate → checklist → 判定）+ assemblePhase7FinalAcceptance（可测试组装入口）+ determinePhase7FinalAcceptanceStatus 判定规则 + validatePhase7FinalAcceptanceConsistency（5 条不变量）+ buildPhase7FinalAcceptanceSummary + 4 类高风险边界测试（F1/F2/F4/F5）。
- **Step 6 完成最终总验收 + 封板确认 + Phase 7 冻结：Phase7FinalCloseDecision 模型（closeDecisionId/phase/decision 三态/decisionSummary/differenceMatrixStatus/acceptanceGateStatus/finalAcceptanceStatus/finalChecklistStatus/blockingIssues/nonBlockingNotices/artifactsVerified/missingArtifacts/readyForNextPhase/freezeConfirmedAt）+ PHASE7_FINAL_REQUIRED_ARTIFACTS（11 项 artifact 核验覆盖 Step 1~6）+ verifyPhase7Artifacts（编程化 artifact 存在性验证）+ runPhase7FinalCloseDecision（完整链路：matrix → input → gate → final acceptance → consistency → artifacts → close decision）+ validatePhase7FinalCloseDecisionConsistency（6 条不变量）+ 封板判定规则（phase7_closed / phase7_closed_with_notices / phase7_not_closed）。**

**Phase 7 已封板。Decision: phase7_closed。Ready for Next Phase: YES。Phase 7 不再接受新能力。**

**Tianqi（天启）Phase 1-7 全部封板完成。**

Phase 8 原始目标：把 Phase 1 在 `packages/ports` 中定义的所有端口在生产级别上落地（EventStore / Notification / Config / External Engine 四类 Adapter），共计 20 个 Step。

- Step 1 完成基础设施适配器层骨架启动：`pnpm-workspace.yaml` 新增 `packages/adapters/*` 通配 + 新增 `packages/adapters/adapter-testkit` 共享契约测试工具包骨架（package.json / tsconfig.json / src/index.ts / README.md，依赖严格限定为 `@tianqi/contracts` 与 `@tianqi/ports`）+ 新增 `packages/adapters/README.md` 顶层说明（位置/三条强约束/已入驻 Adapter 表）+ 根 `tsconfig.json` 接入新工作区包的 Project Reference + 执行记录文档 `docs/phase8/01-adapter-layer-scaffolding.md`。本步不实现任何契约测试、不创建任何具体 Adapter、不迁移任何 in-memory 实现、不改动 ports/contracts/domain/application/policy/shared 任何文件、不引入任何第三方生产依赖。详见 `docs/phase8/01-adapter-layer-scaffolding.md`。
- Step 2 完成 Adapter 共享基础能力接口与 Phase 8 错误码命名空间扩展：`packages/ports/src/adapter-foundation.ts` 新增 `AdapterFoundation / AdapterIdentity / AdapterHealthCheck / AdapterLifecycle / AdapterHealthStatus / AdapterHealthDetails / AdapterHealthDetailValue` 一组横切契约（HealthCheck 不抛异常、无副作用；Lifecycle init/shutdown 幂等且承诺资源释放；`checkedAt` 采用仓库已有的 UTC ISO-8601 时间格式，对齐 §9.1）+ `packages/contracts/src/errors/` 新增 Phase 8 结构化错误类 `InfrastructureError / SagaError / Phase8ContractError` 与 `ERROR_LAYERS` 层级标识 + `ERROR_CODES` 追加 `TQ-INF-002 ADAPTER_INITIALIZATION_FAILED` / `TQ-SAG-001 SAGA_STEP_TIMEOUT` / `TQ-CON-004 ADAPTER_CONTRACT_TEST_VIOLATION` 三个 Phase 8 样本错误码（Phase 1-7 已发布的 `TQ-INF-001 / TQ-CON-001..003` 一字未改）+ `SagaErrorCode` 类型导出 + `packages/adapters/adapter-testkit/src/` 新增 `defineHealthCheckContractTests` / `defineLifecycleContractTests` / `AdapterFoundationFactory` 的骨架导出（仅 `describe` 包装，暂未注册具体 `it` 块）+ 单元测试覆盖 AdapterFoundation 类型契约、HealthCheck 字段 JSON 序列化、Lifecycle init/shutdown 幂等性、三大错误命名空间的构造/层级标识/跨命名空间混用类型拒绝/ERROR_CODES 全局唯一性（测试总数 1106 → 1134，+28）+ 执行记录文档 `docs/phase8/02-adapter-foundation-contracts.md`。本步不实现任何具体 Adapter / 不填充任何具体 Port 契约测试 case / 不枚举命名空间全量错误码 / 不修改任何现有 Port 签名或既有错误码 / 不触碰 packages/infrastructure / 不引入任何第三方生产依赖。详见 `docs/phase8/02-adapter-foundation-contracts.md`。
- Step 3 完成 adapter-testkit EventStore 契约测试套件落地：`packages/adapters/adapter-testkit/src/event-store-contract.ts` 新增 `defineEventStoreContractTests(adapterName, factory, options?)` 及其内部 6 大类别（幂等性 / 原子性 / 读取顺序 / 并发写入 / Schema 校验 / AdapterFoundation 集成）共 21 个 `it` 块 + `EventStoreAdapterUnderTest` / `EventStoreAdapterFactory` / `EventStoreContractOptions` 类型 + `EventStoreContractProbe` testkit 专用观察接口（带 `__testkitProbe: true` 品牌字段，为绕开既有 `EventStorePort.append-only` 形状的 META-RULE A 冲突处置）+ `src/fixtures/reference-event-store.ts` 内部参考实现（严格不通过 `src/index.ts` 与 `package.json exports` 对外暴露，仅供 adapter-testkit 自测套件完备性）+ `src/event-store-contract.test.ts` 驱动 19+2 个契约断言在参考实现上全绿 + `ERROR_CODES` 追加 `TQ-INF-003 EVENT_STORE_NOT_INITIALIZED` / `TQ-INF-004 EVENT_STORE_ALREADY_SHUT_DOWN` / `TQ-CON-005 EVENT_SCHEMA_VIOLATION` 三条错误码（每条都有对应 `it` 块触发，无预设）及对应 `eventStoreNotInitializedError / eventStoreAlreadyShutDownError / eventSchemaViolationError` 工厂 + adapter-testkit 的 workspace 依赖面从 `{contracts, ports}` 扩展到 `{contracts, ports, shared}`（`@tianqi/shared` 仅提供无业务语义的 `Brand<>` / `Result<>` / 身份标识构造器，扩展符合 Step 1 "精神约束"）+ 执行记录文档 `docs/phase8/03-event-store-contract-tests.md`（含 META-RULE A 两次触发留痕与错误码-断言对应表）。测试总数 1134 → 1155（+21）。本步不实现任何"真正的" EventStore Adapter / 不迁移任何既有 in-memory 实现 / 不修改 `EventStorePort` 或 `DomainEventEnvelope` 签名 / 不修改 `AdapterFoundation` / 不修改 Step 2 已有错误码 / 不触碰 domain/application/policy/infrastructure 任何源代码 / 不引入任何真实基础设施依赖。详见 `docs/phase8/03-event-store-contract-tests.md`。
