# Phase 10 / Step 3.5 — Phase 1-9 dist-based workspace 测试链修复 + 防御机制建立

> **执行时间**：2026-05-04
> **类型**：Phase 10 第二个"修复 + 防御"性质 Step（Step 0 是第一个）；拆两阶段流程第 5 次实战 + 普通 Step 级别第 2 次
> **本 Step 性质**：双层缺陷链 packaging 层修复；让 Tianqi 进入"干净环境真绿色"成熟度
> **状态**：完成（PHASE_DESIGN v1 → IMPLEMENT 二轮闭环；用户 v3 锁定方案 C）

---

## 🎯 双层缺陷链双层修复完成显式声明

**Phase 9 closure 工程教训双层缺陷链双层修复 ✅**（Phase 10 / Step 0 + Step 3.5 共同闭环；2026-05-04）

| 层级 | KI | 责任 Step | 状态 |
|---|---|---|---|
| **第一层 typecheck** | KI-P10-001（vitest type-erasure 绕过；mock builder 字段不匹配）| Phase 10 / Step 0 | ✅ RESOLVED |
| **第二层 packaging** | KI-P10-002（dist-based workspace 在 fresh checkout 不工作）| Phase 10 / Step 3.5（本 Step）| ✅ RESOLVED（待 PR #6 + main CI 转绿确认）|

**双层共同价值**：Tianqi 从"未在干净环境验证过的真绿色"升级到"干净环境真绿色"成熟度。

---

## §A 当前任务

Phase 10 / Step 3.5 — 修复 KI-P10-002（dist-based workspace 在 fresh checkout 下 test 144 文件 FAIL）+ 建立防御机制（root build script + CI build 步 + CONTRIBUTING 修订 + closure-checklist 追加）。

---

## §B 影响范围

### B.1 新增文件（1 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `docs/phase10/05-step-3-5-test-chain-fix.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（6 个）

| 文件 | 变更 |
|---|---|
| `package.json` | 添加 `build` script + `test` / `test:coverage` 前置 `pnpm build &&`（裁决 2 β）|
| `.github/workflows/ci.yml` | test + coverage 两 job 在 install 后插入 `pnpm build` 步骤（裁决 3 A；防御深度）|
| `CONTRIBUTING.md` | `## Mandatory Validation` 段含 Prerequisites（install + build）+ 4 项命令注释分块 + 补强 2 typecheck/build 等价 Note |
| `docs/closure-checklist.md` | 顶部加 "## fresh checkout 验证防御（Phase 10 / Step 3.5 教训）" 段 |
| `docs/KNOWN-ISSUES.md` | 落地 KI-P10-002（含双层缺陷链 + 长期监控阈值）|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 3.5 段增量追写（惯例 M 第 24 次 + 跨 Phase 第 5 次；含双层缺陷链留痕 + §E.1 fallback 兑现 + 补强 1 typecheck/build 语义重叠）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 3.5 完成段追加 |

### B.3 删除文件（1 个）

| 文件 | 原因 |
|---|---|
| `docs/phase10/PHASE-10-STEP-3-5-DESIGN-DRAFT.md` | PHASE_DESIGN 阶段草案；设计沉淀进 ADR-0003 + 修复落地文件 |

### B.4 业务代码 / 测试 / lockfile

- **业务代码**：0 修改（仅 build/test 配置 + 文档）
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 22 次实战）
- **workspace 包数**：维持 25
- **KI 状态变更**：KI-P10-002 open → RESOLVED（修复完成；双重 baseline 实测验证；待 PR #6 + main CI 转绿确认）；其他 5 项不变

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§17/§4.8 + 《补充文档》§7.1/§7.2/§13.1 + ADR-0003 §E.1 fallback + closure-checklist；KI 5 项 open + KI-P10-001 RESOLVED 核查；ADR-0001/0002 Accepted + ADR-0003 In Progress 核查（Step 0/1/2/3 段已增量追写）。

### C.2 强制开局动作 4 — 七项实地核查（A-G）

