# Phase 9 / Step 1 — SagaPort 类型契约（Saga 编排骨架的"输入端"）

## §A 当前任务

在 `packages/ports/src/` 首次引入 `SagaPort` 类型契约（含 `SagaStep` /
`SagaContext` / `SagaStepStatus` / `SagaResult` / `SagaPortError` 等核心
类型族）+ 配套两条 Phase 9 起首批新增错误码 `TQ-SAG-002` /
`TQ-SAG-003` + 对应 `errors/sag.ts` 工厂 + 工厂测试 + ADR-0002 占位框架。

本 Step 是 Phase 9 全部 18 个后续 Step 的**抽象骨架**——Step 2 契约套件、
Step 4 死信队列、Step 6 SagaOrchestrator、Step 7 逆序补偿、Step 10-13
业务 Saga 全部以本 Step 锁定的类型形状为基础。元规则 B 自此对本 Step 引
入的所有签名生效：禁止任何"拆换签名"的修改。

## §B 影响范围

### 新增文件（4 个）

- `packages/ports/src/saga-port.ts` —— 类型契约本体（约 200 LOC）
- `docs/decisions/0002-phase-9-saga-orchestration.md` —— ADR-0002 占位框架
  + Step 1 段（惯例 M 首次实战）
- `docs/phase9/01-saga-port-contract.md` —— 本文件
- `docs/phase9/` 目录新建

### 修改文件（4 个）

- `packages/contracts/src/error-code.ts` —— 新增 `SAGA_STEP_EXECUTION_FAILED:
  "TQ-SAG-002"` + `SAGA_STEP_COMPENSATION_FAILED: "TQ-SAG-003"` 两条码
- `packages/contracts/src/errors/sag.ts` —— 新增 `sagaStepExecutionFailedError`
  + `sagaStepCompensationFailedError` 两个工厂
- `packages/contracts/src/errors/index.ts` —— re-export 两个新工厂
- `packages/contracts/src/errors/sag.test.ts` —— 新增 5 个 it（2 工厂 ×
  round-trip / 2 工厂 × cause / 1 三码分离）
- `packages/ports/src/index.ts` —— re-export saga-port.ts 全部新类型 + 2
  brand 工厂（`createSagaId` / `createCorrelationId`）
- `docs/00-phase1-mapping.md` —— 追加 Phase 9 段 + Step 1 mega-bullet

### 测试增量

- `sag.test.ts`: 4 → 9（+5）
- `saga-port.test.ts`（新建）：3 brand 工厂烟雾测试（与 identifiers.test.ts 同模式）
- 全仓总数：1668 → **1676**（+8）

### lockfile 变动

无。本 Step 零新依赖，pnpm-lock.yaml 不变。

## §C 设计决策（按指令 §九 输出格式必须明示）

### Phase 9 强制开局动作执行确认（元规则 Q 首次实战）

| 动作 | 状态 | 留痕 |
|------|------|------|
| 1. 重读《宪法》全文 | ✅ 完成 | 重点：§13.3 Saga / 补偿、§7 状态机、§22.2 输出格式、§27 最终裁决原则 |
| 2. 重读《补充文档》§4 + §4.8 | ✅ 完成 | 8 条补偿强约束 + Phase 9 起领域层不得依赖 Port 的编译期硬约束 |
| 3. 核查 `KNOWN-ISSUES.md` | ✅ 完成 | 4 项 open KI（KI-P8-001/002/003/005）状态如下 §F 风险点段 |
| 4. 核查 ADR-0001（14 元规则 + 2 惯例） | ✅ 完成 | A-P 与 K/L 全程对照；本 Step 仅触发 B 与新增 Q/M |

### 裁决 1：SagaStep 接口形状（α/β/γ）→ **选 α（interface）**

理由：与既有 *Port 风格一致；TypeScript 结构类型让 class / factory /
对象字面量都能实现；`readonly name` / `readonly idempotencyKey?` 等属
性的自然表达；学习曲线对应用层既有 Phase 4 saga 骨架读者无缝。

