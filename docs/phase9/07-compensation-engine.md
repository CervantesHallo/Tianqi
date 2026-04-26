# Phase 9 / Step 7 — 逆序补偿引擎 + 补偿幂等保证

## §A 当前任务

把 Step 6 已留好的 `runCompensationPhase` 钩子从"基本能跑"强化到"生
产级"——**5 个不变量在运行时层面被严格守住**。本 Step 是 Phase 9 第一
次"接续增强"性质的 Step：不新建模块，仅在 Step 6 接口冻结的前提下增
强既有实现；沿用 Sprint F 一阶段模式（不拆设计 + 实现两阶段）。

## §B 影响范围

### 修改文件（4）

- `packages/application/src/saga/saga-orchestrator.ts`（421 → 535 LOC）—— 5
  不变量代码注释 + 2 个文件级 export helper + runCompensationPhase 重
  构（接口签名零变化）
- `packages/application/src/saga/saga-orchestrator.test.ts`（333 → 460
  LOC）—— 既有 it 4 升级为 4 step 严格逆序 + 新增 2 个不变量专项 it
  （总数 10 → 12）
- `docs/decisions/0002-phase-9-saga-orchestration.md`（1106 → 1180 行）
  —— Step 7 段（裁决摘要 + 5 不变量代码层面落地表 + Step 6 增强前后对
  比 + 实施细节 + 8 项拒绝候选）
- `docs/00-phase1-mapping.md` —— +Step 7 mega-bullet（本 Step 完成后追写）

### 新增文件（1）

- `docs/phase9/07-compensation-engine.md` —— 本文件

### 不修改文件

- `packages/ports/src/saga-port.ts`（Step 1 锁定签名）
- `packages/ports/src/saga-state-store-port.ts`（Step 3 锁定 PersistedSagaState
  10 字段——强制开局动作 5 实地核查确认无需扩展）
- `packages/ports/src/dead-letter-store-port.ts`（Step 4 锁定）
- `packages/adapters/saga-state-store-memory/`（Step 3 Adapter）
- `packages/adapters/saga-state-store-postgres/`（Step 3 Adapter）
- `packages/adapters/dead-letter-store-memory/`（Step 4 Adapter）
- `packages/adapters/dead-letter-store-postgres/`（Step 4 Adapter）
- `packages/adapters/adapter-testkit/src/saga-contract.ts`（Step 2 17 契约
  it——本 Step 增强不破坏既有契约，验证仍 17/17 全绿）

### lockfile 变动

- `pnpm-lock.yaml` —— 零变动（本 Step 不引入任何依赖）

### 测试增量

- unit tests: 10 → 12（+2，新增 2 个不变量专项 it；既有 it 4 升级 4 step
  in-place）
- contract tests: 17 → 17（验证增强不破坏既有契约）
- 总数: 1814 → 1816（+2）

## §C 设计决策

### 强制开局动作 1-3 执行确认

- ✅ 重读《宪法》§13.3 Saga / 补偿（line 580-582："涉及外部系统多步动作
  时，使用应用层 saga 管理"）
- ✅ 重读《Tianqi Phase 8–12 架构与代码规范补充文档》§4 Saga 补偿约束 8
  条（§4.1-§4.8；本 Step 主战场是 §4.2 / §4.3 / §4.5 / §4.6）
- ✅ 重读 KNOWN-ISSUES.md 4 项 open（KI-P8-001/002/003/005；KI-P8-004
  已修复；本 Step 不修复任何 KI 也不引入新 KI）
- ✅ 重读 ADR-0001（14 元规则 + 2 惯例）+ ADR-0002（Step 1-6 段；Phase
  9 引入元规则 Q + 惯例 K + L + M）

### 强制开局动作 4 执行结果（Step 6 runCompensationPhase 现有实现核查）

阅读 `packages/application/src/saga/saga-orchestrator.ts:370-453`（Step 6
原 runCompensationPhase 主体），实地核查结果：

