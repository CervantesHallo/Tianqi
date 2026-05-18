# Tianqi Known Issues

本文件登记所有 Phase 未达项与显式遗留观察项。每条必须明确：

- **未达项 / 当前状态** — 实测数据或文字描述
- **修复责任 Phase** — 哪个 Phase 必须收紧此项
- **修复责任 Step**（若已确定）

按《Tianqi Phase 8–12 架构与代码规范补充文档》§2.1 第 5 条建立的"未达项必须显式登记"通道。Phase 8 由 Step 18 首次创建本文件。

---

## Phase 8 状态总览 — **CLOSED**（Step 19, 2026-04-26）

**Phase 8 CLOSED 二元判据 (§2.2)**：

- ✅ lint / typecheck / test 通过（1668 tests，1607 passed + 61 skipped）
- ✅ 契约测试通过（21 contract it × 5 业务 Engine + 1 基座 + 3 EventStore + 2 Notification + 2 Config 全部维持绿）
- ✅ 覆盖率达标（§9.3 80% lines/functions/statements + 75% branches gate）— lines 85.97% / functions 94.86% / statements 85.97% / branches 79.78%
- ✅ ADR 归档（`docs/decisions/0001-phase-8-adapter-layer.md`）

**Phase 8 整体覆盖率**：85.97% lines / 79.78% branches / 94.86% functions / 85.97% statements（运行 `pnpm test:coverage` 重现）。**整体超过 80%/75% 门槛**。

**Phase 8 三件产出（§12.2）齐备**：

- ✅ ADR 归档：`docs/decisions/0001-phase-8-adapter-layer.md`
- ✅ 新组件完整清单：`docs/phase8/19-phase-8-closure.md` §C
- ✅ 未解决问题清单：本文件（KI-P8-001/002/003/005 仍 open；KI-P8-004 已修复）

---

## Phase 8 显式登记的观察项

下列项目**不阻塞 Phase 8 CLOSED**（整体覆盖率达标），但 Step 18 实测发现并显式留痕，便于 Phase 9+ 收紧。

### KI-P8-001：domain 包行覆盖率 75.16%（低于单包 80% 期望，但整体达标）

- **当前**：`packages/domain/src/` lines 75.16% / branches 75.79% / functions 93.05%
- **Phase 9 / Step 17 实测复核（2026-05-02）**：**未改善**——Phase 9 后 domain 包覆盖率仍为 75.16% / 75.79% / 93.05%（与 Phase 8 baseline 完全一致）。原因：Phase 9 全程通过 §4.8 编译期硬约束（Step 15）严守 domain 不依赖 Port 原则；新增 16 个 Step 全部在 application / ports / adapters 层落地，**未触碰 domain 测试**。Phase 9 端到端集成测试（Step 16）位于 application/src/saga/，仅消费 domain enum 类型而非 domain class 算法，未通过运行时覆盖触发 domain 行覆盖率改善。**状态保持 open**。
- **缺口**：约 5 个百分点
- **主要缺口集中在**：
  - `risk-case-state-machine.ts` (lines 89.10%) — 部分未触发的失败转移路径
  - `risk-case.ts` (lines 71.73%) — 边界值校验路径未由现有测试触发
  - `liquidation-case.ts` (lines 73.45%) — 同上
  - `adl-case.ts` (lines 72.72%) — 同上
  - `case-audit-record.ts` (lines 53.70%) — 多处构造路径未覆盖
- **修复责任 Phase**：**Phase 13+ TBD**（**Phase 10 Kickoff 修正补丁，2026-05-02**——原标记 `Phase 10` 是 Phase 9 / Step 17 评估时的预期，但 Phase 10 主题专属"工程化与协作基础"（CI/CD + 协作资产 + 容器化 + 文档可执行 + 覆盖率门槛升级），与业务 domain 覆盖率改善无关。Phase 10 / Phase 11（真实基础设施）/ Phase 12（发布就绪）三阶段都不修业务覆盖率；KI-P8-001 应留待 Phase 13+ 业务能力延伸 Phase 修复——具体 Phase 待相关 Phase 起步指令承接。详见 ADR-0003 K.1 修正补丁段。）
- **修复责任 Step**：未确定（待 Phase 13+ 相关 Phase 起步指令承接）
- **备注**：domain 层是 Phase 1-7 冻结代码；Phase 8 + Phase 9 全程仅添加 Adapter / Engine Port / Saga 业务，未触碰 domain 测试；Phase 10 主题工程化非业务覆盖率改善（§1.2 直译边界）。诚实评估：Phase 9 没有 deliver KI-P8-001 修复；Phase 10 不在主题边界内；不为"关闭 KI"而牵强声明改善。