| # | 核查项 | 实测结果 |
|---|---|---|
| A | workspace 包配置 | 全部 `main: dist/index.js` + `type: module`（KI-P10-002 根因坐实）|
| B | root scripts | **无 `build` script**；test/test:coverage 直接调 vitest |
| C | ci.yml | 4 jobs；test/coverage job 在 install 后**无 build 步**（直接根因）|
| D | fresh build 时长 | 1 fresh full **5.02s** / 2 增量 0 改动 **0.28s** ≤ 2s 阈值 / 3 增量 1 改动 0.67s |
| E | §17 命令规范协调 | §17 不明禁；§7.2 一致性优先；β 安全 |
| F | vitest config 现状 | thresholds 84/75/84/84（Step 3 已设置；本 Step 不修改）|
| G | KI-P10-001 干净环境验证 | fresh checkout 下 typecheck PASS（Step 0 真 RESOLVED；范围不需扩张）|

### C.3 强制开局动作 5 — 4 项独立命令双重 baseline 实测

| # | 命令 | Baseline A（local 残留）| Baseline B（fresh 修复前）| Baseline B（fresh 修复后）|
|---|---|---|---|---|
| 1 | `pnpm lint` | PASS | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS | PASS | **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| **❌ 144 failed** | **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.56%/91.68%/84.92% | **❌ 144 failed** | **84.91%/79.5%/91.68%/84.91%** |

**修复完整性硬证据**：fresh checkout 修复后 4 项命令全 PASS；与 local 残留环境完全等价；§7.2 严守。

### C.4 10 个核心裁决最终选择

详见 ADR-0003 Step 3.5 段表格。**v1 → IMPLEMENT 0 修订**（v1 接口冻结后实施完整对齐 + 用户 APPROVE 时 2 项补强落地）。

### C.5 用户 APPROVE 时 2 项补强落地

| 补强 | 内容 | 归属位置 | AI 实地裁决理由 |
|---|---|---|---|
| 1 | typecheck/build 语义重叠留痕（10-15 行）| **ADR-0003 Step 3.5 段** | rationale 在 ADR；closure-checklist 保持运行时 checklist 焦点；closure-checklist 总长 85 ≤ 100 安全裕度 |
| 2 | CONTRIBUTING 加 typecheck/build 等价 + CI job 隔离 1 行注释 | **CONTRIBUTING.md `## Mandatory Validation` 段末尾 Note** | 贡献者第一次看到 4 项命令时立即明白 typecheck/build 重叠的设计意图 |

### C.6 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；workspace 包 main / module / exports 字段未修改 |
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增依赖；累计 25 步零新依赖（Phase 9 + Phase 10 Kickoff + Step 0/1/2/3/3.5）|
| 元规则 Q（强制开局动作 v3 模板）| **第 6 次实战 + 首次双重 baseline 实测** — Kickoff + Step 0/1/2/3 + 本 Step；7 项实地核查 A-G + dual baseline A/B |
| 惯例 K（错误码命名空间扩展）| **第 22 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 24 次 + 跨 Phase 第 5 次实战** — ADR-0003 Step 3.5 段（含双层缺陷链留痕 + §E.1 fallback 兑现 + 补强 1）|
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | **第 5 次实战 + 普通 Step 级别第 2 次**（Step 3 + 本 Step）|
| Phase 10 工作流过渡 | **第 6 次实战**（Kickoff + Step 0/1/2/3 + 本 Step；feature 分支 + PR 合并）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

### D.1 root package.json（裁决 2 β）