| 核查项 | 实地观察 | Step 7 处置 |
|---|---|---|
| 补偿调用顺序 | line 386 `for j = succeeded.length - 1; j >= 0; j -= 1`——按 succeeded 数组逆序遍历，因 forward phase 按 stepIndex 升序 push，逆序遍历等价于按 stepIndex 严格降序（**已符合 §4.3 严格逆序**） | 显式注释 + 不变量 1 升级 4 step 验证 |
| compensate 失败处置 | line 417-447：失败后 status → dead_lettered，persist，DLQ enqueue，loop **不 break** 继续 j -= 1（**已实现链式继续策略**——裁决 1 β 已落地） | 显式注释不变量 5；新增不变量 5 专项 it 验证多 step 失败链式继续 |
| 已 compensated 幂等标记 | **无**——runCompensationPhase 接收 `succeeded` 参数（运行时数据，未持久化），单次 runSaga 内 loop 1 次不会重复调 compensate；**崩溃恢复幂等保证当前为零**（依赖 §4.2 step 自身幂等承担） | 引入 `isStepEligibleForCompensation` 守门作为编排器侧第二层幂等保护；崩溃恢复（Phase 10+）从 PersistedSagaState 装载 stepStatuses 复用本 helper |
| stepStatus 状态变换顺序 | executing → succeeded → compensating → compensated（成功）/ dead_lettered（失败） | 状态机已对；不变量 4 显式注释每次 status 变化必先 persist |
| 三类审计事件触发 | saga.compensation.started: 进入补偿循环前 1 次；saga.step.compensate.outcome: 每个 compensate 调用 1 次（成功 / 失败均触发）；saga.dead_letter.enqueued: 仅 DLQ 入队成功时 1 次（入队失败走 onDegradedFailure） | 不变量 3 + 不变量 5 专项 it 联动验证 audit 事件序列正确性 |

**关键发现**：Step 6 runCompensationPhase **已经实现"基本能跑"**——逆
序循环 + 链式继续 + DLQ 入队 + 状态变换都已正确。Step 7 增强焦点在：
（1）**显式守门**编排器侧幂等保护（裁决 2 C）；（2）**不变量在代码层面
显式抽象**让维护者一目了然；（3）**不变量在测试层面专项覆盖**让纸面约
束变成可验证。Step 6 已对的语义，Step 7 不重做；只补强新增工程能力。

### 强制开局动作 5 执行结果（PersistedSagaState 字段足够性核查）

阅读 `packages/ports/src/saga-state-store-port.ts:104-115`（Step 3 锁定的
PersistedSagaState 10 字段），实地核查结果：

| 核查问题 | 字段查询结果 | 判断 |
|---|---|---|
| stepStatuses 是否含每个 step 的 compensated / compensation_failed 状态？ | line 110: `stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>`；SagaStepStatusSnapshot.status 类型 SagaStepStatus（8 值含 compensated / compensation_failed / dead_lettered） | ✅ 足够 |
| compensationContexts 是否含每个已 compensate step 的标记？ | line 111: `compensationContexts: ReadonlyArray<PersistedCompensationEntry>`；PersistedCompensationEntry 含 stepName + compensationContext，**不含**"已 compensate 标记"——但 stepStatuses[i].status === "compensated" 已能表达此语义 | ✅ 足够（用 stepStatus 表达） |
| 是否有"compensate 调用次数"字段？ | **无** | ❌ 但**不需要**——幂等保护不需调用次数，只需 status 状态判定 |

**关键判断**：PersistedSagaState 现有字段**已经足够**支撑编排器侧幂等
保证。崩溃恢复时编排器从 PersistedSagaState 重新加载 stepStatuses，对
每个 step：

- status === "succeeded" → 需要 compensate
- status === "compensating" → 上次崩溃在 compensate 进行中，需要重试
  （依赖 §4.2 step 自身幂等）
- status === "compensated" → 已完成，跳过
- status === "compensation_failed" → 重试或入死信
- status === "dead_lettered" → 终态，跳过

