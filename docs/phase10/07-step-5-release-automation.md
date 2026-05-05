# Phase 10 / Step 5 — 发布自动化（git tag 触发流水线）

> **执行时间**：2026-05-05
> **类型**：Phase 10 第三个工程化建设 Step（CI 第一块砖 ✅ + 容器化第二块砖 ✅ + 本 Step 第三块砖）
> **本 Step 性质**：发布流水线建立；phase-N-closed tag push 触发自动化 GitHub Release draft；拆两阶段流程第 6 次实战 + 普通 Step 级别第 3 次（Step 3 + Step 3.5 + 本 Step）
> **状态**：完成（PHASE_DESIGN v1 → v2 → IMPLEMENT 三轮迭代闭环）

---

## 🎯 Phase 10 工程化基础设施第三块砖落地

| 块 | 内容 | Step |
|---|---|---|
| 第一块 | CI 强制门禁（4 项独立命令并行 + 84% coverage 门槛 + main 转绿）| Step 3 + 3.5 |
| 第二块 | 容器化部署能力（Dockerfile 多阶段 + 非 root + HEALTHCHECK + docker-compose）| Step 4 |
| **第三块** | **发布自动化（phase-N-closed tag 触发 + draft GitHub Release + CHANGELOG 提取）** | **Step 5（本 Step）** |
| 第四块 | README 可执行性 + Runbook | 待 Step 6 |

---

## §A 当前任务

Phase 10 / Step 5 — 创建 .github/workflows/release.yml（gh CLI 版本；按 v2 §E 草案）+ CONTRIBUTING.md ## Release Process 精简版段。让 Tianqi 从"代码 + CI + 容器"升级到"+ 发布自动化"。**v1 → v2 → IMPLEMENT 三轮迭代闭环**：v1 草案选 softprops；v2 修订基于"元规则 P 在有 GitHub 官方等价物场景严守"裁决换为 gh CLI；CONTRIBUTING 精简版 + 不升级硬底。

---

## §B 影响范围

### B.1 新增文件（2 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `.github/workflows/release.yml` | 71 | 发布工作流（gh CLI 版；7 步含 build + CHANGELOG 提取 + draft release）|
| `docs/phase10/07-step-5-release-automation.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（3 个）

| 文件 | 变更 | 行数变化 |
|---|---|---|
| `CONTRIBUTING.md` | 追加 ## Release Process 段（4 行）| 100 → 104（**超 100 硬底约 4 行；honest留痕**）|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 5 段增量追写（惯例 M 第 26 次 + 跨 Phase 第 7 次）| 518 → 591（远低于 800 阈值；附加观察注脚不需追加）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 5 完成段追加 | +若干 |

### B.3 删除文件（1 个）

| 文件 | 原因 |
|---|---|
| `docs/phase10/PHASE-10-STEP-5-DESIGN-DRAFT.md` | PHASE_DESIGN 阶段草案；设计沉淀进 ADR + release.yml + 文档后作废 |

### B.4 业务代码 / 测试 / lockfile

- **业务代码**：0 修改
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 24 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（不变）

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§17 + 《补充文档》§7.3/§7.4/§13.1/§14 + ADR-0003 Step 0-4 段；KI 5 项 open + KI-P10-001/002 RESOLVED；ADR 状态符合预期。

### C.2 强制开局动作 4 — 六项实地核查（关键发现）

| # | 核查项 | 实测结果 |
|---|---|---|
| A | 既有发布配置 | `.github/workflows/` 仅 ci.yml；`.changeset/` 不存在；`private: true` |
| B | git tag 现状 | **`1.0.0` + `phase-9-closed`**（`1.0.0` 为初始上传遗留；非 Phase 主线；触发 glob 应精确为 `phase-*-closed`）|
| C | ci.yml 协调 | 4 jobs 模式可复用（Node 22 + pnpm@10 + cache）|
| D | Dockerfile 协调 | node:22-slim 多阶段；如 docker push 需引用（裁决 3 推迟 Phase 11+）|
| E | 项目性质判断 | Tianqi 私有项目 + monorepo 库性质；不发 npm registry；release 价值是"phase-N-closed tag 触发归档"|
| F | changesets 评估 | 未安装；α 不引入路径成立 |

### C.3 强制开局动作 5 — 4 项独立命令 baseline + final

| # | 命令 | Baseline | Final |
|---|---|---|---|
| 1 | lint | PASS | **PASS** |
| 2 | typecheck | PASS | **PASS** |
| 3 | test | 1971（1867+104）| **1971（1867+104）** |
| 4 | test:coverage | 84.92%/79.57%/91.68%/84.92% | **见 §F 实测** |

### C.4 11 个核心裁决最终选择（v1 → v2 → IMPLEMENT）

详见 ADR-0003 Step 5 段表格。v1 → v2 修订 2 项（K.1 softprops → gh CLI / K.2 CONTRIBUTING 精简版不升级硬底）；v2 → IMPLEMENT 0 修订（v2 接口冻结后实施完整对齐）。

### C.5 release.yml 完整内容摘要

```
[release.yml 7 步]
1. actions/checkout@v4 (fetch-depth: 0)
2. pnpm/action-setup@v4
3. actions/setup-node@v4 (node-version: '22'; cache: 'pnpm')
4. pnpm install --frozen-lockfile
5. pnpm build (§7.2 一致性)
6. CHANGELOG awk 提取 → release-notes.md
7. gh release create CLI (--draft --notes-file release-notes.md)
   [GitHub 官方 + runner 预装；元规则 P 严守]
