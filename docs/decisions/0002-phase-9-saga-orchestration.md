# ADR-0002: Phase 9 Saga 编排架构

## Status

In Progress (Phase 9 ongoing, started 2026-04-26)

> **本 ADR 是增量追写**（惯例 M 首次实战）。每个 Phase 9 Step 完成时，向
> §Decision 段下的对应小节追加该 Step 的关键裁决摘要；其他段落（Context /
> Consequences / Alternatives Considered / References）按需扩充。
>
> Phase 9 收官（Step 19）只需"定稿"（把 Status 改为 Accepted、补全
> Consequences 段），而非"撰写"。这是 Phase 8 收官时一次性写完 ADR-0001
> 的反思——单次集中写作容易遗漏中间裁决细节，增量留痕反而更稳。

## Context

Phase 1-7 把 Tianqi 的领域层（risk-case / liquidation-case / adl-case 三态机
+ 协同语义 + 审计）、应用层（orchestrator / saga 骨架 / replay / observability）、
策略层（policy bundle + config 版本化）完整定型，并在 Phase 4 落地了应用层
saga 状态机骨架（`OrchestrationSagaState` / `advanceSaga` / `recordStepSuccess`
/ `recordStepFailure` / `compensation_required` 标记）。但 Phase 4 saga 仅是
"骨架接住失败"——没有真正的逆序补偿编排算法、没有死信队列、没有跨外部系统
的多步动作管理。

Phase 8 把所有外部系统（EventStore / Notification / Config / 5 业务 Engine）
的 Adapter 落地，让 Tianqi 第一次真正可对接基础设施。但 Phase 8 不实现任何
应用层逻辑——business saga / 业务编排被显式留给 Phase 9。

Phase 9 的使命：把《宪法》§13.3 "涉及外部系统多步动作时使用应用层 saga
管理" 与《Tianqi Phase 8–12 架构与代码规范补充文档》§4 Saga 补偿约束（8 条
强约束）从概念落到可执行代码。

§4 八条强约束（本 ADR 全程对照）：
- §4.1：execute 必须幂等
- §4.2：compensate 必须幂等
- §4.3：execute 与 compensate 必须配对
- §4.4：补偿不依赖进程内存（compensationContext 可序列化）
- §4.5：补偿失败必须入死信队列
- §4.6：失败时按 succeeded 反向逆序补偿
- §4.7：每个 Step 必须有审计入存
- §4.8（关键升级）：领域层不得依赖任何 Port，Phase 9 起编译期硬约束

Phase 9 全景：19 Step 跨 Sprint F-I：
- Sprint F (1-5)：Saga 类型契约 → 契约套件 → 状态存储 → 死信队列 → ...
- Sprint G (6-9)：SagaOrchestrator → 逆序补偿 → 超时 → 人工介入
- Sprint H (10-14)：5 业务 Saga 落地（Liquidation / ADL / InsuranceFund / StateTransition / 跨 Saga 协调）
- Sprint I (15-19)：§4.8 编译期硬约束 → 集成测试 → 覆盖率 → ADR 定稿 → Phase 9 CLOSED

## Decision

### Step 1: SagaPort 与 SagaStep 接口契约（2026-04-26）

#### 核心裁决

**裁决 1（SagaStep 接口形状）：选 α（interface）**

候选 α/β/γ：interface / function-object / abstract class。选 α。
- 与 Phase 8 既有 `EventStorePort` / `MarginEnginePort` 等 *Port 风格一致
- TypeScript 结构类型让调用方既可用 class 实现也可用对象字面量构造
- 与 Phase 4 既存 `OrchestrationPorts` 形状学习曲线无缝衔接
- β（function 对象）会失去 `readonly name` / `readonly idempotencyKey?` 等
  自然属性表达能力；γ（abstract class）会强加继承约束，破坏结构类型自由度

**裁决 2（SagaPort 类型定位）：选 B（类型契约而非运行 Port）**

候选 A/B：含 runSaga 运行方法 / 仅承载类型。选 B。
- 编排算法是"应用层职责"（《§13.3》），不是端口职责
- Port 是接口稳定的对外契约；编排算法是实现细节，留给应用层
- B 让 Step 6 SagaOrchestrator 落在 application 层成为自然选择
- A 会让 Port 承担实现负担，违反单职责原则
- 实施：`packages/ports/src/saga-port.ts` 不导出 `SagaPort` 接口；导出
  `SagaStep` / `SagaContext` / `SagaResult` 等类型族；运行能力 Step 6 起补

**裁决 3（补偿信息承载机制）：选 X（execute 显式返回 compensationContext）**

候选 X/Y/Z：显式分离 / 共享 SagaContext / output 即 input。选 X。
- 编译期类型层面强制 Step 声明"补偿需要什么信息"
- 隔离 execute 的业务输出与补偿用上下文（两者用途不同）
- 补偿上下文显式可序列化（《§4.4》"不依赖进程内存"对齐）
- Y 的"共享 SagaContext 让 Step 自己往里写"语义模糊，难以静态校验
- Z 的"output 即补偿输入"假设过强（不是所有 output 字段都对补偿有用）
- 实施：`SagaStepExecution<TOutput, TCompensationContext>` 信封类型

**裁决 4（SagaStepStatus 枚举完整性）：选 M（一次性定义完整 8 值）**

候选 M/N/O：完整 / 仅前向 / 完全不定义。选 M。
- 元规则 B（签名兼容）禁止 Step 7 / 4 改既有枚举值
- 一次性定义齐全，后续 Step 只填行为不动签名
- 8 值覆盖：pending / executing / succeeded / failed / compensating / compensated
  / compensation_failed / dead_lettered（含死信终态标识但不含死信内容结构——
  内容结构是 Step 4 职责）
- 每个值的进入/退出条件在 `saga-port.ts` JSDoc 与 `docs/phase9/01` 列表化