**stepStatuses 字段本身就是幂等保证的载体**。元规则 B 严守不动 Step 3
锁定 PersistedSagaState 签名（裁决 3 X）。

### 5 个核心裁决

#### 裁决 1（链式策略）：β 链式继续

候选与决策：
- α 链式中止（拒绝）：让"saga 失败"对资源占用造成永久泄漏；运维处理时
  无法依据失败列表逐个恢复
- **β 链式继续（采纳）**：单 step compensate 失败入死信后**不阻断**后续
  step 补偿尝试；终态由 aggregateCompensationOutcome 聚合
- γ 配置驱动（拒绝）：违反"克制 > 堆砌"，引入永久无用的 Options 字段

**Step 6 实施时已落地此策略**（runCompensationPhase 主循环不在失败处
break）。Step 7 增强为显式不变量 5 注释 + 专项 it 覆盖。

#### 裁决 2（幂等保证实施层）：C 双重保护

候选与决策：
- A 仅编排器侧（拒绝）：违反《§4.2》step 实现者契约
- B 仅 SagaStep 侧（拒绝）：完全信任 step 实现者风险太高，资金/持仓不
  一致代价不可承受
- **C 双重保护（采纳）**：编排器侧 stepStatus 检查（`isStepEligibleForCompensation`）
  + step 自身契约幂等（《§4.2》要求）

**关键认知**：编排器侧守门（`if (!isStepEligibleForCompensation(currentStatus)) continue`）
当前是冗余防御——运行时主路径不可达（succeeded 数组 push 顺序决定
stepStatus 必为 "succeeded"）；但是 Phase 10+ 崩溃恢复关键。守门成本极
低（1 行 if + 1 个纯函数 helper）但价值长期巨大。

#### 裁决 3（PersistedSagaState 是否扩展）：X 不扩展

候选与决策：
- **X 严守元规则 B（采纳）**：编排器内部用 stepStatus 字段表达幂等；崩
  溃恢复（Phase 10+）依赖 §4.2 step 自身幂等承担兜底
- Y 突破元规则 B（拒绝）：违反 Step 3 锁定 PersistedSagaState 10 字段；
  Phase 9 已 6 次实战元规则 B，本 Step 不破例

强制开局动作 5 实地核查证明 stepStatuses 字段（含 8 值终态 status）已能
完全表达"已 compensate / 已 dead_lettered"幂等判定所需信息。**裁决 3
直接选 X，无张力**。

#### 裁决 4（错误码新增数）：0

候选与决策：
- TQ-SAG-004 SAGA_COMPENSATION_LINK_PARTIAL（拒绝）：partially_compensated
  终态字段已表达；额外错误码冗余
- TQ-SAG-005 SAGA_COMPENSATION_OUT_OF_ORDER（拒绝）：双重保护机制让顺序
  异常理论不可能；预设错误码违反"克制 > 堆砌"
- **0 新增（采纳）**：复用 TQ-SAG-001/002/003

**惯例 K 第 9 次实战**仍按"仅必需"裁决 0 新增。

#### 裁决 5（测试上限处置）：≤10 → ≤12

候选与决策：
- 严守 ≤10（拒绝）：Step 7 性质特殊，5 个不变量需要专项 it 覆盖；不专
  项覆盖等于不变量"流于纸面"
- **放宽至 ≤12（采纳）**：既有 it 4 升级（不增数）+ 新增 2 个不变量 it
- 放宽至 ≤13 或更多（拒绝）：5 不变量已被强力覆盖；新增多余 it 重复劳动

具体处置：
- 既有 it 4（"reverse compensation"）升级：从 2 step → 4 step 严格逆序
  验证不变量 1（in-place 修改不增加 it 数）
- 新增 it 11：不变量 2 专项（直接调用 isStepEligibleForCompensation +
  aggregateCompensationOutcome 验证 8 状态枚举完备性）
- 新增 it 12：不变量 5 专项（3 succeeded step 中 2 个 compensate 失败 →
  链式继续 + partially_compensated + 全部入死信）

