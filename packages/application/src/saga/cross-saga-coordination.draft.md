# Cross-Saga Coordination — DRAFT 接口草案（Phase 9 / Step 14）

> **状态**：DRAFT — 等待用户审视
> **版本**：v1（首次提交）
> **草案时间**：2026-05-01
> **覆盖 Step**：Phase 9 / Sprint H Step 14（Sprint H 收官战 + Phase 9 后期复杂度峰值）
> **冻结时点**：用户 APPROVE 后第二阶段 PHASE_IMPLEMENT 启动时
> **作废时点**：第二阶段实施完成后本 .md 立即删除（设计沉淀进 ADR-0002 + 实际代码）

本草案是 Phase 9 第二次拆两阶段流程的产物（首次 Step 6 SagaOrchestrator）。
拆两阶段理由：跨 Saga 协调是全新概念 + 接口冻结后影响 Sprint I 收官 5 Step
+ 业务现实复杂度可能高于 Step 6（实测倾向轻量，见 §B）。

---

## A. 强制开局动作 1-6 执行确认

### A.1 动作 1（重读两份文档）

| 文档 | 关键章节 | 与本 Step 直接相关的约束 |
|---|---|---|
| 《宪法》§13.1 | 并发原则三条 | (1) 同 case_id 串行化或乐观锁；(2) 跨 case 资源隔离；(3) **不允许全局大锁** |
| 《宪法》§13.3 | Saga / 补偿 | 跨外部系统多步动作用应用层 Saga（已 Sprint G/H 落地） |
| 《补充》§4.5 | 状态持久化 | Saga 推进状态必须持久化；进程崩溃后必须能从持久化状态恢复 |
| 《补充》§4.6 | 死信约束 | 每条死信携带 sagaId / stepName / context / failureChain / enqueuedAt |
| 《补充》§4 全部 | 8 条约束 | Sprint F-G 全部落地（§4.1-§4.8）；本 Step 不修改 |

### A.2 动作 2（核查 KNOWN-ISSUES）

| KI | 状态 | 与本 Step 关系 |
|---|---|---|
| KI-P8-001 | open | domain 包行覆盖率 75.16%；本 Step 不修复（不触碰 domain） |
| KI-P8-002 | open | external Adapter 受真实基础设施限制；本 Step 不修复（不触碰 Adapter） |
| KI-P8-003 | open | 高并发 flake；**本 Step 提防** —— 集成测试不引入 < 100ms 时序断言 |
| KI-P8-005 | open | ports 0% 结构性现象；本 Step 不引入新 Port（裁决 6） |

### A.3 动作 3（核查 ADR-0001 + ADR-0002）

- ADR-0001（Phase 8 14 元规则 + 2 惯例）：本 Step 全部继承
- ADR-0002（Phase 9 15+3 元规则与惯例 + Step 1-13 全部段）：
  - **元规则 B（接口冻结）**：本 Step 严守 —— Step 1-13 任何已锁定签名一字未改
  - **元规则 F（独立编排）**：本 Step 严守 —— 不修改既有 5 个 saga 模块（saga-orchestrator / saga-manual-intervention / liquidation-saga / adl-saga / insurance-fund-saga / state-transition-saga）
  - **元规则 Q（Phase 9 强制开局）**：第十四次实战
  - **惯例 K（错误码"仅必需"）**：第十六次实战
  - **惯例 M（ADR 增量追写）**：第十四次实战
  - **拆两阶段流程**：第二次实战（首次 Step 6）
- 本 Step 完成后必须向 ADR-0002 增量追加 Step 14 段（DRAFT → 正式 + 实施细节）+ **Sprint H 收官小结段**

### A.4 动作 4（业务现实核查 — 关键，详见 §B）

完成。结论：**业务现实倾向轻量场景**。详见 §B 完整论证。

### A.5 动作 5（Sprint F Adapter 并发支持核查 — 详见 §C）

完成。结论：既有 Adapter 并发支持足够支撑本 Step 轻量协调机制。详见 §C。

### A.6 动作 6（4 业务 Saga 接口并发语义核查 — 详见 §D）

完成。结论：4 业务 Saga sagaId 命名约定一致；协调模块可基于此实现"同 caseId 活跃 Saga 检查"。详见 §D。