**命名冲突避让：SagaResultStatus（≠ Phase 4 SagaStatus）**

Phase 4 应用层既有 `SagaStatus`（值集 "started" | "in_progress" | "completed"
| "failed" | "compensation_required"），混合 step 与 saga 两层语义且已冻结。
Phase 9 新引入 saga 整体结果类型时，故意改名 `SagaResultStatus`（值集
"completed" | "compensated" | "partially_compensated" | "timed_out"）以避免
TypeScript import 冲突，同时让两层语义清晰可读：
- `import type { SagaStatus } from "@tianqi/application"` → Phase 4 中间态
- `import type { SagaResultStatus } from "@tianqi/ports"` → Phase 9 整体结果

#### 错误码（惯例 K）

新增最小集 2 条（接口契约层面必需）：
- `TQ-SAG-002 SAGA_STEP_EXECUTION_FAILED`：execute 失败的通用包装（业务逻辑 / 下游不可用 / 校验失败）
- `TQ-SAG-003 SAGA_STEP_COMPENSATION_FAILED`：compensate 失败 → 触发死信队列入队（《§4.5》）

既存 `TQ-SAG-001 SAGA_STEP_TIMEOUT`（Phase 1-7 留下）保持不变。后续 Step
按需扩展（Step 4 死信队列、Step 6 编排器、Step 7 补偿编排）。

#### 元规则与惯例（首次实战）

- **元规则 Q（Phase 9 起强制开局动作）**：每 Phase 9 Step 必须重读《宪法》
  + 《补充文档》、核查 KNOWN-ISSUES.md、核查 ADR-0001（含 Phase 9 增量更
  新）。Step 1 是首次实战，三动作均已执行并在 `docs/phase9/01` §F 留痕。
- **惯例 M（ADR 增量追写）**：本文件即首次实战；Step 1 完成时创建占位框架
  + 填入 Step 1 段；后续每 Step 完成时增量追加。

#### Phase 8 元规则触发情况

- 元规则 A（既有事实胜出）：N/A（本 Step 不引入"应有但实际不存在"的契约）
- 元规则 B（签名兼容）：触发 — `SagaStatus` 已被 Phase 4 占用，新增类型改名
  `SagaResultStatus` 避让；既有 `SagaErrorCode` 类型槽位与 `errors/sag.ts`
  既有工厂均一字未改
- 元规则 G（第三方依赖）：N/A（本 Step 零新依赖）
- 元规则 K/L（错误码 / Adapter 测试）：N/A（本 Step 无 Adapter）
- 其他 C/D/E/F/H/I/J/M/N/O/P：N/A（本 Step 是 Port 层类型契约，与 Adapter 层
  规则不交集）

### Step 2: defineSagaContractTests 5 类 17 it（2026-04-26）

#### 核心裁决

**裁决 1（契约对象）：选 α（SagaStep 接口实现集合）**

候选 α/β/γ：SagaStep 实现集 / Orchestrator 实现 / 双层契约。选 α。
- Step 1 锁定的是 SagaStep 接口，不是 Orchestrator——契约对象与 Step 1
  锁定对象保持一致
- SagaOrchestrator 在 Step 6 才落地；选 β 会强制本 Step 提前定义其接口，
  违反元规则 B
- 选 γ（双层）违反"克制 > 堆砌"
- 与 Phase 8 模式一致：EventStore 契约挂载对象是 EventStorePort 实现

**裁决 2（覆盖范围）：选 X（仅 5 条接口纯度约束）**

候选 X/Y：仅纯接口约束 / 全 8 条。选 X。覆盖：
- §4.1 补偿义务（含 read-only Step 显式空体）
- §4.2 补偿幂等性
- §4.3 + §4.6 逆序补偿（严格、不跳过）
- §4.4 补偿信息承载（运行时 JSON 序列化校验）
- §4.7 单 Step 超时（harness 侧管理）

**不**覆盖（留 Step 3-15 落地）：§4.5 持久化（Step 3）/ §4.5+§4.6 死信入
队（Step 4）/ §4.8 编译期硬约束（Step 15）。理由：每条都是 Adapter 行为
或工程约束，强行塞入 Step 2 会要求提前定义后续 Step 的 Port，违反元规则 B。

**裁决 3（it 类别组织）：5 类别 1:1 对应 5 条约束，17 it（精确符合下限）**

| 类别 | 对应条款 | 下限 | 实际 |
|---|---|---|---|
| 1 补偿义务 | §4.1 + §4.3 | ≥3 | 3 |
| 2 补偿幂等性 | §4.2 | ≥3 | 3 |
| 3 逆序补偿 | §4.3 + §4.6 | ≥4 | 4 |
| 4 补偿信息承载 | §4.4 | ≥4 | 4 |
| 5 单 Step 超时 | §4.7 | ≥3 | 3 |
| 合计 | | ≥17 | **17** |

每 it 命名遵循三段式（前置条件 / 动作 / 期望结果，《宪法》§20.3）。

**裁决 4（参考实现形态）：选 B（SagaStep 工厂集 + drive 驱动函数）**

候选 A/B：纯工厂集 / 工厂集 + driver。选 B。
- A 让每个 it 自己组装 saga 重复度高
- drive 仅供 testkit 自测使用，**不导出到 src/index.ts**
- 不污染产品 Orchestrator 设计空间——drive 是契约 harness，不是 Step 6
  的 SagaOrchestrator
- harness 实现刻意保持小（单一职责：驱动 SagaStep 数组完成 execute → 失
  败后逆序 compensate 的契约验证），不实现持久化/死信/整体超时

**裁决 5（单 Step 超时机制）：选 Q（harness 侧管理）**

候选 P/Q/R：Step 接口加 timeoutMs / harness 管理 / Step.execute 接受
AbortSignal。选 Q。
- 不破坏 Step 1 锁定接口（元规则 B 第一原则）
- 超时本就是 Orchestrator 责任，不是 Step 内部责任
- P 与 R 都违反元规则 B（改 Step 1 接口签名）
- 已知限制：超时后 task 不被 abort（GC 友好但生产场景下需 Step 6 另起设
  计；ADR-0002 修订流程）