### KI-P8-002：external Adapter 包覆盖率受真实基础设施依赖限制

- **当前**（Phase 9 / Step 17 实测复核）：
  - `packages/adapters/event-store-postgres/src/` lines 33.8% — 21 contract it + 12 persistent it 在缺失 `TIANQI_TEST_POSTGRES_URL` 时全部 skipped
  - `packages/adapters/notification-kafka/src/` lines 47.41% — 18 contract it 在缺失 `TIANQI_TEST_KAFKA_BROKERS` 时全部 skipped
  - `packages/adapters/saga-state-store-postgres/src/` lines 40.7% — 13 contract + 8 persistent it skipped（Sprint F Step 3 引入）
  - `packages/adapters/dead-letter-store-postgres/src/` lines 37.97% — 14 contract + 8 persistent it skipped（Sprint F Step 4 引入）
- **Phase 9 引入的 2 个新 postgres adapter（saga-state-store / dead-letter-store）覆盖率分布与既有 event-store-postgres 一致**——CI 默认 skip 是结构性现象；本 Phase 9 阶段允许的状态延续（与 Phase 8 同精神）
- **缺口**：单包看 ≥ 30 个百分点；整体覆盖率仍达标（84.92% > 80%）
- **修复责任 Phase**：Phase 11（《§8.1 Mock 使用边界》明确 Phase 8 阶段允许 mock；Phase 11 起禁止 mock 必须使用真实基础设施）
- **修复责任 Step**：未确定（Phase 11 整体规划）
- **状态保持 open**（Phase 9 全程未触及；Step 16 端到端集成测试 A 仅 memory adapter 同精神）
- **备注**：本 Phase 8/9 阶段允许的状态。在 CI 中提供 `TIANQI_TEST_POSTGRES_URL` / `TIANQI_TEST_KAFKA_BROKERS` 环境变量后，这 4 个 Adapter（event-store-postgres / saga-state-store-postgres / dead-letter-store-postgres / notification-kafka）的覆盖率立刻提升至 90%+。

### KI-P8-003：契约测试套件 + 集成测试在高并发下偶发 flake

- **当前**：`pnpm test` 全套并行执行偶尔出现 1-3 个 flake，主要在以下三处：
  - `position-engine-http.contract.test.ts > test_open_circuit_rejects_calls_with_tq_inf_015_without_invoking_downstream`（依赖 100ms 级别熔断 reset 时序）
  - `phase6-final-close-decision.test.ts > full pipeline produces phase6_closed`
  - `phase7-final-acceptance.test.ts > full pipeline produces ready`
  - `notification-kafka.test.ts > test_connect_to_unreachable_brokers_rejects_with_tq_inf_kafka_broker_unreachable`（依赖 ECONNREFUSED 时序）
- **触发条件**：高并发执行（`pnpm test` 默认并行），CPU 抖动时偶发；隔离运行（单个文件）100% 通过
- **复现率**：~10-20%
- **Phase 9 / Step 17 实测复核（2026-05-02）**：Phase 9 累计 16 Step 实战中**未显式触发 flake**（Step 8 / Step 16 引入时序敏感测试时严格遵守 fast/slow ≥ 1:10 比例：50ms 自然耗时 vs 5ms 超时；Step 16 端到端集成测试套件单次运行 12ms，远小于 KI-P8-003 100ms 风险窗口）。**Phase 9 实战 0 显式 flake**——但**状态保持 open** 因为：(1) Phase 9 测试套件运行时间短（业务 saga 集成 12ms 量级），未充分压测时序敏感场景；(2) 真正的 flake 风险在 Phase 11 真实基础设施引入后；(3) KI 关闭应有更强证据。"Phase 9 实战 0 flake"作为状态注脚记录即可。
- **修复责任 Phase**：Phase 11（与 KI-P8-002 同期，因为真实 Kafka 接入会同步重写时序断言）
- **修复责任 Step**：未确定
- **备注**：本 flake 在 Phase 8 Step 18 之前已存在（基线 Step 17 也偶发），不是 Step 18 集成测试引入。Phase 9 全程通过 fast/slow ≥ 1:10 比例防御（Step 8 单 step 超时 + Step 16 端到端集成测试 it 3.1）。Phase 11 当 application 层使用 fake-timers 接入这些 Adapter 时可一并加固。