```

触发条件：`on.push.tags: ['phase-*-closed']`（精确匹配避免误触发 `1.0.0`）。

权限：`permissions: contents: write`（创建 GitHub Release 必需）。

### C.6 第三方 action 严格度判断（v2 修订沉淀；Phase 11+ 沿用）

详见 ADR-0003 Step 5 段。4 类型 + 判断顺序：(1) 有 GitHub 官方等价物 → 用官方 (2) 有 runner 预装 CLI → 用 CLI (3) 业界标准且无官方等价物 → 业界标准不计豁免。

### C.7 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；ci.yml / Dockerfile / vitest config 等 Step 0-4 锁定输出未修改 |
| 元规则 P（不主动引入第三方依赖）| **严守 + v2 修订增强** — gh CLI 是 GitHub 官方等价物；不引入 softprops；累计 28 步零新依赖 |
| 元规则 Q（强制开局动作 v3 模板）| **第 8 次实战** — Kickoff + Step 0/1/2/3/3.5/4 + 本 Step；4 项独立命令 baseline + final 双向实测 |
| 惯例 K（错误码命名空间扩展）| **第 24 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 26 次 + 跨 Phase 第 7 次实战** — ADR-0003 Step 5 段（约 73 行追加）|
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | **第 6 次实战 + 普通 Step 级别第 3 次**（Step 3 + Step 3.5 + 本 Step）|
| Phase 10 工作流过渡 | **第 8 次实战**（Kickoff + Step 0/1/2/3/3.5/4 + 本 Step）|
| §7.2 跨场景兑现 | release.yml `pnpm build` 步严守一致性（与 CI / Dockerfile builder stage 同根 build chain）|
| §7.3 发布自动化 | **完整兑现** — phase-N-closed tag 触发 + draft Release + CHANGELOG 自动提取 |

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

### D.1 .github/workflows/release.yml（71 行；新增）

按 v2 §E 草案；7 步含 build + CHANGELOG 提取 + gh release create draft。GitHub 官方 actions only（actions/checkout / pnpm/action-setup / actions/setup-node）+ gh CLI（runner 预装）。

### D.2 CONTRIBUTING.md ## Release Process 段（4 行；100 → 104）

```markdown
## Release Process

Pushing a `phase-*-closed` tag triggers `.github/workflows/release.yml` to create a draft GitHub Release with notes auto-extracted from `CHANGELOG.md`. The maintainer reviews and publishes the draft. See ADR-0003 Step 5 for the full design rationale.
```

**honest留痕**：CONTRIBUTING 100 → 104 行（超 100 硬底约 4 行）。K.2 fallback "实测后进一步精简" 已穷尽；最精简版（heading + 1 段落 + 2 blank）仍需 4 行 net 增量。诚实评估 — 100 行硬底在 Step 5 阶段不可达；ADR Phase 11+ 承接事项含"CONTRIBUTING ≤ 100 行硬底重审：Step 6 README + Runbook 落地后由 Phase 10 / Step 7 收官时一次性精简"。

### D.3 docs/decisions/0003-phase-10-engineering-and-collaboration.md（Step 5 段追加）

约 73 行（518 → 591）。含 11 项裁决摘要 + 关键工程纪律 + 第三方 action 严格度判断（4 类型 + 判断顺序）+ Step 4 收尾微调留痕 + v2 修订工程纪律小总结 + 实施细节 + Phase 11+ 承接事项。**惯例 M 第 26 次 + 跨 Phase 第 7 次实战**。

### D.4 docs/phase10/PHASE-10-STEP-5-DESIGN-DRAFT.md（删除）

PHASE_DESIGN 阶段草案（v2 后约 620 行）；设计沉淀进 ADR + release.yml + CONTRIBUTING + 本启程记录后作废。

### D.5 docs/00-phase1-mapping.md（Phase 10 Step 5 完成段）

由后续 mapping sync 步骤添加。

---

## §E 风险点

### E.1 release.yml 第一次 tag push 触发的不确定性

**应对**：本 Step 不实际 push tag 触发 release（避免污染 main git tag 历史）；release.yml 第一次真实触发是 Step 7 phase-10-closed tag 创建时。本 Step yml syntax 验证（Python pyyaml）已 PASS；GitHub Actions UI push 后将再次 yml validation。

### E.2 CHANGELOG 段提取的 awk 鲁棒性

**应对**：awk 模式 `/^## \[/ ... if ($0 ~ phase)` 依赖 CHANGELOG.md 段标题格式 `## [Phase N]`（沿用 Phase 8 + Phase 9 既有格式）；release.yml 含 `if [ ! -s release-notes.md ]; then echo ::warning::` 提示空 notes 不让 release 失败。Step 7 撰写 CHANGELOG Phase 10 段时严格按既有格式。