#### SagaContractProbe 引入决定

引入。4 read 方法：
- `getExecuteSequence()` —— execute 实际顺序
- `getCompensationSequence()` —— compensate 首次调用顺序
- `getCompensationCallCount(name)` —— 同一 step 调用次数
- `getCompensateContextPayload(name)` —— compensate 实际收到的 ctx

加 `__sagaContractProbe: true` 品牌字段防误用为运行 Port。所有方法严格只
读（元规则 M）。

理由：Step 1 的 SagaResult.stepStatuses 只承载终态，不承载执行顺序 / 调
用次数 / 实际收到的 ctx——这些是契约语义验证的必要观察量。

#### Phase 4 SagaStatus 实地核查（强制开局动作 4 第二次实战）

详见 `docs/phase9/02-saga-contract-tests.md` §C.0。结论：
- Phase 4 SagaStatus 是**完整的状态机骨架**（含 OrchestrationSagaState +
  createSagaState/advanceSaga/recordStepSuccess/recordStepFailure/completeSaga
  函数族 + canResumeSaga/prepareSagaForResume 恢复模块）
- **不**是真正的补偿编排器——`compensation_required` 仅是"待补偿"标记，
  无实际 compensate 函数被调用；不持久化、不死信、不超时
- 与 Phase 9 SagaResultStatus / SagaStepStatus **不冲突**——是不同抽象
  层级表达相同语义的两套类型
- 对 Step 6 SagaOrchestrator 起草的关键输入：Step 6 应**新建**模块、使用
  Phase 9 类型、与 Phase 4 共存（不"统一"），未来若需统一通过 ADR-0002 修订流程

#### 触发的元规则

- 元规则 B：严守（Step 1 锁定签名一字未改；新增 SagaContractProbe /
  SagaContractSubject / SagaContractFactory 是 Step 2 引入的新签名，
  一旦发布同样冻结）
- 元规则 F：强护栏（fixtures/reference-saga.ts 不通过 src/index.ts 导出）
- 元规则 M（probe 模式）：第六次实战
- 元规则 Q（Phase 9 强制开局）：第二次实战（含开局动作 4）
- 惯例 M（ADR 增量追写）：第二次实战（本段即是）

### Step 3: SagaStateStorePort + memory/postgres 双 Adapter（2026-04-26）

#### 强制开局动作 4 / 5 核查结论

**动作 4（Phase 4 OrchestrationSagaState 持久化现状）**：Phase 4
`OrchestrationSagaState` 是**纯内存值对象**，无任何持久化机制。`canResumeSaga`
/ `prepareSagaForResume` 只接受参数不加载历史；编排函数完成后状态丢失。
本 Step 引入的 SagaStateStorePort 与 Phase 4 完全不冲突——Phase 9 引入的
是真正的"跨进程持久化"能力，Phase 4 是"单次内存编排"。

**动作 5（SQLite 必要性）**：核查发现 `event-store-sqlite` 在 Tianqi 全
仓只在 `event-store-adapter-swap.integration.test.ts` 的 swap-test 中作
为"中间层"消费，无 application 业务消费方。Saga 状态持久化没有"单机但
需崩溃恢复"的合法场景。**坚持双 Adapter（不引入 SQLite）**，未来若需
SQLite 由 Phase 11 部署模型 ADR 决定。

#### 核心裁决

**裁决 1（SagaStateStorePort 接口形状）：4 方法**

`save / load / listIncomplete / delete`。仅承载《§4.5》恢复语义；不预设
运维查询便利方法（如 `query` / `queryByCorrelationId` / `pruneCompleted`）——
运维 Port 留 Phase 10+ 由 ADR-0002 修订流程引入。

**裁决 2（PersistedSagaState 字段集）：10 字段**

必含 8（sagaId / sagaStartedAt / lastUpdatedAt / currentStepIndex /
totalSteps / stepStatuses / compensationContexts / overallStatus）+ 可选 2
（correlationId / traceId）。**不含** `initialInput`：SagaInvocation 是 saga
启动前置载荷，应由 Application 层独立持久化（命令存储），不与 Saga 状态
混存；大对象会让 saga_state 表行很大；隐私敏感字段单独走脱敏管道。

**`PersistedSagaStateOverallStatus`（6 值）与 `SagaResultStatus`（4 值）
不复用**：前者是"任何时刻的运行时快照"含过渡态（in_progress / compensating），
后者是"saga 结束时的最终结果"。元规则 B：6 值一次性定义齐全。

**裁决 3（Saga 状态 vs EventStore 关系）：选 β**

候选 α/β/γ：双写 / 只写状态由编排器写审计 / 内部变更日志。选 β。
- α 强制双写需要 1PC/2PC，复杂度极高
- γ 让 SagaStateStore 越权承担审计职责
- β 让两 Port 各管各的：状态服务编排器，事件服务审计/回放
- 两次写之间的不一致由编排器（Step 6）以"先写状态再发审计事件，审计失败
  不回滚状态但记录降级日志"承担

**裁决 4（持久化契约独立函数）：定义 `definePersistentSagaStateStoreContractTests`**

类比 Phase 8 元规则 E。8 it 跨 3 类别：P1 进程恢复（3）/ P2 跨实例可见性
（3）/ P3 并发 save 语义（2）。memory Adapter **不**挂载本套件——其语义
由设计上不持久化。

**裁决 5（SagaStateStoreContractProbe）：不引入**

save/load/listIncomplete 接口本身已足够支撑契约断言（克制 > 堆砌）。后续
Step 6 SagaOrchestrator 若需 telemetry probe，应在自己的 ADR 段提出。

#### Schema 设计：单表 + JSONB

