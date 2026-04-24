# @tianqi/external-engine-http-base

**Phase 8 首个"基座 Adapter"** —— External Engine HTTP 基座，封装《补充文档》§6.1 五件套（超时 / 重试 / 熔断 / 限流 / 追踪传播）的真实 HTTP 栈实现（基于 undici@8.1.0）。Step 15-18 的 5 个业务 Engine Adapter（MarginEngine / PositionEngine / MatchEngine / MarkPriceEngine / FundEngine）均以 workspace 依赖方式消费本包。

## 基座 Adapter 身份声明（META-RULE O）

本包是 **Tianqi 仓库第一个基座 Adapter**。META-RULE O 对"基座特许依赖"的七条准入条件在此声明：

1. **基座标识**：包名含 `-base` 后缀（`@tianqi/external-engine-http-base`）。
2. **无业务 Port 实现**：不实现任何业务 Port（MarginEnginePort / PositionEnginePort 等），只封装五件套稳定性契约 + HTTP 栈。
3. **身份显式**：本 README 作为"基座 Adapter"声明的永久载体。
4. **独立验收**：单独通过 Step 13 的 `defineExternalEngineContractTests` 21 个契约 `it`；不依赖任何业务 Engine。
5. **显式 workspace 依赖**：Step 15-18 的 Engine Adapter 在各自 `package.json` 中显式写 `"@tianqi/external-engine-http-base": "workspace:*"`。
6. **公开接口消费**：消费者只使用本包 `src/index.ts` 导出的 `createHttpBaseEngine` / `HttpBaseEngineOptions` / `HttpBaseEngineError` / 类型；**严禁 deep import 进入 `src/http-base-engine.ts` 内部**。
7. **单基座限制**：Phase 8 仓库内**最多一个基座 Adapter**。未来"第二个基座"的引入需要独立 Phase Gate 评估。

对其他 Adapter 作者（非基座）：META-RULE F 的"Adapter 之间互不依赖"纪律依然严格有效。例如 `@tianqi/margin-engine-http` 不得依赖 `@tianqi/position-engine-http`。基座是**被特许的中转站**，不是"公共代码库"。

## 快速开始

```ts
import { createHttpBaseEngine } from "@tianqi/external-engine-http-base";
import { createTraceId } from "@tianqi/shared";

const engine = createHttpBaseEngine({
  baseUrl: "http://margin-service.internal:8080",
  timeouts: {
    connectMs: 2_000, // 建立 TCP+TLS 连接的预算
    requestMs: 5_000, // 发送请求头 → 收到响应头 & 响应体的单次预算
    totalMs: 10_000 // 单次 call() 整体超时（含重试与退避）
  },
  retry: {
    maxAttempts: 4, // 1 次初始 + 3 次重试
    baseDelayMs: 50, // 指数退避起点
    maxDelayMs: 1_000 // 退避上限
  },
  circuitBreaker: {
    threshold: 3, // 连续失败数触发 open
    resetTimeoutMs: 500 // open → half-open 的冷却时长
  },
  rateLimit: {
    maxConcurrency: 10 // undici Pool.connections 同步到此值
  },
  traceHeaderName: "x-tianqi-trace-id", // 追踪透传 header（默认名称）
  healthCheckTimeoutMs: 2_000,
  healthCheckPath: "/"
});

await engine.init();

const traceId = createTraceId("trace-order-123");
const result = await engine.call(
  { operation: "quote", payload: { symbol: "BTC-USDT", side: "buy" } },
  traceId
);

if (result.ok) {
  console.log(`HTTP ${result.value.statusCode}`, result.value.body);
} else {
  // 所有失败都已按《§6.5 领域摘要转译》规范化为 TQ-INF-013 ~ 018 领域错误码。
  console.error(result.error.code, result.error.message, result.error.context);
}

await engine.shutdown();
```

## call() 请求形状

