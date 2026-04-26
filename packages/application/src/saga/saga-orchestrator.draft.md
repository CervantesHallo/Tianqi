# SagaOrchestrator 接口草案（Phase 9 / Step 6 第一阶段）

> **状态**：DRAFT — 等待用户审视。第二阶段实现前必须收到明确 APPROVE 回执。
> **位置**：`packages/application/src/saga/saga-orchestrator.draft.md`
> **作者**：Phase 9 / Step 6 第一阶段
> **基础事实**：docs/phase9/05-sprint-f-closure.md §B 4 项历史核查汇总
> **接口冻结后受影响 Step**：Step 7（逆序补偿）/ Step 8（超时）/ Step 9（人工介入）

## 1. 工厂签名（裁决 1：选 γ 工厂闭包）

```typescript
// packages/application/src/saga/saga-orchestrator.ts
export const createSagaOrchestrator = (
  ports: SagaOrchestratorPorts,
  options?: SagaOrchestratorOptions
): SagaOrchestrator;
```

理由：
- 与 Tianqi 全仓既有 Adapter 工厂风格一致（createInMemoryXxxStore /
  createPostgresXxxStore / createMarginEngineHttp ...）
- 工厂闭包持有 ports / options / 内部 watchdog 句柄，runSaga 只是其上的方法
- 单一函数 α 失去"长生命周期能力"（譬如未来 Step 8 watchdog 需要在工厂
  闭包内持有 timer 状态）；class β 强制 OOP，与 Tianqi 函数式倾向不符

## 2. SagaOrchestrator 接口

```typescript
export type SagaOrchestrator = {
  /**
   * 启动一个 saga 并推进到终态。每次 stepStatus 变化都 persist 到
   * SagaStateStore（裁决 2 选 A）。
   *
   * 失败处理（裁决 5 分级模式）：
   *   - state save 失败 → 致命：返回 err(SagaPortError)，saga 中止
   *   - dead letter enqueue 失败 → 降级：log + 继续
   *   - audit append 失败 → 降级：log + 继续
   *
   * 类型参数：与 SagaStep 同形态；steps 数组中所有 step 必须共享
   * compatible TInput/TOutput chain（前一 step 的 output 是后一 step 的 input）。
   * 编译期不强制（unknown 链式），运行时由调用方保证。
   */
  runSaga<TOutput>(
    invocation: SagaInvocation<unknown>,
    steps: ReadonlyArray<SagaStep<unknown, unknown, unknown>>
  ): Promise<Result<SagaResult<TOutput>, SagaPortError>>;
};
```

**说明**：
- 不暴露 `pause / resume / abort` 方法（Phase 9 不实现这些控制接口；
  abort 通过 SagaInvocation.sagaTimeoutMs 隐式表达，由 Step 8 实施）
- 不暴露 `init / shutdown`（编排器无外部资源——所有外部资源在 ports
  里持有；shutdown 责任在 ports 各自）
- 不暴露 `compensationOrchestrator` 子对象（裁决 6：内部 forward/reverse
  路径分离为私有方法，Step 7 增强不破坏外部接口）

## 3. SagaOrchestratorOptions 字段

```typescript
export type SagaOrchestratorOptions = {
  /**
   * 单 Step 默认超时（毫秒）。每个 step.execute / step.compensate 调用
   * 用此超时包装。SagaInvocation.sagaTimeoutMs 是整体 saga 超时（Step 8
   * 增强 watchdog 实施），与本字段不叠加。
   *
   * 默认 5_000。设为 0 时 Step 8 watchdog 关闭（不推荐）。
   *
   * Step 8 衔接：本字段是 Step 8 watchdog 的"读入参数"；Step 8 不修改
   * 本字段类型，仅在 SagaOrchestrator 内部强化 watchdog 实现。
   */
  readonly defaultStepTimeoutMs?: number;

  /**
   * 调用方提供的"当前时刻"获取器。用于 enqueuedAt / processedAt 等
   * 时间戳生成。默认 () => new Date()。便于测试注入 fake clock。
   */
  readonly clock?: () => Date;

  /**
   * 调用方提供的 deadLetterId 生成器。用于死信入队时构造 entryId。
   * 默认 () => createDeadLetterId(`dlq-${Date.now()}-${counter++}`).
   * 便于测试注入确定性 id。
   */
  readonly generateDeadLetterId?: () => DeadLetterId;
};
```

