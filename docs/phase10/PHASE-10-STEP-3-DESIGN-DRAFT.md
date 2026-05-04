# Phase 10 / Step 3 — CI 强制门禁（GitHub Actions Workflow）— PHASE_DESIGN 草案 v2

> **状态**：DRAFT v2 — 用户 v1 REQUEST_CHANGES + 反馈后修订；等待 v2 APPROVE
> **类型**：拆两阶段流程第 4 次实战（普通 Step 级别首次）
> **版本**：v2（v1 用户审视后第 1 轮修订）
> **草案时间**：2026-05-04
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成后本文件立即删除（设计沉淀进 ADR-0003 + .github/workflows/ci.yml）

本草案是 Phase 10 / Step 3 拆两阶段流程的产物——CI workflow 设计影响 Phase 10 全程 + Phase 11+ 持续；用户审视 10 项裁决（Node 版本 / pnpm 版本 / cache / 触发 / 覆盖率门槛 / branch protection 等）让设计稳健。

## v2 修订说明（用户审视后落地）

用户 v1 回执：REQUEST_CHANGES + 2 项小修订要求 + 2 项附加要求（不阻塞 v2）。

**v2 已落地的 2 项小修订**：

1. **§G + §K K.3 branch protection 时序调整** — 从"PR 合并前 / 后均可"改为明示"**PR 合并到 main 后**配置"。理由：避免鸡生蛋问题（GitHub UI Require status checks 需要从下拉列表选择 status check 名称；status check 名称只有在 workflow 至少在 main 跑过一次后才出现在下拉列表）。详见 §G + §K K.3
2. **§C 裁决 2 + §D yml + §K K.1 Node version 写法精确化** — `node-version: '22'`（major-only；不 pin patch 如 `'22.20.0'`）显式声明为 v2 有意决议。v1 草案已使用 `'22'` 但未显式说明；v2 在 §C 裁决 2 + §K K.1 明示

**v2 不修订的部分**（用户 v1 回执 APPROVE）：
- K.1 Node 22.x 选择（保留）
- K.2 functions: 84 阈值（保留；Step 7 再审视）
- 裁决 1-10 全部其他选择（保留）
- §H 风险点（保留）

**附加要求**（不阻塞 v2 APPROVE；由 AI 在 PHASE_IMPLEMENT 阶段执行）：

A. **K.4 CI iteration 诚实记录纪律** — force-push 不抹掉失败历史；追加 fix commit + PR 描述追加 "CI Iteration" 段。这让 CI 第一次运行失败的诚实留痕显式可见（沿用 Tianqi "诚实评估" 工程纪律）。
B. **§F 测试计划增强** — PHASE_IMPLEMENT 阶段跑 3 次 coverage 看 branches 波动范围；docs/phase10/04 §F 留痕。这是因 branches 79.5%-79.58% 距 75% 门槛仅 4.5pp，需要确认 v8 噪声下限是稳定的。

**v2 修订完成；等待 v2 APPROVE 进入 PHASE_IMPLEMENT 阶段**。

---

## §A 强制开局动作 1-5 执行确认

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》§17 / §9 + 《补充文档》§7.1 / §7.2 / §9.3 / §9.4 / §13.1 + ADR-0003 K.2 | ✅ |
| 2 | 核查 KNOWN-ISSUES 5 项 open KI（KI-P10-001 已 RESOLVED）| ✅ |
| 3 | 核查 ADR-0001/0002 Accepted + ADR-0003 In Progress（Step 0/1/2 段已增量追写）| ✅ |
| 4 | 双重核查 .github/ + 工具链版本 + 覆盖率工具链 | ✅ — 详见 §B |
| 5 | 4 项独立命令 baseline 实测 | ✅ — 详见 §B |

---

## §B 强制开局动作 4-5 核查结果

### §B.1 .github/ 现状（动作 4 A/B/C 双重核查）

