# Phase 8 / Step 16 — Sprint E 第二、三个业务 Engine：@tianqi/position-engine-http & @tianqi/match-engine-http（同步落地）

## A. Step 16 定位

Step 16 是 **Phase 8 首次同步落地两个业务 Engine Adapter** 的一步，目标是把 Step 15 (`@tianqi/margin-engine-http`) 凝结的"基座 + 业务"分层模板一次性扩展两次，并用同步落地的工程压力压力测试两个独立纪律：

1. **META-RULE F 在 sibling business engines 之间的硬约束**：两个新 Adapter 之间**零代码共享、零相互 import**，即便结构 100% 同构
2. **Convention L 修订版的可重复性**：两个 Engine 各自独立的 ≤10 个自有测试在 3 段（身份 / 业务正向 / 业务错误）下都跑绿，证明该惯例不是 Step 15 的偶然产物

物理产物：

- `packages/ports/src/position-engine-port.ts`（首次引入）
- `packages/ports/src/match-engine-port.ts`（首次引入）
- `packages/adapters/position-engine-http/`（新包，`workspace:*` 依赖 `@tianqi/external-engine-http-base`）
- `packages/adapters/match-engine-http/`（新包，**与 position 同构但完全独立**）
- `TQ-CON-011 POSITION_RESPONSE_SCHEMA_INVALID`
- `TQ-CON-012 MATCH_RESPONSE_SCHEMA_INVALID`

测试增量：1521 → **1586**（+65），见 §H。

## B. META-RULE A 第三、四次触发（连续两次）

Step 16 指令描述声称 `PositionEnginePort` 与 `MatchEnginePort` 在 Phase 1-7 已冻结，但实地 `ls packages/ports/src/` + `grep -r 'PositionEngine\|MatchEngine' packages/` 双双证伪——和 Step 13（无 ExternalEnginePort）/ Step 15（无 MarginEnginePort）连续三次同病——本仓库 `packages/ports/src/` 在 Phase 1-7 内**完全没有任何 Engine Port**。

**处置**：对两个 Port 各按 META-RULE A "既有事实胜出" 原则首次引入：

| 文件                                         | 触发原则       | 落地内容                                                                           |
| -------------------------------------------- | -------------- | ---------------------------------------------------------------------------------- |
| `packages/ports/src/position-engine-port.ts` | META-RULE A #3 | `PositionEnginePort` + 5 业务方法 + 3 brand 类型 + side 字面量 + 错误类型          |
| `packages/ports/src/match-engine-port.ts`    | META-RULE A #4 | `MatchEnginePort` + 5 业务方法 + 3 brand 类型 + side/type/status 字面量 + 错误类型 |

两个 Port 各自从 `packages/ports/src/index.ts` re-export brand 构造器、业务请求/响应类型、错误类型。Phase 1-7 文档由 Phase 8 Phase Gate (Step 19) 集中修订到位，本 Step 不动文档。

**与 Step 13 / Step 15 precedent 一致性**：

- Step 13 把 ExternalEnginePort 的空缺补给 testkit（契约抽象的消费者是 testkit 自身）
- Step 15 把 MarginEnginePort 的空缺补给 packages/ports（业务抽象的消费者是 Application 层 DI）
- Step 16 把 Position / Match 的空缺继续补给 packages/ports，与 Step 15 同处置

每次都是"实际资产不存在则首次引入，不触犯签名冻结约束"。

## C. 核心设计裁决

### 1. 双 Adapter 同步落地的强边界（META-RULE F 硬约束）

两个 Adapter 之间**零代码共享、零相互 import**，结构同构是模板复用的结果，不是代码复制的副作用。具体证据：

| 检查项                                              | position-engine-http                   | match-engine-http                      |
| --------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| 是否 `import` from `@tianqi/match-engine-http`？    | ❌ 否                                  | （N/A，反向）                          |
| 是否 `import` from `@tianqi/position-engine-http`？ | （N/A）                                | ❌ 否                                  |
| 共享 helper / utility / parser？                    | ❌ 各自独立写出 5 个 response parser   | ❌ 各自独立写出 5 个 response parser   |
| 共享 mock server 实例？                             | ❌ 各自 `createMockDownstreamServer()` | ❌ 各自 `createMockDownstreamServer()` |
| 共享 `translateBaseError` 实现？                    | ❌ 各自实现一份                        | ❌ 各自实现一份                        |
| `dependencies` 包含 sibling business engine？       | ❌ 仅基座 + 三公共包                   | ❌ 仅基座 + 三公共包                   |