---

## B. 强制开局动作 4 实地核查结果（业务现实判断）

### B.1 Phase 1-7 既有代码并发处理迹象

实地搜索（grep `Promise.all` / `concurrent` / `parallel` / `并发` / `isolation` / `race`）：

| 维度 | 实地观察 |
|---|---|
| domain 层 | 0 命中（domain 不持有并发原语；与 P5 纯核心一致） |
| policy 层 | 0 命中 |
| application 层（Phase 1-7） | 0 命中并发原语；仅命令处理流程线性调度 |
| application 层（Phase 9 saga） | 0 命中 `Promise.all`（每个 Saga 内部 step 严格顺序；编排器内部 step 间也顺序） |

### B.2 业务现实关键问题逐一回答

**Q1：同一 caseId 是否可能同时触发 Liquidation + ADL？**

回答：**否**（业务流程语义不允许）。

理由：
- Tianqi 业务流程是显式状态机推进（§宪法 P2）
- LiquidationCase / ADLCase 是 RiskCase 的子案件，**串行触发**：Liquidation 失败（保证金不足以平仓）→ ADL（自动减仓）→ InsuranceFund（保险资金兜底）
- StateTransitionSaga 是状态机推进本身，与三个业务 Saga 串行配对
- domain 层 risk-case-state-machine.ts 锁定了状态迁移规则，禁止"两个子案件同时活跃"

**Q2：同一 InsuranceFund 是否可能被多个 Saga 同时消耗？**

回答：**理论上可能但业务现实未表达**。

理由：
- 不同 caseId 都触发了 InsuranceFundSaga，理论上可能并发
- 但 Tianqi 的业务现实里，InsuranceFund 消耗是**记账型操作**（增减账户余额），不是争抢稀缺资源
- FundEnginePort.transferFund 自身是 §4.2 幂等的；并发调用各自带 idempotencyKey
- 真实"InsuranceFund 池容量耗尽"场景属于 Phase 10+ 的"资金池容量预算管理"职责，不在 Phase 9 范围

**Q3：同一 PositionId 是否可能在多 Saga 中被同时修改？**

回答：**否**（一个 Position 属于一个 caseId 的处置范围）。

理由：
- 一个仓位在某个时刻只能属于一个 caseId 的处置
- 多个 caseId 各自处置自己的仓位集合，不重叠
- PositionEnginePort.placeOrder/cancelOrder 自身是 §4.2 幂等的

### B.3 既有 Adapter 并发语义观察

`saga-state-store-memory` (Map.get/set/has)：
- Node.js 单线程 event loop 保证原子性
- `listIncomplete()` 遍历 Map.values()，不会看到部分写入状态
- 多实例 `createInMemorySagaStateStore()` 互不可见（README.md Semantics 条款 3）

`saga-state-store-postgres`（参考 ADR Step 3）：
- PRIMARY KEY 由 sagaId 保证 save 唯一性
- listIncomplete 在 READ COMMITTED 隔离下可能看到 in-flight commit（可接受）
- `dead-letter-store-postgres` 同语义

### B.4 业务团队预期（如有可查文档）

- Phase 1-7 文档中无显式表达"多 Saga 并发资源冲突"业务需求
- Phase 8-12 补充文档 §4 全部约束聚焦"单 Saga 内部"语义
- §13.1 第 1 条"同 case_id 串行化"已是当前阶段最强约束

### B.5 关键判断（基于 B.1-B.4 实地核查）

**业务现实判断 = 预期 A 轻量场景**（与 prompt 推荐一致）。

理由汇总：
1. Tianqi 业务流程语义禁止"同 caseId 多 Saga 同时活跃"（B.2 Q1）
2. 资源冲突场景未被 Phase 1-7 表达（B.4）
3. 既有 IdempotencyPort 已处理"命令层重复"（命令层 IdempotencyKey = caseId + actionType + requestId）
4. **真正缺失**：Saga 层"同 caseId 防重复触发"防御机制 —— Saga 启动前未做活跃 Saga 检查
5. 重量级跨 Saga 协调器（资源公平 / 死锁防御 / 优先级调度）无业务现实支撑，违反"克制 > 堆砌"
6. 真实跨 Saga 资源冲突场景由 Phase 10+ 实地遇到时通过 ADR 修订流程引入

