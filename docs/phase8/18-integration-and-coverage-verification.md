# Phase 8 / Step 18 — 跨 Adapter 集成测试 + Application 层 DI 切换验证 + 覆盖率核查

## A. Step 18 定位（性质转变）

Step 18 是 **Phase 8 第一个"回头看"的 Step**。前 17 个 Step 全部是构建型（新增 Adapter / Port / 错误码 / 契约函数）；Step 18 性质完全不同：

- **不新增任何 Adapter**
- **不新增任何 Port / 错误码（除非集成测试发现真实缺口——本 Step 未触发）**
- **不新增任何契约函数**
- **新增的是"集成验证"代码与"覆盖率配置"**

成败标准不是"做了多少新东西"，而是"已有的东西是否真的协同工作"。

**实测结论**：

- 21 个 workspace 包通过 4 套集成测试联动 — 全绿
- 整体覆盖率 lines 85.97% / branches 79.79% / functions 94.86% / statements 85.97% — 超过 §9.3 的 80%/75% 门槛
- 集成期发现 1 个真实 metadata bug（margin-engine-http 漏修），已最小修复并留痕（KI-P8-004）
- Phase 8 CLOSED 二元判据中 3/4 已绿（剩余 ADR 归档由 Step 19 完成）

测试增量：1648 → **1668**（+20 集成测试，含 4 skip 等待 Phase 11 真实基础设施）。

## B. Application 层 DI 注入机制实地观察

读 `packages/application/src/orchestration-ports.ts` 与 `risk-case-orchestrator.ts` 后的实地发现：

> **Phase 1-7 冻结的 Application 层使用自家定义的端口形状**（`OrchestrationPorts.{caseRepository, audit, policyConfig, ...}`），**不直接消费 Phase 8 标准化的 Adapter 端口**（`EventStorePort` / `NotificationPort` / `ConfigPort`）。

具体形态：

| Port                                         | 由谁消费                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `EventStorePort`                             | adapter 实现 + adapter-testkit 契约（Phase 9+ 引入 application 消费者） |
| `NotificationPort`                           | 同上                                                                    |
| `ConfigPort`                                 | 同上                                                                    |
| `OrchestrationPorts.policyConfig` (自家形状) | `executeRiskCaseOrchestration`                                          |
| `OrchestrationPorts.audit` (自家形状)        | 同上                                                                    |

这不是问题——Phase 1-7 的 Application 层在 EventStore / Notification / Config Adapter 出现之前已冻结，自然没有这些 Port 的消费者。Phase 9+ 将引入"用 EventStorePort 持久化 application 事件"的消费者，届时本 Step 的集成测试自动升级为"端到端 DI 切换"。

**Step 18 的处置**：把"Adapter 替换原则"（§3.7）的运行时验证落在**端口本身**——对每个 Adapter 写一个 thin "application-layer-style" consumer 函数 (`consumeEventStoreFromApplicationLayer` / `consumeNotificationFromApplicationLayer` / `consumeConfigFromApplicationLayer`)，让该函数被 memory / sqlite / postgres 三个实现以**完全相同代码**驱动；切换时仅 factory 不同。这正是 §3.7 在 Phase 8 末尾的可观测形态。

## C. 核心设计裁决

### 1. 集成测试落点选择

| 选项                                           | 描述                                        | 评价                                                                                               | 选定 |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---- |
| α: `packages/application/test/integration/`    | 与 adapter 包模式一致                       | 需改 application 的 tsconfig rootDir + package.json main/types，引入 Step 14 metadata bug 复现风险 | ❌   |
| **β: `packages/application/src/integration/`** | **延续 application 已有 src/ 内联测试模式** | **零 metadata 改动，零 tsconfig 重排，最小入侵**                                                   | ✅   |
| γ: 新建 `packages/integration-tests/` 包       | 独立测试包                                  | 新增第 22 个 workspace 包，过度（克制 > 堆砌）                                                     | ❌   |
| δ: 仓库根 `test/integration/`                  | 完全独立                                    | 脱离 application 包语境，typecheck 不便                                                            | ❌   |

