# Phase 8 / Step 14 — 基座 Adapter 首次实战：@tianqi/external-engine-http-base

## A. Step 14 定位

Step 14 是 **Phase 8 首次真实触达网络栈**的一步，也是 **基座 Adapter（base adapter）** 这一概念的首次实战：

- 包 `@tianqi/external-engine-http-base` 实现 Step 13 锁定的 21 个五件套契约 `it` 全绿，跑在真实 undici + 本地 mock HTTP 服务器上。
- 它将被 Step 15-18 的 5 个业务 Engine Adapter（margin / position / match / mark-price / fund）以 workspace 依赖方式消费，提供共享稳定性能力。
- 本 Step 新增 **META-RULE O**（基座 Adapter 的特许依赖）到元规则集。

本 Step 的每一个决策将被 Step 15-18 直接继承。

## B. META-RULE O：基座 Adapter 的特许依赖（新元规则）

Phase 8 至今 13 个 Step 中，所有 Adapter 都不依赖其他 Adapter（元规则 F 的精神延伸）。Step 14 首次引入"一个 Adapter 被其他 Adapter 作为 workspace 依赖消费"的场景，必须显式正当化。

**元规则 O 七条准入条件**（全部满足方可称为"基座"）：

1. 基座 Adapter 包名含 `-base` 后缀或等价标识。
2. 不实现任何具体业务 Port（不实现 MarginEnginePort / PositionEnginePort 等），只实现基础稳定性契约。
3. README 显式声明"基座 Adapter"身份与消费边界。
4. 通过 Step 13 契约套件独立验收通过（证明基座本身合格）。
5. 依赖它的业务 Adapter 在 `package.json` 中显式声明 `workspace:*` 依赖。
6. 依赖它的业务 Adapter 不得在自己的源码中深入基座内部结构（只消费公开导出）。
7. 元规则 F 的"Adapter 互不依赖"纪律对所有非基座 Adapter 仍然严格有效 —— 即 margin 不能依赖 position。

**单基座限制**：Tianqi 仓库在 Phase 8 内最多只有一个基座 Adapter（本包）。未来引入"第二个基座"需要独立 Phase Gate 评估，本 Step 不开此口。

## C. 四个裁决问题

### 1. HTTP 库选择：**undici@8.1.0**

元规则 G 五条件逐条验证：

| 条件            | undici@8.1.0 证据                                               |
| --------------- | --------------------------------------------------------------- |
| 许可兼容        | MIT —— 与既有 yaml/kafkajs/pg/better-sqlite3 并列               |
| 工业标准        | Node.js 官方维护，Node 18+ 内置 fetch 基于此；GitHub 7.6k stars |
| 精确版本锁      | `"undici": "8.1.0"` 非范围                                      |
| 无 native build | 纯 JavaScript，不需要编译，不扩张 `pnpm.onlyBuiltDependencies`  |
| README 明述理由 | 本 Step docs §C.1 + 包 README 依赖章节                          |

**拒绝候选**：

- `node:http / node:https`：零依赖但需要自己实现 keep-alive 池 + HTTP/2，代码量翻倍
- `got`：功能臃肿，包含大量我们不需要的特性
- `axios`：体积大，现代最佳实践倾向 undici
- `fetch`：控制粒度不足，AbortSignal 与 Dispatcher.request 的精细控制难以表达

undici 的 `Pool`（connections / connectTimeout / headersTimeout / bodyTimeout）与五件套语义天然对应，这是它胜出的根本原因。

### 2. 契约测试 mock 方案：**方案 A（testkit-controlled mock server）**

**理由**：

- Adapter 源码零 testkit 污染 —— 所有 fault injection 发生在 `test/helpers/mock-downstream-server.ts`，生产代码看不到任何"如果在测试就怎样"分支。
- 真实网络 I/O（localhost TCP）—— HTTP 基座的本质就是"调用真实 HTTP 服务"，契约测试的 mock server 是最诚实的验证方式。
- node:http 零第三方依赖 —— 与 yaml / kafkajs 等已引入的依赖形成对照，本 Step 只新增一个 undici，不膨胀依赖。
- 可被 Step 15-18 复用 —— 业务 Engine 如果需要类似的 mock，可以参考 `test/helpers/mock-downstream-server.ts` 重建，结构清晰。

**拒绝候选**：

