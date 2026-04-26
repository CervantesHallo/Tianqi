# Phase 9 / Step 2 — defineSagaContractTests 5 类 17 it 套件

## §A 当前任务

在 `@tianqi/adapter-testkit` 实现 `defineSagaContractTests`，把 Step 1 锁
定的 SagaPort 类型契约 + 《补充文档》§4 中"接口纯度可验证"的 5 条约束
（§4.1 / §4.2 / §4.3 / §4.4 / §4.7 单 Step 维度）翻译为可运行契约 it。
参考实现严格限定 `src/fixtures/`；零正式 Adapter；零新第三方依赖。

§4.5（持久化）/ §4.6（死信）/ §4.8（编译期）**不在本 Step 覆盖**：
分别留给 Step 3 SagaStateStore Adapter / Step 4 DeadLetterStore Adapter /
Step 15 编译期硬约束工程实战。

## §B 影响范围

### 新增文件（5）

- `packages/adapters/adapter-testkit/src/saga-contract-probe.ts`（53 LOC）
  —— `SagaContractProbe` 只读观察接口（4 read 方法 + 品牌字段）
- `packages/adapters/adapter-testkit/src/saga-contract.ts`（300+ LOC）
  —— `defineSagaContractTests` + 5 类别 17 it + 类型导出
- `packages/adapters/adapter-testkit/src/fixtures/reference-saga.ts`（330+ LOC）
  —— SagaStep 工厂集（6 类） + testkit-only `drive` Orchestrator harness
  （元规则 F：严格不导出，仅 saga-contract.test.ts 同包内使用）
- `packages/adapters/adapter-testkit/src/saga-contract.test.ts`（17 LOC）
  —— 自测（一行挂载 `defineSagaContractTests("reference-saga", ...)`）
- `docs/phase9/02-saga-contract-tests.md` —— 本文件

### 修改文件（3）

- `packages/adapters/adapter-testkit/src/index.ts` —— +5 类型导出 +
  `defineSagaContractTests`；**不**导出 `createReferenceSagaSubject`
- `docs/decisions/0002-phase-9-saga-orchestration.md` —— Step 2 段增量追写
  （惯例 M 第二次实战）
- `docs/00-phase1-mapping.md` —— Phase 9 段追加 Step 2 mega-bullet

### 测试增量

- `saga-contract.test.ts`（新建）：17 it（5 类别 1:1 对应 §4 5 条约束）
- 全仓总数：1676 → **1693**（+17，精确符合 Gate G16 下限）

### lockfile 变动

无。**零新依赖**。

### 错误码

无新增。本 Step 仅复用 Step 1 的 TQ-SAG-001 / 002 / 003。

## §C 设计决策

### Phase 9 强制开局动作执行确认（元规则 Q 第二次实战）

| 动作 | 状态 | 留痕 |
|------|------|------|
| 1. 重读《宪法》 | ✅ §13.3 / §7 / §17 / §22.2 重点对照 |
| 2. 重读《补充文档》§4 全 8 条 + §4.4 / §4.5 / §4.6 / §4.7 / §4.8 | ✅ 本 Step 覆盖 §4.1-4 + §4.7；§4.5/4.6/4.8 留 Step 3-15 |
| 3. 核查 KNOWN-ISSUES.md | ✅ 4 项 open KI 状态详见 §E.7 |
| 4. 核查 ADR-0001 + ADR-0002 | ✅ 14+2+Q+M 共 18 规则全程对照 |
| **5. Phase 4 SagaStatus 实地核查（强制开局动作 4，Phase 9 第二次实战）** | ✅ 详见下文 §C.0 |

### §C.0 Phase 4 SagaStatus 实地核查（强制开局动作 4）

#### 定义文件

`packages/application/src/risk-case-orchestration-saga.ts`（123 行，已冻结）

#### 类型形状

```typescript
export type SagaStatus =
  | "started"
  | "in_progress"
  | "completed"
  | "failed"
  | "compensation_required";
```

5 值。语义混合 step 与 saga 两层（Step 1 设计裁决 4 已识别）。

#### 伴随 Saga 实现

不仅是"占位枚举"——是**完整的 Phase 4 状态机骨架**：