唯一被两个 Adapter 同时消费的是 `@tianqi/external-engine-http-base`（基座，META-RULE O 特许例外）+ `@tianqi/adapter-testkit` 的 `createMockDownstreamServer`（Step 15 已被多个 Adapter 消费的公共测试工具）+ `@tianqi/ports` / `@tianqi/contracts` / `@tianqi/shared`（公共抽象层）。

**为什么这样设计**：sibling business engine 之间相互依赖一旦发生，Engine A 的 wire 改动会传播到 Engine B 的 production 包，违反"业务 Engine 只承担一种业务的翻译"的单职责原则。同步落地两个 Adapter 是验证此约束在工程压力下不被破坏的最佳时机——若任何 helper 偷偷被两个 Adapter 共享，本 Step 立即崩。

### 2. PositionEnginePort 业务方法 × operation 映射

| 方法 (camelCase)    | Operation (kebab-case) | HTTP 路径 (POST)       | 幂等性         |
| ------------------- | ---------------------- | ---------------------- | -------------- |
| `queryPosition`     | `query-position`       | `/query-position`      | 天然幂等（读） |
| `openPosition`      | `open-position`        | `/open-position`       | 依赖幂等键     |
| `adjustPosition`    | `adjust-position`      | `/adjust-position`     | 依赖幂等键     |
| `closePosition`     | `close-position`       | `/close-position`      | 依赖幂等键     |
| `listOpenPositions` | `list-open-positions`  | `/list-open-positions` | 天然幂等（读） |

5 个方法 = 3 写 + 2 读，覆盖一个账户从"建仓 → 维护 → 平仓"的完整路径。

### 3. MatchEnginePort 业务方法 × operation 映射

| 方法 (camelCase)   | Operation (kebab-case) | HTTP 路径 (POST)      | 幂等性         |
| ------------------ | ---------------------- | --------------------- | -------------- |
| `placeOrder`       | `place-order`          | `/place-order`        | 依赖幂等键     |
| `cancelOrder`      | `cancel-order`         | `/cancel-order`       | 依赖幂等键     |
| `queryOrder`       | `query-order`          | `/query-order`        | 天然幂等（读） |
| `listActiveOrders` | `list-active-orders`   | `/list-active-orders` | 天然幂等（读） |
| `queryTrades`      | `query-trades`         | `/query-trades`       | 天然幂等（读） |

5 个方法 = 2 写 + 3 读，覆盖一笔订单从"下单 → 撤单 → 查询 → 查成交"的完整撮合路径。

**operation kebab-case 规约（Step 15 建立、Step 16 第二次实战）**：

- 方法名 camelCase → operation kebab-case 一一对应（无歧义）
- operation 直接拼接为下游路径段（基座默认行为：`path = /${operation}`）
- 10 个 operation 之间无命名冲突（Position 全部以名词 `Position(s)` 收尾、Match 全部以 `Order(s)` / `Trades` 收尾）

10 个 operation 一字不差地反映在两个 Adapter 的业务方法测试 `mock.getLastRequestPath()` 断言里，任何拼写漂移在 CI 上即崩。

### 4. 错误码新增：TQ-CON-011 + TQ-CON-012

**惯例 K 裁决**（继承 Step 15 决断逻辑）：

| 候选复用                    | 判断                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| TQ-CON-005（Event schema）  | 不复用 — 读者不同（event schema package maintainers vs Position/Match downstream service teams） |
| TQ-CON-008（Config schema） | 不复用 — 读者不同（config schema: Tianqi operators editing YAML）                                |
| TQ-CON-009（History state） | 不复用 — 读者不同（history: Tianqi on-call deep-ops）                                            |
| TQ-CON-010（Margin schema） | 不复用 — 读者不同（margin downstream service team vs position / match service teams）            |

**新增**：