- 方案 B（options 扩展 downstreamUrl）：Step 13 已定稿，扩字段虽可但会增加 `ExternalEngineContractOptions` 面积
- 方案 C（Adapter 暴露 testkit-only 钩子）：违反"生产代码与测试代码隔离"原则
- 方案 D（双适配器层）：契约挂载代码冗余

### 3. Trace header 名称：**`x-tianqi-trace-id`**

**理由**：

- Tianqi 品牌明确 —— 下游服务日志看到这个 header 立即知道来源
- 符合 HTTP 约定 —— `x-` 前缀是自定义 header 的经典惯例
- 不采用 W3C `traceparent`：traceparent 承载完整 tracing 上下文（trace-id + span-id + flags），但 Tianqi 的 Sprint E 目前只需要 trace-id 的简单透传。未来如需 W3C distributed tracing 可以增加另一个 header（共存不冲突）。

默认值写在代码里（`DEFAULT_TRACE_HEADER_NAME`），业务 Engine 可通过 `options.traceHeaderName` 覆写。

### 4. 错误码新增：**TQ-INF-018 EXTERNAL_ENGINE_BASE_URL_UNREACHABLE**

惯例 K 裁决：

| 候选                | 诊断 runbook                   | 与既有码差异                                 |
| ------------------- | ------------------------------ | -------------------------------------------- |
| 复用 TQ-INF-013     | 查 timeout 预算配置            | TQ-INF-018 是 init 时预检，不是 runtime 超时 |
| 复用 TQ-INF-009     | psql 连 DB                     | 工具链完全不同（curl / DNS / TLS）           |
| 复用 TQ-INF-001     | 泛化 infra 不可用              | TQ-INF-001 是顶层泛化码，工具链不具体        |
| **新增 TQ-INF-018** | curl baseUrl + DNS + TLS trust | 精确指向 "HTTP endpoint 连不通" runbook      |

决定新增。`inf.test.ts` 固化 TQ-INF-018 工厂 + 与 TQ-INF-013 分离的断言（永久留痕）。

**预留性质**：本 Step 的 `createHttpBaseEngine.init()` 因 undici Pool 构造函数不做 DNS / TCP 预检，运行时才在第一次 `call()` 发现 baseUrl 不可达（分类为 `downstream_unavailable` 重试耗尽 → TQ-INF-014）。TQ-INF-018 预留给 Step 15+ 业务 Engine 如果选择在 `init()` 做显式预检（如发一个 OPTIONS 请求验证连通性）时使用。

## D. 五件套与 undici 栈的映射

| 五件套成员 | 本 Adapter 实现                                                                                         | undici 特性映射                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 超时       | `connectTimeout` / `headersTimeout` / `bodyTimeout` 传给 `Pool` 构造 + `AbortController` 守护 `totalMs` | `Pool.Options.connectTimeout/headersTimeout/bodyTimeout` + `signal` |
| 重试       | 手写 retry loop（`attemptOnce` + `classifyHttpStatus` / `classifyNetworkError` + 指数退避 + 分类判定）  | 无 —— 纯业务逻辑                                                    |
| 熔断       | 手写 `CircuitBreaker` class（三态状态机 + `consecutiveFailures` 计数器 + ISO-8601 `lastTransitionAt`）  | 无 —— 与 undici 正交                                                |
| 限流       | 独立 `currentConcurrency` 计数器 + `maxConcurrency` 前置检查 + `undici.Pool.connections` 同步到该值     | `Pool.Options.connections`                                          |
| 追踪传播   | `x-tianqi-trace-id` HTTP header 注入；contract probe `getLastTraceId()` echo                            | `request.headers[traceHeaderName] = String(traceId)`                |

**不使用第三方熔断/重试/限流库**（opossum / p-retry / bottleneck）的理由：

- 手写实现总共约 300 行，可读性 > 工程技巧（Tianqi 宗旨第一条）
- 状态机 / 退避 / 计数逻辑与契约 `it` 一一对应，调试时一目了然
- 第三方库都带有额外配置面，会稀释"五件套是 Tianqi 关心的核心稳定性"这条叙事

## E. call() 接口形状裁决

**关键问题**：Step 13 的 `ExternalEngineRequest = { operation: string; payload?: unknown }` 与真实 HTTP 需要的 method/path/headers/body 如何桥接？

**裁决**：`call(request: HttpBaseCallRequest, traceId?: TraceId)`，其中 `HttpBaseCallRequest` 结构兼容 `ExternalEngineRequest`：

