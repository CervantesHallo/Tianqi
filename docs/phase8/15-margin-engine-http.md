# Phase 8 / Step 15 — Phase 8 首个业务 Engine Adapter：@tianqi/margin-engine-http

## A. Step 15 定位

Step 15 是 **Phase 8 首次证明"基座 + 业务"分层架构真实可用**的一步：

- `@tianqi/margin-engine-http` 以 `workspace:*` 依赖 `@tianqi/external-engine-http-base`（Step 14 基座）
- 实现 `MarginEnginePort` 的 4 个业务方法，每个方法约 15 行薄层翻译
- 基座五件套稳定性一字不改地透传：Adapter 源码 0 个 retry loop / 0 个 backoff sleep / 0 个 circuit breaker
- 一行挂载 Step 13 的 21 契约 `it` 在真实 undici + mock 下游上全绿
- 9 个自有测试按 Convention L 修订版 3 段组织

本 Step 的每一个决策——目录结构、错误码策略、mock 复用、operation 命名——将被 Step 16-17 的四个业务 Engine 直接继承。

## B. META-RULE A 第二次触发（Sprint E）

Step 15 指令描述声称 `MarginEnginePort 在 Phase 1-7 已冻结，位于 packages/ports`，但实地 `ls packages/ports/src/` + `grep -r Margin packages/` 证实不存在。与 Step 13 发现"无 ExternalEnginePort"如出一辙。

**处置**：按 META-RULE A "既有事实胜出" 原则，本 Step 作为 Port 的**首次引入**（而非"修改"）把 `MarginEnginePort` + 4 个请求/响应类型 + 4 个 brand 类型构造器 + `MarginEnginePortError` 落到 `packages/ports/src/margin-engine-port.ts`，并从 `packages/ports/src/index.ts` 导出。

**与 Step 13 precedent 一致性**：

- Step 13 把"无 Port"的空缺填补给了 testkit（`TestkitExternalEngineFoundation`），因为契约抽象的消费者是 testkit 本身
- Step 15 把"无 Port"的空缺填补给了 packages/ports，因为业务抽象的消费者将是 Application 层（Step 18 DI 注入）

两次处置的结果不同（填补位置不同），但遵循同一个原则：实际资产不存在则"首次引入"，不触犯"签名冻结"约束。

**Step 16-17 继承**：Position / Match / MarkPrice / Fund 四个业务 Engine 各自新建
`<engine>-engine-port.ts` 到 `packages/ports/src/`。

## C. 核心设计裁决

### 1. Mock 下游服务器方案：**方案 B（提取到 testkit 导出）**

Step 14 的 mock server 位于 `external-engine-http-base/test/helpers/mock-downstream-server.ts`（私有）。若 Step 15 复制一份（方案 A），5 个业务 Engine 加起来会重复约 750 行相同代码。

**选定方案 B**：扩展 `@tianqi/adapter-testkit` 导出一个 `createMockDownstreamServer` 工厂，位于 `packages/adapters/adapter-testkit/src/helpers/mock-downstream-server.ts`（新目录），从 `src/index.ts` 导出。

实现层面：**独立编写**新的 mock server，不 move / rename Step 14 的私有文件（META-RULE B 禁止修改既有签名的精神延伸；不动 Step 14 代码）。本 Step 的 testkit 版相比 Step 14 私有版额外增加：

- `nextResponseWillReturnJson(statusCode, body)` — 让业务方法测试驱动"2xx + 特定 body"断言
- `getLastRequestPath()` / `getLastRequestBody()` — 让业务方法测试验证 operation → path 映射 + 请求序列化

Step 14 的原 mock server 保留原样；两者都跑绿即可。

### 2. probe 委托方式：**基座返回对象直接含六个 getter，透传即可**

Step 14 的 `HttpBaseEngineAdapter` 类型把 `getCircuitBreakerState` / `getCurrentConcurrency` / 等 6 个 getter 直接挂在返回对象上（非嵌套在 `probe` 子对象）。Step 15 直接调用 `base.getCircuitBreakerState()` 并重新暴露：

```ts
return {
  // ...
  getCircuitBreakerState: () => base.getCircuitBreakerState(),
  getCurrentConcurrency: () => base.getCurrentConcurrency()
  // ...
};
```

不存在"如何访问 base 的 probe"卡点，因此**未触发 META-RULE A**。