```json
"scripts": {
  "build": "tsc -b tsconfig.json",          // 新增
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -b tsconfig.json",      // 与 build 语义重叠（补强 1 留痕）
  "test": "pnpm build && vitest run",       // 修改：前置 pnpm build
  "test:coverage": "pnpm build && vitest run --coverage",  // 修改：前置 pnpm build
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

### D.2 .github/workflows/ci.yml（裁决 3 A）

test + coverage 两 job 各自添加 `- run: pnpm build` 步骤（防御深度；CI log 清晰）。lint + typecheck job **不加**（typecheck job 自身就是 build 等价；lint 不依赖 dist）。

### D.3 CONTRIBUTING.md（裁决 4 α + 补强 2）

`## Mandatory Validation` 段：
- Prerequisites 注释块（install + build；per KI-P10-002）
- Four mandatory validation commands 注释块（4 项独立命令保留）
- 末尾 Note 段（typecheck/build 语义重叠 + CI job 隔离纪律；补强 2）

CONTRIBUTING.md 94 → **100 行**（≤ 100 硬底）。

### D.4 docs/closure-checklist.md（裁决 5 α）

顶部新增 "## fresh checkout 验证防御（Phase 10 / Step 3.5 教训）" 段（约 15 行）。closure-checklist.md 72 → **85 行**（≤ 100 硬底）。

### D.5 docs/KNOWN-ISSUES.md（裁决 6）

新增 KI-P10-002 段（含状态 + 发现于 + 位置 + 错误明细 + 根因 + 关键工程纪律边界 + 修复责任 + 防御机制 + 长期监控 + 关联教训双层缺陷链 + Step 3 工程价值确认）。

### D.6 docs/decisions/0003-phase-10-engineering-and-collaboration.md（裁决 7 + 补强 1）

Step 3.5 段约 70 行（惯例 M 第 24 次 + 跨 Phase 第 5 次实战）。含：
- 双层缺陷链留痕（Step 0 + Step 3.5）
- §E.1 fallback 兑现（Step 3 设计阶段已留好出口）
- 关键工程纪律边界（"未在干净环境验证过的真绿色"措辞严守）
- 10 项裁决摘要
- 补强 1 typecheck/build 语义重叠留痕（独立小节）
- 实施细节
- 修复完整性证据（双重 baseline）
- Step 3.5 工程意义阐述

---

## §E 风险点

### E.1 fresh checkout 模拟与真实 CI 环境的细微差异

**实测结果**：本机 fresh checkout 模拟（删 .tsbuildinfo + dist）4 项命令全 PASS；理论上与真实 CI 环境（无任何残留 + 全新 pnpm install + Ubuntu OS）等价。**风险残余**：CI runner 可能因 OS / 网络 / pnpm cache 行为与本机不同；PR #6 CI 第二次运行将真实验证。

**Fallback**：CI FAIL 时核查 log；区分配置错误 vs 基础设施问题；前者追加 fix commit（沿用 Step 3 §E.1 fallback 模式）。

### E.2 α/β 防御补强 β 副作用确认

**实测结果**：增量 build 0.28s ≤ 2s 阈值；50 次/day 多耗 ≈ 14s/day；可接受。**副作用**：`pnpm test` 直接调用 vitest 的 IDE 调试快捷方式失效；contributors 需用 `pnpm exec vitest <args>` 绕过路径（CONTRIBUTING.md 暗示了独立验证 4 命令的纪律，IDE 调试是开发体验非纪律范畴）。

### E.3 KI-P10-002 长期监控阈值合理性

**当前阈值**：fresh build 5s（已逼近）/ 增量 2s（远高于当前 0.28s）/ 25 包（当前等于）/ 5 contributors（远高于当前 1）。**合理性确认**：阈值基于当前 baseline 估算；后续 ADR 修订流程可调整；不阻塞本 Step。

### E.4 branch protection 配置时机协调

**应对**：用户在 PR #6 合并 + main CI 转绿后再配置 branch protection（沿用 Step 3 §G 时序裁决）。Step 3.5 PR #6 合并不强制 branch protection；Step 4+ PR 起 branch protection 真正生效。

### E.5 Step 3 工程价值不被误解为"失败"

**应对**：ADR-0003 Step 3.5 段 + KI-P10-002 + 本启程记录严守"未在干净环境验证过的真绿色"措辞；明示 Step 3 工程价值（CI 第一次启用揭露未覆盖路径是合理价值兑现）。

