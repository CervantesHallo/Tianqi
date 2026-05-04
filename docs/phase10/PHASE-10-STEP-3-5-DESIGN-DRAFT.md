# Phase 10 / Step 3.5 — Phase 1-9 dist-based workspace 测试链修复 + 防御机制建立 — PHASE_DESIGN 草案

> **状态**：DRAFT v1 — 等待用户 APPROVE
> **类型**：拆两阶段流程第 5 次实战 + Phase 10 第二个"修复 + 防御"性质 Step
> **草案时间**：2026-05-04
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成后本文件立即删除（设计沉淀进 ADR-0003 + 修复落地文件）

本草案是 Phase 10 / Step 3.5 拆两阶段流程的产物——KI-P10-002 修复方案 C 已由用户 v3 锁定；本草案聚焦 α/β 防御补强裁决（基于 fresh build 时长实测 + §17 协调）+ 修复细节 + 双层缺陷链留痕。

---

## §A 强制开局动作 1-5 执行确认

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》§17 / §4.8 + 《补充文档》§7.1/§7.2/§13.1 + ADR-0003 §E.1 fallback + closure-checklist | ✅ |
| 2 | 核查 KNOWN-ISSUES 5 项 open KI（KI-P10-001 已 RESOLVED；KI-P10-002 本 Step 新建）| ✅ |
| 3 | 核查 ADR-0001/0002 Accepted + ADR-0003 In Progress（Step 0/1/2/3 段已增量追写）| ✅ |
| 4 | 七项实地核查（A-G）| ✅ — 详见 §B |
| 5 | 4 项独立命令双重 baseline 实测 | ✅ — 详见 §C |

---

## §B 强制开局动作 4 核查结果（七项 A-G）

### §B.1 monorepo workspace 包配置（4 A）

| 包 | type | main |
|---|---|---|
| packages/shared | module | dist/index.js |
| packages/contracts | module | dist/index.js |
| packages/domain | module | dist/index.js |
| packages/ports | module | dist/index.js |
| packages/adapters/event-store-memory（抽样）| module | dist/index.js |

**结论**：全部 workspace 包 `main: dist/index.js`（dist-based publish 模式）+ ESM (`type: module`)；KI-P10-002 根因坐实。任何引用 `@tianqi/<pkg>` 的代码都需要 `dist/index.js` 存在。

### §B.2 root scripts 现状（4 B）