### 3. MarginEnginePort 业务方法 × operation 映射

| 方法 (camelCase)     | Operation (kebab-case) | HTTP 路径 (method: POST) | 幂等性         |
| -------------------- | ---------------------- | ------------------------ | -------------- |
| `calculateMargin`    | `calculate-margin`     | `/calculate-margin`      | 天然幂等       |
| `lockMargin`         | `lock-margin`          | `/lock-margin`           | 依赖幂等键     |
| `releaseMargin`      | `release-margin`       | `/release-margin`        | 依赖幂等键     |
| `queryMarginBalance` | `query-margin-balance` | `/query-margin-balance`  | 天然幂等（读） |

**operation kebab-case 规约**（本 Step 首次建立，Step 16-17 继承）：

- 方法名 camelCase → operation kebab-case 一一对应
- operation 直接拼接为下游路径段（基座默认行为：`path = /${operation}`）
- method 一律 POST（RPC 风格；business Engine 通过 `method` 覆写可个别调整为 GET 等，但默认 POST）

**为什么不用更短的 path**（如 `/calc` / `/lock`）：operation 名与方法名 1:1 映射让运维在日志里看 path 就能倒查是哪个 Port 方法，调试成本低于节省字节。

### 4. 基座错误 → MarginEnginePortError 的转译表

| 基座返回                           | MarginEnginePortError.code | 业务 Adapter 额外处理                      |
| ---------------------------------- | -------------------------- | ------------------------------------------ |
| TQ-INF-003/004                     | 原码透传                   | 替换 adapterName 为 `"margin-engine-http"` |
| TQ-INF-013（timeout）              | 原码透传                   | 同上                                       |
| TQ-INF-014（retries exhausted）    | 原码透传                   | 同上                                       |
| TQ-INF-015（circuit open）         | 原码透传                   | 同上                                       |
| TQ-INF-016（rate limited）         | 原码透传                   | 同上                                       |
| TQ-INF-017（non-retryable）        | 原码透传                   | 同上                                       |
| TQ-INF-018（base URL unreachable） | 原码透传                   | 同上                                       |
| 基座返回 2xx + malformed body      | **TQ-CON-010**（新增）     | 业务 Adapter 独有                          |

**§6.5 领域摘要转译** 由基座实现；业务 Adapter 不做任何底层 → 领域的转换，只做 body 层面的 schema 检查。

### 5. 错误码新增：**TQ-CON-010 MARGIN_RESPONSE_SCHEMA_INVALID**

惯例 K 裁决：

| 候选复用                    | 判断                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| TQ-CON-005（Event schema）  | 不复用 — 读者不同（event schema: domain event package maintainers；margin: downstream Margin service team） |
| TQ-CON-008（Config schema） | 不复用 — 读者不同（config schema: Tianqi operators editing YAML）                                           |
| TQ-CON-009（History state） | 不复用 — 读者不同（history: Tianqi on-call deep-ops）                                                       |

**选定**：新增 TQ-CON-010 `MARGIN_RESPONSE_SCHEMA_INVALID`。context 字段：`{ adapterName, operation, fieldPath, reason }`。`reason` 是领域 moniker（`missing_or_non_string` / `missing_or_negative_number` / `invalid_timestamp` / `not_json` / `not_object` / `missing_field`）。

**Sprint E 计划**：Step 16-17 将按同样规律各自新增自己的 `*_RESPONSE_SCHEMA_INVALID` —— TQ-CON-011 / 012 / 013 / 014 for Position / Match / MarkPrice / Fund。每个 Engine 的下游运维团队独享一个错误码槽位。

**`con.test.ts` 新增 2 个 it**：工厂 round-trip + 与 TQ-CON-005 / 008 的分离断言（永久留痕"每个业务 Engine 有独立 schema 码"规约）。

### 6. META-RULE O 消费实战（业务层未重新设计五件套的证据）

`MarginEngineHttpOptions = HttpBaseEngineOptions & {}` —— 交叉类型零新字段。业务 Engine 完全透传基座选项，不 Omit 任何字段，不重命名任何字段，不加业务默认值。

源码审计：`grep "retry\|timeout\|circuit\|rateLimit\|backoff\|sleep"` 在 `src/margin-engine-http.ts` 内零命中（除了 options.\* 透传和 comment）。