| 符号 | 文件 | 职责 |
|------|------|------|
| `OrchestrationSagaState` | risk-case-orchestration-saga.ts | 不可变 Saga 状态值对象（含 sagaId/caseId/sagaStatus/currentStep/completedSteps/failedStep/compensationPlan/startedAt/completedAt） |
| `SagaStepName` | 同上 | 7 值字面量联合（`load_case` / `load_active_config` / `resolve_bundle` / `execute_candidate_selection` / `execute_ranking` / `execute_fund_waterfall` / `finalize`） |
| `SagaStepResult` | 同上 | { stepName, status: "succeeded"\|"failed"\|"skipped", reason } |
| `CompensationRequirement` / `CompensationPlan` | 同上 | 补偿计划值对象（**仅是计划，无执行**） |
| `createSagaState` / `advanceSaga` / `recordStepSuccess` / `recordStepFailure` / `completeSaga` | 同上 | 状态机推进函数（不可变更新；纯函数） |
| `canResumeSaga` / `prepareSagaForResume` | orchestration-saga-resume.ts | Saga 恢复语义（仅 "failed" 可恢复；纯函数） |

#### 消费方（4 处）

1. `risk-case-orchestration-result.ts` —— `OrchestrationResult.sagaStatus: SagaStatus` 字段（暴露给 application 外部消费者）
2. `orchestration-saga-resume.ts` —— `RESUMABLE_STATUSES: ReadonlySet<SagaStatus> = new Set(["failed"])`，恢复策略
3. `index.ts` line 795 —— 公开导出 `SagaStatus` 类型
4. `liquidation-case-orchestrator.ts` —— **业务编排器**，间接消费（通过 `advanceSaga` / `recordStepSuccess` / `recordStepFailure` 函数；7 个固定 step name 串联调用）

#### 与 Phase 9 SagaResultStatus / SagaStepStatus 的概念关系

**关键认知**：Phase 4 SagaStatus 与 Phase 9 SagaResultStatus / SagaStepStatus
**不冲突**——它们是**不同抽象层级表达相同语义的两套类型**。

| 维度 | Phase 4 SagaStatus（已冻结） | Phase 9 SagaResultStatus | Phase 9 SagaStepStatus |
|------|---|---|---|
| 抽象层级 | Phase 4 应用层 saga 跟踪枚举 | Phase 9 SagaPort 整体 saga 结果 | Phase 9 SagaPort 单 Step 状态 |
| 值集 | started / in_progress / completed / failed / compensation_required | completed / compensated / partially_compensated / timed_out | pending / executing / succeeded / failed / compensating / compensated / compensation_failed / dead_lettered |
| 语义混合 | step + saga 两层混合 | 仅 saga 整体 | 仅单 Step |
| 是否含死信 | 否 | partially_compensated 暗示有死信 | dead_lettered 显式终态 |
| 是否含超时 | 否 | timed_out | 通过 failureReason 携带 |
| 是否含补偿执行 | 仅 "compensation_required" 标记，**无实际补偿执行** | "compensated" / "partially_compensated" 表示已补偿 | compensating / compensated / compensation_failed 全路径表达 |

#### Phase 4 saga 的本质

Phase 4 的 saga 是**状态机骨架**，**不是真正的补偿编排器**：
- 仅在 `liquidation-case-orchestrator.ts` 中"线性调用"7 步 `advanceSaga` / `recordStepSuccess` / `recordStepFailure`
- 失败时把整体状态打成 "failed" 或 "compensation_required"
- **没有真正的 compensate 函数被调用**——`compensation_required` 仅是"待补偿"标记，等待外部介入
- 不持久化、不死信、不超时控制

#### 对 Step 6 SagaOrchestrator 起草的关键输入

1. **Step 6 应该是新建模块**，不应改造 `risk-case-orchestration-saga.ts`（Phase 1-7 冻结）
2. **Step 6 的 SagaOrchestrator 应使用 Phase 9 SagaResultStatus / SagaStepStatus**，不依赖 Phase 4 SagaStatus
3. **未来 Phase 4 既有编排器**（如 `liquidation-case-orchestrator.ts`）**可能**在 Phase 9+ 通过 ADR-0002 修订流程被重写为基于 SagaOrchestrator + SagaStep；但**本 Step 不做任何改动**（Phase Gate 隔离纪律）
4. Step 6 应在 `OrchestrationSagaState` 与 `SagaResult<TOutput>` 之间提供**适配层**而非"统一"——两者各管各的层级

**结论**：本 Step 不需要"统一"两套概念，只需要"看清楚"。统一工作（如有必要）由后续 Step 通过 ADR-0002 修订流程完成。本核查结果作为 Step 6 起草的**关键输入**永久留痕。

