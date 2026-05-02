# Phase 10 启程 — PHASE_DESIGN 草案 v2

> **状态**：DRAFT v2 — 用户 v1 REQUEST_CHANGES + 反馈后修订；等待 v2 APPROVE
> **版本**：v2（v1 用户审视后第 1 轮修订）
> **草案时间**：2026-05-02
> **覆盖**：Phase 10 启程指令第一阶段（PHASE_DESIGN）v2 修订
> **作废时点**：第二阶段 PHASE_IMPLEMENT 完成时本文件立即删除（设计沉淀进 ADR-0003 + docs/phase10/00-phase-10-kickoff.md）

本草案是 Phase 10 启程指令拆两阶段流程的产物——拆两阶段流程**第 3 次实战**（前两次：Phase 9 / Step 6 SagaOrchestrator + Phase 9 / Step 14 CrossSagaCoordination）。Phase 启程比 Step 启程更值得拆两阶段：用户审视 Phase 10 完整 Step 划分前不进入实施。

## v2 修订说明（用户审视后落地）

用户 v1 回执：5 项未决判断 K.1-K.5——
- **K.1**：APPROVE + **修正补丁**（KNOWN-ISSUES.md KI-P8-001 修复责任 Phase: `Phase 10` → `Phase 13+ TBD`）
- **K.2**：**REQUEST_CHANGES + 锁定策略**（Step 3 CI 门槛 84% 起步；Step 7 CLOSED 升级 85% + 升级路径 A/B 推荐 / C fallback）
- **K.3**：**REQUEST_CHANGES + 二选一**（方案 A 合并 Step 2/3 vs 方案 B 重新平衡）
- **K.4**：**REQUEST_CHANGES + 重新命名**（本启程指令独立命名 "Phase 10 Kickoff" 不算 Step；总数 7 Step + 1 Kickoff 或 8 Step + 1 Kickoff）
- **K.5**：APPROVE（保留拆两阶段视 Step 复杂度决定）

**关键观察**（用户提出）：ADR-0003 命名建议改 "Engineering and Release Foundation"；AI 可裁决保留 + 明示理由。

v2 全部裁决落地详见 §C 9 裁决摘要 + §I.6 ADR 命名裁决。

---

## §A 强制开局动作 1-6 执行确认（v1 已完成）

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》（1106 行）+ 《补充文档》（537 行）—— 全部章节 | ✅ |
| 2 | 核查 KNOWN-ISSUES 5 项 open KI（KI-P8-001/002/003/005 + KI-P9-001）| ✅ — Phase 10 不修任一 KI |
| 3 | 核查 ADR-0001 + ADR-0002（Phase 8 + Phase 9 全部 Accepted） | ✅ |
| 4 | 核查 Phase 1-9 既有协作资产现状 | ✅ — 详见 §B.1 |
| 5 | 核查 Phase 1-9 既有 CI 配置覆盖度 | ✅ — 详见 §B.2 |
| 6 | 核查 Phase 1-9 既有 docs 完整性 | ✅ — 详见 §B.3 |

---

## §B 强制开局动作 4-6 实地核查结果（v1 已落地，v2 不变更）

### §B.1 既有协作资产现状（强制开局动作 4）

实测 `ls -la README.md CONTRIBUTING.md CODE_OF_CONDUCT.md SECURITY.md CHANGELOG.md CODEOWNERS Dockerfile docker-compose.yml`：