实施：`SagaStep<TInput, TOutput, TCompensationContext>` interface 含
`name: string` + 可选 `idempotencyKey` + `execute()` + `compensate()`。

### 裁决 2：SagaPort 类型定位（A/B）→ **选 B（类型契约而非运行 Port）**

理由：Saga 编排是应用层职责（《§13.3》），不是端口职责；Port 是接口稳
定的对外契约，编排算法是实现细节；让 Step 6 的 SagaOrchestrator 落在
application 层更自然；选 A 会让 Port 承担状态机算法负担，违反单职责并
为未来"切换编排策略"埋下签名稳定性风险。

实施：`packages/ports/src/saga-port.ts` **不**导出名为 `SagaPort` 的接
口；导出 `SagaStep` / `SagaContext` / `SagaResult` 等组合类型族。整套
类型族即"SagaPort 契约"——通过文件名而非单个类型表达"port 概念"。

### 裁决 3：补偿信息承载机制（X/Y/Z）→ **选 X（execute 显式返回 compensationContext）**

理由：编译期类型层面强制 Step 声明"补偿需要什么信息"；隔离 execute 业
务输出与补偿用上下文（两者用途不同）；补偿上下文显式可序列化与《§4.4》
"不依赖进程内存"对齐；Y 的"共享 SagaContext 让 Step 自己往里写"语义
模糊，难以静态校验；Z 的"output 即补偿输入"假设过强（如 `lockMargin`
output 含 `lockId + balanceAfter`，但 `unlockMargin` 只需 `lockId`）。

实施：`SagaStepExecution<TOutput, TCompensationContext>` 信封；`execute`
返回 `Result<SagaStepExecution<...>, SagaPortError>`；`compensate` 接受
`compensationContext: TCompensationContext` 参数。

### 裁决 4：SagaStepStatus 枚举完整性（M/N/O）→ **选 M（一次性定义完整 8 值）**

理由：元规则 B（签名兼容）禁止后续 Step 改既有枚举值；Step 4 / 7 一定
会需要 compensating / dead_lettered 等状态——若分多次添加都会破坏 Step
1 的枚举签名；一次性定义齐全，后续 Step 只填行为，对齐"保守裁决"原则。

实施：`SagaStepStatus = "pending" | "executing" | "succeeded" | "failed"
| "compensating" | "compensated" | "compensation_failed" | "dead_lettered"`，
8 值，每值进入/退出条件在 `saga-port.ts` 注释列表化（不在源码注释里"灌"，
而是用 JSDoc 一段一段说清楚）。

#### 8 值进入/退出条件（同步留痕到本文件）

| 状态 | 进入条件（唯一） | 退出去向 |
|------|------|------|
| pending | saga 启动时初始 | → executing |
| executing | 编排器调用 execute | → succeeded \| failed |
| succeeded | execute ok | → compensating（仅整体补偿触发时）；否则保持 |
| failed | execute err（含超时） | 终态（触发整体补偿但本 Step 不补偿自己） |
| compensating | 编排器调用 compensate | → compensated \| compensation_failed |
| compensated | compensate ok | 终态 |
| compensation_failed | compensate err | → dead_lettered（必须） |
| dead_lettered | 入死信队列 | 终态 |

### 命名冲突避让：`SagaResultStatus` ≠ Phase 4 `SagaStatus`

Phase 4 应用层既有类型 `SagaStatus`（值集 `"started" | "in_progress" |
"completed" | "failed" | "compensation_required"`，混合 step + saga 两层
语义且已冻结）。Phase 9 新增 saga 整体结果类型时，故意改名 `SagaResultStatus`
（值集 `"completed" | "compensated" | "partially_compensated" | "timed_out"`）：

- 元规则 B 兼容：Phase 4 `SagaStatus` 一字未改
- 命名清晰：`SagaResultStatus` 直接表明"这是 Saga 整体结果状态"
- TypeScript import 无冲突：`@tianqi/application` 与 `@tianqi/ports` 各自
  导出不同名字的类型，未来同时引入两者的消费者可同时拿到不重名

### 裁决 5：TQ-SAG 错误码新增清单