**说明**：
- 默认值在工厂内部填入；options 全可选
- clock + generateDeadLetterId 让测试可控
- 未来 Step 8 可能在本类型加 `watchdogPollIntervalMs` 等字段——元规则 B
  允许新增可选字段（不修改既有字段类型 / 不删除字段）

## 4. SagaOrchestratorPorts 字段

```typescript
export type SagaOrchestratorPorts = {
  readonly sagaStateStore: SagaStateStorePort;
  readonly deadLetterStore: DeadLetterStorePort;
  readonly auditEventSink: AuditEventSinkPort;
};
```

**说明**：
- 3 个 Port 全部来自已锁定的 Step 3/4 + Phase 8 既有
- **不**包含 OrchestrationPorts（Phase 4 的 ports；本编排器与之并存）
- **不**包含 EventStorePort（裁决 3：编排器不直写 EventStore；审计走
  AuditEventSinkPort）
- **不**包含 IdempotencyPort（SagaStep 自带可选 idempotencyKey 计算器；
  编排器不在 saga 边界做幂等去重，由 Step 自己负责）

## 5. runSaga API 推进路径（状态机）

```
START
  │
  ▼
[saga.started 审计]
  │
  ▼
[persist initial state: overallStatus="in_progress", all steps pending]
  │
  ▼
┌────────────────── FORWARD PHASE ──────────────────┐
│ for i in 0..steps.length:                          │
│   [persist: step[i].status="executing"]            │
│                                                    │
│   result = step[i].execute(input, ctx)             │
│              with stepTimeoutMs watchdog           │
│                                                    │
│   if (result.ok):                                  │
│     [persist: step[i].status="succeeded"           │
│             + compensationContexts append]         │
│     [audit: saga.step.execute.outcome              │
│             (outcome="succeeded")]                 │
│     input = result.value.output                    │
│     continue                                       │
│                                                    │
│   else: // execute failed                          │
│     [persist: step[i].status="failed"              │
│             + failureReason]                       │
│     [audit: saga.step.execute.outcome              │
│             (outcome="failed", failureReason)]     │
│     break to COMPENSATION PHASE                    │
└────────────────────────────────────────────────────┘
  │
  ▼
┌────────── COMPENSATION PHASE (only on failure) ──────────┐
│ if (any prior step succeeded):                           │
│   [persist: overallStatus="compensating"]                │
│   [audit: saga.compensation.started]                     │
│                                                          │
│   for j in succeeded.length-1 .. 0:    // 严格逆序       │
│     [persist: step[j].status="compensating"]             │
│                                                          │
│     compResult = step[j].compensate(ctx, sagaContext)    │
│                    with stepTimeoutMs watchdog           │
│                                                          │
│     if (compResult.ok):                                  │
│       [persist: step[j].status="compensated"]            │
│       [audit: saga.step.compensate.outcome               │
│               (outcome="succeeded")]                     │
│     else:                                                │
│       [persist: step[j].status="dead_lettered" + reason] │
│       [audit: saga.step.compensate.outcome               │
│               (outcome="failed", failureReason)]         │
│                                                          │
│       deadLetterEntry = build entry from step[j] + ctx   │
│       deadLetterStore.enqueue(deadLetterEntry)           │
│         on failure → log degradation, continue           │
│       [audit: saga.dead_letter.enqueued]                 │
└──────────────────────────────────────────────────────────┘
  │
  ▼
[Compute final SagaResultStatus:
   - all forward succeeded     → "completed"
   - failure + all compensated → "compensated"
   - failure + any dead_lettered → "partially_compensated"
   - (Step 8 will route timed_out path through saga.timed_out audit
      event type—event type already declared in §7 for forward
      compatibility; Step 6 not actually emitting it)]
  │
  ▼
[persist final state with overallStatus]
  │
  ▼
[audit: saga.completed]
  │
  ▼
return ok(SagaResult)
```

