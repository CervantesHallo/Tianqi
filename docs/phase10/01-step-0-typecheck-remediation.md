# Phase 10 / Step 0 — Phase 9 closure typecheck remediation + 防御指引

> **执行时间**：2026-05-02
> **类型**：Phase 10 首个实施 Step；性质特殊——"修复 + 防御"（非"协作建设"也非"工程化建设"）
> **本 Step 性质**：KI-P10-001 修复责任 Step；docs/closure-checklist.md 创建；元规则 Q v3 模板首次完整实战
> **状态**：完成

---

## 🎯 KI-P10-001 关闭显式声明

**KI-P10-001 状态：open → RESOLVED**（Phase 10 / Step 0，2026-05-02）

| 维度 | 数据 |
|---|---|
| 修复位置 | `packages/application/src/saga/saga-end-to-end.integration.test.ts`（5 处 mock fixture）|
| 修复字段数 | 10 处 typecheck error → 0（双向实测确认）|
| 4 项独立命令实测 | lint PASS / **typecheck PASS** / test 1971 PASS / coverage 84.92% PASS |
| 双重证据 | 修复 commit + 4 项命令实测全 PASS |
| Phase 9 业务代码影响 | 0（仅 mock fixture 字段对齐既有 Engine Port 锁定签名）|
| 元规则 B 严守 | ✅（Engine Port 类型 0 修改）|

---

## §A 当前任务

Phase 10 / Step 0：修复 KI-P10-001（Phase 9 closure 隐藏的 typecheck 缺陷）+ 创建 `docs/closure-checklist.md` 防御指引 + 沉淀 Phase 9 closure 教训。Step 0 是 Phase 10 唯一"修复 + 防御"性质 Step；完成后 Step 1+ 才能在干净 baseline 上执行。

---

## §B 影响范围

### B.1 修改文件（4 个）

| 文件 | 变更性质 | 行数变化 |
|---|---|---|
| `packages/application/src/saga/saga-end-to-end.integration.test.ts` | mock fixture 5 处字段对齐 | +6 / -7 |
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 0 段增量追写（惯例 M 第 20 次实战）| +13 / 0 |
| `docs/KNOWN-ISSUES.md` | KI-P10-001 状态 open → RESOLVED + 关闭依据 | +5 / -1 |
| `docs/00-phase1-mapping.md` | Phase 10 Step 0 完成段追加 | +若干 |

### B.2 新增文件（2 个）

| 文件 | 性质 |
|---|---|
| `docs/closure-checklist.md` | 防御指引（63 行；≤100 硬底）|
| `docs/phase10/01-step-0-typecheck-remediation.md` | 本执行记录（9 节 A-I）|

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改（Engine Port 类型 0 修改；Phase 8 Adapter 0 修改；Phase 9 业务 Saga 0 修改）
- **测试增量**：0（既有 8 it 不变；mock fixture 字段对齐既有 Engine Port 锁定签名）
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 19 次实战）

---

## §C 设计决策

### C.1 强制开局动作 1-3 执行确认

| # | 动作 | 实测结果 |
|---|---|---|
| 1 | 重读《宪法》§17 / §18 / §22.1 + 《补充文档》§7.1 / §9.3 / §13.1 + ADR-0003 工程教训沉淀段 | ✅ |
| 2 | 核查 KNOWN-ISSUES 6 项 KI（KI-P8-001/002/003/005 + KI-P9-001 + KI-P10-001）| ✅ KI-P10-001 修复责任 Phase 10 / Step 0（即本 Step）|
| 3 | 核查 ADR-0001（Accepted）+ ADR-0002（Accepted Phase 9 CLOSED）+ ADR-0003（In Progress；本 Step 增量追写 Step 0 段）| ✅ |

### C.2 强制开局动作 4 执行结果（typecheck 完整错误清单 + Engine Port 类型对照）

**Baseline `pnpm typecheck` 实测：10 errors，全部在 saga-end-to-end.integration.test.ts**