`saga_state` 单表 10 列；`step_statuses` 与 `compensation_contexts` 用
JSONB（变长数组天然适合）。部分索引仅覆盖 `overall_status IN ('in_progress',
'compensating')` 的行（让索引体积保持小）。schema_version 单行表 CHECK (id=1)
与 event-store-postgres 同模式。

不引入双表分离（saga_state + saga_compensation_contexts）：JSONB 数组的
有序性已可保证逆序补偿；双表会引入 JOIN 与额外索引维护成本。

#### 错误码新增

3 条新增（惯例 K"仅必需"）：
- TQ-INF-019 SAGA_STATE_STORE_NOT_INITIALIZED
- TQ-INF-020 SAGA_STATE_STORE_ALREADY_SHUT_DOWN
- TQ-INF-021 SAGA_STATE_STORE_SCHEMA_VERSION_MISMATCH（postgres 模式版本不匹配）

复用既有：
- TQ-INF-002 ADAPTER_INITIALIZATION_FAILED（schema 名格式不合法）
- TQ-INF-009 POSTGRES_UNREACHABLE（pg 连接失败时复用 Phase 8 既有码）

每条新增码独立运维 runbook：019/020 与 EventStore 既有 003/004 形态相同
但 runbook 不同（Saga 状态 vs 事件审计）；021 与 SQLite 既有 008 schema
不匹配各自独立（Saga schema 演进路径与 SQLite 文件状态完全不同的检查动
作）。inf.test.ts 新增 4 it（3 工厂 round-trip + 1 六码分离断言）。

#### 触发的元规则

- 元规则 B：严守（Step 1/2 锁定签名一字未改；新增 SagaStateStorePort /
  PersistedSagaState 类型一旦发布同样冻结）
- 元规则 E（持久化契约函数）：第二次实战
- 元规则 F：Adapter 之间零交叉 import；fixtures 不导出
- 元规则 G：N/A（pg 是 Phase 8 既注册依赖；零新依赖）
- 元规则 H（Adapter 自管 schema）：postgres adapter `init()` 内 5 步 DDL
  + schema_version 校验
- 元规则 I（healthCheck）：postgres `healthCheck` 不抛 / 独立超时（2s）/
  探测只读（SELECT 1）
- 元规则 J（测试隔离）：`TIANQI_TEST_POSTGRES_URL` 控制 skip
- 元规则 N（README Semantics 三条）：memory + postgres 各自三条
- 惯例 K（错误码命名空间扩展）：仅必需 3 条 + 4 测试
- 惯例 L 修订版基础设施 Adapter ≤6 自有测试：memory 4 / postgres 4
- 惯例 M（ADR 增量追写）：第三次实战（本段即是）
- 元规则 Q（Phase 9 强制开局）：第三次实战（含动作 4 + 动作 5 双核查）

### Step 4: DeadLetterStorePort + memory/postgres 双 Adapter（2026-04-26）

#### 强制开局动作 4 核查结论：审计事件接入路径

Tianqi 已有完整审计接入：`AuditEventSinkPort`（packages/ports/src/audit-event-sink-port.ts，
`append(event): Promise<Result<void, ...>>`）+ Phase 4 应用层
`OrchestrationPorts.audit.publishAuditEvent`。被 application 层
`command-result-query-handler.ts` / `compensation-command-handler.ts` /
`liquidation-case-orchestrator.ts` 已消费。

**判断**（同意指令预期）：审计事件发送是**调用方（Step 9 人工介入接口）
职责**，不是 DeadLetterStore Adapter 的职责。理由：
- 元规则 F（Adapter 不跨 Adapter 调用）：DeadLetterStore 不应主动调
  AuditEventSinkPort
- 单职责：死信存储与审计写入是两个独立数据流向
- §4.6 + §15.1 双重审计要求的具体落实点是 Step 9 编排器，它将同时调
  DeadLetterStore.markAsProcessed + AuditEventSinkPort.append

**对 Step 9 起草的关键输入**：
- markAsProcessed 接受 processedBy / processingNotes 字段供 Step 9 调用方写入审计
- 失败处理：状态变更成功 + 审计写入失败 → 类似 Step 3 裁决 3 β 模式
  （不回滚状态，记录降级日志）
- "双重审计"含义在 Step 9 编排器层级体现（譬如双签名 / 双授权）

#### 核心裁决

**裁决 1（DeadLetterEntry 字段集）：13 字段**

5 强制（《§4.6》）：sagaId / stepName / compensationContext / failureChain / enqueuedAt
+ 必含扩展 3：entryId（主键，调用方生成保 Adapter 纯粹）/ status（裁决 2 选 α）/ attemptCount
+ 可选扩展 5：correlationId / traceId / lastAttemptAt / processedAt / processedBy / processingNotes

**failureChain 关键约束**：是数组（承载"原因 → 中间原因 → 根本原因"链
式结构），但每环必须是领域级摘要（《§6.5》）—— **严禁原文携带** PG 错
误码 / HTTP 状态码 / 网络异常文本。

**裁决 2（"已处理"状态）：选 α（引入 status + markAsProcessed）**

引入 `DeadLetterEntryStatus = "pending" | "processed" | "archived"` 三态
枚举（一次性定义齐全；元规则 B 防止后续 Step 改值）。`archived` 终态值
预留供 Phase 10+ 引入归档转换 API，**本 Step 不实现归档转换接口**。

理由（拒绝 β / γ）：
- β（不含 status，仅靠 delete 表达"已处理"）：违反《§4.6》合规长期保留要求
- γ（仅 processedAt 字段过滤）：等同 α 但少明确状态字段，运维 dashboard 不友好

**裁决 3（DeadLetterStorePort 接口最小方法集）：5 方法**

`enqueue / load / listPending / listBySaga / markAsProcessed`。

**不**提供：
- `delete`（合规要求长期保留）
- `listByDateRange` / `listByStatus(status)`（Phase 10+ 运维 Port 责任）

