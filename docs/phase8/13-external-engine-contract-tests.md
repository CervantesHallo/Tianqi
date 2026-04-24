# Phase 8 / Step 13 — Sprint E 立契约起点：adapter-testkit External Engine 契约套件

## A. Step 13 定位

Step 13 是 **Sprint E 的立契约起点**——角色等同于 Sprint B 的 Step 3（EventStore）、Sprint C 的 Step 7（Notification）、Sprint D 的 Step 10（Config）。本 Step 把《补充文档》§6 外部引擎客户端约束的**五件套**（超时 / 重试 / 熔断 / 限流 / 追踪传播）翻译为可被任意 External Engine HTTP Adapter 直接复用的契约 `it` 块。

零正式 Adapter，零新第三方依赖。参考实现严格限定 `src/fixtures/`；`defineExternalEngineContractTests` 的消费者是 Step 14 的 `external-engine-http-base`（HTTP 基座）以及 Step 15-18 的五个业务 Engine Adapter。

## B. External Engine 与前三域的根本差异

|                | EventStore / Notification / Config | External Engine                         |
| -------------- | ---------------------------------- | --------------------------------------- |
| **调用方向**   | Tianqi 是数据主人                  | Tianqi 是远程调用方                     |
| **契约关注点** | 数据不丢、顺序正确、状态原子       | 调用稳定性、失败可控、下游不污染领域    |
| **失败语义**   | 写入失败 → 1PC + compensation      | 调用失败 → 超时 / 重试 / 熔断 / 限流    |
| **领域层影响** | 失败直接抛给调用方                 | 失败必须经《§6.5 转译》为领域可识别错误 |

Sprint B-D 建立的 1PC + compensation 模式针对"写操作"；Sprint E 面对"外部调用"，两者工程形态不同。Step 13 契约的主体是"Adapter 的稳定性责任"，不是"Engine 的业务能力"。

## C. 四个裁决问题

### 1. Engine 基座抽象的归属（§五.1）

**选择：情况 B —— testkit-专属抽象**。

**背景**：指令描述中声称"Phase 1-7 已冻结 5 个 External Engine Port"，但实际 `ls packages/ports/src/` 后发现**不存在**任何名字含 `engine` / `external` / `margin` / `position` / `match` / `markprice` / `fund` 的 Port。`grep ExternalEngine|MarginEngine|PositionEngine|MatchEngine|MarkPriceEngine|FundEngine packages/` 也零命中。

**META-RULE A 触发**：既有事实胜出。Phase 1-7 没有 Engine Port 意味着必须在 adapter-testkit 内定义 `TestkitExternalEngineFoundation`：

```ts
export type TestkitExternalEngineFoundation = {
  readonly adapterName: string;
  call(
    request: ExternalEngineRequest,
    traceId?: TraceId
  ): Promise<Result<ExternalEngineSuccess, ExternalEngineError>>;
};
```

单个通用 `call()` 方法足以暴露五件套全部行为——契约关注的是稳定性不变量，与业务方法签名正交。Step 14 的 HTTP 基座实现本接口；Step 15-18 的业务 Engine Adapter 通过基座 + 自身业务方法共同满足本契约。

### 2. 故障注入方式（§五.2）

**选择：β（options 回调）**。

`ExternalEngineContractOptions` 暴露五个回调：

- `injectTimeout(adapter)` —— 下次 call 超时
- `injectError(adapter, downstreamCategory, retryable)` —— 下次 call 失败，retryable 决定是否重试
- `injectSlowResponse(adapter, delayMs)` —— 下次 call 延迟 N ms
- `injectSuccessAfterFailures(adapter, failureCount)` —— 前 N 次失败，第 N+1 次成功
- `resetInjections(adapter)` —— 清空（在 afterEach 自动调用）

**为何不选 α（参考实现内部开关）**：选项 α 会让契约套件与特定实现耦合——testkit 的 `call` 方法签名就会多一个 testkit-only 参数（或依赖全局开关）。β 完全解耦：契约套件只知道"存在这些可调用回调"，不知道是怎么实现的。

**为何不选 γ（扩张 Adapter 责任）**：在 Adapter 公共接口上加 `__injectFault()` 方法违反元规则 M。故障注入是 testkit 的事，不是 Adapter 的事。

**为何不选 δ（内建 HTTP mock）**：引入 HTTP 栈复杂度与第三方依赖；且 HTTP 只是一种具体实现形式，Sprint E 未来可能有 gRPC / websocket 版本。

### 3. 限流在参考实现中的语义（§五.3）

