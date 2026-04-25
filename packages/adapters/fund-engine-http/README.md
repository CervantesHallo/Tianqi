# @tianqi/fund-engine-http

**Sprint E 第五个业务 Engine Adapter**（Step 17 收官战之二，Sprint E 最终一战） —— 实现 `FundEnginePort`，通过 `workspace:*` 依赖 `@tianqi/external-engine-http-base` 获得五件套稳定性能力。结构与 Step 15 / 16 / 17 mark-price 同构，但**独立写出**——零代码复用、零相互 import（META-RULE F 在业务 Engine 之间硬约束）。

**关键差异**：本 Adapter 是 Sprint E 的**读为主 + 单一弱写**混合形态——4 个业务方法 = 3 读 + 1 写（`transferFund`，依赖 idempotencyKey）。

## 业务方法 × downstream path 映射

继承 Step 15 建立的 operation kebab-case 规约：

| 方法 (camelCase)      | Operation (kebab-case)  | HTTP 方法 | 路径                     | 幂等性         |
| --------------------- | ----------------------- | --------- | ------------------------ | -------------- |
| `queryFundBalance`    | `query-fund-balance`    | POST      | `/query-fund-balance`    | 天然幂等（读） |
| `queryFundLedger`     | `query-fund-ledger`     | POST      | `/query-fund-ledger`     | 天然幂等（读） |
| `transferFund`        | `transfer-fund`         | POST      | `/transfer-fund`         | 依赖幂等键     |
| `queryTransferStatus` | `query-transfer-status` | POST      | `/query-transfer-status` | 天然幂等（读） |

4 个方法（3 读 + 1 写），覆盖账户资金"余额视图 + 流水查询 + 划转 + 划转状态查询"完整路径。

## 快速开始

```ts
import { createFundEngineHttp } from "@tianqi/fund-engine-http";
import { createFundAccountId, createFundAmount, createFundCurrency } from "@tianqi/ports";
import { createTraceId } from "@tianqi/shared";

const engine = createFundEngineHttp({
  baseUrl: "http://fund-service.internal:8080",
  // 五件套配置直接透传给基座；业务 Engine 不重新解释任何字段。
  timeouts: { connectMs: 2_000, requestMs: 5_000, totalMs: 10_000 },
  retry: { maxAttempts: 4 },
  circuitBreaker: { threshold: 3, resetTimeoutMs: 500 },
  rateLimit: { maxConcurrency: 10 }
});

await engine.init();

const result = await engine.transferFund({
  fromAccountId: createFundAccountId("acct-A"),
  toAccountId: createFundAccountId("acct-B"),
  currency: createFundCurrency("USDT"),
  amount: createFundAmount(500),
  idempotencyKey: "transfer-abc-001",
  traceId: createTraceId("trace-trf-001")
});

if (result.ok) {
  console.log(`transfer ${result.value.transferId} status=${result.value.status}`);
} else {
  // 永远是 TQ-INF-013~018 或 TQ-CON-014 —— 绝不会是 HTTP 状态码或网络错误名。
  console.error(result.error.code, result.error.message, result.error.context);
}

await engine.shutdown();
```

## Semantics（元规则 N 三条稳定性保证）

### 1. 稳定性继承

本 Adapter **不实现**独立的 retry / timeout / circuit breaker / rate limit / trace propagation 机制——全部由 `@tianqi/external-engine-http-base` 承担。Adapter 源码 0 个 retry loop / 0 个 backoff sleep / 0 个熔断状态机。

### 2. 请求幂等假设

| 方法                  | 幂等性         | 调用方义务                                    |
| --------------------- | -------------- | --------------------------------------------- |
| `queryFundBalance`    | 天然幂等（读） | 无                                            |
| `queryFundLedger`     | 天然幂等（读） | 无                                            |
| `queryTransferStatus` | 天然幂等（读） | 无                                            |
| `transferFund`        | **依赖幂等键** | 必须传唯一 `idempotencyKey`；下游去重由其保证 |

调用方未保证幂等键唯一性时，重试可能导致重复划转。**这是调用方的责任**。

### 3. 错误转译契约

下游 HTTP 状态码或网络错误 **永不原文透出**。所有故障映射为：

- **TQ-INF-013 ~ 018**（基座产生）—— 透传，仅替换 `adapterName`
- **TQ-CON-014**（本 Adapter 独有）—— 下游返回 2xx 但 body 不符合 FundEnginePort 响应 schema

## 错误码

| 错误码         | 来源                | 触发场景                                      |
| -------------- | ------------------- | --------------------------------------------- |
| TQ-INF-003/004 | 继承                | 未 init / 已 shutdown                         |
| TQ-INF-013     | 继承（基座）        | 超时                                          |
| TQ-INF-014     | 继承（基座）        | 重试耗尽                                      |
| TQ-INF-015     | 继承（基座）        | 熔断 open                                     |
| TQ-INF-016     | 继承（基座）        | 限流                                          |
| TQ-INF-017     | 继承（基座）        | 4xx（除 408/429）                             |
| TQ-INF-018     | 继承（基座）        | init-time baseUrl 不可达                      |
| **TQ-CON-014** | **本 Adapter 新增** | 下游 2xx 但 body 不符合 FundEnginePort schema |

TQ-CON-014 context: `{ adapterName, operation, fieldPath, reason }`。`reason` 是领域 moniker：

- `missing_or_non_string` — accountId / currency / transferId / entryId 等字符串字段缺失或非字符串
- `missing_or_negative_number` — 余额 / 流水 amount 字段非有限数或为负
- `invalid_timestamp` — queriedAt / entryAt / transferredAt 非 ISO-8601
- `transfer_status_unknown` — TransferStatus 不在 `pending/completed/failed` 三值域内
- `ledger_entry_type_unknown` — LedgerEntryType 不在 `deposit/withdrawal/transfer/trade/fee` 五值域内
- `must_be_array` — entries 字段非数组
- `not_object` / `not_json` — body 整体非合法 JSON 对象

## healthCheck

完全委托基座；`details` 追加：

- `engineKind: "fund"`
- `businessMethods: "queryFundBalance,queryFundLedger,transferFund,queryTransferStatus"`

## 契约覆盖

- **下层（Step 13）**：`fund-engine-http.contract.test.ts` 一行挂载驱动 21 个稳定性契约 `it`，证明基座复用不破坏稳定性
- **上层（业务方法）**：`fund-engine-http.test.ts` **9 个 `it`** 分 3 段（身份 3 / 业务正向 4 / 业务错误 2）—— Convention L 修订版下界 1 个 slot 未使用（克制 > 堆砌）

**不建立** `defineFundEngineContractTests` —— 业务方法只有一个实现，契约测试不跨实现复用（META-RULE P）。

## 与同 Sprint 业务 Engine 的关系

- 与 `@tianqi/margin-engine-http` / `@tianqi/position-engine-http` / `@tianqi/match-engine-http` / `@tianqi/mark-price-engine-http`：**零代码共享、零相互 import**。结构同构是模板复用结果，不是代码复制副作用。
- 与 `@tianqi/external-engine-http-base`：**workspace:\* 依赖**（META-RULE O 特许例外）。

## 依赖

- `@tianqi/external-engine-http-base`（workspace:\*）
- `@tianqi/ports` / `@tianqi/contracts` / `@tianqi/shared`

**零新第三方依赖**。
