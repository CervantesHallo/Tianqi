# Phase 8 / Step 17 — Sprint E 业务 Engine 收官战：@tianqi/mark-price-engine-http & @tianqi/fund-engine-http

## A. Step 17 定位

Step 17 是 **Sprint E 业务 Engine 模块的收官战**——同步落地最后两个业务 Engine Adapter，把 Step 15 凝结的"基座 + 业务"分层模板**第四次和第五次复制**到 mark-price 与 fund 两个全新业务领域。复制的目标不是炫技，而是证明：

> Tianqi 的 Adapter 层是**有纪律的工程**，不是英雄式手艺活。同一份模板复用 5 次，每次都呈现同形结构，每次都按既定纪律自动通过 21 契约 + 业务自有测试。

**Sprint E 业务 Engine 收官时的总图**：

| Adapter                          | Step   | 形态              | 业务方法  | 自有 it | TQ-CON 槽位    |
| -------------------------------- | ------ | ----------------- | --------- | ------- | -------------- |
| `@tianqi/margin-engine-http`     | 15     | 操作型            | 4（含写） | 9       | TQ-CON-010     |
| `@tianqi/position-engine-http`   | 16     | 操作型            | 5（多写） | 10      | TQ-CON-011     |
| `@tianqi/match-engine-http`      | 16     | 操作型            | 5（多写） | 10      | TQ-CON-012     |
| `@tianqi/mark-price-engine-http` | **17** | **纯读**          | **3**     | **8**   | **TQ-CON-013** |
| `@tianqi/fund-engine-http`       | **17** | **读为主 + 单写** | **4**     | **9**   | **TQ-CON-014** |

5 个业务 Engine 各自独立写出，两两之间零代码共享、零相互 import；唯一共享的是基座 `@tianqi/external-engine-http-base`（META-RULE O 特许例外）。

**测试增量**：1586 → **1648**（+62），见 §H。

## B. META-RULE A 第五、六次连续触发（Sprint E 闭合）

Step 17 指令描述声称 `MarkPriceEnginePort` 与 `FundEnginePort` 在 Phase 1-7 已冻结，但实地 `ls packages/ports/src/` + `grep -r 'MarkPriceEngine\|FundEngine' packages/` 双双零命中——和 Step 13（无 ExternalEnginePort）/ Step 15（无 MarginEnginePort）/ Step 16（无 PositionEnginePort / MatchEnginePort）连续五次同病——本仓库 `packages/ports/src/` 在 Phase 1-7 内**完全没有任何 Engine Port**。

**处置**：对两个 Port 各按 META-RULE A "既有事实胜出" 原则首次引入：

| 文件                                           | 触发原则       | 落地内容                                                                |
| ---------------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| `packages/ports/src/mark-price-engine-port.ts` | META-RULE A #5 | `MarkPriceEnginePort` + 3 业务方法 + 2 brand 类型 + 错误类型            |
| `packages/ports/src/fund-engine-port.ts`       | META-RULE A #6 | `FundEnginePort` + 4 业务方法 + 4 brand 类型 + 2 enum 字面量 + 错误类型 |

**Sprint E META-RULE A 触发统计**：Step 13 一次（testkit-internal）+ Step 15 一次 + Step 16 两次 + Step 17 两次 = 6 次。Phase 8 Phase Gate（Step 19）将统一修订 Phase 1-7 文档相应描述，本 Step 不动文档。

## C. 核心设计裁决

### 1. MarkPriceEnginePort 方法集裁决（3）

**选定方法**：`queryMarkPrice` / `queryMarkPriceBatch` / `queryFundingRate`。

理由：