### KI-P8-004：Step 14 build metadata 根本性整理（test/ 迁 src/）— ✅ 已修复（Step 19）

- **状态**：**RESOLVED** — Step 19 完成根本性整理
- **历史背景**：5 业务 Engine Adapter（margin / position / match / mark-price / fund）+ 基座 external-engine-http-base 的 tsconfig.json 都用 `rootDir: "."` + `include: ["src/**/*.ts", "test/**/*.ts"]`，导致编译产物落到 `dist/src/`，需要 `package.json` 的 `main`/`types` 用 `dist/src/index.js` 这个绕路写法
- **Step 19 处置**：
  - 6 个 Adapter 包统一把 `test/*.ts` 迁到 `src/`（`*.test.ts` / `*.contract.test.ts` 直接平铺；helpers 子目录改为 `src/helpers/`）
  - tsconfig.json 改回 `rootDir: "src"` + `include: ["src/**/*.ts"]`，与 Sprint B-D 既有 Adapter 风格一致
  - package.json `main` / `types` 改回标准 `dist/index.js` / `dist/index.d.ts`
  - 测试文件内 `../src/<engine>.js` 改为 `./<engine>.js` 相对路径
  - vitest.config.ts coverage exclude 增加 `**/helpers/**` 让 src/helpers/ 的 mock 工具不计入覆盖率
- **修复后实测**：1668 tests 全绿（数量不变）；覆盖率 85.97% lines / 79.78% branches（与 Step 18 基线持平）
- **修复责任 Phase / Step**：Phase 8 / Step 19（按计划闭合）

### KI-P8-005：ports/src 行覆盖率局部改善（结构性现象延续）

- **当前**（Phase 9 / Step 17 实测复核）：`packages/ports/src/` lines **11.96%** / branches 100% / functions 100%（Phase 8 baseline 0%；Phase 9 实测 11.96%——**局部改善 +11.96pp**）
- **改善来源**：Phase 9 引入 3 个新 Port（saga-port / saga-state-store-port / dead-letter-store-port），其中 `saga-port.ts` lines **100%**（Sprint F Step 1 锁定的 brand 工厂 createSagaId / createCorrelationId 等被 saga-port.test.ts + 4 业务 saga 单元测试 + 端到端集成测试间接覆盖）
- **原因**：ports 包大部分仍是 TypeScript `interface` / `type` 声明，编译产物完全擦除（zero-runtime types），coverage 工具看到的是几行 brand constructor 函数体；这些函数体由 ports 包消费方的测试间接覆盖。Phase 9 引入的 3 个新 Port 中只有 saga-port.ts 完整覆盖；其他 2 个 port 文件 brand 工厂被部分覆盖。
- **修复责任 Phase**：N/A（结构性现象，无需修复）
- **状态保持 open + 注脚 Phase 9 局部改善**（α 选项；α 既诚实表述局部改善，又不为"关闭 KI"而牵强声明结构性现象已解决）
- **备注**：ports 行覆盖 11.96% 不影响整体行覆盖率达标（84.92%）。如未来 Phase 10+ 在 ports 内放更多 runtime 函数（不推荐），届时再评估。本项登记仅为澄清覆盖率报告中 11.96% 数字的语义——大部分 ports 文件仍是 type-only export，brand 工厂被消费方间接覆盖。

---

## Phase 9 状态总览（Step 17 实测，2026-05-02）

**Phase 9 累计 16 Step 后总覆盖率**（vs Phase 8 baseline 85.97%/79.78%/94.86%/85.97%）：

- Lines: 84.92% (-1.05pp)
- Branches: 79.57% (-0.21pp)
- Functions: 91.68% (-3.18pp)
- Statements: 84.92% (-1.05pp)

**全部仍超 §9.3 红线**（80%/75%/80%/80%）。Phase 8 → Phase 9 覆盖率轻微下行的根因：Phase 9 引入 2 个新 postgres adapter（saga-state-store-postgres / dead-letter-store-postgres）+ 3 个新 Port（saga-port / saga-state-store-port / dead-letter-store-port）+ 大量 application 层 saga 业务代码。其中 postgres adapter 在 CI 默认 skip（KI-P8-002 延续），ports 部分仍以 type-only export 为主（KI-P8-005 结构性现象），是覆盖率下行的主因。**Phase 9 业务 saga 模块全部 > 80% lines 覆盖**（saga-orchestrator 90.41% / saga-manual-intervention 89.51% / liquidation-saga 87.25% / adl-saga 86.44% / insurance-fund-saga 85.45% / state-transition-saga 85.29% / **cross-saga-coordination 97.84%**）。

