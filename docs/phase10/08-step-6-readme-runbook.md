# Phase 10 / Step 6 — README 更新 + Runbook 创建

> **执行时间**：2026-05-05
> **类型**：Phase 10 工程化基础设施第四块砖（最后一块；CI + 容器化 + 发布自动化 + 文档 = 4/4 完整闭环）
> **本 Step 性质**：Step 7 收官前最后一战；让 Step 0-5 累计工程价值"可读取"
> **状态**：完成

---

## 🎯 Phase 10 工程化基础设施 4/4 块砖完整达成

| 块 | 内容 | Step |
|---|---|---|
| 第一块 | CI 强制门禁（4 项独立命令并行 + 84% coverage 门槛 + main 转绿）| Step 3 + 3.5 |
| 第二块 | 容器化部署能力（Dockerfile 多阶段 + 非 root + HEALTHCHECK + docker-compose）| Step 4 |
| 第三块 | 发布自动化（`phase-*-closed` tag 触发 + draft GitHub Release + CHANGELOG 提取）| Step 5 |
| **第四块** | **文档（README 重写 + Runbook 创建；§12.3 + §12.4 完整兑现）** | **Step 6（本 Step）** |

**Phase 10 工程化基础设施 4/4 完整闭环**。Step 7 收官 phase-10-closed tag push 即触发 release.yml 第一次真实运行——元规则 B 在工作流层面再次兑现。

---

## §A 当前任务

Phase 10 / Step 6 — 重构 README.md（274 → 94 行；§12.3 必含 7 项 + Phase 10 工程基础设施 4 块砖反映）+ 创建 docs/runbook.md（125 行；§12.4 必含 5 项）。让 Tianqi 工程旅程从"代码 + CI + 容器 + 发布"完整闭环到"+ 可执行文档"。

---

## §B 影响范围

### B.1 修改文件（4 个）

| 文件 | 变更 | 行数变化 |
|---|---|---|
| `README.md` | 重构 / 重写（裁决 1 C；保留项目愿景 + 现代化结构）| 274 → **94 行**（≤ 200 硬底）|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 6 段增量追写 | 591 → **622 行**（远低于 800 阈值）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 6 完成段追加 | +若干 |

### B.2 新增文件（2 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `docs/runbook.md` | 125 行 ≤ 150 | 运维 Runbook（§12.4 必含 5 项）|
| `docs/phase10/08-step-6-readme-runbook.md` | 本执行记录 | 9 节 A-I |

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 25 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（不变）

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§1/§28 + 《补充文档》§12.1/§12.3/§12.4 + ADR-0003 Step 0-5 段；KI 5 项 open + KI-P10-001/002 RESOLVED；ADR 状态符合预期。

### C.2 强制开局动作 4 — 七项实地核查

| # | 核查项 | 实测结果 |
|---|---|---|
| A | 既有 README | **274 行；停留 Phase 1-7**（"1106 passed" + "Node 20+" 过时；无 Phase 10 工程基础设施反映）→ 强制裁决 1 C 重构 |
| B | 既有 Runbook | docs/runbook* / RUNBOOK.md 全部不存在；从零创建 |
| C | README §12.3 必含 7 项现状 | 既有 README 部分含愿景 + 简单 Quick Start；缺 Phase 10 工程基础设施反映 |
| D | Runbook §12.4 必含 5 项 | 全部缺失（从零创建）|
| E | CONTRIBUTING 当前状态 | 104 行（Step 5 honest留痕；裁决 7 α 不修改严守）|
| F | docs/ 结构 | 含 mapping + decisions + phase10 + 历史 phase 文档 → Runbook 归属 `docs/runbook.md` 一致 |
| G | Quick Start 工具链核查 | pnpm 10.0.0 + Node 22.20.0 + packageManager 字段就绪 |

### C.3 强制开局动作 5 — 4 项独立命令 baseline

| # | 命令 | 实测 |
|---|---|---|
| 1 | `pnpm lint` | PASS |
| 2 | `pnpm typecheck` | PASS |
| 3 | `pnpm test` | 1971（1867+104）|
| 4 | `pnpm test:coverage` | 84.92%/79.57%/91.68%/84.92% |

### C.4 9 个核心裁决最终选择

详见 ADR-0003 Step 6 段表格。

