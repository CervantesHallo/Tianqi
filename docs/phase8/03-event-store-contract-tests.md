# Phase 8 / Step 3 — adapter-testkit EventStore 契约测试套件落地

## A. Step 3 契约级定位

Step 1 浇了 `packages/adapters` 物理地基；Step 0.5 夹紧了三处历史遗留；Step 2 立了 AdapterFoundation 类型契约与 Phase 8 错误码命名空间结构。但到 Step 2 为止，`packages/adapters/adapter-testkit` 导出的三个 `define*ContractTests` 函数中只有 `defineEventStoreContractTests` 在本 Step 被填充了实际的 `it` 块；HealthCheck 与 Lifecycle 两个容器仍保持 Step 2 的 `describe` 空骨架形态。本 Step 仍是契约级 Step——它不实现任何"真正的" EventStore Adapter，参考实现仅作为自测工具存在于 `src/fixtures/`。

本 Step 的产出物是一份可被任意 EventStore Adapter（Step 4 内存、Step 5 SQLite、Step 6 Postgres）以单行代码挂载的契约判决工具。它通过 19 + 2 个真实可运行的 `it` 块把《宪法》§10 事件契约规范与 §12 数据与存储规范中可观察的部分翻译成机械化断言。Step 4 起引入的每一个 EventStore Adapter 都必须通过同一套 `defineEventStoreContractTests("<name>", factory)`——没有一个 Adapter 可以绕过这条门禁宣称"合格"。

## B. 6 大类别覆盖范围与《宪法》§10 + §12 的映射

| 类别                     | it 块数 | 主映射                                                     | 关键断言                                                                                                                                                                                                  |
| ------------------------ | ------: | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 幂等性                 |       3 | §10.4 事件 schema 版本化、§12.3 幂等键                     | 同 `eventId` 重复 `append` 不制造新条目；重复次数不限；幂等不依赖到达顺序                                                                                                                                 |
| 2 原子性                 |       3 | §12.1 存储原则、§18.2 错误传播                             | 非法事件不得留下任何残留；非法事件以 `TQ-CON-005` 结构化错误返回；合法事件精确 +1                                                                                                                         |
| 3 读取顺序               |       3 | §10.2 事件字段 `occurred_at`、§12.1 领域真相与查询模型分离 | `listByCaseId` 按 `occurredAt` 严格升序；同 `occurredAt` 以写入顺序 tie-break；乱序写入不破坏读取顺序                                                                                                     |
| 4 并发写入               |       2 | §13.1 并发原则、§13.2 一致性原则                           | 同 case 并发 append 零丢失/零重复；跨 case 并发互相独立                                                                                                                                                   |
| 5 Schema 校验            |       5 | §10.2 事件字段规范、§10.4 事件约束、§17.1 强类型优先       | 空 `eventId` / 非 ISO-8601 `occurredAt` / 非 semver `eventVersion` / 空 `metadata.sourceModule` / 非可序列化 metadata 值 均拒绝                                                                           |
| 6 AdapterFoundation 集成 |       5 | Step 2 AdapterFoundation 契约                              | init 前 append 拒绝（`TQ-INF-003`）；shutdown 后 append 拒绝（`TQ-INF-004`）；healthCheck 不抛异常且状态随生命周期切换；init/shutdown 幂等；`countTotal` 与 `listByCaseId` 的累积关系在跨 case 场景下成立 |

类别数选 6 而非 4 或 8 的依据：4 类（idempotency/atomicity/ordering/schema）漏掉了并发与生命周期集成这两类 Adapter 层一旦实现就必然遇到的问题；8 类会把"读取顺序"与"并发写入"进一步拆分为多个子类，过度细化导致单独的类别下只剩 1 个 `it` 块，削弱类别作为"内聚单元"的意义。6 类让每一个类别至少承载 2 个 `it` 块、至多承载 5 个，结构上保持均衡。

## C. 参考实现与 Step 4 正式 in-memory Adapter 的职责分离

`packages/adapters/adapter-testkit/src/fixtures/reference-event-store.ts` 是 adapter-testkit **内部的自测工具**，其目的只有一个：证明 `defineEventStoreContractTests` 注册的 19 + 2 个 `it` 块不是"永远通过"的空壳，而是在一个语义正确的实现上全绿、在一个实现错误的 Adapter 上会红。

参考实现与 Step 4 将在 `packages/adapters/adapter-event-store-memory`（或等价命名）落地的正式 in-memory Adapter 在四个维度必须物理分离：