### KI-P9-001：StateTransition Saga 状态机数据副本与 domain transitionRules 漂移监控

- **当前状态**：Phase 9 / Step 13 引入 `packages/application/src/saga/state-transition-saga.ts` 内部维护 `stateTransitionRules` 数据副本（从 domain 层 `risk-case-state-machine.ts` 的 `transitionRules` 派生）；Saga 侧独立维护副本是**裁决 4 A 的成本**（避免修改 domain export 表面 + §4.8 编译期硬约束严守 + 元规则 B 严守）
- **风险**：未来某个 Phase 修改 domain 层 `transitionRules`（譬如新增状态或转换路径）但忘记同步 Saga 侧副本，会导致：
  - Saga 内部状态机校验逻辑与 domain 实际状态机不一致
  - 业务流程在合法转换上失败（false negative）或在非法转换上通过（false positive）
- **监控建议**：
  - Phase 10+ 任何修改 `packages/domain/src/risk-case-state-machine.ts` 的 PR 必须在 PR description 明示是否同步更新了 `state-transition-saga.ts` 的数据副本
  - Phase 10+ 引入 ESLint 自定义规则或 CI 检查（譬如 grep 比对两个文件的状态/动作字面量集合）
  - 长期：考虑把 transitionRules 提取到 shared 包让 domain + saga 共享同一数据源（违反元规则 B 的代价 vs 漂移风险的代价权衡）
- **修复责任 Phase**：Phase 10+（持续监控）；具体修复路径由 Phase 10 引入第 5 个业务 Saga 或修改 domain transitionRules 时触发评估
- **修复责任 Step**：未确定
- **备注**：这不是 Phase 9 的 bug——是裁决 4 A 的明示成本（详见 ADR-0002 Step 13 段）。本 KI 仅为持续监控目的登记；ADR-0002 已留痕"未来 domain 变化由 ADR 修订流程同步"。Phase 9 实测：domain transitionRules 与 Saga 副本完全一致（基于 grep 实测）。

---

## Phase 10 显式登记的观察项

### KI-P10-001：Phase 9 closure 隐藏的 typecheck 缺陷（Phase 10 / Step 0 责任修复）— ✅ 已修复（Step 0）

- **状态**：**RESOLVED**（Phase 10 / Step 0 完成修复，2026-05-02）
- **关闭日期**：2026-05-02
- **关闭依据**：Phase 10 / Step 0 修复 saga-end-to-end.integration.test.ts mock fixture 5 处字段不匹配；4 项独立命令实测全 PASS（lint zero / typecheck zero / 1971 tests / coverage 84.92%/79.57%/91.68%/84.92%）—— 双重证据（修复 commit + 4 项命令 PASS）
- **关闭 commit**：[Step 0 fix commit；详见 docs/phase10/01-step-0-typecheck-remediation.md §G]
- **历史登记**（保留供未来参考）：
- **发现于**：Phase 10 Kickoff PHASE_IMPLEMENT 阶段实测 `pnpm typecheck` 失败；双重证据（git stash my docs changes + git checkout origin/main HEAD `c9ebe88`）确认错误**预存在于 Phase 9 / Step 19 final commit**，本 Kickoff 0 引入 0 消除
- **位置**：`packages/application/src/saga/saga-end-to-end.integration.test.ts`（Phase 9 / Step 16 commit `22f8a21` 创建；620 LOC；4 测试类 8 it）
- **错误明细**（10+ 处 mock builder 字段与 Engine Port 响应类型不匹配）：

| 行 | 错误 | 应修复 |
|---|---|---|
| 146 | `MarkPriceQuote` 不含 `queriedAt` 字段（应只在 `QueryMarkPriceBatchResponse` 顶层）| 移除批量响应中 quote 内的 `queriedAt` |
| 195-199 | `ClosePositionResponse` 不含 `accountId` / `symbol`；`ClosePositionRequest` 不含 `accountId` / `symbol` | 修复 mock builder 字段 |
| 312-316 | `QueryMarginBalanceResponse` 应含 `availableMargin` / `lockedMargin` / `totalMargin`（而非 `availableBalance` / `lockedBalance`）| 重写 mock margin balance 字段集 |
| 330-336 | `QueryFundBalanceResponse` 应含 `totalBalance` / `frozenBalance`（而非 `availableBalance` / `queriedAt`）| 重写 mock fund balance 字段集 |
| 429 | `DeleveragingTarget` 不含 `reduceQuantity` | 修复字段名（依 port 定义实测）|