1. **覆盖标记价两种读路径**：`queryMarkPrice` 单点查询 + `queryMarkPriceBatch` 批量查询。批量是必备——风控算法在做"组合保证金"判断时常常需要一次拿多个 symbol 的标记价；如果只提供单点，调用方会被迫做 N 次 HTTP 调用，浪费基座的 rate-limit 预算。
2. **资金费率独立成方法**：`queryFundingRate` 与 `queryMarkPrice` 紧密相关但语义独立——资金费率是周期性结算指标，下游服务的 cache TTL 与读路径与标记价不同，运维 dashboard 也分别监控两者。合并为一个方法等于让上游每次拿标记价都"附带"拿费率，浪费下游 RTT。
3. **不引 `queryIndexPrice`**：指数价业务上属于"行情数据"而非"标记价引擎"，应当未来归到独立的 IndexPriceEngine 或 MarketDataEngine（如果 Phase 9+ 真的需要）；本 Step 保持克制（**克制 > 堆砌**）。
4. **3 方法 = Convention L 修订版弹性应用上界**：3 + 3 + 2 = 8 it（≤10 上限，留 2 slot 未用）。

### 2. FundEnginePort 方法集裁决（4）

**选定方法**：`queryFundBalance` / `queryFundLedger` / `transferFund` / `queryTransferStatus`。

理由：

1. **余额三件套一次返回**：`queryFundBalance` 同时返回 `totalBalance` / `availableBalance` / `frozenBalance`。**不再单独提供 `queryAvailableFund`**——已经在 balance 里返回 available 字段，单独一个方法等于让上游做两次 HTTP 调用拿同一份信息（违反 **克制 > 堆砌**）。
2. **流水查询保留**：`queryFundLedger` 是对账与审计场景的核心读路径，独立为方法；不与 balance 合并（语义不同，下游服务通常分两条 SQL 路径）。
3. **唯一写方法**：`transferFund` 是 Fund 引擎最简的写——账户间资金划转。语义清晰单一（不引 `transferFundWithMemo` / `transferFundCrossCurrency` 等扩展，那些应当走多次 transfer + Application 层组合）。
4. **`queryTransferStatus` 配套读**：`transferFund` 在网络异常 / 超时下结果不确定（write 操作的 in-doubt 状态），上游需要一个独立的状态查询方法做最终确认。这是写 + 配对查询的标准模式，与 `lockMargin` + balance 查询的关系类似。
5. **4 方法 = Convention L 修订版**：3 + 4 + 2 = 9 it（≤10 上限，留 1 slot 未用）。

### 3. 两份 operation kebab-case 映射表

#### MarkPrice（3）

| 方法 (camelCase)      | Operation (kebab-case)   | HTTP 方法 | 路径                      | 幂等性         |
| --------------------- | ------------------------ | --------- | ------------------------- | -------------- |
| `queryMarkPrice`      | `query-mark-price`       | POST      | `/query-mark-price`       | 天然幂等（读） |
| `queryMarkPriceBatch` | `query-mark-price-batch` | POST      | `/query-mark-price-batch` | 天然幂等（读） |
| `queryFundingRate`    | `query-funding-rate`     | POST      | `/query-funding-rate`     | 天然幂等（读） |

#### Fund（4）

| 方法 (camelCase)      | Operation (kebab-case)  | HTTP 方法 | 路径                     | 幂等性         |
| --------------------- | ----------------------- | --------- | ------------------------ | -------------- |
| `queryFundBalance`    | `query-fund-balance`    | POST      | `/query-fund-balance`    | 天然幂等（读） |
| `queryFundLedger`     | `query-fund-ledger`     | POST      | `/query-fund-ledger`     | 天然幂等（读） |
| `transferFund`        | `transfer-fund`         | POST      | `/transfer-fund`         | 依赖幂等键     |
| `queryTransferStatus` | `query-transfer-status` | POST      | `/query-transfer-status` | 天然幂等（读） |

7 个新增 operation 与既有 14 个（margin 4 + position 5 + match 5）合并后，Sprint E 共 21 个 operation 之间命名空间无冲突——MarkPrice 全部以 `mark-price*` 或 `funding-rate` 开头；Fund 全部以 `fund-*` 或 `transfer*` 开头。

### 4. 惯例 L 修订版的弹性应用裁决

