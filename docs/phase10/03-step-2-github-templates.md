# Phase 10 / Step 2 — .github/ 协作生态（PR 模板 + Issue 模板 + CODEOWNERS）

> **执行时间**：2026-05-04
> **类型**：Phase 10 第二个"协作建设"性质 Step；最关键协作落地
> **本 Step 性质**：.github/ 目录从无到有；GitHub UI 自动呈现协作纪律；协作资产 7 件套达 7/7
> **状态**：完成

---

## 🎯 协作资产 7/7 完整达成显式声明

**协作资产 7 件套：4/7 → 7/7 ✅**（Phase 10 / Step 2，2026-05-04）

| # | 资产 | 落地 Step |
|---|---|---|
| 1 | CHANGELOG.md | Phase 9 / Step 19 |
| 2 | CONTRIBUTING.md | Phase 10 / Step 1 |
| 3 | CODE_OF_CONDUCT.md | Phase 10 / Step 1 |
| 4 | SECURITY.md | Phase 10 / Step 1 |
| 5 | .github/PULL_REQUEST_TEMPLATE.md | **Phase 10 / Step 2（本 Step）** |
| 6 | .github/ISSUE_TEMPLATE/* | **Phase 10 / Step 2（本 Step）** |
| 7 | .github/CODEOWNERS | **Phase 10 / Step 2（本 Step）** |

**Phase 10 协作基础主题（Step 1 + Step 2）落地完成**。Step 3-7 进入工程化建设主题。

---

## §A 当前任务

Phase 10 / Step 2 — 创建 .github/ 协作生态（PR 模板 + Issue 模板 3 个 + config.yml + CODEOWNERS）让协作纪律在 GitHub UI 自动呈现。本 Step 完成后协作资产 7 件套达 7/7 完整。

---

## §B 影响范围

### B.1 新增文件（7 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `.github/PULL_REQUEST_TEMPLATE.md` | 57 ≤ 60 | PR 模板（七项 + 4 项命令 checkbox + Phase/Step Mapping + Checklist）|
| `.github/ISSUE_TEMPLATE/bug-report.md` | 48 ≤ 50 | bug 模板 |
| `.github/ISSUE_TEMPLATE/feature-request.md` | 38 ≤ 50 | 功能请求模板 |
| `.github/ISSUE_TEMPLATE/documentation-issue.md` | 40 ≤ 50 | 文档问题模板 |
| `.github/ISSUE_TEMPLATE/config.yml` | 16 | blank issues 禁用 + 3 contact_links 重定向 |
| `.github/CODEOWNERS` | 11 ≤ 15 | 全仓 fallback `* @CervantesHallo` + 升级路径注释 |
| `docs/phase10/03-step-2-github-templates.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（3 个）

| 文件 | 变更 |
|---|---|
| `CONTRIBUTING.md` | 追加 PR Template 段（4 行；84 → 90 行）|
| `docs/closure-checklist.md` | 追加既有资产核查防御段（9 行；63 → 72 行）|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 2 段增量追写（惯例 M 第 22 次 + 跨 Phase 第 3 次）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 2 完成段 + 7/7 完成段 |

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改（仅 .github/ 配置 + markdown 文档）
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 21 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（不变）

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§24/§22.1 + 《补充文档》§7.4/§13.1/§13.2 + ADR-0003（Step 0 + Step 1 + 工作流过渡段）+ CONTRIBUTING.md（Step 1 创建）；KI 5 项 open + KI-P10-001 RESOLVED 状态稳定核查；ADR-0001/0002 Accepted + ADR-0003 In Progress 核查。

### C.2 强制开局动作 4 — .github/ 现状双重核查（Step 1 教训防御）

| 命令 | 实测结果 |
|---|---|
| `git status --untracked-files=all` | working tree clean（0 未追踪文件）|
| `git ls-files .github/` | 空（0 已追踪文件）|
| `ls -la .github/` | directory does not exist |

**双重核查证据**：.github/ 目录与内部任何文件均不存在；本 Step 是从零创建。Step 1 揭示的"先前 session 残留"问题不重演（实测 working tree clean）。

### C.3 强制开局动作 5 — 4 项独立命令 baseline + post-implementation

| # | 命令 | Baseline | Post-Implementation |
|---|---|---|---|
| 1 | `pnpm lint` | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS | **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.57%/91.68%/84.92% | **84.92%/79.57%/91.68%/84.92%** |

**预期零波动验证成功**：.github/ 配置 + markdown 文件不在 ESLint / TypeScript / Vitest 检查范围；纯协作平台资产添加。

### C.4 8 个核心裁决最终选择

| # | 裁决 | 选择 | 严守证据 |
|---|---|---|---|
| 1 | PR 模板深度 | **B 标准**（30-60 行）| 实测 57 行 |
| 2 | Issue 模板 | **标准 3 模板 + config.yml** | bug-report 48 / feature-request 38 / documentation-issue 40 / config.yml 16；安全/讨论/行为准则 3 个 contact_links |
| 3 | CODEOWNERS | **A 全仓 fallback** | `* @CervantesHallo`；含未来多维护者升级路径注释 |
| 4 | CONTRIBUTING 同步 | **α 本 Step 追加** | 4 行追加（PR Template 段）；CONTRIBUTING 84 → 90 行 |
| 5 | dependabot | **α 不创建** | Phase 10 主题不含依赖管理；推迟 Phase 11+ 或 Phase 12 |
| 6 | 0 新增 | 0 错误码 / Port / Adapter / 包 | 惯例 K 第 21 次实战 |
| 7 | ADR-0003 Step 2 段 | **B 增加** | 惯例 M 第 22 次 + 跨 Phase 第 3 次实战 |
| 8 | 既有资产核查教训沉淀 | **β closure-checklist** | 追加双重命令防御段；checklist 63 → 72 行 ≤ 100 |

### C.5 .github/ 目录文件清单

```
.github/
├── CODEOWNERS                          (11 lines)
├── PULL_REQUEST_TEMPLATE.md            (57 lines)
└── ISSUE_TEMPLATE/
    ├── bug-report.md                   (48 lines)
    ├── feature-request.md              (38 lines)
    ├── documentation-issue.md          (40 lines)
    └── config.yml                      (16 lines)
```

总计 6 个文件，210 行。

### C.6 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改 |
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增依赖；累计 23 步零新依赖 |
| 元规则 Q（强制开局动作 v3 模板）| **第 4 次实战** — Kickoff + Step 0 首次完整 + Step 1 + 本 Step；4 项独立命令 baseline + post-implementation 双向实测；含双重核查防御（Step 1 教训沉淀） |
| 惯例 K（错误码命名空间扩展）| **第 21 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 22 次 + 跨 Phase 第 3 次实战** — ADR-0003 Step 2 段 |
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | 不触发（Step 2 单一职责；4 类协作平台资产标准模板）|
| Phase 10 工作流过渡 | **第 3 次实战**（Step 0 + Step 1 + 本 Step）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

详见 §B.1/B.2 表格。所有文件全部满足硬底（PR 模板 ≤ 60 / Issue 模板各 ≤ 50 / CODEOWNERS ≤ 15 / CONTRIBUTING ≤ 100 / closure-checklist ≤ 100）。

---

## §E 风险点

### E.1 PR 模板复杂度对贡献者负担影响

**实测结果**：57 行（30-60 范围）；七项各含简短引导（单段 HTML 注释）；4 项命令 checkbox 让贡献者按结构填写而非"理解模板意图"再填写。负担平衡——足够引导但不冗长。

### E.2 Issue 模板 config.yml 重定向可用性

**说明**：`blank_issues_enabled: false` 让 GitHub 强制使用模板（不允许 blank issue）；`contact_links` 在 GitHub UI "New Issue" 页面下方显示 3 个外部链接（Security / Discussion / Code of Conduct），让贡献者在创建 Issue 前看到正确去向。GitHub UI 实际行为依官方文档；merge 后用户可在 GitHub UI 实测验证。

### E.3 CODEOWNERS 在单维护者场景的实际效用

**说明**：`* @CervantesHallo` 让所有 PR 自动 request review 给单维护者——形成"自我审视"看似无意义；但保留工作流模式让多维护者升级时无需修改 PR 创建流程。当前价值：(1) GitHub UI PR 页面"Reviewers"段自动显示 @CervantesHallo；(2) 未来多维护者升级仅需修改 CODEOWNERS 一个文件。

### E.4 CONTRIBUTING 追加段与既有内容协调

**实测结果**：追加位置在 ## PR Process 段后（紧跟 merge method 段之后；在 ## Mandatory Validation 段之前）；新增 ### PR Template 子段引用 .github/PULL_REQUEST_TEMPLATE.md 不复制内容；CONTRIBUTING 84 → 90 行（仍 ≤ 100）。引用而不复制纪律严守。

### E.5 closure-checklist 追加后总长

**实测结果**：63 → 72 行（仍 ≤ 100 硬底）；新增"## 既有资产核查防御"段含双重命令 + 根因留痕。Step 1 教训沉淀完成；未来 Phase 强制开局动作 4 含双重核查防御。

---

## §F 测试计划

详见 §C.3。**4/4 PASS 零波动**（baseline 与 post-implementation 完全一致）。KI 5 项 open 稳定。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700 | ✅ 1971 |
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | ✅ 84.92%/79.57%/91.68%/84.92% |
| H3 | 4 项独立命令全 PASS | ✅ |
| H4 | push 到 feature 分支成功 | （由后续步骤完成）|
| H5 | PR 创建建议输出 | （由后续步骤完成）|
| H6 | 协作资产 7 件套达 7/7 | ✅ |

参考下限 R1-R9 全 PASS（详见 §G 列表）。完成项 G1-G24 全 PASS。

---

## §H Step 3 衔接预告

Step 3 创建 GitHub Actions CI workflow（lint + typecheck + test + coverage 84% 起步门槛）。Step 3 严重依赖 Step 2：

- .github/ 目录已建立（CI workflow 路径 .github/workflows/）
- PR 模板已建立（CI 触发后 PR check 状态显示）
- CODEOWNERS 已建立（CI 触发后 request review 自动分配）
- 元规则 Q v3 模板 4 项独立命令已成 PR 模板必填项

Step 3 起草指令独立承接（不在本 Step 范围）。Step 3 可能值得拆两阶段——CI workflow 设计影响 Phase 10 全程 + Phase 11+ 持续；具体由 Step 3 起草指令实地判断。

---

## §I 对作品级代码库的意义

### I.1 协作资产 7/7 完整达成

Phase 1-9 全程 0 协作资产（仅 README + CHANGELOG）；Phase 10 / Step 1 让协作三件套落地（4/7）；本 Step 让 .github/ 协作生态从无到有（7/7）。Tianqi 协作生态完整闭环。

### I.2 GitHub UI 自动呈现协作纪律

PR 模板七项 + 4 项命令 checkbox 在 GitHub UI 创建 PR 时自动加载——贡献者无需读 CONTRIBUTING 也能按结构填写；config.yml 重定向让安全报告 / 讨论 / 行为准则不被错误归为 Issue。协作纪律从"文档可读"升级为"平台原生体验"。

### I.3 Step 1 教训沉淀完成

Step 1 揭示"先前 session 残留 CONTRIBUTING.md 未追踪"问题；本 Step 强制开局动作 4 双重核查 + closure-checklist 追加既有资产核查防御段——Step 1 教训从"本 Step 防御"扩展到"未来所有 Phase Step 防御"。诚实评估纪律的工程化沉淀。

### I.4 主题专注度延续 4 步严守

Phase 10 主题专注度从 Kickoff（启程战）+ Step 0（修复 + 防御）+ Step 1（协作建设）+ 本 Step（协作建设）连续 4 步严守。本 Step 不创建 GitHub Actions workflow（Step 3 责任）/ 不创建 Dockerfile（Step 4 责任）/ 不创建 dependabot.yml（裁决 5 α）；克制 > 堆砌。

### I.5 Phase 10 协作基础主题落地完成

Step 1（项目级文档）+ Step 2（GitHub 平台原生体验）双 Step 落地。Phase 10 协作基础主题主体落地完成；Step 3-7 进入工程化建设主题（CI / 容器化 / 发布 / 文档 / 收官）。

### I.6 工作流过渡第 3 次实战

Phase 10 工作流过渡（feature 分支 + PR 合并）从 Step 0 起步；本 Step 是第 3 次实战。沿用既定模式（feature 分支 → 7 commits → push → PR 创建建议）证明工作流过渡稳定可重复。

---

**Phase 10 / Step 2 完成 — 2026-05-04 ✅**

**协作资产 7 件套达 7/7 完整**。Step 3（CI 强制门禁）由独立指令承接；Phase 10 协作基础主题落地完成；进入工程化建设主题。