**裁决 4（Saga 查询能力）：提供 listBySaga**

Step 9 人工介入接口直接受益：处理一笔死信前需要看同 Saga 的全部死信记
录决定处置策略（含已处理 / 归档的历史，用于追溯）。listBySaga 不限状态
返回所有匹配记录。

**裁决 5（持久化契约函数）：定义 definePersistentDeadLetterStoreContractTests**

类比 Step 3 + Phase 8 元规则 E（第三次实战）。8 it 跨 3 类别：
- P1 跨重启恢复（3 it）
- P2 跨实例可见性（3 it）
- P3 状态变更跨重启一致性（2 it）

memory Adapter **不**挂载本套件。

#### Schema 设计：单表 + JSONB + 双索引

`dead_letter_entries` 单表 14 列；`compensation_context` / `failure_chain` 用 JSONB。

两类索引：
- `idx_dlq_saga_id`：support listBySaga 高效查询（无 WHERE 限定）
- `idx_dlq_pending`：部分索引仅覆盖 `status='pending'` 行，按 `enqueued_at`
  排序——listPending 是最频繁运维操作；已处理 / 归档行不在索引内（节省
  存储 + 写入性能）

不引入双表分离（克制 > 堆砌）。

#### 错误码新增（惯例 K 第八次扩展）

3 条新增：
- TQ-INF-022 DEAD_LETTER_STORE_NOT_INITIALIZED
- TQ-INF-023 DEAD_LETTER_STORE_ALREADY_SHUT_DOWN
- TQ-INF-024 DEAD_LETTER_STORE_SCHEMA_VERSION_MISMATCH

复用既有：TQ-INF-002 + TQ-INF-009（pg 连接失败时复用 Phase 8 既有码）。

inf.test.ts 新增 4 it：3 工厂 round-trip + 1 九码分离断言（含
EventStore 003/004 + SQLite 008 + SagaStateStore 019/020/021 + DeadLetterStore
022/023/024 共 9 schema/lifecycle 类码两两不重）。

#### 触发的元规则

- 元规则 B：严守（Step 1/2/3 锁定签名一字未改）
- 元规则 E（持久化契约函数）：第三次实战
- 元规则 F：DeadLetterStore Adapter 严禁主动调用 AuditEventSinkPort 等其他 Adapter
- 元规则 G：N/A（pg 既注册）
- 元规则 H：postgres `init()` 6 步 DDL（schema + 表 + 双索引 + schema_version + seed + 校验）
- 元规则 I：postgres healthCheck 不抛 / 独立超时 / SELECT 1 只读
- 元规则 J：TIANQI_TEST_POSTGRES_URL 控 skip
- 元规则 K：错误码命名空间扩展第八次（仅必需 3 条）
- 元规则 L：基础设施 ≤6 自有测试（memory 4 / postgres 4）
- 元规则 N：README Semantics 三条 × 2
- 元规则 Q：第四次实战（含动作 4 审计事件接入路径核查）
- 惯例 M：第四次实战（本段即是）

### Step 5: Sprint F 收官检视（2026-04-26）

#### 性质与产出

性质：Sprint F 5 步收官检视。**不引入任何新 Port / Adapter / 错误码**，
只做横向核查 + 4 项历史汇总 + Sprint F COMPLETE 显式声明。

产出（仅文档与微小清理）：
- `docs/phase9/05-sprint-f-closure.md`（10 节按指令 §七 输出格式 A-J 编排）
- ADR-0002 Step 5 段（本段）+ **Sprint F 收官小结段**（下文独立小节）
- `docs/00-phase1-mapping.md` 追加 Step 5 + 🎯 Sprint F COMPLETE 标记
- saga-state-store-{memory,postgres} README 补"不实现的能力"段（4 README
  结构对齐 dead-letter-store-* 既有模式）

#### 6 项横向完整性核查结果

| 核查 | 结论 | 证据 |
|---|---|---|
| 1. 双 Adapter 工程模板一致性 | ✅ PASS（4 个持久化 Adapter 8 项结构维度 100% 同构） | docs/phase9/05 §C.1 |
| 2. 契约函数签名一致性 | ✅ PASS（5 函数三参数模式严格一致） | docs/phase9/05 §C.2 |
| 3. 错误码命名空间整洁度 | ✅ PASS（6 新增码 runbook 各自独立；三/六/九码分离断言层层叠加） | docs/phase9/05 §C.3 |
| 4. probe 模式应用 | ✅ PASS（Step 2 引入 / Step 3-4 不引入；三处留痕） | docs/phase9/05 §C.4 |
| 5. 测试与覆盖率分布 | ✅ PASS（saga-port.ts 100% / KI-P8-005 局部改善至 11.96%） | docs/phase9/05 §C.5 |
| 6. Sprint F 暴露的小问题 | ⚠️ 1 项 README 章节不一致已清理 | docs/phase9/05 §C.6 |

#### 强制开局动作 4 第 5 次实战（4 项历史核查汇总）

汇总位置：`docs/phase9/05-sprint-f-closure.md` §B（4 子节 B.1-B.4）

直接供 Step 6 SagaOrchestrator 起草引用：
- B.1 Phase 4 SagaStatus 状态机骨架现状
- B.2 Phase 4 OrchestrationSagaState 持久化现状（零持久化）
- B.3 SQLite 必要性（不需要，坚持双 Adapter）
- B.4 审计事件接入路径（AuditEventSinkPort 已存在；Step 9 调用方协调）

#### 触发的元规则

- 元规则 B：严守（Step 1-4 锁定签名一字未改）
- 元规则 F：4 个 Sprint F Adapter 零交叉 import 验证 PASS
- 元规则 N：4 README 结构对齐（清理后）
- 元规则 Q：第五次实战（含强制开局动作 4 累计 5 次触发汇总）
- 惯例 M：第五次实战（本段 + Sprint F 收官小结段同步追写）
- A / C / D / E / G / H / I / J / K / L / M(probe) / O / P：N/A
  本 Step 不构建新东西