---

## C. 强制开局动作 5 实地核查结果（Sprint F Adapter 并发支持）

### C.1 SagaStateStorePort 接口并发能力（§packages/ports/src/saga-state-store-port.ts）

```
type SagaStateStorePort = {
  save(state: PersistedSagaState): Promise<Result<void, ...>>;        // upsert by sagaId
  load(sagaId: SagaId): Promise<Result<PersistedSagaState | null, ...>>;
  listIncomplete(): Promise<Result<ReadonlyArray<PersistedSagaState>, ...>>;
  delete(sagaId: SagaId): Promise<Result<void, ...>>;
};
```

**并发分析**：
- `save`：upsert by sagaId；同 sagaId 多次调用 last-write-wins
- `load`：按 sagaId 单点查询
- `listIncomplete`：返回 `overallStatus ∈ {"in_progress", "compensating"}` 的全部 saga
- `delete`：幂等（不存在时仍返回 ok）

**对本 Step 的支撑**：
- ✅ `listIncomplete()` 是核心 —— 返回所有未终态 saga，由协调模块在 Application 层做 caseId 过滤
- ⚠️ `PersistedSagaState` **不含 caseId 字段**；caseId 编码在 sagaId（前缀模式 `{kind}-saga-{caseId}-{stamp}`）和 correlationId（前缀模式 `corr-{kind}-{caseId}`）中

### C.2 PersistedSagaState 字段集（10 字段，Step 3 锁定）

```
{
  sagaId: SagaId;                                  // 含 caseId 编码
  sagaStartedAt: string;                            // ISO-8601 UTC
  lastUpdatedAt: string;                            // ISO-8601 UTC
  currentStepIndex: number;
  totalSteps: number;
  stepStatuses: ReadonlyArray<SagaStepStatusSnapshot>;
  compensationContexts: ReadonlyArray<PersistedCompensationEntry>;
  overallStatus: PersistedSagaStateOverallStatus;
  correlationId: CorrelationId | null;             // 含 caseId 编码
  traceId: TraceId | null;
}
```

**关键观察**：caseId 不是字段，只存在于 sagaId / correlationId 字符串内部。本 Step 协调模块通过**字符串前缀解析**反推 caseId（详见 §F 接口草案）。

### C.3 in-memory adapter 并发安全性

`saga-state-store-memory.ts` 实测（已读取源码）：
- `Map.set` / `Map.get` / `Map.has`：Node.js 单线程 event loop 内原子（无中间状态可见）
- `listIncomplete()` 遍历 `Map.values()`：不会看到部分写入；可能"看不到刚 set 但未 await 完成的"（取决于事件循环时序）—— 这是单线程 JavaScript 的标准语义，对本 Step 协调模块**足够**

### C.4 Sprint F Adapter 并发支撑结论

**支撑足够**。本 Step 协调模块的"轻量场景"机制（仅查询 listIncomplete + 字符串过滤）完全在既有 Adapter 能力范围内。

**已知局限性**（Phase 10+ 责任，本 Step 不解决）：
- 跨进程 / 跨实例的 sagaId 唯一性：单进程内由 invocationCounter 保证；跨进程需要 UUIDv4 调用方负责
- listIncomplete 在 postgres 多事务下的 isolation 行为：READ COMMITTED 默认；可能看到 in-flight commit
- 高并发下 KI-P8-003 时序 flake：本 Step 集成测试不引入 < 100ms 时序断言（提防 KI-P8-003 加剧）

---

## D. 强制开局动作 6 实地核查结果（4 业务 Saga 接口并发语义）

### D.1 4 业务 Saga sagaId / correlationId 命名约定（grep 实地核查）

| Saga | sagaId 模式 | correlationId 模式 |
|---|---|---|
| LiquidationSaga | `liquidation-saga-{caseId}-{stamp}` | `corr-liquidation-{caseId}` |
| ADLSaga | `adl-saga-{caseId}-{stamp}` | `corr-adl-{caseId}` |
| InsuranceFundSaga | `insurance-fund-saga-{caseId}-{stamp}` | `corr-insurance-fund-{caseId}` |
| StateTransitionSaga | `state-transition-saga-{caseId}-{stamp}` | `corr-state-transition-{caseId}` |