| 码         | name                               | 谁会读？                         | reason 域 moniker（domain monikers）                                                                                                                                                                        |
| ---------- | ---------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TQ-CON-011 | `POSITION_RESPONSE_SCHEMA_INVALID` | downstream Position service team | `missing_or_non_string` / `missing_or_negative_number` / `invalid_timestamp` / `side_must_be_long_or_short` / `must_be_array` / `not_object` / `not_json` / `must_be_null_or_non_empty_string`              |
| TQ-CON-012 | `MATCH_RESPONSE_SCHEMA_INVALID`    | downstream Match service team    | `missing_or_non_string` / `missing_or_negative_number` / `invalid_timestamp` / `side_must_be_buy_or_sell` / `type_must_be_market_or_limit` / `status_unknown` / `must_be_array` / `not_object` / `not_json` |

context 字段：`{ adapterName, operation, fieldPath, reason }`。

**`con.test.ts` 新增 3 个 it**：

1. `TQ-CON-011 工厂 round-trip` — 工厂返回的 ContractError 经 JSON 序列化反序列化后字段稳定
2. `TQ-CON-012 工厂 round-trip` — 同上
3. **5 码分离断言** — `TQ-CON-005 / 008 / 010 / 011 / 012` 五个 schema 类错误码的 code 字符串两两不重，永久留痕"每个业务 Engine 独占一个错误码槽位"规约

### 5. META-RULE O 消费实战（业务层未重新设计五件套，再次证明）

两个 Adapter 各自的 Options 类型：

- `PositionEngineHttpOptions = HttpBaseEngineOptions & {}`
- `MatchEngineHttpOptions = HttpBaseEngineOptions & {}`

交叉类型零新字段。两个 Adapter 完全透传基座选项，不 Omit、不 rename、不加业务默认值。源码 `grep "retry\|timeout\|circuit\|rateLimit\|backoff\|sleep"` 在两个 `src/*-engine-http.ts` 内零命中（除 options.\* 透传 + 注释）。

healthCheck 直接继承 `base.healthCheck()` 的 `healthy` 判定；`details` 各自扩展 documentary 字段（`engineKind: "position"` / `"match"` + `businessMethods: <,-joined methods>`），但**不新增独立稳定性观察**。

### 6. META-RULE P 第二、三次实战

**下层契约（Step 13 21 it 一行挂载）**：

- `position-engine-http.contract.test.ts` — 21 it 全绿（基座的稳定性契约通过 `workspace:*` 依赖跨包传递时行为不变）
- `match-engine-http.contract.test.ts` — 21 it 全绿（独立 mock server 实例；与 position 测试零交互）

**上层业务测试（Convention L 修订版 ≤10 it 分 3 段）**：

| 段            | position-engine-http.test.ts                                          | match-engine-http.test.ts                                          |
| ------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 身份（3）     | `factory_requires_base_url_at_runtime`                                | `factory_requires_base_url_at_runtime`                             |
|               | `object_keys_exposes_position_port_methods_plus_foundation_no_extras` | `object_keys_exposes_match_port_methods_plus_foundation_no_extras` |
|               | `base_adapter_is_properly_consumed_via_probe_delegation`              | `base_adapter_is_properly_consumed_via_probe_delegation`           |
| 业务正向（5） | 5 方法各 1 it                                                         | 5 方法各 1 it                                                      |
| 业务错误（2） | `non_retryable_4xx → TQ-INF-017 no raw status leak`                   | `non_retryable_4xx → TQ-INF-017 no raw status leak`                |
|               | `malformed_body → TQ-CON-011 with field reason`                       | `malformed_body → TQ-CON-012 with field reason`                    |

每个 Engine 自有 10 it，达 Convention L 修订版上限（保留扩展空间为 0）。

**不建立** `definePositionEngineContractTests` / `defineMatchEngineContractTests` —— 业务方法各自只有一个实现，契约测试不跨实现复用（META-RULE P 文字精神）。

### 7. 400-599 超时回避（Step 14 §G 规约第三次实战）

两个 Adapter 的契约 mount 都使用 `timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 }`，完全避开 400-599 数字区间——避免 timeout 数字被误识别为 HTTP 状态码（基座 §6.5 实战发现）。

### 8. README 各自完整章节

每个 README 包含 6 个固定章节：