---

## Sprint F 收官小结（Step 5 完成后）

### Sprint F 5 步实际工作回顾

- **Step 1**：SagaPort 类型契约（11 类型 + 2 brand 工厂 + 2 错误码 +
  ADR-0002 占位框架）—— Phase 9 立契约起点
- **Step 2**：defineSagaContractTests 5 类 17 it 套件 + SagaContractProbe
  4 read 方法 + reference-saga.ts testkit-only harness（**§4 接口纯度
  5 条约束**翻译为可执行规约）
- **Step 3**：SagaStateStore 双 Adapter（memory + postgres）+ 13 基础契
  约 it + 8 持久化契约 it + 3 错误码（**§4.5 状态持久化**完整落地）
- **Step 4**：DeadLetterStore 双 Adapter（memory + postgres）+ 14 基础
  契约 it + 8 持久化契约 it + 3 错误码（**§4.6 死信约束**完整落地）
- **Step 5**：Sprint F 收官检视（**本 Step**：6 项横向核查 + 4 项历史
  汇总 + Sprint F COMPLETE 显式声明）

### Sprint F 关键裁决（10 项）

1. **Step 1 / 裁决 2 (B)**：SagaPort 是**类型契约而非运行 Port**——编
   排能力由 Step 6 SagaOrchestrator 落在 application 层（保单职责）
2. **Step 1 / 裁决 4 (M)**：SagaStepStatus 一次性定义完整 8 值（避免后
   续 Step 因增删值破坏元规则 B）
3. **Step 1 命名冲突避让**：Phase 9 saga 整体结果改名 `SagaResultStatus`
   避开 Phase 4 既有 `SagaStatus`——保元规则 B + 让两层语义清晰可读
4. **Step 2 / 裁决 1 (α)**：契约对象是 SagaStep 接口实现集合而非
   Orchestrator——保 Step 1 锁定对象一致性
5. **Step 2 / 裁决 5 (Q)**：单 Step 超时由 harness 持有的 watchdog 管理，
   不修改 Step 1 锁定的 SagaStep 接口签名（保元规则 B）
6. **Step 3 / 裁决 3 (β)**：Saga 状态只写 SagaStateStore；审计事件由
   SagaOrchestrator 显式写到 EventStore——避免 1PC/2PC 复杂度
7. **Step 3 / Schema 单表 + JSONB**：克制 > 堆砌；不引入双表分离
8. **Step 3 + 4 不引入 saga-state-store-sqlite / dead-letter-store-sqlite**：
   Saga 不需要 SQLite，Phase 9 核心矛盾是补偿编排不是存储介质矩阵
9. **Step 4 / 裁决 1 (13 字段)**：DeadLetterEntry 不含 initialInput /
   retry policy—— 隐私 + 大对象 + 语义模糊三方面顾虑
10. **Step 4 强制开局动作 4 核查 + 元规则 F 严守**：审计事件写入是
    Step 9 编排器职责，不是 DeadLetterStore Adapter 职责

### 元规则 / 惯例首次实战与累计实战次数

| 规则 / 惯例 | Phase 9 首次 | Sprint F 累计实战次数 |
|---|---|---|
| **元规则 Q（Phase 9 强制开局）** | Step 1（首次） | 5 次（Step 1-5 各 1 次；含动作 4 累计 5 次） |
| **惯例 M（ADR 增量追写）** | Step 1（首次） | 5 次（每 Step 完成后追写） |
| 元规则 E（持久化契约函数） | Phase 8 第一次 | Sprint F 第二/三次（Step 3 / 4） |
| 元规则 H（Adapter 自管 schema） | Phase 8 多次 | Sprint F 第六/七次（Step 3 / 4 postgres） |
| 元规则 I（healthCheck 不抛 / 独立超时 / 只读探测） | Phase 8 多次 | Sprint F 第六/七次 |
| 元规则 J（测试 env var） | Phase 8 多次 | Sprint F 第六/七次 |
| 元规则 K（错误码命名空间扩展） | Phase 8 多次 | Sprint F 第六/七/八次（Step 1 / 3 / 4） |
| 元规则 L（基础设施 ≤6 自有测试） | Phase 8 多次 | Sprint F 第六/七/八/九次（4 个 Sprint F Adapter） |
| 元规则 N（README Semantics 三条） | Phase 8 多次 | Sprint F 4 次（4 个 Adapter） |
| **元规则 B（签名兼容）** | Phase 8 多次 | Sprint F 全程贯彻：Step 2/3/4/5 严守 Step 1 锁定签名一字未改 |
| **元规则 F（Adapter 独立）** | Phase 8 多次 | Sprint F 强护栏：4 Adapter 零交叉 import；DeadLetterStore 严禁主动调 AuditEventSinkPort |
| 元规则 M（Probe 模式） | Phase 8 多次 | Sprint F 第六次（Step 2 SagaContractProbe）；Step 3-4 选择不引入 |
| 元规则 A / C / D / G / O / P | N/A | Sprint F 全程 N/A |

### Sprint G 起草所需的全部输入

详见 `docs/phase9/05-sprint-f-closure.md` §G.2 完整清单。

**核心**：
- 4 项历史核查汇总（docs/phase9/05 §B）
- Sprint F 累计产出：3 Port + 4 Adapter + 5 契约函数 + 66 契约 it + 8 错误码
- ADR-0002 Step 1-5 段 + 本 Sprint F 收官小结段
- Phase 1-7 + Phase 8 既有冻结代码（必读，禁改）

### Sprint G 4 步主题预告（Step 6-9）

- Step 6: SagaOrchestrator 核心实现
- Step 7: 逆序补偿引擎 + 补偿幂等保证
- Step 8: 超时机制（单 Step + 整体）
- Step 9: 人工介入接口（双重审计接入）