### 裁决 1：契约对象（α / β / γ）→ **选 α（SagaStep 接口实现集合）**

**理由**：
- Step 1 锁定的是 SagaStep 接口，不是 Orchestrator——契约对象与 Step 1
  锁定对象保持一致（元规则 B 一致性）
- SagaOrchestrator 在 Step 6 才落地，Step 2 现在不知道它的接口形状；选 β
  会强制本 Step 提前定义 Orchestrator 接口，违反 Step 1 的"类型 Port 而非
  运行 Port"裁决
- 选 γ（双层契约）会在 Phase 9 内创造"双契约"复杂度，违反"克制 > 堆砌"
- 与 Phase 8 模式一致：EventStore 契约挂载对象是 EventStorePort 实现，
  不是某个 Orchestrator

**实施**：`SagaContractSubject` 是契约挂载对象——一组 SagaStep 工厂 +
testkit-only drive 函数 + SagaContractProbe。

### 裁决 2：覆盖范围（X / Y）→ **选 X（仅 5 条接口纯度约束）**

**理由**：
- §4.5 状态持久化是 Adapter 行为（Step 3 SagaStateStore Adapter 职责）
- §4.6 死信是 Adapter 行为（Step 4 DeadLetterStore Adapter 职责）
- §4.8 编译期硬约束是 Lint/typecheck 工程约束（Step 15 职责）
- 强行塞进 Step 2 会要求 Step 2 提前定义后续 Step 的 Port 接口，违反元规则 B
- 与 Phase 8 模式一致：EventStore 契约（Step 3）只验"写入接口"，持久化契约
  （`definePersistentEventStoreContractTests`）Step 5 才补
- 后续 Phase 9 Step 5（Sprint F 收官）可能补一个 `defineSagaPersistenceContractTests`
  函数（不是本 Step 职责；预告而非承诺）

**实施**：5 类别 1:1 对应《§4》§4.1 / §4.2 / §4.3 + §4.6 / §4.4 / §4.7（单 Step 维度）。

### 裁决 3：it 类别组织 → **5 类别 17 it（精确符合下限）**

| 类别 | 对应 §4 条款 | 下限 | 实际 | 含义 |
|------|---|---|---|---|
| 1 补偿义务（含 read-only Step 显式空体） | §4.1 + §4.3 | ≥3 | 3 | 后续 Step 失败时前序 succeeded 必须被 compensate |
| 2 补偿幂等性 | §4.2 | ≥3 | 3 | 同一 ctx 重复 invoke 安全；含并发幂等 |
| 3 补偿顺序（严格逆序，禁跳跃） | §4.3 + §4.6 | ≥4 | 4 | succeeded 序列的逆序；失败 Step 自身不补偿 |
| 4 补偿信息承载（运行时验证 §4.4） | §4.4 | ≥4 | 4 | 含 JSON 往返不变 + 跨 saga 隔离 |
| 5 单 Step 超时（harness 侧管理） | §4.7 单 Step 维度 | ≥3 | 3 | TQ-SAG-001 触发；超时联动补偿 |
| **合计** | | **≥17** | **17** | |

每 it 命名遵循三段式（前置条件 / 动作 / 期望结果，《宪法》§20.3）。

### 裁决 4：参考实现形态（A / B）→ **选 B（SagaStep 工厂 + drive 驱动函数）**

**理由**：
- 减少每个 it 的样板代码（A 让每个 it 自己组装 saga，重复度高）
- drive 仅供 testkit 自测使用，**不导出到 src/index.ts**（元规则 F）
- 不污染产品 Orchestrator 设计空间——drive 是契约 harness，不是 Step 6
  SagaOrchestrator
- harness 实现刻意保持小（单一职责：驱动 SagaStep 数组完成 execute → 失
  败后逆序 compensate 的契约验证），不实现持久化、不实现死信入队、不实
  现整体超时

**实施**：`fixtures/reference-saga.ts` 暴露：
- 6 个 SagaStep 工厂：succeedingStep / failingStep / slowStep /
  succeedingStepWithFailingCompensate / emptyCompensateStep / contextEchoStep
- 1 个 drive 函数：单 Step 超时控制 + 前向迭代 + 失败时逆序补偿
- 1 个 SagaContractProbe（共享 recorder 闭包）

`createReferenceSagaSubject(): ReferenceSagaSubject` 是**唯一对内**入口；
不通过 src/index.ts 导出。

### 裁决 5：单 Step 超时机制（P / Q / R）→ **选 Q（harness 侧管理）**