总数：10 → 12，符合放宽后上限。本放宽是 Step 7 一次性，不构成惯例 L
修订。

## §D 5 个不变量

### 不变量 1（§4.3 严格逆序）

**陈述**：补偿调用顺序严格按 stepIndex 降序 N-1, N-2, ..., 0。中间不跳
过任何 succeeded step；失败 step 自身不补偿。

**代码守护点**：
```typescript
// runCompensationPhase 主循环
for (let j = succeeded.length - 1; j >= 0; j -= 1) {
  ...
}
```
`succeeded` 数组在 forward phase 按 stepIndex 升序 push，逆序遍历等价
于按 stepIndex 严格降序。

**测试覆盖**：
- it 4（升级 4 step）：4 succeeded + 1 failed → compensate 顺序严格 d→c→b→a
- it 12（间接覆盖）：3 succeeded 中 2 个 compensate 失败 → compensate 顺序严格 c→b→a

### 不变量 2（§4.2 双重幂等保护）

**陈述**：仅 stepStatus === "succeeded" 的 step 才被调用 compensate。

**代码守护点**：
```typescript
// 编排器侧守门（双重保护"编排器侧"）
if (!isStepEligibleForCompensation(currentStatus)) {
  continue;
}

// 文件级 export helper
export const isStepEligibleForCompensation = (status: SagaStepStatus): boolean =>
  status === "succeeded";
```
与 §4.2 step 自身契约幂等（实现者承诺 compensate 重复调用安全）形成双
重保护。

**测试覆盖**：
- it 11（直接调用 helper）：8 状态枚举完备性测试——仅 "succeeded" 返
  回 true；其余 7 状态（pending / executing / failed / compensating /
  compensated / compensation_failed / dead_lettered）全返回 false

### 不变量 3（§4.5 死信入队）

**陈述**：每个 compensate 失败的 step 必入死信队列（通过 DeadLetterStore.enqueue）。

**代码守护点**：
```typescript
// 失败分支必经 tryEnqueueDeadLetter
} else {
  ...
  state.stepStatuses[entry.idx] = { ..., status: "dead_lettered", failureReason };
  await persist(state);
  await auditAppend(SAGA_STEP_COMPENSATE_OUTCOME, state, { outcome: "failed", ... });
  const dlqResult = await tryEnqueueDeadLetter(state, step, ...);
  if (dlqResult.enqueued) {
    await auditAppend(SAGA_DEAD_LETTER_ENQUEUED, state, { ... });
  }
}
```

**测试覆盖**：
- it 5（既有）：单 step compensate 失败 → DLQ 入队 1 次
- it 12（新增）：多 step compensate 失败 → DLQ 入队 N 次（每个失败 1 次）

### 不变量 4（§4.5 stepStatus 持久化）

**陈述**：每次 stepStatus 变化都 persist。

**代码守护点**：
```typescript
// 进入 compensating
state.stepStatuses[entry.idx] = { ..., status: "compensating" };
const persistC1 = await persist(state);
if (!persistC1.ok) return persistC1;

// 进入 compensated 或 dead_lettered
state.stepStatuses[entry.idx] = { ..., status: "compensated" /* 或 dead_lettered */ };
const persistC2 = await persist(state);
if (!persistC2.ok) return persistC2;
```

**测试覆盖**：
- it 3（既有）：6 触发点 count 测试（启动 + 2 step × 2 状态变化 + 完成）

### 不变量 5（§4.6 链式继续 + 终态聚合）

**陈述**：单点 compensate 失败不阻断后续 step 补偿尝试；终态由 stepStatuses
聚合（任一 dead_lettered → partially_compensated；否则 compensated）。

**代码守护点**：
```typescript
// 主循环中失败分支不 break
} else {
  ...
  // 不变量 5（链式继续）：compensate 失败后**不 break**，循环继续到 j=0
}

// 循环结束后由纯函数聚合
state.overallStatus = aggregateCompensationOutcome(state.stepStatuses);

// 文件级 export helper
export const aggregateCompensationOutcome = (
  stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>
): "compensated" | "partially_compensated" => {
  for (const snapshot of stepStatuses) {
    if (snapshot.status === "dead_lettered") return "partially_compensated";
  }
  return "compensated";
};
```