1. 包定位 + 与 sibling Adapter 关系声明
2. 业务方法 × downstream path 映射表（含幂等性）
3. 快速开始（factory + init + 一个业务方法 + shutdown）
4. **Semantics 三条**（稳定性继承 / 幂等假设 / 错误转译契约）—— META-RULE N 强制
5. 错误码表 + reason 域 moniker 列表
6. 契约覆盖（下层 21 + 上层 10）

不重述基座 README 内容；用 `@tianqi/external-engine-http-base` 链接指向。

### 9. 元规则 A–O + P / 惯例 K + L 逐条触发情况

- **A**：**第三、四次触发**（§B）——PositionEnginePort + MatchEnginePort 都首次引入
- **B**：贯彻 — 既有 8 契约函数 / Step 14 基座 / Step 15 margin 包零改动
- **C / E / H**：不适用
- **D**：贯彻 — adapter-testkit 零新导出（Step 15 已建好 `createMockDownstreamServer`）
- **F**：**强边界第一次实战实际可观测** — §C.1 表格证实两个新 Adapter 之间零互相 import / 零共享 helper
- **G**：**零触发** — 零新第三方依赖
- **I**：贯彻 — 两个 healthCheck 完全委托基座；业务层零独立探测
- **J**：贯彻 — 各自 mock server 跑独立 ephemeral port，无 `TIANQI_TEST_*`
- **M**：贯彻 — 两个 Adapter 的 probe 6 getter 全 read-only
- **N**：贯彻 — 两个 README § Semantics 三条都到位
- **O**：**第二、三次消费方实战** — §C.5 证据：两个 Adapter 各自零稳定性逻辑
- **P**：**第二、三次实战** — §C.6 双层挂载（21 + 10）× 2 个 Engine
- **K（惯例）**：TQ-CON-011 + TQ-CON-012 各自新增 + 5 码分离断言
- **L（惯例）**：**第二、三次实战** — 两个 Engine 各自 10 it 分 3 段全绿

## D. 实现细节裁决

### 1. PositionEnginePort 的 `positionId: PositionId | null` 处理

`queryPosition` 在"账户尚无该 symbol 持仓"时下游应当返回 `positionId: null`（用 null 显式表达"无持仓"），而非省略字段。**parser 区分两种 schema 违反**：

- `positionId` 字段缺失或非字符串非 null → `must_be_null_or_non_empty_string`
- `positionId` 是空字符串 `""` → `must_be_null_or_non_empty_string`

`null` 是合法值；`""` 不是。这个领域 moniker 让运维一眼看出"下游漏掉了字段"vs"下游传了垃圾值"。

### 2. MatchEnginePort 的 enum validators

Match 引擎涉及 3 个枚举字段（OrderSide / OrderType / OrderStatus），各自独立的领域 moniker：

- `side_must_be_buy_or_sell`（不混用 buy / sell 与 long / short——撮合域用 buy/sell，持仓域用 long/short）
- `type_must_be_market_or_limit`（撮合 Phase 8 仅支持这两个；其他类型如 stop / trailing 留给后续 Phase）
- `status_unknown`（5 个合法状态值之一以外的全部归类）

`status_unknown` 的命名故意保留宽泛性——撮合状态的扩展空间不可预测。

### 3. `placeOrder` 的 price 条件透传

```ts
{
  // ...
  ...(request.price !== undefined ? { price: request.price } : {}),
  idempotencyKey: request.idempotencyKey
}
```

Limit 单必须传 price，market 单不能传 price——业务 Engine 不替下游做这个 validation（responsibility belongs downstream），只透明地把 caller 给的字段传过去；caller 漏字段下游会以 TQ-INF-017 invalid_request 反弹。

### 4. 测试 timeout 调优

contract mount 用 `requestMs: 200` 是 Step 14 § G 实战发现"避开 400-599"的具体数字；business test mount 也沿用相同的小 timeout 以保证测试速度（每个 test 内最短路径 ~10ms，最长 hang test ~150ms）。

## E. 同步落地的工程复杂度

两个 Adapter 同步落地相比 Step 15 单 Adapter 的工程额外成本：

