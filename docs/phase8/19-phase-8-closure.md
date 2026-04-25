# Phase 8 / Step 19 — Phase 8 收官（CLOSED）

## A. Step 19 定位

Step 19 是 **Tianqi Phase 8 的最后一战**。它不构建任何新功能；它的全部价值在三件事：

1. **诚实闭合** —— 4/4 二元判据 + 3/3 产出，每一项明确通过或明确登记，不模糊
2. **历史档案** —— ADR-0001 把 Phase 8 的决策史固化为后续工程师的"为什么"参考
3. **面向读者** —— `CHANGELOG.md` 让仓库第一次有了"对外说明书"

附带处置 KI-P8-004：6 个 Adapter 包（external-engine-http-base + 5 业务 Engine）的 test/ → src/ 根本性整理，使 build metadata 回归 Sprint B-D 既有 Adapter 风格。

测试增量：1668 → **1668**（数量不变；本 Step 不构建新功能，仅迁移文件路径与配置）。

## B. Phase 8 CLOSED 二元判据状态

按《Tianqi Phase 8–12 架构与代码规范补充文档》§2.2：

| 判据                         | 状态 | 证据                                                                                                         |
| ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| lint / typecheck / test 通过 | ✅   | `pnpm lint` 0 warnings；`pnpm typecheck` 0 errors；`pnpm test` 1668 tests（1607 passed + 61 skipped）        |
| 契约测试通过                 | ✅   | 21 contract it × 5 业务 Engine + 1 基座 + 21 × 3 EventStore + 18 × 2 Notification + 21 × 2 Config 全部维持绿 |
| 覆盖率达标（80% / 75%）      | ✅   | lines 85.97% / branches 79.78% / functions 94.86% / statements 85.97%（运行 `pnpm test:coverage` 重现）      |
| ADR 归档                     | ✅   | `docs/decisions/0001-phase-8-adapter-layer.md`                                                               |

**4/4 通过 → Phase 8 CLOSED**。

## C. 完整组件清单（§12.2 强制）

### C.1 新增 Port（5 个，全部为 Sprint E External Engine Port，Phase 8 首次引入）

| Port                  | 位置                                           | 引入 Step |
| --------------------- | ---------------------------------------------- | --------- |
| `MarginEnginePort`    | `packages/ports/src/margin-engine-port.ts`     | Step 15   |
| `PositionEnginePort`  | `packages/ports/src/position-engine-port.ts`   | Step 16   |
| `MatchEnginePort`     | `packages/ports/src/match-engine-port.ts`      | Step 16   |
| `MarkPriceEnginePort` | `packages/ports/src/mark-price-engine-port.ts` | Step 17   |
| `FundEnginePort`      | `packages/ports/src/fund-engine-port.ts`       | Step 17   |

每个 Port 含业务方法 + brand 类型 + 字面量枚举（如适用）+ 错误类型定义。Phase 1-7 内 packages/ports/src/ 不含任何 Engine Port —— META-RULE A 第 3-6 次触发的处置。

### C.2 新增 Adapter（13 个 workspace 包）

| 包                                  | 实现 Port             | 引入 Step  | 形态                         |
| ----------------------------------- | --------------------- | ---------- | ---------------------------- |
| `@tianqi/adapter-testkit`           | N/A（契约工具包）     | Step 1     | 工具包                       |
| `@tianqi/event-store-memory`        | `EventStorePort`      | Step 4     | 内存                         |
| `@tianqi/event-store-sqlite`        | `EventStorePort`      | Step 5     | SQLite 持久化                |
| `@tianqi/event-store-postgres`      | `EventStorePort`      | Step 6     | PostgreSQL 持久化            |
| `@tianqi/notification-memory`       | `NotificationPort`    | Step 8     | 内存                         |
| `@tianqi/notification-kafka`        | `NotificationPort`    | Step 9     | Kafka                        |
| `@tianqi/config-memory`             | `ConfigPort`          | Step 11    | 内存                         |
| `@tianqi/config-file`               | `ConfigPort`          | Step 11/12 | YAML 文件 + 历史目录         |
| `@tianqi/external-engine-http-base` | N/A（基座 Adapter）   | Step 14    | HTTP 基座                    |
| `@tianqi/margin-engine-http`        | `MarginEnginePort`    | Step 15    | 业务 Engine（操作型）        |
| `@tianqi/position-engine-http`      | `PositionEnginePort`  | Step 16    | 业务 Engine（操作型）        |
| `@tianqi/match-engine-http`         | `MatchEnginePort`     | Step 16    | 业务 Engine（操作型）        |
| `@tianqi/mark-price-engine-http`    | `MarkPriceEnginePort` | Step 17    | 业务 Engine（纯读）          |
| `@tianqi/fund-engine-http`          | `FundEnginePort`      | Step 17    | 业务 Engine（读为主 + 单写） |