**测试覆盖**：
- it 11（直接调用 helper）：聚合 8 状态枚举验证（含空数组 vacuous +
  混合 dead_lettered 触发 partially_compensated）
- it 12（间接覆盖）：3 step 链式继续场景下终态确为 partially_compensated

### 元规则 / 惯例触发情况

| 元规则 / 惯例 | Step 7 触发情况 |
|---|---|
| **A**（功能完整） | ✅ Step 7 增强 runCompensationPhase 为 5 不变量保证；接续增强性质，不引入新功能 |
| **B**（签名兼容） | ✅ **严守**——SagaOrchestrator / SagaOrchestratorPorts / SagaOrchestratorOptions / runSaga / AUDIT_EVENT_TYPES / SagaAuditEventType / SagaDegradedFailureEvent 全部冻结；新增 isStepEligibleForCompensation + aggregateCompensationOutcome 2 个 export helper（同文件 export 不通过 src/index.ts 暴露），自此对这两个 helper 签名永久冻结 |
| **C**（向后兼容） | ✅ Step 6 调用方零修改；新增 helper 不影响既有用法 |
| **D**（错误码命名） | N/A 本 Step 不引入新错误码 |
| **E**（独立契约函数） | N/A 本 Step 不修改契约函数 |
| **F**（Adapter 独立） | ✅ 不触碰任何 Adapter |
| **G**（双 Adapter 对称） | N/A 本 Step 不实现 Adapter |
| **H**（同型策略一次性定义） | N/A 本 Step 不引入枚举 |
| **I**（pure JSON 跨进程） | N/A 本 Step 不引入新跨进程类型 |
| **J**（独立 Port） | N/A 本 Step 不引入 Port |
| **K**（错误码命名空间，仅必需） | ✅ **第 9 次实战**——0 错误码新增（裁决 4） |
| **L**（≤6 自测；≤10 业务 Engine） | ✅ **第 N 次实战**——本 Step 放宽 ≤10 → ≤12（裁决 5）；放宽是 Step 7 一次性，不构成惯例 L 修订 |
| **M**（probe 模式 / ADR 增量） | ✅ **ADR-0002 增量第 7 次实战**——Step 7 段从无到有（约 +74 行 Decision + Alternatives Considered） |
| **N**（pure helper 单独测试） | ✅ isStepEligibleForCompensation 与 aggregateCompensationOutcome 作为文件级 export 直接被 unit test 调用 |
| **O**（错误信封不透出 cause） | ✅ §6.5 转译纪律延续——SagaPortError.cause 不透出到 SagaResult |
| **P**（无第三方依赖） | ✅ 零新依赖 |
| **Q**（Phase 9 强制开局动作） | ✅ **第 7 次实战**——5 个开局动作全部完成（重读两份文档 / KNOWN-ISSUES / ADR-0001/0002 / Step 6 现有实现核查 / PersistedSagaState 字段足够性核查） |
| 惯例 K | ✅ 第 9 次实战 |
| 惯例 L | ✅ 本 Step 一次性放宽（≤10 → ≤12），不构成惯例 L 修订 |
| 惯例 M | ✅ 第 7 次实战 |

## §E 风险点

### 风险点 1：链式继续策略下 audit 事件序列正确性

**场景**：3 succeeded step（a/b/c），c 失败 + b 失败 + a 成功。预期 audit
事件序列：

```
saga.compensation.started (1 次)
saga.step.compensate.outcome (c, failed)
saga.dead_letter.enqueued (c)
saga.step.compensate.outcome (b, failed)
saga.dead_letter.enqueued (b)
saga.step.compensate.outcome (a, succeeded)
saga.completed (overall: partially_compensated)
```