| 资产 | 状态 | Phase 10 责任 Step（v2 编号）|
|---|---|---|
| README.md | ✅ 存在（8085 字节） | **严重过时**——内容停留在 Phase 1-7 / 1106 tests；Step 6 责任 |
| CHANGELOG.md | ✅ 存在（23064 字节） | Phase 9 / Step 19 创建；最新；Step 7 责任（Phase 10 段追加） |
| CONTRIBUTING.md | ❌ 不存在 | **Step 1 责任** |
| CODE_OF_CONDUCT.md | ❌ 不存在 | **Step 1 责任** |
| SECURITY.md | ❌ 不存在 | **Step 1 责任** |
| CODEOWNERS | ❌ 不存在 | **Step 2 责任** |
| Dockerfile | ❌ 不存在 | **Step 4 责任** |
| docker-compose.yml | ❌ 不存在 | **Step 4 责任** |
| .github/ 目录 | ❌ 不存在 | **Step 2 + Step 3 责任** |
| Issue 模板 | ❌ 不存在 | **Step 2 责任** |
| PR 模板 | ❌ 不存在 | **Step 2 责任** |
| Runbook | ❌ 不存在 | **Step 6 责任** |

**协作资产基线：1/7**。Phase 10 / Step 1-2 责任：补齐协作资产 7 件套。

### §B.2 既有 CI 配置覆盖度（强制开局动作 5）

实测 `ls -la .github/`：**目录不存在**——仓库**完全没有 CI 配置**。

| §7.1 / §7.2 期望 | 现状 |
|---|---|
| lint 零警告（CI 强制） | 仅本地执行 |
| typecheck 零错误（CI 强制） | 仅本地执行 |
| test 全绿（CI 强制） | 仅本地执行 |
| 测试总数不得减少 | 无 CI 强制 |
| 覆盖率不得低于 85%（CI 强制门禁，§9.3）| 当前 84.92%（无 CI 强制；**Step 3 起步 84%；Step 7 升级 85%**——v2 K.2 锁定）|
| 契约变更必须在 PR 描述中声明 | 无 PR 模板 |
| 本地与 CI 一致（一键命令跑通范围相同）| N/A |

**CI 基线：0**。Phase 10 / Step 3 责任：从零建立 CI 强制门禁。

### §B.3 既有 docs 完整性（强制开局动作 6）

| 维度 | 实测 |
|---|---|
| docs/00-phase1-mapping.md | ✅ 存在；含 Phase 1-9 完整索引 |
| docs/decisions/ | ✅ ADR-0001（Phase 8 Accepted）+ ADR-0002（Phase 9 Accepted）；本启程指令创建 ADR-0003 DRAFT v2 |
| docs/phase8/ | ✅ 19 文件（Phase 8 各 Step 执行记录） |
| docs/phase9/ | ✅ 19 文件（Phase 9 各 Step 执行记录） |
| docs/01-19-*.md | ✅ Phase 1-7 历史 |
| docs/phase10/ | 本启程指令创建（含 PHASE-10-DESIGN-DRAFT.md v2）|
| README "如何启动 / 如何测试 / 如何部署" 可执行段 | ⚠️ README 内容滞后（停留 Phase 1-7 / 1106 tests）|
| Runbook | ❌ 不存在 |

---

## §C 9 个核心裁决摘要（v2 修订完成）

### 裁决 1：Phase 10 主题边界 = α 严格按补充文档 §1.2 + **K.1 修正补丁**

**选择 α**：工程化与协作基础——CI/CD + 协作资产 + 容器化 + 文档可执行 + 覆盖率门槛升级。

**理由**（v1 不变）：补充文档 §1.2 明确主题；β/γ 让主题混乱被拒绝。

**v2 K.1 修正补丁**（PHASE_IMPLEMENT 阶段执行）：KNOWN-ISSUES.md KI-P8-001 修复责任 Phase 字段：`Phase 10` → **`Phase 13+ TBD`**。

理由：Phase 10 工程化 / Phase 11 真实基础设施 / Phase 12 发布就绪都是非业务覆盖率改善 Phase；KI-P8-001 是业务 domain 覆盖率，应留待 Phase 13+ 业务能力延伸 Phase 修复。"Phase 13+ TBD" 表达"Phase 13 或之后；具体 Phase 待相关 Phase 起步指令承接"。

