# Phase 8 / Step 4 — @tianqi/event-store-memory Adapter 落地

## A. Step 4 定位

Step 4 是 Phase 8 的"实现级转折点"：前四步（Step 1 目录地基 / Step 0.5 遗留补丁 / Step 2 横切契约 / Step 3 契约测试套件）全部是纯契约工作——没有任何一行面向生产路径的 Adapter 代码。Step 4 在这些契约的基础上落地 Phase 8 第一个正式 Adapter：`@tianqi/event-store-memory`。

本 Step 的价值不在于"写一个新 EventStore"（一个内存 Map + Set 本身是 30 行代码的工作），而在于以下四件事:

1. **验证 Step 2 `AdapterFoundation` 在真实 Adapter 上的可实现性**：内存 Adapter 必须同时满足 `AdapterIdentity + AdapterHealthCheck + AdapterLifecycle` 三个合约，且每条合约的语义约束（如 `healthCheck` 不抛异常、`init/shutdown` 幂等）在本 Adapter 上全部可自然达成。
2. **验证 Step 3 `defineEventStoreContractTests` 在真实 Adapter 上的可复用性**：`src/event-store-memory.contract.test.ts` 整个文件只有 3 行逻辑，却驱动 Step 3 的 21 个 `it` 块全部在本 Adapter 上跑过。任何一个断言失败都会被立即定位到 Adapter 语义违规，而不是测试代码本身的问题。
3. **为 Step 5（SQLite）/ Step 6（Postgres）提供参照模板**：包的组织方式、依赖边界、工厂模式、契约挂载方式、README 结构——未来 16 个 Step 中至少 5 个 Adapter 将直接继承本 Step 的所有决策。
4. **把 `packages/infrastructure` DEPRECATED 纪律在实践中落地**：见 §B 迁移情况。

## B. 迁移来源

**结论**：无既有 in-memory `EventStorePort` 实现可迁移，本 Adapter 从零实现。

执行前的事实核查（`grep -rln "EventStorePort\|event.store" packages/`）：

- `packages/ports/src/event-store-port.ts`：只定义 `EventStorePort` 接口（只写 `append`），自 Phase 5 封板，仓库里从未存在过实现。
- `packages/infrastructure/`：自 Phase 1 / Step 1 起仅含 `README.md`，无 TypeScript 源文件、无 `package.json` 脚本、无测试。Step 0.5 已将其标记为 DEPRECATED。
- `packages/application/src/audit-event-store.ts`：定义的是**另一个端口** `AuditEventStorePort`（Phase 5 机制），与 `EventStorePort` 不是同一个接口（一个写一个读+写、一个异步一个同步、一个返回 `Promise<Result<void, _>>` 一个返回 `Result<_, _>`）。本 Step 不触碰 application 层任何代码。

由于没有 `EventStorePort` 的既有实现可迁移，Step 4 按指令第五节第 5 项的"若没有现存实现"分支执行：从零实现 Adapter，`packages/infrastructure/README.md` **不**需要补充 DEPRECATED 段——原有 Deprecated 声明（Step 0.5 落地）已经充分覆盖"本目录不存新 Adapter"的语义。

## C. Adapter 三契约实现策略

### `EventStorePort.append`

- 签名：`<TPayload extends Record<string, unknown>>(event: DomainEventEnvelope<TPayload>) => Promise<Result<void, EventStoreWriteError>>`。
- 入口第一关：生命周期守卫。`state === "created"` 返回 `err(TQ-INF-003)`；`state === "shut_down"` 返回 `err(TQ-INF-004)`；`state === "running"` 继续。
- 入口第二关：schema 校验。与 Step 3 参考实现同一份校验逻辑（共 11 个字段级断言），不达标返回 `err(TQ-CON-005: <field>: <reason>)`。该格式与 Step 3 契约 it 块的 `.toMatch(/^TQ-CON-005: <field>/)` 断言严格一致。
- 入口第三关：幂等去重。`eventIds.has(event.eventId)` 为 true 时返回 `ok(undefined)` 而不改动存储；否则登记到 `eventIds` 与 `entries`。
- 存储时使用 `JSON.parse(JSON.stringify(event))` 深克隆，防止调用方后续修改原对象污染已存事件（schema 校验已保证事件 JSON-safe）。
- append 无任何 IO、无 `Date.now()`、无环境变量读取——时间戳由事件自带，Adapter 不产生也不覆盖。

### `AdapterFoundation`