`stamp = ${Date.now()}-${invocationCounter}`（每个业务 Saga 模块各持有自己的 `let invocationCounter = 0`，per-process）。

### D.2 同 caseId 重复触发 runForCase 的语义（实地推导）

**同进程内重复触发**：
- 各自获得不同 sagaId（counter 自增）—— 不会冲突
- 编排器互不感知（各自独立的 SagaOrchestrator 实例 + 独立的 invocation）
- 两次 runForCase 都会推进；调用 5 业务 Engine 的副作用都会发生

**跨进程重复触发（极罕见碰撞）**：
- 同 Date.now() 毫秒 + 相同 invocationCounter（两个进程都刚启动）
- 实际生产部署 invocationCounter 跨进程不共享 —— 真实风险接近 0
- 但**业务上"同 caseId 重复触发"风险高于 sagaId 碰撞**：调用方代码错误 / 重试 / 消息重复

### D.3 不同 caseId 并发触发 runForCase 的语义

完全独立：sagaId 不同 / correlationId 不同 / state 互不可见 / Engine 调用各自带 idempotencyKey。

**这是 Tianqi 业务上的预期场景**：多个 risk case 并发处理是必须支撑的。

### D.4 业务 Saga 接口并发语义结论

**4 业务 Saga 接口并发语义对协调模块友好**：

✅ sagaId 命名约定一致 —— 可基于此前缀解析 caseId / sagaKind
✅ runForCase 是无状态启动 —— 每次调用独立 SagaOrchestrator + 独立 invocation
✅ correlationId 同 caseId 不同 saga kind 共享 —— 协调模块可基于此跨 sagaKind 关联

⚠️ **缺失防御**：runForCase 启动前未检查"同 caseId 是否已有活跃 Saga" —— 这是本 Step 协调模块的核心交付。

⚠️ **设计选择**：协调模块**不修改**任何业务 Saga 的 runForCase 接口（元规则 B 严守）；调用方在 runForCase 前**显式调用** `checkActiveSagaForCase` 实现防御。

---

## E. 7 个核心裁决摘要

### 裁决 1：场景轻重判断 = α 轻量场景

**候选**：α 轻量 / β 重量 / γ 分层

**选 α 轻量**。

**理由**（基于 §B 业务现实核查）：
1. Tianqi 业务流程语义禁止"同 caseId 多 Saga 同时活跃"
2. 资源冲突场景未被 Phase 1-7 表达
3. IdempotencyPort 已处理"命令层重复"
4. Saga 层真正缺失的是"同 caseId 防重复触发"
5. 重量级会引入"为复杂度而复杂度"，违反"克制 > 堆砌"
6. β / γ 把不需要的能力提前布局违反《§22.1》"严禁 TODO 逃避"和"克制 > 堆砌"宗旨

**对实施规模的影响**：
- 第二阶段 LOC ≤ 300（轻量场景下限）
- 单元测试 ≤ 6 / 集成 ≤ 4
- 0 新增错误码 / 0 新增 Port

### 裁决 2：唯一性保证机制 = A（SagaStateStore.listIncomplete + caseId 前缀过滤）

**候选**：A listIncomplete + 过滤 / B 新 SagaActivityStore Adapter / C 仅靠 SagaInvocation.sagaId 唯一

**选 A**。

**理由**：
- A 不引入新 Adapter（克制 > 堆砌）
- B 违反 Sprint H 模板纪律（不引入新 Port）+ 重复了 SagaStateStore 的本职
- C 仅靠 sagaId 唯一不能告诉调用方"是否有同 caseId 已活跃 Saga"
- A 复用既有 4 业务 Saga 命名约定（D.1）—— 命名约定本身已是"事实标准"，本 Step 提升为"协调模块的契约"

**实现细节**：
- 协调模块查询 `sagaStateStore.listIncomplete()` 获取所有未终态 saga
- 字符串前缀匹配过滤 sagaId（解析 `{kind}-saga-{caseId}-{stamp}`）
- 返回 `ReadonlyArray<ActiveSagaInfo>`（可能多个：同 caseId 不同 kind 都在活跃）