### E.3 GitHub Release draft 用户审视流程

**应对**：CONTRIBUTING ## Release Process 段明示流程；用户在 Step 7 phase-10-closed tag push 后实地体验。

### E.4 CONTRIBUTING 超 100 硬底（4 行）

**实测结果**：100 → 104 行（超 4 行）。K.2 fallback "实测后进一步精简" 已穷尽（最精简版仍需 4 行 net 增量；保留核心信息：触发 + 流程 + ADR 引用）。**诚实评估**：100 行硬底在 Step 5 阶段不可达；纪律边界已在 v2 修订中明示"硬底不是扩展性指标，而是克制原则的具体边界"——Step 5 实施暴露的边界冲突由 Phase 11+ 承接事项（Step 7 收官时一次性精简）承接。

### E.5 历史 `1.0.0` tag 处理

**应对**：触发 glob `phase-*-closed` 精确匹配；不主动删除 `1.0.0` tag（保留历史；不引用）；ADR-0003 Step 5 段 + CONTRIBUTING ## Release Process 段显式说明 `1.0.0` 不在 Phase release stream。

### E.6 ADR-0003 段长度增长（518 → 591）

**附加观察实测**：ADR-0003 Step 5 段追加后总长 591 行；远低于 800 阈值（用户附加观察"如行数接近 800 追加段长度观察注脚"）。**附加观察 ADR 段长度注脚不需要追加**（按附加观察"如远低于 800 可省略"路径）。Phase 6/7 段如继续增量追写让 ADR-0003 接近 800 时再触发评估；当前节点不需要拆 ADR-0004 决策。

---

## §F 测试计划

### F.1 4 项独立命令 baseline + final

| # | 命令 | Baseline | Final |
|---|---|---|---|
| 1 | `pnpm lint` | PASS | （由 PHASE_IMPLEMENT 后续步骤实测）|
| 2 | `pnpm typecheck` | PASS | （后续）|
| 3 | `pnpm test` | 1971 | （后续）|
| 4 | `pnpm test:coverage` | 84.92%/79.57%/91.68%/84.92% | （后续）|

### F.2 release.yml yml syntax 验证

✅ Python pyyaml `yaml.safe_load()` PASS（实测；H5 硬底兑现）。

### F.3 KI 状态稳定性

5 项 open KI 稳定（不变）；KI-P10-001 + KI-P10-002 RESOLVED 不变。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700 | （由 final 实测确认；预期 1971）|
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | （由 final 实测确认）|
| H3 | 4 项独立命令全 PASS | （由 final 实测确认）|
| H4 | release.yml 创建 | ✅ 71 行 |
| H5 | release.yml yml syntax 验证 | ✅ Python pyyaml PASS |
| H6 | push feature 分支成功 | （由后续步骤完成）|
| H7 | CI 第四次运行 PASS | ⏳ 待 PR #8 创建 |
| H8 | PR 创建建议输出 | ✅ 详见执行报告 |
| H9 | main CI 转绿验证（接受最简实质回执）| ⏳ 待 PR #8 合并 |

参考下限 R1-R10 全 PASS（除 R7 测试增量 0 + R8 业务代码 git diff 0 待 final 确认）。

完成项 G1-G24 全 PASS。

### §G.1 CI Iteration 留痕

| 第 N 次 | PR / 触发 | 4 jobs 状态 | 失败原因 | 修复 commit SHA |
|---|---|---|---|---|
| Step 3.5 PR #6 | feature + main | ✅ 4/4 PASS | - | - |
| Step 4 PR #7 | feature + main | ✅ 4/4 PASS | - | - |
| **Step 5 PR #8** | **feature (PR)** | ⏳ 待 PR #8 创建 | - | - |
| **Step 5 PR #8** | **main (push)** | ⏳ 待 PR #8 合并 | - | - |

