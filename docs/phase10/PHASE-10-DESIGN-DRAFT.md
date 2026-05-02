# Phase 10 启程 — PHASE_DESIGN 草案

> **状态**：DRAFT — 等待用户审视
> **版本**：v1（首次提交）
> **草案时间**：2026-05-02
> **覆盖**：Phase 10 启程指令第一阶段（PHASE_DESIGN）产出
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成时本文件立即删除（设计沉淀进 ADR-0003 + docs/phase10/00-phase-10-kickoff.md）

本草案是 Phase 10 启程指令拆两阶段流程的产物——拆两阶段流程**第 3 次实战**（前两次：Phase 9 / Step 6 SagaOrchestrator + Phase 9 / Step 14 CrossSagaCoordination）。Phase 启程比 Step 启程更值得拆两阶段：用户审视 Phase 10 完整 Step 划分前不进入实施。

---

## §A 强制开局动作 1-6 执行确认

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》（1106 行）+ 《补充文档》（537 行）—— 全部章节 | ✅ |
| 2 | 核查 KNOWN-ISSUES 5 项 open KI（KI-P8-001/002/003/005 + KI-P9-001）| ✅ — Phase 10 不修任一 KI |
| 3 | 核查 ADR-0001 + ADR-0002（Phase 8 + Phase 9 全部 Accepted） | ✅ |
| 4 | 核查 Phase 1-9 既有协作资产现状 | ✅ — 详见 §B.1 |
| 5 | 核查 Phase 1-9 既有 CI 配置覆盖度 | ✅ — 详见 §B.2 |
| 6 | 核查 Phase 1-9 既有 docs 完整性 | ✅ — 详见 §B.3 |

---

## §B 强制开局动作 4-6 实地核查结果

### §B.1 既有协作资产现状（强制开局动作 4）

实测 `ls -la README.md CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md CHANGELOG.md CODEOWNERS Dockerfile docker-compose.yml`：

| 资产 | 状态 | 备注 |
|---|---|---|
| README.md | ✅ 存在（8085 字节） | **严重过时**——内容停留在 Phase 1-7 / 1106 tests；未反映 Phase 8/9 累计能力 |
| CHANGELOG.md | ✅ 存在（23064 字节） | Phase 9 / Step 19 创建；含 Phase 8 + Phase 9 段；最新 |
| CONTRIBUTING.md | ❌ 不存在 | Phase 10 / Step 1 责任 |
| CODE_OF_CONDUCT.md | ❌ 不存在 | Phase 10 / Step 1 责任 |
| SECURITY.md | ❌ 不存在 | Phase 10 / Step 1 责任 |
| CODEOWNERS | ❌ 不存在 | Phase 10 / Step 2 责任 |
| Dockerfile | ❌ 不存在 | Phase 10 / Step 4 责任 |
| docker-compose.yml | ❌ 不存在 | Phase 10 / Step 4 责任 |
| .github/ 目录 | ❌ 不存在 | Phase 10 / Step 2 + Step 3 责任 |
| Issue 模板 | ❌ 不存在 | Phase 10 / Step 2 责任 |
| PR 模板 | ❌ 不存在 | Phase 10 / Step 2 责任 |
| Runbook | ❌ 不存在 | Phase 10 / Step 6 责任 |

**协作资产基线：1/7**（仅 CHANGELOG）。Phase 10 / Step 1-2 责任：补齐协作资产 7 件套（按补充文档 §7.4）。

### §B.2 既有 CI 配置覆盖度（强制开局动作 5）

实测 `ls -la .github/`：**目录不存在**——仓库**完全没有 CI 配置**。