| 维度                         | Step 15 单 Adapter | Step 16 双 Adapter     | 倍数             |
| ---------------------------- | ------------------ | ---------------------- | ---------------- |
| `packages/adapters/<n>` 目录 | 1                  | 2                      | 2×               |
| 根 tsconfig 引用             | +1 reference       | +2 references          | 2×               |
| pnpm workspace 包注册        | 自动               | 自动                   | —                |
| ports 文件                   | 1                  | 2                      | 2×               |
| 错误码槽位                   | 1                  | 2                      | 2×               |
| con.test.ts it 增量          | 2                  | 3（5 码分离要求 +1）   | 1.5×             |
| 21 契约 mount                | 1 套               | 2 套（独立 mock 实例） | 2×               |
| 10 自有 it                   | 9 it               | 10 + 10                | 2.2×             |
| README                       | 1                  | 2                      | 2×               |
| 物理 commits                 | 4                  | 4                      | 1×（按文档分组） |

工程复杂度近线性翻倍，但**心智复杂度并未翻倍**——两个 Adapter 共享同一份模板，新增第二个 Adapter 是"按模板填空"。这就是 Step 15 凝结模板的具体投资回报。

## F. 风险点

1. **基座升级传播风险**：基座 breaking change 现在会同时在 3 个业务 Adapter 上 surface（margin / position / match）。mitigation：`pnpm typecheck` 在基座任意改动后 0 行新代码即检出。
2. **PositionEnginePort 与 PositionPort（risk-domain）的命名冲突**：`packages/ports/src/` 历史上有 `position-port.ts`（Phase 1-7 风险域 read-only Port）吗？grep 验证后无该文件——本 Step 不冲突。但 Phase 9 若引入风险域 PositionView，需明确两个 Port 的命名空间分离。mitigation：本 Step 文件名 `position-engine-port.ts` 显式带 `engine` 前缀避歧。
3. **MatchEngine 与 MarkPriceEngine 的 operation 命名冲突**：Step 17 的 MarkPriceEngine 可能引入 `query-price` operation，与 MatchEngine 的 `query-trades` 字面区分但语义易混。mitigation：每个 Engine 独立的 mock server 实例 + `mock.getLastRequestPath()` 断言，CI 上即崩。
4. **OrderStatus 5 值的演进风险**：撮合状态值若 Phase 9 扩展（如新增 `expired`），Match Adapter 需要更新 ORDER_STATUSES 数组——这是显式更新，不是隐式改变行为。mitigation：parser 拒绝 unknown 状态返回 `status_unknown`，永远不会"silently accept" 新状态。
5. **dual-Adapter 的 vitest 并发风险**：若 `vitest run` 并发执行两个 contract test 文件，两个 mock server 各自占用一个 ephemeral port，理论上无端口冲突。mitigation：vitest 默认 fork 模式确保进程隔离；实测 1586 测试 ~8s 全绿，无 flake。
6. **README 维护漂移**：两个 README 结构一致但内容必须分别准确——若 Position README 错把 `placeOrder` 写进 method 表（粘贴遗漏修改），CI 不会检出。mitigation：commit reviewer 必须验证 README 的 method 表 / error reason 列表 / engineKind 字段在两个 README 中都正确；本 Step 走 4 个 commit 分文件 review。

## G. Step 17 衔接

Step 17 将再同步落地 2 个业务 Engine：

- `@tianqi/markprice-engine-http`（标记价格引擎）— 预计 3-4 业务方法，TQ-CON-013
- `@tianqi/fund-engine-http`（资金引擎）— 预计 4-5 业务方法，TQ-CON-014

Step 17 完全继承本 Step 建立的所有规约，零新决策：

1. META-RULE A 第五、六次触发（两个 Port 首次引入）
2. operation kebab-case 规约
3. 错误码独占槽位 + 5+1+1 分离断言（TQ-CON-005 / 008 / 010 / 011 / 012 / 013 / 014 七码两两不重）
4. README 6 章节模板
5. 测试 3 段 ≤10 it
6. 双契约 mount 套

Sprint E 收官（Step 17 完成）后 Phase 8 业务 Engine 完整覆盖：margin / position / match / markprice / fund 共 5 Engine，对应 5 个错误码槽位 TQ-CON-010 ~ 014。

## H. 测试增量明细

| 来源                                                                | 新增 `it` 数 |
| ------------------------------------------------------------------- | -----------: |
| `con.test.ts`（TQ-CON-011 + TQ-CON-012 工厂 + 5 码分离）            |            3 |
| `position-engine-http.contract.test.ts`（21 契约在业务 Adapter 上） |           21 |
| `position-engine-http.test.ts`（10 自有分 3 段）                    |           10 |
| `match-engine-http.contract.test.ts`（21 契约在业务 Adapter 上）    |           21 |
| `match-engine-http.test.ts`（10 自有分 3 段）                       |           10 |
| **合计**                                                            |       **65** |