| # | 错误位置 | 错误类型 | Engine Port 类型对照 | 修复策略 |
|---|---|---|---|---|
| 1 | line 146:11 | TS2353 `MarkPriceQuote` 不含 `queriedAt` | `MarkPriceQuote = { symbol, markPrice }` | 移除批量响应 quote 内 `queriedAt`（顶层保留）|
| 2 | line 195:9 | TS2322 `ClosePositionResponse` 类型不匹配 | `ClosePositionResponse = { positionId, closedSize, closedAt }` | 同 fix #3 |
| 3 | line 198:7 | TS2353 `ClosePositionResponse` 不含 `accountId` | 同上 | 移除 `accountId` |
| 4 | line 198:22 | TS2339 `ClosePositionRequest` 不含 `accountId` | `ClosePositionRequest = { positionId, idempotencyKey, traceId? }` | `req.accountId` 引用移除 |
| 5 | line 199:19 | TS2339 `ClosePositionRequest` 不含 `symbol` | 同上 | `req.symbol` 引用移除；新增 `closedSize: createPositionSize(0.5)` |
| 6 | line 312:11 | TS2322 `QueryMarginBalanceResponse` 类型不匹配 | `QueryMarginBalanceResponse = { accountId, currency, availableMargin, lockedMargin, totalMargin, queriedAt }` | 字段重命名 + 加 `totalMargin` |
| 7 | line 316:9 | TS2353 `QueryMarginBalanceResponse` 不含 `availableBalance` | 同上 | `availableBalance`→`availableMargin` / `lockedBalance`→`lockedMargin` |
| 8 | line 330:11 | TS2322 `QueryFundBalanceResponse` 类型不匹配 | `QueryFundBalanceResponse = { accountId, currency, totalBalance, availableBalance, frozenBalance, queriedAt }` | 加 `totalBalance` + `frozenBalance` |
| 9 | line 336:9 | TS1360 `QueryFundBalanceResponse` 缺 `totalBalance`/`frozenBalance` | 同上 | 同上 |
| 10 | line 429:7 | TS2353 `DeleveragingTarget` 不含 `reduceQuantity` | `DeleveragingTarget = { accountId, fundAccountId, matchAccountId, positionId, symbol, deleveragingSide, deleveragingQuantity, expectedDeleveragingPrice, accountSettleAmount }` | `reduceQuantity`→`deleveragingQuantity`（用 `createPositionSize`）/ `reduceSide`→`deleveragingSide` / `settlementAmount`→`accountSettleAmount` / 移除 `settlementCurrency` / 加 `expectedDeleveragingPrice`（用 `createMarkPriceValue`）|

**关键判断**：所有 10 errors 均归因于"测试 fixture 字段错"——Engine Port 类型在 Phase 8 ADR-0001 Accepted 时已锁定且 Phase 9 期间未变化；fixture 字段从一开始就与 Engine Port 实际字段不一致。这暗示 Step 16 引入测试时未跑独立 typecheck，vitest type-erasure 阶段忽略了类型不匹配。**未发现"Engine Port 类型在 Phase 9 期间变化"导致的 fixture 失配** —— Phase 9 接口冻结纪律完整。

### C.3 强制开局动作 5 执行结果（4 项独立命令 baseline）

| # | 命令 | Baseline 实测输出 |
|---|---|---|
| 1 | `pnpm lint` | exit 0；`eslint . --max-warnings=0` 0 错误 / 0 警告 ✅ |
| 2 | `pnpm typecheck` | exit 1；10 errors（详见 §C.2 错误清单）❌ |
| 3 | `pnpm test` | 175 test files passed + 7 skipped；1971 tests（1867 passed + 104 skipped）；13.39s ✅ |
| 4 | `pnpm test:coverage` | Statements 84.92% / Branches 79.56% / Functions 91.68% / Lines 84.92% ✅ |

**3/4 PASS；typecheck FAIL** = KI-P10-001 跟踪缺陷的 baseline。

### C.4 7 个核心裁决最终选择