**选择：P —— 真实并发上限 + 溢出拒绝**。

参考实现有 `concurrencyCap` 配置（默认 5）。当 `currentConcurrency >= cap` 时后续 call 返回 `TQ-INF-016` 而非排队。这是"拒绝而非排队"的设计——契约 `it` 可以立即断言溢出失败，不需要等超时。

**为何不选 Q（probe 字段存在性只验型）**：违反"不准假装通过"硬指令。契约套件必须驱动真实行为发生。

**为何不选 R（推到 Step 14）**：Step 14 的 HTTP 基座会继承本契约；如果本 Step 留下"限流契约待 Step 14 补"的缝隙，Step 14 就有裁量空间——违反"契约一旦发布不可重解释"的元规则 B 精神。

### 4. 追踪传播契约的断言对象（§五.4）

**选择：X —— call 接受 TraceId，probe.getLastTraceId() 作断言**。

`call(request, traceId?)` 的 traceId 由调用方传入。参考实现把 traceId 保存到内部 `lastTraceId` 字段；probe 的 `getLastTraceId()` 返回该值。契约 `it`：

```ts
const trace = createTraceId("trace-contract-1");
await adapter.call({ operation: "lookup" }, trace);
expect(adapter.getLastTraceId()).toBe(trace);
```

**TraceId vs TraceContext**：Phase 1-7 shared 包只有 `TraceId = Brand<string, "TraceId">`，没有 `TraceContext` 包装对象。直接用 `TraceId` 足够——Sprint B/C 的 `NotificationMessage.traceId` 也是 TraceId 字段而非 context 对象。保持一致比新造 context 类型更克制。

**不传 traceId 的行为**：契约允许 `null` 或自生成默认值——参考实现选 `null`。契约只断言"状态已定义"，不约束具体选择，给 Step 14 HTTP 基座保留生成默认 trace-id 的自由。

## D. 6 类别覆盖范围与五件套的映射

| 类别                     | `it` 数 | 五件套 / Foundation 映射                  | 关键断言                                                                                                   |
| ------------------------ | ------: | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1 Timeout                |       4 | §6.1 超时                                 | TQ-INF-013 phase 标识 / 预算与 elapsed 数字 / 不泄漏 raw socket / 注入后下次正常                           |
| 2 Retry                  |       4 | §6.1 重试 + §6.2 退避 + §6.3 不可重试透出 | 可重试在预算内成功 / 不可重试 TQ-INF-017 立即返回 / 退避真实发生（elapsed 可测）/ 预算耗尽 TQ-INF-014      |
| 3 Circuit Breaker        |       4 | §6.1 熔断 + §6.4 熔断可观测               | 连续失败 → open / open 状态 TQ-INF-015 不触发下游 / reset timeout 后 → half-open / half-open 成功 → closed |
| 4 Rate Limit             |       3 | §6.1 限流                                 | 并发超 cap → TQ-INF-016 / 串行调用永不被限流 / probe 当前与历史峰值准确                                    |
| 5 Trace Propagation      |       3 | §6.1 追踪传播                             | 传入 TraceId 可观察 / 不传产生已定义 probe 状态 / 多次调用 trace 独立                                      |
| 6 AdapterFoundation 集成 |       3 | Step 2 AdapterFoundation + §6.4           | 未 init TQ-INF-003 / shutdown 后 TQ-INF-004 / 熔断 open 时 healthCheck healthy=false                       |

**共 21 `it`（≥20 下限）**。

**6 类而非 5 的依据**：五件套是 5 类业务主题；单独把 AdapterFoundation 集成拆出来是因为 Tianqi 所有 Adapter 类型都共享 Foundation 契约（在 Sprint B/C/D 的契约套件里也都是独立类别）。六类结构与既有 Sprint 对齐，新来者读契约套件结构时不会有惊讶。

## E. "熔断 open 算不算不健康"的 healthCheck 决策

**选择：open → healthy: false**（也包括 half-open → healthy: false）。

**理由**：

- 熔断 open 时 Adapter 主动拒绝每一次 call，reporting healthy: true 会让运维 dashboard 说谎——明明服务在拒绝调用却显示"一切正常"。
- half-open 是"试探期"，尚未确认下游恢复；保守报 false 让运维知道"还没完全恢复"。
- 只有 running + closed 组合才是"能正常处理流量"——这是唯一可以理直气壮报 healthy: true 的状态。

**契约 `it` 固化**：`test_health_check_reports_healthy_false_when_circuit_is_open` 是本决策的永久留痕。