**测试总数**：1521 → **1586**（+65）。Gate G16 下限 1580，达标。

## I. 代码规模实证

| 组件                                                                 | 源码行数 | 测试行数 | 说明                                                |
| -------------------------------------------------------------------- | -------: | -------: | --------------------------------------------------- |
| `packages/ports/src/position-engine-port.ts`                         |     ~146 |        — | Port + 3 brand 构造器 + 5 请求/响应类型             |
| `packages/ports/src/match-engine-port.ts`                            |     ~158 |        — | Port + 3 brand 构造器 + 3 enum 字面量 + 5 请求/响应 |
| `packages/adapters/position-engine-http/src/position-engine-http.ts` |     ~430 |        — | 5 业务方法 + 5 parser + factory + healthCheck       |
| `packages/adapters/match-engine-http/src/match-engine-http.ts`       |     ~480 |        — | 5 业务方法 + 5 parser + 3 enum validator + factory  |
| `packages/adapters/position-engine-http/test/*.test.ts`              |        — |     ~280 | 21 契约 + 10 自有                                   |
| `packages/adapters/match-engine-http/test/*.test.ts`                 |        — |     ~290 | 21 契约 + 10 自有                                   |

两个 Adapter 主实现 ~430 + ~480 = ~910 行，其中：

- ~360 行 response parser（schema 校验细节——必要的严格性，每 Engine 5 parser × ~36 行 = ~180 行）
- ~360 行业务方法薄层翻译 + 委托（5 method × ~30 行）
- ~190 行 types + factory + imports

**稳定性相关**：零行（全部委托基座）。

**与基座交互**：每 Engine 5 个 `base.call()` + 1 个 `call()` 透传 + 1 个 `healthCheck()` 装饰 + 6 个 probe 透传 = 13 行，× 2 = 26 行。

Sprint E 累计（Step 15 + 16）：3 业务 Engine、~1300 行业务翻译、零行稳定性逻辑。Step 17 预计再加 ~1000 行，Sprint E 收官时 ~2300 行业务翻译总量。

## J. 对作品级代码库的意义

Step 16 的价值在于把 Step 15 凝结的"基座 + 业务"分层模板从"理论上可复用"推到"已经实战复用 2 次"，并在同步落地的工程压力下证明：

1. **同步落地不破坏 META-RULE F**：两个 Adapter 在同一个 commit 流里成形，每行代码都要经过 reviewer 检验是否在 sibling 之间偷偷共享——本 Step 4 commit 分文件 review 流程把这种偷分享检验显化。
2. **错误码独占槽位规约延续**：Sprint E 收官时，每个业务 Engine 独占一个 TQ-CON-0XX 槽位，`con.test.ts` 内的"5 码分离断言"（TQ-CON-005 / 008 / 010 / 011 / 012）会随 Step 17 演进为"7 码分离断言"，以测试代码的形态永久留痕"每业务一槽"规约。
3. **operation kebab-case 规约可扩展性**：本 Step 新增 10 个 operation，全部以方法名一对一派生；零冲突；下游运维看 path 直接倒查 Port 方法。
4. **Convention L 修订版的可重复性**：两个 Engine 各自 10 个 it 严格分 3 段，测试代码本身呈现"业务薄层翻译"的具体形态——身份段验包结构、正向段验 5 个方法各自的 wire mapping、错误段验"基座转译 + 业务 schema 拒绝"。

运维真实使用这两个 Adapter 的那一天，他们会看到一个 `openPosition` 请求和一个 `placeOrder` 请求各自从业务代码发起，分别流经 position-engine-http / match-engine-http 的薄层翻译，**汇合在同一个基座 retry loop 里**，流到 undici 的 HTTP pool。三层都能单独追溯、单独调试、单独替换。基座是 Tianqi 这个仓库少见的"被多消费方共享"的代码，但它共享的是稳定性能力——不是业务语义。这就是 Tianqi 宗旨"共享必须发生在能力层，不能发生在业务层"的具体形态。