### 裁决 2：Phase 10 完整 Step 划分 = **方案 B 重新平衡（v2）**

**v2 选择 K.3 方案 B**：不合并 Step 1 / Step 2；7 Step + 1 Kickoff = 8 总数。

| 编号 | 主题 | 性质 |
|---|---|---|
| **Phase 10 Kickoff** | **本启程指令**（PHASE_DESIGN v1+v2 + PHASE_IMPLEMENT；ADR-0003 + 启程标记；不算 Step）| **启程战** |
| Step 1 | 协作资产基础三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）| 协作 |
| Step 2 | PR 模板 + Issue 模板 + CODEOWNERS（.github/ 目录建立）| 协作 |
| Step 3 | CI 强制门禁（GitHub Actions workflow + lint/typecheck/test/coverage + **84% 起步门槛**）| 工程化 |
| Step 4 | 容器化（Dockerfile 多阶段 + 非 root + 健康检查 + docker-compose 开发编排）| 工程化 |
| Step 5 | 发布自动化（git tag 触发流水线 + changesets 或等价工具）| 工程化 |
| Step 6 | README 可执行性更新 + Runbook 同步 | 文档 |
| Step 7 | Phase 10 CLOSED + CHANGELOG 更新 + **CI 门槛升级 84% → 85%** | 收官 |

**裁决 K.3 方案 B（不合并）vs 方案 A（合并 Step 1+2）—— 选 B 理由**：

1. **主题专注度（最重要）**：协作三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）是**通用项目文档**（写作内容性质——使命陈述 / 行为准则 / 漏洞报告渠道），与 GitHub 平台无关；PR/Issue 模板 + CODEOWNERS 是 **GitHub 平台特定资产**（YAML/Markdown 模板 + CODEOWNERS 路径解析），依赖 .github/ 目录建立。两类工作的强制开局动作（"实地核查"内容）完全不同
2. **与 K.2 用户编号一致**：用户 K.2 反馈"Step 3 CI / Step 7 CLOSED"按方案 B 编号（方案 A 合并后 Step 数会下移；CI 在 Step 2，CLOSED 在 Step 6）
3. **拒绝"为合并而合并"**：把不同性质工作（通用文档 + GitHub 平台特定）塞进单 Step 是"合并而非简化"——违反"克制 > 堆砌"宗旨第一原则（克制不是减少 Step 数，而是单 Step 主题专注）
4. **与 Phase 9 Step 单一职责一致**：Phase 9 19 Step 各 Step 主题独立；Phase 10 沿用此模式让起草指令工作量分布合理

### 裁决 3：强制创建 ADR-0003（v1 已落地；v2 不变更）

ADR-0003 三段（Status DRAFT v2 + Context + Decision 占位）已落地。

### 裁决 4：Phase 10 强制开局动作模板 = B（4 项基础 + 工程化主题专属核查）

**Step 编号映射（v2 修订）**：

| Step | 工程化主题专属核查（动作 4） |
|---|---|
| Step 1 | 既有项目 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY 文档惯例（主流参照：Contributor Covenant 等）|
| Step 2 | 既有 .github/ 目录 + GitHub 平台 PR/Issue 模板格式 + Tianqi 包 owner 划分 |
| Step 3 | 既有 .github/workflows/ + pnpm 命令本地一致性 + 当前覆盖率实测 |
| Step 4 | 既有 Dockerfile / docker-compose / 容器化工具链 |
| Step 5 | 既有 git tag + changesets / 替代工具 |
| Step 6 | README 当前内容 + Runbook 既有结构 |
| Step 7 | ADR-0003 状态 + CHANGELOG / git tag 既有约定 + Step 3-6 累计覆盖率改善实测 |

### 裁决 5：Phase 10 元规则 / 惯例新增 = A 不新增（v1 不变）

沿用 15 元规则（A-Q）+ 3 惯例（K/L/M）；规则膨胀违反"克制"。