- `adapterName: "event-store-memory"`——常量，与包名一致，不从 options 注入。
- `init()` / `shutdown()`：幂等状态机。`init()` 将 `created → running`，`running → running`（no-op），`shut_down → shut_down`（no-op，即一次关闭后不可复活）；`shutdown()` 无论当前状态都推进到 `shut_down`。
- `healthCheck()`：`{ adapterName, healthy: state === "running", details: { lifecycle, eventCount }, checkedAt: new Date().toISOString() }`。`checkedAt` 采用 UTC ISO-8601 对齐《宪法》§9.1；`details` 仅包含两个可观察字段（lifecycle 枚举值 + 当前事件数），足以供运维判断"adapter 是否在跑 + 是否有事件积累"。

### `EventStoreContractProbe`

- 结构类型声明在 Adapter 本地（类型名 `TestkitProbe`），不从 `@tianqi/adapter-testkit` 导入——这是元规则 F 的关键：**Adapter 代码严禁 import adapter-testkit 任何内容**，只通过结构类型兼容让 `defineEventStoreContractTests` 接受本 Adapter 作为 factory 产物。
- `__testkitProbe: true` 品牌字段：在运行时是一个布尔常量、在类型层是 probe 的"身份标识"。production 代码即使访问了这个字段也没有副作用；真正的防误用靠 Application 层把 adapter 变量显式标注为 `EventStorePort & AdapterFoundation`（不含 probe），让 TypeScript 拒绝 `adapter.listByCaseId(...)`。
- `listByCaseId(caseId)` / `countTotal()`：读取语义与 Step 3 参考实现一致（按 `occurredAt` 升序、同 occurredAt 以 `appendSeq` tie-break、读出的事件也深克隆）。

## D. 工厂函数 vs class 的选择

本 Adapter 对外唯一构造入口是 `createInMemoryEventStore(options?)`。不暴露 class。理由三条：

1. **Adapter 内部结构可能变**：未来某一版 Adapter 可能换用 `WeakMap` 或引入可选的 metric 计数器。class 构造函数意味着每次内部演进都要考虑继承兼容、private 字段访问等问题；工厂函数把"产生一个满足 `InMemoryEventStore` 类型的对象"这件事收敛到一个可替换的实现，外部无法察觉内部演进。
2. **未来需要注入依赖时扩展路径清晰**：Step 5 的 SQLite Adapter 会需要一个 `Database` 连接；Step 6 的 Postgres Adapter 会需要 `PoolConfig`。这些都通过 `options` 对象第一参数注入。`createInMemoryEventStore` 当前只接受一个可选的空 options，未来若发现确需可配置项（元规则 A），按向前兼容方式在 options 中追加可选字段即可，签名形状（`(options?) => T`）永久不变。
3. **与 Step 3 `defineEventStoreContractTests` 签名协同**：契约挂载的工厂形式是 `() => T | Promise<T>`，而不是 `new Ctor()`。工厂函数天然匹配；如果 Adapter 是 class，调用端必须写 `() => new InMemoryEventStore()`，多一层无价值包装。

## E. InMemoryEventStoreOptions 字段选择

当前 `InMemoryEventStoreOptions = Readonly<Record<string, never>>`——空对象类型。

考虑过的候选：

- `adapterName` 后缀（多实例场景）：**拒绝**。Step 4 指令明示"不得把 Adapter 身份（adapterName）放进 options"。多实例区分可以在调用方用 `Map<string, InMemoryEventStore>` 自行维护。
- `clock`（注入时间源）：**拒绝**。Adapter 只在 `healthCheck.checkedAt` 使用 `new Date().toISOString()`，现有契约测试只断言类型为 string 不断言具体值，无需注入。
- `maxEventCount`（内存保护）：**拒绝**。Adapter 的职责是"内存存事件"，不是"限流"。限流是 Application 层 saga / orchestrator 的职责。
- `clonePolicy`（克隆开销 vs 信任调用方）：**拒绝**。事件一旦从 Application 层抵达 Adapter，Adapter 必须假设调用方可能持续持有原引用，克隆是正确性前提而不是性能选项。

结论：空 options 是**刻意克制**，不是设计不足。任何新字段加入必须以"该字段对应一个具体断言点或具体误用场景"为唯一准入标准，对齐《宪法》§22.3 "先搭边界、再填实现"。

## F. 生命周期状态机

状态集：`"created" | "running" | "shut_down"`。三态，不使用布尔。

转换表：

| from      | action     | to        | note                       |
| --------- | ---------- | --------- | -------------------------- |
| created   | init()     | running   |                            |
| running   | init()     | running   | 幂等，不产生副作用         |
| shut_down | init()     | shut_down | 关闭后不可复活（不抛异常） |
| created   | shutdown() | shut_down | 允许未 init 直接 shutdown  |
| running   | shutdown() | shut_down |                            |
| shut_down | shutdown() | shut_down | 幂等                       |

