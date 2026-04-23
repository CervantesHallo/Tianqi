# Phase 8 / Step 2 — Adapter 共享基础能力接口与错误码命名空间扩展

## A. 为什么 Phase 8 需要 Adapter 共享基础能力接口

Phase 8 将在 Step 4–18 内落地 EventStore / Notification / Config / External Engine 四类 Adapter，共计 10 个以上独立包。任何两个 Adapter 之间，"如何被运维看到（健康）"与"如何被应用进程启停（生命周期）"都是同一个问题，没有一个具体 Adapter 可以拒绝回答它们。

如果让每个 Adapter 自定义健康检查与启停接口，最终得到的是 10 种"差不多"的实现：有的抛异常、有的返回 `{ ok: false }`、有的同步、有的异步、有的在关闭后仍残留后台计时器。运维、可观测性、应用层 orchestrator 都要适配 10 种方言。更糟糕的是，`adapter-testkit` 将不可能写出一套统一的契约测试套件，因为连最底层的"能不能健康检查"都不统一。

把 HealthCheck 与 Lifecycle 提成 Adapter 层横切契约、放在 `@tianqi/ports` 而非任何具体 Port 内，是把"10 份近似实现"压缩为"1 份强约束接口 + 10 份对同一接口的具体实现"。Step 4 起，任何 Adapter 首次合入之前都必须同时通过 `@tianqi/adapter-testkit` 的 HealthCheck / Lifecycle 契约测试套件（当前为骨架），这条门禁在本 Step 就已就位，等待 Step 3 起填充具体契约 case。

## B. HealthCheck 契约的具体语义

`AdapterHealthCheck` 定义单一方法 `healthCheck(): Promise<AdapterHealthStatus>`。它的全部语义都在以下三条硬约束里：

1. **不抛异常**：`healthCheck` 返回的 `Promise` 必须在任何情况下以 resolve 形式结束；健康失败以 `healthy: false` 加 `details` 表达，而不是以 throw / reject 表达。抛异常会让调用方（运维面板、观测收集器、应用层 orchestrator）必须对所有 Adapter 写 `try/catch`，抵消了契约的价值。
2. **无副作用**：`healthCheck` 不得写库、不得发消息、不得修改任何运行态状态。这条约束让健康检查可以被高频调用（例如每秒），而无需担心副作用放大。
3. **结构化结果**：`AdapterHealthStatus` 字段严格定义——`adapterName: string`、`healthy: boolean`、`details: AdapterHealthDetails`、`checkedAt: string`（UTC ISO-8601）。`details` 的值类型收敛为 `string | number | boolean | null` 四种可 JSON 序列化的原语，禁止出现领域对象、闭包、Error 实例等不可序列化的值。

关于 `checkedAt` 的时间格式：仓库自 Phase 1 起对事件时间戳统一使用 UTC ISO-8601（见 `packages/contracts/src/domain-event-envelope.ts` 的 `ISO_8601_PATTERN` 校验），《宪法》§9.1 要求项目内时间格式"统一一种，不得混用"。因此 HealthCheck 的时间字段沿用 ISO-8601，与仓库现状对齐。

## C. Lifecycle 契约的幂等性与资源释放承诺

`AdapterLifecycle` 定义两个方法：`init()` 与 `shutdown()`，均返回 `Promise<void>`。两条硬约束：

1. **幂等**：`init()` 重复调用不得产生额外副作用；`shutdown()` 在一次成功关闭后重复调用亦不得抛错。本 Step 的单元测试通过侧信道计数器验证：连续三次 `init()` 后内部"首次初始化"计数器仍为 1；首次 `shutdown()` 后再次 `shutdown()` 以 resolve 结束。
2. **资源释放承诺**：`shutdown()` 返回时，Adapter 已释放所有持有的外部资源（连接、句柄、后台计时器）。契约测试在 Step 3 落地具体 case 时会通过外部探针验证这一点（例如检查连接池已关闭）。

两个方法均不得暴露任何领域语义，也不得以业务术语命名参数——本 Step 的最终签名是零参数，完全不给未来实现者"顺手加一个 caseId 参数"的借口。这是《补充文档》§3.3 "领域无感知"在 Lifecycle 层的显式化。

## D. Phase 8 错误码三大命名空间的职责划分

Phase 8 在既有 `TQ-DOM-* / TQ-APP-* / TQ-POL-* / TQ-INF-* / TQ-CON-*` 之外正式启用 `TQ-SAG-*`，三个"Phase 8 主责命名空间"的职责分工为：

- **TQ-INF-\***：基础设施层错误。Adapter 内部的连接失败、超时、初始化失败、健康检查报告不健康等，只要故障物理上位于"外部系统边界 → Adapter → Port"这条路径上，错误码都落在 `TQ-INF`。
- **TQ-SAG-\***：Saga 编排错误。编排器在 Application 层发起跨 Adapter 的多步操作，当某一 Step 超时、补偿失败、状态恢复失败时，错误码落在 `TQ-SAG`。Saga 错误可能携带 `TQ-INF` 作为 `cause`，但它本身不是 `TQ-INF`。
- **TQ-CON-\***：契约违反错误。一个 Adapter 实现不满足契约测试套件的某项断言，或某个事件/DTO 不满足 contract schema，错误码落在 `TQ-CON`。Phase 1-7 的 `TQ-CON-001..003`（版本不兼容 / 必填字段缺失 / 字段格式错误）继续有效，Phase 8 在本命名空间追加契约测试违反码。