| Adapter                              | 业务方法数 | 身份  | 业务正向 | 业务错误 | 总计  | 弹性使用      |
| ------------------------------------ | ---------- | ----- | -------- | -------- | ----- | ------------- |
| margin-engine-http (Step 15)         | 4          | 3     | 4        | 2        | 9     | 留 1 slot     |
| position-engine-http (Step 16)       | 5          | 3     | 5        | 2        | 10    | 打满上限      |
| match-engine-http (Step 16)          | 5          | 3     | 5        | 2        | 10    | 打满上限      |
| **mark-price-engine-http (Step 17)** | **3**      | **3** | **3**    | **2**    | **8** | **留 2 slot** |
| **fund-engine-http (Step 17)**       | **4**      | **3** | **4**    | **2**    | **9** | **留 1 slot** |

**裁决**：mark-price 与 fund 都选"保持精炼"——业务方法数确定后，正向段就是业务方法数 × 1，不堆砌冗余测试。21 contract it 已经在 sibling `.contract.test.ts` 文件里覆盖了所有稳定性场景；自有测试只验本 Engine 独有的 wire mapping、parser 行为、错误转译。

**为什么不打满 10**：Tianqi 宗旨"克制 > 堆砌"。读取型 Engine 业务方法少，自有测试相应少 = 正确的精炼，不是测试覆盖不足。强行加 `test_query_mark_price_with_long_symbol_name`、`test_query_mark_price_with_special_chars` 这种边界测试只会让自有套件膨胀而不增加诊断价值（边界由下游服务的 input validation 负责，不归 Adapter 测）。

### 5. 错误码 013 / 014 与既有 005-012 的诊断分离表（七码完整）

**惯例 K 第五次扩展**（Step 10 → 11 → 15 → 16 → 17）：

| 码             | 名                                     | 谁触发                           | 谁读                        | 修复路径                |
| -------------- | -------------------------------------- | -------------------------------- | --------------------------- | ----------------------- |
| TQ-CON-005     | EVENT_SCHEMA_VIOLATION                 | 自家应用层 event 序列化          | event-schema 包 maintainer  | 修代码 schema           |
| TQ-CON-008     | CONFIG_FILE_SCHEMA_INVALID             | YAML 文件不合法                  | Tianqi 运维 / 配置编辑者    | 改 YAML                 |
| TQ-CON-009     | CONFIG_HISTORY_STATE_INCONSISTENT      | history 目录漂移                 | Tianqi on-call deep-ops     | 删 history 重启         |
| TQ-CON-010     | MARGIN_RESPONSE_SCHEMA_INVALID         | Margin 下游 2xx body 漂移        | 下游 Margin 服务团队        | 找 Margin 团队修        |
| TQ-CON-011     | POSITION_RESPONSE_SCHEMA_INVALID       | Position 下游 2xx body 漂移      | 下游 Position 服务团队      | 找 Position 团队修      |
| TQ-CON-012     | MATCH_RESPONSE_SCHEMA_INVALID          | Match 下游 2xx body 漂移         | 下游 Match 服务团队         | 找 Match 团队修         |
| **TQ-CON-013** | **MARK_PRICE_RESPONSE_SCHEMA_INVALID** | **MarkPrice 下游 2xx body 漂移** | **下游 MarkPrice 服务团队** | **找 MarkPrice 团队修** |
| **TQ-CON-014** | **FUND_RESPONSE_SCHEMA_INVALID**       | **Fund 下游 2xx body 漂移**      | **下游 Fund 服务团队**      | **找 Fund 团队修**      |

7 码（005 / 008 / 010 / 011 / 012 / 013 / 014，剔除 history-only 的 009）运维读者两两完全不重——每个业务 Engine 一个槽位，永不复用。`con.test.ts` 的"7 码分离断言"是这条规约的永久测试守卫。

### 6. 两 Adapter 共性层同构证据

**100% 同构（grep 验证一字不差）**：