**对 Step 14+ 的约束**：Step 14 HTTP 基座实现本契约，必须遵守此决策。Step 15-18 的业务 Engine 继承基座行为。

## F. 五件套行为：真实 vs 模拟

| 行为     | 参考实现内部真实行为                                  | 通过 options 注入模拟                          |
| -------- | ----------------------------------------------------- | ---------------------------------------------- |
| 超时     | totalTimeoutMs 配置生效（对 injectSlowResponse）      | injectTimeout 手动触发 TQ-INF-013              |
| 重试     | maxRetries + 指数退避 (10ms × 2^n cap 100ms) 真实循环 | injectSuccessAfterFailures 驱动"失败-成功"序列 |
| 熔断     | 真实状态机 (closed/open/half-open) + 真实计数器       | injectError 驱动连续失败以触发转换             |
| 限流     | 真实 currentConcurrency 计数器 + cap 检查             | injectSlowResponse 拉长在飞行窗口              |
| 追踪传播 | 真实 lastTraceId 字段 echo                            | 契约直接传 traceId 即可                        |

**关键：没有一项是"只做 probe 存在性检查"**。超时、重试次数、熔断状态、并发计数、trace echo 全部是参考实现的真实执行路径。禁止让契约"假装通过"硬指令得到贯彻。

## G. 错误码新增裁决（惯例 K）

| 码         | 名称                              | 新增理由                                                                     |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------- |
| TQ-INF-013 | EXTERNAL_ENGINE_TIMEOUT           | 超时诊断工具链（检查 timeout 配置、看 histogram）与其他 TQ-INF 完全不同      |
| TQ-INF-014 | EXTERNAL_ENGINE_RETRIES_EXHAUSTED | 重试耗尽独特——运维需要知道"已试过 N 次仍失败"，不能与首次失败混淆            |
| TQ-INF-015 | EXTERNAL_ENGINE_CIRCUIT_OPEN      | 熔断 open 不是"调用失败"而是"主动拒绝"，运维 runbook 完全不同                |
| TQ-INF-016 | EXTERNAL_ENGINE_RATE_LIMITED      | 限流是客户端侧决策，修复路径"提高 cap 或加前置队列"独特                      |
| TQ-INF-017 | EXTERNAL_ENGINE_NON_RETRYABLE     | 与 TQ-INF-014 刚好相反：这是"单次失败且不可重试"，修复看请求契约不看下游服务 |

**五个码对应五种截然不同的 runbook**——惯例 K 的核心判据是"是否同一诊断动作能解决"，本 Step 的五个失败场景各自有独立 runbook，理应独立码。

**复用**：TQ-INF-003 / TQ-INF-004（Lifecycle 共性）。

**《§6.5 领域摘要转译》纪律的具体表达**：

- TQ-INF-013 context 只含 `{ adapterName, timeoutPhase: "connect"|"request"|"total", timeoutMs, elapsedMs }`——**不含** raw socket error class names / ECONNRESET / EPIPE。
- TQ-INF-014 context 只含 `{ adapterName, attempts, maxRetries, finalFailureCategory: string }`——finalFailureCategory 是领域 moniker（"downstream_unavailable" / "transient_conflict"），**不是** HTTP 5xx。
- TQ-INF-017 context 只含 `{ adapterName, downstreamCategory: string, reason: string }`——downstreamCategory 是 "invalid_request" / "permission_denied" / "not_found"，**不是** 400 / 403 / 404。

`inf.test.ts` 固化这一纪律：`externalEngineRetriesExhaustedError` 测试用 `expect(String(ctx.finalFailureCategory)).not.toMatch(/^[45]\d\d$/)` 硬卡死 raw HTTP 状态；`externalEngineNonRetryableError` 测试同样卡死 `/^\d\d\d$/`。契约套件的 timeout 测试用 `expect(JSON.stringify(error)).not.toMatch(/ECONNRESET|EPIPE|ETIMEDOUT|AggregateError|\b[45]\d\d\b/)` 卡死序列化泄漏。

## H. 参考实现与 Step 14+ 职责分离

**目录分离**：

- `packages/adapters/adapter-testkit/src/fixtures/reference-external-engine.ts` —— 内部参考实现，**禁止**通过 `src/index.ts` 导出，**禁止**在 `package.json` exports 字段暴露。
- `packages/adapters/external-engine-http-base/`（Step 14 才新建）—— HTTP 基座 Adapter，是真正的生产代码。

**代码禁止复用**（META-RULE F 扩展到 Engine Adapter 之间）：