### 裁决 3：协调模块归属位置 = α（与既有 saga 模块同目录平级）

**候选**：α `packages/application/src/saga/cross-saga-coordination.ts` / β 独立 `packages/application/src/coordination/cross-saga.ts`

**选 α**。

**理由**：
- 与 Step 9-13 5 个 saga 模块同目录平级（saga-orchestrator / saga-manual-intervention / liquidation-saga / adl-saga / insurance-fund-saga / state-transition-saga）
- 扁平结构（宗旨第 5 条"文件结构扁平 > 目录嵌套"）
- 协调机制本身是 saga 范畴内的辅助设施，归 saga 子目录合理
- β 独立目录违反"扁平 > 嵌套"

### 裁决 4：协调函数形态 = γ（轻量工厂闭包 + 单方法接口）

**候选**：α 纯函数 helper / β 工厂闭包 / γ 工厂闭包 + 单方法接口

**选 γ**。

**理由**：
- 与 Step 6/9/10-13 工厂闭包风格一致（一致性 > 微优化）
- 闭包持有 ports + options（譬如 sagaKind allowlist），便于测试注入与配置
- 单方法 `checkActiveSagaForCase(input)` 与既有 saga 工厂的 `runForCase` / `processDeadLetter` 风格一致
- 协调机制本身无运行时长生命周期（不持有 watchdog 等内部状态）—— 但工厂闭包形态是 Tianqi 应用层 Adapter / Saga 模块的事实标准，保持风格一致

### 裁决 5：错误码新增 = 0

**候选**：0 / 1（同 caseId 已有活跃 Saga 错误） / 2（含死锁检测）

**选 0**。

**理由**：
- "同 caseId 已有活跃 Saga"不是错误，是返回 `ActiveSagaInfo[]` 让调用方决定
- 协调模块本身只查询，不抛错
- listIncomplete 失败时透传 SagaStateStoreError → wrap 为 SagaPortError（复用 TQ-INF-019/020）
- 惯例 K 第十六次实战仍按"仅必需"原则
- Phase 10+ 真实跨 Saga 协调需要时再引入

### 裁决 6：是否引入新 Port = 强守（不引入）

**候选**：强守 / 仅扩展 ADR-0002 修订流程扩展既有 Port

**选强守**。

**理由**：
- Sprint H 模板纪律延续 —— 业务 Saga 不引入新 Port
- 跨 Saga 协调本身**纯消费**：仅需要 SagaStateStorePort.listIncomplete
- 新 Port 会破坏元规则 B + Sprint H 模板纪律
- 既有 SagaStateStorePort 接口已足够

### 裁决 7：测试策略 = 单元 ≤6 + 集成 ≤4 + 无契约测试

**候选**：单元 ≤6 / ≤10；集成 ≤4 / 不限；契约 / 无契约

**选**：单元 ≤6 + 集成 ≤4 + **不挂载 defineSagaContractTests**。

**理由**：
- 协调模块**不构造 SagaStep 集合** —— 不是业务 Saga，不适合挂载 SagaContractTests
- 单元测试 ≤6 覆盖：(1) 同 caseId 无活跃 Saga / (2) 同 caseId 一个活跃 Saga / (3) 同 caseId 多个活跃 Saga / (4) 不同 caseId 不互相干扰 / (5) sagaKind 过滤 / (6) listIncomplete 失败错误传播
- 集成测试 ≤4 覆盖：(1) 单 Saga 真实活跃下检查 / (2) 同 caseId 双 Saga 真实并发场景模拟 / (3) Saga 终态后被排除 / (4) sagaKind 过滤端到端
- G24 要求"测试覆盖跨 Saga 真实并发场景（即使是轻量也要至少 1 集成 it）" —— 已通过集成 it 2 满足

---

## F. 接口草案要点（5-10 行高亮）