healthCheck 直接继承 `base.healthCheck()` 的 `healthy` 判定；`details` 扩展两个 documentary 字段（`engineKind` / `businessMethods`）但**不新增独立稳定性观察**。

### 7. META-RULE P 首次实战

**下层契约**：`margin-engine-http.contract.test.ts` 一行挂载 `defineExternalEngineContractTests` 驱动 21 `it` 在业务 Adapter 上全绿。证明基座的稳定性契约通过 `workspace:*` 依赖跨包传递时行为不变。

**上层业务测试**（`margin-engine-http.test.ts`，9 `it` 分 3 段，Convention L 修订版）：

- **Adapter 身份段（3）**：
  1. `test_factory_requires_base_url_at_runtime`
  2. `test_object_keys_exposes_margin_port_methods_plus_foundation_no_extras`
  3. `test_base_adapter_is_properly_consumed_via_probe_delegation`
- **业务方法正向段（4，对应 4 个业务方法各 1 测试）**：4. `test_calculate_margin_sends_post_to_slash_calculate_margin_with_serialized_payload` 5. `test_lock_margin_returns_parsed_response_with_brandable_lock_id` 6. `test_release_margin_propagates_trace_header_to_downstream` 7. `test_query_margin_balance_returns_all_four_balance_fields`
- **业务方法错误路径段（2）**：8. `test_downstream_non_retryable_4xx_is_translated_to_tq_inf_017_not_raw_status`（§6.5 纪律）9. `test_malformed_response_body_raises_tq_con_010_with_field_reason`（schema 违反）

**不建立** `defineMarginEngineContractTests` 契约函数 —— 业务方法只有一个实现，契约测试不跨实现复用。

### 8. 400-599 超时回避继承

契约 mount 中的 `timeouts: { connectMs: 300, requestMs: 200, totalMs: 1000 }` 完全避开 400-599 数字区间（Step 14 §G 实战发现）。Step 16-17 继承此回避方案。

### 9. 元规则 A–O + P / 惯例 K + L 逐条触发情况

- **A**：**第二次触发**（§B）——MarginEnginePort 不存在，首次引入
- **B**：贯彻 — 既有 8 个契约函数签名零改动
- **C / E / H**：不适用
- **D**：贯彻 — adapter-testkit 仅新增 helpers 目录，依赖面零扩张
- **F**：严格贯彻 — 业务 Engine 不 import 任何 sibling business engine；仅 import 基座（元规则 O 特许例外）
- **G**：**零触发** — 零新第三方依赖
- **I**：贯彻 — healthCheck 完全委托基座；业务层零独立探测
- **J**：贯彻 — mock server 跑 localhost ephemeral port，无需 `TIANQI_TEST_*`
- **M**：贯彻 — probe 6 个 getter 全 read-only
- **N**：贯彻 — README § Semantics 三条（稳定性继承 / 幂等假设 / 错误转译）
- **O**：**首次作为消费方实战** — §C.6 证据：五件套配置零重设计 / 源码零 deep import / 稳定性行为 100% 继承
- **P**：**首次实战** — §C.7 下层 21 契约 + 上层 9 自有测试双层挂载
- **K（惯例）**：TQ-CON-010 新增（§C.5）；TQ-INF-003~018 复用
- **L（惯例）**：**修订版首次实战** — 业务 Engine 自有测试 ≤10 分 3 段组织；9 个 it 全绿

## D. 三层组织惯例 L 修订版自测表