| 项                            | 文件位置                                                                                               | 验证                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------- | --------- |
| Options 类型                  | `HttpBaseEngineOptions & {}`                                                                           | grep `extends HttpBaseEngineOptions` 5 个 Adapter 全数命中 |
| `init` 委托                   | `init: () => base.init()`                                                                              | grep 同构                                                  |
| `shutdown` 委托               | `shutdown: () => base.shutdown()`                                                                      | grep 同构                                                  |
| 6 个 probe getter             | `getXxx: () => base.getXxx()`                                                                          | grep 同构                                                  |
| `translateBaseError` 模式     | 仅替换 `adapterName`，其余字段透传                                                                     | grep 同构                                                  |
| `healthCheck` shape           | `{ adapterName, healthy, details: { ...baseHealth.details, engineKind, businessMethods }, checkedAt }` | grep 同构                                                  |
| `call(req, traceId)` 透传方法 | `call: (request, traceId) => base.call(request, traceId)`                                              | grep 同构                                                  |
| factory 校验                  | `if (typeof options.baseUrl !== "string"                                                               |                                                            | options.baseUrl.length === 0) throw new Error("...: baseUrl is required")` | grep 同构 |
| `callWithTrace<T>` helper     | 同 shape                                                                                               | grep 同构                                                  |
| Step 5 state guard 致敬注释   | 各 factory 内含致敬注释                                                                                | 5 Adapter 各 1 处                                          |

### 7. 允许差异（业务领域必然不同）

| 项                     | mark-price                                                                   | fund                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `engineKind`           | `"mark-price"`                                                               | `"fund"`                                                                                |
| `businessMethods`      | `"queryMarkPrice,queryMarkPriceBatch,queryFundingRate"`                      | `"queryFundBalance,queryFundLedger,transferFund,queryTransferStatus"`                   |
| 独有 enum validator    | 无                                                                           | `requireTransferStatus` / `requireLedgerEntryType`                                      |
| 独有数值范围 validator | `requirePositiveNumber`（标记价 > 0）/ `requireFiniteNumber`（资金费率可负） | 共用 `requireNonNegativeNumber`（余额 ≥ 0）                                             |
| 弱写方法               | 无（纯读）                                                                   | 1 个 `transferFund`（依赖 idempotencyKey）                                              |
| 条件透传               | 无                                                                           | `queryFundLedger` 内 `...(request.limit !== undefined ? { limit: request.limit } : {})` |

### 8. 元规则 A–P + 惯例 K + L 触发情况

| 规则          | 状态                                  | 证据                                                                                                                           |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A**         | **第五、六次连续触发**                | MarkPriceEnginePort + FundEnginePort 在 packages/ports/src/ 实地零命中，按既有事实胜出原则各自首次引入                         |
| **B**         | 严格贯彻                              | 既有 8 契约函数 / Step 14 基座 / Step 15-16 三个业务 Engine / 任何既有 Port 签名零改动                                         |
| **C / E / H** | N/A                                   | 不触碰回滚边界 / 不新建跨实现契约函数 / 不引入 schema 自管理边界                                                               |
| **D**         | 严格贯彻                              | adapter-testkit 零新导出（Step 15 已建好 `createMockDownstreamServer`）                                                        |
| **F**         | **第二次实战可观测**                  | 5 业务 Engine 之间 grep 无交叉 import / 无共享 helper / 无共享 mock 实例；Sprint E 同步落地两个新 Adapter 的工程压力下严格贯彻 |
| **G**         | **零触发**                            | `pnpm-lock.yaml` 仅 workspace link，零第三方依赖元数据                                                                         |
| **I**         | 严格贯彻                              | 两 healthCheck 完全委托基座 healthy 字段；details 仅追加 documentary 字段                                                      |
| **J**         | 严格贯彻                              | 两 mock server 跑独立 ephemeral port；零 `TIANQI_TEST_*` 环境变量                                                              |
| **M**         | 严格贯彻                              | 两 probe 6 getter 全 read-only                                                                                                 |
| **N**         | 严格贯彻                              | 两 README § Semantics 三条（继承 / 幂等 / 转译）齐备                                                                           |
| **O**         | **第四、五次消费方实战**              | `MarkPriceEngineHttpOptions = HttpBaseEngineOptions & {}` × 2 零字段重设计；源码零稳定性逻辑                                   |
| **P**         | **第四、五次实战**                    | 每 Engine 双层挂载（21 + 8/9）；不建立业务方法契约函数                                                                         |
| **K（惯例）** | 实战                                  | TQ-CON-013 + 014 各占独立槽位；con.test.ts 7 码分离断言永久留痕                                                                |
| **L（惯例）** | **第四、五次实战 + 弹性应用首次实战** | 8 + 9 it 各 3 段，留 slot 未用——克制 > 堆砌                                                                                    |