### 裁决 6：Phase 10 测试与覆盖率策略 = A 严守 + **K.2 升级路径锁定**

**v1 选择**：A 严守"不增加业务测试"+ 必要时允许 B 工程化测试；严禁 C 主动改善覆盖率。

**v2 K.2 锁定升级路径**：

- **Step 3 起步**：CI 门槛 = **84%**（当前实测 84.92%；84% 起步给 Step 3-6 实施过程缓冲空间，不让 CI 一启用就阻塞主分支推进）
- **Step 7 收官升级**：CI 门槛 84% → **85%**（补充文档 §9.3 Phase 10 CLOSED 后 85% 强制门禁）
- **升级路径三选**：
  - **A 推荐**：Step 3-6 实施过程顺手改善覆盖率（若有自然增量譬如新工程化测试 / Dockerfile lint 测试 / CI workflow 验证测试）
  - **B 推荐**：Step 7 收官前实测覆盖率：
    - 若 ≥85% → 直接升级 CI 门槛
    - 若略低（≤0.5pp 差距）→ Step 7 内部小幅补充工程化测试改善
  - **C fallback**：若 Step 7 收官时仍 < 85%（罕见情况），登记新 KI（譬如 KI-P10-001 "覆盖率门槛升级延后"）+ 保持 84% 门槛 + Phase 11 责任改善 + ADR-0003 修订流程明示降级理由

**rationale**：当前 84.92% 差 0.08pp 即达 85%。升级路径 A/B 是预期路径；C 仅作 fallback。

### 裁决 7：Phase 10 git tag 命名 = `phase-10-closed`（v1 不变）

沿用 Phase 9 / Step 19 建立的 `phase-N-closed` 约定。

### 裁决 8：CHANGELOG 维护策略 = A 仅 Phase 10 CLOSED 时一次性追加（v1 不变）

Step 7 责任。

### 裁决 9：拆两阶段流程 = B 视具体 Step 复杂度决定（v1 不变；K.5 同意保留）

由各 Step 起草指令独立判断。本启程指令拆两阶段是 Phase 启程级（必拆）；Phase 10 内部 Step 视复杂度独立决定。

---

## §D Phase 10 完整 Step 划分（v2 锁定）

详见裁决 2 表格。本节强调 Step 之间的依赖关系：

```
Phase 10 Kickoff (本启程指令)
        │
        ▼
Step 1 (协作三件套) ───┐
                        │
Step 2 (PR/Issue/CODEOWNERS) ─┤ 协作资产 7 件套补齐 (1+2)
        │                       │
        ├──→ Step 3 (CI 84% 起步) ←──┤ (依赖 .github/ 目录由 Step 2 创建)
        │       │
        │       └──→ Step 4 (容器化) ←──┤ (CI 验证镜像构建)
        │           │
        │           └──→ Step 5 (发布自动化) ←──┤ (依赖容器化镜像 + git tag)
        │               │
        │               └──→ Step 6 (README + Runbook) ←──┤ (CI 验证可执行示例 + Runbook 引用前置 Step)
        │                       │
        └───────────────────────└──→ Step 7 (CLOSED + 升级 85%)
```

**关键依赖**：
- Step 2 必须在 Step 3 之前（CI workflow 依赖 .github/ 目录由 Step 2 建立）
- Step 3 必须在 Step 4 之前（CI 中验证 Dockerfile lint）
- Step 4 必须在 Step 5 之前（发布自动化依赖容器化镜像）
- Step 5 必须在 Step 6 之前（README 可执行示例可能引用发布流程）
- Step 6 必须在 Step 7 之前（README + Runbook 完整性是 CLOSED 前置）
- Step 7 在所有 Step 之后（收官；含覆盖率升级 84% → 85%）

---

## §E 每 Step 的 Definition of Done 概要（v2 重新编号）