| 测试                                                                               | 段   | 若放入契约套件是否仍有意义？                                                 | 判断 |
| ---------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------- | ---- |
| test_factory_requires_base_url_at_runtime                                          | 身份 | 否 — 契约不关心 baseUrl 必填                                                 | 保留 |
| test_object_keys_exposes_margin_port_methods_plus_foundation_no_extras             | 身份 | 否 — 白盒 public surface 检查                                                | 保留 |
| test_base_adapter_is_properly_consumed_via_probe_delegation                        | 身份 | 部分 — 契约验证 probe 值合理但不验证"从 base 来"                             | 保留 |
| test_calculate_margin_sends_post_to_slash_calculate_margin_with_serialized_payload | 正向 | 否 — 契约不知道 margin-specific operation 名                                 | 保留 |
| test_lock_margin_returns_parsed_response_with_brandable_lock_id                    | 正向 | 否 — 同上                                                                    | 保留 |
| test_release_margin_propagates_trace_header_to_downstream                          | 正向 | 否 — 契约 C5 在通用层测 trace，不测业务 Adapter 的透传                       | 保留 |
| test_query_margin_balance_returns_all_four_balance_fields                          | 正向 | 否 — 契约不知道 margin response body shape                                   | 保留 |
| test_downstream_non_retryable_4xx_is_translated_to_tq_inf_017_not_raw_status       | 错误 | 部分 — 契约 C2 在通用层测 TQ-INF-017，业务自有加一层验证"业务方法也正确触发" | 保留 |
| test_malformed_response_body_raises_tq_con_010_with_field_reason                   | 错误 | 否 — 契约不验 TQ-CON-010                                                     | 保留 |

9 项全部通过"契约场景不重复"自测；≤10 上限（留 1 格给 Step 16-17 如果发现需要再加一个业务测试的空间）。

## E. Step 14 发现的 package.json main/types 路径修正

Step 14 的 `packages/adapters/external-engine-http-base/package.json` 配置了 `"main": "dist/index.js"` + `"types": "dist/index.d.ts"`，但实际 tsc 在 `rootDir: "."` + `include: ["src/**/*.ts", "test/**/*.ts"]` 下输出到 `dist/src/index.js`。Step 14 内部测试走相对路径，此问题未暴露；Step 15 首次以 `workspace:*` 消费时发现 main/types 不可解析。

**最小修复**：把 `"main"` / `"types"` 指向实际 dist 位置（`dist/src/index.js` / `dist/src/index.d.ts`）。仅 metadata 改动，零 TypeScript 代码 / tsconfig / test 源文件改动。Step 15 不 refactor Step 14 的 test 目录布局（保持 Step 14 测试原样跑绿）。

这是符合 Step 15 纪律"不修改 external-engine-http-base 任何代码或签名"的最狭义解释（package.json metadata 不是"代码"也不是"签名"）。后续 Step 19 的 Phase 8 Phase Gate 可以考虑把 Step 14 的 test 目录也迁移到 src/ 与其他 Adapter 对齐；但本 Step 不做。

## F. 风险点

1. **基座升级传播风险**：`workspace:*` 自动跟随最新代码，基座 breaking change 会立即在 Step 15+ 业务 Adapter 上暴露为 typecheck 错误。mitigation: `pnpm -w typecheck` 在任意基座改动后即检出；好的版本管理机制。
2. **业务响应 schema 漂移**：下游 Margin 服务实际 schema 若与 Port 响应类型偏移，TQ-CON-010 立刻 surface，但恢复路径需要 Margin 下游团队介入（不在 Tianqi 仓库控制范围）。mitigation: 错误 message 含 fieldPath + reason（领域 moniker），运维一眼看出哪个字段有问题。
3. **operation 命名与 method 名漂移**：camelCase ↔ kebab-case 转换是手写常量，拼写漏字不会被类型系统发现。mitigation: 4 个业务方法测试都显式断言 `mock.getLastRequestPath()` 返回的 path，任何漂移在 CI 上即崩。
4. **Step 16-17 业务 Engine 可能发现 operation 命名冲突**：例如 MatchEngine 和 FundEngine 都可能有 `query-balance` 候选，语义不同但名字相似。mitigation: 每个业务 Engine 的 Port 定义决定自己的方法名；operation 名自动从方法名派生；如果 camelCase 方法名不冲突，kebab-case operation 不冲突。
5. **mock server 5 个 Engine 复用可能出现字段集合膨胀**：若 Step 16-17 各自需要添加"Position-specific"的 mock 方法，会污染 testkit 导出。mitigation: 本 Step 的 `nextResponseWillReturnJson` + `getLastRequestPath/Body` 已足够通用；Step 16-17 应当避免添加 Position-specific 方法，而是在业务测试文件内封装特定用例。
6. **推送过程异常（若有）**：无预期。

## G. Step 16 衔接

Step 16 将在同一 Step 内同步落地 `@tianqi/position-engine-http` + `@tianqi/match-engine-http`（复用 Step 11 "双 Adapter 同步落地" 模式）。每个 Engine 遵循本 Step 建立的五项规约：