```typescript
// packages/application/src/saga/cross-saga-coordination.ts

/** 4 业务 Saga 命名约定字面量（与 Step 10-13 锁定一致；元规则 B 在审计层级） */
export type BusinessSagaKind =
  | "liquidation"
  | "adl"
  | "insurance-fund"
  | "state-transition";

/** 同 caseId 活跃 Saga 摘要 */
export type ActiveSagaInfo = {
  readonly sagaId: SagaId;
  readonly caseId: string;
  readonly sagaKind: BusinessSagaKind;
  readonly startedAt: string; // ISO-8601 UTC（取自 PersistedSagaState.sagaStartedAt）
  readonly overallStatus: "in_progress" | "compensating";
};

export type CrossSagaCoordinationPorts = {
  readonly sagaStateStore: SagaStateStorePort;
};

export type CrossSagaCoordinationOptions = {
  /** 仅检查指定 sagaKind 子集；undefined = 检查全部 4 种 */
  readonly sagaKindFilter?: ReadonlyArray<BusinessSagaKind>;
};

export type CrossSagaCoordination = {
  /**
   * 检查同 caseId 当前是否有活跃 Saga。
   *
   * @param input.caseId 业务案件标识
   * @param input.sagaKindFilter 可选：仅检查指定 sagaKind 子集
   * @returns 同 caseId 的全部活跃 Saga 摘要数组（按 startedAt 升序）；
   *          空数组表示当前无活跃 Saga（调用方可安全启动新 Saga）
   *
   * 使用场景：业务 Saga 调用方在 runForCase 前调用本方法防御重复触发：
   *   const active = await coord.checkActiveSagaForCase({ caseId });
   *   if (!active.ok) return err(...);
   *   if (active.value.length > 0) {
   *     // 已有活跃 Saga；调用方决定拒绝 / 等待 / 强制覆盖
   *     return err({ code: "TQ-...", message: "case already has active saga" });
   *   }
   *   // 安全启动新 Saga
   *   await liquidationSaga.runForCase(input);
   */
  checkActiveSagaForCase(input: {
    readonly caseId: string;
    readonly sagaKindFilter?: ReadonlyArray<BusinessSagaKind>;
  }): Promise<Result<ReadonlyArray<ActiveSagaInfo>, SagaPortError>>;
};

export const createCrossSagaCoordination: (
  ports: CrossSagaCoordinationPorts,
  options?: CrossSagaCoordinationOptions
) => CrossSagaCoordination;
```

**接口要点**（≤10 行）：
1. `BusinessSagaKind` 4 字面量与 Step 10-13 命名约定锁定一致
2. `ActiveSagaInfo` 5 字段（sagaId / caseId / sagaKind / startedAt / overallStatus）
3. `CrossSagaCoordinationPorts` 仅含 1 Port（SagaStateStore） —— 最小依赖
4. `CrossSagaCoordinationOptions` 1 可选字段 sagaKindFilter
5. 主接口 `checkActiveSagaForCase` 返回 `Result<ReadonlyArray<ActiveSagaInfo>, SagaPortError>`
6. 工厂闭包 `createCrossSagaCoordination(ports, options?)` 与既有 saga 模块风格一致
7. 0 新错误码 / 0 新 Port
8. 调用方在 runForCase 前显式调用 —— **不修改任何业务 Saga 接口**（元规则 B 严守）
9. 字符串前缀解析作为 sagaId → (sagaKind, caseId) 映射机制
10. 终态 Saga 自动被 listIncomplete 排除 —— 无需协调模块额外过滤

---

## G. 与 Sprint H 4 个业务 Saga 的关系

### G.1 调用关系

```
                      [应用层调用方]
                          │
                          ▼
        ┌─────── checkActiveSagaForCase(caseId) ───────┐
        │                                              │
        ▼                                              ▼
[CrossSagaCoordination]              [LiquidationSaga / ADLSaga /
        │                              InsuranceFundSaga /
        │                              StateTransitionSaga]
        │                                              │
        ▼                                              ▼
[SagaStateStorePort]               [SagaOrchestrator + 5 业务 Engine]
        │                                              │
        ▼                                              ▼
   listIncomplete()                            runSaga() / save()
```

**关键观察**：
- 协调模块和 4 业务 Saga **共享同一个 SagaStateStorePort 实例**（调用方注入）
- 协调模块**不依赖**任何业务 Saga 模块（零 import）—— 元规则 F 独立编排
- 4 业务 Saga 模块**不感知**协调模块的存在（git diff zero）

### G.2 调用方使用模式（推荐）