- **影响**：
  - `vitest run` 测试**通过**（vitest 默认不严格 typecheck 测试文件，type-erasure 阶段忽略类型不匹配）
  - `tsc -b tsconfig.json`（标准 typecheck 命令）**失败**——10+ 处 TS2339 / TS2322 / TS2353 / TS1360 / TS2353
  - `pnpm lint` / `pnpm test` / `pnpm test:coverage` 全绿：Phase 9 closure baseline 数据完整保留
- **根因**：Phase 9 / Step 17/18/19 closure 验证执行报告显示 "lint zero / 1971 tests 维持 / coverage 84.92%/79.57%/91.68%/84.92%"——**未明示 `pnpm typecheck` 实测结果**，Phase 9 closure 验证流程实际未含独立 typecheck 步骤；vitest 不严格 typecheck 让缺陷在 Step 16 commit 时未被立即捕获，后续 Step 17/18/19 仅做文档变更未触发 typecheck 重新评估
- **修复责任 Phase**：**Phase 10**
- **修复责任 Step**：**Phase 10 / Step 0**（**Phase 9 closure typecheck remediation**——独立 Step；Step 0 在 Step 1 / 2 之前执行；让 Step 1 / 2 在干净 baseline 上工作；单一职责修复 + 撰写"Phase closure typecheck 防御"指引）
- **防御机制**（Phase 10 / Step 3 完成后生效）：
  - Phase 10 / Step 3 CI 强制门禁含 typecheck（独立验证；不依赖 vitest 顺带类型擦除）
  - Phase 10 元规则 Q v3 强制开局动作模板要求**全量验证含 4 项独立命令**（lint / typecheck / test / coverage 各自独立执行），不允许用单一命令的"顺带验证"替代独立 typecheck 验证
  - 未来 Phase 收官 Step 起草指令必须明示"closure 验证含 4 项独立命令实测输出"硬底（Phase 9 closure 教训的工程化沉淀）
- **协作教训留痕**：Phase 9 / Step 17/18/19 起草指令在硬底中**未明确要求"独立 typecheck 验证"**；AI 跑 `pnpm test:coverage` 顺带验证类型，让 vitest 宽松类型检查掩盖了缺陷；这是协作 prompt 设计的疏漏，由 Phase 10 元规则 Q 模板更新承接补救
- **备注**：本 KI 与 Step 0 责任协调而非冗余——KI 提供持续跟踪机制（修复后 KI 关闭由 Step 0 执行报告确认），Step 0 提供具体修复任务定义；防御机制（Step 3 CI + 元规则 Q v3 模板）确保未来不重复

### KI-P10-002：monorepo dist-based workspace test 依赖 build 而 test script 不显式调用（Phase 10 / Step 3.5 责任修复）

- **状态**：open（Phase 10 / Step 3.5 修复中）
- **发现于**：Phase 10 / Step 3 PR #5 CI 第一次运行（2026-05-02）；Run #1（pull_request 触发）+ Run #2（push to main 触发）均失败
- **位置**：root `package.json` scripts + `.github/workflows/ci.yml` test/coverage job
- **错误明细**：fresh checkout 下 `pnpm test` 失败 144/182 test files；vite import-analysis 错误（找不到 `@tianqi/<pkg>` 的 dist 入口）
- **根因**：
  - workspace 包 `package.json` `main: dist/index.js`（dist-based publish 模式）
  - root `package.json` 无 `build` script；ci.yml test/coverage job 不含 build 步
  - `tsc -b` 增量构建依赖 `.tsbuildinfo`；删 dist 不删 .tsbuildinfo 时 tsc 判 "up to date" 跳过 emit
  - CI fresh checkout 无 dist 残留 → vite import-analysis 失败
  - 本地长期有 dist 残留 → contributors 几乎不会主动删它 → 从未触发"找不到 dist"路径

**关键工程纪律边界**（用户 v3 补充 3 措辞校正）：

Phase 1-9 测试不是伪绿色——是真过的，但只在"恰好有 dist/"的环境过。这不是 Phase 1-9 work 的污名，而是**"未在干净环境验证过的真绿色"**。CI 第一次启用揭露这个未覆盖路径，是 Phase 10 工程化基础设施的合理价值。