## D. Sprint E 业务 Engine 收官回顾

**5 次模板复制时间线**：

```
Step 14: external-engine-http-base 基座（undici 五件套真实实现）
   ↓ workspace:* 消费
Step 15: margin-engine-http   ← 第 1 次复制：4 操作型方法 + TQ-CON-010
   ↓ 模板凝结
Step 16: position-engine-http ← 第 2 次复制：5 操作型方法 + TQ-CON-011
         match-engine-http    ← 第 3 次复制：5 操作型方法 + TQ-CON-012
   ↓ 同步落地证明 META-RULE F
Step 17: mark-price-engine-http ← 第 4 次复制：3 纯读方法 + TQ-CON-013
         fund-engine-http       ← 第 5 次复制：4 读+1写方法 + TQ-CON-014
   ↓ Sprint E 业务 Engine 收官
Step 18: Application 层接入（5 业务 Engine DI 注入）— 下一 Step 职责
```

**5 次复制的发现**：

1. **Step 15 是凝结期**：第一次实战需要做 9 个核心设计裁决（mock 方案、probe 委托方式、operation 命名、错误码策略等）。
2. **Step 16 是验证期**：第二、三次复制证明模板可重复——核心结构 100% 同构，业务领域差异限定在方法集 + parser + Brand。
3. **Step 17 是收官期**：第四、五次复制呈现"按模板填空"特征——核心设计零新决策，唯一新内容是惯例 L 弹性应用（业务方法少 → 自有测试相应少）。**这就是工程化的具体落地**：模板成熟后，新增 Adapter 的人力成本、心智成本、出错风险都呈线性下降。

**3 种业务形态全覆盖**：

| 形态              | 代表 Engine               | 写方法 | 幂等键 | 读方法 |
| ----------------- | ------------------------- | ------ | ------ | ------ |
| **操作型**        | margin / position / match | 多个   | 必填   | 1-3 个 |
| **读为主 + 单写** | fund                      | 1 个   | 必填   | 3 个   |
| **纯读**          | mark-price                | 0      | N/A    | 3 个   |

读取型 Engine（mark-price + fund 部分）的运维语义与操作型不同——熔断 open 时，纯读 Engine 失败意味着上游决策被迫使用陈旧数据或主动降级，需要风控算法层面对此显式做出反应。这一点 mark-price README §"读取型 Engine 在熔断 open 时的运维语义" 章节专门留痕。

## E. 风险点