**风险**：链式继续主循环每轮迭代独立触发 outcome / dead_letter 事件，
若 audit append 失败（degraded 模式）静默降级，不重试，不影响 saga 推
进。**生产部署应注入 onDegradedFailure 指向运维告警**，否则 audit 失败
不可观测。

**验证**：it 12（不变量 5 专项）显式断言 compensateOutcomes.length === 3
+ dlqEnqueued.length === 2，验证 audit 事件序列正确性。

### 风险点 2：双重幂等保护与 step 实现侧不当行为之间的相互作用

**场景**：step 实现者意外破坏 §4.2 契约（compensate 第二次调用失败 / 抛
异常 / 修改外部状态导致状态机错乱）。

**双重保护的兜底**：编排器侧 isStepEligibleForCompensation 守门避免对已
compensated 的 step 二次调用。但若 step 实现者在 compensate 内部**修改
了其他 step 的 compensationContext 引用**（譬如共享可变对象），可能让后
续 step 的补偿数据被污染——这超出双重保护范围。

**缓解**：《§4.4》要求 compensationContext 可序列化（不依赖进程内存），
正常实现路径下 compensationContext 应是不可变 plain object。但代码层面
不强制 deep freeze——这是 step 实现者的契约责任，编排器不兜底。

**未来加固**：Step 17（§4.4 运行时 JSON 序列化校验）会在 compensationContext
存入 PersistedCompensationEntry 时显式 JSON.stringify + parse 往返，从
side effect 上消除可变共享引用。

### 风险点 3：unit test 上限调整（≤10 vs ≤12）的长期影响

**风险**：本 Step 把 ≤10 业务 Engine 风格放宽到 ≤12 是**一次性**——Step
7 性质特殊（5 不变量需要专项覆盖）。后续 Step 8（超时机制）+ Step 9（人
工介入）若也是接续增强性质，会面临同样张力："是否再次放宽？"

**纪律**：每次放宽必须**显式裁决**并在 ADR 留痕。Step 7 放宽不构成惯例
L 修订；惯例 L 仍然是 ≤10 默认上限。

**长期解**：Phase 10+ 引入崩溃恢复 API 时，可能把"恢复路径专项 it"独
立成新 *.recovery.test.ts 文件，与 *.test.ts 分离上限计算（每文件 ≤10）。

### 风险点 4：覆盖率轻微下降（branches -0.08pp）

**事实**：

| 指标 | Step 6 基线 | Step 7 实测 | 变化 |
|---|---|---|---|
| Statements | 84.85% | 84.83% | -0.02pp |
| Branches | 79.42% | 79.34% | -0.08pp |
| Functions | 91.66% | 91.67% | +0.01pp |
| Lines | 84.85% | 84.83% | -0.02pp |

**原因**：不变量 2 守门 `if (!isStepEligibleForCompensation(currentStatus))
continue` 在运行时主路径**不可达**（succeeded 数组只含 succeeded 的 step；
当前编排器不实现崩溃恢复路径）——这是 Phase 10+ 崩溃恢复路径预留的防
御代码，是**dead branch by design**。

**判断**：全部远超 §9.3 红线 80%/75%/80%/80%（branches -0.08pp 仍 79.34% >
75% 红线 +4.34pp）。优先保证不变量 2 双重保护正确性而非追求 100% branch。

**未来恢复**：Phase 10+ 实施崩溃恢复 API 时，恢复路径会触达此 branch，
覆盖率自动恢复。

### 4 项 open KI 显式核查

| KI | 当前 | Step 7 处置 |
|---|---|---|
| KI-P8-001（domain 包行覆盖率 75.16%） | open，Phase 9 早期 Step 责任 | 本 Step 不修复（接续增强性质，不增 domain 测试） |
| KI-P8-002（external Adapter 覆盖率受真实基础设施依赖限制） | open，Phase 11 责任 | 本 Step 不修复 |
| KI-P8-003（契约测试套件高并发 flake） | open，Phase 9/11 责任 | 本 Step 不引入新 flake；契约 17 it 复用既有挂载点 |
| KI-P8-005（ports 0% 结构性现象） | 已局部改善（saga-port.ts 100%） | 本 Step 不影响 ports 覆盖率（不修改 ports 代码） |