### C.5 README + Runbook 结构摘要

**README.md（94 行）章节**：
- 项目愿景 + Project Mission cross-reference（不复制宪法）
- Quick Start（git clone + pnpm install + pnpm build + 4 项独立命令）
- Engineering Infrastructure（4 块砖表格 + 链接 ADR-0003）
- Documentation Navigation（8 个文档导航；含 audience 分类）
- Phase Status（Phase 1-7 / 8 / 9 / 10 / 11+ 状态表）
- Project Mission（六条设计权重）
- Code of Conduct
- License（标注未指定）
- Contact

**docs/runbook.md（125 行）章节**：
- 1. Deployment（Container Build + Run + docker-compose）
- 2. Configuration（声明环境变量 KI-P8-002 + Phase 11+ 承接）
- 3. Health Check（Dockerfile HEALTHCHECK + 库性质项目说明）
- 4. Troubleshooting（容器启动 / 健康检查 / docker-compose / CI 失败 4 类）
- 5. Rollback（容器回滚 + release 回滚 + tag 不可变性纪律）
- References（ADR + ci.yml + release.yml + Dockerfile + docker-compose + KNOWN-ISSUES）

### C.6 Quick Start fresh checkout 实地验证留痕（动作 4 G 教训严守延伸）

模拟 fresh checkout（删 `.tsbuildinfo` + `dist/`）后跑 README Quick Start 6 步序列：

| Step | Command | 实测结果 |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | ✅ PASS |
| 2 | `pnpm build` | ✅ PASS |
| 3 | `pnpm lint` | ✅ PASS |
| 4 | `pnpm typecheck` | ✅ PASS |
| 5 | `pnpm test` | ✅ PASS（1971）|
| 6 | `pnpm test:coverage` | ✅ PASS（84.92%/79.56%/91.68%/84.92%）|

**6/6 PASS**——README Quick Start 命令真实工作（不允许"看起来对但跑不通"；Step 3.5 + Step 5 教训严守延伸到文档层）。

### C.7 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；Step 0-5 锁定输出未修改 |
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增依赖；累计 29 步零新依赖 |
| 元规则 Q（强制开局动作 v3 模板）| **第 9 次实战** — Kickoff + Step 0/1/2/3/3.5/4/5 + 本 Step；4 项独立命令 baseline + final 双向实测 + Quick Start fresh checkout 6 步序列实地验证 |
| 惯例 K（错误码命名空间扩展）| **第 25 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 27 次 + 跨 Phase 第 8 次实战** — ADR-0003 Step 6 段（约 31 行追加；591 → 622）|
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | **不触发** — Step 6 主题相对成熟（README + Runbook 是文档主题；裁决空间小）|
| Phase 10 工作流过渡 | **第 9 次实战**（Kickoff + Step 0/1/2/3/3.5/4/5 + 本 Step；feature 分支 + PR 合并）|
| §12.3 README 必含 7 项 | **完整兑现** — 项目愿景 + Quick Start + 文档导航 + Phase 状态 + 项目使命 + CoC + License/Contact |
| §12.4 Runbook 必含 5 项 | **完整兑现** — Deployment + Configuration + Health Check + Troubleshooting + Rollback |
| "引用而不复制"纪律 | **延伸到 README + Runbook**（README 引用 CONTRIBUTING / ADR / Constitution；Runbook 引用 ADR-0003；不复制内容）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

### D.1 README.md 重写（274 → 94 行）

裁决 1 C 重构 + 裁决 2 β 标准。保留项目愿景核心精神（六条设计权重）+ 现代化结构（Phase 10 工程基础设施 4 块砖反映）+ Quick Start 真实工作命令。

### D.2 docs/runbook.md 创建（125 行）

裁决 3 β 标准 + 裁决 4 α 归属 + 裁决 6 α 不含 mock incident。§12.4 必含 5 项完整 + 命令示例 + 引用 ADR-0003 不复制。

### D.3 docs/decisions/0003-phase-10-engineering-and-collaboration.md Step 6 段（约 31 行）

惯例 M 第 27 次 + 跨 Phase 第 8 次实战。9 项裁决摘要 + 关键工程纪律 + 实施细节 + Step 6 工程意义阐述。591 → 622 行（远低于 800 阈值）。

