# @tianqi/mark-price-engine-http

**Sprint E 第四个业务 Engine Adapter**（Step 17 收官战之一） —— 实现 `MarkPriceEnginePort`，通过 `workspace:*` 依赖 `@tianqi/external-engine-http-base` 获得五件套稳定性能力。结构与 Step 15 / 16 的 margin / position / match 同构，但**独立写出**——零代码复用、零相互 import（META-RULE F 在业务 Engine 之间硬约束）。

**关键差异**：本 Adapter 是 Sprint E 唯一的**纯读引擎**——3 个业务方法全部为天然幂等读，无任何写方法、无幂等键。

## 业务方法 × downstream path 映射

继承 Step 15 建立的 operation kebab-case 规约：

| 方法 (camelCase)      | Operation (kebab-case)   | HTTP 方法 | 路径                      | 幂等性         |
| --------------------- | ------------------------ | --------- | ------------------------- | -------------- |
| `queryMarkPrice`      | `query-mark-price`       | POST      | `/query-mark-price`       | 天然幂等（读） |
| `queryMarkPriceBatch` | `query-mark-price-batch` | POST      | `/query-mark-price-batch` | 天然幂等（读） |
| `queryFundingRate`    | `query-funding-rate`     | POST      | `/query-funding-rate`     | 天然幂等（读） |

3 个方法（3 读 + 0 写），覆盖标记价两种读路径（单点 + 批量）+ 资金费率读路径。

## 快速开始

```ts
import { createMarkPriceEngineHttp } from "@tianqi/mark-price-engine-http";
import { createTraceId } from "@tianqi/shared";

const engine = createMarkPriceEngineHttp({
  baseUrl: "http://mark-price-service.internal:8080",
  // 五件套配置直接透传给基座；业务 Engine 不重新解释任何字段。
  timeouts: { connectMs: 2_000, requestMs: 5_000, totalMs: 10_000 },
  retry: { maxAttempts: 4 },
  circuitBreaker: { threshold: 3, resetTimeoutMs: 500 },
  rateLimit: { maxConcurrency: 10 }
});

await engine.init();

const result = await engine.queryMarkPrice({
  symbol: "BTC-USDT",
  traceId: createTraceId("trace-mp-001")
});

if (result.ok) {
  console.log(`mark price = ${result.value.markPrice} at ${result.value.queriedAt}`);
} else {
  // 永远是 TQ-INF-013~018 或 TQ-CON-013 —— 绝不会是 HTTP 状态码或网络错误名。
  console.error(result.error.code, result.error.message, result.error.context);
}

await engine.shutdown();
```

## Semantics（元规则 N 三条稳定性保证）

### 1. 稳定性继承

本 Adapter **不实现**独立的 retry / timeout / circuit breaker / rate limit / trace propagation 机制——全部由 `@tianqi/external-engine-http-base` 承担。Adapter 源码 0 个 retry loop / 0 个 backoff sleep / 0 个熔断状态机。

### 2. 请求幂等假设

| 方法                  | 幂等性         | 调用方义务 |
| --------------------- | -------------- | ---------- |
| `queryMarkPrice`      | 天然幂等（读） | 无         |
| `queryMarkPriceBatch` | 天然幂等（读） | 无         |
| `queryFundingRate`    | 天然幂等（读） | 无         |

**纯读引擎**：调用方无需提供 idempotencyKey；下游对同一 symbol 的重复查询返回当时刻的最新报价。重试是完全安全的。

### 3. 错误转译契约

下游 HTTP 状态码或网络错误 **永不原文透出**。所有故障映射为：

- **TQ-INF-013 ~ 018**（基座产生）—— 透传，仅替换 `adapterName`
- **TQ-CON-013**（本 Adapter 独有）—— 下游返回 2xx 但 body 不符合 MarkPriceEnginePort 响应 schema

## 错误码

| 错误码         | 来源                | 触发场景                                           |
| -------------- | ------------------- | -------------------------------------------------- |
| TQ-INF-003/004 | 继承                | 未 init / 已 shutdown                              |
| TQ-INF-013     | 继承（基座）        | 超时                                               |
| TQ-INF-014     | 继承（基座）        | 重试耗尽                                           |
| TQ-INF-015     | 继承（基座）        | 熔断 open                                          |
| TQ-INF-016     | 继承（基座）        | 限流                                               |
| TQ-INF-017     | 继承（基座）        | 4xx（除 408/429）                                  |
| TQ-INF-018     | 继承（基座）        | init-time baseUrl 不可达                           |
| **TQ-CON-013** | **本 Adapter 新增** | 下游 2xx 但 body 不符合 MarkPriceEnginePort schema |

TQ-CON-013 context: `{ adapterName, operation, fieldPath, reason }`。`reason` 是领域 moniker：

- `missing_or_non_string` — symbol 字段非字符串
- `missing_or_non_positive_number` — 标记价 ≤ 0（与 Margin/Fund 的 ≥ 0 约束严格区分；标记价为零或负在加密资产无合法解释）
- `missing_or_non_finite_number` — 资金费率非有限数（资金费率可负，但必须 finite）
- `invalid_timestamp` — queriedAt / fundingTime 非 ISO-8601
- `must_be_array` — batch 响应的 prices 非数组
- `not_object` / `not_json` — body 整体非合法 JSON 对象

## 读取型 Engine 在熔断 open 时的运维语义

操作型 Engine（margin / position / match）熔断 open 时，运维的反应是"暂停下游调用，等冷却"——失败的写操作没有副作用，可以重试。

**纯读 Engine 不同**：熔断 open 期间，上游决策（如风控算法）无法获取最新标记价，可能被迫使用陈旧价格或主动降级。运维 dashboard 看到 `engineKind: "mark-price"` + `circuitBreakerState: "open"` 时，应当：

1. 立即检查上游决策是否进入降级路径（不应该 silently 用 N 分钟前的价格）
2. 评估下游服务是否真的不可用（vs. 偶发抖动），决定是否人工介入熔断重置
3. 若长时间 open，应当切换 baseUrl 到镜像下游服务（下次基座升级支持热切换时）

## healthCheck

完全委托基座；`details` 追加：

- `engineKind: "mark-price"`
- `businessMethods: "queryMarkPrice,queryMarkPriceBatch,queryFundingRate"`

## 契约覆盖

- **下层（Step 13）**：`mark-price-engine-http.contract.test.ts` 一行挂载驱动 21 个稳定性契约 `it`，证明基座复用不破坏稳定性
- **上层（业务方法）**：`mark-price-engine-http.test.ts` **8 个 `it`** 分 3 段（身份 3 / 业务正向 3 / 业务错误 2）—— Convention L 修订版**弹性应用**：3 业务方法占 3 个正向名额，剩余 2 个名额未使用（克制 > 堆砌）

**不建立** `defineMarkPriceEngineContractTests` —— 业务方法只有一个实现，契约测试不跨实现复用（META-RULE P）。

## 与同 Sprint 业务 Engine 的关系

- 与 `@tianqi/margin-engine-http` / `@tianqi/position-engine-http` / `@tianqi/match-engine-http` / `@tianqi/fund-engine-http`：**零代码共享、零相互 import**。结构同构是模板复用结果，不是代码复制副作用。
- 与 `@tianqi/external-engine-http-base`：**workspace:\* 依赖**（META-RULE O 特许例外）。

## 依赖

- `@tianqi/external-engine-http-base`（workspace:\*）
- `@tianqi/ports` / `@tianqi/contracts` / `@tianqi/shared`

**零新第三方依赖**。