**Step 7 钩子预留**：COMPENSATION PHASE 在编排器内部分离为私有方法
`runCompensationPhase(succeededStack, sagaContext)`。Step 7 增强补偿幂等
保证（譬如基于 idempotencyKey 的去重 / 已 dead_lettered 的 step 不重复
入队）时仅扩展该私有方法，不破坏外部接口。

**Step 8 钩子预留**：每个 `step.execute / step.compensate` 调用都通过
私有 `withStepTimeout(task, stepName)` 包装，内部用 setTimeout/Promise.race。
Step 8 增强为真正的 watchdog（譬如 sagaTimeoutMs 整体超时取消所有 in-flight
step）时仅扩展该私有方法，不破坏外部接口。

**Step 9 钩子预留**：编排器只把死信"入队"（DeadLetterStore.enqueue），
**不**监听"已处理"。Step 9 通过 DeadLetterStorePort.markAsProcessed +
AuditEventSinkPort.append 独立实现 manual intervention API。本 Step 6
编排器接口对 Step 9 透明——Step 9 不需要修改本编排器接口。

## 6. 与 SagaStateStore 集成（裁决 2 落实：每次 stepStatus 变化都 persist）

每次 `persist(...)` 实际是 `sagaStateStore.save(state)` 调用。state 由
编排器内部维护并按需快照：

```typescript
type InternalSagaState = {
  sagaId: SagaId;
  sagaStartedAt: string;
  lastUpdatedAt: string;
  currentStepIndex: number;
  totalSteps: number;
  stepStatuses: SagaStepStatusSnapshot[];
  compensationContexts: PersistedCompensationEntry[];
  overallStatus: PersistedSagaStateOverallStatus;
  correlationId: CorrelationId | null;
  traceId: TraceId | null;
};
```

字段映射（InternalSagaState → PersistedSagaState）：1:1。InternalSagaState
**就是** PersistedSagaState 的可变副本。每次 persist 拷贝为不可变快照后
调用 save。

**persist 触发点**（共 6 类）：
1. saga 启动时（initial state）
2. step.execute 启动前（status: pending → executing）
3. step.execute 完成后（status: executing → succeeded / failed）
4. compensate 启动前（status: succeeded → compensating）
5. compensate 完成后（status: compensating → compensated / dead_lettered）
6. saga 完成时（最终 overallStatus）

**save 失败处理**（裁决 5 致命级）：
- save 返回 err(...) → 编排器立即返回 `err(SagaPortError code=TQ-SAG-002
  message="saga state persistence failed")` 终止 saga
- 不重试（重试是调用方策略，不是编排器责任）
- 不绕过 save 继续推进（崩溃恢复完整性优先级 > saga 推进）

## 7. 审计事件触发点（裁决 3 修订版落实：7 类，含 Step 8 预留）

7 类审计事件（修订理由：审计事件类型是领域事件分类，自带语义优于
payload 字段过滤；execute / compensate 阶段在事件类型层面应分离；为
Step 8 整体超时预留 `saga.timed_out` 事件类型，避免 Step 8 时被迫扩
展事件命名空间）：

| # | eventType | 触发点 | payload 关键字段 | 本 Step 是否实际触发 |
|---|---|---|---|---|
| 1 | `saga.started` | saga 启动初始化后 | sagaId / totalSteps / sagaStartedAt | ✅ |
| 2 | `saga.step.execute.outcome` | 每 step.execute 完成（成功 / 失败） | sagaId / stepName / stepIndex / outcome("succeeded"/"failed") / failureReason? | ✅ |
| 3 | `saga.compensation.started` | 进入 COMPENSATION PHASE 时 | sagaId / failedStepName / succeededStepNames | ✅ |
| 4 | `saga.step.compensate.outcome` | 每 step.compensate 完成（成功 / 失败） | sagaId / stepName / stepIndex / outcome("succeeded"/"failed") / failureReason? | ✅ |
| 5 | `saga.dead_letter.enqueued` | 死信入队成功后 | sagaId / stepName / deadLetterEntryId / failureChain | ✅ |
| 6 | `saga.completed` | saga 终态后（completed / compensated / partially_compensated） | sagaId / overallStatus / completedAt / stepStatuses summary | ✅ |
| 7 | `saga.timed_out` | **Step 8 整体超时触发；本 Step 仅声明事件类型不触发** | sagaId / sagaTimeoutMs / lastObservedStep / lastObservedStatus | ⚠️ 仅声明（Step 8 触发） |