```typescript
// Phase 10+ 调用方代码（本 Step 不实现，仅留示意）
const coord = createCrossSagaCoordination({ sagaStateStore });
const liquidationSaga = createLiquidationSaga(ports, options);

async function safeRunLiquidation(input: LiquidationInput) {
  const active = await coord.checkActiveSagaForCase({
    caseId: input.caseId,
    sagaKindFilter: ["liquidation", "adl", "insurance-fund"]  // 拒绝交叉
  });
  if (!active.ok) return active;
  if (active.value.length > 0) {
    // 已有活跃 Saga：调用方决定如何处置
    return err({
      code: "TQ-...",
      message: `case ${input.caseId} already has ${active.value.length} active saga(s)`
    });
  }
  return liquidationSaga.runForCase(input);
}
```

**关键观察**：
- 调用方决定"拒绝 / 等待 / 强制覆盖"业务策略 —— 协调模块不替业务做决定
- 调用方决定 sagaKindFilter 范围 —— 譬如允许 StateTransition 与 Liquidation 共存（业务上合理：状态机推进可与业务 Saga 并行），但拒绝两个 Liquidation

### G.3 元规则 B 兑现证据

本 Step 完成后预期 git diff zero 验证：
```bash
# 5 个既有 saga 模块零修改
git diff origin/main -- packages/application/src/saga/saga-orchestrator.ts
git diff origin/main -- packages/application/src/saga/saga-manual-intervention.ts
git diff origin/main -- packages/application/src/saga/liquidation-saga.ts
git diff origin/main -- packages/application/src/saga/adl-saga.ts
git diff origin/main -- packages/application/src/saga/insurance-fund-saga.ts
git diff origin/main -- packages/application/src/saga/state-transition-saga.ts
# 全部输出零 diff
```

跨 Step 9-14 共 6 个 Step，5 个既有 saga 模块**git diff zero**（Step 14 起 6 个，含 state-transition-saga.ts）。

---

## H. 元规则 / 惯例触发（DRAFT 阶段）

| 规则 / 惯例 | 触发情况 |
|---|---|
| **元规则 B（接口冻结）** | 严守 —— Step 1-13 任何已锁定签名一字未改；预期跨 6 个 saga 模块 git diff zero |
| **元规则 F（独立编排）** | 严守 —— 协调模块零 import 既有 saga 模块；不修改任何 saga 内部 |
| **元规则 Q（强制开局）** | 第十四次实战（Phase 9 全部 Step 都执行强制开局） |
| **惯例 K（错误码"仅必需"）** | 第十六次实战 —— 0 新错误码（裁决 5） |
| **惯例 L（unit 上限）** | ≤ 6 单元 it（业务模块单独计算） |
| **惯例 M（ADR 增量追写）** | 第十四次实战（含 Sprint H 收官小结段） |
| **拆两阶段流程** | 第二次实战（首次 Step 6） |
| 元规则 A / C / D / E / G / H / I / J / N / O / P | 全 N/A |
| 元规则 N（pure helper 单测） | 视实施时是否 export sagaId 解析 helper 决定（DRAFT 阶段未定） |

---

## I. 核心未决判断（请重点审视）

### I.1 sagaId 字符串前缀解析的脆弱性

**事实**：协调模块通过 sagaId 字符串前缀（`{kind}-saga-{caseId}-{stamp}`）反推 sagaKind 和 caseId。这是 Step 10-13 4 业务 Saga 的事实命名约定。

**潜在风险**：
- 命名约定**未在类型层面强制**（任何 Saga 都可以构造任意 sagaId 字符串）
- 若 Phase 10+ 引入第 5 个业务 Saga 但命名不遵循 `{kind}-saga-{caseId}-{stamp}` 模式，协调模块的解析会失效
- 若 caseId 内部含 `-saga-` 子串（极端情况），解析会出错

**草案处置**：
- 在 ADR-0002 Step 14 段显式记录命名约定为"事实契约"
- 解析器实现侧用宽松匹配 + 防御式 null 返回（解析失败的 saga 不计入活跃集合）
- 不引入"sagaId 必须符合命名约定"的运行时验证（违反元规则 B）