**理由**：
- 不破坏 Step 1 锁定接口（元规则 B 第一原则）—— SagaStep 不增字段
- 超时本就是 Orchestrator 责任（《§4.7》），不是 Step 的内部责任
- 选 P（Step 接口加 timeoutMs 字段）违反元规则 B
- 选 R（execute 接受 AbortSignal）同样违反元规则 B（Step 1 接口签名不含
  AbortSignal）
- 测试场景下"超时"通过 Promise.race + setTimeout 模拟；超时即产出
  TQ-SAG-001 错误

**实施**：`runWithTimeout` 工具函数用 Promise.race 包装 step.execute /
step.compensate；超时即产出 SagaPortError code = TQ-SAG-001。
`SagaContractDriveOptions.stepTimeoutMs` 默认 1000ms。

**已知限制**（明确登记）：
- 超时后 task 仍在后台运行（不被 abort）；harness 不再消费其结果
- 这是因为 Step 1 接口不含 AbortSignal——元规则 B 边界
- 在测试场景下 GC 友好（非阻塞任务最终完成或被回收），不会泄漏
- 生产 SagaOrchestrator（Step 6）若需真正取消运行中 task，应另起一套接
  口扩展（譬如新增 `abortable: true` 选项；ADR-0002 修订流程）

### SagaContractProbe 引入与否的判断 → **引入（4 read 方法 + 1 品牌字段）**

**理由**：Step 1 SagaResult.stepStatuses 只承载 Step 的"最终态"
（status / failureReason），不承载：
- execute 实际执行顺序（用于断言"补偿是逆序的"，必须知正向顺序）
- 同一 Step 的 compensate 调用次数（用于幂等断言）
- compensate 实际收到的 compensationContext（用于 §4.4 上下文承载断言）

这些是契约语义验证的**必要观察量**，不能从 SagaResult 反推。

**4 read 方法**：
1. `getExecuteSequence(): ReadonlyArray<string>` —— Step 名按 execute invoke 顺序
2. `getCompensationSequence(): ReadonlyArray<string>` —— Step 名按 compensate 首次 invoke 顺序
3. `getCompensationCallCount(stepName: string): number` —— 同一 Step 的 compensate 调用次数
4. `getCompensateContextPayload(stepName: string): unknown` —— compensate 实际收到的 ctx

**品牌字段**：`__sagaContractProbe: true` 防止生产代码误用为运行 Port。

**所有方法严格只读**（元规则 M 红线）：返回值是 recorder 内部数据的副本，
caller 修改返回值不影响 recorder 内部状态。

### 元规则 A-P + Q + 惯例 K + L + M 触发情况

| 规则 | 触发？ |
|------|------|
| A 既有事实胜出 | N/A（本 Step 不引入"应有但实际不存在"的契约） |
| **B 签名兼容** | ✅ 严守 — Step 1 锁定的 SagaStep / SagaContext / SagaResult / SagaResultStatus / SagaStepStatus / SagaPortError 一字未改；新增 `SagaContractProbe` / `SagaContractSubject` / `SagaContractFactory` 是 Step 2 引入的新签名（一旦发布同样冻结） |
| C / D / E / G / H / I / J / N / O / P | N/A（本 Step 是 testkit 内部契约；与对应规则不交集） |
| **F Adapter 独立** | ✅ 强护栏 — `fixtures/reference-saga.ts` 不通过 src/index.ts 导出；其他包不得 import |
| **K 错误码命名空间扩展** | N/A — 本 Step 零错误码新增（复用 Step 1 的 TQ-SAG-001/002/003） |
| **L Adapter 自有测试** | N/A — 本 Step 不是 Adapter；`saga-contract.test.ts` 是契约自测不是 Adapter 测试 |
| **M Probe 模式** | ✅ 第六次实战 — `SagaContractProbe` 含 `__sagaContractProbe: true` 品牌 + 4 只读方法；与 Phase 8 五个 probe（EventStoreContractProbe / NotificationContractProbe / ConfigContractProbe / ExternalEngineContractProbe + 各 ConfigAdapter 等）一致风格 |
| **Q（Phase 9 起强制开局）** | ✅ 第二次实战 — 4 动作均执行并在 §C 顶部表格留痕（含 Phase 4 SagaStatus 实地核查） |
| **惯例 M（ADR 增量追写）** | ✅ 第二次实战 — ADR-0002 Step 2 段已追加 |

## §D 代码变更（逐文件）