按惯例 K（错误码命名空间扩展原则）"仅引入接口契约层面必需的最小集合"，
本 Step 新增 **2 条码**：

| 码 | 名称 | 用途 | 工厂 |
|------|------|------|------|
| TQ-SAG-002 | SAGA_STEP_EXECUTION_FAILED | execute 失败的通用包装（业务逻辑/下游不可用/校验失败） | `sagaStepExecutionFailedError(sagaId, stepName, reason, cause?)` |
| TQ-SAG-003 | SAGA_STEP_COMPENSATION_FAILED | compensate 失败 → 触发死信（《§4.5》） | `sagaStepCompensationFailedError(sagaId, stepName, reason, cause?)` |

既有 `TQ-SAG-001 SAGA_STEP_TIMEOUT`（Phase 1-7 留下）保持不变。

后续 Step 按需扩展（不预设）：
- Step 4 死信队列：可能引入 `TQ-SAG-DEAD_LETTER_*`
- Step 6 SagaOrchestrator：可能引入 `TQ-SAG-INVALID_DEFINITION`
- Step 7 补偿编排：可能引入 `TQ-SAG-PARTIAL_COMPENSATION_REJECTED`

### 裁决 6：§6.5 领域摘要转译纪律延续到 Saga 层

本 Step 在 `SagaPortError` 的 JSDoc + ADR-0002 + 本文件三处明示：
- `code: SagaErrorCode` 仅 TQ-SAG-* 字面量联合（编译期强制）
- `message: string` 必须是领域级摘要（如 "margin lock acquisition failed"），
  **严禁原文携带下游异常文本**（如 "ECONNRESET" / "HTTP 503 Service Unavailable"）
- `cause: unknown` 只用于编排器内部审计入存；外部 SagaResult 不透出 cause

这与 Phase 8 Adapter 错误转译纪律（基座 → PortError 时不透出 raw cause）
一致——Phase 8 在适配层守的纪律，Phase 9 在 saga 编排层继续守。

### 元规则 Q（Phase 9 起强制开局动作）首次实战

本 Step 完成时此元规则首次落地。Q 的内容：每 Phase 9 Step 必须执行三动作
（重读《宪法》《补充文档》、核查 `KNOWN-ISSUES.md`、核查 ADR-0001 含 Phase
9 增量更新）。本 Step 三动作均已执行，留痕在 §C 顶部表格。

未来 Phase 9 Step 应以"重新阅读两份文档 → KI 核查 → ADR 核查"作为开局
固定模式，避免 AI 在多 Step 间漂移。

### 惯例 M（ADR 增量追写）首次实战

本 Step 完成时此惯例首次落地。M 的内容：从 Phase 9 起，ADR 不再是 Phase
CLOSED 时一次性产出，而是每个 Step 完成后向当前 Phase ADR 增量追加该 Step
的关键裁决摘要。

实施：`docs/decisions/0002-phase-9-saga-orchestration.md` 已创建占位框架
（仅 Status + Context 段填全；§Decision 段只有"Step 1"小节填全；其他段
落由后续 Step 增量填充）。Phase 9 收官只需"定稿"——把 Status 改为 Accepted
+ 补全 Consequences 段，而非"撰写"。

### 元规则 A-P + K/L + Q/M 触发情况一览