---

## §F 测试计划

### F.1 双重 baseline 实测对比表

| 维度 | Baseline A（local 残留）| Baseline B（fresh 修复前）| Baseline B（fresh 修复后）|
|---|---|---|---|
| `pnpm lint` | PASS | PASS | **PASS** |
| `pnpm typecheck` | PASS | PASS（5s 全量 build 副作用产生 dist）| **PASS** |
| `pnpm test` | **1971（1867+104）** | **❌ 144 failed | 38 passed** | **1971（1867+104）** |
| `pnpm test:coverage` | **84.92%/79.56%/91.68%/84.92%** | **❌ 144 failed | 38 passed** | **84.91%/79.5%/91.68%/84.91%** |

**修复完整性硬证据**：
- baseline B 修复前 vs 修复后 test 文件数从 144 FAIL → 175 PASS（**144 failed → 0 failed**）
- baseline A vs baseline B 修复后完全等价（§7.2 严守；fresh CI 与本地一致）
- coverage 微小差异（84.92% → 84.91%；79.56% → 79.5%）是 v8 统计噪声 < 0.1pp；门槛全部达标

### F.2 KI 状态稳定性核查

- KI-P8-001/002/003/005 + KI-P9-001（5 项 open）：稳定（不变）
- KI-P10-001：RESOLVED（Step 0 关闭；干净环境验证有效）
- **KI-P10-002**：open → RESOLVED（本 Step 修复完成；待 PR #6 + main CI 转绿确认）

### F.3 CI workflow 自身实测计划

PR #6 创建后 CI 第一次运行（feature 分支 pull_request 触发）；merge 后 CI 在 main 第二次运行（push to main 触发）。具体结果在 §G CI Iteration 段填入。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数（fresh checkout 模拟）≥ 1700 | ✅ 1971（1867+104）|
| H2 | 覆盖率（fresh checkout 模拟）≥ 80%/75%/80%/80% | ✅ 84.91%/79.5%/91.68%/84.91%（全部 ≥ 84/75/84/84 thresholds）|
| H3 | 4 项独立命令双重 baseline 全 PASS | ✅ A 全 PASS / B 修复后全 PASS |
| H4 | push feature 分支成功 | （由后续步骤完成）|
| H5 | CI workflow 在本 Step PR 第二次运行 PASS | （待 PR #6 创建后实测）|
| H6 | main CI 转绿验证 | （待 PR #6 合并后实测）|
| H7 | KI-P10-002 落地 KNOWN-ISSUES.md | ✅ |
| H8 | ADR-0003 Step 3.5 段含双层缺陷链留痕 | ✅ |

参考下限 R1-R9 全 PASS：R1 root build script ✅ / R2 ci.yml build 步插入 ✅ / R3 CONTRIBUTING 更新 ✅ / R4 closure-checklist 更新 ✅ / R5 §E.1 fallback 兑现留痕 ✅ / R6 措辞严守 ✅ / R7 不修改 workspace main 字段 ✅ / R8 业务代码 git diff 0 ✅ / R9 测试增量 0 ✅。

完成项 G1-G24 全 PASS。

### §G.1 CI Iteration 留痕（Step 3 教训沉淀）

| 第 N 次 | 触发分支 | 4 jobs 状态 | 失败原因 | 修复 commit SHA |
|---|---|---|---|---|
| Step 3 PR #5 Run #1 | feature (PR) | ❌ test + coverage failed | KI-P10-002 packaging defect | （Step 3.5 修复）|
| Step 3 PR #5 Run #2 | main (push) | ❌ test + coverage failed | KI-P10-002 packaging defect（同上）| （Step 3.5 修复）|
| **Step 3.5 PR #6 Run #1** | feature (PR) | ⏳ 待 PR #6 创建后实测 | - | - |
| **Step 3.5 PR #6 Run #2** | main (push) | ⏳ 待 PR #6 合并后实测 | - | - |