```ts
type HttpBaseCallRequest = {
  readonly operation: string; // 必填。映射为 URL 路径段（自动前缀 "/"）
  readonly payload?: unknown; // 可选。JSON.stringify 后成为 body
  readonly method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; // 默认 "POST"
  readonly headers?: Record<string, string>; // 可选。业务 header
};
```

**默认语义**：`method = "POST"`，`path = "/${operation}"`，`payload` 变为 JSON body，`Content-Type: application/json` 自动注入。业务 Engine（Step 15+）可按需覆写 `method` 和 `headers`。

## Semantics（元规则 N 在基座 Adapter 的三条声明）

External Engine 语境下"传递语义"重解释为 **三条稳定性保证**：

### 1. 重试与幂等保证

- Adapter 对 **5xx / 408 / 429** 和网络错误（ECONNRESET / ECONNREFUSED / ENOTFOUND / headers/body timeout）自动重试，最多 `retry.maxAttempts` 次（默认 4 = 1+3）。
- 退避策略为 **指数退避**，起点 `baseDelayMs`（默认 50ms），上限 `maxDelayMs`（默认 1000ms）。
- **超时不重试**——timeouts 耗尽后立即返回 `TQ-INF-013`。超时是"预算问题"不是"transient 问题"，重试只会雪上加霜。
- **4xx（除 408/429）不重试**——它们代表请求契约错误，重试只会放大 4xx。直接返回 `TQ-INF-017`。
- **关键调用方责任**：Adapter 不保证请求幂等性。**调用方必须确保请求本身是幂等的**，否则重试可能导致下游副作用重复（例如：重试 POST /order 可能导致下单两次）。推荐做法：传递 idempotency-key 或使用自然幂等的 operation（GET / 带主键的 upsert）。

### 2. 熔断行为保证

- 连续失败次数达到 `circuitBreaker.threshold`（默认 3）后熔断器从 `closed` → `open`。
- `open` 状态持续 `circuitBreaker.resetTimeoutMs`（默认 500ms）内**所有 `call()` 立即失败返回 `TQ-INF-015`**，**不触达下游**——这是保护下游的核心机制。
- `resetTimeoutMs` 后熔断器转入 `half-open`：下一次 `call()` 作为"试探"被允许通过，成功则 `closed`、失败则回到 `open`。
- **熔断 `open` 与 `half-open` 均 `healthCheck.healthy: false`**（Step 13 §E 决策）——运维 dashboard 不对"拒绝流量"的 Adapter 报告健康。只有 `running` + `closed` 才是 `healthy: true`。
- **失败计数的边界**：一次外部 `call()` 无论内部经历多少次重试，最终只计入熔断器 1 次失败（或成功）。这确保熔断阈值的语义是"连续外部调用失败次数"，不是"连续 HTTP 请求失败次数"。

### 3. 下游错误领域化保证（《§6.5 领域摘要转译》硬约束）

所有下游故障被转译为 `TQ-INF-013 ~ 018` 共 6 个领域错误码。**调用方永远不会收到**：

- 原始 HTTP 状态码（400 / 403 / 404 / 500 / 503 等）——被分类为 `invalid_request` / `permission_denied` / `not_found` / `downstream_unavailable` 等领域 moniker。
- 原始网络错误名（ECONNRESET / EPIPE / ETIMEDOUT / ENOTFOUND）——被转译为 `downstream_unavailable` 或 `timeout` (phase=connect/request/total)。
- undici 特有的错误（UND_ERR_HEADERS_TIMEOUT / UND_ERR_BODY_TIMEOUT 等）——被转译为对应 timeout phase。
- 下游服务的内部错误消息、堆栈 trace、provider-specific 错误代码。

`inf.test.ts` 里有正则硬断言（`.not.toMatch(/^[45]\d\d$/)` / `.not.toMatch(/ECONNRESET|EPIPE|ETIMEDOUT|AggregateError/)`）防止回归。Step 13 契约套件的 `test_timeout_error_does_not_leak_raw_socket_or_http_details` 在基座上对真实 HTTP 栈重新验证。

## 错误码