| §7.1 / §7.2 期望 | 现状 |
|---|---|
| lint 零警告（CI 强制） | 仅本地执行 |
| typecheck 零错误（CI 强制） | 仅本地执行 |
| test 全绿（CI 强制） | 仅本地执行 |
| 测试总数不得减少 | 无 CI 强制 |
| 覆盖率不得低于 85%（CI 强制门禁，§9.3）| 当前 84.92%（无 CI 强制；Phase 10 收官需达 85%）|
| 契约变更必须在 PR 描述中声明 | 无 PR 模板 |
| 本地与 CI 一致（一键命令跑通范围相同）| N/A |

**CI 基线：0**。Phase 10 / Step 3 责任：从零建立 CI 强制门禁（按补充文档 §7.1 + §7.2）。

### §B.3 既有 docs 完整性（强制开局动作 6）

| 维度 | 实测 |
|---|---|
| docs/00-phase1-mapping.md | ✅ 存在；含 Phase 1-9 完整索引 |
| docs/decisions/ | ✅ ADR-0001（Phase 8 Accepted）+ ADR-0002（Phase 9 Accepted）；本启程指令创建 ADR-0003 DRAFT |
| docs/phase8/ | ✅ 19 文件（Phase 8 各 Step 执行记录） |
| docs/phase9/ | ✅ 19 文件（Phase 9 各 Step 执行记录） |
| docs/01-19-*.md | ✅ Phase 1-7 历史 |
| docs/phase10/ | 本启程指令创建（含 PHASE-10-DESIGN-DRAFT.md）|
| README "如何启动 / 如何测试 / 如何部署" 可执行段 | ⚠️ README 内容滞后（停留 Phase 1-7 / 1106 tests）|
| Runbook | ❌ 不存在 |

**docs 基线**：完整但 README 滞后；缺 runbook。Phase 10 / Step 6 责任：README 可执行性更新 + Runbook 创建。

---

## §C 9 个核心裁决摘要

### 裁决 1：Phase 10 主题边界 = α 严格按补充文档 §1.2

**选择 α**：工程化与协作基础——CI/CD + 协作资产 + 容器化 + 文档可执行 + 覆盖率门槛升级。

**理由**：
- 补充文档 §1.2 明确 Phase 10 主题
- β（顺手修 KI-P8-001 domain 覆盖率）让 Phase 10 主题混乱（"工程化"与"业务覆盖率改善"是两个不同维度）
- γ（Phase 1-7 命令编排器与 Phase 9 业务 Saga 融合）是业务能力延伸，应另立独立 Phase
- "Phase 主题专注"是补充文档 §13.3 "Phase Gate 回溯义务"精神延续

**KI-P8-001 修复责任 Phase 调整**：从"Phase 10"改为"独立 Phase"（需要 Phase 10 收官后由独立 Phase 启动指令承接；本启程指令不预占空位）。本调整在 Phase 10 / Step 1 时同步更新 KNOWN-ISSUES.md。

### 裁决 2：Phase 10 完整 Step 划分 = 候选 A（8 Step 含启程战）