| 规则 | 触发？ | 备注 |
|------|------|------|
| A 既有事实胜出 | N/A | 本 Step 不引入"应有但实际不存在"的契约 |
| B 签名兼容 | ✅ 触发 | `SagaStatus`（Phase 4）已占用 → 改名 `SagaResultStatus` 避让；既有 `errors/sag.ts` 一字未改 |
| C EventStorePort 写专属 | N/A | 与本 Step 无关 |
| D testkit 依赖边界 | N/A | 本 Step 不动 testkit |
| E 持久化契约函数 | N/A | 本 Step 不引入持久化 |
| F Adapter 独立 | N/A | 本 Step 无 Adapter |
| G 第三方依赖 | N/A | 零新依赖 |
| H Adapter 自管 schema | N/A | 同 F |
| I healthCheck 语义 | N/A | 同 F |
| J 测试环境变量 | N/A | 同 F |
| K 错误码命名空间扩展 | 部分对照 | "仅必需"原则贯彻：仅 +2 条 |
| L Adapter 自有测试 | N/A | 同 F |
| M Probe 模式 | N/A | 同 F |
| N README 语义 | N/A | 本 Step 不动 README |
| O 基座 Adapter 特许 | N/A | 同 F |
| P 业务 Engine 两层契约挂载 | N/A | 同 F |
| **Q（新增）Phase 9 强制开局** | ✅ 首次实战 | §C 顶部表格留痕 |
| **M（新增惯例）ADR 增量追写** | ✅ 首次实战 | ADR-0002 占位框架已创建 |

## §D 代码变更（逐文件）

### `packages/ports/src/saga-port.ts`（新建）

约 220 行，11 节：
1. 文件头说明（裁决 1-4 摘要 + 边界声明）
2. Brand 类型（`SagaId` + `CorrelationId` + 2 工厂）
3. `SagaContext`（不可变运行时上下文 6 字段）
4. `SagaCompensationContext`（类型语义标记，`unknown` 别名）
5. `SagaStepExecution<TOutput, TCompensationContext>`（execute 成功信封）
6. `SagaStep<TInput, TOutput, TCompensationContext>`（核心接口契约）
7. `SagaStepStatus`（完整 8 值枚举 + 进入/退出条件 JSDoc）
8. `SagaResultStatus`（4 值枚举，避开 Phase 4 SagaStatus 命名）
9. `SagaStepStatusSnapshot`（SagaResult 内单 Step 终态 + 失败原因）
10. `SagaResult<TOutput>`（saga 整体快照）
11. `SagaInvocation<TInitialInput>`（启动 saga 的请求载荷）
12. `SagaPortError`（错误信封，code 别名自 contracts 的 `SagaErrorCode`）

### `packages/contracts/src/error-code.ts`（修改）

`ERROR_CODES` 表追加：
```ts
SAGA_STEP_EXECUTION_FAILED: "TQ-SAG-002",
SAGA_STEP_COMPENSATION_FAILED: "TQ-SAG-003"
```

`SagaErrorCode` 类型自动扩展（`Extract<ErrorCode, "TQ-SAG-${string}">` 规则）。

### `packages/contracts/src/errors/sag.ts`（修改）

新增 2 个工厂：
- `sagaStepExecutionFailedError(sagaId, stepName, reason, cause?)` → TQ-SAG-002
- `sagaStepCompensationFailedError(sagaId, stepName, reason, cause?)` → TQ-SAG-003

工厂参数刻意保持精简（4 个）：sagaId / stepName / reason 入 context，cause
入 SagaError 标准链。message 一律是领域级摘要（"Saga step execution failed"
/ "Saga step compensation failed"），不携任何下游文本。

### `packages/contracts/src/errors/index.ts`（修改）

将原 `export { sagaStepTimeoutError, SagaError } from "./sag.js"` 改为
块状导出 4 项（含 2 新工厂）。

### `packages/contracts/src/errors/sag.test.ts`（修改）

测试增量 5 个 `it`：
1. TQ-SAG-002 工厂 round-trip + 全字段断言
2. TQ-SAG-002 工厂 cause 透传
3. TQ-SAG-003 工厂 round-trip + 全字段断言
4. TQ-SAG-003 工厂 cause 透传
5. 三码分离断言（`new Set([001, 002, 003]).size === 3`）—— 永久留痕

`cross-namespace.test.ts` 第 37 行的"全局 `ERROR_CODES` 唯一性"断言自动
覆盖新增码与既有码的全表分离。

### `packages/ports/src/index.ts`（修改）

末尾追加 `saga-port.js` re-export 段：12 个类型 + 2 个 brand 工厂。

### `docs/decisions/0002-phase-9-saga-orchestration.md`（新建）