```json
"scripts": {
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -b tsconfig.json",
  "test": "vitest run",
  "test:coverage": "vitest run --coverage",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

**结论**：**root 无 `build` script**；test/test:coverage 直接调 vitest 不前置 build。KI-P10-002 根因坐实。

### §B.3 CI workflow 现状（4 C）

`.github/workflows/ci.yml`：
- 4 jobs（lint / typecheck / test / coverage）
- 每 job: checkout → pnpm/action-setup → setup-node('22'+cache pnpm) → `pnpm install --frozen-lockfile` → `pnpm <command>`
- **test/coverage job 在 install 后无 build 步**——KI-P10-002 直接根因

### §B.4 fresh build 时长实测（4 D；α/β 裁决前置数据）

| 实测 | 时长 |
|---|---|
| 1 fresh tsc -b 全量构建（无 .tsbuildinfo + 无 dist）| **5.02s** |
| 2 增量 tsc -b（有 .tsbuildinfo + 0 文件改动）| **0.28s** |
| 3 增量 tsc -b（1 文件改动）| 0.67s |

**估算**：一天 dev cycle 50 次 `pnpm test`，β 比 α 多耗 = 50 × 0.28s ≈ **14s/day**（完全可接受）

**裁决标准应用**：实测 2 = 0.28s ≤ 2s 阈值 → **倾向 β（防御补强）**

### §B.5 §17 命令规范协调（4 E）

《宪法》§17 涵盖 lint / typecheck / build / 测试规范（4 类命令）。基于补充文档 §7.2 "本地与 CI 一致" 的高优先级原则推断：
- §17 没有明示禁止 test script 含 build 前置
- §7.2 一致性需求是更高优先级；β 让 test 调用 build 是为了一致性服务（local 残留 vs fresh checkout 不再产生不同结果）
- 推断：β 不违反 §17，且服务于 §7.2 严守

**结论**：§17 不明禁 + §7.2 一致性优先 + 实测 2 = 0.28s 远低 2s 阈值 → **裁决 2 选 β**（防御补强）

### §B.6 vitest config 现状（4 F）

```ts
thresholds: { lines: 84, functions: 84, branches: 75, statements: 84 }
```

**结论**：Step 3 已设置 84/75/84/84；本 Step 不修改 vitest config（裁决 8 严守 0 新增）。

### §B.7 KI-P10-001 干净环境验证（4 G）

实测：删 `.tsbuildinfo` + `dist/` 后 `pnpm typecheck` **PASS**（exit 0；tsc -b 自动 build dist 同时验证）。

**结论**：Step 0 修复对干净环境**真有效**；KI-P10-001 真 RESOLVED；**Step 3.5 范围不需扩张**。

---

## §C 强制开局动作 5 — 4 项独立命令双重 baseline 实测

### §C.1 Baseline A（local 残留 dist + .tsbuildinfo）

| # | 命令 | 实测输出 |
|---|---|---|
| 1 | `pnpm lint` | exit 0；0 errors / 0 warnings ✅ |
| 2 | `pnpm typecheck` | exit 0 ✅ |
| 3 | `pnpm test` | **1971 tests（1867 passed + 104 skipped）** ✅ |
| 4 | `pnpm test:coverage` | **84.92%/79.56%/91.68%/84.92%** ✅ |

### §C.2 Baseline B（fresh checkout 模拟；删 .tsbuildinfo + dist）

| # | 命令 | 实测输出 |
|---|---|---|
| 1 | `pnpm lint` | exit 0 ✅（不依赖 dist）|
| 2 | `pnpm typecheck` | exit 0（5s 全量 build；副作用产生 dist）✅ |
| 3 | `pnpm test` | **❌ 144 failed | 38 passed (182 files)；282 tests passed** |
| 4 | `pnpm test:coverage` | **❌ 144 failed | 38 passed**（同上）|

### §C.3 双重 baseline 不一致证据 — KI-P10-002 实测坐实

- **A test 1971 PASS / B test 144 FAIL** — **完美复刻 CI red 状态**
- 这是 §7.2 "本地与 CI 一致" 严重违规
- 修复完整性硬证据：本 Step 修复后 baseline B 必须从 144 FAIL 升级为全 PASS（与 baseline A 一致）

---

## §D 10 个核心裁决摘要

### 裁决 1：修复方案最终确认 — **C（用户 v3 锁定）**

✅ 严守用户 v3 锁定的方案 C（root build script + workflow build 步 + 文档同步）。**严禁切换到 A/B/D 任一**。

### 裁决 2：α/β 防御补强 — **β（防御补强；test scripts 依赖 build）**

**裁决依据**：
- 实测 2（增量 tsc -b 0 改动）= **0.28s**，远低 2s 阈值
- 一天 50 次 dev cycle β 多耗 ≈ 14s/day（可接受）
- §17 不明禁 + §7.2 一致性优先（基于推断）

**实施**：
```json
"scripts": {
  "build": "tsc -b tsconfig.json",
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -b tsconfig.json",
  "test": "pnpm build && vitest run",
  "test:coverage": "pnpm build && vitest run --coverage",
  ...
}
```

**副作用确认**：
- `test` / `test:coverage` 自动前置 `pnpm build`，让 fresh checkout 用户跑 `pnpm test` 直接成功（不需要先手动跑 `pnpm build`）
- dev cycle 增量 tsc -b 0.28s 可忽略；首次 fresh build 5s 一次性成本
- 本机 + CI 行为完全一致（§7.2 严守）

### 裁决 3：CI workflow build 步插入位置 — **A（仅 test + coverage 两 job）**

**理由**：
- `lint` job 不依赖 dist（eslint 跑 src 即可）
- `typecheck` job 自身就是 `tsc -b` 即 build 等价（重复 build 浪费）
- `test` + `coverage` 是真正需要 dist 的 jobs

**实施**：在 ci.yml `test` + `coverage` 两 job 的 `pnpm install --frozen-lockfile` 之后、`pnpm <command>` 之前插入 `pnpm build` 步骤。

**注**：选择裁决 2 β 后，CI 中 `pnpm test` 已经自动前置 build——但为显式 + 利于 CI cache + log 可读性，仍在 ci.yml 里显式 `pnpm build` 步骤（防御深度）。

### 裁决 4：CONTRIBUTING.md 4 项命令更新 — **α（install + build 两步前置）**

```markdown
Before opening a PR, run all commands **independently** and record each output:

```bash
# Prerequisites (fresh checkout):
pnpm install --frozen-lockfile  # install deps
pnpm build                       # build workspace dist (required for tests)

# Four mandatory validation commands (Meta-rule Q v3):
pnpm lint            # zero warnings, zero errors
pnpm typecheck       # zero errors
pnpm test            # all tests green
pnpm test:coverage   # coverage thresholds (currently 84/75/84/84)
```

The four mandatory commands above are independent — do not substitute a
single command (e.g. `pnpm test:coverage`) for independent typecheck
verification (per KI-P10-001). Build is a prerequisite, not a substitute
for any of the four (per KI-P10-002).
```

**语义清晰**：4 项独立验证保留；2 项前置（install + build）显式标注；不破坏 Phase 9 closure 教训沉淀的"4 项独立命令"语义。

### 裁决 5：closure-checklist.md 更新 — **α（顶部加段；总长 ≤ 100）**

在 "## 4 项独立命令实测输出（元规则 Q v3 模板核心）" 段顶部加 "## fresh checkout 验证防御（Phase 10 / Step 3.5 教训）" 段（约 10 行）：

```markdown
## fresh checkout 验证防御（Phase 10 / Step 3.5 教训）

任何 closure Step 验证 4 项独立命令前必须**先在 fresh checkout 模拟环境**
跑一遍（删 `.tsbuildinfo` + `dist/`），并附前置命令：

```bash
find packages -name "*.tsbuildinfo" -delete
rm -rf packages/*/dist/
pnpm install --frozen-lockfile
pnpm build  # required for dist-based workspace tests
```