**为什么 7 类**（修订理由汇总）：
- **execute / compensate 阶段在事件类型层面分离**：让运维 / 审计可按事
  件类型分组查询（譬如"按时间筛选所有 execute 失败"），不需要在 payload
  里过滤 `phase` 字段
- **saga.timed_out 预留**：本 Step 6 声明事件类型空间但不发射；Step 8
  实施整体超时（sagaTimeoutMs watchdog）时**仅触发已声明的事件类型**，
  不需要扩展事件命名空间——这是元规则 B 在审计层级的具体表达

每个事件 traceId 取自 SagaContext.traceId（来自 SagaInvocation）。事件
类型字符串严格使用上表格式（小写 + 点号分隔的层级路径）。

**append 失败处理**（裁决 5 降级级）：
- append 返回 err(...) → console.warn 记录降级日志 + 继续推进
- 不重试 / 不影响 saga state / 不影响 saga 推进结果
- 长期：通过 Phase 10+ reconcile 工具扫描 SagaStateStore 与 EventStore
  不一致并补发审计事件

**事件类型命名空间稳定性**（元规则 B 在审计层级）：
本 Step 锁定 7 个事件类型字符串（saga.started / saga.step.execute.outcome
/ saga.compensation.started / saga.step.compensate.outcome /
saga.dead_letter.enqueued / saga.completed / saga.timed_out）。后续
Step 7-9 / Phase 10+ 若需要新事件类型必须经 ADR-0002 修订流程；既有 7
类的 eventType 字符串永久冻结。

## 8. 与 Phase 4 OrchestrationSagaState 边界（裁决 4：选 α 完全独立）

本 SagaOrchestrator **完全独立新建**，不引用 Phase 4 任何代码：

| 维度 | Phase 4 SagaStatus / OrchestrationSagaState | Phase 9 SagaOrchestrator |
|---|---|---|
| 用途 | 风险案件编排骨架（risk-case / liquidation-case）的内部状态机 | 通用 Saga 编排（任何业务 Saga 都可消费） |
| 持久化 | 无（纯内存值对象） | SagaStateStore.save 每次 stepStatus 变化 |
| 编排算法 | `let saga = createSagaState(...); saga = advanceSaga(...)` 串联 | 工厂闭包内部 forward/reverse 路径 |
| 失败处理 | sagaStatus="compensation_required" 标记后停止 | 真正调用 compensate；失败入死信 |
| 审计 | 通过 OrchestrationPorts.audit.publishAuditEvent（同步 Result） | 通过 AuditEventSinkPort.append（异步 Promise<Result>） |
| 与 EventStore 关系 | Phase 4 编排器分别调用 audit + 业务计算 | 仅调用 AuditEventSinkPort |
| 类型 | SagaStatus 5 值（混合 step + saga 两层） | SagaResultStatus 4 值（saga 整体）+ SagaStepStatus 8 值（单 step） |

**共存策略**：
- Phase 4 既有 risk-case-orchestrator / liquidation-case-orchestrator 继续
  用 Phase 4 SagaStatus 与 OrchestrationPorts，无任何改动
- Step 6 SagaOrchestrator 服务于 Step 10-13 业务 Saga（Liquidation /
  ADL / InsuranceFund / StateTransition / 跨 Saga 协调）
- 未来若 Phase 9+ 决定把 risk-case-orchestrator 等"重写为基于
  SagaOrchestrator + SagaStep"，由 ADR-0002 修订流程决定（不在 Step 6
  范围；本 Step 不预先草拟此迁移）

## 9. 错误恢复策略（裁决 5 分级模式落实）