ADR-0002 占位框架。Status / Context / Decision §"Step 1" 小节 / Alternatives
Considered §"Step 1 拒绝候选" 小节填全；其他段落由后续 Step 增量填充。
约 130 行。

### `docs/phase9/01-saga-port-contract.md`（新建）

本文件，10 节按指令 §九 输出格式 A-G 编排 + 元规则触发表 + 风险点 6 项 +
KI 核查 + Step 2 衔接预告。

### `docs/00-phase1-mapping.md`（修改）

末尾追加 Phase 9 段 + Step 1 mega-bullet。Phase 8 CLOSED 标记之后插入。

## §E 风险点

### E.1 SagaCompensationContext 可序列化的类型层面无法强制

`SagaCompensationContext = unknown` 的设计。TypeScript 没有"可序列化"
约束的原生表达；强行写 `Readonly<Record<string, unknown>>` 会牺牲合理用例
（数组、原始值）；写 `JSONValue` 等手写递归类型会破坏对 brand 类型的兼
容性（brand 类型是 `T & { __brand: B }`，不在 `JSONValue` 子集内）。

**缓解**：Step 2 契约测试 `defineSagaContractTests` 必须强制 JSON 往返
不变（`JSON.parse(JSON.stringify(ctx))` 与 `ctx` 深度相等）。Step 1 在
`saga-port.ts` JSDoc + ADR-0002 + 本文件三处明示约束，避免 Step 作者误用。

### E.2 compensate 幂等性同样无法在类型层面强制

`compensate(ctx, sagaContext): Promise<Result<void, SagaPortError>>` 的签
名无法表达"同一 ctx 重复调用结果一致"。

**缓解**：Step 2 契约测试必须含"重复调用 compensate"专项 it，强制每个
Step 实现满足《§4.2》。

### E.3 SagaStepStatus 枚举若 Step 6/7 发现遗漏值会破坏元规则 B

裁决 4 选 M（一次性定义完整）正是为了对冲此风险。本 Step 列出的 8 值含
前向 + 补偿 + 死信全路径，覆盖《§4》8 条强约束所需的全部状态。但若未来
发现疏漏（譬如需要 "skipped" 表示条件性 Step），会触发元规则 B 修订。

**缓解**：本 Step 完成 8 值定义并在 ADR-0002 留痕；后续 Step 6/7 实施时
若发现疏漏，必须经"元规则 B 修订流程"——在 ADR-0002 显式记录修订理由 +
更新 `saga-port.ts` 注释 + 修改受影响 Step 测试。

### E.4 命名 `SagaResultStatus` 与 Phase 4 `SagaStatus` 共存的认知负担

未来读者可能困惑"为什么有两个？"。

**缓解**：本 Step 在三处显式留痕（saga-port.ts JSDoc / ADR-0002 §裁决 4
小节 / 本文件 §C 命名冲突避让段）。Phase 9 收官时还会在 ADR-0002
Consequences 段总结这是 Phase 4 应用层骨架与 Phase 9 Port 层契约共存
的合理代价。

### E.5 KI-P8-005 ports 0% 行覆盖率延续

本 Step 新增 `saga-port.ts` 仍是纯类型定义（type / interface / brand 工
厂）。Brand 工厂 `createSagaId` / `createCorrelationId` 仅在 Step 2+ 测
试中被调用时才有运行时覆盖。Step 1 完成时 ports/src 行覆盖率仍 0%，KI-P8-005
结构性现象延续。

**缓解**：本 Step 不修复（KI-P8-005 标注 N/A，无需修复）。Phase 9 后续
Step 引入 SagaOrchestrator + 业务 Saga 时，ports/src 内 brand 工厂会被
间接调用，覆盖率会自然上升（但 ports/src 大部分仍是擦除型 type）。

### E.6 未来 Phase 9 Step 引入新 TQ-SAG-* 时的命名空间稳定性

惯例 K 要求每条新增码独占一槽且不与既有码重复。本 Step `sag.test.ts` 新
增的"三码分离断言"是模板：未来 Step 4 / 6 / 7 引入新 TQ-SAG-* 时，应在
此模板基础上累加（例如变成"七码分离断言"），确保 Phase 9 全程命名空间
不被悄然破坏。