| Step | DoD 核心 |
|---|---|
| **Kickoff** | ADR-0003 DRAFT v2 + Context + Decision 占位 + PHASE-10-DESIGN-DRAFT.md v2 + 用户 APPROVE → PHASE_IMPLEMENT 阶段升级 ADR Status In Progress + 删除草案 + docs/phase10/00-phase-10-kickoff.md + docs/00-phase1-mapping.md Phase 10 启程段 + KNOWN-ISSUES.md KI-P8-001 字段调整 → push |
| Step 1 | CONTRIBUTING.md（含贡献流程 / commit 风格 / branch 策略）+ CODE_OF_CONDUCT.md（基于 Contributor Covenant 等业界标准）+ SECURITY.md（含漏洞报告渠道）+ docs/phase10/01 执行记录 |
| Step 2 | .github/ISSUE_TEMPLATE/{bug_report.md, feature_request.md} + .github/PULL_REQUEST_TEMPLATE.md（含《宪法》§24.1 PR 七项）+ CODEOWNERS（按 packages/ 子模块）+ docs/phase10/02 执行记录 |
| Step 3 | .github/workflows/ci.yml（lint + typecheck + test + coverage 全部强制）+ pnpm 命令本地与 CI 一致（§7.2）+ **CI 覆盖率门槛 84% 起步**（K.2 锁定）+ docs/phase10/03 执行记录 |
| Step 4 | Dockerfile（多阶段 / 非 root / 健康检查 / 尺寸合理）+ docker-compose.yml（覆盖真实基础设施）+ CI 中验证镜像构建 + docs/phase10/04 执行记录 |
| Step 5 | .github/workflows/release.yml（git tag 触发）+ 版本管理工具（changesets / 等价）+ release 流程文档 + docs/phase10/05 执行记录 |
| Step 6 | README.md 更新（含 Phase 1-9 累计能力 / 可执行的"如何启动 / 如何测试 / 如何部署"段；CI 验证）+ docs/runbook/ 创建（§12.4 同步运维行为）+ docs/phase10/06 执行记录 |
| Step 7 | ADR-0003 Status 升级 `Accepted (Phase 10 CLOSED, 2026-XX-XX)` + ADR-0003 Consequences 段撰写 + CHANGELOG.md Phase 10 段（在 Phase 9 段之前插入）+ git tag `phase-10-closed` + **CI 门槛升级 84% → 85%**（K.2 锁定升级路径 A/B/C 三选）+ docs/phase10/07 收官记录 + Phase 10 CLOSED 显式声明 ≥ 5 处 |

---

## §F 与 Phase 9 既有能力的关系（v1 不变）

Phase 10 不消费 / 不修改 Phase 9 任何业务能力。Phase 10 是"工程化基础设施 + 协作生态"层，与业务层（Phase 1-9）解耦。

| 维度 | Phase 9 业务层 | Phase 10 工程化层 |
|---|---|---|
| domain | ✅ Phase 9 / Step 15 §4.8 编译期硬约束 | Phase 10 不触碰 domain |
| application（saga 模块）| ✅ 7 saga 模块 | Phase 10 不修改 |
| ports / contracts / shared | ✅ Phase 9 引入 3 新 Port + 5 错误码 | Phase 10 不引入新 Port / 错误码 |
| adapters | ✅ Phase 8 13 + Phase 9 4 持久化 | Phase 10 不引入新 Adapter |
| 测试 | ✅ 1971 tests | Phase 10 测试增量接近 0（必要时允许 B 工程化测试）|
| 文档 | docs/phase8 + docs/phase9 + ADR-0001 + ADR-0002 | Phase 10 新增 docs/phase10 + ADR-0003 + 工程化文档 |
| 协作资产 | 1/7（仅 CHANGELOG） | Phase 10 补齐 7/7 |
| CI | 0 | Phase 10 从 0 建立 |
| 容器化 | 0 | Phase 10 从 0 建立 |

---

## §G Phase 10 累计预期工程量（v2 调整）