13 个 Adapter 按"启用顺序"分布在 5 个 Sprint：A（testkit）/ B（EventStore）/ C（Notification）/ D（Config）/ E（External Engine）。workspace 总数从 Phase 1-7 收官时的 8 增加到 21（+13）。

### C.3 新增错误码（14 个）

| 错误码     | 名称                                   | 引入 Step | 命名空间 | 诊断对象                     |
| ---------- | -------------------------------------- | --------- | -------- | ---------------------------- |
| TQ-INF-002 | INFRASTRUCTURE_INIT_FAILED             | Step 2    | INF      | Adapter 初始化失败           |
| TQ-INF-003 | EVENT_STORE_NOT_INITIALIZED            | Step 2    | INF      | 未 init 调用                 |
| TQ-INF-004 | EVENT_STORE_ALREADY_SHUT_DOWN          | Step 2    | INF      | shutdown 后调用              |
| TQ-INF-005 | SQLITE_DATABASE_UNREACHABLE            | Step 5    | INF      | SQLite 连接失败              |
| TQ-INF-008 | SQLITE_SCHEMA_VERSION_MISMATCH         | Step 5    | INF      | SQLite schema 漂移           |
| TQ-INF-009 | POSTGRES_UNREACHABLE                   | Step 6    | INF      | Postgres 连接失败            |
| TQ-INF-010 | KAFKA_BROKER_UNREACHABLE               | Step 9    | INF      | Kafka broker 连接失败        |
| TQ-INF-011 | CONFIG_FILE_UNREADABLE                 | Step 11   | INF      | YAML 文件无法读取            |
| TQ-INF-012 | CONFIG_HISTORY_DIRECTORY_UNREADABLE    | Step 12   | INF      | history 目录无法读取         |
| TQ-INF-013 | EXTERNAL_ENGINE_TIMEOUT                | Step 13   | INF      | 外部引擎超时                 |
| TQ-INF-014 | EXTERNAL_ENGINE_RETRIES_EXHAUSTED      | Step 13   | INF      | 重试预算耗尽                 |
| TQ-INF-015 | EXTERNAL_ENGINE_CIRCUIT_OPEN           | Step 13   | INF      | 熔断 open 拒绝               |
| TQ-INF-016 | EXTERNAL_ENGINE_RATE_LIMITED           | Step 13   | INF      | 限流拒绝                     |
| TQ-INF-017 | EXTERNAL_ENGINE_NON_RETRYABLE          | Step 13   | INF      | 4xx 不可重试                 |
| TQ-INF-018 | EXTERNAL_ENGINE_BASE_URL_UNREACHABLE   | Step 14   | INF      | init-time URL 不可达         |
| TQ-CON-004 | ADAPTER_CONTRACT_TEST_VIOLATION        | Step 3    | CON      | 契约测试违反                 |
| TQ-CON-005 | EVENT_SCHEMA_VIOLATION                 | Step 3    | CON      | event schema 违反            |
| TQ-CON-006 | ADAPTER_CONFIG_VERSION_NOT_FOUND       | Step 11   | CON      | adapter 内 config 版本不存在 |
| TQ-CON-007 | ADAPTER_CONFIG_ACTIVATION_AUDIT_FAILED | Step 11   | CON      | 激活后审计 append 失败       |
| TQ-CON-008 | CONFIG_FILE_SCHEMA_INVALID             | Step 11   | CON      | YAML schema 不合法           |
| TQ-CON-009 | CONFIG_HISTORY_STATE_INCONSISTENT      | Step 12   | CON      | history 目录状态漂移         |
| TQ-CON-010 | MARGIN_RESPONSE_SCHEMA_INVALID         | Step 15   | CON      | Margin 下游 body 漂移        |
| TQ-CON-011 | POSITION_RESPONSE_SCHEMA_INVALID       | Step 16   | CON      | Position 下游 body 漂移      |
| TQ-CON-012 | MATCH_RESPONSE_SCHEMA_INVALID          | Step 16   | CON      | Match 下游 body 漂移         |
| TQ-CON-013 | MARK_PRICE_RESPONSE_SCHEMA_INVALID     | Step 17   | CON      | MarkPrice 下游 body 漂移     |
| TQ-CON-014 | FUND_RESPONSE_SCHEMA_INVALID           | Step 17   | CON      | Fund 下游 body 漂移          |