- Step 14 HTTP 基座不得 `import { createReferenceExternalEngine }`。
- Step 15-18 的业务 Engine Adapter 不得相互 import。
- 五件套的独立实现是 Sprint E 的"模式可移植性"证明（类比 Step 11 的 config-memory vs config-file）。

**消费路径**：

- adapter-testkit 自测 → 参考实现（证明契约可运行）
- Step 14 HTTP 基座 → 自行实现五件套 → 自行挂载契约（证明真实 HTTP 栈可通过）
- Step 15-18 业务 Engine → 依赖 HTTP 基座 + 自行实现业务方法 → 业务方法契约由各自 Step 定义（本 Step 不涉及）

## I. 元规则 A–J + M + N 触发情况

- **A（指令 vs 既有事实冲突）**：**首次在 Sprint E 触发一次**。指令声明"Phase 1-7 已冻结 5 个 External Engine Port"，实地 `ls` + `grep` 证实无任何 Engine Port——既有事实胜出，情况 B 生效，testkit-专属 `TestkitExternalEngineFoundation`。docs §C.1 永久留痕。
- **B（testkit 签名兼容）**：贯彻——既有 6 个契约函数（Lifecycle / HealthCheck / EventStore basic+persistent / Notification / Config basic+persistent）签名零改动；`defineExternalEngineContractTests` 是本 Step 首次发布，泛型与参数顺序遵循既有模式。
- **C（EventStorePort 只写）**：不适用。
- **D（adapter-testkit 依赖边界）**：贯彻——新增 external-engine-contract\*.ts 只依赖 ports / contracts / shared / vitest，零新第三方。
- **E（持久化契约独立函数）**：不适用——External Engine 语境无持久化。
- **F（参考实现跨包引用禁令）**：**扩展到 Engine Adapter 之间**——Step 14+ 禁止 import reference-external-engine；Step 15-18 禁止相互 import。
- **G（第三方依赖准入）**：**零触发**——未引入任何第三方依赖。
- **H（持久化 Adapter 自管 schema）**：不适用。
- **I（外部服务 healthCheck 语义）**：**首次在契约层面贯彻**——`test_health_check_reports_healthy_false_when_circuit_is_open` 固化"熔断 open → healthy: false"；Step 14 HTTP 基座未来将首次在真实 HTTP 场景实战。
- **J（测试外部服务隔离）**：**首次在契约层面预铺路**——契约套件全程无真实网络调用，options 回调是唯一故障注入路径。Step 14 HTTP 基座需按 `TIANQI_TEST_ENGINE_URL` 环境变量保护真实 HTTP 测试。
- **M（testkit 观察原语约束）**：**严格贯彻**——`ExternalEngineContractProbe` 六个方法全是 getter（`getCircuitBreakerState / getCurrentConcurrency / getPeakConcurrency / getLastTraceId / getRetryStats / getLastCircuitTransitionAt`），无 `reset*` / `clear*` / `set*` 任何写操作。故障注入完全在 `ExternalEngineContractOptions` 中，不是 probe 的职责。
- **N（显式声明语义）**：**首次在契约层面贯彻**——契约暴露的每个失败路径（5 类别 × 关键 `it`）都是显式断言，不依赖调用方的"隐式期望"。Step 14 HTTP 基座未来的 README 必须显式声明其 timeout/retry/circuit/rate/trace 默认值与边界。

## J. 惯例 K + L 应用情况

- **K（错误码共性 vs 专属）**：新增 5 码（TQ-INF-013 ~ 017），复用 TQ-INF-003/004。§G 逐条裁决。
- **L（Adapter 自有测试边界）**：不直接适用——本 Step 无正式 Adapter。Step 14+ 的 Adapter 将在各自 Step 实战。

## K. Sprint E 依赖结构预告

Step 13 完成后 Sprint E 六步的依赖结构：

```
Step 13: defineExternalEngineContractTests  ← 五件套稳定性契约，所有 Engine Adapter 共享
   │
   ├─ Step 14: @tianqi/external-engine-http-base  ← HTTP 基座，封装五件套实现
   │     │
   │     ├─ Step 15: @tianqi/margin-engine-http     ← 消费 Step 14 + margin 业务方法
   │     ├─ Step 16: @tianqi/position-engine-http   ← 消费 Step 14 + position 业务方法
   │     ├─ Step 17: @tianqi/match-engine-http      ← 消费 Step 14 + match 业务方法
   │     └─ Step 18: 合并 mark-price + fund Engine  ← 消费 Step 14 + 剩余业务方法
   │
   └─ Step 14+ 也各自挂载 defineExternalEngineContractTests（五件套再次验证）
```