```ts
type HttpBaseCallRequest = {
  readonly operation: string;  // 必填，映射为 URL 路径段
  readonly payload?: unknown;  // 可选，JSON.stringify → body
  readonly method?: "GET" | "POST" | ...;  // 默认 "POST"
  readonly headers?: Record<string, string>;
};
```

**默认 HTTP 解释**：

- `method = "POST"`（RPC-风格调用的最常见默认）
- `path = "/${operation}"`（operation 带不带前导 `/` 都兼容）
- `body = JSON.stringify(payload)` when payload is not `undefined | null`
- `Content-Type: application/json` 自动注入

业务 Engine（Step 15-18）通过 `method` / `headers` 覆写实现 GET 查询、PUT 更新、自定义认证 header 等。

## F. 熔断 open → healthy: false（延续 Step 13 决策）

Step 13 §E 决策：熔断 `open` 与 `half-open` 均 `healthy: false`。本 Step 在真实 HTTP 栈上继承：

- `running + closed` → `healthy: true` + 发 OPTIONS 健康探测
- `running + open/half-open` → `healthy: false`，**不发探测**（对正在拒绝流量的 Adapter 再去探测只会加剧问题）
- `created / shut_down` → `healthy: false`（Lifecycle 共性）

契约 `it` `test_health_check_reports_healthy_false_when_circuit_is_open` 在基座上验证。

## G. 《§6.5 领域摘要转译》三层固化

1. **类型签名层**：`classifyHttpStatus` / `classifyNetworkError` 返回的 `Classification` 枚举分支全部使用域 moniker 字符串常量（`"downstream_unavailable"` / `"permission_denied"` / `"not_found"` 等），**不含** HTTP status 数字、`name`/`code` 字段、socket error 名称。
2. **工厂调用层**：`externalEngineTimeoutError` / `externalEngineRetriesExhaustedError` 等工厂接受"domain moniker"字符串参数；`inf.test.ts` 正则断言 `.not.toMatch(/^[45]\d\d$/)` 防止 raw HTTP status 流入。
3. **契约验证层**：Step 13 `test_timeout_error_does_not_leak_raw_socket_or_http_details` 在本 Step 的真实 HTTP 栈上再跑一遍，正则检查 `.not.toMatch(/ECONNRESET|EPIPE|ETIMEDOUT|AggregateError|\b[45]\d\d\b/)` 防止序列化泄漏。

**本 Step 实战发现**：原计划的 `totalMs: 500` 会让 `"timeoutMs":500` 的序列化字符串触发 `\b[45]\d\d\b` 正则（500 看起来像 HTTP 500）。修复：契约 mount 将 `totalMs` 改为 `1000`（4 位数字不匹配该模式）。并在测试文件注释中留痕，警示未来 Step 选择超时预算时必须避开 400-599 范围。

## H. 错误码决策

| 错误码         | 新增/复用 | 对应 runbook                                 |
| -------------- | --------- | -------------------------------------------- |
| TQ-INF-003     | 复用      | Lifecycle 共性 —— 未 init 调用 `call()`      |
| TQ-INF-004     | 复用      | Lifecycle 共性 —— shutdown 后调用 `call()`   |
| TQ-INF-013     | 复用      | 超时（connect/request/total）—— Step 13 锁定 |
| TQ-INF-014     | 复用      | 重试耗尽 —— Step 13 锁定                     |
| TQ-INF-015     | 复用      | 熔断 open —— Step 13 锁定                    |
| TQ-INF-016     | 复用      | 限流 —— Step 13 锁定                         |
| TQ-INF-017     | 复用      | 非可重试下游错误 —— Step 13 锁定             |
| **TQ-INF-018** | **新增**  | baseUrl init-time 不可达（预留）—— §C.4 裁决 |

6 复用 + 1 新增。新增码遵循惯例 K（独立 runbook，与 TQ-INF-013 diagnostic 工具链分离），并在 `inf.test.ts` 有 factory round-trip + 与 TQ-INF-013 分离断言 2 个永久留痕。

## I. Step 5 state guard 教训继续复用

`call()` 内部三态检查顺序（Step 5 硬模板，Phase 8 第 N 次致敬）：

```ts
if (lifecycle === "shut_down") return err(...); // TQ-INF-004
if (lifecycle === "created") return err(...);    // TQ-INF-003
// ... rest of call logic
```

**为什么先判 shut_down**：shutdown 是终态（不可逆），created 是初态（init() 可推进）。shutdown 后应报告"已关闭"而非"未初始化"，否则运维排查会被误导。