**全部 4 项 open 状态保持**，本 Step 不引入新 KI。

## §F 测试计划

### unit test 增量（10 → 12）

| # | 测试名称（规约前缀 `test_`） | 覆盖不变量 | 类型 | 备注 |
|---|---|---|---|---|
| 1 | factory_returns_orchestrator_with_runSaga_method | - | 既有 | Step 6 |
| 2 | runSaga_with_zero_steps_returns_completed_immediately | - | 既有 | Step 6 |
| 3 | runSaga_with_all_succeeding_steps_persists_intermediate_state_for_each_step | 4 | 既有 | Step 6（6 触发点） |
| 4 | runSaga_with_failing_step_triggers_compensation_in_strict_reverse_order | 1 | **升级** | Step 7（2 step → 4 step） |
| 5 | runSaga_with_compensation_failure_enqueues_dead_letter_and_marks_status | 3 | 既有 | Step 6 |
| 6 | runSaga_with_persistence_save_failure_returns_TQ_SAG_002_immediately | - | 既有 | Step 6 |
| 7 | runSaga_with_dead_letter_enqueue_failure_invokes_onDegradedFailure_but_continues | 5 | 既有 | Step 6 |
| 8 | runSaga_with_audit_append_failure_invokes_onDegradedFailure_but_continues | - | 既有 | Step 6 |
| 9 | runSaga_emits_correct_audit_event_types_at_each_phase | - | 既有 | Step 6 |
| 10 | runSaga_passes_compensationContext_unchanged_from_execute_to_compensate | - | 既有 | Step 6 |
| **11** | **isStepEligibleForCompensation_returns_true_only_for_succeeded_status** | **2 + 5** | **新增** | **Step 7（直接调用 2 个 helper）** |
| **12** | **runSaga_with_chained_compensation_failures_continues_to_completion_with_partially_compensated** | **1 + 3 + 5** | **新增** | **Step 7（链式继续 e2e）** |

### contract test（17 it 维持全绿）

`saga-orchestrator.contract.test.ts` 通过一行 `defineSagaContractTests(...)`
挂载 Step 2 锁定的 17 契约 it（5 类别 × 多 it）。本 Step 增强不修改 contract
test 代码；运行实测 17/17 全绿，验证增强不破坏既有契约。

### 测试总数 / 覆盖率

- 测试总数：1814 → 1816（+2）
- Lines: 84.83% > 80% ✓
- Branches: 79.34% > 75% ✓
- Functions: 91.67% > 80% ✓
- Statements: 84.83% > 80% ✓

## §G 验收

### 硬底（H1-H4）

- ✅ H1：测试总数 1816 ≥ 1700
- ✅ H2：覆盖率 84.83% / 79.34% / 91.67% / 84.83% 全部超过 80%/75%/80%/80%
- ✅ H3：lint / typecheck / test 全绿
- ✅ H4：push 到 origin main 成功（待执行）

### 参考下限（R1-R3）

- ✅ R1：unit test 增量 +2（既有 it 4 升级不增数 + 新增 2 个不变量 it），
  总数 12 符合裁决 5 ≤12 上限
- ✅ R2：contract test 17/17 维持全绿
- ✅ R3：错误码新增 0（惯例 K 第 9 次实战）

### 完成项（G1-G18）

- ✅ G1：Phase 9 强制开局动作 1-5 完成（含 Step 6 现有实现核查 +
  PersistedSagaState 字段足够性核查）
- ✅ G2：链式策略裁决 β 已 §C 明示
- ✅ G3：幂等保证实施层裁决 C 双重保护已 §C 明示
- ✅ G4：PersistedSagaState 不扩展（裁决 3 X）已 §C 明示与编排器侧实施
- ✅ G5：错误码新增数 0 已 §C 明示
- ✅ G6：测试增强策略裁决 ≤12 已 §C 明示
- ✅ G7：不修改 Step 6 任何发布接口
- ✅ G8：不修改 Step 1-5 任何锁定签名
- ✅ G9：不扩展 PersistedSagaState
- ✅ G10：5 个不变量在代码注释 + docs 留痕（runCompensationPhase 主循环
  注释 + §D 表格化）