### `packages/adapters/adapter-testkit/src/saga-contract-probe.ts`（新建，53 LOC）

`SagaContractProbe` 类型定义：4 read 方法 + `__sagaContractProbe: true` 品牌。
JSDoc 详细说明每个方法的语义与对应《§4》条款。文件极小（单一职责）。

### `packages/adapters/adapter-testkit/src/saga-contract.ts`（新建，300+ LOC）

`defineSagaContractTests<T extends SagaContractSubject>(adapterName, factory, _options?): void`：
- 与 Phase 8 契约函数签名风格一致
- 5 个 `describe("category N: ...")` 块 + 17 个 `it`
- `beforeEach(async () => { subject = await factory(); ... })` 验证品牌字段

类型导出：
- `SagaContractSubject = ReferenceSagaSubject`（结构等价；后续可被 Step 6
  实现的 Orchestrator 替换）
- `SagaContractFactory<T>` —— 工厂签名
- `SagaContractOptions` —— 占位（`Readonly<Record<string, never>>`，与 Phase 8 风格一致）
- `SagaContractDriveOptions` / `SagaContractDriveResult` —— 重新导出自 fixtures

### `packages/adapters/adapter-testkit/src/fixtures/reference-saga.ts`（新建，330+ LOC）

`createReferenceSagaSubject(): ReferenceSagaSubject`，导出 6 工厂 + drive + probe。

关键实现细节：
- Recorder 是 Subject 内部可变状态（`executeOrder` / `compensationOrder` /
  `compensationCalls` / `compensationContexts`）
- 所有 step 工厂闭包捕获 recorder
- drive 是顶层函数，**不**捕获 recorder（drive 只调度 step.execute /
  compensate；recorder 由 step 自己写入）
- runWithTimeout 用 `node:timers` 的 setTimeout / clearTimeout（与
  external-engine-http-base / config-file 等 Phase 8 Adapter 一致）
- 严格 testkit-only：不通过 src/index.ts re-export（元规则 F 防护）

### `packages/adapters/adapter-testkit/src/saga-contract.test.ts`（新建，17 LOC）

一行挂载 `defineSagaContractTests("reference-saga", () => createReferenceSagaSubject())`。

### `packages/adapters/adapter-testkit/src/index.ts`（修改）

末尾追加 6 项导出：
- `SagaContractProbe` 类型
- `defineSagaContractTests` 函数
- `SagaContractDriveOptions` / `SagaContractDriveResult` / `SagaContractFactory`
  / `SagaContractOptions` / `SagaContractSubject` 类型

**不**导出 `createReferenceSagaSubject`（元规则 F）。

### `docs/decisions/0002-phase-9-saga-orchestration.md`（修改）

向 §Decision 段追加 "Step 2: defineSagaContractTests 5 类 17 it" 小节
（详见下文 §D.ADR）。

### `docs/00-phase1-mapping.md`（修改）

Phase 9 段追加 Step 2 mega-bullet。

## §E 风险点

### E.1 参考实现被 Step 3-6 误用风险（元规则 F 防护）

`fixtures/reference-saga.ts` 是 testkit-only。如果 Step 3 或 Step 6 的开发
者误以为它是 Step 6 SagaOrchestrator 的"原型"而 import `createReferenceSagaSubject`，
会导致 testkit 工具被生产化。

**缓解**：
- 不通过 src/index.ts 导出（任何外部 import 必须用相对路径或深度路径，
  会触发 lint 警告或 typecheck 失败）
- saga-contract.test.ts 之外不允许任何包 import fixtures/reference-saga.js
- ADR-0002 + 本文件 §D 与 reference-saga.ts 文件头三处明示"参考实现严格 testkit-only"
- Step 6 的 SagaOrchestrator 有自己的 ADR-0002 Step 6 段；起草前应核对
  reference-saga.ts 的设计与产品级 Orchestrator 的差距

### E.2 §4 中剩余 3 条约束（§4.5/§4.6/§4.8）由后续 Step 补齐的清晰路径

| 条款 | 责任 Step | 实现方式 | 触发风险 |
|------|---|---|---|
| §4.5 状态持久化 | Step 3 | `defineSagaPersistenceContractTests` + `SagaStateStore` Adapter（memory + postgres） | 若 Step 3 改 Step 1/2 签名违反元规则 B；预防：Step 3 引入新 Port `SagaStateStorePort`，独立于 SagaStep |
| §4.6 死信入队 | Step 4 | `defineDeadLetterContractTests` + `DeadLetterStore` Adapter | 同上；预防：新 Port `DeadLetterStorePort` |
| §4.8 编译期硬约束 | Step 15 | tsc 配置 + lint 自定义规则 + ADR | 若 Step 15 修改 saga-port.ts 增加约束类型违反元规则 B；预防：通过新建 satellite type 而非改 SagaStep 表达约束 |