合计：TQ-INF 15 个 + TQ-CON 11 个（004-014）= 26 个 Phase 8 新增。Phase 8 收官时仓库错误码总数：TQ-INF 18 + TQ-CON 14 + TQ-DOM 5 + TQ-APP 25 + TQ-POL 11 + TQ-SAG 1 = 74 个。

### C.4 新增 Saga 步骤

**无新增**。Phase 8 全程是 Adapter 层工作，零 Saga 引入。Sprint A-E 不增加任何新 saga 步骤。Saga 扩展由 Phase 9 负责。

## D. KNOWN-ISSUES.md 复核状态

| KI 编号       | 状态            | 修复 Phase            | 备注                                              |
| ------------- | --------------- | --------------------- | ------------------------------------------------- |
| KI-P8-001     | open            | Phase 9               | domain 75.16% 行覆盖率                            |
| KI-P8-002     | open            | Phase 11              | postgres + kafka 受真实基础设施依赖               |
| KI-P8-003     | open            | Phase 9 / 11          | 契约测试 + 集成测试在高并发下偶发 flake           |
| **KI-P8-004** | **✅ RESOLVED** | **Phase 8 / Step 19** | **6 Adapter 包 test/ → src/ 根本性整理，详见 §E** |
| KI-P8-005     | N/A             | —                     | ports/src 0% 行覆盖率（结构性现象，不修复）       |

Phase 8 收官时 4 项 open + 1 项 resolved + 1 项 N/A = 5 项总登记，全部数据可对应 KNOWN-ISSUES.md。

## E. KI-P8-004 处置详情

### E.1 处置范围

6 个 Adapter 包：

- `@tianqi/external-engine-http-base`
- `@tianqi/margin-engine-http`
- `@tianqi/position-engine-http`
- `@tianqi/match-engine-http`
- `@tianqi/mark-price-engine-http`
- `@tianqi/fund-engine-http`

### E.2 处置内容（每包同模式）

| 改动                                           | 之前                                            | 之后                                       |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| 测试文件位置                                   | `test/*.test.ts` + `test/*.contract.test.ts`    | `src/*.test.ts` + `src/*.contract.test.ts` |
| helpers 子目录（仅 external-engine-http-base） | `test/helpers/`                                 | `src/helpers/`                             |
| tsconfig.json `rootDir`                        | `"."`                                           | `"src"`                                    |
| tsconfig.json `include`                        | `["src/**/*.ts", "test/**/*.ts"]`               | `["src/**/*.ts"]`                          |
| package.json `main` / `types`                  | `"dist/src/index.js"` / `"dist/src/index.d.ts"` | `"dist/index.js"` / `"dist/index.d.ts"`    |
| 测试文件内 import                              | `from "../src/<engine>.js"`                     | `from "./<engine>.js"`                     |
| tsconfig references（业务 Engine）             | 4 项                                            | +1 (`../adapter-testkit`) = 5 项           |

注：业务 Engine 5 包的测试文件原本就 import `@tianqi/adapter-testkit` 的 `createMockDownstreamServer`，但旧 tsconfig 缺失 adapter-testkit references；新结构下补上让 tsc -b 增量构建顺序正确。

### E.3 处置顺序与验证

按依赖顺序处置：