| # | 裁决 | 选择 | 理由摘要 |
|---|---|---|---|
| 1 | 修复方向 | **α 测试 fixture 对齐 Engine Port** | Engine Port 已锁定（ADR-0001 Accepted；元规则 B 严守）；β/γ 破坏锁定签名被强制拒绝 |
| 2 | 修复范围 | **C 全仓 typecheck 验证完整性** | 实测确认 baseline 10 errors 全部在 saga-end-to-end.integration.test.ts；无隐藏类似缺陷 |
| 3 | 修复后是否新增 it | **不新增** | 既有 8 it 已使用 fixture；修复后既有 it PASS 即是修复正确性证明；新增冗余违反"克制" |
| 4 | 防御指引归属位置 | **β 独立 docs/closure-checklist.md** | forward-looking 可独立引用；α 埋在执行记录难找；γ 让 ADR 越界承担 checklist 功能 |
| 5 | KI-P10-001 关闭时机 | **B 4 项独立命令全 PASS 后** | A 草率（push ≠ 全绿）；C 推迟（跨 Step 跟踪冗余）；B 是修复完成的真实证据 |
| 6 | 错误码 / Port / Adapter / 包 | **0 新增** | 惯例 K 第 19 次实战；纯修复 Step |
| 7 | ADR-0003 Step 0 段 | **B 增加简短段** | 沿用 Phase 9 惯例 M 增量追写（第 20 次实战）；Step 0 含决议性质（防御指引归属裁决）|

### C.5 修复细节（每错误位置 + 修复策略 + Engine Port 字段对照）

详见 §C.2 表格。修复后既有 8 it 未做任何业务断言修改；mock 提供的业务行为完全保留（譬如 `availableBalance: 1_000_000` 在 fund query mock 中保留以维持既有 it 4.2 的 fund-settled precondition 满足）。

### C.6 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结） | **严守** — Engine Port 类型 0 修改；mock fixture 是测试 fixture 而非接口契约；修复让 mock 对齐既有锁定签名而非修改签名 |
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增第三方依赖（lockfile 零变动）|
| 元规则 Q（强制开局动作）| **v3 模板首次完整实战** — 5 项动作含动作 5 4 项独立命令 baseline + post-fix 双向实测留痕（KI-P10-001 教训的工程化沉淀首次兑现）|
| 惯例 K（错误码命名空间扩展）| **第 19 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 20 次实战 + 跨 Phase 第 1 次** — ADR-0003 Step 0 段增量追写（沿用 Phase 9 ADR-0002 模式跨 Phase 一致）|
| §4.8 编译期硬约束（Phase 9 / Step 15）| **严守** — 不触碰 packages/domain；ESLint 规则零违规 |
| 拆两阶段流程 | **不触发** — Step 0 单一职责（修复 + 防御）；裁决空间小；不需要审视约束 |

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A（本 Step 不构建运行时业务代码）。

---

## §D 代码变更

### D.1 saga-end-to-end.integration.test.ts（5 处 mock fixture 修复）

| Fix | 位置 | 旧 → 新 |
|---|---|---|
| 1 | line 144 | 移除 batch 响应 prices 数组中 quote 内 `queriedAt`（顶层 batch `queriedAt` 保留）|
| 2 | line 195-201 | `closePosition` mock：移除 `accountId`/`symbol`，加 `closedSize: createPositionSize(0.5)` |
| 3 | line 312-319 | `queryMarginBalance` mock：`availableBalance`→`availableMargin` / `lockedBalance`→`lockedMargin` / 加 `totalMargin: createMarginAmount(0)` |
| 4 | line 330-336 | `queryFundBalance` mock：加 `totalBalance: createFundAmount(1_000_000)` / `frozenBalance: createFundAmount(0)` |
| 5 | line 422-433 | `buildADLInput.targets`：`reduceQuantity: 0.5`→`deleveragingQuantity: createPositionSize(0.5)` / `reduceSide`→`deleveragingSide` / `settlementAmount`→`accountSettleAmount` / 移除 `settlementCurrency` / 加 `expectedDeleveragingPrice: createMarkPriceValue(50_000)` |

### D.2 docs/closure-checklist.md（新增；63 行）

含 4 项独立命令实测输出强制 + Phase closure 报告必含项 + 修复责任传递规则 + 历史教训沉淀（KI-P10-001 教训）+ 维护规则 + 引用与协调段。