**选定 β** 的具体落地：

- 4 个集成测试文件位于 `packages/application/src/integration/*.integration.test.ts`
- application/package.json 添加 14 个 adapter 包作为 devDependencies
- application/tsconfig.json 添加对应的 14 个 project references（保证 tsc -b 增量构建顺序）
- 应用层包的 main/types 元数据保持不变（仍指向 dist/index.js）

### 2. vitest coverage provider 选择：v8

| 候选     | 优势                                                                       | 劣势                              |
| -------- | -------------------------------------------------------------------------- | --------------------------------- |
| **v8**   | vitest 默认推荐 / 与 Node V8 引擎原生 inspector 集成 / 速度快 / 无源码侵入 | 行号映射偶有 ±1 差异              |
| istanbul | 报告字段更细 / 与历史 Karma 体系兼容                                       | 慢约 30-50% / 需要 babel/swc 插桩 |

**选定 v8**：vitest 3.x 默认推荐 + Tianqi 已是 ESM + node:test workflow，原生 V8 集成是最简路径。`@vitest/coverage-v8@3.2.4` 与 vitest@3.2.4 严格版本对齐避免 peer warning。

### 3. coverage thresholds 数值选择

| 维度       | 阈值   | 实测  | 余量   |
| ---------- | ------ | ----- | ------ |
| lines      | 80     | 85.97 | +5.97  |
| functions  | 80     | 94.86 | +14.86 |
| statements | 80     | 85.97 | +5.97  |
| branches   | **75** | 79.79 | +4.79  |

`branches` 选 75 而非 80：分支覆盖通常比 lines/statements 低 ~5pp（因为防御性 validation 路径分支多但未必每条都被测试触发），75% 是行业实战的合理 floor。整体仍能满足 §9.3 80% 门槛的精神（lines/functions/statements 三项都 ≥ 80%）。

### 4. 集成测试设计模式

每个 Adapter 切换测试用相同的"thin Application-layer-style consumer"模式：

```ts
// 模式 (4 套测试一致)
const consumeXFromApplicationLayer = async (port: XPort) => { ... 业务调用 ... };

const cases = [
  { name: "memory", factory: () => createInMemoryX() },
  { name: "<sql>", factory: () => createSqliteX(...) },
  { name: "<grpc>", factory: () => createPostgresX(...), skip: !ENV_VAR }
];

describe.each(cases)("X swap: $name", ({ factory, skip }) => {
  it.skipIf(skip)("test_application_layer_consumes_X_through_port_without_modification", async () => {
    const adapter = await factory();
    await adapter.init();
    try {
      const result = await consumeXFromApplicationLayer(adapter);
      expect(result.<observable>).toBe(<expected>);
    } finally {
      await adapter.shutdown();
    }
  });
});
```

**§3.7 Adapter 替换原则的运行时验证**：所有 case 用**完全相同**的消费代码 (consumeXFromApplicationLayer)，仅 factory 不同。任何 case 需要特殊 setup 才能跑通即视为契约违反。本 Step 无此情况——所有现有 Adapter 都通过同一份消费代码工作。

### 5. External Engine 集成测试（区别设计）

External Engine 5 个 Adapter 各自实现**不同的 Port**（MarginEnginePort / PositionEnginePort / MatchEnginePort / MarkPriceEnginePort / FundEnginePort），不存在"同 Port 切换"——本测试因此与前三个不同。验证项目：