| 维度 | Phase 9 baseline | Phase 10 预期增量 | 备注 |
|---|---|---|---|
| Workspace 包数 | 25 | +0 | Phase 10 不引入新包 |
| 测试总数 | 1971 | 接近 +0（最多 +若干工程化测试）| 接近无业务测试增量 |
| 错误码 | 84 | +0 | 工程化主题不引入业务错误码 |
| 覆盖率 lines | 84.92% | **Step 3 84% 起步 → Step 7 升级 ≥85%**（K.2 锁定）| 升级路径 A/B/C 三选 |
| 业务代码 LOC | ~ Phase 9 终态 | +0 | 严禁业务代码增量 |
| 协作资产文件数 | 2（README + CHANGELOG）| +5（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / Issue 模板 / PR 模板）+ CODEOWNERS | 补齐 7/7 |
| .github/ 工作流文件 | 0 | +2-3（ci.yml + release.yml + 等）| 从 0 建立 |
| 容器化文件 | 0 | +2（Dockerfile + docker-compose.yml）| 从 0 建立 |
| docs/phase10/ 执行记录 | 0 | +8（Kickoff + 7 Step）| 沿用 Phase 8/9 模式（v2 调整：Kickoff 独立 + 7 Step）|
| ADR 文档 | 2（ADR-0001 + ADR-0002）| +1（ADR-0003）| Phase 10 主题独立 ADR |
| Runbook | 0 | +若干（docs/runbook/ 子目录）| §12.4 同步运维行为 |
| git tag | 1（phase-9-closed）| +1（phase-10-closed） | 沿用 phase-N-closed 约定 |
| README 长度 | ~150 行（停留 Phase 1-7）| 显著增加（反映 Phase 1-9 累计 + 可执行示例）| Step 6 责任 |
| CHANGELOG 长度 | ~360 行（Phase 8 + Phase 9 段）| +~150 行（Phase 10 段）| Step 7 一次性追加 |

---

## §H Phase 10 强制开局动作模板（裁决 4 B 锁定；v2 重新编号）

```
1. 重读宪法 + 补充文档（关键章节按 Step 主题）
2. 核查 KNOWN-ISSUES 5 项 KI 状态（不修；仅核查状态稳定）
3. 核查 ADR-0001 + ADR-0002 + ADR-0003（含本启程后 ADR-0003 状态）
4. 工程化主题专属核查（视 Step 主题决定）：
   - Step 1: 既有项目 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY 文档惯例
   - Step 2: 既有 .github/ 目录 + GitHub 平台 PR/Issue 模板格式
   - Step 3: 既有 .github/workflows/ + pnpm 命令本地一致性 + 当前覆盖率实测
   - Step 4: 既有 Dockerfile / docker-compose / 容器化工具链
   - Step 5: 既有 git tag + changesets / 替代工具
   - Step 6: README 当前内容 + Runbook 既有结构
   - Step 7: ADR-0003 状态 + CHANGELOG / git tag 既有约定 + Step 3-6 累计覆盖率改善实测
```

---

## §I 核心未决判断处置（v1 → v2 用户审视后落地）

### §I.1 Phase 10 主题边界的严格性 — **v1 K.1 APPROVE + v2 修正补丁**

用户同意主题严格（α 严格按补充文档 §1.2）+ KI-P8-001 不修。

**v2 修正补丁**：PHASE_IMPLEMENT 阶段同步更新 KNOWN-ISSUES.md KI-P8-001 修复责任 Phase 字段 `Phase 10` → `Phase 13+ TBD`。

### §I.2 CI 覆盖率门槛策略 — **v2 K.2 锁定**

- Step 3 起步 84%
- Step 7 升级 85%
- 升级路径 A/B 推荐 / C fallback（详见裁决 6）

### §I.3 Step 划分粒度 — **v2 K.3 二选一裁决：方案 B**