| 错误码     | 语义                              | 触发场景                                        |
| ---------- | --------------------------------- | ----------------------------------------------- |
| TQ-INF-003 | 未 init（Lifecycle 共性）         | 未 init 就调用 `call()`                         |
| TQ-INF-004 | 已 shutdown（Lifecycle 共性）     | shutdown 后调用 `call()`                        |
| TQ-INF-013 | 超时                              | connect/request/total 任一预算耗尽              |
| TQ-INF-014 | 重试耗尽                          | 5xx/408/429/网络错误重试到 `maxAttempts` 仍失败 |
| TQ-INF-015 | 熔断 open                         | 熔断器 `open` 状态下拒绝调用                    |
| TQ-INF-016 | 限流                              | 并发数达到 `rateLimit.maxConcurrency` 上限      |
| TQ-INF-017 | 不可重试错误                      | 下游返回 4xx（除 408/429）                      |
| TQ-INF-018 | baseUrl 不可达（init 时预检失败） | 预留给 Step 15+ 业务 Engine 显式预检使用        |

所有错误消息前缀为 `TQ-*:`。`result.error.context` 含领域级诊断字段（`timeoutPhase` / `consecutiveFailures` / `currentConcurrency` / `finalFailureCategory` 等）。

## healthCheck 详情字段

```ts
{
  lifecycle: "created" | "running" | "shut_down",
  baseUrl: string,                          // 配置的基础 URL（路径已规范化）
  circuitBreakerState: "closed" | "open" | "half-open",
  currentConcurrency: number,               // 当前在飞请求数
  peakConcurrency: number,                  // 历史峰值
  maxConcurrency: number,                   // 配置的上限
  lastError: string,                        // 最近一次错误摘要（领域化，无 raw 泄漏）
  lastSuccessAt: string,                    // ISO-8601；"none" if never succeeded
  lastCircuitTransitionAt: string,          // ISO-8601 熔断状态最近一次转换
  healthCheckTimeoutMs: number
}
```

健康探测动作：`OPTIONS <baseUrl><healthCheckPath>`（默认 `healthCheckPath = "/"`）。Options 是 HTTP 标准的"只读能力探测"动词，不触发业务逻辑。**熔断 `open` 或 `half-open` 时 `healthy: false` 且不发探测**——对一个正在主动拒绝流量的 Adapter 再去探测只会加剧问题。

## 五件套与 undici 的映射

| 五件套成员 | 本 Adapter 实现方式                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| 超时       | `connectTimeout` / `headersTimeout` / `bodyTimeout` 映射到 undici Pool，再加 `AbortController` 守护 `totalMs` |
| 重试       | 手写 retry loop（无第三方库），指数退避 + 分类重试 / 不重试                                                   |
| 熔断       | 手写状态机（无第三方库），三态 `closed`/`open`/`half-open`，转换时间戳 ISO-8601                               |
| 限流       | `undici.Pool.connections` 同步到 `rateLimit.maxConcurrency` + 独立并发计数器作前置检查                        |
| 追踪传播   | `x-tianqi-trace-id` HTTP header 注入；contract probe `getLastTraceId()` 观察                                  |

## 依赖

- **`undici@8.1.0`**（精确版本锁，MIT 许可，纯 JS 无 native build）——Node.js 官方维护的 HTTP 客户端，Apache 基金会级性能，内置 keep-alive / HTTP/2 / AbortSignal 支持。元规则 G 第五次实战。未扩张根 `pnpm.onlyBuiltDependencies` 白名单。
- 未引入 `opossum`（熔断）/ `bottleneck`（限流）/ `p-retry`（重试）/ `axios` / `got` 等库——这些场景全部手写，保持契约实现的可审读性。

## 关联

- **Step 13 契约套件**：`@tianqi/adapter-testkit` `defineExternalEngineContractTests` 21 个 `it`，本包通过全部。
- **Step 15-18 业务 Engine Adapter**：消费本包提供五件套能力，各自实现业务方法。
- **docs/phase8/14-external-engine-http-base.md**：本 Step 完整执行记录（设计裁决、风险、元规则触发）。
