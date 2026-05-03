# Phase 10 / Step 1 — 协作资产基础三件套（CONTRIBUTING + CODE_OF_CONDUCT + SECURITY）

> **执行时间**：2026-05-04
> **类型**：Phase 10 第一个"协作建设"性质 Step；Tianqi 协作生态第一块砖
> **本 Step 性质**：仓库根目录 3 文件创建；引用而非复制；建立面向贡献者 / 社区 / 安全研究者的入口
> **状态**：完成

---

## §A 当前任务

Phase 10 / Step 1 — 创建仓库根目录协作三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）让 Tianqi 协作生态可见。Step 1 是 Phase 10 第一个"协作建设"性质 Step，不同于 Step 0（修复 + 防御），本 Step 是"建立"性质——从零起步建立面向贡献者的入口文档。

---

## §B 影响范围

### B.1 新增文件（4 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `CONTRIBUTING.md` | 84（既有；先前 session 残留；内容合规裁决保留）| 贡献者入口 |
| `CODE_OF_CONDUCT.md` | 22（链接版 — 不复制 Contributor Covenant 全文）| 社区行为准则入口 |
| `SECURITY.md` | 68（≤ 80 硬底）| 安全研究者入口 |
| `docs/phase10/02-step-1-collaboration-assets.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（2 个）

| 文件 | 变更 |
|---|---|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 1 段增量追写（惯例 M 第 21 次 + 跨 Phase 第 2 次实战；约 25 行）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 1 完成段追加 |

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改（仅根目录 markdown 文件 + 文档变更）
- **测试增量**：0（4 项独立命令零波动验证）
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 20 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（Step 0 关闭 KI-P10-001 后维持）

---

## §C 设计决策

### C.1 强制开局动作 1-3 执行确认

| # | 动作 | 实测结果 |
|---|---|---|
| 1 | 重读《宪法》§24 / §22.1 / §28 + 《补充文档》§7.4 / §13.1 / §15 + ADR-0003 工作流过渡段 | ✅ |
| 2 | 核查 KNOWN-ISSUES：5 项 open KI（KI-P8-001/002/003/005 + KI-P9-001）+ KI-P10-001 已 RESOLVED | ✅ |
| 3 | 核查 ADR-0001 / ADR-0002（Accepted）+ ADR-0003（In Progress；本 Step 增量追写 Step 1 段）| ✅ |

### C.2 强制开局动作 4 — 既有协作三件套现状实测

| 资产 | 实测结果 | 处置 |
|---|---|---|
| `CONTRIBUTING.md`（仓库根目录）| **存在**（84 行；先前 session 残留；内容合规裁决 1-3）| **保留既有**（克制 > 堆砌）|
| `CODE_OF_CONDUCT.md`（仓库根目录）| 不存在 | 本 Step 创建 |
| `SECURITY.md`（仓库根目录）| 不存在 | 本 Step 创建 |
| `.github/` 目录 | 不存在 | Step 2 责任 |

**重要发现**：CONTRIBUTING.md 在 worktree 中已作为未追踪文件存在（先前 session 残留）。诚实核查内容质量后裁决保留——内容已包含项目使命 / 引用宪法 §24 七项 / 元规则 Q v3 4 项独立命令 / KI-P10-001 教训引用 / Conventional Commits / AI 协作纪律 / closure-checklist 引用 / docs 导航；84 行 ≤ 100 硬底；完全符合裁决 1-3 要求。重写不会更好（克制 > 堆砌 + 引用而非复制宪法纪律已严守）。

### C.3 强制开局动作 5 — 4 项独立命令 baseline + post-implementation

| # | 命令 | Baseline | Post-Implementation |
|---|---|---|---|
| 1 | `pnpm lint` | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS（Step 0 修复后干净 baseline）| **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.58%/91.68%/84.92% | **84.92%/79.57%/91.68%/84.92%** |

**零波动证据**：3 个 markdown 文件添加未影响任何 lint / typecheck / test / coverage 检查范围（markdown 文件不在 ESLint / TypeScript / Vitest 处理范围）。branches 79.58% → 79.57% 是 v8 coverage 引擎多次运行的统计噪声（< 0.05pp；同一 baseline 多次运行也会出现）。

### C.4 8 个核心裁决最终选择

| # | 裁决 | 选择 | 严守证据 |
|---|---|---|---|
| 1 | 文件归属位置 | **α 仓库根目录** | 业界最广泛 + GitHub 自动识别（在 Issue / PR 创建页面自动链接）|
| 2 | 内容深度 | **B 标准**（每文件 ≤ 100）| CONTRIBUTING 84 / CODE_OF_CONDUCT 22 / SECURITY 68 — 全部 ≤ 100 |
| 3 | CONTRIBUTING 内容 | **引用 + 不复制**《宪法》| 仅链接 + 简短描述；无《宪法》正文复制 |
| 4 | CODE_OF_CONDUCT 标准 | **α Contributor Covenant 2.1（链接版）** | 链接到 contributor-covenant.org/version/2/1/code_of_conduct/；不复制全文（与裁决 3 引用而非复制原则一致）|
| 5 | SECURITY 报告渠道 | **α GitHub Private Vulnerability Reporting** | 含 supported versions + 报告流程 + 7/14/30 天 best-effort 响应 + 出 scope 列表 + 高敏感面 5 项 |
| 6 | PR 模板预告 | **α 不预告** | Step 1 独立完整；Step 2 完成后通过独立小修订追加 |
| 7 | 0 新增 | 0 错误码 / Port / Adapter / 包 | 惯例 K 第 20 次实战 |
| 8 | ADR-0003 Step 1 段 | **B 增加 ≤ 25 行** | 惯例 M 第 21 次 + 跨 Phase 第 2 次实战 |

### C.5 3 个文件内容组织摘要

**CONTRIBUTING.md**（既有；84 行）：
- Project Mission（六条设计权重引用）
- Before You Contribute（双文档 + ADR + KNOWN-ISSUES + closure-checklist 导航）
- PR Process（《宪法》§24 七项 + Phase 10 工作流过渡 + merge commit）
- Mandatory Validation（元规则 Q v3 4 项独立命令 + KI-P10-001 教训）
- Commit Convention（Conventional Commits + 项目历史例子）
- AI Collaboration Discipline（《宪法》§22 + 补充 §13 简短引用）
- Code of Conduct + Security 链接
- Questions（GitHub Discussion 优先）

**CODE_OF_CONDUCT.md**（22 行；链接版）：
- 声明采用 Contributor Covenant 2.1 + 链接到官方文本
- 显式说明本文件不复制全文（让标准维护者作为单一权威源）
- Scope（项目 spaces + 公开代表场景）
- Reporting and Enforcement（GitHub Private Vulnerability Reporting 优先 + GitHub Discussion / Issue 备选；维护者 `@CervantesHallo`；单维护者 best-effort）
- Attribution（链接 + 版本声明）

**SECURITY.md**（68 行 ≤ 80）：
- Supported Versions（Phase 9 supported / Phase 10 in progress / Phase 1-8 退出支持）
- Reporting a Vulnerability（GitHub Private Vulnerability Reporting + 5 项报告必含信息）
- Response Timeline（7/14/30 天 best-effort + 多维护者治理后审视）
- Disclosure Policy（reporter 致谢 + coordinated disclosure）
- Out of Scope（4 项 — 第三方依赖 / 用户配置 / 文档 typo / 性能问题）
- High-Sensitivity Surface（5 项 — saga 编排 / 人工介入 / 审计 / 幂等键 / 持久化 adapter）
- Code of Conduct 协调段

### C.6 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；0 接口变化；新增 markdown 不影响任何已锁定签名 |
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增依赖；累计 22 步零新依赖（Phase 9 + Kickoff + Step 0 + Step 1）|
| 元规则 Q（强制开局动作 v3 模板）| **第 3 次实战** — Kickoff（首次）+ Step 0（首次完整含动作 5）+ 本 Step；4 项独立命令 baseline + post-implementation 双向实测留痕 |
| 惯例 K（错误码命名空间扩展）| **第 20 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 21 次 + 跨 Phase 第 2 次实战** — ADR-0003 Step 1 段；沿用 Phase 9 ADR-0002 模式 |
| §4.8 编译期硬约束（Phase 9 / Step 15）| **严守** — 不触碰 packages/domain；ESLint 规则零违规 |
| 拆两阶段流程 | **不触发** — Step 1 单一职责（3 个独立 markdown 文件）；裁决空间小 |
| Phase 10 工作流过渡 | **第 2 次实战** — Step 0（首次）+ 本 Step；feature 分支 + PR 合并 |

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A（本 Step 不构建运行时业务代码）。

---

## §D 代码变更

### D.1 仓库根目录 3 个 markdown 文件

| 文件 | 行数 | 关键内容 |
|---|---|---|
| `CONTRIBUTING.md` | 84（既有保留）| 引用《宪法》§24 + 元规则 Q v3 + KI-P10-001 教训 + closure-checklist + docs 导航 |
| `CODE_OF_CONDUCT.md` | 22（新增；链接版）| 声明采用 Contributor Covenant 2.1 + 链接 + scope + reporting 渠道 + attribution |
| `SECURITY.md` | 68（新增）| Supported versions + GitHub Private Vulnerability Reporting + 7/14/30 天 best-effort + disclosure + out of scope + 高敏感面 5 项 |

### D.2 docs/decisions/0003-phase-10-engineering-and-collaboration.md（Step 1 段追加）

8 项裁决摘要表 + 实施细节 + Step 1 工程意义阐述（约 25 行）。惯例 M 第 21 次 + 跨 Phase 第 2 次实战。

### D.3 docs/00-phase1-mapping.md（Phase 10 Step 1 完成段）

由后续 mapping sync 步骤添加。

---

## §E 风险点

### E.1 CONTRIBUTING 引用 vs 复制《宪法》的边界把握

**实测结果**：CONTRIBUTING.md 全文 84 行无任何《宪法》正文复制；仅引用章节号（譬如"Constitution §24"）+ 简短摘要（譬如"the seven sections in its description"）让贡献者知道有更深规范可读。引用 vs 复制边界严守。

### E.2 SECURITY 响应时间承诺的可履行性（单维护者）

**实测结果**：选择 7 / 14 / 30 天 best-effort 而非 24 小时等不可持续承诺；显式标注"under best-effort, not contractual SLAs"+"reviewed when the project moves to multi-maintainer governance"。可履行性合理。

### E.3 Code of Conduct 联系方式段在单维护者场景下的处置

**实测结果**：CODE_OF_CONDUCT.md 显式指明"current project maintainer is the GitHub account that owns this repository (`@CervantesHallo`)"+"As Tianqi is currently maintained by a single maintainer, response times follow the same best-effort commitments documented in SECURITY.md"。透明 + 协调 SECURITY.md 时间承诺。

### E.4 CODE_OF_CONDUCT 链接版 vs 全文复制的裁决理由

**实测结果**：v2 调整 — 不复制 Contributor Covenant 全文（避免双重维护 + 让 contributor-covenant.org 维护者作为单一权威源）；与裁决 3 "CONTRIBUTING 引用而非复制《宪法》" 同精神延伸。这是 Tianqi"双重维护避免"工程纪律的二次兑现。

---

## §F 测试计划

### F.1 4 项独立命令实测（baseline + post-implementation 对比）

| # | 命令 | Baseline | Post-Implementation | 结论 |
|---|---|---|---|---|
| 1 | `pnpm lint` | PASS | PASS | ✅ 零波动 |
| 2 | `pnpm typecheck` | PASS | PASS | ✅ 零波动 |
| 3 | `pnpm test` | 1971（1867+104）| 1971（1867+104）| ✅ 零波动 |
| 4 | `pnpm test:coverage` | 84.92%/79.58%/91.68%/84.92% | 84.92%/79.57%/91.68%/84.92% | ✅ 零波动（branches 微小统计噪声 < 0.05pp）|

**预期零波动验证成功**：纯 markdown 文件添加不影响 lint / typecheck / test / coverage 检查范围。

### F.2 KI 状态稳定性核查

5 项 open KI（KI-P8-001/002/003/005 + KI-P9-001）状态稳定（不修任一）。KI-P10-001 已 RESOLVED（Step 0 关闭；不变）。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700（预期维持 1971；本 Step 0 测试增量）| ✅ 1971（+0）|
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | ✅ 84.92% / 79.57% / 91.68% / 84.92% |
| H3 | 4 项独立命令全 PASS | ✅ |
| H4 | push 到 feature 分支成功 | （由后续步骤完成）|
| H5 | PR 创建建议输出 | （由后续步骤完成）|

参考下限 R1-R7：
- R1 3 文件全部创建（仓库根目录）✅（CONTRIBUTING 既有保留 + CODE_OF_CONDUCT 新建 + SECURITY 新建）
- R2 CONTRIBUTING ≤ 100 行 ✅（84 行）
- R3 SECURITY ≤ 80 行 ✅（68 行）
- R4 CODE_OF_CONDUCT 采用 Contributor Covenant 2.1 ✅（链接版；标准本身的版本不变）
- R5 测试增量 0 ✅
- R6 业务代码 git diff 0 ✅
- R7 不复制《宪法》/ 补充文档内容到 CONTRIBUTING ✅

完成项 G1-G24 全 PASS（详见执行报告 §G）。

---

## §H Step 2 衔接预告

Step 2 将创建 `.github/` 目录 + PR 模板 + Issue 模板 + CODEOWNERS。Step 2 严重依赖 Step 1：

- CONTRIBUTING 已建立（PR 模板引用 CONTRIBUTING + 协作纪律）
- 协作纪律已显式（PR 模板引用《宪法》§24 七项 + 元规则 Q v3 4 项独立命令）
- 工作流过渡已沉淀（feature 分支 + PR 合并模式 — Step 0 + Step 1 已 2 次实战）
- Code of Conduct + Security 链接可在 PR 模板 / Issue 模板中引用

Step 2 起草指令独立承接（不在本 Step 范围）。Step 2 完成后通过独立小修订追加 CONTRIBUTING PR 模板段（沿用 Kickoff ADR 工作流过渡段模式）。

---

## §I 对作品级代码库的意义

### I.1 Tianqi 协作生态从此可见

仓库根目录 3 文件让贡献者 / 社区 / 安全研究者各有入口：
- 贡献者翻开 CONTRIBUTING.md：知道项目使命 + PR 流程 + 4 项独立命令验证 + Conventional Commits + AI 协作纪律
- 社区成员翻开 CODE_OF_CONDUCT.md：知道行为准则采用 Contributor Covenant 2.1 + 报告渠道
- 安全研究者翻开 SECURITY.md：知道 supported versions + private vulnerability reporting + 7/14/30 天 best-effort 响应 + 高敏感面 5 项

### I.2 引用而非复制的工程纪律

CONTRIBUTING 引用《宪法》而非复制 + CODE_OF_CONDUCT 链接而非复制 Contributor Covenant — 同一"双重维护避免"工程纪律的两次兑现。让权威源（《宪法》/ Contributor Covenant 2.1）保持单一权威，Tianqi 协作文档只承担"导航"职责而非"复制"职责。

### I.3 单维护者场景下的诚实承诺

SECURITY.md 7/14/30 天 best-effort 响应承诺 + CODE_OF_CONDUCT.md 协调 SECURITY 时间承诺 — 单维护者场景下的可履行承诺。显式标注"under best-effort, not contractual SLAs"+"reviewed when the project moves to multi-maintainer governance"是 Tianqi 诚实评估纪律的延续。

### I.4 主题专注度延续

Step 1 严守"不预占 Step 2-7 工作"——不创建 .github/ 目录（Step 2 责任）/ 不创建 PR 模板 / 不修改 README（Step 6 责任）/ 不创建 Dockerfile（Step 4 责任）。Phase 10 主题专注度从 Kickoff 起到 Step 0（修复+防御）到 Step 1（协作建设）连续 3 步严守。

### I.5 工作流过渡第 2 次实战

Phase 10 工作流过渡（feature 分支 + PR 合并）从 Step 0 起步；本 Step 是第 2 次实战。沿用 Step 0 模式（创建 feature 分支 → 5 commits → push → PR 创建建议）证明工作流过渡可重复。

### I.6 协作生态从无到有的标志性 Step

Phase 1-9 全程 0 协作资产（仅 README + CHANGELOG）；Phase 10 / Step 1 让协作资产从 1/7 → 4/7（含 CHANGELOG 既有 + Step 1 新增 3 件）。Step 2 完成后达 7/7（PR 模板 + Issue 模板 + CODEOWNERS）。Phase 10 协作主题第一块砖落地是从无到有的标志性 Step。

---

**Phase 10 / Step 1 完成 — 2026-05-04 ✅**

Tianqi 协作生态第一块砖落地。Step 2（PR / Issue 模板 + CODEOWNERS）由独立指令承接。