| 数据流 | 失败时级别 | 处理 |
|---|---|---|
| `sagaStateStore.save` | **致命** | runSaga 立即 `err(SagaPortError code=TQ-SAG-002 message="state persistence failed")`，saga 中止 |
| `step.execute` 业务失败 | 业务层（不是基础设施失败） | 触发 COMPENSATION PHASE（正常 saga 流程） |
| `step.execute` 超时（withStepTimeout） | 业务层 | 同上，failureReason 包含 "step exceeded timeout budget"；触发补偿 |
| `step.compensate` 失败 | 业务层 | 该 step 标记 dead_lettered + DeadLetterStore.enqueue |
| `deadLetterStore.enqueue` | **降级** | console.warn + saga 继续；overallStatus 仍可达到 "partially_compensated"（本 step 在 stepStatus 已是 dead_lettered） |
| `auditEventSink.append` | **降级** | console.warn + 不影响任何后续推进 |

**为什么不更激进**：编排器不在 step 业务失败时重试 step；不在 enqueue
失败时回滚 stepStatus；不在 audit 失败时重发。这些都是调用方 / Phase
10+ reconcile 工具职责。编排器只负责"按顺序、按状态机、按裁决推进+持
久化+审计"。

## 10. Step 7 / 8 / 9 接口预留（裁决 6 落实）

| Step | 主题 | 本 Step 预留钩子 | Step 实施时不破坏的元规则 B |
|---|---|---|---|
| Step 7 | 逆序补偿引擎 + 补偿幂等保证 | 编排器内部 `runCompensationPhase(succeeded, ctx)` 私有方法；外部接口仅暴露 runSaga | Step 7 仅扩展 runCompensationPhase 内部逻辑（譬如基于 idempotencyKey 的去重），不修改 SagaOrchestrator / SagaOrchestratorPorts / SagaOrchestratorOptions / runSaga 签名 |
| Step 8 | 超时机制（单 Step + 整体） | 编排器内部 `withStepTimeout(task, stepName)` 包装；SagaOrchestratorOptions.defaultStepTimeoutMs 字段 | Step 8 仅扩展 withStepTimeout 实现 + 在 SagaOrchestratorOptions 加可选字段（譬如 watchdogPollIntervalMs）；不修改既有签名 |
| Step 9 | 人工介入接口 | 不在 SagaOrchestrator 接口暴露；Step 9 通过共享 DeadLetterStorePort 实现独立 manual intervention API | Step 9 不修改本 Step 任何接口；编排器对 Step 9 透明 |

**关键**：3 个钩子都是**内部私有方法 + Options 可选字段**形式，从而：
- 元规则 B 兼容（既有签名不改）
- Step 7-9 实施空间充裕（增强而非重构）

## 11. 测试策略（裁决 7 落实）

### 11.1 单元测试 ≤10（业务 Engine 风格）

`saga-orchestrator.test.ts`：

1. test_factory_returns_orchestrator_with_runSaga_method
2. test_runSaga_with_zero_steps_returns_completed_immediately
3. test_runSaga_with_all_succeeding_steps_persists_intermediate_state_for_each_step（每 step 验 sagaStateStore.save 调用次数）
4. test_runSaga_with_failing_step_triggers_compensation_in_strict_reverse_order
5. test_runSaga_with_compensation_failure_enqueues_dead_letter_and_marks_status
6. test_runSaga_with_persistence_save_failure_returns_TQ_SAG_002_immediately（致命级）
7. test_runSaga_with_dead_letter_enqueue_failure_logs_warning_but_continues（降级级）
8. test_runSaga_with_audit_append_failure_logs_warning_but_continues（降级级）
9. test_runSaga_emits_correct_audit_event_types_at_each_phase（5 类事件触发点验证）
10. test_runSaga_passes_compensationContext_unchanged_from_execute_to_compensate

8-10 个 it。具体收紧到 8 还是 10 由实施时决定。

### 11.2 契约挂载（Step 2 defineSagaContractTests）

`saga-orchestrator.contract.test.ts`：一行挂载：

```typescript
defineSagaContractTests(
  "saga-orchestrator",
  () => createSagaOrchestratorContractSubject(/* fresh recorder */)
);
```