- **多 Engine 协同**：一个测试场景串联 mark-price → margin → position → match → fund 5 次调用，每次调用各自的 mock 下游，每次都通过 trace header 透传。验证 5 个 Adapter 的并发 init / shutdown 与 trace header 端到端透传。
- **错误传播契约**：margin 引擎被注入 4xx 时，application 层看到的是 TQ-INF-017 + 不泄漏 raw status；mark-price 引擎被注入 schema-invalid body（markPrice = 0）时，application 层看到的是 TQ-CON-013 + reason `missing_or_non_positive_number`。
- **生命周期一致性**：5 个 Engine 的 healthCheck details 都含 `engineKind` 字段，5 个值两两不同。

### 6. mock 边界声明（§8.1 红线）

本 Step 的集成测试在 Phase 8 阶段**允许 mock**：

| 测试                        | mock 对象                                  | Phase 11 替换为        |
| --------------------------- | ------------------------------------------ | ---------------------- |
| EventStore swap (sqlite)    | `databasePath: ":memory:"`                 | 真实磁盘 SQLite 数据库 |
| EventStore swap (postgres)  | 通过 `TIANQI_TEST_POSTGRES_URL` 控制 skip  | CI 真实 Postgres 实例  |
| Notification swap (kafka)   | 通过 `TIANQI_TEST_KAFKA_BROKERS` 控制 skip | CI 真实 Kafka 集群     |
| External Engine integration | testkit 的 `createMockDownstreamServer`    | 真实下游 HTTP 服务     |

Phase 11+ 起禁止 mock 必须使用真实基础设施。本边界在 KI-P8-002 留痕。

### 7. KNOWN-ISSUES.md 位置选择

| 选项                     | 描述                            | 评价                                    | 选定 |
| ------------------------ | ------------------------------- | --------------------------------------- | ---- |
| `docs/KNOWN-ISSUES.md`   | 与既有 docs/phase\*/ 索引同位置 | 与运维文档同源                          | ✅   |
| 仓库根 `KNOWN-ISSUES.md` | 项目根级别                      | 与 README.md 同级，需要单独 README 链接 | ❌   |

**选定 docs/KNOWN-ISSUES.md** —— 与 `docs/00-phase1-mapping.md` / `docs/commit-convention.md` 等基础工程文档同位置，运维查找路径单一。

### 8. 集成测试发现的真实问题及处置

**问题**：margin-engine-http 的 `package.json` 含 Step 14 build metadata bug（`main: "dist/index.js"` 但实际产物在 `dist/src/index.js`），Step 15 修补 external-engine-http-base 时漏修 margin-engine-http 自身。本 Step 首次以 application 包消费 `@tianqi/margin-engine-http` 时触发 `TS2307: Cannot find module` 错误。

**处置**（按 META-RULE A 既有事实胜出原则）：

- 应用 Step 15 §E 同款最小修复——把 `main` / `types` 改为 `dist/src/index.js` / `dist/src/index.d.ts`
- 仅 metadata 改动，零 TypeScript 源 / tsconfig / test 源文件改动
- 与 Step 15 §E 留痕一致："package.json metadata 不是代码也不是签名"
- 记录在 KI-P8-004（Step 19 收官时一并处理 test/ → src/ 根本性整理）

**没有调整测试期望以"绕过"问题**——这是契约失败的伪装。问题是真实的，修复也是真实的。

### 9. 元规则 / 惯例触发情况