1. **导出面分离**：`ReferenceEventStore` 类型与 `createReferenceEventStore` 工厂**不通过** `packages/adapters/adapter-testkit/src/index.ts` 导出；它们也**不出现在** `package.json` 的任何 `exports` 字段。其他包在源码层无合法 import 路径。
2. **目录分离**：参考实现位于 `src/fixtures/`，不位于 `src/` 顶层；未来任何新增的 Adapter 代码必须位于其自有的 `packages/adapters/<adapter-name>/src/`。
3. **职责分离**：参考实现的唯一消费者是 adapter-testkit 的 `src/event-store-contract.test.ts` 自测；Step 4 的 in-memory Adapter 的消费者是 Phase 2-7 已封板的 Application 层 orchestrator 与后续 EventStore 消费路径。
4. **迭代分离**：参考实现只在"契约断言新增/调整"时才需要修订；Step 4 正式 Adapter 只在"语义 bug 或性能优化"时修订。二者是两个独立的演进轴。

如果未来任何 Adapter 的 test 文件试图 `import { createReferenceEventStore }`，应在 code review 阶段直接拒绝——那条 import 路径在源码上被设计为不存在（TypeScript 解析会失败，因为 fixtures 子路径不在 adapter-testkit 的 exports 中）。

## D. 新增错误码断言点对应表