`createSagaOrchestratorContractSubject` 是**本测试文件内部 wrapper**
（约 200 LOC），把 SagaOrchestrator 包装成 SagaContractSubject 形状：
- 提供 6 个 step 工厂（与 fixtures/reference-saga.ts 同行为，本地复制；
  不 import fixtures，元规则 F）
- 提供 recorder + probe（同上，本地复制）
- `drive` 函数内部调用真正的 SagaOrchestrator.runSaga + in-memory
  sagaStateStore + in-memory deadLetterStore + in-memory auditEventSink
- 让 17 个 Sprint F 契约 it 在真实 SagaOrchestrator 上运行

**关键**：本 wrapper 不暴露给生产代码（仅 .contract.test.ts 文件内）；
**证明编排器驱动 SagaStep 时仍满足 Sprint F 17 契约 it**——这是本 Step
对 Step 2 契约可重用性的关键证明。

## 12. 与 Sprint F 4 项历史核查的关系

| 核查 | 本草案如何处理 |
|---|---|
| B.1 Phase 4 SagaStatus 状态机骨架 | 第 8 节明示完全独立新建（裁决 4 选 α）；不引用 Phase 4 任何代码；不"统一"两套类型；未来迁移走 ADR-0002 修订流程 |
| B.2 Phase 4 OrchestrationSagaState 零持久化 | 第 6 节明示每次 stepStatus 变化都 persist；InternalSagaState 直接映射 PersistedSagaState；与 Phase 4 OrchestrationSagaState 无类型耦合 |
| B.3 SQLite 不需要 | 本 Step 编排器**不**直接接触存储介质——通过 SagaStateStorePort / DeadLetterStorePort 注入；Adapter 选择 memory 还是 postgres 由调用方决定（应用层 DI） |
| B.4 AuditEventSinkPort 已存在；Step 9 调用方协调审计写入 | 第 4 节 SagaOrchestratorPorts 含 auditEventSink；第 7 节 5 类审计事件触发点；编排器**不**主动调 EventStorePort（元规则 F），仅经 AuditEventSinkPort；Step 9 通过共享 DeadLetterStorePort 协调（第 10 节 Step 9 钩子预留） |

## 13. 关键裁决摘要（5-8 项）

| # | 裁决 | 理由 |
|---|---|---|
| 1 | 工厂闭包 γ | 与 Tianqi 全仓既有风格一致；持有 ports/options 闭包 |
| 2 | 每次 stepStatus 变化都 persist | 崩溃恢复完整性 |
| 3 | **7 类审计事件**（execute/compensate 在事件类型层面分离 + Step 8 timed_out 预留） | saga.started / saga.step.execute.outcome / saga.compensation.started / saga.step.compensate.outcome / saga.dead_letter.enqueued / saga.completed / saga.timed_out（**仅 saga.timed_out 本 Step 不实际触发，Step 8 触发**） |
| 4 | 与 Phase 4 完全独立（α） | 避免两套状态变换路径复杂度爆炸 |
| 5 | 错误恢复分级模式 | state save 致命；dead-letter / audit 降级 |
| 6 | Step 7-9 钩子预留 | 内部私有方法 + Options 可选字段，元规则 B 兼容 |
| 7 | 单元测试 ≤10 业务 Engine 风格 + 一行挂载 defineSagaContractTests | 编排器复杂度对应业务 Engine；契约挂载证明 Sprint F 契约可被真实编排器满足 |

## 14. 实现 LOC 预估

- saga-orchestrator.ts：~400-500 LOC
- saga-orchestrator.test.ts：~200-300 LOC（8-10 it）
- saga-orchestrator.contract.test.ts：~250-350 LOC（含本地 wrapper）
- 合计：~850-1150 LOC（与指令 §一 600-1200 LOC 预期一致）

## 15. 不在草案范围（明示边界）

- 不实现 Sub-saga / nested saga（未来 Phase）
- 不实现 saga 跨实例协调（多机集群 saga，Phase 11）
- 不实现 saga 启动后的运行时监控 API（譬如 listRunning）
- 不实现 saga.pause/resume/abort（不在 Phase 9 范围）
- 不预定义 saga 完成后的清理 / 归档机制（Phase 10+）