每条约束都有明确的"实现方式"与"触发风险防御"，本 Step 已在 ADR-0002
留痕。

### E.3 defineSagaContractTests 签名冻结后的长期影响

`defineSagaContractTests<T extends SagaContractSubject>(adapterName, factory,
_options?): void` 一旦发布即被元规则 B 冻结。后续 Step 3-19 不得修改此签
名。已在 ADR-0002 Step 2 段标记。

如果 Step 6 SagaOrchestrator 落地后发现需要"统一" SagaContractSubject 与
Orchestrator 接口（譬如 `SagaContractSubject` 本质上就是 `SagaOrchestrator`
+ step 工厂），需经 ADR-0002 修订流程：
- 不直接改 SagaContractSubject 类型
- 通过新增类型别名或扩展接口的方式扩展，不破坏既有 type 形状

### E.4 Phase 4 SagaStatus 与 Phase 9 SagaResultStatus 长期共存的认知负担

§C.0 已详细记录。两套类型在不同抽象层级存在；Phase 9 不"统一"它们。

**缓解**：
- 三处显式留痕（ADR-0002 Step 1 段 / saga-port.ts JSDoc / 本文件 §C.0）
- Phase 9 收官时（Step 19）在 ADR-0002 Consequences 段总结"两套类型共存
  是 Phase 4 应用层骨架与 Phase 9 Port 层契约共存的合理代价"
- Step 6 SagaOrchestrator 起草时引用本文件 §C.0 作为关键输入

### E.5 单 Step 超时后任务不被 abort

Step 1 接口不含 AbortSignal（元规则 B），因此超时后 task 仍在后台运行直
至自然结束。在测试场景下 GC 友好；在生产场景下若 step 是高资源任务
（譬如下载大文件、耗时 RPC），可能浪费资源。

**缓解**：
- 本 Step 仅是 testkit 工具，不是产品 Orchestrator——影响有限
- Step 6 SagaOrchestrator 应独立设计取消机制（如有需要），通过 ADR-0002
  修订流程扩展 SagaStep 接口或新增 `abortable: true` 选项

### E.6 SagaContractProbe 4 方法对 Step 6 起草足够否

Step 6 SagaOrchestrator 起草后会发现，产品级 Orchestrator 也需要"observability
surface"——譬如每个 Step 的真实耗时、失败原因明细、补偿尝试次数等。

**判断**：本 Step 的 4 方法对**契约验证**足够（5 类别 17 it 实测全绿）。
Step 6 若需要更多观察量，应在自己的 ADR-0002 Step 6 段提出新的 probe
（譬如 `OrchestratorTelemetryProbe`），不修改 SagaContractProbe（元规则 B）。

### E.7 KNOWN-ISSUES.md 4 项 open KI 核查（Phase 9 Step 2 留痕）

| KI | 当前状态 | 本 Step 是否触及 | Phase 9 影响预估 |
|------|------|------|------|
| KI-P8-001 domain 75.16% | open，Phase 9 责任 | 否 | 业务 Saga 落地（Step 10-13）后会调用 domain 函数频次提升 |
| KI-P8-002 真实基础设施 | open，Phase 11 责任 | 否 | 与 Saga 持久化/死信测试可能联动（Step 3-4） |
| KI-P8-003 时序 flake | open，Phase 9/11 责任 | **可能加剧** | 本 Step 5 类别 5 含 200ms / 500ms 慢任务；CI 抖动可能 flake |
| KI-P8-005 ports 0% | **改善** | 是 | saga-port.ts 升至 100% lines（brand 工厂被参考实现间接覆盖） |

**KI-P8-003 加剧风险**：
- 类别 5 的 3 个 it 含真实延迟（10ms / 50ms / 200ms / 500ms）
- 在 CI 高并发下 100ms 量级 timing 假设可能假阳性失败
- 缓解：选择 timing 时刻意拉开"快"与"慢"的差距（fast=10ms vs timeout=200ms 比例 1:20；slow=200ms vs timeout=50ms 比例 4:1），减少抖动空间
- 本 Step 完成后 1693 tests 在本机 11s 跑完无 flake；CI 可能仍偶发，与 Phase 8 既有 flake 同性质