**v2 选方案 B（不合并 Step 1/2；7 Step + 1 Kickoff）**。理由详见裁决 2。

### §I.4 Step 1 与本启程指令的关系 — **v2 K.4 重新命名落地**

**v2 落地**：本启程指令独立命名 "Phase 10 Kickoff"（不算 Step）；Phase 10 / Step 1 起步从协作三件套开始；Step 编号 1-7（共 7 Step + 1 Kickoff = 8 总数）。

### §I.5 Phase 10 拆两阶段流程的应用范围 — **v1 K.5 APPROVE**

用户同意 B 视具体 Step 复杂度决定。Phase 10 内部 Step 由起草指令独立判断（譬如 Step 3 CI 强制门禁可能拆两阶段；Step 4 容器化可能拆两阶段；其他通常单阶段）。

### §I.6 ADR-0003 命名裁决 — **v2 关键观察响应**

用户建议改 "Engineering and Release Foundation"；AI 可裁决保留 + 明示理由。

**v2 裁决**：**保留 "Engineering and Collaboration Foundation"**。

理由：

1. **严格按补充文档 §1.2 直译**："Phase 10：工程化与协作基础"——"协作" = "Collaboration"
2. **工作分布**：8 总数（7 Step + 1 Kickoff）中"协作"占 3 Step（Step 1+2+6 README+Runbook 也含协作维度）/"工程化"占 2 Step（Step 3+4）/"发布"占 1 Step（Step 5）/"收官"占 1 Step（Step 7）；协作占比最高
3. **ADR 命名一致性**：ADR-0001 = "Adapter Layer Foundation"（Phase 8 = "基础设施适配器层"）；ADR-0002 = "Saga Orchestration Architecture"（Phase 9 = "分布式补偿完整实现"，标题取 Saga 编排核心）；ADR-0003 沿用补充文档 §1.2 直译模式
4. **拒绝 "Release Foundation"**：Release（发布自动化）只是 Phase 10 一个 Step（Step 5）；用作 ADR 标题让发布权重过高 / 协作维度被遮蔽

---

## §J 第二版产出清单

| 文件 | 状态 |
|---|---|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | ✅ v2 修订（Status DRAFT v2 + v2 修订要点 + 7 Step + 1 Kickoff 划分 + Step 编号映射 + K.1 修正补丁说明 + ADR 命名裁决）|
| `docs/phase10/PHASE-10-DESIGN-DRAFT.md` | ✅ v2 重写（本文件；PHASE_IMPLEMENT 阶段删除）|
| 本机 git commit (v2) | ⏸ 待执行（一个 commit；NOT push）|
| origin/main HEAD | 不变（c9ebe88 — Phase 9 / Step 19 最终 commit）|

---

## §K 等待用户回执（v2）

**v1 已落地裁决**（K.1 APPROVE + 修正补丁 / K.2 锁定 / K.3 方案 B / K.4 Kickoff 独立 / K.5 APPROVE / 关键观察 ADR 命名裁决保留）。

**用户 v2 回执三种可能**：

1. **APPROVE** — 进入 PHASE_IMPLEMENT 阶段（升级 ADR-0003 Status DRAFT v2 → In Progress；删除本草案文件；创建 docs/phase10/00-phase-10-kickoff.md；同步 docs/00-phase1-mapping.md；同步 KNOWN-ISSUES.md KI-P8-001 字段；push）
2. **REQUEST_CHANGES + 反馈** — v2 仍需修改具体位置
3. **REJECT + 重大方向调整** — 整体方向需重新设计

**v2 草案完成。请审视后回执**。

---

**Phase 10 启程 PHASE_DESIGN v2 阶段完成 — 2026-05-02**

拆两阶段流程第 3 次实战；Phase 启程级（vs Phase 9 / Step 6 + Step 14 Step 启程级）；v1 → v2 修订证明 Phase 启程级用户审视的实证价值。