| 错误码       | 名称                            | 触发的 it 块                                                                                                                                                                                |
| ------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TQ-INF-003` | `EVENT_STORE_NOT_INITIALIZED`   | 类别 6 `test_append_before_init_rejects_with_tq_inf_not_initialized`                                                                                                                        |
| `TQ-INF-004` | `EVENT_STORE_ALREADY_SHUT_DOWN` | 类别 6 `test_append_after_shutdown_rejects_with_tq_inf_already_shut_down`                                                                                                                   |
| `TQ-CON-005` | `EVENT_SCHEMA_VIOLATION`        | 类别 2 `test_invalid_event_returns_structured_error_in_tq_con_namespace` + 类别 5 全部 5 个 `it` 块（eventId / occurredAt / eventVersion / metadata.sourceModule / 非可序列化 metadata 值） |

每个新增码都对应至少一个实际断言点，未引入任何"为未来预留"的空码。号段分配严格按 Phase 2 Step 2 既定的"每个命名空间下一个可用号"规则自增：`TQ-INF-002` 已占（Step 2 ADAPTER_INITIALIZATION_FAILED），因此新的 EventStore 生命周期码从 `TQ-INF-003` 起；`TQ-CON-004` 已占（Step 2 ADAPTER_CONTRACT_TEST_VIOLATION），因此 schema 违反码从 `TQ-CON-005` 起。

## E. 元规则 A 与 元规则 B 在本 Step 的应用

本 Step 触发了元规则 A（冲突处置优先级）两次，均按"服从既有事实、留痕说明"处置：

**触发 1 — 指令 vs 既有 Port 形状**：

- 指令第五节类别 3 要求 `readByCase(caseId) 按 occurredAt 严格升序返回` 与跨 case 并发测试的读取对比。
- 既有事实：`packages/ports/src/event-store-port.ts` 定义的 `EventStorePort` 自 Phase 5 封板起只有 `append`，没有任何读取方法；返回类型为 `Promise<Result<void, EventStoreWriteError>>`，调用方无法从 Port 本身观察写入状态。
- 指令同时在"本步不做"中明确"不修改 EventStorePort 接口签名"。
- 处置：在 adapter-testkit 内新增 `EventStoreContractProbe` 接口，包含 `listByCaseId` 与 `countTotal` 两个观察方法。factory 返回的 `EventStoreAdapterUnderTest = EventStorePort & AdapterFoundation & EventStoreContractProbe` 要求被测 Adapter 同时实现 Port、Foundation 与 probe。probe 是 testkit 约定的观察面（带 `__testkitProbe: true` 品牌字段以防误用），**不是** `EventStorePort` 本身的扩展。Step 4-6 的正式 Adapter 各自提供 probe 实现即可接入契约套件；生产路径不依赖 probe。这样既没修改 `EventStorePort` 签名，也让契约测试可以观察实际写入结果。

**触发 2 — 指令 vs 既有 `DomainEventMetadata` 类型**：

- 指令第五节类别 5 第 4 个要点要求"metadata 为 null 或 undefined 时的行为：按空对象处理，不抛错"。
- 既有事实：`packages/contracts/src/event-metadata.ts` 定义 `DomainEventMetadata` 要求 `sourceModule: string` 与 `schemaVersion: string` 非空；Phase 1 的 `createDomainEventEnvelope` 对二者做非空校验并以 ContractError 失败。
- 处置：保留既有严格校验，将该 `it` 块改写为"missing metadata.sourceModule 被拒绝并返回 TQ-CON-005"，与既有 envelope 语义对齐；指令字面的"按空对象处理"与既有契约不一致，按既有事实执行并在本文档留痕。

**元规则 B（adapter-testkit 签名兼容纪律）在本 Step 未直接触发**：`defineEventStoreContractTests` 是本 Step 首次发布的函数，不存在"已发布签名"的兼容约束。其泛型约束选择 `T extends EventStorePort & AdapterFoundation & EventStoreContractProbe`——比指令建议的 `T extends EventStorePort & AdapterFoundation` 更严格；这是元规则 B 允许的"向下收紧"。options 参数采用空结构 `Readonly<Record<string, never>>`，为未来扩展留出位置但当前不填充任何字段，遵循《宪法》§22.3 "先搭边界、再填实现"。

此外，Step 1 为 adapter-testkit 设定的 workspace 依赖边界（仅 `@tianqi/contracts` + `@tianqi/ports`）在本 Step 被扩展以新增 `@tianqi/shared`：契约测试 fixture 需要构造 `Result<void, _>`、`EventId`、`RiskCaseId`、`TraceId` 等基础类型，而这些都是 `@tianqi/shared` 提供的纯 TypeScript 原语（无业务语义）。原始 Step 1 限制的动机是"契约测试不触碰领域与应用语义"，`@tianqi/shared` 里仅有 `Brand<>` / `Result<>` / 身份标识构造器，不包含领域或应用语义，因此本次扩展符合 Step 1 的"精神约束"而非"字面约束"。在本文档留痕，以备未来类似依赖扩展参考。

## F. 错误码稳定性延续声明

本 Step 新增的 `TQ-INF-003` / `TQ-INF-004` / `TQ-CON-005` 一经合入即遵守 Step 2 §F 确立的四条稳定性约束：不得删除、不得重新分配含义、不得降级 `context` 必需字段、修改视为破坏性契约变更。

`EVENT_STORE_NOT_INITIALIZED` 永远指代"Adapter 未调用 `init()` 即被调用写入/读取路径"，不得被挪用到"基础设施本身不可达"（那是 `TQ-INF-001 INFRASTRUCTURE_UNAVAILABLE` 的职责）。`EVENT_STORE_ALREADY_SHUT_DOWN` 永远指代"Adapter 经 `shutdown()` 后仍被调用"；它与 `TQ-INF-003` 的区别在于前后状态不同。`EVENT_SCHEMA_VIOLATION` 永远指代"事件 schema 级的字段缺失 / 格式不合法 / 值不可序列化"，它与 Phase 1-7 冻结的 `TQ-CON-001..003` 的区别在于后者针对契约版本/必填字段/字段格式的更抽象语义，本码专用于事件存储入口的 schema 校验。

## G. 对 Step 4 的衔接

Step 4 将在 `packages/adapters/adapter-event-store-memory/`（或等价命名）落地正式的 in-memory `EventStorePort & AdapterFoundation` Adapter。其 test 文件预计长度为极短的一行：

```ts
defineEventStoreContractTests("in-memory", () => createInMemoryEventStore());
```

只要 `createInMemoryEventStore()` 返回的对象同时满足 `EventStorePort & AdapterFoundation & EventStoreContractProbe`，Step 3 注册的 19 + 2 个 `it` 块将一字不变地跑在 Step 4 的 Adapter 上。Step 5（SQLite）与 Step 6（Postgres）的 test 文件将具有完全相同的形状——`defineEventStoreContractTests("sqlite", factory)` 与 `defineEventStoreContractTests("postgres", factory)`——证明"同一 Port 的所有 Adapter 必须通过同一份契约测试"（《补充文档》§3.4）在工程上可达。

Step 5/6 引入真实持久化层后，某些《宪法》§12 条款（例如 §12.1 "审计日志不可篡改"、崩溃恢复后的状态一致性）将首次具备可测性——这些断言不属于 Step 3 的覆盖范围，届时由 Step 5 / 6 各自的执行指令决定是否通过扩展 `defineEventStoreContractTests` 的 options 第二参数注入持久化专属测试，还是新开一个 `definePersistentEventStoreContractTests` 函数。该决策不在本 Step 预设。

Step 3 的具体范围、影响、风险与 DoD 将在本执行记录与 Step 4 起的后续文档中继续留痕，本文档不预先承诺后续 Step 的细节。