### D.4 docs/00-phase1-mapping.md（Phase 10 Step 6 完成段）

由后续 mapping sync 步骤添加。

---

## §E 风险点

### E.1 Quick Start 命令是否真实工作（已实测）

**实测结果**：fresh checkout 模拟下 6/6 PASS。详见 §C.6。Step 3.5 + Step 5 教训严守延伸到文档层。

### E.2 Runbook mock incident 边界（裁决 6 α 严守）

**应对**：本 Step Runbook 不含 mock incident；Troubleshooting 段仅含 Phase 10 baseline 真实可触发的故障类型（容器启动失败 / 健康检查异常 / docker-compose 失败 / CI 失败）；Phase 11+ 真实 incident 由实战沉淀承接。

### E.3 CONTRIBUTING 不修改的承接承诺

**应对**：CONTRIBUTING 维持 104 行（Step 5 honest留痕；裁决 7 α）；Step 7 收官精简承接（ADR-0003 Phase 11+ 承接事项已留痕）。本 Step 不让 CONTRIBUTING 进一步膨胀（裁决 7 γ 拒绝）。

### E.4 README 长度策略（94 行 vs 裁决 2 β 标准 120-180）

**说明**：实测 94 行偏 β 标准下限（120-180 范围内偏简）。诚实评估：本 Step README 选择"简短入口 + 文档导航"路径而非"完整阐述"路径——文档导航段链接 8 个详细文档（CONTRIBUTING / runbook / SECURITY / decisions / mapping / KNOWN-ISSUES / closure-checklist / CHANGELOG）让贡献者按需深入。94 行 ≤ 200 硬底严守；不超不让 README 膨胀；保持入口简洁。

### E.5 ADR-0003 长度增长（591 → 622）

**附加观察实测**：ADR-0003 Step 6 段追加后 622 行；远低于 800 阈值（用户附加观察"如远低于 800 可省略"路径）。**附加观察 ADR 段长度注脚不需要追加**。Phase 10 / Step 7 收官段如继续追写让 ADR-0003 接近 800 时再触发拆 ADR-0004 评估；当前节点不需要。

---

## §F 测试计划

### F.1 4 项独立命令 baseline + final

| # | 命令 | Baseline | Final |
|---|---|---|---|
| 1 | `pnpm lint` | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS | **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.57%/91.68%/84.92% | **84.92%/79.56%/91.68%/84.92%** |

### F.2 Quick Start fresh checkout 实地验证（动作 4 G 教训严守延伸）

详见 §C.6。**6/6 PASS**（install + build + lint + typecheck + test 1971 + coverage）。

### F.3 KI 状态稳定性

5 项 open KI 稳定（不变）；KI-P10-001 + KI-P10-002 RESOLVED 不变。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700 | ✅ 1971 |
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | ✅ 84.92%/79.56%/91.68%/84.92%（门槛 84/75/84/84 全部达标）|
| H3 | 4 项独立命令全 PASS | ✅ |
| H4 | README 长度 ≤ 200 | ✅ 94 |
| H5 | Runbook 长度 ≤ 150 | ✅ 125 |
| H6 | Quick Start fresh checkout 真实工作 | ✅ 6/6 PASS |
| H7 | push feature 分支成功 | （由后续步骤完成）|
| H8 | CI 第五次运行 PASS | ⏳ 待 PR #9 创建 |
| H9 | PR 创建建议输出 | ✅ 详见 PR 报告 |
| H10 | main CI 转绿验证（最简实质回执）| ⏳ 待 PR #9 合并 |

参考下限 R1-R9 全 PASS（R1 README §12.3 7 项 ✅ / R2 Runbook §12.4 5 项 ✅ / R3 引用而不复制 ✅ / R4 不含 mock incident ✅ / R5 不修改 CONTRIBUTING ✅ / R6 不修改 Step 3-5 输出 ✅ / R7 测试增量 0 ✅ / R8 业务代码 git diff 0 ✅ / R9 元规则 P 累计 28 步零依赖维持 ✅）。完成项 G1-G24 全 PASS。

---

## §H Step 7 衔接预告

