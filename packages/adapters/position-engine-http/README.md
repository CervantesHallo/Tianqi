# @tianqi/position-engine-http

**Sprint E 第二个业务 Engine Adapter**（Step 16） —— 实现 `PositionEnginePort`，通过 `workspace:*` 依赖 `@tianqi/external-engine-http-base` 获得五件套稳定性能力。结构与 Step 15 `@tianqi/margin-engine-http` 同构，但**独立写出**——零代码复用、零相互 import（META-RULE F 在业务 Engine 之间硬约束）。

## 业务方法 × downstream path 映射

继承 Step 15 建立的 operation kebab-case 规约：

| 方法 (camelCase)    | Operation (kebab-case) | HTTP 方法 | 路径                   | 幂等性         |
| ------------------- | ---------------------- | --------- | ---------------------- | -------------- |
| `queryPosition`     | `query-position`       | POST      | `/query-position`      | 天然幂等（读） |
| `openPosition`      | `open-position`        | POST      | `/open-position`       | 依赖幂等键     |
| `adjustPosition`    | `adjust-position`      | POST      | `/adjust-position`     | 依赖幂等键     |
| `closePosition`     | `close-position`       | POST      | `/close-position`      | 依赖幂等键     |
| `listOpenPositions` | `list-open-positions`  | POST      | `/list-open-positions` | 天然幂等（读） |

5 个方法（3 写 + 2 读），覆盖一个账户从"建仓 → 维护 → 平仓"的完整路径。

## 快速开始

```ts
import { createPositionEngineHttp } from "@tianqi/position-engine-http";
import { createPositionAccountId, createPositionId, createPositionSize } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

const engine = createPositionEngineHttp({
  baseUrl: "http://position-service.internal:8080",
  // 五件套配置直接透传给基座；业务 Engine 不重新解释任何字段。
  timeouts: { connectMs: 2_000, requestMs: 5_000, totalMs: 10_000 },
  retry: { maxAttempts: 4 },
  circuitBreaker: { threshold: 3, resetTimeoutMs: 500 },
  rateLimit: { maxConcurrency: 10 }
});

await engine.init();

const result = await engine.openPosition({
  accountId: createPositionAccountId("acct-7d9"),
  symbol: "BTC-USDT",
  side: "long",
  size: createPositionSize(1.5),
  idempotencyKey: "order-abc-open-001",
  traceId: createTraceId("trace-order-abc-001")
});

if (result.ok) {
  console.log(`opened position ${result.value.positionId} side=${result.value.side}`);
} else {
  // 永远是 TQ-INF-013~018 或 TQ-CON-011 —— 绝不会是 HTTP 状态码或网络错误名。
  console.error(result.error.code, result.error.message, result.error.context);
}

await engine.shutdown();
```

## Semantics（元规则 N 三条稳定性保证）

### 1. 稳定性继承

本 Adapter **不实现**独立的 retry / timeout / circuit breaker / rate limit / trace propagation 机制——全部由 `@tianqi/external-engine-http-base` 承担。Adapter 源码 0 个 retry loop / 0 个 backoff sleep / 0 个熔断状态机。

### 2. 请求幂等假设

| 方法                | 幂等性         | 调用方义务                                    |
| ------------------- | -------------- | --------------------------------------------- |
| `queryPosition`     | 天然幂等（读） | 无                                            |
| `listOpenPositions` | 天然幂等（读） | 无                                            |
| `openPosition`      | **依赖幂等键** | 必须传唯一 `idempotencyKey`；下游去重由其保证 |
| `adjustPosition`    | **依赖幂等键** | 同上 —— 重试可能导致重复加减仓                |
| `closePosition`     | **依赖幂等键** | 同上                                          |

调用方未保证幂等键唯一性时，重试可能导致下游持仓被重复操作。**这是调用方的责任**。

### 3. 错误转译契约

下游 HTTP 状态码或网络错误 **永不原文透出**。所有故障映射为：

- **TQ-INF-013 ~ 018**（基座产生）—— 透传，仅替换 `adapterName`
- **TQ-CON-011**（本 Adapter 独有）—— 下游返回 2xx 但 body 不符合 PositionEnginePort 响应 schema

## 错误码

| 错误码         | 来源                | 触发场景                                          |
| -------------- | ------------------- | ------------------------------------------------- |
| TQ-INF-003/004 | 继承                | 未 init / 已 shutdown                             |
| TQ-INF-013     | 继承（基座）        | 超时                                              |
| TQ-INF-014     | 继承（基座）        | 重试耗尽                                          |
| TQ-INF-015     | 继承（基座）        | 熔断 open                                         |
| TQ-INF-016     | 继承（基座）        | 限流                                              |
| TQ-INF-017     | 继承（基座）        | 4xx（除 408/429）                                 |
| TQ-INF-018     | 继承（基座）        | init-time baseUrl 不可达                          |
| **TQ-CON-011** | **本 Adapter 新增** | 下游 2xx 但 body 不符合 PositionEnginePort schema |

TQ-CON-011 context: `{ adapterName, operation, fieldPath, reason }`。`reason` 是领域 moniker（`missing_or_non_string` / `missing_or_negative_number` / `invalid_timestamp` / `side_must_be_long_or_short` / `must_be_array` / `not_object` / `not_json` / `must_be_null_or_non_empty_string`）。

## healthCheck

完全委托基座；`details` 追加：

- `engineKind: "position"`
- `businessMethods: "queryPosition,openPosition,adjustPosition,closePosition,listOpenPositions"`

## 契约覆盖

- **下层（Step 13）**：`position-engine-http.contract.test.ts` 一行挂载驱动 21 个稳定性契约 `it`，证明基座复用不破坏稳定性
- **上层（业务方法）**：`position-engine-http.test.ts` 10 个 `it` 分 3 段（身份 3 / 业务正向 5 / 业务错误 2）

**不建立** `definePositionEngineContractTests` —— 业务方法只有一个实现，契约测试不跨实现复用（META-RULE P）。

## 与同 Sprint 业务 Engine 的关系

- 与 `@tianqi/margin-engine-http` / `@tianqi/match-engine-http`：**零代码共享、零相互 import**。结构同构是模板复用结果，不是代码复制副作用。
- 与 `@tianqi/external-engine-http-base`：**workspace:\* 依赖**（META-RULE O 特许例外）。

## 依赖

- `@tianqi/external-engine-http-base`（workspace:\*）
- `@tianqi/ports` / `@tianqi/contracts` / `@tianqi/shared`

**零新第三方依赖**。