- **修复责任 Phase**：Phase 10
- **修复责任 Step**：Phase 10 / Step 3.5（修复方案 C；用户 v3 锁定）
- **防御机制**：
  - ci.yml test + coverage 两 job 显式 `pnpm build` 步骤（裁决 3 A）
  - root `package.json` 添加 `build` script（封装 `tsc -b tsconfig.json`）
  - **`pnpm test` / `pnpm test:coverage` 依赖 `pnpm build`**（裁决 2 β；防御补强；实测 fresh build 增量 0.28s ≤ 2s 阈值）
  - CONTRIBUTING.md `## Mandatory Validation` 段前置 `pnpm install + pnpm build`
  - docs/closure-checklist.md 同步追加 fresh checkout 验证防御段
- **长期监控**（触发任一阈值时启动方案 D 升级评估）：
  - fresh build 时长 > 5 秒 → 触发升级评估（当前实测 5.02s 已逼近）
  - dev cycle 增量 build 时长 > 2 秒 → 触发评估（当前实测 0.28s）
  - monorepo workspace 包数 > 50 → 触发评估（当前 25 包）
  - contributors 数 > 5 → 触发评估
  - 升级路径：方案 D（src-based dev/test；conditional exports）在 Phase 13+ 评估
- **关联教训（双层缺陷链）**：
  - KI-P10-001（typecheck 层；Step 0 RESOLVED）+ KI-P10-002（packaging 层；Step 3.5 修复）共属"Phase 9 closure 工程教训"双层缺陷链
  - Step 0 修复 vitest type-erasure 绕过的 typecheck 缺陷
  - Step 3.5 修复 dist-based workspace 在 fresh checkout 下不工作的 packaging 缺陷
  - 两者共同价值：Tianqi 从"未在干净环境验证过的真绿色"升级到"干净环境真绿色"成熟度
- **Step 3 工程价值确认（forward-looking）**：
  Step 3 自身工程价值远高于"协作工作流自动化"——CI 第一次启用作为干净环境的强制验证，揭露了 Phase 1-9 全程从未触发的未覆盖路径。Step 3.5 修复完成 + main 真正绿后，Tianqi 进入"干净环境真绿色"成熟度。

---

## Resolved Known Issues (Phase 10 Closed, 2026-05-13)

> **2026-05-18 校正补丁**（Phase 11 Kickoff v3 §B.1.B 第 4 层防御机制）：本段原标 "Phase 10 Closed, 2026-05-05" 为 Step 7 PHASE_IMPLEMENT 完成日（撰写时锁定）。真实 CLOSED 仪式日期 **2026-05-13**（PR #10 merge `cc74da3` + main CI 4/4 PASS + `phase-10-closed` tag `ab70043` push + release.yml 第一次真实运行 + GitHub Release published；间隔 8 天）。KI-P10-001/002 的 RESOLVED 日期不受影响（KI 修复发生在 Step 0 / Step 3.5 PHASE_IMPLEMENT 期间，早于 CLOSED 仪式）。详见 ADR-0004 §B.1.B。

### KI-P10-001 — typecheck layer (Phase 9 closure 隐藏的 typecheck 缺陷)

- **Status**: ✅ RESOLVED (Phase 10 / Step 0; 2026-05-02)
- **Fix commit reference**: see `docs/phase10/01-step-0-typecheck-remediation.md`
- **Resolution summary**: saga-end-to-end.integration.test.ts 中 10 处 mock builder 字段与 Engine Port 类型对齐（修复策略 α 测试 fixture 调整；不修改 Engine Port 锁定签名）。Step 0 同步建立 `docs/closure-checklist.md` + 元规则 Q v3 模板含 4 项独立命令实测输出 — 防御机制让未来 closure 不重蹈类似覆辙。

### KI-P10-002 — packaging layer (monorepo dist-based workspace 在 fresh checkout 下不工作)

- **Status**: ✅ RESOLVED (Phase 10 / Step 3.5; 2026-05-04)
- **Fix commit reference**: see `docs/phase10/05-step-3-5-test-chain-fix.md`
- **Resolution summary**: root `package.json` 增加 `build` script + test script 依赖 `pnpm build` (β 防御补强) + ci.yml test/coverage job 显式 `pnpm build` 步 + CONTRIBUTING ## Mandatory Validation 段前置 install + build + closure-checklist 追加 fresh-checkout 防御段。**双层缺陷链双层修复完成**（KI-P10-001 typecheck 层 + KI-P10-002 packaging 层）；Tianqi 进入"干净环境真绿色"成熟度。

---

## 历史 Phase 状态

Phase 1-7：本文件由 Phase 8 / Step 18 首次创建，未追溯登记历史 Phase 项。Phase 9+ 起增量维护。
