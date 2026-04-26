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

### Step 3-19: [待后续 Step 增量填充]

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

### Step 3-19 拒绝候选

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