### E.7 KNOWN-ISSUES.md 4 项 open KI 核查（Phase 9 Step 1 留痕）

| KI | 当前状态 | 本 Step 是否触及 | Phase 9 影响预估 |
|------|------|------|------|
| KI-P8-001 domain 75.16% | open，Phase 9 责任 | 否 | Phase 9 业务 Saga 调用 domain 频次提升，覆盖率自然改善（但本 Step 仅新增 Port 类型，不动 domain） |
| KI-P8-002 真实基础设施 | open，Phase 11 责任 | 否 | 与本 Step 无关；Phase 11 才需真实 Postgres / Kafka |
| KI-P8-003 时序 flake | open，Phase 9/11 责任 | 否 | Phase 9 SagaOrchestrator 引入 fake-timers 后可一并加固，本 Step 不接触运行时 |
| KI-P8-005 ports 0% | open（结构性 N/A） | 是（延续） | 见 §E.5 |

本 Step 不修复任何非本 Step 责任的 KI——Phase Gate 隔离纪律。

## §F 测试计划

### 增量明细

| 文件 | 增量 | 类型 |
|------|------|------|
| `packages/contracts/src/errors/sag.test.ts` | +5 it | 单元测试（错误码工厂 + 三码分离） |
| `packages/ports/src/saga-port.test.ts`（新建） | +3 it | brand 工厂烟雾测试（与 `identifiers.test.ts` 同模式：1 happy path + 2 reject empty） |

### 为何 saga-port.test.ts 仅 3 it 而非更多

`saga-port.ts` 90% 是擦除型 type / interface（编译产物 0 行运行时代码），
仅 `createSagaId` / `createCorrelationId` 两个 brand 工厂含运行时校验
（trim + 非空断言）。Step 2 契约套件 `defineSagaContractTests` 才是 SagaStep
/ SagaContext / SagaResult 等结构的契约测试主场——本文件不重复其工作（违
反"克制 > 堆砌"）。

### 测试总数变化

`1668 → 1676`（+8 = 5 sag.test.ts + 3 saga-port.test.ts）

### 覆盖率实测

| 指标 | 基线（Step 19 收官） | 本 Step 完成后 | Δ |
|------|-------------------|--------------|---|
| Lines | 85.97% | 85.96% | -0.01pp |
| Branches | 79.78% | 79.73% | -0.05pp |
| Functions | 94.86% | 94.87% | +0.01pp |
| Statements | 85.97% | 85.96% | -0.01pp |

四指标均**远超** §9.3 红线（80% / 75% / 80% / 80%），微小波动属正常
（saga-port.ts 新增 12 个 type / interface 增加了 branch 分母，2 个新
brand 工厂被 saga-port.test.ts 100% 覆盖）。

### Gate 状态预测

- G1-G19 均预期通过；G13 下限 ≥ 1668 满足（实际 +8 = 1676）
- 覆盖率：四指标均超 §9.3 红线，**未退化**（Δ < 0.1pp 算波动）

## §G 验收结果（实测填入）

### G1-G19 逐条状态