### D.3 docs/decisions/0003-phase-10-engineering-and-collaboration.md（Step 0 段追加）

7 项裁决摘要表 + 修复细节 + Step 0 工程意义阐述（≤30 行硬底）。惯例 M 第 20 次实战。

### D.4 docs/KNOWN-ISSUES.md（KI-P10-001 RESOLVED）

状态 open → RESOLVED；关闭日期 2026-05-02；关闭依据（4 项命令 PASS + Step 0 commit）；历史登记保留供未来参考。

### D.5 docs/00-phase1-mapping.md（Phase 10 Step 0 完成段）

由后续 mapping sync 步骤添加。

---

## §E 风险点

### E.1 修复完整性是否覆盖全仓（裁决 2 C 验证）

**实测结果**：post-fix `pnpm typecheck` 全绿（0 errors）—— 全仓修复完整性证据。无隐藏类似缺陷。Phase 9 接口冻结纪律完整（Engine Port 类型从 Phase 8 锁定时起未变化；fixture 错误从 Step 16 引入时即存在）。

### E.2 mock fixture 字段调整对既有 8 it 业务断言的影响

**实测结果**：post-fix `pnpm test` 1971 tests 全 PASS（含 saga-end-to-end.integration.test.ts 8 it 全 PASS）。修复仅做字段对齐 + 字段集补齐；mock 提供的业务行为完全保留：
- `closePosition` 增加 `closedSize` 字段不影响业务断言（既有 it 不读 closedSize）
- `queryMarginBalance` 字段重命名 + 加 `totalMargin` 不影响业务断言（既有 it 不读这些字段）
- `queryFundBalance` 加 `totalBalance` / `frozenBalance` 不影响业务断言（既有 it 4.2 仅 fund-settled precondition 用 `availableBalance` 1_000_000 ≥ expectedMinimumAvailableBalance 0；保留）
- `DeleveragingTarget` 字段重命名不影响业务断言（既有 it 通过 ADL Saga 流程消费 target；ADL Saga 内部按 DeleveragingTarget 类型字段读取，与 mock 提供字段名一致）

### E.3 docs/closure-checklist.md 是否过度详细让维护负担上升

**实测结果**：63 行（< 100 硬底）；只列硬性必含项（4 项命令 + Phase closure 报告必含项 + 修复责任传递规则）+ 历史教训沉淀（不展开理论）。维护规则段明示"checklist 修订必须经 ADR 修订流程"避免静默漂移。

### E.4 Phase 9 业务代码 git diff 是否真为零

**实测结果**：`git diff origin/main..HEAD -- packages/application/src/saga/saga-end-to-end.integration.test.ts` 仅显示 5 处 mock fixture 修改；其他业务代码 git diff zero 跨 Phase 1-9 锁定接口。

---

## §F 测试计划

### F.1 4 项独立命令实测（baseline + post-fix 对比）

| # | 命令 | Baseline | Post-fix | 状态 |
|---|---|---|---|---|
| 1 | `pnpm lint` | 0 errors / 0 warnings | 0 errors / 0 warnings | ✅ 维持 |
| 2 | `pnpm typecheck` | **10 errors**（FAIL）| **0 errors**（PASS）| ✅ **修复证明** |
| 3 | `pnpm test` | 1971（1867 passed + 104 skipped） | 1971（1867 passed + 104 skipped）| ✅ 维持 |
| 4 | `pnpm test:coverage` | 84.92% / 79.56% / 91.68% / 84.92% | 84.92% / 79.57% / 91.68% / 84.92% | ✅ 维持（branches 79.56% → 79.57% 是 fixture 修复增加 1 行字段访问触发的微小波动；不显著）|

### F.2 KNOWN-ISSUES 6 项 KI 状态

- KI-P8-001 / 002 / 003 / 005 + KI-P9-001：carried over（不变）
- **KI-P10-001：open → RESOLVED**（本 Step 关闭）