**iteration 纪律**：force-push 不抹掉失败历史；如 CI FAIL 追加 fix commit；本段同步更新失败次数 + 失败原因 + 修复 commit SHA；ADR-0003 + PR 描述同步留痕。

---

## §H Step 4 衔接预告

Step 4 创建 Dockerfile 多阶段构建 + 非 root + 健康检查 + docker-compose 开发编排。Step 4 严重依赖 Step 3.5：

- main CI 真正绿（fresh checkout 真绿色 baseline）
- 双层缺陷链双层修复完成（Step 0 + Step 3.5）
- root build script + ci.yml build 步已就位（Dockerfile 多阶段构建可引用）
- KI-P10-002 RESOLVED
- branch protection 已在 GitHub UI 配置（main 转绿后用户操作；可选）

Step 4 起草指令独立承接（不在本 Step 范围）。Step 4 是否拆两阶段视具体设计复杂度（Dockerfile 多阶段构建在 Tianqi 25 包 monorepo 下可能复杂）。

---

## §I 对作品级代码库的意义

### I.1 双层缺陷链双层修复完成

Step 0（typecheck 层 KI-P10-001）+ Step 3.5（packaging 层 KI-P10-002）共属"Phase 9 closure 工程教训"双层缺陷链。两层修复让 Tianqi 工程纪律从"未在干净环境验证过的真绿色"升级到"干净环境真绿色"成熟度。这是 Phase 10 工程化基础设施的核心成果。

### I.2 §E.1 fallback 兑现

ADR-0003 Step 3 §E.1 fallback 已预言"CI failure 时核查 log；区分配置错误 vs 基础设施问题；前者修 yml + 追加 fix commit"。Step 3.5 是该 fallback 的具体兑现——证明"事前防御机制"在 Step 3 设计阶段已留好出口。拆两阶段流程的实证价值兑现。

### I.3 不污名 Phase 1-9 的工程纪律

用户 v3 补充 3 措辞校正——Phase 1-9 测试不是伪绿色，而是"未在干净环境验证过的真绿色"；CI 第一次启用揭露未覆盖路径是 Phase 10 工程化基础设施的合理价值。Tianqi 工程纪律严守"诚实评估 vs 污名表述"边界。

### I.4 拆两阶段流程在普通 Step 级别第 2 次实战

前 4 次拆两阶段实战：Phase 9 / Step 6 + Step 14（Step 启程级）+ Phase 10 Kickoff（Phase 启程级）+ Phase 10 / Step 3（普通 Step 级首次）。本 Step 是普通 Step 级别第 2 次——证明拆两阶段流程在普通 Step 级别的实证价值持续兑现（v1 草案 + 用户 APPROVE 时 2 项补强落地）。

### I.5 元规则 Q v3 模板首次双重 baseline 实测

本 Step 元规则 Q v3 模板第 6 次实战；首次引入双重 baseline 概念（A local 残留 + B fresh checkout 模拟）。这是元规则 Q v3 模板"4 项独立命令实测"的进一步精确化——不仅命令独立，环境也要 fresh 验证。closure-checklist 同步追加 fresh checkout 验证防御段，让此模式成为永久工程纪律。

### I.6 Phase 10 工程化基础设施真正成熟的标志

Step 3 揭露问题 + Step 3.5 修复完整 + main CI 真正绿（待 PR #6 合并后兑现）= Phase 10 工程化基础设施真正成熟的标志。Tianqi 累计 Phase 1-9（19 + 19 = 38 Step 业务能力）+ Phase 10 Step 0-3.5（5 Step 工程化基础）= 协作生态 7/7 + CI 强制门禁 + 双层缺陷链双层修复完整闭环。Step 4-7 在真正绿的 baseline 上推进。

---

**Phase 10 / Step 3.5 完成 — 2026-05-04 ✅**

**双层缺陷链双层修复完成**。Step 4（容器化）由独立指令承接；本 Step PR #6 合并 + main CI 转绿后用户可在 GitHub UI 配置 branch protection；Step 4+ PR 起受 CI + branch protection 强制保护。