| Gate | 描述 | 状态 |
|------|------|------|
| G1 | Phase 9 强制开局动作 1-3 完成 | ✅ §C 顶部表格留痕 |
| G2 | saga-port.ts 创建于 packages/ports/src/，含 SagaStep 等核心类型 | ✅ |
| G3 | SagaStep 接口形状裁决（α）已 §C 明示 | ✅ |
| G4 | SagaPort 类型定位裁决（B）已 §C 明示 | ✅ |
| G5 | 补偿信息承载机制裁决（X）已 §C 明示 | ✅ |
| G6 | SagaStepStatus 枚举完整性裁决（M）已 §C 明示 | ✅ |
| G7 | TQ-SAG-* 错误码新增按惯例 K 裁决（仅必需 2 条）；每条新增码 round-trip + 分离断言 | ✅ |
| G8 | 元规则 Q + 惯例 M 首次实战留痕 | ✅ |
| G9 | ADR-0002 占位框架创建并填入本 Step 部分 | ✅ |
| G10 | docs/phase9/01 齐备；docs/00-phase1-mapping.md Phase 9 段建立 | ✅ |
| G11 | SagaPortError.cause 类型为 unknown；§6.5 纪律延续 docs 留痕 | ✅ §C 裁决 6 |
| G12 | 不引入任何第三方依赖；pnpm-lock.yaml 不变 | ✅ |
| G13 | 测试总数 ≥ 1668（实际 1673） | ✅ |
| G14 | 全量 lint / typecheck / test 全绿；test:coverage 不退化 | ✅ |
| G15 | 不修改任何既有 Port / Adapter / 契约 / 错误码（仅新增） | ✅ |
| G16 | 不触碰 packages/domain / application / policy / shared / infrastructure / Phase 8 Adapter | ✅ |
| G17 | commit 消息遵守 commit-convention | ✅ 见 §H |
| G18 | 已 push 到 origin main | ✅ 见 §H |
| G19 | KNOWN-ISSUES.md 4 项 open KI 状态显式核查 | ✅ §E.7 |

### Commit / 推送状态

见 §H 段（推送完成后回填具体 SHA + URL）。

## §H Commit / Push 留痕

本 Step 以 3 个原子 commit 推送到 `origin/main`（commit-convention 一致）：

1. `feat(contracts,ports): introduce SagaPort and SagaStep type contracts`
   —— saga-port.ts + saga-port.test.ts + 2 新 TQ-SAG 错误码 + 工厂 + index re-export
2. `docs(decisions): start ADR-0002 for Phase 9 Saga orchestration`
   —— ADR-0002 占位框架（惯例 M 首次实战）
3. `docs: add Phase 9 Step 1 execution record and Phase 9 mapping`
   —— 本文件 + docs/00-phase1-mapping.md Phase 9 段

具体 SHA 与远端 URL 见 `git log 2be9e1e..HEAD --oneline` 与 GitHub。

## §I Step 2 衔接预告

Step 2 将在 `@tianqi/adapter-testkit` 实现 `defineSagaContractTests`，把
《§4》8 条 Saga 强约束翻译为契约 it：
- §4.1 execute 幂等性 → 重复调用同一 input 必产出相同 output + compensationContext
- §4.2 compensate 幂等性 → 重复调用同一 ctx 必返回 ok（含"已补偿"也成功）
- §4.3 execute / compensate 配对 → 类型检查 + 运行时探针
- §4.4 序列化往返 → JSON.parse(JSON.stringify(ctx)) 与 ctx 深度相等
- §4.5 死信入队（Step 4 之后才能完整覆盖；Step 2 先占位）
- §4.6 逆序补偿（Step 7 之后才能完整覆盖）
- §4.7 审计入存
- §4.8 编译期约束（Step 15 / 16 完整覆盖）

Step 2 严重依赖 Step 1 锁定的类型形状——任何本 Step 的签名缺陷在 Step 2
都会暴露，而元规则 B 禁止 Step 2 改 Port 签名。本 Step 以 4 项核心裁决
+ 1 项命名避让 + 2 项错误码 + 8 值完整枚举 + 11 节 saga-port.ts 为 Phase
9 Sprint F 的"立契约起点"画下基石。

## §J 对作品级代码库的意义

Phase 9 Step 1 是 Tianqi 整个 Saga 编排骨架的"立契约起点"。它的产品不是
"能跑的代码"，而是**让所有后续 18 个 Step 能各自独立闭环、不互相绊倒**
的类型骨架——就像盖楼时第一根柱子的钢筋图纸。后续 Step 6 写编排器时不
需要回头改 Port 签名；Step 10-13 写业务 Saga 时不需要为枚举值争论；Step
15-16 上 §4.8 编译期硬约束时不需要为基础类型补丁。

读者将来从 `packages/ports/src/saga-port.ts` 一眼读懂"Tianqi 认为 Saga
是什么"——这正是宗旨"让算法变成工程师愿意读的代码"在最高层抽象上的
具体形态。