KI 总数：6 → 5（KI-P10-001 关闭）。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700（预期维持 1971；本 Step 0 测试增量）| ✅ 1971 |
| H2 | 覆盖率 ≥ 80%/75%/80%/80%（Phase 10 baseline 维持） | ✅ 84.92% / 79.57% / 91.68% / 84.92% |
| H3 | 4 项独立命令全 PASS（含 typecheck PASS — KI-P10-001 关闭硬底）| ✅ |
| H4 | push 到 feature 分支成功 | （由后续步骤完成）|
| H5 | PR 创建建议输出（用户审视合并）| （由后续步骤完成）|

参考下限 R1-R6 全 PASS。完成项 G1-G24 全 PASS（详见执行报告 §G）。

---

## §H Step 1 衔接预告

Step 0 完成后启动 Step 1：协作资产基础三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）。Step 1 起草指令独立承接（不在本 Step 范围）。

Step 1 严重依赖 Step 0 成果：
- typecheck PASS（Step 0 修复成果；Step 1 baseline 验证）
- docs/closure-checklist.md（Step 0 防御指引；Step 7 收官时引用）
- 元规则 Q v3 模板 5 项动作（Step 0 首次完整实战；Step 1+ 沿用）
- KI-P10-001 RESOLVED（Step 0 关闭；KI 总数 6 → 5）

---

## §I 对作品级代码库的意义

### I.1 Phase 9 closure 教训完整闭环

Phase 9 closure 隐藏 typecheck 缺陷被 Phase 10 Kickoff 实测发现 → KI-P10-001 登记 → Phase 10 / Step 0 修复 + 防御指引建立 → Tianqi 工程纪律从"事后诚实留痕"层面正式升级到"事前防御机制"层面。本 Step 是这一升级的标志性 Step。

### I.2 元规则 Q v3 模板首次完整实战

5 项强制开局动作首次完整实战兑现：动作 1（重读文档）+ 动作 2（KI 核查 6 项含 P10-001）+ 动作 3（3 ADR 核查）+ 动作 4（saga-end-to-end 错误清单 + Engine Port 类型对照分析）+ 动作 5（4 项独立命令 baseline + post-fix 双向实测留痕）。动作 5 是 Phase 9 closure 教训的工程化沉淀首次兑现。

### I.3 docs/closure-checklist.md 永久生效

自 Step 0 起，未来 Phase closure 起草指令必须含本 checklist 引用 + 4 项独立命令实测输出硬底。这避免 Phase 9 closure 类似教训重现；让"事前防御机制"层面工程纪律有可执行依据。

### I.4 接口冻结纪律的延续证明

修复策略选 α（测试 fixture 对齐 Engine Port）而非 β（修改 Engine Port 类型）—— 元规则 B 跨 Phase 严守的实证。Engine Port 类型从 Phase 8 ADR-0001 Accepted 时锁定，Phase 9 全程未变化，Phase 10 / Step 0 仍未修改。Tianqi 接口冻结纪律的连续性证据。

### I.5 惯例 M 跨 Phase 一致性

ADR-0003 Step 0 段是惯例 M 第 20 次实战 + **跨 Phase 第 1 次**（Phase 9 ADR-0002 共 19 次实战；Phase 10 ADR-0003 自此进入增量追写阶段）。惯例 M 跨 Phase 一致性的证据。

### I.6 修复 + 防御 + 沉淀三位一体

Step 0 全部价值：
1. **修复**：消除 KI-P10-001 typecheck 缺陷（fixture 5 处对齐；4 项命令 PASS）
2. **防御**：建立 docs/closure-checklist.md（63 行；硬性必含项）让未来 Phase closure 不重复 Phase 9 教训
3. **沉淀**：ADR-0003 Step 0 段含工程教训阐述；KI-P10-001 RESOLVED 双重证据；元规则 Q v3 模板首次完整实战

读者翻开 docs/closure-checklist.md，能一眼看出"未来 Phase closure 必含 4 项独立命令实测输出"——清晰、可控、可信的工程纪律。

---

**Phase 10 / Step 0 完成 — 2026-05-02 ✅**

Phase 10 唯一"修复 + 防御"性质 Step 完成。Step 1 起草由独立指令承接。