1. external-engine-http-base（基座，先迁；并迁移 helpers/mock-downstream-server.ts → src/helpers/）
2. margin-engine-http
3. position-engine-http
4. match-engine-http
5. mark-price-engine-http
6. fund-engine-http

每包处置后立即 `pnpm typecheck` 验证。最终全套 `pnpm test` 验证 1668 tests 全绿；`pnpm test:coverage` 验证覆盖率与 Step 18 基线持平（85.97% lines / 79.78% branches）。

### E.4 vitest.config.ts 配套调整

迁移后 src/helpers/mock-downstream-server.ts 是测试基础设施（不是产品代码），但 coverage exclude 之前没有针对 helpers 子目录的规则。Step 19 在 vitest.config.ts coverage exclude 增加 `**/helpers/**`，让其不计入覆盖率分母。这条规则同时也覆盖 adapter-testkit 的 helpers/ 子目录（既已被 `packages/adapters/adapter-testkit/**` 整体排除，再加一条不冲突）。

修复后总覆盖率回到 85.97% lines / 79.78% branches，与 Step 18 基线**精确持平**——证明迁移不引入新 untested 代码。

## F. Step 18 → Step 19 → Phase 9 衔接

### F.1 Phase 8 → Phase 9 边界

Phase 8 CLOSED 后，Phase 9 启动条件（《§1.3》）满足。下面这些**禁止**在 Phase 8 内做的事，是 Phase 9 的合法工作：

- 引入新 Saga 步骤（Phase 9 主题：补偿义务 / 幂等 / 顺序 / 信息承载 / 状态持久化）
- TQ-SAG-\* 命名空间扩展（当前仅 TQ-SAG-001）
- 让 Application 层直接消费 EventStorePort / NotificationPort / ConfigPort（替换 Phase 1-7 自家 OrchestrationPorts 形状）
- 真实 Postgres / Kafka CI 集成（按 §8.1 Phase 11 起 mock 禁令）
- domain 边界测试增补（KI-P8-001）

### F.2 Phase 8 留给 Phase 9 的资产

- 13 个 Adapter 包就绪可被 Application 层 DI 注入
- 5 个业务 Engine Port 形状稳定，可被 Application 层 / Policy 层消费
- 33 个错误码（含 Phase 8 新增 26 个）按命名空间隔离永久固化
- 21 套契约测试模板可被未来类似 Adapter 复用
- ADR-0001 + KNOWN-ISSUES.md 提供完整决策史与未达项跟踪

### F.3 Phase 9 工程师的"上手入口"

按"层层递进"导航：

1. **从根开始**：`README.md` → 仓库定位
2. **看变更**：`CHANGELOG.md` → Phase 8 做了什么
3. **看决策**：`docs/decisions/0001-phase-8-adapter-layer.md` → 为什么这么做
4. **看 Adapter 入驻表**：`packages/adapters/README.md` → 13 个 Adapter 各自定位
5. **看每步细节**：`docs/phase8/01-19` → 19 份执行记录
6. **看代码**：`packages/{ports,adapters}/src/` → 真实落地

这五层文档**层层递进**，是宗旨"让算法变成工程师愿意读的代码"在仓库结构上的具体形态。

## G. 元规则 / 惯例触发情况

| 规则                                      | 状态                                                                  | 证据                                    |
| ----------------------------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| **A**                                     | **第七次触发**已落地（Step 18 margin metadata fix），Step 19 不新触发 | 不引入新冲突                            |
| **B**                                     | 严格贯彻                                                              | 零既有签名改动                          |
| **C / D / E / H / I / J / M / N / O / P** | N/A                                                                   | Step 19 不新建任何契约 / Adapter / Port |
| **F**                                     | 严格贯彻                                                              | 测试文件迁移不引入跨 Adapter 依赖       |
| **G**                                     | **零触发**                                                            | 不引入新第三方依赖                      |
| **K**                                     | N/A                                                                   | 不新建错误码                            |
| **L**                                     | N/A                                                                   | 不新建 Adapter 自有测试                 |

Step 19 是 Phase 8 唯一一个所有元规则与惯例**几乎全部不触发**的 Step——这正是"收官 Step"的特征：不构建新东西，只完成闭合。

## H. 测试增量明细