| 命令 | 实测结果 |
|---|---|
| `git status --untracked-files=all` | working tree clean（0 未追踪文件）|
| `git ls-files .github/` | 6 文件（Step 2 创建：CODEOWNERS + PULL_REQUEST_TEMPLATE + 4 ISSUE_TEMPLATE）|
| `ls -la .github/workflows/` | **directory does not exist** |

**结论**：CI workflow 从零创建；`.github/workflows/` 是新增目录。

### §B.2 工具链版本（动作 4 D）

| 工具 | 本机版本 | 仓库约定 | CI 采纳值 |
|---|---|---|---|
| Node.js | v22.20.0 | 无 `.nvmrc`；无 `package.json engines`；`@types/node: ^22.13.11`（隐式 Node 22）| **Node 22.x**（与本机 + 类型定义一致；Node 22 已是 2024-10 LTS）|
| pnpm | 10.0.0 | `packageManager: "pnpm@10.0.0"`（package.json 锁定）| **pnpm@10.0.0**（沿用 packageManager 字段）|

**关键观察**：仓库无 `.nvmrc` 也无 `engines` 字段——Node 版本约定靠 `@types/node` 间接表达。建议本 Step 不主动添加 `.nvmrc`（避免双重维护源；CI yml 与 `package.json` 单一权威源即可）。

### §B.3 package.json scripts 段（动作 4 D）

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

**结论**：4 项独立命令完整定义；CI yml 直接调用 `pnpm run <command>` 即可保证本地与 CI 一致（§7.2 严守）。

### §B.4 覆盖率工具链（动作 4 E）