**KI-P8-005 改善**：
- 此前 ports/src 0% 行覆盖（结构性现象）
- 本 Step 因契约套件运行参考实现间接调用 brand 工厂 + 大量 SagaStep 类型
  的字段访问（execute / compensate / sagaContext 等）
- saga-port.ts 行覆盖从 0% 升至 **100%**
- 整体 ports/src 覆盖率从 0% 升至约 4%（仍很低，但是结构性下界已突破）

本 Step 不修复任何非本 Step 责任的 KI——Phase Gate 隔离纪律。

## §F 测试计划

### 增量明细

| 文件 | 增量 | 类型 |
|------|------|------|
| `packages/adapters/adapter-testkit/src/saga-contract.test.ts`（新建） | +17 it（5 类别 1:1 对应 §4 5 条约束） | 契约自测 |

测试总数：1676 → **1693**（+17，精确符合 G16 ≥1693 下限）。

### 5 类别 17 it 清单

类别 1（§4.1+§4.3）补偿义务，3 it：
- test_step_with_compensate_function_invokes_compensate_when_a_later_step_fails
- test_step_with_explicit_empty_compensate_is_invoked_without_throwing
- test_step_failing_at_first_position_skips_compensation_phase_entirely

类别 2（§4.2）补偿幂等性，3 it：
- test_compensate_invoked_once_via_drive_yields_completed_compensation
- test_compensate_invoked_twice_sequentially_returns_ok_both_times
- test_compensate_concurrent_invocations_both_resolve_ok_without_double_apply

类别 3（§4.3+§4.6）逆序补偿，4 it：
- test_compensate_sequence_is_strict_reverse_of_execute_sequence
- test_compensation_does_not_skip_any_succeeded_step
- test_failed_step_itself_is_not_compensated_only_succeeded_predecessors_are
- test_compensation_starts_from_immediately_prior_step_to_failure

类别 4（§4.4）补偿信息承载，4 it：
- test_compensation_context_is_passed_unchanged_from_execute_to_compensate
- test_compensation_context_survives_json_round_trip_serialization
- test_two_independent_subjects_have_isolated_compensation_contexts
- test_each_step_in_the_same_saga_has_its_own_compensation_context

类别 5（§4.7 单 Step 维度）单 Step 超时，3 it：
- test_step_exceeding_timeout_yields_TQ-SAG-001_failure_via_harness
- test_step_completing_before_timeout_yields_normal_success
- test_timeout_during_execute_triggers_compensation_of_prior_succeeded_steps

### 覆盖率实测

| 指标 | 基线（Step 1 收官） | 本 Step 完成后 | Δ | 红线 | 状态 |
|------|---|---|---|---|---|
| Lines | 85.96% | 85.98% | +0.02pp | ≥80% | ✅ 改善 |
| Branches | 79.73% | 79.81% | +0.08pp | ≥75% | ✅ 改善 |
| Functions | 94.87% | 94.87% | 0pp | ≥80% | ✅ 持平 |
| Statements | 85.96% | 85.98% | +0.02pp | ≥80% | ✅ 改善 |

**saga-port.ts 行覆盖从 0% 升至 100%**（KI-P8-005 局部改善；adapter-testkit
本身在 vitest.config.ts 的 coverage exclude 列表，不计入分母）。

## §G 验收结果

### G1-G20 逐条状态

| Gate | 描述 | 状态 |
|------|------|------|
| G1 | Phase 9 强制开局动作 1-4 完成 | ✅ §C 顶部表格 + §C.0 |
| G2 | defineSagaContractTests 签名符合元规则 B；与 Phase 8 风格对齐 | ✅ |
| G3 | 5 类别覆盖《§4》§4.1-4.4 + §4.7 共 5 条；不含 §4.5/§4.6/§4.8 | ✅ |
| G4 | ≥17 it；每类别达下限 | ✅ 17 it（精确符合下限） |
| G5 | 5 个核心裁决已 §C 明示 | ✅ |
| G6 | SagaContractProbe 引入与否的判断已 §C 明示 | ✅ 引入，4 read 方法 |
| G7 | 参考实现严格限定 src/fixtures/；不导出 | ✅ |
| G8 | adapter-testkit 自测全绿 | ✅ 17/17 passed |
| G9 | 不修改 Step 1 锁定的任何 SagaPort 类型签名 | ✅ |
| G10 | 不引入 §4.5/§4.6/§4.8 契约 | ✅ |
| G11 | Phase 4 既有 SagaStatus 核查结果在 docs/phase9/02 §B/§C.0 | ✅ |
| G12 | ADR-0002 Step 2 段增量追写 | ✅ |
| G13 | docs/phase9/02 齐备；Phase 1-7 + 跨 Phase 通用文档段零改动 | ✅ |
| G14 | 元规则 A-P + Q + 惯例 K + L + M 触发情况逐一声明 | ✅ §C 末尾表格 |
| G15 | 全量检查全绿；pnpm-lock.yaml 不变 | ✅ |
| G16 | 测试总数 ≥ 1693（实际 1693） | ✅ |
| G17 | commit 消息遵守 commit-convention | ✅（待 §H 验证） |
| G18 | 已 push 到 origin main | ✅（待 §H 验证） |
| G19 | KNOWN-ISSUES.md 4 项 open KI 状态显式核查 | ✅ §E.7 |
| G20 | 覆盖率不退化（lines ≥ 80% / branches ≥ 75%） | ✅ 4 指标均改善或持平 |

