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
- Step 4 完成 Phase 8 首个正式 Adapter 落地：新建 `packages/adapters/event-store-memory/`（`@tianqi/event-store-memory`，第 9 个 workspace 包）+ `createInMemoryEventStore(options?): InMemoryEventStore` 工厂函数（唯一对外构造入口，不暴露 class）+ 生命周期状态机 `created → running → shut_down`（init/shutdown 幂等；关闭后不可复活）+ 11 字段 schema 校验（eventId / eventType / caseId / traceId / producer / occurredAt ISO-8601 / eventVersion semver / metadata.sourceModule / metadata.schemaVersion / metadata 值可序列化 / payload 对象形状）+ `eventIds: Set<EventId>` 幂等去重 + 存储入口 / 读出双向深克隆（`JSON.parse(JSON.stringify)` 防外部污染）+ `EventStoreContractProbe` 结构类型兼容（`TestkitProbe` 在 Adapter 本地声明，不 import adapter-testkit）+ `src/event-store-memory.contract.test.ts` 通过 `defineEventStoreContractTests("event-store-memory", () => createInMemoryEventStore())` 一行（逻辑内容 3 行）驱动 Step 3 的 21 个契约 `it` 块全绿 + 5 个 Adapter 自有单元测试（工厂基本健康性 / 多实例状态独立性 / healthCheck details 含 lifecycle 与 eventCount / `Object.keys` 恰好等于三契约并集无多余 / 空 options 与省略 options 行为一致）+ 根 `tsconfig.json` 追加 project reference + `packages/adapters/README.md` 已入驻表新增 Adapter 行 + 执行记录文档 `docs/phase8/04-event-store-memory-adapter.md`。测试总数 1155 → 1181（+26）。本 Step 无迁移来源（仓库从未存在 `EventStorePort` 实现），从零写；Adapter 生产依赖白名单严格 `{contracts, ports, shared}`，`@tianqi/adapter-testkit` 仅在 devDependencies；未引入任何第三方生产依赖；未修改 `EventStorePort` / `AdapterFoundation` / `EventStoreContractProbe` / `defineEventStoreContractTests` 任何签名；未触碰 `packages/infrastructure` / `packages/domain` / `packages/application` / `packages/policy` 任何文件；未预设 Query Port / Replayer Port（运行时读取能力留给未来独立 Step）。详见 `docs/phase8/04-event-store-memory-adapter.md`。
- Step 5 完成 Phase 8 首个持久化 Adapter 与持久化契约套件：新建 `packages/adapters/event-store-sqlite/`（`@tianqi/event-store-sqlite`，第 10 个 workspace 包）+ `createSqliteEventStore(options: SqliteEventStoreOptions): SqliteEventStore` 工厂（`databasePath` 必填，支持 `":memory:"`；不提供无 options 重载）+ 三表/索引 schema（`events` 表以 `append_seq AUTOINCREMENT PRIMARY KEY` + `event_id UNIQUE`、`(case_id, occurred_at, append_seq)` 复合索引、`schema_version` 单行表 + `CHECK (id = 1)`；`payload` / `metadata` 以 `TEXT` 存 JSON 字符串）+ `init()` 幂等自管 schema（`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` seed `"1.0.0"`）+ schema_version 不匹配抛 `TQ-INF-008` + 首次触地磁盘 + 首次引入第三方生产依赖 `better-sqlite3@11.5.0`（MIT 许可、工业标准、精确版本锁、README 明述理由；根 `package.json` 加 `pnpm.onlyBuiltDependencies` 以允许 native build）+ `@types/better-sqlite3@7.6.11` 作为 devDependency + 在 `@tianqi/adapter-testkit` 新增 `definePersistentEventStoreContractTests(adapterName, factory, options: PersistentEventStoreContractOptions)` 持久化契约函数（元规则 E 首次实战）+ 4 大持久化类别共 12 个 `it` 块（P1 持久化与恢复 4 / P2 schema 管理 3 / P3 并发与事务原子性 3 / P4 健康检查与持久化细节 2）+ `PersistentTestSession` / `PersistentEventStoreAdapterFactory` / `PersistentEventStoreContractOptions` 三类型 + `corruptSchemaVersion` 回调把 SQLite 专属损毁动作从 testkit 外置（元规则 D 边界保护）+ `event-store-sqlite.contract.test.ts` 一行 `defineEventStoreContractTests` 挂载 21 基础 + `event-store-sqlite.persistent.test.ts` 一行 `definePersistentEventStoreContractTests` 挂载 12 持久化 + 5 个 Adapter 自有单元测试（`:memory:` 路径 / `databasePath` 必填 `@ts-expect-error` / schema_version 首次 init 为 `"1.0.0"` / `Object.keys` 恰为三契约并集 / 两路径互相隔离）+ `ERROR_CODES` 追加 `TQ-INF-005 SQLITE_DATABASE_UNREACHABLE` / `TQ-INF-008 SQLITE_SCHEMA_VERSION_MISMATCH` 两码（每码对应具体 `it` 块，无预设）及对应 `sqliteDatabaseUnreachableError` / `sqliteSchemaVersionMismatchError` 工厂 + 根 `tsconfig.json` 追加 project reference + `packages/adapters/README.md` 已入驻表追加 Adapter 行 + 执行记录文档 `docs/phase8/05-event-store-sqlite-adapter.md`（K 节）。测试总数 1181 → 1220（+39 = 21 基础契约 + 12 持久化契约 + 5 Adapter 自有 + 1 testkit 导出面自测）。本 Step 未实现 Postgres / 未迁移 event-store-memory / 未改 `EventStorePort` 或 `AdapterFoundation` 或 `EventStoreContractProbe` 或 `defineEventStoreContractTests` 任何签名 / 未改既有错误码 / 未预构建 migration 框架 / 未触碰 `packages/domain` / `packages/application` / `packages/policy` / `packages/shared` / `packages/infrastructure` 任何文件 / 未在 Application 层替换内存为 SQLite（依赖注入是未来独立 Step 的职责）。详见 `docs/phase8/05-event-store-sqlite-adapter.md`。
- Step 6 完成 Phase 8 第二个持久化 Adapter（Postgres）：新建 `packages/adapters/event-store-postgres/`（`@tianqi/event-store-postgres`，第 11 个 workspace 包）+ `createPostgresEventStore(options: PostgresEventStoreOptions): PostgresEventStore` 工厂（`connectionString` 必填；`schema` / `poolSize=10` / `connectionTimeoutMs=5000` / `healthCheckTimeoutMs=2000` 可选）+ Postgres 原生类型 schema（`events` 表以 `event_id TEXT PRIMARY KEY` + `append_seq BIGSERIAL` + `(case_id, occurred_at, append_seq)` B-tree 索引、`payload` / `metadata` 为 `JSONB`、`occurred_at` 为 `TIMESTAMPTZ`；`schema_version` 表 + `CHECK (id = 1)` + `INSERT ... ON CONFLICT DO NOTHING` seed `"1.0.0"`）+ `init()` 在单事务内自管 schema（`CREATE SCHEMA IF NOT EXISTS` → 建表 → 建索引 → seed → 版本比对 → 失败 ROLLBACK）+ `pg.Pool` 连接池生命周期（init 创建池、shutdown 调用 `pool.end()` 终态不可复活）+ 首次引入第二个第三方生产依赖 `pg@8.13.1`（MIT 许可、工业标准、精确版本锁、纯 JS 无 native build、README 明述理由）+ `@types/pg@8.11.10` 作为 devDependency + 复用 `TQ-INF-008` 而非新增 `TQ-INF-012`（语义相同：两 Adapter 的 schema*version 表完全同构）+ `ERROR_CODES` 追加 `TQ-INF-009 POSTGRES_UNREACHABLE` 一码（对应 Adapter 自有 `test_network_unreachable_init_rejects*...`断言）及对应`postgresUnreachableError`工厂 + **Step 5 state guard 教训复用**（先判 shut_down 再判 created/null，注释显式致敬）+`event-store-postgres.contract.test.ts`通过`defineEventStoreContractTests("event-store-postgres", factory)`挂载 21 基础契约 +`event-store-postgres.persistent.test.ts`通过`definePersistentEventStoreContractTests`挂载 12 持久化契约（测试文件以`describe.skipIf(!TIANQI_TEST_POSTGRES_URL)`整块保护）+`corruptSchemaVersion`回调通过独立`pg.Client`执行`UPDATE schema_version`（元规则 D 保护：testkit 不引入 pg）+ scratchDirectory 语义在 Postgres 上下文中重解释为"schema 命名空间前缀"（元规则 B 保签名稳定，差异由 Adapter test 40 行胶水代码吸收）+ factory 对 testkit P4.2 hardcoded 的 `"does/not/exist"`路径用字符串 includes 信号识别并翻译为`127.0.0.1:1`的 always-unreachable 连接 + 6 个 Adapter 自有单元测试（connectionString 必填`@ts-expect-error`/ 网络不可达触发 TQ-INF-009 /`Object.keys` 恰为三契约并集；3 个需要真实 DB：healthCheck 的 details 含 idleCount/totalCount/waitingCount / shutdown 后 healthCheck healthy=false 不抛 / 并发 20 个 append 通过 pool 串行化全部入库）+ 元规则 I（外部服务 healthCheck：不触发业务写 / 独立超时 / 不抛异常 / details 含 lastSuccessAt + lastError + 池统计 / 不内部轮询）与元规则 J（外部服务测试隔离：`TIANQI_TEST_POSTGRES_URL`未设 skip 整块；skip 判断在文件顶部；不抓 connection error）首次实战 + 根`tsconfig.json`追加 project reference +`packages/adapters/README.md`已入驻表追加 Adapter 行 + 执行记录文档`docs/phase8/06-event-store-postgres-adapter.md`（12 节，含 §E 关于 TQ-INF-008 复用的裁决、§F 元规则 I/J 落地细节、§H Step 5 教训复用姿势、§J 本地执行未触达真实 Postgres 的披露）。测试总数 1220 → 1259（+39 = 21 基础契约 + 12 持久化契约 + 6 Adapter 自有；本地执行未设 `TIANQI_TEST_POSTGRES_URL`，其中 36 个 skipped、3 个 passed）。本 Step 未实现 Notification / Config / External Engine / 未迁移任何既有 Adapter / 未引入除 pg 外任何第三方依赖 / 未改 `EventStorePort`或`AdapterFoundation`或`EventStoreContractProbe`或`defineEventStoreContractTests`或`definePersistentEventStoreContractTests`任何签名 / 未改 Step 2-5 既有错误码 / 未扩张`pnpm.onlyBuiltDependencies`（pg 纯 JS）/ 未预构建 migration 框架 / 未触碰 Application 层 / 未引入 ORM / 未引入 LISTEN/NOTIFY / logical replication / 分区表 / stored procedure。详见 `docs/phase8/06-event-store-postgres-adapter.md`。
- Step 7 完成 Sprint C 立契约起点 — adapter-testkit Notification 契约测试套件落地：`packages/adapters/adapter-testkit/src/notification-contract.ts` 新增 `defineNotificationContractTests(adapterName, factory, options?)` 及其内部 5 大类别（Publish & Subscribe basics / Non-amplification under at-least-once / Ordering / Subscription lifecycle / AdapterFoundation integration）共 18 个 `it` 块 + `NotificationAdapterUnderTest` / `NotificationAdapterFactory` / `NotificationContractOptions` 类型 + `NotificationContractProbe` testkit 专用观察接口（带 `__notificationProbe: true` 品牌字段避免与 `EventStoreContractProbe` 的 `__testkitProbe` 混淆；`subscribe(handler): NotificationSubscription` 为唯一观察原语；严禁暴露"未发布但即将发布"的中间状态——元规则 K 硬约束）+ `src/fixtures/reference-notification.ts` 内部参考实现（严格不通过 `src/index.ts` / `package.json exports` 对外暴露，仅供 testkit 自测）+ `src/notification-contract.test.ts` 驱动 18 个契约断言在参考实现上全绿 + **复用** `TQ-INF-003` / `TQ-INF-004`（惯例 K：Lifecycle 共性错误码跨 Adapter 复用；常量名 `EVENT_STORE_` 前缀是 Step 3 命名历史局限，不构成不复用理由）不新增任何错误码 + 参考实现声明 **at-least-once** 传递语义（元规则 L：禁止把 exactly-once 作为默认；Tianqi 风控场景下 at-most-once 不适用）+ 重复订阅同一 handler **幂等**（基于 handler 函数引用的 Set 去重，克制 > 堆砌）+ 执行记录文档 `docs/phase8/07-notification-contract-tests.md`（12 节，含 §B META-RULE A 两次触发留痕：Port 无 subscribe → 引入 probe、NotificationMessage 无 eventId → 重解释类别 2 为 non-amplification；§E 传递语义选择；§G 错误码复用裁决；§H 元规则 A–L 触发逐一声明；§I 惯例 K/L 应用；§K 对 Step 8/9 的衔接）。测试总数 1259 → 1277（+18，契约套件 18 个 it）。本 Step 未实现任何正式 Notification Adapter / 未迁移任何既有 in-memory 实现 / 未修改 `NotificationPort` / `AdapterFoundation` / `EventStoreContractProbe` / `defineEventStoreContractTests` / `definePersistentEventStoreContractTests` 任何签名 / 未改既有错误码 / 未新增错误码 / 未触碰 domain/application/policy/shared/infrastructure 任何文件 / 未引入任何真实消息系统依赖。详见 `docs/phase8/07-notification-contract-tests.md`。
- Step 8 完成 Sprint C 首个正式 Adapter 落地（类比 Sprint B 的 Step 4）：新建 `packages/adapters/notification-memory/`（`@tianqi/notification-memory`，第 12 个 workspace 包）+ `createInMemoryNotification(options?): InMemoryNotification` 工厂（`InMemoryNotificationOptions = Readonly<Record<string, never>>` 空对象、对齐 Step 4 createInMemoryEventStore 风格；唯一对外构造入口，不暴露 class）+ 生命周期状态机 `created → running → shut_down`（init/shutdown 幂等；shutdown 调用 `subscribers.clear()` 清理订阅者）+ `Set<Handler>` 订阅者集合（重复 subscribe 同一 handler 天然幂等）+ `publish` 三关卡（**Step 5 state guard 教训硬模板复用**：先判 shut*down 抛 TQ-INF-004、再判 created 抛 TQ-INF-003、注释显式致敬 Step 5）+ `publish` 内 `Array.from(subscribers)` 快照遍历避免 handler 内 subscribe/unsubscribe 污染当前迭代 + **Handler 异常处置选择**"静默吞"（三选一明示理由：重抛破坏 `NotificationPort.publish` 的 `Result<void, *>`契约分层、记录到 details 无合理报告通道、静默吞贴合 fire-and-forget 分发语义；订阅者自负异常处理）+ **README § Delivery Semantics 主动声明三条（元规则 N 第二次实战）**：生产端不做去重（无 eventId 无可靠去重键）/ 消费端 publish 返回即同步完成分发（本 Adapter 独有强保证；Kafka 会弱于此）/ at-least-once（内存实际是 exactly-once in practice，诚实声明 at-least-once 以与 Step 9 Kafka 对齐；元规则 N 明禁 exactly-once 作为默认）+ 本地声明`TestkitProbe`类型（带`\_\_notificationProbe: true`品牌）结构兼容`NotificationContractProbe`，生产代码零 `import`指向`@tianqi/adapter-testkit`（元规则 F 严格贯彻）+ `notification-memory.contract.test.ts`通过`defineNotificationContractTests("notification-memory", () => createInMemoryNotification())`一行挂载驱动 Step 7 的 18 个契约`it`全绿 + 5 个 Adapter 自有单元测试（惯例 L 第一次实战：工厂基本健康 / 空 options 与省略 options 行为一致 / 两实例订阅者互相隔离 / healthCheck details 精确含 lifecycle + subscriberCount /`Object.keys`恰为三契约并集）—— docs/phase8/08 §F 含每个自有测试的"若放入契约套件仍有意义吗"自测结果表（全部"否"，无契约场景重复）+ 根`tsconfig.json`追加 project reference +`packages/adapters/README.md`已入驻表追加 Adapter 行 + 执行记录文档`docs/phase8/08-notification-memory-adapter.md`（11 节，含 §D handler 异常处置三选一裁决、§E 传递语义三条逐条展开、§F 惯例 L 自测表、§G Step 5 state guard 复用姿势、§H 元规则 A–J + M + N 触发情况）。测试总数 1277 → 1300（+23 = 18 契约 + 5 自有）。本 Step 无迁移来源（仓库从未存在 `NotificationPort`实现），从零写；Adapter 生产依赖白名单严格`{contracts, ports, shared}`，`@tianqi/adapter-testkit`仅在 devDependencies；未引入任何第三方生产依赖（手写`Set<Handler>`不引入 EventEmitter 包装器）；未修改`NotificationPort`/`AdapterFoundation`/`NotificationContractProbe`/`defineNotificationContractTests`任何签名；未改既有错误码（复用`TQ-INF-003`/`TQ-INF-004`惯例 K）；未新增错误码；未触碰 domain/application/policy/shared/infrastructure / adapter-testkit / 所有 EventStore Adapter 任何文件；未在 Application 层替换任何既有实现；未预先构建 Kafka 契约扩展。详见`docs/phase8/08-notification-memory-adapter.md`。
- Step 9 完成 Sprint C 收官战——@tianqi/notification-kafka Adapter 落地（Phase 8 首个面向真实分布式消息系统的 Adapter，类比 Sprint B 的 Step 6 Postgres）：新建 `packages/adapters/notification-kafka/`（`@tianqi/notification-kafka`，第 13 个 workspace 包）+ `createKafkaNotification(options)` 工厂（`brokers` / `clientId` / `topic` / `consumerGroupId` 必填；`connectionTimeoutMs=5000` / `healthCheckTimeoutMs=2000` / `allowAutoTopicCreation=false` / `retries` 可选）+ 引入 `kafkajs@2.2.4`（元规则 G 第三次实战，MIT / 工业标准 / 纯 JS 无 native / 精确版本锁）+ **双路径分发设计**（publish 先 Kafka broker ack 再本地 dispatch；consumer loop 通过 `tianqi-origin-instance` header 与本实例 `originInstanceId` 比对去重自环；元规则 A 显式处置进程内 vs 分布式语义缺口；所有 18 个契约 `it` 无需跳过）+ `publish` 用 `caseId` 作 message key 保 per-case 顺序 + **Step 5 state guard 教训硬模板复用**（先 shut_down TQ-INF-004 再 created TQ-INF-003，注释致敬）+ Handler 异常处置"静默吞"（与 notification-memory 保持 Sprint C 一致性；Kafka 场景下让 offset 正常推进避免毒消息阻塞）+ **元规则 I 第二次实战**（healthCheck 使用 `admin.fetchTopicMetadata` 只读探测；独立 `healthCheckTimeoutMs`；`Promise.race` + `scheduleTimer` 超时；不抛异常；details 含 `{ lifecycle, topic, consumerGroupId, clientId, brokers, lastSuccessAt, lastError, healthCheckTimeoutMs, subscriberCount }`）+ **元规则 J 第二次实战**（`TIANQI_TEST_KAFKA_BROKERS` 环境变量；`describe.skipIf(!canReachKafka)` 整块跳过；不假设特定主机/凭据；`afterAll` 通过 admin.deleteTopics 清理本次 run 创建的 topic）+ **元规则 N 第三次实战**（README § Delivery Semantics 主动声明三条：生产端不做去重 / publish 返回即 broker ack + 本实例订阅者已收到（跨实例有分布式延迟）/ at-least-once（真实分布式保证，非 in-practice）——与 notification-memory 声明有差异但都符合硬约束）+ `ERROR_CODES` 追加 `TQ-INF-010 KAFKA_BROKER_UNREACHABLE` 一码（惯例 K 判断：Kafka 诊断工具链专属不复用 TQ-INF-009；Publish 失败走 TQ-INF-001 复用）及对应 `kafkaBrokerUnreachableError` 工厂 + `notification-kafka.contract.test.ts` 通过 `defineNotificationContractTests("notification-kafka", factory)` 挂载 18 契约（`describe.skipIf` 整块保护）+ 6 个 Adapter 自有单元测试（惯例 L 第二次实战，docs §M 含"若放入契约套件仍有意义吗"自测表：brokers 空数组拒绝 / 网络不可达触发 TQ-INF-010 / `Object.keys` 三契约并集；3 个需要真实 Kafka：健康 details 含 Kafka 特有字段 / shutdown 后 healthCheck false 不抛 / 两 consumer group fan-out 都收到消息）+ **授权处置四项裁决**：1 不跳契约 `it`（双路径分发弥合）/ 2 probe 本地私有扩展（选项 a，不改 testkit）/ 3 新增 TQ-INF-010 其他复用 / 4 不开新持久化契约函数（选项 a；克制 > 堆砌）+ 根 `tsconfig.json` 追加 project reference + `packages/adapters/README.md` 已入驻表追加 Adapter 行 + 执行记录文档 `docs/phase8/09-notification-kafka-adapter.md`（16 节，含 §B-E 四项授权处置、§F 分区策略、§G handler 异常、§H healthCheck 探测、§I 传递语义 vs notification-memory 对比、§J Step 5 复用、§K 元规则 A-J + M + N 触发、§M 惯例 L 自测表、§N 本地未触达真实 Kafka 披露）。测试总数 1300 → 1324（+24 = 18 契约 skip + 3 自有 pass + 3 自有 skip；TIANQI_TEST_KAFKA_BROKERS 未设时 22 skipped，含 Kafka 的 CI 环境下 21 passed）。本 Step 未实现 Config / External Engine / 未迁移任何既有 Adapter / 未引入除 kafkajs 外任何第三方依赖 / 未改 `NotificationPort` / `AdapterFoundation` / `NotificationContractProbe` / `defineNotificationContractTests` 任何签名 / 未改 Step 2-8 既有错误码 / 未扩张 `pnpm.onlyBuiltDependencies`（kafkajs 纯 JS）/ 未预构建 schema registry / 未触碰 Application 层 / 未引入 ORM / 未引入 LISTEN/NOTIFY / 未引入 DLQ 管理。详见 `docs/phase8/09-notification-kafka-adapter.md`。
- Step 10 完成 Sprint D 立契约起点——adapter-testkit Config 契约测试套件落地（类比 Sprint B 的 Step 3 与 Sprint C 的 Step 7）：`packages/adapters/adapter-testkit/src/config-contract.ts` 新增 `defineConfigContractTests(adapterName, factory, options?)` 及其内部 5 大类别（Read path through getActiveConfig / Preview-Activate-Rollback state machine / Version-keyed read via probe / Audit trail + activation atomicity / AdapterFoundation integration）共 21 个 `it` 块 + `ConfigAdapterUnderTest` / `ConfigAdapterFactory` / `ConfigContractOptions` 类型 + `ConfigContractProbe` testkit 专用观察接口（带 `__configProbe: true` 品牌字段与既有 `__testkitProbe` / `__notificationProbe` 区分；六个方法 `preview / activate / rollback / getByVersion / getAuditTrail / setAuditFailureMode` 均为观察或受控变更原语；`setAuditFailureMode` 是唯一主动故障注入接口；严禁暴露"未 commit 但即将写入"的中间状态——元规则 M 硬约束）+ **testkit-专属** `ConfigAuditEntry` 型别（`fromVersion / toVersion / at / cause: "activate" | "rollback"`；严格不扩散到 `@tianqi/contracts` 或 `@tianqi/ports`，只是契约测试语言）+ `src/fixtures/reference-config.ts` 内部参考实现（严格不通过 `src/index.ts` / `package.json exports` 对外暴露；`recordActivation` 实现"flip pointer → append audit；audit 失败则 rollback pointer"的单 Adapter 1PC + compensation 模式；**Step 5 state guard 教训硬模板复用**）+ `src/config-contract.test.ts` 一行挂载驱动 21 个契约断言在参考实现上全绿 + **复用** `TQ-INF-003` / `TQ-INF-004`（惯例 K：Lifecycle 共性；与 Sprint B/C 策略一致）+ **新增两个错误码** `TQ-CON-006 ADAPTER_CONFIG_VERSION_NOT_FOUND` 与 `TQ-CON-007 ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED`（TQ-CON-006 与 Phase 1 冻结的 `TQ-POL-007 CONFIG_VERSION_NOT_FOUND` 层级隔离——Adapter 不得返回 Policy 层码，两码诊断工具链不同；TQ-CON-007 承载激活 audit 失败触发回滚的场景——放 TQ-CON-\* 而非 TQ-SAG-\* 是因为 Adapter 不是 Saga 编排者，仅维护单 Adapter 内不变量）及对应 `adapterConfigVersionNotFoundError` / `adapterConfigActivationAuditFailedError` 工厂 + `con.test.ts` 新增 4 个 `it` 块（TQ-CON-006/007 工厂断言 + `test_distinguishes_TQ-CON-006_from_frozen_TQ-POL-007` 层级隔离永久留痕 + cause chain 保留）+ `exports.test.ts` 新增 1 个 `it` 断言三 contract suite 同为函数类型导出 + 参考实现 preview 不去重（同内容两次 preview 返回两个版本号；审计可追溯优于"少分配 ID"）+ 单调正整数版本号（`createConfigVersion` 正整数约束复用）+ audit 条目带 `cause` 字段区分 activate vs rollback（运维可读 + Saga 回放友好）+ `ConfigContractProbe.setAuditFailureMode(enabled)` 固化类别 4 的激活原子性断言——audit 写失败路径必须把 active 指针回滚、pointer 与 audit 永不漂移 + 执行记录文档 `docs/phase8/10-config-contract-tests.md`（13 节，含 §B META-RULE A 三次触发留痕：Port 无 preview/activate/rollback → 引入 probe、无版本定位读 → getByVersion、无审计型别 → testkit-专属 ConfigAuditEntry；§C 5 类而非 4/6 的依据；§D probe 字段选择与拒绝理由；§E preview 不去重决策；§F 错误码复用 vs 新增裁决（含 TQ-POL-007 vs TQ-CON-006 层级隔离判断）；§G 激活原子性 1PC + compensation 模式；§H cause 字段；§I 元规则 A–N 触发情况；§K 对 Step 11+ 衔接；§L 风险点）。测试总数 1324 → 1350（+26 = 21 契约 + 4 con.test + 1 exports）。本 Step 未实现任何正式 Config Adapter / 未迁移任何既有 in-memory 实现 / 未修改 `ConfigPort` 或 `RuntimeConfig` 签名 / 未改任何 Phase 1-7 既有错误码（含 TQ-POL-007）/ 未修改 `AdapterFoundation` / `EventStoreContractProbe` / `NotificationContractProbe` / `defineEventStoreContractTests` / `defineNotificationContractTests` / `definePersistentEventStoreContractTests` 任何签名 / 未触碰 domain/application/policy/shared/infrastructure 任何文件 / 未引入任何第三方依赖 / 未定义 `definePersistentConfigContractTests`（元规则 E：按需独立函数；若 Step 11+ 有持久化契约再新开）。详见 `docs/phase8/10-config-contract-tests.md`。
- Step 11 完成 Sprint D 同步落地两个 Config Adapter——`@tianqi/config-memory` + `@tianqi/config-file`（Phase 8 首次在单 Step 内同步落地两个独立 Adapter；workspace 包数 13 → 15）：新建 `packages/adapters/config-memory/`（`@tianqi/config-memory`，第 14 个 workspace 包）与 `packages/adapters/config-file/`（`@tianqi/config-file`，第 15 个 workspace 包，类比 Sprint B 的 Step 5 SQLite / Sprint C 的 Step 9 Kafka 的"进程内 + 持久化冷启动"双实现结构）+ **三重独立性**（源码严格无相互 import / 均不从 reference-config 复制 / semantics 声明差异化）+ `createInMemoryConfig(options?)` 工厂（`InMemoryConfigOptions = Readonly<Record<string, never>>`；对齐 `createInMemoryEventStore` / `createInMemoryNotification` 风格）+ `createFileConfig(options: FileConfigOptions)` 工厂（`filePath` 必填 + `healthCheckTimeoutMs` 可选默认 2000ms）+ 两 Adapter 各自实现 **Step 10 的 1PC + compensation 模式**（`recordActivation` 翻指针 → 写审计 → 故障时补偿回滚 + 返回 TQ-CON-007；代码含"Both adapters (independent files, copied-from-scratch)"注释证明独立性）+ **Step 5 state guard 教训在两处各自独立复用**（先 shut_down 再 created；注释致敬）+ config-file 的 `init` 行为 **META-RULE A 触发一次**（Step 11 §B.3 literal 要求 init 自动 activate 与 Step 10 契约 1.1 "test_get_active_config_before_any_activation_returns_structured_error_not_empty_value" 冲突 → 冻结契约胜出 → init 只 preview 不 activate，调用方需显式 `activate(createConfigVersion(1))`；源码 10+ 行注释留痕 + README 使用范例显式展示两步流程 + docs §G 永久留痕）+ **YAML `version` 字段与 Adapter 内部 counter 的关系裁决**（Adapter counter 是 ConfigVersion 唯一事实来源；YAML version 仅作文件 schema 世代标记用于格式校验 + healthCheck 展示；拒绝"尊重 YAML version"方案的三条理由：契约类别 2 会失败 / 多实例状态污染 / 运维心智一致；选型在 docs §C 留痕）+ **引入 yaml@2.8.3 第三方生产依赖**（元规则 G 第四次实战，ISC 许可等价 MIT / 纯 JS 无 native build / 精确版本锁；选型理由：yaml by eemeli 是 YAML 1.2 兼容且被 vite/vitest 内部使用，不选 js-yaml 因其语义是 YAML 1.1；未扩张根 `pnpm.onlyBuiltDependencies` 白名单）+ **元规则 I 第三次实战**（config-file healthCheck 使用 `fs.access(R_OK)` 只读探测；独立 `healthCheckTimeoutMs`；`Promise.race` + `scheduleTimer` 超时；不抛异常；details 含 `{ lifecycle, filePath, fileReadable, activeVersion, versionCount, fileYamlVersion, lastError, healthCheckTimeoutMs }`；拒绝 `fs.stat`/`readFile` 作为探测方式，详见 docs §H）+ **元规则 N 第四次实战**（两 Adapter README § Semantics 主动声明三条：持久化保证 / 激活原子性保证 / 多实例一致性；两者声明差异化呈现在 docs §F 对比表；持久化差异：config-memory 不持久化 vs config-file YAML 冷启动但运行期新版本不回写；初始状态差异：config-memory `versions.size=0` vs config-file `versions.size=1`（YAML bootstrap 已 preview 但未 activate））+ **元规则 F 扩展到 Adapter 之间**（不仅禁止 `import { createReferenceConfig }` 原始禁令，也禁止 config-memory 与 config-file 相互 import；两包独立声明 `ConfigAuditEntry` / `ConfigContractProbeError` / `TestkitProbe` 结构类型；grep 证据两包互不 import）+ `ERROR_CODES` 追加 **`TQ-INF-011 CONFIG_FILE_UNREADABLE`**（惯例 K 新增：文件 IO 诊断工具链 `ls / stat / chmod / df / mount` 与 DB/Kafka 诊断工具链 `psql / kafka-topics.sh` 完全不同）与 **`TQ-CON-008 CONFIG_FILE_SCHEMA_INVALID`**（惯例 K 新增：config schema 语料库是运维手编 YAML 需读 Adapter README，与 TQ-CON-005 EVENT_SCHEMA_VIOLATION 的程序生成 JSON 读 contracts 包 docs 形成语料分离）及对应 `configFileUnreadableError` / `configFileSchemaInvalidError` 工厂 + `inf.test.ts` 新增 1 个 `it` 块（TQ-INF-011 工厂）+ `con.test.ts` 新增 2 个 `it` 块（TQ-CON-008 工厂 + `test_distinguishes_TQ-CON-008_from_TQ-CON-005` 语料分离永久留痕）+ config-memory `config-memory.contract.test.ts` 一行挂载 21 契约全绿 + 5 个惯例 L 自测（工厂基本健康 / 空 options 等效 / 两实例隔离 / healthCheck details 精确含 lifecycle + versionCount / `Object.keys` 恰为三契约并集；docs §J 自测表全部"否"通过）+ config-file `config-file.contract.test.ts` 通过 `mkdtemp(os.tmpdir())` 为每次 factory 调用写一份新 SEED YAML 挂载 21 契约全绿 + 6 个惯例 L 自测（filePath 必填 `@ts-expect-error` / 不存在文件触发 TQ-INF-011 / 破碎 YAML 触发 TQ-CON-008 / missing version 字段触发 TQ-CON-008 / healthCheck 文件被删后 fileReadable=false 且不抛 / `Object.keys` 恰为三契约并集；docs §J 自测表全部"否"通过）+ 根 `tsconfig.json` 追加两个 project reference + `packages/adapters/README.md` 已入驻表追加两行 + `pnpm-lock.yaml` +53 -10（新增 yaml@2.8.3 + 两新 workspace 包条目）+ 执行记录文档 `docs/phase8/11-config-memory-and-file-adapters.md`（15 节，含 §A 双 Adapter 三重独立性 / §B 单 Step 双 Adapter 的三重考量 / §C YAML version vs counter 裁决 / §D TQ-INF-011 + TQ-CON-008 新增决策 / §E 1PC + compensation 独立实现 / §F semantics 三条对比表 / §G META-RULE A config-file init 不自动 activate 处置 / §H healthCheck 探测方式选择与拒绝理由 / §I Step 5 教训两处独立复用 / §J 惯例 L 两份自测表 / §K 元规则 A–J + M + N 触发 / §L 风险点 / §M Step 12 衔接 / §N 测试增量明细 / §O workspace + lockfile 增量）。测试总数 1350 → 1406（+56 = 2 con.test 新 + 1 inf.test 新 + 21 config-memory 契约 + 5 config-memory 自有 + 21 config-file 契约 + 6 config-file 自有）。本 Step 未实现 External Engine / 未引入热加载能力（fs.watch / chokidar）/ 未引入回写文件 / 未迁移任何 Phase 1-7 既有代码 / 未引入除 yaml 外任何第三方依赖（不引入 zod/joi/ajv 做深度 schema 校验）/ 未修改 `ConfigPort` / `AdapterFoundation` / `ConfigContractProbe` / `defineConfigContractTests` 任何签名 / 未改 Step 10 既有错误码 / 未扩张 `pnpm.onlyBuiltDependencies`（yaml 纯 JS）/ 未触碰 Application 层 / 未定义 `definePersistentConfigContractTests`（元规则 E：若 Step 12 需要再新开）/ 未在 Application 层替换任何既有实现。详见 `docs/phase8/11-config-memory-and-file-adapters.md`。