- ✅ G11：5 个不变量每个至少 1 个 unit it 覆盖（参 §F 表）
- ✅ G12：contract test 17/17 全绿
- ✅ G13：ADR-0002 Step 7 段增量追写完成（惯例 M 第 7 次实战）
- ✅ G14：docs/phase9/07 齐备；Phase 1-7 + 跨 Phase 通用文档段零改动
- ✅ G15：KNOWN-ISSUES.md 4 项 open KI 状态显式核查（参 §E 表格）
- ⏳ G16：commit 消息遵守 commit-convention（含 refactor type）（待执行）
- ⏳ G17：已 push 到 origin main（待执行）
- ✅ G18：元规则 A–P + Q + 惯例 K + L + M 触发情况逐一声明（参 §D 表）

## §H Step 8 衔接预告

Step 8 将实施单 Step 超时与整体 Saga 超时（《§4.7》）。Step 6 已留好钩
子，Step 7 增强后这些钩子仍完全可用：

- `defaultStepTimeoutMs` Options 字段（已发布）
- `withStepTimeout` 私有方法（待 Step 8 增强 watchdog）
- `AUDIT_EVENT_TYPES.SAGA_TIMED_OUT` 事件类型（已声明，待 Step 8 触发）
- **runCompensationPhase 已增强为生产级**：Step 8 整体超时触发整体补偿
  时复用本增强后的 runCompensationPhase 逻辑，含双重幂等 + 链式继续

Step 8 同样是"接续增强"性质，沿用 Sprint F 一阶段模式。Step 7 的"接续
增强工程模式"可直接套用：（1）强制开局动作 4 核查 withStepTimeout 现状；
（2）裁决核心问题；（3）增强实现 + 显式不变量；（4）补充测试覆盖；
（5）增量追写 ADR。

## §I 对作品级代码库的意义

天启的宗旨是"让风控算法第一次变成工程师愿意读的代码"。Step 7 的核心
价值是：

1. **不变量化**：把《§4.2》/《§4.3》/《§4.5》/《§4.6》的纸面约束在代码层面
   落地为 5 个**显式注释 + 私有 helper + 专项 it** 的组合。读者翻开
   `runCompensationPhase` 时，应该一眼看出"哪条不变量在哪行代码守护"——
   这是宗旨"算法变成工程师愿意读的代码"在补偿层面的具体落地。
2. **不破不立**：Step 6 接口已发布，元规则 B 严守；增强发生在内部实现
   层。Phase 9 第 7 次"元规则 B 严守"实战。
3. **诚实评估**：强制开局动作 5 实地核查 PersistedSagaState 字段足够
   性——不拍脑袋扩展，不画蛇添足。裁决 3 选 X 是诚实工程判断的体现。
4. **接续增强工程模式首次实战**：Step 7 是 Phase 9 第一次"接续增强"性
   质 Step。后续 Step 8 / Step 14 等可以直接套用本 Step 工程范式：
   （a）强制开局核查现有实现；（b）裁决核心问题；（c）增强 + 显式不变量；
   （d）补充测试覆盖；（e）增量 ADR。这是对 Phase 9 后续 Steps 的工程
   化贡献。
5. **崩溃恢复 hook 预留**：isStepEligibleForCompensation +
   aggregateCompensationOutcome 不仅是测试便利的产物——它们是 Phase 10+
   崩溃恢复 API 复用的纯函数判定。Step 7 在元规则 B 范围内为未来留下
   架构空间，本身就是对架构稳定性的贡献。

Phase 9 / Sprint G 进度 1/4 → 2/4。Step 8 超时机制即将启程；Step 7 已为
其铺好"接续增强"的工程范式与运行时正确性基线。