本 Step 契约 `it` 在 Step 14 就会开始挂载验证（基座通过一个"null business Engine"形态独立通过五件套契约）。

## L. Step 14 衔接与未来 Port 定义

**Step 14 职责**：

- 新建 `@tianqi/external-engine-http-base` 包
- 实现真实 HTTP 客户端（基于 `node:http` / `node:https` / `undici` 其一，待 Step 14 裁决）
- 五件套真实实现（不复用参考实现代码）
- 挂载 `defineExternalEngineContractTests` 验证五件套
- 若需要真实 HTTP mock 测试，按元规则 J 用 `TIANQI_TEST_ENGINE_URL` 环境变量保护
- 按需新增错误码（例如 TQ-INF-018 EXTERNAL_ENGINE_UNREACHABLE 对应真实 DNS 失败等，由 Step 14 裁决）

**packages/ports 下 Engine Port 何时定义**：

- 本 Step 发现 Phase 1-7 无 Engine Port。
- Step 15-18 各自为自己的业务 Engine（MarginEngine / PositionEngine / MatchEngine / MarkPriceEngine / FundEngine）定义 Port，位于 `packages/ports/src/<engine>-port.ts`。
- 各自 Step 定义自己的 `define<Engine>ContractTests`（业务方法契约），与本 Step 的五件套稳定性契约正交。

## M. 测试增量明细

| 来源                                                          | 新增 `it` 数 |
| ------------------------------------------------------------- | -----------: |
| `inf.test.ts`（TQ-INF-013 ~ 017 五个工厂 + 统一性断言）       |            6 |
| `external-engine-contract.test.ts`（21 契约 `it` 在参考实现） |           21 |
| `exports.test.ts`（新契约函数并排导出）                       |            1 |
| **合计**                                                      |       **28** |

**测试总数**：1431 → **1459**（+28）。Gate G10 下限 1451，达标。

## N. 风险点

1. **五件套参考实现简化可能掩盖真实 HTTP 栈复杂性**：参考实现用 sleep 模拟 backoff，用 counter 模拟 concurrency——真实 HTTP 客户端会遇到 keep-alive 连接池、DNS 解析缓存、TCP 半关闭、TLS 握手超时等复杂情况。缓解：Step 14 HTTP 基座必须挂载本契约套件，任何契约缺口会在 Step 14 第一时间暴露；本 Step 的 21 `it` 是"地板"不是"天花板"。
2. **Step 14 可能发现参考实现未覆盖的契约缺口**：例如"请求体很大时的分段超时"、"response streaming 的 chunk 超时"等。缓解：Step 14 裁决是否扩充本 Step 契约（新增 `it` 必须在 Step 14 的 docs 中留痕，并作为对 Step 13 契约的"修订"而非"覆盖"）。
3. **熔断 open → healthy: false 对运维 dashboard 的长期影响**：如果熔断频繁误触发（例如下游短暂抖动），dashboard 会高频报不健康，可能导致运维"屏蔽"该 Adapter。缓解：文档必须向 Step 14+ 的 Adapter 作者强调"熔断阈值必须与业务容忍度匹配，过低的 threshold 会制造运维噪声"。
4. **参考实现被 Step 14+ 误用**：META-RULE F 扩展禁止复制 `reference-external-engine.ts` 代码；Step 14 的 code review 必须显式检查。
5. **推送过程异常（若有）**：可控。

## O. 对作品级代码库的意义

Step 13 的价值不在"多一份契约套件"，而在：

1. **把《补充文档》§6 五件套从纸面变成可运行契约**——未来任何"TypeScript 项目对接加密交易所"的同行工程师读到这份契约，能立刻理解"Tianqi 认为稳定性是什么"。
2. **为 Step 14-18 的 5 个业务 Engine Adapter 留下不可妥协的基础稳定性标准**——无论底层 HTTP 栈换成 `undici` 还是 `got`，无论目标交易所是 Binance 还是 OKX，21 `it` 必须全绿。
3. **把"外部调用"这个分布式系统最容易出问题的场景，用契约形式给出真正可测的答案**——《§6.5 领域摘要转译》纪律固化进 `inf.test.ts` 的正则断言，防止回归。

Tianqi 的第一原则是清晰、可控、可信。Sprint E 面对的是 Tianqi 与外部世界的接触面。Step 13 立得稳，后续 5 个 Engine Adapter 无论底层 HTTP 栈怎么变、目标交易所怎么换，稳定性契约永远不变——这是作品级代码库与凑合代码库的分水岭。