"关闭后不可复活"是有意的：Adapter 的一次生命周期是单向的，避免调用方把 Adapter 当作可重启的长生命周期对象——那是 Application 层 orchestrator 的职责范围。

## G. 元规则 C / D / E / F 在本 Step 的应用

- **元规则 C（EventStorePort 只写原则）在本 Step 被贯彻**：Adapter 实现的 `EventStorePort` 仍然只有 `append` 方法；生产代码 Application 层将变量标注为 `EventStorePort & AdapterFoundation`，编译期就无法访问 `listByCaseId`。读取能力完全不通过 `EventStorePort` 暴露——未来 Step 将以独立 Query Port / Replayer Port 承担。
- **元规则 D（adapter-testkit 依赖边界）在本 Step 间接延伸**：`@tianqi/event-store-memory` 的生产依赖白名单为 `{contracts, ports, shared}`；adapter-testkit 作为 devDependency，不进入生产 bundle。严禁 `{domain, application, policy}` 依赖，与元规则 D 同源。
- **元规则 E（持久化契约测试独立函数）在本 Step 未直接触发**：内存 Adapter 不涉及持久化；`defineEventStoreContractTests` 的 21 个 it 块全部适用。Step 5（SQLite）起，`definePersistentEventStoreContractTests` 将作为新函数引入，承载崩溃恢复、审计日志不可篡改、跨进程一致性等契约。本 Step 为这条未来路径预留了清晰的挂载模式。
- **元规则 F（参考实现跨包引用禁令）在本 Step 被严格遵守**：`packages/adapters/event-store-memory/src/` 下**没有任何 import 语句指向** `@tianqi/adapter-testkit/src/fixtures/reference-event-store.ts` 或其相对路径。Adapter 实现是独立从零写的结构同构代码；`TestkitProbe` 类型在 Adapter 本地声明，与 `EventStoreContractProbe` 通过结构类型兼容对接。
- 此外，Step 4 未触发元规则 A 或 B（Step 3 既有元规则）：指令第五节已为 `InMemoryEventStoreOptions`、工厂 vs class、迁移处理三处决策点预留了明确处置路径；所有字段命名、类型约束、测试断言都能直接落地，无需偏离指令文本。

## H. 对 Step 5（SQLite）的衔接

Step 5 将建立 `@tianqi/event-store-sqlite`。从本 Step 的 event-store-memory 到 Step 5 的 SQLite Adapter，外部契约零改变：

```ts
// Step 4: in-memory
import { createInMemoryEventStore } from "@tianqi/event-store-memory";
const adapter: EventStorePort & AdapterFoundation = createInMemoryEventStore();

// Step 5: SQLite
import { createSqliteEventStore } from "@tianqi/event-store-sqlite";
const adapter: EventStorePort & AdapterFoundation = createSqliteEventStore({ databasePath });
```

Application 层的代码无需感知底层是内存还是 SQLite——这是《补充文档》§3.7 Adapter 替换原则的工程化兑现。

Step 5 的契约挂载也只需一行：

```ts
defineEventStoreContractTests("event-store-sqlite", () =>
  createSqliteEventStore({ databasePath: ":memory:" })
);
```

同时 Step 5 必须引入 `definePersistentEventStoreContractTests`（元规则 E），补充崩溃恢复、跨进程一致性、文件系统 fault 注入等断言。该契约函数的签名与 `defineEventStoreContractTests` 共享元规则 B（签名兼容纪律），其具体设计由 Step 5 指令在进入执行时敲定，本 Step 不预先承诺细节。

## I. 本 Step 没做什么

- **不引入 Query Port / Replayer Port**：运行时读取能力的归属是未来独立 Step 的职责。当前 `EventStorePort` 在 Phase 5 的"只写"设计是经过 Phase 5 封板确认的有意选择，本 Step 遵守这条既成事实。
- **不实现任何持久化**：SQLite 在 Step 5、Postgres 在 Step 6，各自走各自的 Adapter 路径。
- **不改动任何 Phase 1-7 封板代码**：Application 层 `AuditEventStorePort` 与本 Adapter 是两个独立 Port 的各自实现，本 Step 不触碰其中任何一条路径。
- **不暴露 Adapter 内部状态**：`entries`、`eventIds`、`appendCounter`、`state` 均为闭包内变量，Adapter 对外暴露的方法只有 `EventStorePort & AdapterFoundation & TestkitProbe` 三个契约的并集，零附加。
- **不提供 reset() / clear() 等便利方法**：如果测试需要新一轮空状态，应该新建一个 Adapter 实例。测试便利不得污染生产契约。