**根因**：Tianqi monorepo 使用 dist-based workspace（`main: dist/index.js`）；
contributors 几乎不会主动删 dist/，导致本地 4 项命令 PASS 但 fresh CI 环境
test 144 文件 FAIL。这是 §7.2 严重违规——不在 fresh 环境验证 = 没有真正
验证。详见 KI-P10-002。
```

closure-checklist.md 当前 72 行 + 追加约 15 行 = 87 行 ≤ 100。

### 裁决 6：KI-P10-002 内容 — **按用户提议 + 长期监控触发条件**

**长期监控阈值**（AI 实地裁决具体值）：
- fresh build 时长 > 5 秒 → 触发升级评估（当前实测 5.02s 已逼近阈值，但单次 fresh build 不在 dev cycle 高频路径）
- dev cycle 增量 build 时长 > 2 秒 → 触发评估（当前实测 0.28s 远低于）
- monorepo workspace 包数 > 50 → 触发评估（当前 25 包）
- contributors 数 > 5 → 触发评估（与 dependabot / 频繁 PR 协调）

KI-P10-002 完整内容详见 §F。

### 裁决 7：ADR-0003 Step 3.5 段（含双层缺陷链留痕 + §E.1 fallback 兑现）

详见 §G。约 50 行；惯例 M 第 24 次 + 跨 Phase 第 5 次实战。

### 裁决 8：错误码 / 新 Port / 新 Adapter / 新 workspace 包

**0 新增**（惯例 K 第 22 次实战；纯修复 + 防御 Step）。

### 裁决 9：Step 3.5 PR 序号 — **#6 + merge commit 合并**

沿用 Phase 10 PR 连续序号（#1 Kickoff / #2 Step 0 / #3 Step 1 / #4 Step 2 / #5 Step 3 / **#6 Step 3.5**）+ merge commit 合并方式（保留 v1 + IMPLEMENT 迭代历史）。

### 裁决 10：main 转绿验证流程

```
PR #6 创建 → CI 在 PR 上 4 jobs 必须 PASS（修复完整性硬证据 1）
↓
用户 merge commit 合并 PR #6 到 main
↓
push to main 触发 CI 第二次运行（裁决 5 B）
↓
4 jobs 在 main 上必须 PASS（修复完整性硬证据 2；main 真正绿）
↓
用户回执 main CI run URL + 4 jobs 状态
```

如 main CI 仍 FAIL → Step 3.5 修复不完整 → 启动 Step 3.6 或重开 PR #6 修订。

---

## §E 修复方案 C 完整草案

### §E.1 root package.json build script 添加

```json
"scripts": {
  "build": "tsc -b tsconfig.json",
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -b tsconfig.json",
  "test": "pnpm build && vitest run",
  "test:coverage": "pnpm build && vitest run --coverage",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

**关键**：`test` + `test:coverage` 前置 `pnpm build &&`（裁决 2 β）。

### §E.2 ci.yml 修改位置（test + coverage 两 job 加 pnpm build）

修改前后对比（test job；coverage 同模式）：

```yaml
# 修改前
test:
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm test

# 修改后
test:
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: '22', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: pnpm build              # ← 新增（裁决 3 A）
    - run: pnpm test
```

**注**：本质上裁决 2 β 已让 `pnpm test` 自动前置 build；ci.yml 显式 `pnpm build` 步骤是防御深度（log 清晰 + 失败定位明确 + cache hit 路径暴露）。

### §E.3 CONTRIBUTING.md 修订

详见裁决 4。约 6 行内追加 / 改写。CONTRIBUTING.md 94 → 约 99 行（仍 ≤ 100 硬底）。

### §E.4 closure-checklist.md 追加段

详见裁决 5。约 15 行追加。closure-checklist 72 → 约 87 行（≤ 100）。

### §E.5 α/β 裁决最终选择 — **β（防御补强）**

详见裁决 2 + §B.4 + §B.5。

---

## §F KI-P10-002 完整草案

```markdown
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
  - root `package.json` 添加 `build` script（封装 tsc -b）
  - **`pnpm test` script 依赖 `pnpm build`**（裁决 2 β；防御补强）
  - CONTRIBUTING.md `## Mandatory Validation` 段前置 `pnpm install + pnpm build`
  - docs/closure-checklist.md 同步追加 fresh checkout 验证防御段
- **长期监控**：
  - fresh build 时长 > 5 秒 → 触发升级评估（当前实测 5.02s）
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
```

---

## §G ADR-0003 Step 3.5 段草案（含双层缺陷链留痕 + §E.1 fallback 兑现）

```markdown
### Step 3.5: Phase 1-9 dist-based workspace 测试链修复 + 防御机制建立

**双层缺陷链留痕**：本 Step 是 Step 3 揭露的同源问题修复，与 Step 0（KI-P10-001）共属"Phase 9 closure 工程教训"双层缺陷链；Step 0 修复了 typecheck 层（vitest type-erasure 绕过），Step 3.5 修复 packaging 层（dist-based workspace 在 fresh checkout 下不工作）。

**§E.1 fallback 兑现**：ADR-0003 Step 3 §E.1 fallback 已预言"CI failure 时核查 GitHub Actions log；区分配置错误 vs 基础设施问题；前者修 yml + 追加 fix commit（不 force-push 抹掉失败历史）"。Step 3.5 是该 fallback 的具体兑现——虽然没预言到具体根因是 dist 暴露问题，但兜底机制兑现了。这证明 Step 3 设计阶段已留好出口。

**关键工程纪律边界**：Phase 1-9 测试不是伪绿色——是真过的，但只在"恰好有 dist/"的环境过。这不是 Phase 1-9 work 的污名，而是**"未在干净环境验证过的真绿色"**。CI 第一次启用揭露这个未覆盖路径，是 Phase 10 工程化基础设施的合理价值。

**裁决摘要**：
- 修复方案：C（用户 v3 锁定；root build script + workflow build 步 + 文档同步）
- α/β 防御补强：**β**（实测 fresh build 增量 0.28s ≤ 2s 阈值；§7.2 一致性优先；test scripts 依赖 build）
- CI build 步插入：A（仅 test + coverage 两 job）
- CONTRIBUTING 更新：α（install + build 两步前置）
- closure-checklist 更新：α（顶部加段；总长 87 ≤ 100）
- KI-P10-002 新建（含双层缺陷链 + 长期监控触发条件）
- 0 新增（错误码 / Port / Adapter / 包；惯例 K 第 22 次实战）

**实施细节**：
- root package.json 添加 `build`script + `test` / `test:coverage` 前置 `pnpm build &&`
- ci.yml test + coverage 两 job 显式 `pnpm build` 步骤（防御深度）
- CONTRIBUTING.md 修改 `## Mandatory Validation` 段含 install + build 前置
- closure-checklist.md 追加 "## fresh checkout 验证防御" 段
- KNOWN-ISSUES.md 落地 KI-P10-002（含双层缺陷链 + 长期监控阈值）

**修复完整性证据**：双重 baseline 实测——
- baseline A（local 残留 dist）：4 项全 PASS（与 Step 3 final 一致）
- baseline B（fresh checkout 模拟）：修复后 4 项全 PASS（与 baseline A 一致；§7.2 严守）

**Step 3.5 工程意义**：Phase 10 工程化基础设施的"双层缺陷链"修复完成。Tianqi 进入"干净环境真绿色"成熟度。Step 4 起承接容器化主题在干净 baseline 上工作。
```

---

## §H 风险点与 fallback 方案

### H.1 fresh checkout 模拟与真实 CI 环境的细微差异

**风险**：本机 fresh checkout 模拟（删 .tsbuildinfo + dist）可能与真实 CI 环境（无任何残留 + 全新 pnpm install + 不同 OS）有细微差异。

**Fallback**：本 Step PR 创建后 CI 第二次运行实测验证。如 CI FAIL：核查 log；区分本地未暴露的细微差异 vs 修复不完整；追加 fix commit。

### H.2 α/β 防御补强 β 选项的副作用

**风险**：`pnpm test` 依赖 `pnpm build` 让"想跳过 build 直接跑 vitest"的边缘场景不再可行（譬如 `vitest <specific-test>` 在 IDE 内的快速调试）。

**Fallback**：保留 `vitest run` 直接调用作为绕过路径（contributors 知道 `pnpm exec vitest <args>` 可用）；scripts 中的 `pnpm test` 是 PR 必跑路径，不是 IDE 调试快捷方式。

### H.3 KI-P10-002 长期监控阈值的合理性

**风险**：长期监控阈值（fresh build 5s / 增量 2s / 25 包 / 5 contributors）是基于当前 baseline 估算；未来 monorepo 演化可能让阈值过严或过松。

**Fallback**：阈值在 KI-P10-002 段落中可由后续 ADR 修订流程调整（不需要 KI 重开）；触发任一阈值时启动方案 D 升级评估即可。

### H.4 branch protection 配置时机协调

**风险**：Step 3 §G branch protection 时序裁决 "PR 合并到 main 后配置"；但 Step 3 PR #5 已合并而 main red，user 暂未配置 branch protection。Step 3.5 PR #6 合并到 main 后才有真正绿的 status check 名称。

**应对**：用户在 Step 3.5 PR #6 合并 + main CI 转绿后再配置 branch protection（沿用 Step 3 §G 时序裁决）。Step 4+ PR 起 branch protection 真正生效。

### H.5 Step 3 工程价值不被误解为"Step 3 失败"

**风险**：Step 3 PR merged + main red 可能被读者误解为 Step 3 设计/实施失败。

**应对**：ADR-0003 Step 3.5 段 + KI-P10-002 + docs/phase10/05 严守"未在干净环境验证过的真绿色"措辞；明示 Step 3 工程价值（CI 第一次启用揭露未覆盖路径是合理价值）。诚实留痕 vs 污名表述边界严守。

---

## §I 本机 commit 信息（PHASE_DESIGN 第一阶段）

**待执行**：第一阶段 commit 1 个（仅本草案文档）；严禁 push。

```
git add docs/phase10/PHASE-10-STEP-3-5-DESIGN-DRAFT.md
git commit -m "docs(decisions): draft Phase 10 Step 3.5 test chain fix design"
```

预期 commit SHA 在 §J 输出时填入。

---

## §J 草案文档位置

`docs/phase10/PHASE-10-STEP-3-5-DESIGN-DRAFT.md`（本文件；PHASE_IMPLEMENT 阶段完成后立即删除）

---

## §K 核心未决判断（请重点审视）

### K.1 α/β 防御补强裁决（裁决 2 β）

**决议**：β——`pnpm test` / `pnpm test:coverage` 前置 `pnpm build &&`。

**审视点**：
- 实测数据 0.28s 增量 build / 14s/day dev cycle 多耗 — 是否同意可接受？
- 是否有 IDE 调试或其他场景被破坏的考虑？
- §7.2 一致性优先是否在 test script 含 build 这种边缘场景同样适用？

**AI 建议**：保留 β。理由：实测数据明确支持；§7.2 一致性优先是 KI-P10-002 根因的反向修复；IDE 调试有 `pnpm exec vitest <args>` 绕过路径。

### K.2 CONTRIBUTING 4 项命令前置写法（裁决 4 α）

**决议**：α——install + build 两步前置；4 项独立验证保留。

**审视点**：
- 是否担心"4 项独立命令"语义被 install + build 前置弱化？
- 是否需要更显式的 "Prerequisites vs Validation" 分块？

**AI 建议**：保留 α。当前草案已用 `# Prerequisites (fresh checkout):` + `# Four mandatory validation commands (Meta-rule Q v3):` 注释明确分块；语义清晰。

### K.3 KI-P10-002 长期监控阈值具体值

**决议**：fresh build 5s / 增量 2s / 25 包 / 5 contributors。

**审视点**：
- 阈值是否过严或过松？
- 是否需要不同维度的阈值组合（譬如 build 时长 + 频次）？

**AI 建议**：保留当前阈值。理由：fresh build 5s 是当前实测水位；增量 2s 与裁决 2 β 阈值一致；25 包 + 5 contributors 是 monorepo 复杂度演化的合理触发点。后续 ADR 修订流程可调整。

### K.4 main 转绿验证流程的回执方式（裁决 10）

**决议**：用户合并 PR #6 后回执 main CI run URL + 4 jobs 状态。

**审视点**：
- 是否需要在 PR 描述中预留 "## main CI Verification" 段（vs 通过聊天回执）？
- 是否需要 Step 3.5 后追加 "## branch protection 配置状态" 段？

**AI 建议**：聊天回执即可（PR 描述已含 ## CI Iteration 段；main 转绿状态在用户回执时同步给我即可）；branch protection 配置状态由用户独立通知（Step 3 §G 时序裁决已说明用户责任）。

---

## 等待用户回执（PHASE_DESIGN）

**v1 草案完成。请审视后回执三选一**：

- **APPROVE** — 进入 PHASE_IMPLEMENT 阶段（删除草案 + 落地 root build script β + ci.yml 修改 + CONTRIBUTING 修订 + closure-checklist 追加 + KI-P10-002 落地 + ADR-0003 Step 3.5 段 + docs/phase10/05 + push + PR #6）
- **REQUEST_CHANGES + 反馈** — 草案需修改具体位置（譬如调整 α/β 裁决 / 调整 KI-P10-002 阈值 / 调整 CONTRIBUTING 写法 / 等）
- **REJECT + 重大方向调整** — 整体方向需重新设计

**第二阶段 PHASE_IMPLEMENT 仅在收到明确 APPROVE 后启动。回执前不修改实际代码 / 不 push 任何内容**。

---

**Phase 10 / Step 3.5 PHASE_DESIGN 草案完成 — 2026-05-04**

拆两阶段流程第 5 次实战 + 双层缺陷链 packaging 层修复设计。