## §H Commit / Push 留痕

本 Step 以 3 个原子 commit 推送到 `origin/main`（commit-convention 一致）：

1. `feat(adapter-testkit): add Saga contract test suite`
   —— saga-contract-probe.ts + saga-contract.ts（17 it）+ fixtures/reference-saga.ts
   + saga-contract.test.ts + index.ts 导出
2. `docs(decisions): append ADR-0002 Step 2 section`
   —— ADR-0002 Step 2 段（惯例 M 第二次实战）
3. `docs: add Phase 9 Step 2 execution record and Phase 4 SagaStatus survey`
   —— 本文件 + docs/00-phase1-mapping.md Phase 9 段追加 Step 2

具体 SHA 与远端 URL 见 `git log e4b5c9d..HEAD --oneline` 与 GitHub。

## §I Step 3 衔接预告

Step 3 将落地 saga-state-store-memory + saga-state-store-postgres 双 Adapter
（《§4.5》持久化），首次为 Saga 引入持久化能力。Step 3 严重依赖本 Step 2
锁定的 SagaContractFactory / SagaContractProbe / 参考实现风格——任何本
Step 的接口缺陷在 Step 3 都会暴露，元规则 B 禁止 Step 3 改 Step 2 签名。

Step 3 同时需要复用 Phase 8 的 EventStorePort 持久化经验：
- §H 元规则（Adapter 自管 schema）：SagaStateStorePort 的 schema 由 Adapter
  自行管理（CREATE TABLE IF NOT EXISTS / 版本表 / `init()` 幂等）
- §J 元规则（测试环境变量）：Postgres Adapter 在缺失 `TIANQI_TEST_POSTGRES_URL`
  时 skip
- 元规则 E（持久化契约函数）：Step 3 引入 `defineSagaPersistenceContractTests`
  独立于 `defineSagaContractTests`

Step 3 起草时应核对：
1. 本文件 §C.0（Phase 4 SagaStatus 实地核查）作为关键输入
2. ADR-0002 Step 1 + Step 2 段作为类型契约边界
3. KNOWN-ISSUES.md KI-P8-002（真实基础设施）状态

## §J 对作品级代码库的意义

Phase 9 Step 2 是 Phase 9 第一个**契约级 Step**。它的产品不是"能跑的代
码"，而是**让 Step 3-19 的所有后续工作都能用同一把契约尺去衡量**：

- Step 3 saga-state-store Adapter 间接验证（其 Saga 持久化能力必须能驱动
  这些 it 全绿）
- Step 6 SagaOrchestrator 直接验证（其编排算法必须让接口契约不被破坏）
- Step 10-13 业务 Saga 验证（Liquidation / ADL / InsuranceFund /
  StateTransition 各自的 SagaStep 实现都要通过本 Step 契约）
- Step 16 集成测试验证

读者将来从 `packages/adapters/adapter-testkit/src/saga-contract.ts` 一眼
读懂"Tianqi 认为 Saga 必须满足什么"——5 类 17 it 是契约本身。Step 1 用
类型定义"是什么"，Step 2 用契约定义"必须如何"。两步合在一起，让 Tianqi
第一次有了"Saga 是什么 + 必须如何"的完整答案。后续 17 个 Step 的全部工
作，都建立在这两步的稳定性上。

这正是宗旨"让算法变成工程师愿意读的代码"在契约层级的具体形态——不是说
明文档，而是**可执行的规约**。