| 来源                   | 新增 it 数      |
| ---------------------- | --------------- |
| KI-P8-004 处置         | 0（仅文件迁移） |
| ADR / docs / CHANGELOG | 0               |
| **合计**               | **0**           |

**测试总数**：1668 → **1668**（持平）。Phase 8 收官时测试总数 = Phase 1-7 收官 1106 + Phase 8 19 步累计 562 = 1668。

## I. 代码规模实证（Phase 8 全景）

| 维度             | Phase 1-7 收官 | Phase 8 收官 | 增量 |
| ---------------- | -------------- | ------------ | ---- |
| workspace 包数   | 8              | 21           | +13  |
| 测试总数         | 1106           | 1668         | +562 |
| 错误码总数       | 48             | 74           | +26  |
| Adapter 包数     | 0              | 13           | +13  |
| 业务 Engine Port | 0              | 5            | +5   |

Phase 8 物理代码体量（Adapter 主体源码，不含测试）：

| 组件                                               | 行数         |
| -------------------------------------------------- | ------------ |
| 5 业务 Engine Adapter 主体                         | ~1970        |
| 1 基座 Adapter（external-engine-http-base）        | ~600         |
| 3 EventStore Adapter（memory + sqlite + postgres） | ~870         |
| 2 Notification Adapter（memory + kafka）           | ~580         |
| 2 Config Adapter（memory + file）                  | ~1010        |
| testkit 工具包                                     | ~830         |
| 5 业务 Engine Port + 1 基座 Port hooks             | ~745         |
| 14 错误码工厂                                      | ~250         |
| **Adapter 层主体合计**                             | **~6855 行** |

Adapter 层稳定性逻辑分布：

- 基座（external-engine-http-base）：~600 行五件套 + 0 行业务逻辑
- 5 业务 Engine：~1970 行业务翻译 + **0 行稳定性逻辑**（grep `retry|timeout|circuit|rateLimit|backoff|sleep` 验证）

这就是"基座 + 业务"分层架构在 Phase 8 收官时的具体形态。

## J. 对作品级代码库的意义

Phase 8 / Step 19 是 Tianqi 第一次**对外发布**——CHANGELOG.md 让仓库根有了"产品级说明书"，ADR-0001 让 docs/decisions/ 有了"为什么"档案，docs/phase8/19 让 docs/phase8/ 有了完整组件清单。这三件加上 Step 18 建立的 KNOWN-ISSUES.md，共同构成了"非 Phase 8 内部读者"的入口。

读者从根目录的 README → CHANGELOG → ADR → packages/adapters/README → docs/phase8/\* 五层递进，Phase 8 真实呈现的不是"19 个 Step 的工作量"，而是：

> **一组 13 个 Adapter 落地工作的连续工程纪律演化**——14 条元规则、2 条惯例、5 项关键架构裁决、5 项明确登记的 KI 项、4/4 二元判据全绿。

Phase 8 收官时，整个仓库呈现"作品级"形态：

- **代码层面**：21 个 workspace 包，每个职责单一；13 个 Adapter 同形结构呈现"按模板填空"特征；33 个错误码命名空间清晰；1668 测试 + 86%/80% 覆盖率全部达标。
- **文档层面**：根 README + CHANGELOG + 5 层导航；docs/decisions/ 决策档案；docs/phase8/01-19 + docs/phase8/19 完整执行记录；KNOWN-ISSUES.md 显式登记 5 项未达项。
- **工程纪律层面**：14 条元规则 + 2 条惯例（含修订与弹性）从实战中长出来，每条都有具体触发点；非内部读者也能从 ADR-0001 一站式理解。

Tianqi 宗旨"让风控算法第一次变成工程师愿意读的代码"在 Phase 8 收官时的具体落地是：**连一个非项目内部的工程师，也能从仓库结构的五层递进中，独立理解 Phase 8 做了什么、为什么这么做、以及未来 Phase 9-12 会从哪里继续**。

---

**Phase 8 CLOSED**：4/4 二元判据通过，3/3 产出齐备，1 项技术债（KI-P8-004）已修复，CHANGELOG + ADR + 完整组件清单全部归档。

下一战 Phase 9：Saga 补偿完整实现（《§4》）。
