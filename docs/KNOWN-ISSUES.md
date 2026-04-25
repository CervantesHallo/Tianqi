# Tianqi Known Issues

本文件登记所有 Phase 未达项与显式遗留观察项。每条必须明确：

- **未达项 / 当前状态** — 实测数据或文字描述
- **修复责任 Phase** — 哪个 Phase 必须收紧此项
- **修复责任 Step**（若已确定）

按《Tianqi Phase 8–12 架构与代码规范补充文档》§2.1 第 5 条建立的"未达项必须显式登记"通道。Phase 8 由 Step 18 首次创建本文件。

---

## Phase 8 状态总览

**Phase 8 CLOSED 二元判据 (§2.2)**：

- ✅ lint / typecheck / test 通过 — Step 17 落地，Step 18 维持（1668 tests，1607 passed + 61 skipped）
- ✅ 契约测试通过 — Step 17 落地，Step 18 跨 Adapter 集成验证维持
- ✅ 覆盖率达标（§9.3 80% lines/functions/statements + 75% branches gate） — Step 18 实测：lines 85.97% / functions 94.86% / statements 85.97% / branches 79.79%
- ⏳ ADR 归档 — Step 19 职责

**Phase 8 整体覆盖率**：85.97% lines / 79.79% branches / 94.86% functions / 85.97% statements（运行 `pnpm test:coverage` 重现）。**整体超过 80%/75% 门槛**。

---

## Phase 8 显式登记的观察项

下列项目**不阻塞 Phase 8 CLOSED**（整体覆盖率达标），但 Step 18 实测发现并显式留痕，便于 Phase 9+ 收紧。

### KI-P8-001：domain 包行覆盖率 75.16%（低于单包 80% 期望，但整体达标）

- **当前**：`packages/domain/src/` lines 75.16% / branches 75.79% / functions 93.06%
- **缺口**：约 5 个百分点
- **主要缺口集中在**：
  - `risk-case-state-machine.ts` (lines 89.10%) — 部分未触发的失败转移路径
  - `risk-case.ts` (lines 71.73%) — 边界值校验路径未由现有测试触发
  - `liquidation-case.ts` (lines 73.45%) — 同上
  - `adl-case.ts` (lines 72.72%) — 同上
  - `case-audit-record.ts` (lines 53.70%) — 多处构造路径未覆盖
- **修复责任 Phase**：Phase 9
- **修复责任 Step**：未确定（建议 Phase 9 早期 Step 增补 domain 边界测试）
- **备注**：domain 层是 Phase 1-7 冻结代码；Phase 8 仅添加 Adapter / Engine Port，未触碰 domain 测试。Phase 9 引入新业务流时应同步补 domain 边界覆盖。

### KI-P8-002：external Adapter 包覆盖率受真实基础设施依赖限制

- **当前**：
  - `packages/adapters/event-store-postgres/src/` lines 40.71% — 21 contract it + 12 persistent it 在缺失 `TIANQI_TEST_POSTGRES_URL` 时全部 skipped
  - `packages/adapters/notification-kafka/src/` lines 47.42% — 18 contract it 在缺失 `TIANQI_TEST_KAFKA_BROKERS` 时全部 skipped
- **缺口**：单包看 ≥ 30 个百分点；整体覆盖率仍达标
- **修复责任 Phase**：Phase 11（《§8.1 Mock 使用边界》明确 Phase 8 阶段允许 mock；Phase 11 起禁止 mock 必须使用真实基础设施）
- **修复责任 Step**：未确定（Phase 11 整体规划）
- **备注**：本 Phase 8 阶段允许的状态。在 CI 中提供 `TIANQI_TEST_POSTGRES_URL` / `TIANQI_TEST_KAFKA_BROKERS` 环境变量后，这两个 Adapter 的覆盖率立刻提升至 90%+。

### KI-P8-003：契约测试套件 + 集成测试在高并发下偶发 flake

- **当前**：`pnpm test` 全套并行执行偶尔出现 1-3 个 flake，主要在以下三处：
  - `position-engine-http.contract.test.ts > test_open_circuit_rejects_calls_with_tq_inf_015_without_invoking_downstream`（依赖 100ms 级别熔断 reset 时序）
  - `phase6-final-close-decision.test.ts > full pipeline produces phase6_closed`
  - `phase7-final-acceptance.test.ts > full pipeline produces ready`
  - `notification-kafka.test.ts > test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable`（依赖 ECONNREFUSED 时序）
- **触发条件**：高并发执行（`pnpm test` 默认并行），CPU 抖动时偶发；隔离运行（单个文件）100% 通过
- **复现率**：~10-20%
- **修复责任 Phase**：Phase 9 或 Phase 11（与 KI-P8-002 同期，因为真实 Kafka 接入会同步重写时序断言）
- **修复责任 Step**：未确定
- **备注**：本 flake 在 Step 18 之前已存在（基线 Step 17 也偶发），不是 Step 18 集成测试引入。Step 18 添加的 5 个并发 mock HTTP server 提高了暴露概率，但根因是契约测试本身对 100ms 级别时序的敏感度。Phase 9+ 当 application 层使用 fake-timers 接入这些 Adapter 时可一并加固。

### KI-P8-004：Step 14 build metadata 根本性整理（test/ 迁 src/）

- **当前**：5 业务 Engine Adapter（margin / position / match / mark-price / fund）+ 基座 external-engine-http-base 的 tsconfig.json 都用 `rootDir: "."` + `include: ["src/**/*.ts", "test/**/*.ts"]`，导致编译产物落到 `dist/src/`，需要 `package.json` 的 `main`/`types` 用 `dist/src/index.js` 这个绕路写法
- **当前缓解**：Step 15 已修补 external-engine-http-base 的 main/types；Step 18 顺手修补 margin-engine-http（之前漏了），其它 4 个业务 Engine 创建时即已用正确路径
- **理想形态**：把 test/ 目录迁到 src/**tests**/ 或类似，使 rootDir 回归 src/，main 写 `dist/index.js`
- **修复责任 Phase**：Phase 8
- **修复责任 Step**：Step 19（Phase Gate 一并整理，《Step 18 指令》§九 已预告）
- **备注**：纯结构性整理，不影响行为契约。Step 19 收官时统一处理。

### KI-P8-005：ports/src 行覆盖率 0%（结构性原因）

- **当前**：`packages/ports/src/` lines 0% / branches 100% / functions 100%
- **原因**：ports 包大部分是 TypeScript `interface` / `type` 声明，编译产物完全擦除（zero-runtime types），coverage 工具看到的是几行 brand constructor 函数体；这些函数体由 ports 包消费方的测试间接覆盖
- **修复责任 Phase**：N/A（结构性现象，无需修复）
- **备注**：ports 行覆盖 0% 不影响整体行覆盖率达标（85.97%）。如未来 Phase 9+ 在 ports 内放更多 runtime 函数（不推荐），届时再评估。本项登记仅为澄清 Step 18 报告中 0% 数字的语义。

---

## 历史 Phase 状态

Phase 1-7：本文件由 Phase 8 / Step 18 首次创建，未追溯登记历史 Phase 项。Phase 9+ 起增量维护。