**🎯 Phase 9 / Sprint F COMPLETE — 2026-04-26**

### Step 6-19: [待后续 Step 增量填充]

## Consequences

[本节由 Phase 9 收官时（Step 18-19）一次性总结]

待补充内容（Phase 9 收官时）：
- 整体测试增量
- 应用层 SagaOrchestrator 的最终形态
- 5 业务 Saga 的复用模板与差异
- §4.8 编译期硬约束实施方案
- Phase 9 → Phase 10 衔接

## Alternatives Considered

### 由 Step 1 拒绝的候选

**拒绝 SagaStep 函数对象式（裁决 1 候选 β）**。理由：失去 `readonly name`
等属性的自然表达；TypeScript 函数对象的 IDE 跳转体验不如 interface；与既
有 *Port 风格不一致——读者切换语境成本上升，违反"项目宗旨"第一权重（可读
性）。

**拒绝 SagaPort 含 runSaga 运行方法（裁决 2 候选 A）**。理由：违反单职责
（Port 是契约，编排是实现）；让 Port 承担状态机算法负担；未来若需切换编排
策略（譬如从顺序执行改为并行执行）会破坏 Port 签名稳定性，违反元规则 B。
拒绝 A 等于把"编排算法变化"与"接口稳定"解耦——这是六边形架构最初想要保护
的边界。

**拒绝 SagaStep compensate 接受 execute 输出本身（裁决 3 候选 Z）**。理由：
output 与补偿信息常常**不一致**——例如 `lockMargin` execute 返回 `lockId +
balanceAfter`，但补偿（`unlockMargin`）只需 `lockId`，不需要 balanceAfter。
强制 compensate 接受 output 会让"业务输出"与"补偿输入"耦合，未来 output
schema 演化将连带打破补偿语义稳定性。X（显式分离）让两者各自演化。

**拒绝 SagaStepStatus 仅前向枚举（裁决 4 候选 N）**。理由：Step 4 / 7 后续
要加 compensating / compensated / dead_lettered 等值——若分多次添加，后续
Step 都会触发元规则 B（"修改既有枚举类型"=改签名）；一次性定义完整，后续
Step 只填行为，是 Phase 9 全程都要遵守的"保守裁决"原则的具体执行。

**拒绝复用 Phase 4 SagaStatus 类型**。理由：Phase 4 类型已冻结（《§2.2》
封板纪律），值集"started/in_progress/completed/failed/compensation_required"
混合 step 与 saga 两层语义且不含 timed_out / partially_compensated 等 Phase
9 新增状态——若强行扩展会破坏 Phase 4 既有消费者。新建 `SagaResultStatus`
是更稳的选择。

### Step 2 拒绝候选

**拒绝 SagaOrchestrator 作为契约对象（裁决 1 候选 β）**。理由：Step 6
还未起草，提前定义 Orchestrator 接口违反元规则 B；契约对象与 Step 1 锁
定对象（SagaStep）保持一致更稳。

**拒绝双层契约（裁决 1 候选 γ）**。理由：在 Phase 9 内创造"双契约"复杂
度，违反"克制 > 堆砌"。Phase 8 模式（每 Port 一套契约）足够。

**拒绝一次覆盖全 8 条约束（裁决 2 候选 Y）**。理由：§4.5 / §4.6 / §4.8
是后续 Step 责任；强行塞入 Step 2 会要求提前定义 SagaStateStorePort /
DeadLetterStorePort / 编译期约束实施细节，违反元规则 B。Phase 8 已建立
"基础契约 + 持久化契约"分两 Step 落地的模式（EventStore Step 3 / 5）。

**拒绝纯工厂集（裁决 4 候选 A）**。理由：每个 it 自己组装 saga 重复度
高；harness 是 testkit 工具，不污染产品空间——优于 A。

**拒绝 Step 接口加 timeoutMs（裁决 5 候选 P）**。理由：违反元规则 B（修
改 Step 1 锁定的 SagaStep 接口签名）。超时是 Orchestrator 责任，不是 Step
内部责任。

**拒绝 execute 接受 AbortSignal（裁决 5 候选 R）**。理由：同上，违反元
规则 B。Step 6 SagaOrchestrator 若需真正取消运行中 task，应另起一套接口
扩展（譬如新增 `abortable: true` 选项；ADR-0002 修订流程）。

**拒绝在本 Step "统一" Phase 4 SagaStatus 与 Phase 9 SagaResultStatus**。
理由：Phase 4 已冻结；本 Step 仅"看清楚"两者关系，不做任何代码改动。
统一工作（如有必要）由后续 Step 通过 ADR-0002 修订流程完成。

### Step 3 拒绝候选

**拒绝引入 SagaStateStoreContractProbe（裁决 5 反方）**。理由：save/load/
listIncomplete 接口本身已足够支撑契约断言；额外 probe 仅是 Phase 8 模式
的"机械复制"，违反"克制 > 堆砌"。后续 Step 6 SagaOrchestrator 若需观察
量，应在自己的 ADR 段提出（不修改本 Step 锁定的 Port 形状）。

**拒绝双写 Saga 状态（裁决 3 候选 α）**。理由：写两次违反"克制"；强制
双写需要 1PC/2PC（XA / 2PC），引入分布式事务复杂度；两次写的不一致更应
由编排器（Step 6）以补偿/降级日志承担，而非 Port 层。

**拒绝 PersistedSagaState 含 initialInput**。理由：SagaInvocation 是 saga
启动前置载荷，应由 Application 层独立持久化（命令存储）；混存会让
saga_state 行很大，索引性能下降；隐私敏感字段单独走脱敏管道（《§15.2》）。

**拒绝引入 SagaStateStorePort.query / queryByCorrelationId / pruneCompleted**。
理由：本 Step 仅承载《§4.5》"恢复语义"，不预设运维便利方法；运维 Port
留 Phase 10+ 通过 ADR-0002 修订流程引入（避免 Port 接口被"运维便利"漂移）。

