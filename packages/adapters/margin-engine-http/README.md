# @tianqi/margin-engine-http

**Phase 8 首个业务 Engine Adapter** —— 实现 `MarginEnginePort`，通过 `workspace:*` 依赖 `@tianqi/external-engine-http-base`（基座 Adapter）获得五件套稳定性能力。本 Adapter 的业务代码约 200 行，稳定性 0 行——一切 retry / timeout / circuit breaker / rate limit / trace propagation 逻辑全部由基座承担。

## 消费基座的姿势（META-RULE O 合规）

```ts
// package.json
{
  "dependencies": {
    "@tianqi/external-engine-http-base": "workspace:*",
    ...
  }
}

// src/margin-engine-http.ts
import { createHttpBaseEngine } from "@tianqi/external-engine-http-base";
// ↑ 只从基座的 `src/index.ts` 公开导出消费；严禁 deep import。
```

**本 Adapter 不做的事**（META-RULE O 纪律）：

- **不重新设计五件套配置**：`MarginEngineHttpOptions = HttpBaseEngineOptions & {}` —— 全部透传
- **不实现独立的稳定性逻辑**：源码中零个 retry loop、零个 backoff sleep、零个熔断状态机
- **不触达基座内部结构**：只调用 `base.call() / init() / shutdown() / healthCheck()` 和 6 个 probe getter

## 业务方法 × downstream path 映射

Sprint E 建立的 operation → path 约定（kebab-case operation 名）：

| 方法 (camelCase)     | Operation (kebab-case) | HTTP 方法 | 路径                    |
| -------------------- | ---------------------- | --------- | ----------------------- |
| `calculateMargin`    | `calculate-margin`     | POST      | `/calculate-margin`     |
| `lockMargin`         | `lock-margin`          | POST      | `/lock-margin`          |
| `releaseMargin`      | `release-margin`       | POST      | `/release-margin`       |
| `queryMarginBalance` | `query-margin-balance` | POST      | `/query-margin-balance` |

Step 16-17 的四个业务 Engine（Position / Match / MarkPrice / Fund）继承此约定。

## 快速开始

```ts
import { createMarginEngineHttp } from "@tianqi/margin-engine-http";
import { createMarginAccountId, createMarginAmount, createMarginCurrency } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

const engine = createMarginEngineHttp({
  baseUrl: "http://margin-service.internal:8080",
  // 所有五件套配置直接透传给基座；业务 Engine 不重新解释任何字段。
  timeouts: { connectMs: 2_000, requestMs: 5_000, totalMs: 10_000 },
  retry: { maxAttempts: 4, baseDelayMs: 50, maxDelayMs: 1_000 },
  circuitBreaker: { threshold: 3, resetTimeoutMs: 500 },
  rateLimit: { maxConcurrency: 10 }
});

await engine.init();

const result = await engine.lockMargin({
  accountId: createMarginAccountId("acct-7d9"),
  amount: createMarginAmount(1_200),
  currency: createMarginCurrency("USDT"),
  idempotencyKey: "order-abc-lock-001",
  traceId: createTraceId("trace-order-abc-001")
});

if (result.ok) {
  console.log(
    `locked ${result.value.lockedAmount} ${result.value.currency}, lockId=${result.value.lockId}`
  );
} else {
  // 永远是 TQ-INF-013~018 或 TQ-CON-010 —— 绝不会是 HTTP 状态码或 ECONNRESET。
  console.error(result.error.code, result.error.message, result.error.context);
}

await engine.shutdown();
```

## Semantics（元规则 N 三条稳定性保证，业务 Engine 视角）

### 1. 稳定性继承（Inheritance from Base）

本 Adapter **不实现**独立的 retry / timeout / circuit breaker / rate limit / trace propagation 机制——全部由 `@tianqi/external-engine-http-base` 承担，并在其 README § Semantics 中被定义。升级基座时，本 Adapter 的稳定性行为也随之升级（workspace:\* 依赖自动生效）；本 Adapter 不提供 override 能力。

### 2. 请求幂等假设（Idempotency Assumption）

MarginEnginePort 的四个业务方法按"幂等性假设"分类：

| 方法                 | 幂等性           | 调用方义务                                    |
| -------------------- | ---------------- | --------------------------------------------- |
| `calculateMargin`    | 天然幂等         | 无                                            |
| `queryMarginBalance` | 天然幂等（只读） | 无                                            |
| `lockMargin`         | **依赖幂等键**   | 必须传唯一 `idempotencyKey`；下游去重由其保证 |
| `releaseMargin`      | **依赖幂等键**   | 必须传唯一 `idempotencyKey`；下游去重由其保证 |