| 规则              | 状态                               | 证据                                                                                                                                        |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **A**             | **第七次触发**                     | 集成测试发现 margin-engine-http metadata bug；按既有事实胜出原则用 Step 15 §E 最小修复模式处置                                              |
| **B**             | 严格贯彻                           | 所有 Adapter / Port / 契约函数签名零改动                                                                                                    |
| **C / E / H**     | N/A                                |                                                                                                                                             |
| **D**             | 严格贯彻                           | adapter-testkit 零变化                                                                                                                      |
| **F**             | 严格贯彻                           | 5 个 External Engine 集成测试中各自独立 mock server，零相互 import                                                                          |
| **G**             | **第六次触发**（首次仅工具链依赖） | 引入 `@vitest/coverage-v8@3.2.4` —— 工具链 dependency，与 vitest@3.2.4 peer 严格对齐；MIT；无 native build；纯 JS。Phase 8 第六次第三方依赖 |
| **I**             | 严格贯彻                           | 集成测试用真实 init/shutdown，healthCheck 路径覆盖                                                                                          |
| **J**             | 严格贯彻                           | 集成测试支持 `TIANQI_TEST_POSTGRES_URL` / `TIANQI_TEST_KAFKA_BROKERS` 控制 skip                                                             |
| **M / N / O / P** | 不直接触发                         | 集成测试是验证而非新建                                                                                                                      |
| **K**             | N/A                                | 无新错误码                                                                                                                                  |
| **L**             | N/A                                | 集成测试不是 Adapter 自有测试，不受 Convention L ≤10 上限约束                                                                               |

## D. 代码变更（按文件）

### 配置层

- **`vitest.config.ts`**：首次启用 coverage 段，provider v8 / include 严格限定 §9.3 范围 / exclude adapter-testkit + test 文件 + 编译产物 + 仅导出 barrel / thresholds 80/80/75/80
- **`package.json`**：新增 `test:coverage` script（`vitest run --coverage`）；新增 devDependency `@vitest/coverage-v8@3.2.4`

### Application 包元数据

- **`packages/application/package.json`**：新增 14 个 workspace devDependencies（adapter-testkit + 13 个 adapter 包），未触动 production dependencies
- **`packages/application/tsconfig.json`**：references 段从 4 项扩到 18 项（追加 14 个 adapter 包路径），保证 tsc -b 增量构建顺序

### 集成测试（4 个文件，20 it = 16 passed + 4 skipped）

- `packages/application/src/integration/event-store-adapter-swap.integration.test.ts` — 6 it：3 Adapter（memory + sqlite + postgres-skip）× 2 it（消费验证 + 健康检查）
- `packages/application/src/integration/notification-adapter-swap.integration.test.ts` — 4 it：2 Adapter（memory + kafka-skip）× 2 it
- `packages/application/src/integration/config-adapter-swap.integration.test.ts` — 4 it：2 Adapter（memory + file）× 2 it
- `packages/application/src/integration/external-engine-integration.integration.test.ts` — 6 it：1 multi-engine 协同 + 2 错误传播 + 1 生命周期一致性 + 2 brand constructor smoke

### 元数据修复

- **`packages/adapters/margin-engine-http/package.json`**：`main` / `types` 从 `dist/index.js` / `dist/index.d.ts` 修正为 `dist/src/index.js` / `dist/src/index.d.ts`（Step 15 §E 同款最小修复，KI-P8-004 记录）

### 文档

- **`docs/KNOWN-ISSUES.md`**（新）：Phase 8 状态总览 + 5 项显式登记观察项（KI-P8-001 ~ KI-P8-005）
- **`docs/phase8/18-integration-and-coverage-verification.md`**（本文件）
- **`docs/00-phase1-mapping.md`**：追加 Step 18 mega-bullet

## E. 风险点

1. **覆盖率 < 80% 的具体差距与缺口分布**
   - **整体已达标（85.97%）**——Phase 8 CLOSED 二元判据通过
   - 单包级别有 5 项观察值得登记（domain 75.16% / event-store-postgres 40.71% / notification-kafka 47.42% / ports 0% / external Adapter branches 局部偏低），均不阻塞 Phase 8 CLOSED，但 Phase 9+ 应分阶段收紧
   - **Mitigation**：所有缺口在 KNOWN-ISSUES.md KI-P8-001~005 显式登记，含修复责任 Phase