**审视点**：用户是否同意"接受字符串前缀解析的脆弱性，作为 Sprint H 模板纪律延续的代价"？或要求引入更显式的字段（譬如 PersistedSagaState 增加 caseId 字段，但这会破坏元规则 B）？

### I.2 不替业务做"拒绝/等待"决策

**事实**：协调模块仅返回 `ActiveSagaInfo[]`，不抛错；调用方自行决定"已有活跃 Saga 时拒绝 / 等待 / 强制覆盖"。

**潜在风险**：
- 调用方代码可能忘记调用 checkActiveSagaForCase，导致防御失效
- 业务策略分散在多个调用方（重复代码）

**草案处置**：
- 不强制（业务策略本应灵活）
- ADR-0002 + 模块 README 留痕"推荐使用模式"（§G.2 示意代码）
- Phase 10+ 若发现调用方分散逻辑成为问题，再引入"包裹工厂" `createGuardedLiquidationSaga(ports)` 作为可选 helper

**审视点**：用户是否同意"协调模块仅是查询工具，不替业务做决策"？或要求引入更主动的"防御性包裹"？

### I.3 BusinessSagaKind 字面量与未来 Saga 扩展

**事实**：`BusinessSagaKind` 是 4 字面量联合（`"liquidation" | "adl" | "insurance-fund" | "state-transition"`）。

**潜在风险**：
- Phase 10+ 引入第 5 个业务 Saga 时**必须**修改本类型 —— 元规则 B 在类型层面"扩展枚举值"是允许的（与 SagaStepStatus 一次性 8 值同型策略不同 —— 后者一次性定义齐全）
- 但本类型由 4 业务 Saga 命名约定决定，不应"一次性定义齐全所有未来可能的 Saga"

**草案处置**：
- 接受类型层面会随 Saga 引入而增量扩展
- 这是惯例 M（ADR 修订流程）天然支撑的演进路径
- 与 Sprint H 4 业务 Saga 命名约定语义对应；命名约定改了，类型就改

**审视点**：用户是否同意"BusinessSagaKind 增量扩展"作为可接受的演进路径？或要求引入更宽松的 `string` 类型（损失类型安全 + 失去命名约定证据）？

### I.4 listIncomplete 在大规模生产场景的扩展性

**事实**：协调模块每次 checkActiveSagaForCase 都调用 listIncomplete()（返回所有未终态 saga）。

**潜在风险**：
- 生产环境同时活跃 saga 数量可能成百上千 —— listIncomplete 全表扫描成本高
- 协调模块在 Application 层做字符串过滤 —— Adapter 没有"按 caseId 过滤"的索引能力

**草案处置**：
- 接受 O(n) 扫描成本（n = 当前活跃 saga 数）
- Phase 10+ 若发现性能瓶颈，引入"by caseId 索引查询" Adapter 扩展（通过 ADR-0002 修订流程）
- 不在本 Step 引入新 Port 接口（违反裁决 6）

**审视点**：用户是否同意"接受 O(n) 扫描成本作为轻量场景的折中"？或要求引入"按 caseId 过滤"接口扩展（这会破坏元规则 B）？

### I.5 草案 LOC 预估

| 文件 | 预估 LOC |
|---|---|
| `cross-saga-coordination.ts` | ~150-200 |
| `cross-saga-coordination.test.ts` | ~250-300（≤6 unit it） |
| `cross-saga-coordination.integration.test.ts` | ~200-250（≤4 集成 it 含跨 Saga 真实并发） |
| **合计** | ~600-750 |

**审视点**：用户是否接受合计 ~600-750 LOC（轻量场景预期 ≤300 LOC 已超 —— 但测试占大头）？

---

## J. 草案版本控制与作废

- 本草案以 `cross-saga-coordination.draft.md` 形式存储于代码仓库 saga 子目录
- 第二阶段 PHASE_IMPLEMENT 实施完成后**必须删除本文件**
- 删除时机：与 ADR-0002 Step 14 段从 DRAFT 升级为正式段同时
- 设计沉淀进 ADR-0002 + 实际代码 + docs/phase9/14 执行记录

---

**草案完成。请审视后回执 APPROVE / REQUEST_CHANGES + 反馈 / REJECT + 重大方向调整。**