每个命名空间的结构化错误类（`InfrastructureError` / `SagaError` / `Phase8ContractError`）携带统一的 `code / layer / context / cause` 四字段：`code` 是字符串字面量联合类型，类型系统保证跨命名空间混用在编译期失败；`layer` 是 `"infrastructure" / "saga" / "contract"` 之一，与命名空间前缀一一对应；`context` 是 `Readonly<Record<string, unknown>>`，要求调用方传入可 JSON 序列化的键值对；`cause` 遵循 ECMAScript `Error.cause` 约定，可选嵌套 Error 或同类 TianqiError。

## E. 为什么不预先枚举所有错误码

《宪法》§22.3 明确规定"先搭边界，再填实现"。一个尚未真正被抛出过的错误码，其"上下文应带哪些键"与"人类可读消息该怎么措辞"均不可知——此时预填的错误码只是一串占位，迟早会在第一次实际被用时被重新定义，从而违反《补充文档》§10.2 "错误码一经发布即不可重新分配含义"的约束。

本 Step 对每个 Phase 8 主责命名空间只落地 1 个真正需要的样本错误码：

- `TQ-INF-002 ADAPTER_INITIALIZATION_FAILED` —— `AdapterLifecycle.init` 失败时必然会用到，Step 3 起立即进入调用链。
- `TQ-SAG-001 SAGA_STEP_TIMEOUT` —— 引入 `TQ-SAG` 命名空间的"头样本"，证明命名空间结构正确且类型系统可拒绝跨命名空间混用。
- `TQ-CON-004 ADAPTER_CONTRACT_TEST_VIOLATION` —— 契约测试套件在 Step 3 首次发现不一致时要抛出的默认失败码。

其他错误码按需在它们实际被首次使用的 Step 新增——这是一条纪律，不是一个路线图。

**与指令原文的错误码号段协商**：本 Step 指令原文为样本错误码预留了 `TQ-INF-001 / TQ-SAG-001 / TQ-CON-001` 三个号段，其中 `TQ-INF-001` 与 `TQ-CON-001` 已在 Phase 1-7 封板期分别作为 `INFRASTRUCTURE_UNAVAILABLE` 与 `CONTRACT_VERSION_INCOMPATIBLE` 发布。依据《补充文档》§10.2 的"不得重新分配含义"硬约束，本 Step 把 Phase 8 样本码分别定位到各命名空间下一个可用位置：`TQ-INF-002 / TQ-SAG-001 / TQ-CON-004`。`TQ-SAG-001` 是全新命名空间的首个码，不存在冲突。这一决策在本文档留痕，作为后续任何错误码追加时号段选择的参考依据。

## F. 错误码稳定性约束

Phase 8 起新增的每一个错误码，一经合入 `packages/contracts/src/error-code.ts` 即进入外部契约。约束如下：

1. **不得删除**：已发布的错误码只允许停止被内部生产（即无人再调用它的 factory），但其字符串常量与类型系统中的字面量联合类型不得移除。
2. **不得重新分配含义**：`TQ-INF-002` 永远指代"Adapter 初始化失败"这一语义族，不得被挪用到其他场景。
3. **不得降级**：已发布错误码所对应的 `context` 必需字段（例如 `TQ-INF-002` 的 `adapterName / reason`）不得删除，只允许追加可选字段。
4. **修改视为破坏性变更**：任何违反上述三条的修改，属于破坏性契约变更，必须走 Phase 7 封板后预留的破坏性契约变更流程。该流程的具体手续由 Phase 10 或更后定义，本 Step 不预设。

本约束对齐《补充文档》§10.2 与《宪法》§24.2"契约未说明就变更"的拒绝合并条件。

## G. 对 Step 3 的衔接

Step 3 的主线是落地第一个具体 Port 的契约测试套件（默认目标为 EventStorePort）。它会以以下三条通道挂在 Step 2 的产物上：

1. **`AdapterFoundation` 复用**：Step 3 将 `EventStorePort & AdapterFoundation` 作为具体 EventStore Adapter 的 TypeScript 类型约束；Step 4 起任何实际 Adapter 实现该组合类型时必然同时实现 HealthCheck 与 Lifecycle。
2. **`@tianqi/adapter-testkit` 骨架填充**：`defineHealthCheckContractTests` 与 `defineLifecycleContractTests` 在 Step 3 将填入具体 `it` 块（如"首次 init 后 healthCheck 报告 healthy=true"、"shutdown 后 healthCheck 报告 healthy=false"、"重复 init 幂等"、"资源释放可从外部探针观测"），而 adapter-testkit 的 src 导出面保持不变。
3. **错误码接入**：契约测试套件检测到 Adapter 不满足契约时，统一抛出 `adapterContractTestViolationError(...)`（即 `TQ-CON-004`）；Adapter 自身在初始化失败时抛出 `adapterInitializationFailedError(...)`（即 `TQ-INF-002`）。Step 3 的测试与 Adapter 实现都不需要再新增错误码。

Step 3 的详细范围、影响、风险与 DoD 将在 `docs/phase8/03-*.md` 中独立给出，本文档不预先承诺其细节。