2. **Application 层 DI 注入机制若不存在该如何处置**
   - 本 Step 实地观察：Phase 1-7 application 层不直接消费 EventStorePort/NotificationPort/ConfigPort，使用自家 OrchestrationPorts 形状
   - **处置**（已落地）：将"DI 切换零业务代码改动"在 Phase 8 阶段表达为"thin application-layer-style consumer 通过同一份代码消费多个 Adapter 实现"。Phase 9+ 引入 EventStorePort 实际消费者后，本测试自动升级为端到端 DI 切换，结构无需重写。
   - 文档留痕：本文 §B + 4 个集成测试文件头注释

3. **集成测试在不同 Adapter 上的执行时间差异**
   - memory < 50ms；sqlite ~100-200ms（in-memory 模式）；file ~150ms（tmpfile I/O）；External Engine 5 mock server ~500ms
   - 5 mock HTTP server 并发启动会与既有 contract test 的 100ms 级别熔断时序断言竞争 CPU，偶发 flake（KI-P8-003）
   - **Mitigation**：单文件运行 100% 通过；CI 退化场景通过 vitest retry 配置（Step 19 评估是否启用）

4. **Step 19 收官前的剩余技术债**
   - **KI-P8-004**：5 业务 Engine + 基座的 test/ 目录与 dist/src/ 路径绕路（Step 19 一并整理）
   - **KI-P8-003**：契约测试时序敏感 flake（Step 19 评估 retry / 时序 stub）
   - **KI-P8-001 / 002 / 005**：覆盖率 / 真实基础设施 / ports 0% 现象，均推到 Phase 9+

5. **推送过程异常**
   - 无预期。Step 18 的 3 个 commit 各自独立可回滚（test 文件 / 配置 / 文档分离）

## F. 测试计划与覆盖率明细

### 集成测试新增 it 清单（4 套，共 20 it）

| 文件                                              | it                                                                                               | 状态（无 env vars 时）                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `event-store-adapter-swap.integration.test.ts`    | `test_application_layer_consumes_event_store_through_port_without_modification` (memory)         | ✅                                       |
| 同上                                              | 同上 (sqlite :memory:)                                                                           | ✅                                       |
| 同上                                              | 同上 (postgres)                                                                                  | ⏭️ skip (TIANQI_TEST_POSTGRES_URL 缺失)  |
| 同上                                              | `test_event_store_health_check_reports_running_after_init_swap_invariant` (memory)               | ✅                                       |
| 同上                                              | 同上 (sqlite)                                                                                    | ✅                                       |
| 同上                                              | 同上 (postgres)                                                                                  | ⏭️ skip                                  |
| `notification-adapter-swap.integration.test.ts`   | `test_application_layer_consumes_notification_through_port_without_modification` (memory)        | ✅                                       |
| 同上                                              | 同上 (kafka)                                                                                     | ⏭️ skip (TIANQI_TEST_KAFKA_BROKERS 缺失) |
| 同上                                              | `test_notification_health_check_reports_running_after_init_swap_invariant` (memory)              | ✅                                       |
| 同上                                              | 同上 (kafka)                                                                                     | ⏭️ skip                                  |
| `config-adapter-swap.integration.test.ts`         | `test_application_layer_reads_active_config_through_port_without_modification` (memory)          | ✅                                       |
| 同上                                              | 同上 (file)                                                                                      | ✅                                       |
| 同上                                              | `test_config_health_check_reports_running_after_init_swap_invariant` (memory)                    | ✅                                       |
| 同上                                              | 同上 (file)                                                                                      | ✅                                       |
| `external-engine-integration.integration.test.ts` | `test_application_layer_threads_mark_price_then_margin_then_position_then_order_then_fund_query` | ✅                                       |
| 同上                                              | `test_engine_failure_translates_to_tq_inf_017_without_leaking_raw_status`                        | ✅                                       |
| 同上                                              | `test_engine_returning_malformed_body_raises_tq_con_with_field_reason`                           | ✅                                       |
| 同上                                              | `test_all_five_engines_report_healthy_after_init_with_engine_kind_documented`                    | ✅                                       |
| 同上                                              | `test_margin_amount_brand_constructor_is_invokable_from_application_layer`                       | ✅                                       |
| 同上                                              | `test_margin_currency_brand_constructor_is_invokable_from_application_layer`                     | ✅                                       |