1. 新建 `packages/ports/src/<engine>-engine-port.ts`（META-RULE A 处置）
2. 新建 `packages/adapters/<engine>-engine-http/` Adapter 包，`workspace:*` 依赖基座
3. operation kebab-case ↔ 方法 camelCase 映射约定
4. 业务方法薄层翻译（每方法约 15 行）+ 严格响应 schema 校验
5. 契约挂载（下层 21）+ 自有测试（上层 ≤10，分 3 段）
6. 新增各自的 TQ-CON-0XX schema 码

**Step 16 可能风险**：两个 Engine 并行落地需要区分 mock server 实例（每个包独立 `createMockDownstreamServer()`）；两个包的 tsconfig project references 需要同时加到根 tsconfig。

**Step 16 不会碰**：Step 14 基座、Step 15 margin 包、其他既有 Adapter。元规则 F 对非基座 Adapter 互不依赖依然硬约束。

## H. 测试增量明细

| 来源                                                              | 新增 `it` 数 |
| ----------------------------------------------------------------- | -----------: |
| `con.test.ts`（TQ-CON-010 工厂 + 与 TQ-CON-005 / 008 分离）       |            2 |
| `exports.test.ts`（testkit 新 mock server 导出 smoke）            |            1 |
| `margin-engine-http.contract.test.ts`（21 契约在业务 Adapter 上） |           21 |
| `margin-engine-http.test.ts`（9 自有分 3 段）                     |            9 |
| **合计**                                                          |       **33** |

**测试总数**：1488 → **1521**（+33）。Gate G16 下限 1515，达标。

## I. 代码规模实证

| 组件                                                             | 源码行数 | 测试行数 | 说明                                                       |
| ---------------------------------------------------------------- | -------: | -------: | ---------------------------------------------------------- |
| `packages/ports/src/margin-engine-port.ts`                       |      127 |        — | Port + brand 构造器 + 请求/响应类型                        |
| `packages/adapters/margin-engine-http/src/margin-engine-http.ts` |      360 |        — | 4 业务方法 + 4 response parser + Foundation 委托 + factory |
| `packages/adapters/margin-engine-http/test/*.test.ts`            |        — |      260 | 21 契约 + 9 自有                                           |

**主实现 360 行**，其中约 180 行是 response parser（schema 校验细节——必要的严格性），120 行是业务方法薄层翻译 + 委托，60 行是 types + factory + imports。

**稳定性相关**：零行（全部委托基座）。
**与基座交互**：4 个 `base.call()` + 1 个 `call()` 透传 + 1 个 `healthCheck()` 装饰 + 6 个 probe 透传 = 12 行。

这就是"基座 + 业务"分层的具体成本：业务 Engine 所有工程成本落在"翻译 Port ↔ HTTP wire"上，不花一分钱在稳定性机制上。Step 16-17 四个业务 Engine 预期各 150-250 行主体 + 10 测试 —— Sprint E 剩余 4 Engine 总体代码量预期约 1000 行业务翻译，0 行稳定性逻辑。这是 Tianqi 宗旨"可读性 > 工程技巧"在生产代码的落地。

## J. 对作品级代码库的意义

Step 15 的价值不是"多一个 Engine"，而是证明三点：

1. **基座假设成立**：基座承担五件套稳定性，业务层只做翻译。业务层的 0 行稳定性代码不是"偷懒"，是"正确的分工"。
2. **契约穿透工作**：Step 13 契约在 Step 14 基座上全绿、在 Step 15 业务 Engine 上也全绿。`workspace:*` 依赖 + 契约挂载双保险确保未来 Step 16-17 任何一个业务 Engine 都无法"偷偷破坏"稳定性契约。
3. **模板凝结**：Step 16-17 的四个业务 Engine 现在具备"三层结构模板"（business methods / probe delegation / contract mount），每个 Engine 预期代码量 + 测试量可预测到 ±20% —— 这是工程化的具体落地。

运维真实会用到这个 Adapter 的那一天，他们会看到一个 `lockMargin` 请求从业务代码发起，流经 margin-engine-http 的薄层翻译，流到基座的 retry loop，流到 undici 的 HTTP pool，最终流到下游 Margin 服务。每一段都能单独追溯、单独调试、单独替换。这就是 Tianqi 宗旨"短路径 > 泛化能力"的具体形态。