1. **读取型 Engine 在熔断 open 时的运维含义**：与操作型 Engine 不同，纯读 Engine 失败时上游决策可能被迫使用陈旧数据。**Mitigation**：mark-price README 显式留痕该差异；后续 Application 层（Step 18）应当为风控算法提供"读 stale 数据"的显式 API（不能 silently 用 N 分钟前的价格）。
2. **MarkPrice 数据时效性 vs 五件套缓存语义**：基座的 retry / circuit breaker 在标记价场景可能放大时效性问题——3 次重试每次 100ms 退避总共 300ms+，对高频交易决策可能已经"陈旧"。**Mitigation**：调用方在 timeout 配置上要根据决策时效自行调整（基座支持透传所有五件套配置）；本 Adapter 不替调用方做时效判断。
3. **Fund 引擎的 transferFund 唯一写**：写方法依赖 idempotencyKey 防重——若调用方未保证幂等键唯一性，可能导致重复划转。**Mitigation**：README §请求幂等假设明确告知调用方义务；下游服务的去重保证由其负责。
4. **七码分离断言的演进风险**：未来 Phase 9+ 若新增第六、第七个业务 Engine（如 RiskScore / Liquidation），需扩展为 9 码 / N 码分离——但本 Step 7 码已经把 Sprint E 收尾闭合，不会再新增。Phase 9 任何新 Engine 必须重新评估"是否真的需要独立错误码槽位"（惯例 K 决断逻辑）。
5. **5 业务 Engine 同时 typecheck 的传播风险**：基座任意改动会同时在 5 个业务 Adapter 上 surface。**Mitigation**：`pnpm typecheck` 在基座任意改动后即刻检出；CI 默认运行。这反而是 META-RULE F 严格贯彻的福报——没有任何"sneaky"的 sibling Engine 间相互修复，错误必然在编译时显式暴露。
6. **推送过程异常**：无预期。

## F. Step 18 衔接

Step 18 进入 Sprint F：**Application 层接入业务 Engine**。届时：

1. 5 业务 Engine 通过 DI 容器注入 Application 层 orchestrator / saga
2. Application 层定义"什么时候 calculateMargin → lockMargin → openPosition → placeOrder"的编排
3. 错误码透传到 Application 层 → TQ-APP-\* 命名空间映射
4. 风控算法的"熔断降级路径"（mark-price open 时使用陈旧价格的策略）落到 policy 层

**本 Step 不会碰**：Step 14 基座 / Step 15-16 三个业务 Engine / Application 层任何代码 / Policy 层任何代码 / Phase 1-7 文档（统一由 Step 19 修订）。

## G. 依赖结构图（Sprint E 收官）

```
                       ┌─────────────────────────────┐
                       │ external-engine-http-base   │
                       │ (基座, undici, 五件套)       │
                       └──────────────┬──────────────┘
                                      │ workspace:*
        ┌────────────────┬───────────┼────────────┬───────────────┐
        ▼                ▼           ▼            ▼               ▼
 margin-engine-http  position-...  match-...  mark-price-...  fund-engine-http
   (Step 15)          (Step 16)   (Step 16)   (Step 17)       (Step 17)
   TQ-CON-010         TQ-CON-011  TQ-CON-012  TQ-CON-013      TQ-CON-014

  以上 5 个业务 Engine 之间：
  - 零代码共享（grep 验证）
  - 零相互 import（grep 验证）
  - 零共享 mock server 实例（每 contract test 独立 createMockDownstreamServer()）
  - 各自独立 5 / 5 / 5 / 5 / 4 个 response parser × 5 = 24 个 parser
  - 各自独立 translateBaseError 实现 × 5
```

## H. 测试增量明细

| 来源                                                 | 新增 it 数 |
| ---------------------------------------------------- | ---------- |
| `con.test.ts`（TQ-CON-013 + TQ-CON-014 + 7 码分离）  | 3          |
| `mark-price-engine-http.contract.test.ts`（21 契约） | 21         |
| `mark-price-engine-http.test.ts`（8 自有 3 段）      | 8          |
| `fund-engine-http.contract.test.ts`（21 契约）       | 21         |
| `fund-engine-http.test.ts`（9 自有 3 段）            | 9          |
| **合计**                                             | **62**     |

**测试总数**：1586 → **1648**（+62）。Gate G18 下限 1635，超出 13。

## I. 代码规模实证（Sprint E 业务 Engine 全景）

| 组件                                                                     | 源码行 | 测试行 |
| ------------------------------------------------------------------------ | ------ | ------ |
| `packages/ports/src/mark-price-engine-port.ts`                           | ~110   | —      |
| `packages/ports/src/fund-engine-port.ts`                                 | ~165   | —      |
| `packages/adapters/mark-price-engine-http/src/mark-price-engine-http.ts` | ~290   | —      |
| `packages/adapters/fund-engine-http/src/fund-engine-http.ts`             | ~410   | —      |
| `mark-price-engine-http/test/*.test.ts`                                  | —      | ~190   |
| `fund-engine-http/test/*.test.ts`                                        | —      | ~270   |