| Step | 主题 | DoD 概要 |
|---|---|---|
| **1** | **本启程指令**（PHASE_DESIGN + PHASE_IMPLEMENT 两阶段；ADR-0003 + 启程标记） | ADR-0003 三段 + 启程标记 + 9 裁决锁定 |
| 2 | 协作资产基础三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）| 3 文档创建 + 内容质量符合主流标准 |
| 3 | PR 模板 + Issue 模板 + CODEOWNERS（.github/ 目录建立）| .github/ISSUE_TEMPLATE/* + .github/PULL_REQUEST_TEMPLATE.md（对齐《宪法》§24.1 PR 七项）+ CODEOWNERS |
| 4 | CI 强制门禁（GitHub Actions workflow + lint/typecheck/test/coverage + 85% 门槛）| .github/workflows/*.yml + 本地与 CI 一致（§7.2）+ 85% 覆盖率门槛激活 |
| 5 | 容器化（Dockerfile 多阶段 + 非 root + 健康检查 + docker-compose 开发编排）| Dockerfile + docker-compose.yml + CI 中验证镜像构建（§7.5）|
| 6 | 发布自动化（git tag 触发流水线 + changesets 或等价工具）| .github/workflows/release.yml + 单一事实来源版本管理（§7.3）|
| 7 | README 可执行性更新 + Runbook 同步 | README 反映 Phase 1-9 累计能力 + 可执行示例在 CI 验证（§12.3）+ docs/runbook/ 创建（§12.4）|
| 8 | Phase 10 CLOSED + CHANGELOG 更新 | ADR-0003 Accepted + Phase 10 段写入 CHANGELOG + git tag `phase-10-closed`（沿用 Phase 9 模式）|

**理由（vs 候选 B/C）**：
- B（10 Step）让小 Step 过度细分（违反"克制"）—— 譬如把容器化拆成 Dockerfile + docker-compose 两 Step 是不必要细化
- C（精简 6 Step）让单 Step 内多主题混杂 —— 譬如合并"协作资产基础"与"PR/Issue 模板"两个独立工作单元
- 候选 A 8 Step 让每 Step 主题专注（与 Phase 9 Step 单一职责一致）
- Phase 10 业务复杂度低于 Phase 9（19 Step → 8 Step；零业务代码增量）

### 裁决 3：强制创建 ADR-0003

**选择**：强制创建 ADR-0003（标题 "Phase 10 工程化与协作基础"）。

**理由**：
- 补充文档 §12.2 明确每 Phase CLOSED 必须产出 ADR
- ADR-0001 = Phase 8；ADR-0002 = Phase 9；ADR-0003 = Phase 10（Phase 命名空间一致）
- 独立 ADR 让 Phase 10 决议与 Phase 8/9 解耦

**已落地**：本启程指令 PHASE_DESIGN 阶段创建 ADR-0003 DRAFT（Status / Context / Decision 三段）。

### 裁决 4：Phase 10 强制开局动作模板 = B（4 项基础 + 工程化主题专属核查）

**选择 B**：

| # | 动作 | 性质 |
|---|---|---|
| 1 | 重读宪法 + 补充文档（关键章节按 Step 主题） | 通用（沿用 Phase 9）|
| 2 | 核查 KNOWN-ISSUES 5 项 KI 状态 | 通用（沿用 Phase 9）|
| 3 | 核查 ADR-0001 + ADR-0002 + ADR-0003 | 通用（沿用 Phase 9 模式 + Phase 10 新增 ADR-0003）|
| 4 | 工程化主题专属核查（视 Step 主题）| **Phase 10 专属新增** |

**裁决 4 的工程化主题专属核查举例**（按 Step 主题不同）：

| Step | 专属核查 |
|---|---|
| Step 2 | 核查既有 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY 文档（确认零基线起步）|
| Step 3 | 核查既有 .github/ 目录 + 主流 PR/Issue 模板格式 |
| Step 4 | 核查既有 .github/workflows/ + pnpm 命令本地一致性 |
| Step 5 | 核查既有 Dockerfile / docker-compose / 容器化工具链 |
| Step 6 | 核查既有 git tag + changesets / 替代工具 |
| Step 7 | 核查 README 当前内容 + Runbook 既有结构 |
| Step 8 | 核查 ADR-0003 状态 + CHANGELOG / git tag 既有约定 |

**理由**：
- 沿用 Phase 9 模式（4-6 项强制开局动作）
- 工程化主题不同——"实地核查"内容也不同
- 既有协作资产 / CI / 容器化是工程化主题的"前置事实"
- 让"实地核查"成为有内容的检查（不是空文）

### 裁决 5：Phase 10 元规则 / 惯例新增 = A 不新增

**选择 A**：不新增任何元规则或惯例。

**理由**：
- Phase 9 已建立的 15 元规则（A-Q）+ 3 惯例（K/L/M）覆盖大部分场景
- 工程化主题在补充文档 §7/§12/§13 已有充分约束（不需要新建元规则）
- "Phase 10+ 起 CI 不可绕过"是补充文档 §7.1 已定，不需新规则
- 规则膨胀违反"克制 > 堆砌"

**Phase 10 沿用 15+3 元规则 / 惯例集合**。新规则需求由 Phase 11+ 真实业务场景判定。

### 裁决 6：Phase 10 测试与覆盖率策略 = A 严守 + 必要时允许 B

**选择 A 主线 + B 视情况**：
- **A 主线**：严守"不增加业务测试"（Phase 10 不构建业务能力；测试增量接近 0）
- **B 必要时**：允许新增工程化测试（譬如 Dockerfile lint 测试 / CI workflow 语法验证 / README 可执行示例测试）—— 由各具体 Step 独立判断

**严禁 C**：不主动改善覆盖率（不修 KI-P8-001 — 与裁决 1 α 一致）。

**覆盖率门槛升级路径**（Step 4 责任）：
- 当前 84.92% lines（差 0.08pp 即达 85%）
- Step 4 设置 CI 85% 门槛时实测覆盖率
- 若未达 85%，由 Step 4 内部决定：(a) 小幅补充工程化测试 / (b) 暂留待 Phase 11 改善 / (c) 调整门槛策略
- 本启程指令不预先决定具体路径

### 裁决 7：Phase 10 git tag 命名 = `phase-10-closed`

**选择**：沿用 Phase 9 / Step 19 建立的 `phase-N-closed` 命名约定。

**理由**：
- Phase 9 / Step 19 实测建立约定：`phase-9-closed`（Tianqi 第一个 git tag）
- Phase 10 沿用：`phase-10-closed`
- 一致性优先于"为新 Phase 引入新约定"

### 裁决 8：CHANGELOG 维护策略 = A 仅 Phase 10 CLOSED 时一次性追加

**选择 A**：

- 沿用 Phase 9 模式（Step 19 一次性追加 Phase 9 段）
- Phase 10 / Step 8（收官）一次性追加 Phase 10 段（在 Phase 9 段之前插入；最新 Phase 在最上方）
- 每 Step 不增量更新 CHANGELOG（避免维护负担）

**理由**：
- 与 Phase 9 模式一致
- B 每 Step 增量让 CHANGELOG 维护负担过重
- Phase 收官时一次性归档更简洁

### 裁决 9：拆两阶段流程 = B 视具体 Step 复杂度决定

**选择 B**：
- 本启程指令拆两阶段（必须；Phase 启程级，比 Step 启程更值得审视）
- Phase 10 内部 Step 视具体复杂度决定：
  - Step 4 CI 强制门禁（可能需要拆两阶段——CI 配置策略影响后续 Step）
  - Step 5 容器化（可能需要拆两阶段——Dockerfile 设计策略影响发布自动化）
  - 其他 Step 通常单阶段（协作资产 / README / Runbook 复杂度低）
- 由各 Step 起草指令时独立判断

**理由**：
- 灵活适配（拒绝 A 仅本启程拆两阶段）
- 拆两阶段实证价值已证明（Phase 9 / Step 6 + Step 14 两次实战）
- 不预先锁定 Step 内部模式；让 Step 起草指令承接

---

## §D Phase 10 完整 Step 划分（裁决 2 锁定）

详见 §C 裁决 2 表格。本节强调 Step 之间的依赖关系：

```
Step 1 (本启程指令) ─┐
                     │
                     ├─→ Step 2 (协作三件套) ─┐
                     │                          │
                     ├─→ Step 3 (PR/Issue/CODEOWNERS) ─┤ (协作资产 7 件套补齐)
                     │                                  │
                     │   Step 4 (CI 强制门禁) ←────────┤ (依赖 .github/ 目录由 Step 3 创建)
                     │       │                          │
                     │       └─→ Step 5 (容器化) ←─────┤ (CI 验证镜像构建)
                     │           │                      │
                     │           └─→ Step 6 (发布自动化) ─┤ (依赖容器化镜像 + git tag)
                     │                │                  │
                     │                └─→ Step 7 (README + Runbook) ─┤ (CI 验证可执行示例)
                     │                                                │
                     └────────────────────────────────────────────────→ Step 8 (CLOSED + CHANGELOG)
```

**关键依赖**：
- Step 3 必须在 Step 4 之前（CI workflow 依赖 .github/ 目录）
- Step 4 必须在 Step 5 之前（CI 中验证 Dockerfile lint）
- Step 5 必须在 Step 6 之前（发布自动化依赖容器化镜像）
- Step 6 必须在 Step 7 之前（README 可执行示例可能引用发布流程）
- Step 8 在所有 Step 之后（收官）

---

## §E 每 Step 的 Definition of Done 概要

| Step | DoD 核心 |
|---|---|
| 1 | ADR-0003 三段创建（Status DRAFT → In Progress 在 PHASE_IMPLEMENT 升级）+ docs/phase10/00-phase-10-kickoff.md + docs/00-phase1-mapping.md Phase 10 启程段 + 用户 APPROVE |
| 2 | CONTRIBUTING.md（含贡献流程 / commit 风格 / branch 策略）+ CODE_OF_CONDUCT.md（基于 Contributor Covenant 等业界标准）+ SECURITY.md（含漏洞报告渠道）+ docs/phase10/02 执行记录 |
| 3 | .github/ISSUE_TEMPLATE/{bug_report.md, feature_request.md} + .github/PULL_REQUEST_TEMPLATE.md（含《宪法》§24.1 七项）+ CODEOWNERS（按 packages/ 子模块）+ docs/phase10/03 执行记录 |
| 4 | .github/workflows/ci.yml（lint + typecheck + test + coverage 全部强制）+ pnpm 命令本地与 CI 一致（§7.2）+ 85% 覆盖率门槛（如未达由 Step 4 决定路径）+ docs/phase10/04 执行记录 |
| 5 | Dockerfile（多阶段 / 非 root / 健康检查 / 尺寸合理）+ docker-compose.yml（覆盖真实基础设施）+ CI 中验证镜像构建 + docs/phase10/05 执行记录 |
| 6 | .github/workflows/release.yml（git tag 触发）+ 版本管理工具（changesets / 等价）+ release 流程文档 + docs/phase10/06 执行记录 |
| 7 | README.md 更新（含 Phase 1-9 累计能力 / 可执行的"如何启动 / 如何测试 / 如何部署"段；CI 验证）+ docs/runbook/ 创建（§12.4 同步运维行为）+ docs/phase10/07 执行记录 |
| 8 | ADR-0003 Status 升级 `Accepted (Phase 10 CLOSED, 2026-XX-XX)` + ADR-0003 Consequences 段撰写 + CHANGELOG.md Phase 10 段（在 Phase 9 段之前插入）+ git tag `phase-10-closed` + docs/phase10/08 收官记录 + Phase 10 CLOSED 显式声明 ≥ 5 处 |

---

## §F 与 Phase 9 既有能力的关系

Phase 10 不消费 / 不修改 Phase 9 任何业务能力。Phase 10 是"工程化基础设施 + 协作生态"层，与业务层（Phase 1-9）解耦。

| 维度 | Phase 9 业务层 | Phase 10 工程化层 |
|---|---|---|
| domain | ✅ Phase 9 / Step 15 §4.8 编译期硬约束 | Phase 10 不触碰 domain |
| application（saga 模块）| ✅ 7 saga 模块 | Phase 10 不修改 |
| ports / contracts / shared | ✅ Phase 9 引入 3 新 Port + 5 错误码 | Phase 10 不引入新 Port / 错误码 |
| adapters | ✅ Phase 8 13 + Phase 9 4 持久化 | Phase 10 不引入新 Adapter |
| 测试 | ✅ 1971 tests | Phase 10 测试增量接近 0 |
| 文档 | docs/phase8 + docs/phase9 + ADR-0001 + ADR-0002 | Phase 10 新增 docs/phase10 + ADR-0003 + 工程化文档 |
| 协作资产 | 1/7（仅 CHANGELOG） | Phase 10 补齐 7/7 |
| CI | 0 | Phase 10 从 0 建立 |
| 容器化 | 0 | Phase 10 从 0 建立 |

**Phase 10 完成后 Phase 9 业务能力依然完整**——工程化基础设施仅是"包装层"，不破坏业务核心。

---

## §G Phase 10 累计预期工程量

| 维度 | Phase 9 baseline | Phase 10 预期增量 | 备注 |
|---|---|---|---|
| Workspace 包数 | 25 | +0 | Phase 10 不引入新包 |
| 测试总数 | 1971 | 接近 +0（最多 +若干工程化测试）| 接近无业务测试增量 |
| 错误码 | TQ-INF 001-024 / TQ-CON 001-014 / TQ-SAG 001-005 | +0 | 工程化主题不引入业务错误码 |
| 覆盖率 lines | 84.92% | 维持或小幅改善（≥ 85%）| Step 4 强制门禁激活 |
| 业务代码 LOC | ~ Phase 9 终态 | +0 | 严禁业务代码增量 |
| 协作资产文件数 | 2（README + CHANGELOG）| +5（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / Issue 模板 / PR 模板）+ CODEOWNERS | 补齐 7/7 |
| .github/ 工作流文件 | 0 | +2-3（ci.yml + release.yml + 等）| 从 0 建立 |
| 容器化文件 | 0 | +2（Dockerfile + docker-compose.yml）| 从 0 建立 |
| docs/phase10/ 执行记录 | 0 | +9（启程 + 8 Step）| 沿用 Phase 8/9 模式 |
| ADR 文档 | 2（ADR-0001 + ADR-0002）| +1（ADR-0003）| Phase 10 主题独立 ADR |
| Runbook | 0 | +若干（docs/runbook/ 子目录）| §12.4 同步运维行为 |
| git tag | 1（phase-9-closed）| +1（phase-10-closed） | 沿用 phase-N-closed 约定 |
| README 长度 | ~150 行（停留 Phase 1-7）| 显著增加（反映 Phase 1-9 累计 + 可执行示例）| Step 7 责任 |
| CHANGELOG 长度 | ~360 行（Phase 8 + Phase 9 段）| +~150 行（Phase 10 段）| Step 8 一次性追加 |

**Phase 10 总工程量预估**：约 +500-800 行非代码内容（文档 + 配置 + 工作流），零业务代码 LOC。

---

## §H Phase 10 强制开局动作模板（裁决 4 B 锁定；自 Step 2 起每 Step 必做）

**4 项基础 + 工程化主题专属核查**：

```
1. 重读宪法 + 补充文档（关键章节按 Step 主题）
2. 核查 KNOWN-ISSUES 5 项 KI 状态（不修，仅核查状态稳定）
3. 核查 ADR-0001 + ADR-0002 + ADR-0003（含本启程后 ADR-0003 状态）
4. 工程化主题专属核查（视 Step 主题决定）：
   - Step 2: 核查既有 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY 文档
   - Step 3: 核查既有 .github/ 目录 + 主流 PR/Issue 模板格式
   - Step 4: 核查既有 .github/workflows/ + pnpm 命令本地一致性
   - Step 5: 核查既有 Dockerfile / docker-compose / 容器化工具链
   - Step 6: 核查既有 git tag + changesets / 替代工具
   - Step 7: 核查 README 当前内容 + Runbook 既有结构
   - Step 8: 核查 ADR-0003 状态 + CHANGELOG / git tag 既有约定
```

---

## §I 核心未决判断（请重点审视）

### §I.1 Phase 10 主题边界的严格性

**事实**：裁决 1 α 选择"严格按补充文档 §1.2"主题；不顺手修业务 KI / 业务能力扩展。

**审视点**：用户是否同意 Phase 10 主题严格专注于"工程化与协作基础"？KI-P8-001 domain 75.16% 是否应在 Phase 10 内顺手修复（违反主题专注）还是留给独立 Phase？

**草案处置**：保持裁决 1 α；KI-P8-001 修复责任 Phase 调整为"独立 Phase"，本启程指令在 Step 1 PHASE_IMPLEMENT 阶段同步更新 KNOWN-ISSUES.md。

### §I.2 Step 4 CI 覆盖率门槛策略（85% 当前 84.92% 差 0.08pp）

**事实**：补充文档 §9.3 Phase 10 CLOSED 后 85% 成 CI 强制门禁。当前 84.92% 差 0.08pp。

**审视点**：用户是否接受由 Step 4 内部决定具体路径（小幅补充工程化测试 / 暂留 Phase 11 / 调整策略）？或要求本启程指令预先决定？

**草案处置**：保持裁决 6 — 由 Step 4 内部决定。本启程指令不预先决定。

### §I.3 Step 划分粒度

**事实**：裁决 2 选择 8 Step（含本启程指令）。Phase 8/9 各 19 Step；Phase 10 业务复杂度低。

**审视点**：用户是否同意 8 Step 粒度？是否觉得 Step 2 + Step 3 应合并（两者都是协作资产工作）？是否觉得 Step 6 发布自动化应单独作为独立 Phase（Phase 10 后期 / Phase 11+）？

**草案处置**：保持裁决 2 候选 A 8 Step；如用户审视后要求合并 Step 2-3 或拆分某 Step 可由 REQUEST_CHANGES 反馈调整。

### §I.4 Step 1 与本启程指令的关系

**事实**：裁决 2 把本启程指令作为 Step 1（含 ADR-0003 + 启程标记）。

**审视点**：用户是否同意"本启程指令 = Step 1"？或要求本启程指令独立标识为"Phase 10 Kickoff"，Phase 10 / Step 1 起步从协作资产开始？

**草案处置**：保持裁决 2 候选 A 模式（本启程指令 = Step 1）。Phase 10 内部从 Step 2 起每 Step 独立指令承接。

### §I.5 Phase 10 拆两阶段流程的应用范围

**事实**：裁决 9 选择"视具体 Step 复杂度决定"。

**审视点**：用户是否同意？或要求本启程指令预先锁定哪些 Step 必拆两阶段（譬如 Step 4 CI / Step 5 容器化）？

**草案处置**：保持裁决 9 B；由 Step 起草指令独立判断。

---

## §J 第一阶段产出清单

| 文件 | 状态 |
|---|---|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | ✅ 创建（Status DRAFT + Context + Decision 占位）|
| `docs/phase10/PHASE-10-DESIGN-DRAFT.md` | ✅ 创建（本文件；PHASE_IMPLEMENT 阶段删除）|
| 本机 git commit | ⏸ 待执行（一个 commit；NOT push）|
| origin/main HEAD | 不变（c9ebe88 — Phase 9 / Step 19 最终 commit）|

---

## §K 等待用户回执

**用户回执三种可能**：

1. **APPROVE** — 进入 PHASE_IMPLEMENT 阶段（升级 ADR-0003 Status DRAFT → In Progress；删除本草案文件；创建 docs/phase10/00-phase-10-kickoff.md；同步 docs/00-phase1-mapping.md；push）
2. **REQUEST_CHANGES + 反馈** — 草案需修改具体位置（譬如 9 个核心裁决调整 / Step 划分粒度调整）
3. **REJECT + 重大方向调整** — 整体方向需重新设计

**草案完成。请审视后回执**。

---

**Phase 10 启程 PHASE_DESIGN 阶段完成 — 2026-05-02**

拆两阶段流程第 3 次实战；Phase 启程级（vs Phase 9 / Step 6 + Step 14 Step 启程级）。