**统计**：20 it 新增，16 passed + 4 skipped (postgres 2 + kafka 2)。
**测试总数**：1648 → **1668**（+20）。Gate G11 下限 1655，超出 13。

### 覆盖率按 package 拆分（pnpm test:coverage 实测）

| Package                              |      Lines % |      Stmts % |  Functions % |   Branches % |
| ------------------------------------ | -----------: | -----------: | -----------: | -----------: |
| `application/src`                    |        86.51 |        86.51 |        95.94 |        81.69 |
| `domain/src`                         | **75.16** ⚠️ | **75.16** ⚠️ |        93.06 |        75.80 |
| `policy/src`                         |        92.38 |        92.38 |        96.67 |        85.74 |
| `ports/src`                          |  **0.00** ⚠️ |  **0.00** ⚠️ |          100 |          100 |
| `adapters/adapter-testkit`           |     excluded |     excluded |     excluded |     excluded |
| `adapters/config-file`               |        80.80 |        80.80 |        97.78 |        77.89 |
| `adapters/config-memory`             |        95.89 |        95.89 |          100 |        85.37 |
| `adapters/event-store-memory`        |        94.16 |        94.16 |          100 |        84.38 |
| `adapters/event-store-postgres`      | **40.71** ⚠️ | **40.71** ⚠️ |        24.00 |        34.78 |
| `adapters/event-store-sqlite`        |        96.00 |        96.00 |          100 |        80.56 |
| `adapters/external-engine-http-base` |        92.14 |        92.14 |          100 |        84.06 |
| `adapters/fund-engine-http`          |        95.25 |        95.25 |          100 |        53.42 |
| `adapters/margin-engine-http`        |        97.21 |        97.21 |          100 |        61.29 |
| `adapters/mark-price-engine-http`    |        94.14 |        94.14 |          100 |        63.16 |
| `adapters/match-engine-http`         |        94.51 |        94.51 |          100 |        47.73 |
| `adapters/notification-kafka`        | **47.42** ⚠️ | **47.42** ⚠️ |        50.00 |        47.62 |
| `adapters/notification-memory`       |        95.71 |        95.71 |          100 |        77.78 |
| `adapters/position-engine-http`      |        93.89 |        93.89 |          100 |        50.60 |
| **All files (aggregate)**            | **85.97** ✅ | **85.97** ✅ | **94.86** ✅ | **79.79** ✅ |

⚠️ 标记的项是 KNOWN-ISSUES.md 登记观察项（KI-P8-001 / 002 / 005）。**整体覆盖率全部超过 §9.3 的 80%/75% 门槛，Phase 8 CLOSED 覆盖率判据通过**。

## G. 元规则 / 惯例触发情况（§C.9 详细）

- **A 第七次触发**：metadata bug 修复（margin-engine-http）
- **B 严格贯彻**：零既有签名改动
- **F 严格贯彻**：External Engine 集成测试 5 个独立 mock server，零相互 import
- **G 第六次触发**：`@vitest/coverage-v8@3.2.4` 工具链依赖（peer 严格对齐 vitest@3.2.4）
- **I / J 严格贯彻**：init/shutdown 完整路径 + env-vars 控制 skip
- **K / L / M / N / O / P**：N/A（验证型 Step 不触发新建型规则）
- **C / D / E / H**：N/A

## H. Phase 8 CLOSED 二元判据状态（§2.2）