| 维度 | 实测 |
|---|---|
| 配置位置 | **单 root** `vitest.config.ts`（无 per-package vitest.config.*）|
| Provider | `v8` |
| Reporter | text / text-summary / html / json-summary |
| Reports Directory | `./coverage` |
| **当前 thresholds** | **lines 80 / functions 80 / branches 75 / statements 80**（Phase 8 CLOSED gate per §9.3）|
| Include patterns | domain/src + application/src + policy/src + ports/src + adapters/*/src |
| Exclude patterns | adapter-testkit + 各类 *.test.ts + helpers/* + dist/* + index.ts |

**关键观察**：
- 单 root vitest.config.ts 简化升级路径——本 Step 仅修改一处即可（裁决 6）
- 当前 thresholds 80/75/80/80 是 Phase 8 CLOSED 设置；Phase 10 K.2 锁定升级 84%（branches 维持 75）
- 79.56% branches（实测）距离 75% 门槛仅 4.56pp——branches 不可升至 84%（结构性现象 KI-P8-005 延续）

### §B.5 4 项独立命令 baseline 实测

| # | 命令 | 实测输出 |
|---|---|---|
| 1 | `pnpm lint` | exit 0；`eslint . --max-warnings=0` 0 错误 / 0 警告 ✅ |
| 2 | `pnpm typecheck` | exit 0；`tsc -b tsconfig.json` 0 errors ✅ |
| 3 | `pnpm test` | 175 passed + 7 skipped；**1971 tests（1867 passed + 104 skipped）**；12.49s ✅ |
| 4 | `pnpm test:coverage` | **Statements 84.92% / Branches 79.56% / Functions 91.68% / Lines 84.92%** ✅ |

**关键观察**：当前 baseline 全部 ≥ 各自 80%/75%/80%/80% 门槛；84%/75%/84%/84% 升级门槛中 functions 91.68% 远超 + lines/statements 84.92% 略超 + branches 维持 75%——**升级门槛设置安全**。

---

## §C 10 个核心裁决最终选择与理由

### 裁决 1：CI workflow 数量与 job 拆分粒度

**选择 B：单 workflow + 4 jobs 并行**（lint / typecheck / test / coverage）

**理由**：
- 严守元规则 Q v3 模板"4 项独立命令"纪律——每 job 独立验证一项
- 4 jobs 并行让 CI 总时长缩短（lint 通常 ~30s；test:coverage ~60s；并行总时长 ≈ 最慢 job）
- 单 job 失败掩盖具体失败维度（违反"清晰、可控、可信"）
- GitHub UI PR check 状态显示 4 个独立 check，贡献者一眼看清失败维度

### 裁决 2：Node.js 版本策略

**选择 α 单版本 Node 22.x**（与本机 + 类型定义协调；Node 22 已是 2024-10 LTS）

**理由**：
- 仓库 `@types/node: ^22.13.11` 隐式约定 Node 22；CI 与类型定义对齐避免漂移
- 本机实测 v22.20.0 也是 Node 22 系列
- Node 22 自 2024-10 已成 LTS（与 Tianqi 当前阶段时间线协调）
- β 多版本 matrix 在 Tianqi 单部署目标场景过度（不是公共 npm package）；Phase 11+ 真实部署再考虑
- γ 沿用 .nvmrc / engines 字段不可行（仓库均无）；本 Step 不主动添加 .nvmrc 避免双重维护源

**v2 修订显式声明**：CI yml 中固定 `node-version: '22'`（**仅 major 版本**；不 pin 到具体 patch 版本如 `'22.20.0'`）。理由：让 setup-node 自动取 Node 22.x latest patch；避免 patch 释出后 CI 卡在过期 patch / 安全更新滞后。本机实测 Node 22.20.0 仅作 baseline 留痕参考（§B.2），不等于 CI 锁定 patch。

### 裁决 3：pnpm 版本策略

**选择 α 沿用 `packageManager: "pnpm@10.0.0"` 字段**

**理由**：
- 与《补充文档》§7.2 "本地与 CI 一致" 严守
- pnpm/action-setup@v4 自动读取 packageManager 字段；CI yml 不需要重复声明 pnpm 版本
- 单一权威源（package.json）；将来 pnpm 升级仅修改 package.json 一处

### 裁决 4：CI cache 策略

**选择 B：cache pnpm store**（pnpm/action-setup 内置支持）

**理由**：
- 业界标准；pnpm/action-setup@v4 通过 `cache: 'pnpm'` 一行配置启用
- pnpm store 是 hash-keyed 不变内容缓存——OS / Node 版本切换不污染
- A 不 cache 让每次 CI install 数十秒（4 jobs × 数十秒 = 显著浪费）
- C node_modules cache + D build artifacts 复杂度高（25 包 dependency graph）；Phase 11+ 性能优化再考虑

### 裁决 5：CI 触发条件

**选择 B：PR + push to main**（pull_request + push to main）

**理由**：
- 业界标准 + 与 Phase 10 工作流过渡（feature 分支 + PR 合并）协调
- push to main 确保即使 PR merge 时偶发 conflict 后 main 仍验证一遍
- A 仅 PR 让 main 在 merge 后可能转 red 不被发现
- C 全分支 push 浪费 actions minutes（Tianqi feature 分支频繁 push 是开发常态）
- D scheduled run 推迟 Phase 11+

### 裁决 6：覆盖率门槛实施策略

**选择 A：在 vitest.config.ts 设置 coverage thresholds**（lines: 84 / functions: 84 / branches: 75 / statements: 84）

**理由**：
- vitest 原生支持；让本地 `pnpm test:coverage` 与 CI 双向一致（§7.2 严守）
- B CI yml 独立检查需要解析 JSON 输出（额外脚本依赖；违反元规则 P）
- C 双重保护冗余（违反"克制"）

**升级值**（80 → 84，branches 维持 75）：

```ts
thresholds: {
  lines: 84,        // ↑ from 80; current 84.92% safely above
  functions: 84,    // ↑ from 80; current 91.68% safely above
  branches: 75,     // ← no change; current 79.56% close to 75%
  statements: 84    // ↑ from 80; current 84.92% safely above
}
```

**关键边界**：
- branches 79.56% 距 75% 仅 4.56pp——不可升至 84%（结构性现象 KI-P8-005 延续；branches 升至 84% 会让 CI 一启动就失败）
- lines/statements 升至 84% 安全（差 0.92pp 但非边缘）
- functions 升至 84% 极安全（91.68% 远超）
- 这是 Kickoff K.2 锁定 84% 起步路径的真实落地；Step 7 升级 85% 时再次审视 branches 是否有改善

### 裁决 7：branch protection 规则建议

**选择 α + β：必须 PR + 必须 status checks 通过 + 必须 review**

**理由**：
- 必须 PR + status checks 是 CI 强制门禁的核心兑现（让 4 jobs 自动 block PR merge）
- 必须 review 让 CODEOWNERS auto-request 真实生效
- γ 必须线性历史与 Phase 10 工作流过渡（merge commit 保留迭代历史）冲突——拒绝
- δ 必须 up-to-date with base branch 让 PR 频繁 force-update，单维护者负担过重

**重要边界**：branch protection 是 GitHub UI 配置（Settings → Branches）；本 Step 仅在 docs/phase10/04-* 提供建议；用户在 PR 合并后或之前自行 UI 配置。**本 Step 不在代码层面落地任何 branch protection**。

### 裁决 8：CONTRIBUTING.md 同步追加 CI 段

**选择 α：本 Step 同步追加**（约 4 行；引用 .github/workflows/ci.yml 不复制内容）

**理由**：
- 沿用 Step 1 / Step 2 模式（CONTRIBUTING 同步追加引用各资产）
- 让贡献者知道"本地 4 项命令也会被 CI 自动验证"——闭环清晰
- β 不追加让 CI 角色在 CONTRIBUTING 缺失

**追加内容**（在 ## Mandatory Validation 段末尾追加 ### CI Verification 子段）：
```markdown
### CI Verification

When you open a PR, GitHub Actions will automatically run the four validation
commands listed above as parallel jobs. Your PR cannot be merged until all four
jobs pass. Local pre-PR validation remains your responsibility (per Meta-rule
Q v3); CI is a safety net, not a substitute.
```

CONTRIBUTING 90 → 约 96 行（仍 ≤ 100 硬底）。

### 裁决 9：错误码 / 新 Port / 新 Adapter / 新 workspace 包

**0 新增**（惯例 K 第 22 次实战；CI 配置不引入业务能力）。

### 裁决 10：ADR-0003 Step 3 段长度

**选择 B：增加 ≤ 40 行**（沿用惯例 M 增量追写；含 10 裁决摘要 + CI yml 关键决策 + 升级路径锁定）

**理由**：
- 10 裁决摘要表（10 行）+ vitest thresholds 升级 + branch protection 建议 + 升级路径锁定 ≈ 30-40 行合理
- 沿用 Phase 9 ADR-0002 模式跨 Phase 一致性
- 惯例 M 第 23 次 + 跨 Phase 第 4 次实战

---

## §D CI workflow yml 完整草案

`.github/workflows/ci.yml`：

```yaml
# Tianqi CI — Phase 10 / Step 3 (元规则 Q v3 模板 4 项独立命令并行验证)
#
# Triggered on PR (any branch → any branch) and push to main.
# Each of the four mandatory validations runs as an independent job so that
# GitHub UI shows individual pass/fail status (per ADR-0003 Step 3 裁决 1 B).

name: CI

on:
  pull_request:
  push:
    branches:
      - main

jobs:
  lint:
    name: Lint (eslint --max-warnings=0)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    name: Typecheck (tsc -b)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    name: Test (vitest run)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  coverage:
    name: Coverage (vitest run --coverage; thresholds 84/75/84/84)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
```

**关键设计要点**：
- 4 jobs 严格并行（无 `needs:` 依赖；GitHub Actions runner 自动并发调度）
- 每 job 独立 checkout + setup-node + install（cache hit 后 install 数秒；无需共享 setup job）
- pnpm/action-setup@v4 通过 `--frozen-lockfile` 确保 lockfile 一致性（§7.2 严守）
- `cache: 'pnpm'` 在 setup-node@v4 启用 pnpm store 缓存（裁决 4 B）
- 第三方 actions 仅用 GitHub 官方（actions/checkout / actions/setup-node）+ pnpm 官方（pnpm/action-setup）——元规则 P 严守"不主动引入第三方依赖"

**预估 CI 时长**：
- lint: ~30-45s（含 install）
- typecheck: ~60-90s（tsc -b 增量缓存空白）
- test: ~60-90s
- coverage: ~90-120s（v8 instrument overhead）
- **总时长 ≈ 最慢 job ≈ 90-120s**（4 jobs 并行）

---

## §E vitest.config.ts 修改草案

修改位置：`vitest.config.ts` 第 ~50-55 行 `thresholds:` 对象

**修改前**：
```ts
thresholds: {
  lines: 80,
  functions: 80,
  branches: 75,
  statements: 80
}
```

**修改后**：
```ts
thresholds: {
  // Phase 10 / Step 3 升级 (per ADR-0003 K.2 锁定 84% 起步路径).
  // branches keep 75 因 KI-P8-005 结构性现象 (current 79.56% 距 75% 仅 4.56pp).
  // Step 7 收官升级 85% 时再次审视 branches 是否有改善.
  lines: 84,        // ↑ from 80; current 84.92% safely above
  functions: 84,    // ↑ from 80; current 91.68% safely above
  branches: 75,     // ← no change; KI-P8-005 structural reality
  statements: 84    // ↑ from 80; current 84.92% safely above
}
```

注释段说明升级理由 + branches 不升级原因 + Step 7 进一步升级承诺。

---

## §F CONTRIBUTING.md 追加段草案

修改位置：CONTRIBUTING.md 在 ## Mandatory Validation 段末尾（约第 60 行后）追加：

```markdown
### CI Verification

When you open a PR, GitHub Actions will automatically run the four validation
commands listed above as parallel jobs. Your PR cannot be merged until all four
jobs pass. Local pre-PR validation remains your responsibility (per Meta-rule
Q v3); CI is a safety net, not a substitute.
```

CONTRIBUTING.md 90 → 约 96 行（仍 ≤ 100 硬底）。

---

## §G branch protection 建议（GitHub UI 操作；本 Step 不在代码层面落地；时序：PR 合并到 main 后配置）

**关键时序裁决（v2 修订）**：**本 Step PR 合并前不配置 branch protection；合并到 main 后用户在 GitHub UI 配置**。

**理由**（避免鸡生蛋问题）：
- GitHub 的 "Require status checks" 配置需要从下拉列表中选择具体 status check 名称
- status check 名称只有在该 workflow 至少在 main 分支上跑过一次后才会出现在下拉列表
- 如果在本 Step PR 合并前先配置 branch protection，配置时下拉列表为空（CI 还未在 main 跑过），无法选择 4 个 CI checks
- 因此**正确顺序**：本 Step PR 合并 → CI 在 main 第一次运行 → status check 名称出现在 GitHub UI 下拉列表 → 用户配置 branch protection 选择 4 个 checks

**等价后果**：本 Step PR 自身合并时 branch protection 不强制（CODEOWNERS auto-request review 仍生效），但合并后 status check 名称落地 main，用户 UI 配置后 Step 4+ PR 起 CI 强制门禁完全生效。

合并本 Step PR 后，建议在 GitHub UI **Settings → Branches → Branch protection rules → Add rule** 配置 `main` 分支：

- ✅ **Require a pull request before merging** + Require approvals: 1
- ✅ **Require review from Code Owners**（让 CODEOWNERS 自动 request 真实生效）
- ✅ **Require status checks to pass before merging** + 选择 4 个 CI checks（Lint / Typecheck / Test / Coverage）
- ❌ Require linear history（与 Phase 10 工作流过渡 merge commit 模式冲突；不勾选）
- ❌ Require branches to be up to date before merging（单维护者负担过重；不勾选）
- ✅ **Do not allow bypassing the above settings**（让纪律对所有人一致；含维护者）

**注意**：上述配置 in GitHub UI 不在本 Step 代码层面落地。本 Step PR **合并到 main 后**用户自行 UI 配置（合并前配置无法选择 status checks）；docs/phase10/04 含本指引便于未来其他维护者参考。

---

## §H 风险点与 fallback 方案

### H.1 CI 第一次运行的不确定性

**风险**：本 Step PR 是 CI workflow 的第一次实证场景；如果 CI 本身因 GitHub Actions 平台 / 网络 / pnpm store cache 等基础设施原因失败，会被误判为 CI 配置错误。

**Fallback**：CI failure 时先核查 GitHub Actions log；区分"配置错误"vs"基础设施问题"；前者修复 yml 重试，后者 retry 即可。

### H.2 84% 门槛在 79.5% branches 边缘的稳定性

**风险**：branches 79.56% 距 75% 门槛 4.56pp；coverage 多次运行有 v8 统计噪声（实测 79.5% / 79.56% / 79.57% / 79.58% 四次运行）。但 75% 门槛设置不依赖 84%——branches 维持 75% 即可。

**Fallback**：若未来 branches 因 v8 噪声跌破 75%（极不可能），则在 vitest.config.ts 临时降至 70% 并登记新 KI；本 Step 不预防御过度。

### H.3 pnpm 版本与 packageManager 字段一致性

**风险**：CI 通过 pnpm/action-setup@v4 自动读 packageManager 字段；如果未来升级 pnpm 但忘记同步 package.json，CI 与本地可能不一致。

**Fallback**：升级 pnpm 时必须同步修改 package.json `packageManager` 字段（此约束建议在未来添加 CONTRIBUTING / Step 4+ 涉及）。

### H.4 branch protection 设置由用户责任完成的协调

**风险**：本 Step 仅提供建议；如果用户合并本 Step PR 后未配置 branch protection，CI 强制门禁仍不生效（PR 仍可绕过 status checks merge）。

**Fallback**：docs/phase10/04 + 本 ADR Step 3 段显式提示用户配置 branch protection；Step 7 收官审视 branch protection 是否完成。

### H.5 vitest config 全局 thresholds 在 PHASE_IMPLEMENT 阶段本地与 CI 不一致

**风险**：本地 baseline 实测 84.92% 全部 ≥ 84%；理论上 PHASE_IMPLEMENT 升级 thresholds 后本地与 CI 都 PASS。但 CI runner 环境可能有 v8 统计噪声让 lines/statements 跌破 84%。

**Fallback**：PHASE_IMPLEMENT 阶段先本地实测确认升级后 PASS 再 push；CI 失败时核查 lines/statements 实际值；若边缘则降低 1pp 至 83% 并登记新 KI。

---

## §I 本机 commit 信息（PHASE_DESIGN 第一阶段）

**待执行**：第一阶段 commit 1 个（仅本草案文档）；严禁 push。

```
git add docs/phase10/PHASE-10-STEP-3-DESIGN-DRAFT.md
git commit -m "docs(decisions): draft Phase 10 Step 3 CI workflow design"
```

预期 commit SHA 在 §J 输出时填入。

---

## §J 草案文档位置

`docs/phase10/PHASE-10-STEP-3-DESIGN-DRAFT.md`（本文件；PHASE_IMPLEMENT 阶段完成后立即删除）

---

## §K 核心未决判断（请重点审视）

以下 4 项是 PHASE_DESIGN 阶段的关键审视点，请用户重点回执：

### K.1 Node.js 版本（裁决 2 α Node 22.x；v2 修订显式 major-only）

**决议**：CI yml 固定 `node-version: '22'`（**仅 major 版本；不 pin patch 如 '22.20.0'**；让 setup-node 自动取 Node 22.x latest patch）。

**审视点**：是否同意 Node 22 而非 Node 20 LTS？是否需要主动添加 `.nvmrc` 让本地与 CI 显式一致？

**AI 建议**：保留 Node 22 major-only；不添加 .nvmrc（避免双重维护源；@types/node 已隐式约定）；本机实测 Node 22.20.0 仅作 baseline 留痕。

**v2 修订要点**：用户审视 v1 后明示要求 node-version 写法精确化为 `'22'`（major-only）；v1 草案已使用 `'22'` 但未显式声明此为有意决议；v2 在 §C 裁决 2 + 本节明示这是 v2 决议。

### K.2 vitest thresholds 升级值（裁决 6）

**决议**：lines/functions/statements 升至 84；branches 维持 75（KI-P8-005 结构性现象延续）。

**审视点**：functions 升至 84 是否过保守（当前 91.68%）？是否设 functions: 90 让覆盖率提升被强制保护？

**AI 建议**：保留 functions: 84 与 lines/statements 一致；K.2 锁定路径是统一升级而非分维度激进；Step 7 收官时再次审视。

### K.3 branch protection 由用户 UI 配置（裁决 7 + §G；v2 修订时序）

**决议**：本 Step 仅提供建议；用户在 GitHub UI 配置；**时序：PR 合并到 main 后配置**（v2 修订）。

**审视点**：是否同意"代码层面不落地 branch protection"？时序"合并前 vs 合并后"如何裁决？

**AI 建议（v2 修订）**：**PR 合并到 main 后配置**（避免鸡生蛋问题：GitHub UI Require status checks 需要从下拉列表选择 status check 名称；status check 名称只有在 workflow 至少在 main 跑过一次后才出现在下拉列表；合并前配置 → 下拉列表为空 → 无法选择 4 个 CI checks）。等价后果：本 Step PR 自身合并时 branch protection 不强制（CODEOWNERS auto-request review 仍生效），但合并后 status check 名称落地 main，用户 UI 配置后 Step 4+ PR 起 CI 强制门禁完全生效。详见 §G。

### K.4 CI 第一次运行的失败处置策略（§H.1）

**决议**：CI failure 时先核查 log 区分配置错误 vs 基础设施问题。

**审视点**：如果 CI 第一次运行失败（无论原因），是否需要在本 Step PR 内迭代修复，还是另开修复 PR？

**AI 建议**：本 Step PR 内迭代修复（force-push 让 PR commit 历史增多但 CI workflow 可用为终点；保持 PR 单一职责）。

---

## 等待用户回执（PHASE_DESIGN）

**v1 草案完成。请审视后回执三选一**：

- **APPROVE** — 进入 PHASE_IMPLEMENT 阶段（删除本草案文件 + 创建 .github/workflows/ci.yml + 修改 vitest config + 追加 CONTRIBUTING + ADR-0003 Step 3 段 + docs/phase10/04 + push + PR）
- **REQUEST_CHANGES + 反馈** — 草案需修改具体位置（譬如调整 Node 版本 / 调整 thresholds / 调整 branch protection 建议 / 等）
- **REJECT + 重大方向调整** — 整体方向需重新设计（譬如改用其他 CI 平台 / 改用单 job 串行 / 等）

**第二阶段 PHASE_IMPLEMENT 仅在收到明确 APPROVE 后启动。回执前不修改实际代码 / 不 push 任何内容**。

---

**Phase 10 / Step 3 PHASE_DESIGN 草案完成 — 2026-05-04**

拆两阶段流程第 4 次实战 + 普通 Step 级别首次。