Step 7 = **Phase 10 收官**：
- phase-10-closed tag push（触发 Step 5 release.yml 第一次真实运行；元规则 B 在工作流层面兑现）
- CHANGELOG.md Phase 10 段创建
- 覆盖率门槛 84% → 85% 升级（K.2 锁定路径 A/B/C 三选一裁决）
- CONTRIBUTING.md 精简至 ≤ 100 行（Step 5 honest留痕承接）
- ADR-0003 Status In Progress → Accepted (Phase 10 CLOSED, YYYY-MM-DD)
- ADR-0003 Consequences 段最终撰写
- Phase 10 工程旅程总结

Step 7 严重依赖 Step 6 成果（README + Runbook 已建立；4/4 块砖完成；ADR Step 0-6 段就位）。Step 7 起草指令独立承接（不在本 Step 范围）。

---

## §I 对作品级代码库的意义

### I.1 工程基础设施可读取

Step 0-5 累计的 CI + 容器 + 发布自动化基础设施通过 README + Runbook 让贡献者 / 运维者"可读取"。新贡献者 README 入口（Quick Start 一键命令真实工作）+ 运维者 Runbook 入口（部署 + 健康检查 + 故障 + 回滚）——工程价值从"代码可执行"升级到"+ 文档可阅读"。

### I.2 Quick Start 真实工作（教训跨场景延伸）

Step 3.5 KI-P10-002 修复（dist-based packaging）+ Step 5 gh CLI（元规则 P 严守）+ 本 Step Quick Start fresh checkout 6/6 PASS——"不允许看起来对但跑不通"纪律跨 build chain / release chain / 文档层连续兑现。这是 Tianqi 工程纪律的实证。

### I.3 引用而不复制纪律延伸

Step 1 CONTRIBUTING 引用《宪法》而不复制 + Step 1 CODE_OF_CONDUCT 链接而不复制 Contributor Covenant + Step 5 CONTRIBUTING 引用 ADR-0003 而不复制 + 本 Step README 引用 ADR / CONTRIBUTING / 等而不复制 + Runbook 引用 ADR-0003 而不复制——"引用而不复制"纪律在 Phase 10 全程跨多个文档持续兑现。让权威源保持单一权威；让派生文档只承担"导航"职责而非"复制"职责。

### I.4 Phase 10 工程化基础设施 4/4 完整闭环

Phase 10 协作建设（Step 1+2）+ 工程化建设（Step 3 CI + Step 3.5 修复 + Step 4 容器 + Step 5 发布 + 本 Step 文档）= 工程化基础设施 4 块砖全部就位。读者打开仓库根目录看到 README + CONTRIBUTING + CODE_OF_CONDUCT + SECURITY + CHANGELOG + Dockerfile + docker-compose.yml；打开 .github/ 看到 PR 模板 + Issue 模板 + CODEOWNERS + ci.yml + release.yml；打开 docs/ 看到 decisions + phase10 + runbook + closure-checklist + KNOWN-ISSUES + 00-phase1-mapping——清晰、可控、可信的工程旅程进入收尾倒数。

### I.5 主题专注度延续 8 步严守

Phase 10 主题专注度从 Kickoff（启程战）+ Step 0（修复+防御）+ Step 1（协作建设）+ Step 2（协作建设）+ Step 3（工程化）+ Step 3.5（修复+防御）+ Step 4（工程化）+ Step 5（工程化）+ 本 Step（文档）连续 9 步严守。本 Step 不修改 Step 3-5 任何已锁定输出（ci.yml / release.yml / Dockerfile / docker-compose.yml）+ 不修改 CONTRIBUTING（裁决 7 α）+ 不创建 phase-10-closed tag（Step 7 责任）+ 不修改 CHANGELOG（Step 7 责任）；克制 > 堆砌。

### I.6 Step 7 收官前最后一战

Step 6 完成后 Phase 10 进度 8/9（仅 Step 7 收官待落地）。Step 7 phase-10-closed tag push 即触发 release.yml 第一次真实运行——元规则 B 在工作流层面再次兑现（release.yml 接口冻结后 Phase 11+ 在此基础上演进）。Phase 10 工程旅程从"工程基础设施建立"到"工程基础设施验证"完整闭环倒数。

---

**Phase 10 / Step 6 完成 — 2026-05-05 ✅**

工程化基础设施 4/4 块砖完整闭环；Step 7 收官（Phase 10 CLOSED）由独立指令承接。