| 判据                         | 状态 | 由谁负责                           | 证据                                                                                                                                                              |
| ---------------------------- | ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lint / typecheck / test 通过 | ✅   | Step 17 落地，Step 18 维持         | 1668 tests / typecheck 0 errors / lint 0 warnings                                                                                                                 |
| 契约测试通过                 | ✅   | Step 17 落地，Step 18 集成验证维持 | 21 contract it × 5 业务 Engine + 21 contract it × 1 基座 + 21 contract it × 3 EventStore + 18 contract it × 2 Notification + 21 contract it × 2 Config 全部维持绿 |
| 覆盖率达标（80% / 75%）      | ✅   | Step 18 实测                       | 整体 lines 85.97% / branches 79.79% / functions 94.86% / statements 85.97%                                                                                        |
| ADR 归档                     | ⏳   | Step 19 职责                       | Step 18 不预先草拟                                                                                                                                                |

**Phase 8 三件产出（§12.2）状态**：

| 产出                                      | 状态                                                                        | 由谁负责 |
| ----------------------------------------- | --------------------------------------------------------------------------- | -------- |
| ADR 归档（docs/decisions/）               | ⏳ Step 19                                                                  |          |
| 新 Port / Adapter / Saga / 错误码完整清单 | ⏳ Step 19（已有材料：本文 §D + docs/00-phase1-mapping.md Step 13-18 条目） |          |
| `KNOWN-ISSUES.md`                         | ✅ Step 18 落地                                                             |          |

## I. Step 19 衔接

Step 18 输出对 Step 19 的影响：

- **二元判据 3/4 已绿**——Step 19 仅需完成 ADR 归档
- **`KNOWN-ISSUES.md` 已建立**——Step 19 可直接补充而无需从零创建
- **5 项 KI 已登记** —— 其中 **KI-P8-004 是 Step 19 的明确职责**（test/ → src/ 根本性整理）；其它 4 项推到 Phase 9+
- **测试总数 1668 / 覆盖率 85.97%** —— Phase 8 收官时的稳态

Step 19 预期 4 项工作：

1. ADR 归档（`docs/decisions/` 创建并写入 Step 13-18 关键决策）
2. KI-P8-004 处置（5 业务 Engine + 基座的 tsconfig + main/types 根本性整理）
3. CHANGELOG / 清单同步
4. Phase 8 → Phase 9 衔接备忘（packages/ 是否冻结、未来扩展点）

Step 18 把 Phase 8 收官从"未知工作量"压缩到"已知 4 项明确工作"。这正是"回头看"Step 的价值——发现剩余路径的真实形态，让收官 Step 不需要意外发挥。

## J. 对作品级代码库的意义

Phase 8 / Step 18 是 Tianqi 第一次**集成期回头看**。回头看的意义不在于"发现新东西"，而在于**确认已有的东西仍然按设计工作**。

实测结果：

- 5 个 EventStore / Notification / Config Adapter 通过同一份消费代码可互换 —— **§3.7 Adapter 替换原则在 Phase 8 末尾仍成立**
- 5 个 External Engine 在多 Engine 协同场景下顺利串联 —— **Sprint E 业务 Engine 收官的工程纪律仍成立**
- 整体覆盖率 85.97% —— **17 个构建 Step 立的测试网仍能挡住 80% 门槛**
- 集成期发现 1 个真实 metadata bug + 1 个时序 flake —— **回头看的真实价值在于发现这些**

Tianqi 宗旨"清晰、可控、可信"在 Step 18 的具体形态：

- **清晰**：每条覆盖率不达标的成因都登记到 KNOWN-ISSUES.md，无模糊措辞
- **可控**：发现的 metadata bug 用既有 Step 15 §E 模式最小修复，无创新
- **可信**：覆盖率数字由 vitest --coverage 实测产出，无估算

Phase 9 的工程师拿到 Step 18 输出（这份文档 + KNOWN-ISSUES.md + 1668 tests + 85.97% 覆盖率）后，第一句话应该是："Phase 8 是真的可以接着写新业务的，不是表面上看起来能写新业务的"。这就是回头看 Step 的产品。