代码注释显式标注 `// Step 5 lesson`。

## J. 元规则 A–J + M + N + O 触发情况

- **A（指令 vs 既有事实冲突）**：**未触发**。Step 13 的 testkit-专属 `TestkitExternalEngineFoundation` 抽象已处置了"Phase 1-7 无 Engine Port"的事实；本 Step 直接在该抽象上实现。
- **B（testkit 签名兼容）**：贯彻 —— 既有 7 个契约函数签名零改动；`HttpBaseCallRequest` 结构兼容 Step 13 `ExternalEngineRequest`。
- **C（EventStorePort 只写）**：不适用。
- **D（adapter-testkit 依赖边界）**：贯彻 —— adapter-testkit 零改动。
- **E（持久化契约独立函数）**：不适用。
- **F（参考实现跨包引用禁令）**：**贯彻**。本包的生产代码不 import `@tianqi/adapter-testkit/src/fixtures/reference-external-engine.ts`；adapter-testkit 在本包 `devDependencies` 中只供 contract.test.ts 消费。META-RULE F 扩展到"Adapter 之间不互相 import"也贯彻：本包是基座，META-RULE O 的特许依赖机制允许 Step 15-18 消费它，但基座反向不依赖任何业务 Engine。
- **G（第三方依赖准入）**：**第五次实战**。`undici@8.1.0` 精确锁，MIT 许可，纯 JS 无 native build，未扩张 `pnpm.onlyBuiltDependencies` 白名单。README 依赖章节明述理由与拒绝候选。
- **H（持久化 Adapter 自管 schema）**：不适用 —— 本 Adapter 无持久化。
- **I（外部服务 healthCheck 语义）**：**严格贯彻**。`healthCheck()` 非阻塞 + 独立超时（`healthCheckTimeoutMs`）+ 不抛异常 + 熔断 open/half-open 时不发探测；探测动作是只读 `OPTIONS` 请求而非业务 POST。
- **J（测试外部服务隔离）**：**特殊处置** —— mock server 跑在 localhost 动态端口 `:0`，无需环境变量保护；测试套件完全自包含，CI 无需任何 `TIANQI_TEST_*` 变量。这是"真实网络但自管理"的中间形态：与 Step 6 Postgres/Step 9 Kafka 的"真实外部服务需要 describe.skipIf"不同，localhost mock 完全可控。
- **M（testkit 观察原语约束）**：贯彻 —— probe 六个 getter 纯只读。
- **N（显式声明语义）**：贯彻 —— README § Semantics 三条稳定性保证（重试+幂等 / 熔断行为 / 下游错误领域化）。
- **O（基座 Adapter 特许依赖）**：**首次实战**。README 显式声明 7 条准入条件；本包通过 Step 13 契约独立验收；Step 15-18 将在各自 package.json 中声明 `workspace:*` 依赖。

## K. 惯例 K + L 应用

- **K（错误码共性 vs 专属）**：TQ-INF-018 新增（§C.4）；TQ-INF-003/004/013-017 复用。
- **L（Adapter 自有测试覆盖边界）**：6 个自有测试全部覆盖 HTTP 栈专属维度，不与契约 `it` 重叠。

| 自有测试                                                                | 是否可归入契约？                   |
| ----------------------------------------------------------------------- | ---------------------------------- |
| test_factory_requires_base_url_at_runtime                               | 否 —— 契约不关心 baseUrl 必填      |
| test_trace_header_is_injected_on_outbound_request                       | 否 —— 契约无法观察 HTTP 线         |
| test_init_against_invalid_base_url_parses_but_call_surfaces_TQ-INF-013  | 否 —— 契约无"错误 baseUrl"断言     |
| test_health_check_surfaces_base_url_and_pool_diagnostics_in_running     | 否 —— 字段 baseUrl 是 HTTP 独有    |
| test_health_check_after_shutdown_returns_healthy_false_without_throwing | 部分重叠但 contract 未观察 details |
| test_object_keys_exposes_only_public_contract_surface_no_extras         | 否 —— Object.keys 是白盒专属       |

全部通过惯例 L 自测。

## L. 风险点