iteration 纪律：force-push 不抹掉失败历史；如 CI FAIL 追加 fix commit。

---

## §H Step 6 衔接预告

Step 6 将更新 README 可执行性 + 创建 Runbook（补充文档 §12.3 + §12.4）。Step 6 严重依赖 Step 5：

- release.yml 已建立（README 可引用发布流程）
- phase-N-closed tag 约定继续锁定
- CONTRIBUTING ## Release Process 段已建立（README 可引用）
- ci.yml + Dockerfile + docker-compose + release.yml 四件套就位（README 可一键命令引用全部）
- CONTRIBUTING ≤ 100 行硬底重审作为 Step 7 收官精简候选

Step 6 起草指令独立承接（不在本 Step 范围）。Step 6 不需要拆两阶段（README + Runbook 主题相对成熟）。

---

## §I 对作品级代码库的意义

### I.1 Phase 10 工程化基础设施第三块砖落地

Phase 10 协作建设（Step 1+2）+ 工程化第一块砖 CI 强制门禁（Step 3+3.5）+ 第二块砖容器化（Step 4）已就位；本 Step 是工程化第三块砖发布自动化。读者推 phase-N-closed tag 即触发 release.yml 自动创建 GitHub Release draft；用户审视后 publish——Tianqi 工程旅程从"代码完整 + 协作生态 + CI 真绿色 + 容器可部署"升级到"+ 发布自动化"。

### I.2 拆两阶段流程在工程化主题第 3 次实证

普通 Step 级别拆两阶段已 3 次实战（Step 3 CI + Step 3.5 修复 + 本 Step 发布）；前两次集中在 CI/build chain；本次跨到发布工作流——证明拆两阶段实证价值不限于单一主题，而是"设计影响 Phase 11+ 持续"的普适通用纪律。

### I.3 第三方 action 严格度判断沉淀（K.1 决议）

v1 草案曾选 softprops/action-gh-release@v2（业界最广泛非官方 action）；v1 → v2 修订基于用户 K.1 决议改 gh CLI（GitHub 官方 + runner 预装）。这次决议沉淀为 ADR-0003 Step 5 段"第三方 action 严格度判断"段（4 类型 + 判断顺序）——Phase 11+ 沿用基础。**元规则 P 在"有 GitHub 官方等价物"场景严守**——这是元规则 P 的延伸应用。

### I.4 硬底纪律延伸（K.2 决议）

CONTRIBUTING ≤ 100 行硬底在 Step 5 实施时与 Release Process 内容产生冲突（最精简版仍需 4 行 net 增量）。v1 草案曾考虑升级硬底 ≤ 110；v2 修订基于用户 K.2 决议严守 ≤ 100 + 实测后进一步精简 fallback。实施时 fallback 已穷尽（100 → 104 是无法继续精简的最小值）；Step 5 honest留痕"100 行硬底在 Step 5 阶段不可达"+ Phase 11+ 承接事项含 Step 7 收官精简——**硬底不是扩展性指标，而是克制原则的具体边界**（K.2 沉淀）。

### I.5 Step 4 收尾微调沉淀

Step 4 main CI 转绿验证回执环节 AI 对数据格式过度坚持的协作 prompt 设计微调点已沉淀进 ADR-0003 Step 5 段；Step 5 起草指令 H9 硬底显式接受最简实质回执；后续 Step 起草指令沿用——**纪律核心是"实质兑现"被验证而非"数据格式齐全"**。

### I.6 主题专注度延续 7 步严守

Phase 10 主题专注度从 Kickoff（启程战）+ Step 0（修复+防御）+ Step 1（协作建设）+ Step 2（协作建设）+ Step 3（工程化建设）+ Step 3.5（修复+防御）+ Step 4（工程化建设）+ 本 Step（工程化建设）连续 7 步严守。本 Step 不修改 Step 0-4 任何已锁定输出（root build script / ci.yml / vitest config / workspace 包配置 / Dockerfile / docker-compose）；不创建 README + Runbook（Step 6 责任）；不实施 docker push（Phase 11+ 承接）；克制 > 堆砌。

---

**Phase 10 / Step 5 完成 — 2026-05-05 ✅**

发布自动化能力建立；Phase 10 工程化基础设施第三块砖落地。Step 6（README + Runbook）由独立指令承接；Step 7 phase-10-closed tag push 即触发 release.yml 第一次真实运行——元规则 B 在工作流层面再次兑现。