Adapter 对 5xx / 网络错误自动重试（基座策略）。`lockMargin` / `releaseMargin` 若调用方未保证幂等键的唯一性与"同键同语义"，重试可能导致下游资金被重复锁定或释放。**这是调用方的责任，不是本 Adapter 的责任**。

### 3. 错误转译契约（Error Translation Contract）

下游 HTTP 状态码或网络错误 **永不原文透出**。所有故障映射为两个命名空间：

- **TQ-INF-013 ~ 018**（基座五件套 + init unreachable）—— 由基座自己产生，本 Adapter 透传
- **TQ-CON-010**（本 Adapter 独有）—— 下游返回 2xx 但 body 不符合 MarginEnginePort 响应 schema

错误 context 永远含领域 moniker（`downstream_unavailable` / `permission_denied` / `not_found` / `invalid_timestamp` / `missing_field` / ...），**从不**含 raw HTTP 状态、undici 错误 code、socket error class。`inf.test.ts` 和 `con.test.ts` 里有正则硬断言防回归。

## 错误码

| 错误码         | 来源                   | 触发场景                                                     |
| -------------- | ---------------------- | ------------------------------------------------------------ |
| TQ-INF-003     | 继承（Lifecycle 共性） | 未 init 就调用业务方法                                       |
| TQ-INF-004     | 继承（Lifecycle 共性） | shutdown 后调用业务方法                                      |
| TQ-INF-013     | 继承（基座）           | 超时（connect/request/total）                                |
| TQ-INF-014     | 继承（基座）           | 5xx/408/429/网络错误重试耗尽                                 |
| TQ-INF-015     | 继承（基座）           | 熔断 open 拒绝                                               |
| TQ-INF-016     | 继承（基座）           | 限流                                                         |
| TQ-INF-017     | 继承（基座）           | 下游返回 4xx（除 408/429）                                   |
| TQ-INF-018     | 继承（基座）           | init-time baseUrl 不可达（预留）                             |
| **TQ-CON-010** | **本 Adapter 新增**    | 下游返回 2xx 但响应 body 不符合 MarginEnginePort 响应 schema |

TQ-CON-010 的 context 字段：`{ adapterName: "margin-engine-http", operation, fieldPath, reason }`。`reason` 是领域 moniker（`missing_or_non_string` / `missing_or_negative_number` / `invalid_timestamp` / `not_json` / `not_object`），与下游服务运维团队共享 runbook。

## healthCheck 诊断字段

本 Adapter 的 healthCheck **完全委托**基座；`healthy` 直接继承基座判定。`details` 在基座字段之上额外追加：

- `engineKind: "margin"` —— 帮运维一眼识别这是 Margin 业务
- `businessMethods: "calculateMargin,lockMargin,releaseMargin,queryMarginBalance"` —— 文档性字段，供自动化健康轮询工具列举 Engine 能力

**不做独立探测**：业务 Engine 不得在基座能力之上另起一套稳定性判断（META-RULE O 具体应用）。

## 契约覆盖

两份契约挂载：

- **下层 — 稳定性契约（Step 13 `defineExternalEngineContractTests` × 21 `it`）**：`margin-engine-http.contract.test.ts` 一行挂载，证明基座复用不改变契约行为。
- **上层 — 业务方法测试（9 个 `it` 分三段）**：`margin-engine-http.test.ts` 覆盖 Adapter 身份、业务方法正向路径、业务方法错误路径。

**不建立** `defineMarginEngineContractTests` 契约函数（META-RULE P 第 2 条）——业务方法只有一个实现，契约测试不跨实现复用。

## 依赖

- `@tianqi/external-engine-http-base` —— 基座 Adapter（`workspace:*`）
- `@tianqi/ports` —— MarginEnginePort + 领域 brand 类型
- `@tianqi/contracts` —— 错误工厂
- `@tianqi/shared` —— Result / TraceId

**零新第三方依赖**（不引入 HTTP 库 —— 基座已封装；不引入 schema 校验库 —— 手写严格校验）。

## Step 16-17 衔接

本 Adapter 的三层结构（business methods / probe delegation / contract mount）是 Sprint E 剩余 4 个业务 Engine 的模板：

- Step 16: `@tianqi/position-engine-http` + `@tianqi/match-engine-http`
- Step 17: `@tianqi/mark-price-engine-http` + `@tianqi/fund-engine-http`

每个 Engine 预期代码量约 150-250 行主体 + 9-10 测试 + 自己的响应 schema parser + 自己的 TQ-CON-0XX 错误码（Step 16 新增 TQ-CON-011 / 012；Step 17 新增 TQ-CON-013 / 014）。