1. **mock server 的跨平台稳定性**：Linux / macOS / Windows 下 node:http 的 `listen(0, "127.0.0.1")` 行为一致，CI 各主流平台已验证。Windows 可能遇到 firewall 提示阻塞 socket —— 仅开发机本地运行问题，CI 无风险。
2. **undici 版本与 Node.js 运行时兼容**：undici@8.x 要求 Node 18+。Tianqi 仓库 `package.json` 未显式锁 Node 版本，依赖开发者用 Node 20+（与 LTS 对齐）。如有运维在 Node 16 环境运行，需先升级 Node。
3. **keep-alive 连接池在测试间泄露**：`afterEach` 调用 `mock.reset()` 清空注入队列，`afterAll` 调用 `mock.close()` 销毁所有 open sockets。无泄露。Adapter 的 `shutdown()` 调用 `pool.close()` 等待 in-flight 请求完成，也无泄露。
4. **基座被 Step 15-17 消费时的版本升级影响评估机制**：Step 15-18 的 package.json 使用 `"@tianqi/external-engine-http-base": "workspace:*"` —— workspace 版本永远跟随本仓库最新代码。如果本包未来 API 有 breaking change，`pnpm -w typecheck` 会立即在所有业务 Engine 上暴露错误，这是最好的版本管理机制。**非 workspace 发布**（未来如果独立发布到 npm）时需要 SemVer 规划，但 Phase 8 范围内不涉及。
5. **totalMs 预算不能落在 400-599 区间**：实战发现 §6.5 regex guard `\b[45]\d\d\b` 会把 `"timeoutMs":500` 误识别为 HTTP 500 泄漏。README + 契约 mount 注释已留警示；Step 15-18 调优超时预算时必须遵守这一"视觉 disambiguation"约定。
6. **推送过程异常（若有）**：无。

## M. Step 15 衔接

Step 15 将落地第一个业务 Engine Adapter：`@tianqi/margin-engine-http`。它的结构：

```ts
// Step 15 骨架预览（非本 Step 实现）
import { createHttpBaseEngine } from "@tianqi/external-engine-http-base";

export const createMarginEngineHttp = (options: MarginEngineOptions) => {
  const base = createHttpBaseEngine({
    baseUrl: options.baseUrl,
    timeouts: options.timeouts ?? DEFAULT_MARGIN_TIMEOUTS
    // ... 其他五件套配置继承
  });
  return {
    adapterName: "margin-engine-http",
    init: () => base.init(),
    shutdown: () => base.shutdown(),
    healthCheck: () => base.healthCheck(),
    // 业务方法 —— 只在此层定义，五件套全部下沉到 base
    calculateMargin: async (params: MarginParams) => {
      const result = await base.call({ operation: "calculate", payload: params }, params.traceId);
      // 业务响应解析 —— 接收 HttpCallResponse，返回 Result<MarginResult, ...>
      // ...
    }
  };
};
```

Step 15 的契约验收将同时挂载两份：

- Step 13 的 `defineExternalEngineContractTests`（继承本基座验收通过的稳定性）
- Step 15 自定义的 `defineMarginEngineContractTests`（业务方法契约）

## N. 测试增量明细

| 来源                                     | 新增 `it` 数 |
| ---------------------------------------- | -----------: |
| `inf.test.ts`（TQ-INF-018 + 与 13 分离） |            2 |
| `http-base-engine.contract.test.ts`      |           21 |
| `http-base-engine.test.ts`               |            6 |
| **合计**                                 |       **29** |

**测试总数**：1459 → **1488**（+29）。Gate G15 下限 1480，达标。

## O. 对 Phase 8 剩余 Step 的影响

Step 14 完成后 Phase 8 剩下 5 个 Step：

| Step | 内容                                            | 直接继承本 Step                                   |
| ---- | ----------------------------------------------- | ------------------------------------------------- |
| 15   | margin-engine-http                              | 消费 base；定义业务方法；业务契约套件             |
| 16   | position-engine-http + match-engine-http        | 消费 base × 2 —— 复用 Step 11 的"双 Adapter" 模式 |
| 17   | mark-price-engine-http + fund-engine-http       | 消费 base × 2                                     |
| 18   | 跨 Engine 集成测试 + Application 层 DI 切换验证 | 使用所有 Engine                                   |
| 19   | Phase 8 Phase Gate + ADR 归档 + CHANGELOG       | Phase 8 收官                                      |

**Sprint E 中基座 + 5 业务的分层**：Step 13 契约是"天花板"，本 Step 基座是"地板"。业务 Engine 实际上只需要关心业务逻辑（几百行代码），稳定性从基座继承，契约由 testkit 验证 —— 这是 Phase 8 Adapter 工程学到目前为止最清晰的分层。