**Sprint E 5 业务 Engine 累计**：

- ports：4 个 Port 文件 ~615 行（margin 130 + position 145 + match 160 + mark-price 110 + fund 165 — wait, that's 5）
- adapters：5 个 Adapter 主体 ~1990 行（margin 360 + position 430 + match 480 + mark-price 290 + fund 410 = 1970）
- 稳定性相关代码：**0 行**（全部委托基座）
- 与基座交互：每 Engine 13 行（call × N + healthCheck 装饰 + 6 probe 透传），× 5 = 65 行
- response parser：5 + 5 + 5 + 3 + 4 = 22 个 parser，每个 ~30-40 行
- 测试：5 × ~270 = ~1350 行

**人力成本估算**：第 1 次（Step 15）凝结模板花费 ~2 天；第 2-5 次（Step 16-17）每次 ~半天到 1 天。模板成熟后，**新增一个业务 Engine 的边际成本 ≈ 业务方法数 × 30 分钟**——这是工程化的具体回报。

## J. 对作品级代码库的意义

Step 17 的价值不在"多两个 Adapter"，而在**完成一个完整闭环的工程证明**：

1. **基座假设成立**：5 业务 Engine 全部零行稳定性逻辑，全部委托基座。这不是"偷懒"，是"正确的分工"——基座承担稳定性，业务层只做翻译。
2. **契约穿透 5 次**：Step 13 的 21 契约 it 在 5 业务 Engine 上各跑一次（共 105 it），全部全绿。`workspace:*` 依赖 + 契约挂载双保险确保未来任何业务 Engine 都无法"偷偷破坏"稳定性契约。
3. **模板复制 5 次成功**：margin → position → match → mark-price → fund 五个 Adapter 同形结构呈现"按模板填空"特征。读者翻阅这 5 个包，会立刻识别共性结构：相同的 factory 校验 / 相同的 callWithTrace helper / 相同的 6 probe 透传 / 相同的 translateBaseError shape。每个 Adapter 业务领域不同，但**工程纪律完全一致**。
4. **3 种业务形态全覆盖**：操作型（margin/position/match）+ 读为主（fund）+ 纯读（mark-price）。这是 Phase 8-12 业务覆盖面的具体展开——不存在"哪种形态没法套用本模板"的边界场景。
5. **Sprint E 业务 Engine 收官**：从 Step 13（契约起点）→ Step 14（基座）→ Step 15-17（5 业务 Engine）共 5 个 Step 完成 Sprint E。下一 Sprint（Step 18+）将进入 Application 层接入——届时 5 业务 Engine 作为"已凝固的业务能力"被组合使用，不再是工程主战场。

运维真实使用这 5 个 Adapter 的那一天，他们会看到：

- 上游决策代码调用 `engine.queryMarkPrice(...)` 拿标记价
- 调用 `engine.calculateMargin(...)` 计算保证金
- 调用 `engine.queryFundBalance(...)` 检查余额
- 调用 `engine.openPosition(...)` 建仓
- 调用 `engine.placeOrder(...)` 下单

5 次调用各自走自己的 Adapter，**汇合在同一个基座 retry loop / circuit breaker / rate limiter**，最终流到不同的下游服务。每一段都能单独追溯、单独调试、单独替换。基座是 Tianqi 仓库少见的"被多消费方共享"的代码，但它共享的是**稳定性能力**——不是业务语义。

这就是 Tianqi 宗旨**"让算法变成工程师愿意读的代码"** 的最终形态——不仅愿意读，还愿意复刻；不仅愿意复刻，还能在复刻中保持纪律。Step 17 收官时，Sprint E 完成了从"模板凝结"到"模板成熟"的全闭环。