**拒绝双表分离（saga_state + saga_compensation_contexts）**。理由：JSONB
数组的有序性已可保证逆序补偿；双表会引入 JOIN 与额外索引维护成本；克制 > 堆砌。

**拒绝引入 saga-state-store-sqlite（强制开局动作 5 反方）**。理由：核查
发现 Tianqi 实际部署中没有"单机但需崩溃恢复"的合法场景；Phase 9 核心矛
盾是"补偿编排"而非"存储介质矩阵"；引入第三个 Adapter 会稀释 Phase 9 主线。
未来若 Phase 11 部署模型 ADR 决定需要，再补 ADR-0002 修订段。

**拒绝在 SagaStateStorePort.save 上加版本号实现乐观锁**。理由：本 Step
明确选 last-write-wins；乐观锁会让 SagaStateStore 越权承担"并发协调"职
责，违反单职责。并发协调由编排器（Step 6+）通过 SagaId 唯一性保证（一
个 Saga 一次性单实例推进）。

### Step 4 拒绝候选

**拒绝 DeadLetterStore Adapter 主动发审计事件**。理由：违反元规则 F
（Adapter 不跨 Adapter 调用）。审计事件写入是 Step 9 编排器职责；让
DeadLetterStore "顺手"调 AuditEventSinkPort 会让两个独立数据流向耦合，
未来要切换审计实现（譬如从 in-memory 改为 Kafka）会触发 DeadLetterStore
Adapter 改动，违反单职责。

**拒绝候选 β（不含 status，仅 delete 表达"已处理"）**。理由：违反《§4.6》
合规长期保留要求；删除后无法追溯审计；§15.1 双重审计审计追责链断裂。

**拒绝候选 γ（仅 processedAt 字段过滤）**。理由：语义等同 α 但少明确状
态字段；运维 dashboard 看不到清晰的 pending / processed / archived 三态；
未来归档（archived）需引入第二个标记字段，进一步复杂。

**拒绝引入 DeadLetterStorePort.delete**。理由：合规要求死信记录长期保留
（审计追溯）；删除等于丢失追责链；提供 delete 会诱导误用。归档语义由
未来 Phase 10+ 通过 archived 状态值 + 归档转换 API 表达，不通过 delete。

**拒绝引入 DeadLetterStorePort.listByStatus(status)**。理由：listPending
已覆盖最常用场景；其他状态（processed / archived）的列表查询是运维工具
范畴，应在 Phase 10+ 通过专用运维 Port 提供。本 Step 仅承载 Step 9 编
排器所需。

**拒绝引入 listByDateRange / pruneCompleted / archive 等运维便利方法**。
理由：克制 > 堆砌；运维查询走 Phase 10+ 工具。

**拒绝双表分离 dead_letter_entries + dead_letter_failure_chains**。理由：
JSONB 数组的有序性已可保证 failureChain 链；双表会引入 JOIN 与额外索引
维护成本（与 Step 3 同思路）。

**拒绝 DeadLetterEntry 含 input / output 业务数据字段**。理由：业务数据
往往含敏感信息（《§15.2》）+ 大对象（影响表行尺寸）；compensationContext
已是补偿所需最小信息集，重复存储 input/output 既冗余又增加隐私顾虑。

**拒绝 DeadLetterEntry 含 retry policy / next retry at 字段**。理由：死
信意味着重试已耗尽——这是死信"成立"的前提；含重试调度字段会让"是否真
的进入死信"语义模糊。

### Step 5 拒绝候选

**拒绝在 Step 5 引入新 Port / Adapter / 错误码**。理由：Step 5 性质是
"收官检视"，引入新东西违反指令"严禁引入新功能"边界。

**拒绝在 Step 5 重构 Sprint F Adapter 代码**。理由：清理范围严格限定
typo / README / lint / 注释；任何"重构"会触发元规则 B 风险。本 Step
仅修改 saga-state-store-{memory,postgres} README 补"不实现的能力"段。

**拒绝在 Step 5 修改 Phase 4 既有代码以"统一" Phase 4 SagaStatus 与 Phase 9 SagaResultStatus**。理由：Phase Gate 隔离纪律；统一工作如有
必要由 Sprint G/H 通过 ADR-0002 修订流程进行。

**拒绝在 Step 5 提前定义 SagaOrchestrator 接口（Sprint G Step 6 职责）**。
理由：本 Step 严禁触碰 Sprint G 任何内容；为 Step 6 提前布局违反 Phase
Gate 纪律。

**拒绝在 Step 5 修复非本 Step 责任的 KI**。理由：4 项 open KI 各有责任
Phase（Phase 9: KI-P8-001/003 / Phase 11: KI-P8-002）；本 Step 仅核查
状态不修复。

**拒绝在 Step 5 引入新 Sprint F 集成测试**。理由：集成测试是 Sprint I
（Step 16-17）职责；本 Step 仅做"已有测试是否全绿"的回头检查，不新增。

### Step 6-19 拒绝候选

[由后续 Step 增量记录]

## References

- 《Tianqi 项目架构与代码规范总文档》§13.3 Saga / 补偿、§7 状态机、§6.5
  错误转译纪律、§17 类型系统规范
- 《Tianqi Phase 8–12 架构与代码规范补充文档》§4 Saga 补偿约束（8 条）+ §4.8
  关键升级（领域层不得依赖任何 Port，Phase 9 起编译期硬约束）
- `docs/decisions/0001-phase-8-adapter-layer.md`（前置 ADR：14 元规则 + 2
  惯例 + 8 关键架构裁决；Phase 9 在其基础上扩展元规则 Q + 惯例 M）
- `docs/phase9/01-saga-port-contract.md`（Step 1 执行记录）
- `docs/KNOWN-ISSUES.md`（4 项 open KI 状态）
- `packages/ports/src/saga-port.ts`（本 Step 落地源码）
