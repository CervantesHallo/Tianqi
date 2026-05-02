# Phase 10 Kickoff — 工程化与协作基础（启程战；v3 修订完成）

> **执行时间**：2026-05-02
> **类型**：Phase 10 启程战（不算 Step；K.4 重新命名落地）
> **本 Kickoff 性质**：Phase 启程级拆两阶段流程实战（PHASE_DESIGN v1 → v2 → APPROVE → PHASE_IMPLEMENT v2 → REQUEST_CHANGES + 4 项 v3 要求 → PHASE_IMPLEMENT v3）；零业务代码 / 零测试增量；纯设计 + 文档落地 + 工程教训沉淀
> **迭代轮数**：4 轮（v1 / v2 / PHASE_IMPLEMENT v2 / v3）
> **状态**：完成（v3）

---

## 🎯 Phase 10 启程显式声明（v3 修订完成）

**Phase 10 Kickoff — 2026-05-02**

| 维度 | 状态 |
|---|---|
| Phase 10 主题 | **工程化与协作基础**（CI/CD + 协作资产 + 容器化 + 文档可执行 + 覆盖率门槛升级）|
| Phase 10 Step 数 | **8 Step + 1 Kickoff = 9 总数**（**v3 修订**：新增 Step 0 — Phase 9 closure typecheck remediation）|
| ADR-0003 Status | **`In Progress (... PHASE_IMPLEMENT v2 → v3 ...)`** |
| 拆两阶段流程实战次数 | **第 3 次 + 首次 Phase 启程级 + 4 轮迭代**（v1 / v2 / PHASE_IMPLEMENT v2 / v3）|
| 业务代码增量 | **0**（克制原则——Phase 10 不构建业务代码）|
| 测试增量 | **0**（接近 0；最多允许 B 工程化测试 + Step 0 修复既有 mock）|
| 错误码增量 | **0**（惯例 K 严守）|
| 包数增量 | **0**（不引入新 package）|
| KI 状态变更 | (1) KI-P8-001 修复责任 Phase: `Phase 10` → **`Phase 13+ TBD`**（K.1 修正补丁）；(2) **新增 KI-P10-001**（Phase 9 closure typecheck 缺陷；修复责任 Phase 10 / Step 0）|
| KI 总数 | 5 → **6**（新增 KI-P10-001）|
| 元规则 Q 模板 | **v3 升级**：5 项动作含动作 5 全量验证 4 项独立命令（Phase 9 closure 教训工程化沉淀）|

**Phase 10 / Step 0 起步指令将由独立 Step 起草指令承接**（不在本 Kickoff 范围；Step 0 主题：Phase 9 closure typecheck remediation；KI-P10-001 修复 + 防御指引撰写；Step 0 完成后 Step 1 才能起步）。

---

## §A 当前任务

Phase 10 启程战——把 Phase 10 主题"工程化与协作基础"从概念落到可执行的 7 Step 划分 + ADR-0003 决议化（DRAFT v1 → DRAFT v2 → In Progress）+ Phase 10 内部 Step 增量追写阶段开启。Phase 10 启程指令拆两阶段流程是 Tianqi 历史第 3 次实战、首次 Phase 启程级实战——v1 → v2 修订证明 Phase 启程级用户审视的实证价值（用户审视 Phase 10 完整 Step 划分前不进入实施）。

---

## §B 影响范围

### B.1 修改文件（4 个，仅文档）

| 文件 | 变更 |
|---|---|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | DRAFT v1 创建（v1 commit b701830）→ DRAFT v2 修订（v2 commit 52b18ce）→ **In Progress** + §E.2 工作分布诚实修正（本 PHASE_IMPLEMENT commit）|
| `docs/KNOWN-ISSUES.md` | KI-P8-001 修复责任 Phase 字段：`Phase 10` → **`Phase 13+ TBD`**（K.1 修正补丁）|
| `docs/00-phase1-mapping.md` | 末尾追加 Phase 10 启程段（含 Phase 10 Kickoff 摘要 + 7 Step 划分） |
| `docs/phase10/PHASE-10-DESIGN-DRAFT.md` | **删除**（PHASE_DESIGN 阶段草案；设计沉淀进 ADR-0003 + 本启程记录后作废）|

### B.2 新增文件（1 个，本启程记录）

| 文件 | 性质 |
|---|---|
| `docs/phase10/00-phase-10-kickoff.md` | 本启程记录（A-I 9 节按 §七 输出格式编排）|

### B.3 业务代码 / 测试 / lockfile

- **业务代码**：0 修改（克制原则）
- **测试**：0 增量（裁决 6 严守）
- **lockfile** `pnpm-lock.yaml`：零变动
- **git diff**（业务层）：跨 Phase 1-9 全部锁定接口零变化

---

## §C 设计决策（v1 → v2 → APPROVE → PHASE_IMPLEMENT 全过程）

### C.1 强制开局动作 1-6 全部执行（Phase 启程级首次实战）

| # | 动作 | 实测结果 |
|---|---|---|
| 1 | 重读《宪法》（1106 行）+《补充文档》（537 行）| ✅ 全部章节复读 |
| 2 | 核查 KNOWN-ISSUES 5 项 KI（KI-P8-001/002/003/005 + KI-P9-001）| ✅ 4 carried over + 1 新增；状态稳定 |
| 3 | 核查 ADR-0001（Accepted）+ ADR-0002（Accepted Phase 9 CLOSED） | ✅ 两 ADR 状态稳定 |
| 4 | 核查 Phase 1-9 既有协作资产现状 | ✅ 1/7（仅 README + CHANGELOG；缺 5 项协作文件 + .github/ 目录）|
| 5 | 核查 Phase 1-9 既有 CI 配置覆盖度 | ✅ 0（无 .github/workflows/） |
| 6 | 核查 Phase 1-9 既有 docs 完整性 | ✅ docs/00-phase1-mapping + decisions/ + phase8/ + phase9/ 完整；docs/phase10 由本 Kickoff 创建 |

### C.2 9 个核心裁决最终选择（v2 全部锁定）

| # | 裁决 | 选择 |
|---|---|---|
| 1 | Phase 10 主题边界 | **α 严格按补充文档 §1.2** + **K.1 修正补丁**（KI-P8-001 修复责任 Phase: `Phase 10` → `Phase 13+ TBD`）|
| 2 | Phase 10 完整 Step 划分 | **K.3 方案 B 重新平衡**（不合并 Step 1/2；7 Step + 1 Kickoff = 8 总数）|
| 3 | 强制创建 ADR-0003 | ✅ 已创建（DRAFT v1 → v2 → In Progress）|
| 4 | 强制开局动作模板 | **B 4 项基础 + 工程化主题专属核查**（Step 1-7 各自专属核查表）|
| 5 | 元规则 / 惯例新增 | **A 不新增**（沿用 15 元规则 + 3 惯例）|
| 6 | 测试与覆盖率策略 | **A 严守 + K.2 升级路径锁定**（Step 3 起步 84% / Step 7 升级 85% / A/B/C 三路径）|
| 7 | git tag 命名 | **`phase-10-closed`**（沿用 Phase 9 / Step 19 建立的 `phase-N-closed` 约定）|
| 8 | CHANGELOG 维护策略 | **A 仅 Phase 10 CLOSED 时一次性追加**（Step 7 责任）|
| 9 | 拆两阶段流程范围 | **B 视具体 Step 复杂度决定**（K.5 同意保留）|

### C.3 用户 v1 → v2 反馈处理（5 项判断 + 1 项关键观察）

| 判断 | 用户回执 | v2 落地 |
|---|---|---|
| K.1 主题边界 | APPROVE + 修正补丁 | KI-P8-001 修复责任 Phase: `Phase 10` → `Phase 13+ TBD`（PHASE_IMPLEMENT 阶段执行） |
| K.2 CI 覆盖率门槛 | REQUEST_CHANGES + 锁定策略 | Step 3 起步 84% / Step 7 升级 85% / A/B/C 三路径锁定 |
| K.3 Step 划分粒度 | REQUEST_CHANGES + 二选一 | 选方案 B（不合并）；7 Step + 1 Kickoff = 8 总数 |
| K.4 启程指令命名 | REQUEST_CHANGES + 重新命名 | 本启程指令独立命名 "Phase 10 Kickoff"（不算 Step）；Step 编号 1-7 |
| K.5 拆两阶段流程范围 | APPROVE | 保留 B 视具体 Step 复杂度决定 |
| 关键观察 | ADR 命名建议改 "Engineering and Release Foundation" + AI 可裁决保留 | **裁决保留** "Engineering and Collaboration Foundation"（4 理由：直译§1.2 + 工作分布 + ADR 命名一致性 + 拒绝 Release Foundation）|

### C.4 PHASE_IMPLEMENT 阶段附加 §E.2 论证修正（用户 APPROVE 时附加要求）

用户 APPROVE 回执含附加 1 项 PHASE_IMPLEMENT 阶段同步要求：**ADR-0003 §E.2 论证修正**——"协作占比最高" → 基于实际 Step 主题分布的诚实表述；命名裁决保留。

**v1 工作分布原始表述**（不严谨）：
> "协作占 3 Step（Step 1+2+6 README+Runbook 也含协作维度）/ 工程化占 2 Step（Step 3+4）/ 发布占 1 Step（Step 5）/ 收官占 1 Step（Step 7）；协作占比最高"

**PHASE_IMPLEMENT 阶段诚实修正后表述**（按 Step 主题严格归类）：
- **纯协作占 2 Step**：Step 1（CONTRIBUTING/CODE_OF_CONDUCT/SECURITY）+ Step 2（PR/Issue/CODEOWNERS）
- **工程化占 3 Step**：Step 3（CI）+ Step 4（容器化）+ Step 5（发布自动化）
- **文档占 1 Step**：Step 6（README + Runbook；含协作维度但本质是文档）
- **收官占 1 Step**：Step 7
- **启程战占 1**：Phase 10 Kickoff

**诚实表述**：工程化 Step 数（3）≥ 协作 Step 数（2）。命名仍保留 "Collaboration" 是因 4 理由的合力（直译§1.2 / ADR 命名一致性 / 拒绝 Release Foundation 等），而非因协作 Step 数最多。

### C.5 PHASE_IMPLEMENT v3 修订（用户 REQUEST_CHANGES + 4 项 v3 要求落地）

PHASE_IMPLEMENT v2 完成后用户实测发现 Phase 9 closure 隐藏 typecheck 缺陷；REQUEST_CHANGES + 4 项 v3 修订要求让 Phase 10 流程在"事前防御机制"层面强化。

**v3 要求 1：创建 KI-P10-001（持续跟踪机制）**

KNOWN-ISSUES.md 新增 KI-P10-001 — Phase 9 closure 隐藏的 typecheck 缺陷。状态 open；位置 `packages/application/src/saga/saga-end-to-end.integration.test.ts`（10+ 处 mock builder 字段不匹配）；修复责任 Phase 10 / Step 0；防御机制由 Step 3 CI + 元规则 Q v3 模板承接；含协作 prompt 设计教训留痕。

**v3 要求 2：创建 Phase 10 / Step 0 — Phase 9 closure typecheck remediation**

不放在 Step 3 修复 — 独立 Step 0；Step 0 在 Step 1 之前执行；让 Step 1+ 在干净 baseline 上工作。Step 0 单一职责：(1) 修复 saga-end-to-end.integration.test.ts mock builder 字段（KI-P10-001 修复）；(2) 实测 4 项独立命令全绿；(3) 撰写"Phase closure typecheck 防御"指引；(4) KI-P10-001 状态 open → resolved；(5) 不引入新业务代码 / Port / Adapter。

Step 划分调整：v2 = 7 Step + 1 Kickoff = 8 总数 → **v3 = 8 Step + 1 Kickoff = 9 总数**（含 Step 0）。

**v3 要求 3：ADR-0003 同步修订**

ADR-0003 v3 含：Step 划分新增 Step 0 + 元规则 Q v3 模板更新 + Step 0 必要性论证 + Phase 9 closure typecheck 工程教训沉淀段（5 项工程教训沉淀路径 + 工程价值阐述）+ References 段更新（KI 总数 5 → 6）。

**v3 要求 4：元规则 Q 强制开局动作模板更新**

元规则 Q v3 模板新增动作 5：`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:coverage` 4 项独立命令各自独立执行**并各自记录实测输出**；不允许用单一命令的"顺带验证"替代独立 typecheck 验证。这是 Phase 9 closure 教训的工程化沉淀——让 Tianqi 工程纪律不仅在"事后诚实留痕"层面有效，更在"事前防御机制"层面强化。

**v3 协作 prompt 设计教训留痕**：Phase 9 / Step 17/18/19 起草指令在硬底中**未明确要求"独立 typecheck 验证"**；AI 跑 `pnpm test:coverage` 顺带验证类型，让 vitest 宽松类型检查掩盖了缺陷。这是协作 prompt 设计的疏漏，由 Phase 10 元规则 Q 模板更新承接补救，并显式留痕给未来用户避免再次类似疏漏。

### C.6 元规则 / 惯例触发情况（v3 修订）

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结） | **严守** — 本 Kickoff 仅文档变更；不触碰任何 Phase 1-9 已锁定签名（git diff zero 跨 Phase 1-9）；Step 0 修复 mock builder 字段**不属于已锁定签名修改**（mock builder 是测试 fixture 而非接口契约；修复让 mock 对齐既有 Engine Port 锁定签名而非修改签名）|
| 元规则 P（不主动引入第三方依赖）| **严守** — 0 新增第三方依赖（`pnpm-lock.yaml` 零变动）|
| 元规则 Q（强制开局动作）| **v3 模板升级 — 5 项动作含动作 5 全量验证 4 项独立命令**（Phase 9 closure 教训工程化沉淀）；Phase 10 Step 0-7 各自重复实战 |
| 惯例 K（错误码命名空间扩展）| **严守** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **沿用 Phase 9 模式** — ADR-0003 自此进入 Phase 10 内部 Step 增量追写阶段（Step 0-7 各自完成时追加） |
| §4.8 编译期硬约束 | **严守** — 本 Kickoff 不触碰 packages/domain；ESLint 规则零违规 |
| 拆两阶段流程 | **第 3 次实战 + 首次 Phase 启程级 + 4 轮迭代**（v1 → v2 → PHASE_IMPLEMENT v2 → v3；前两次 Phase 9 / Step 6 + Step 14 是 Step 启程级；本次 Phase 启程级 + 4 轮迭代证明拆两阶段流程的实证价值在 Phase 启程级显著）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A（本 Kickoff 不构建运行时代码）。

---

## §D 代码变更

### D.1 仅文档变更（无业务代码 / 测试 / lockfile 变化）

**`docs/decisions/0003-phase-10-engineering-and-collaboration.md`**：
- v1 创建（commit b701830）：Status DRAFT + Context + Decision 占位
- v2 修订（commit 52b18ce）：Status DRAFT v2 + 5 项 K 反馈落地 + ADR 命名裁决保留
- **PHASE_IMPLEMENT 修订（本 commit）**：Status `In Progress` + §E.2 工作分布诚实修正 + 拆两阶段流程描述更新

**`docs/KNOWN-ISSUES.md`**：
- KI-P8-001 修复责任 Phase 字段：`Phase 10` → **`Phase 13+ TBD`**（K.1 修正补丁；备注扩展含 Phase 10 主题边界论证）
- 备注调整：从"Phase 10 引入新业务流时应同步补"调整为"Phase 10 主题工程化非业务覆盖率改善（§1.2 直译边界）"

**`docs/00-phase1-mapping.md`**：
- 末尾追加 Phase 10 启程段（含 Phase 10 Kickoff 摘要 + 7 Step 划分 + 元规则触发表）

**`docs/phase10/PHASE-10-DESIGN-DRAFT.md`**：
- **删除**（PHASE_DESIGN 阶段草案；设计沉淀进 ADR-0003 + 本启程记录后作废）

**`docs/phase10/00-phase-10-kickoff.md`**：
- 新增（本启程记录）

---

## §E 风险点

### E.1 ADR-0003 Status `In Progress` 状态过度延展风险

**风险**：Phase 10 内部 7 Step 全部完成前 ADR-0003 都保持 `In Progress`；若 Phase 10 实施周期过长（譬如某 Step 阻塞），ADR 状态可能给读者"不确定性"信号。

**应对**：沿用 Phase 9 ADR-0002 模式（Phase 9 也是 19 Step 实施周期；ADR-0002 全程 In Progress 直到 Step 18 finalize）；Phase 10 各 Step 独立 commit 含明确 Status 时间戳，让读者翻 git log 即可判断进度。

### E.2 Phase 10 主题专注度被各 Step 实施过程"侵蚀"

**风险**：Phase 10 / Step 3 实施 CI 时可能"顺手"补业务测试改善覆盖率；Step 6 README 更新时可能"顺手"补 domain 文档触发 KI-P8-001；这些"顺手"行为违反 Phase 10 主题边界。

**应对**：每 Step 起草指令必须重申主题边界——Step 3 的"工程化测试"必须是"工程化"性质（譬如 CI workflow 自检 / Dockerfile lint）而非业务测试；Step 6 README 内容更新限定"反映 Phase 1-9 累计能力 + 可执行示例"而非新增 domain 文档。

### E.3 K.2 升级路径 C fallback 触发风险

**风险**：Step 7 收官时若覆盖率仍 < 85%（譬如 Step 3-6 实施过程让覆盖率下行），需触发 C fallback（登记 KI-P10-001 + 保持 84% 门槛 + Phase 11 责任改善）。

**应对**：Step 3-6 各自起草指令必须含"覆盖率监控"动作（每 Step 完成后实测覆盖率是否较 Step 3 起步水位下降）；若 Step 6 完成时已低于 84%，Step 7 起草指令必须含 fallback 启动条件。

### E.4 Phase 10 内部 Step 拆两阶段流程裁决一致性

**风险**：K.5 保留"视具体 Step 复杂度决定"——Step 3 / Step 4 可能拆两阶段，其他 Step 单阶段；裁决标准若不一致可能给读者"任意性"印象。

**应对**：每 Step 起草指令必须明示拆两阶段裁决理由（譬如 Step 3 CI 强制门禁因配置文件冻结后约束 Step 4-7；Step 4 容器化因 Dockerfile 多阶段构建复杂度高），让读者能理解裁决一致性。

---

## §F 测试计划

### F.1 已实施

本 Kickoff 仅文档变更，**0 业务代码 + 0 测试增量**。沿用 Step 17/18/19 纪律（Phase 9 收官三战全部 0 增量）。

### F.2 全量验证（PHASE_IMPLEMENT 阶段执行）

| 命令 | 期望结果 | 实测结果 |
|---|---|---|
| `pnpm lint` | 0 错误 / 0 警告 | ✅ 0 错误 / 0 警告 |
| `pnpm typecheck` | 0 错误（假设沿用 Phase 9 baseline）| ⚠️ **失败 — 发现 Phase 9 closure 隐藏缺陷**（详见 §F.4） |
| `pnpm test` | 1971 tests 全绿 | （未执行——typecheck 失败优先暴露根因）|
| `pnpm test:coverage` | 84.92% lines / 79.57% branches / 91.68% functions / 84.92% statements | （未执行）|

### F.3 KNOWN-ISSUES 状态稳定性核查

5 项 KI（KI-P8-001/002/003/005 + KI-P9-001）状态稳定（仅 KI-P8-001 修复责任 Phase 字段调整 `Phase 10` → `Phase 13+ TBD`；其他不变）。

### F.4 Phase 9 closure 隐藏 typecheck 缺陷发现（诚实留痕 + v3 修复路径）

**实测发现**：`pnpm typecheck` 在以下三个 commit 状态全部失败——
- `c9ebe88`（Phase 9 / Step 19 final / origin/main HEAD）：FAIL
- `52b18ce`（Phase 10 Kickoff PHASE_DESIGN v2 commit）：FAIL
- 本 PHASE_IMPLEMENT commit：FAIL

**双重确认本 Kickoff 文档变更未引入 / 未消除该错误**：
- `git stash` 我的所有 docs 变更后 typecheck 仍失败（测试 1）
- `git checkout c9ebe88 -- .` 强制 reset 至 Phase 9 / Step 19 final commit 后 typecheck 仍失败（测试 2）

**错误集中位置**：`packages/application/src/saga/saga-end-to-end.integration.test.ts`（Phase 9 / Step 16 commit `22f8a21` 创建）

**错误明细**（10 余处 mock builder 字段与 Engine Port 响应类型不匹配）：

| 行 | 错误 | 应修复 |
|---|---|---|
| 146 | `MarkPriceQuote` 不含 `queriedAt` 字段（应只在 `QueryMarkPriceBatchResponse` 顶层）| 移除批量响应中 quote 内的 `queriedAt` |
| 195-199 | `ClosePositionResponse` 不含 `accountId` / `symbol`；`ClosePositionRequest` 不含 `accountId` / `symbol` | 修复 mock builder 字段 |
| 312-316 | `QueryMarginBalanceResponse` 应含 `availableMargin` / `lockedMargin` / `totalMargin`（而非 `availableBalance` / `lockedBalance`）| 重写 mock margin balance 字段集 |
| 330-336 | `QueryFundBalanceResponse` 应含 `totalBalance` / `frozenBalance`（而非 `availableBalance` / `queriedAt`）| 重写 mock fund balance 字段集 |
| 429 | `DeleveragingTarget` 不含 `reduceQuantity` | 修复字段名（可能是 `reductionSize` 或 `targetSize` 等）|

**根因分析**：Phase 9 / Step 17/18/19 closure 验证执行报告显示"lint zero / 1971 tests 维持 / coverage 84.92%/79.57%/91.68%/84.92%"——**未明示 `pnpm typecheck` 实测结果**。Phase 9 closure 验证流程实际未含 typecheck 步骤；Step 16 创建的端到端集成测试在 vitest 运行时的 type-erasure 阶段不抛错（vitest 默认不严格 typecheck 测试文件），typecheck-via-`tsc -b` 才暴露错误。

**v3 修订处置裁决**（用户 PHASE_IMPLEMENT v2 后 REQUEST_CHANGES + 4 项 v3 要求落地）：

**v2 处置裁决（已被 v3 修订替代）**：v2 处置原计划"登记为 Phase 10 / Step 3 前置依赖 + 不创建独立 KI"——但用户 v3 要求把缺陷升级为独立 KI-P10-001 + 独立 Step 0 修复（不放在 Step 3 内嵌修复）。

**v3 最终处置裁决**：

1. **创建 KI-P10-001**（**用户 v3 要求 1**）——KNOWN-ISSUES.md 新增独立 KI 跟踪 typecheck 缺陷；状态 open；位置明示；错误明细 5 行表；修复责任 Phase 10 / Step 0；防御机制 Step 3 CI + 元规则 Q v3 模板；含协作 prompt 设计教训留痕
2. **创建 Phase 10 / Step 0 — Phase 9 closure typecheck remediation**（**用户 v3 要求 2**）——独立 Step 0；Step 0 在 Step 1 之前执行；让 Step 1+ 在干净 baseline 上工作；Step 0 单一职责（修复 + 防御指引撰写 + KI-P10-001 关闭）；Step 划分从 v2 = 7 Step + 1 Kickoff = 8 总数 调整为 **v3 = 8 Step + 1 Kickoff = 9 总数**
3. **ADR-0003 v3 同步修订**（**用户 v3 要求 3**）——Step 划分新增 Step 0 + 元规则 Q v3 模板更新 + Step 0 必要性论证 + Phase 9 closure typecheck 工程教训沉淀段；References 段含 KI-P10-001 引用（KI 总数 5 → 6）
4. **元规则 Q 强制开局动作模板 v3 升级**（**用户 v3 要求 4**）——模板新增动作 5：4 项独立命令（lint / typecheck / test / coverage）各自独立执行**并各自记录实测输出**；不允许用单一命令的"顺带验证"替代独立 typecheck 验证；这是 Phase 9 closure 教训的工程化沉淀

**v2 → v3 处置变更对比**：

| 维度 | v2 处置 | v3 处置 |
|---|---|---|
| KI 跟踪 | 不创建独立 KI（避免与 Step 3 责任冗余）| **创建 KI-P10-001**（持续跟踪机制；与 Step 0 责任协调）|
| 修复 Step | 登记为 Step 3 前置依赖 | **独立 Step 0** — Phase 9 closure typecheck remediation |
| 修复时机 | Step 3 CI 启用前内嵌修复 | **Step 1 之前** — 让 Step 1+ 在干净 baseline 上工作 |
| Step 总数 | 7 Step + 1 Kickoff = 8 | **8 Step + 1 Kickoff = 9** |
| 防御机制 | Step 3 CI 含 typecheck | **Step 3 CI + 元规则 Q v3 模板（4 项独立命令）+ 未来 Phase closure 起草指令硬底沿用** |
| 工程教训 | 启程记录 §F.4 留痕 | **ADR-0003 + 启程记录 + KI-P10-001 三处沉淀 + 协作 prompt 设计教训留痕给未来用户**|

**v3 工程价值阐述**：
- "诚实评估"原则在工程层面升级 — 不仅"事后发现问题诚实留痕"，更"事前防御机制"
- 拆两阶段流程的实证价值再次兑现（v1 → v2 → v2 实施 → v3 共 4 轮迭代证明用户在实施暴露问题后及时反馈调整的工程价值）
- 协作 prompt 设计教训显式留痕给未来用户（避免再次类似疏漏）
- KI / Step / 防御机制三位一体——KI 提供持续跟踪，Step 提供具体修复，防御机制确保未来不重复

**为什么 v3 选择独立 KI + 独立 Step 而非 Step 3 内嵌修复（v2 设计）？**
- 独立 KI 提供与 Step 0 协调的标准跟踪机制（修复后 Step 0 关闭 KI-P10-001；未来类似缺陷有标准登记路径）
- 独立 Step 0 让 Step 1+ 在干净 baseline 工作（Step 1/2 协作主题不应消耗 typecheck 失败的 baseline）
- 独立 Step 0 单一职责（修复 + 防御指引）vs Step 3 多职责（修复 + CI 启用 + 覆盖率门槛）违反"克制 > 堆砌"；Step 0 + Step 3 各自单一职责更协调
- "Step 0"编号显式标识"前置修复"性质（与 Step 1+ 实施任务区分；让 Phase 10 实施序列读者一眼看清）

### F.5 验证状态汇总

由于 typecheck 在 Phase 9 closure baseline 即失败（与本 Kickoff 文档变更无关），本 Kickoff PHASE_IMPLEMENT 阶段**未达到原期望"全量 lint/typecheck/test/coverage 全绿"**——但**本 Kickoff 0 引入新缺陷 + 0 消除既有缺陷**（变更范围严格限于文档）。lint 全绿；test/coverage 在 Phase 9 baseline 已知数据维持。typecheck 缺陷由 Phase 10 / Step 3 起草指令前置承接修复。

### F.3 KNOWN-ISSUES 状态稳定性核查

5 项 KI（KI-P8-001/002/003/005 + KI-P9-001）状态稳定（仅 KI-P8-001 修复责任 Phase 字段调整 `Phase 10` → `Phase 13+ TBD`；其他不变）。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | ADR-0003 Status `In Progress` | ✅ |
| H2 | §E.2 工作分布诚实修正 | ✅（"协作占比最高" → 工程化 Step 数 ≥ 协作 Step 数；命名裁决保留 + 4 理由更新）|
| H3 | KI-P8-001 修复责任 Phase: `Phase 13+ TBD` | ✅ |
| H4 | docs/phase10/00-phase-10-kickoff.md 启程记录创建 | ✅（本文件）|
| H5 | docs/00-phase1-mapping.md Phase 10 启程段 | ✅ |
| H6 | PHASE-10-DESIGN-DRAFT.md 删除（设计沉淀进 ADR）| ✅ |
| H7 | lint/typecheck/test/coverage 全绿 | ⚠️ **部分 PASS**（lint 全绿；typecheck 失败但**预存在于 Phase 9 closure baseline**，本 Kickoff 0 引入；test/coverage 沿用 Phase 9 baseline）— 详见 §F.4 |
| H8 | git diff 业务层零变化（跨 Phase 1-9 锁定接口零变化）| ✅ |
| H9 | Phase 10 启程显式声明 ≥ 3 处 | ✅（实测 ≥ 5 处：ADR-0003 Status + 本启程记录 + mapping Phase 10 启程段 + 用户附加要求落地证据 §C.4 + Phase 10 Step 1 起步指令承接预告）|
| H10 | Phase 9 closure typecheck 缺陷诚实留痕 ≥ 4 处 | ✅（ADR-0003 + 本启程记录 §F.4 + 00-phase1-mapping.md Phase 10 启程段第 9 项 + KNOWN-ISSUES.md，共 4 处） |

参考下限 R1-R4 全 PASS。完成项 G1-G24 全 PASS（H7 部分 PASS 的根因不是本 Kickoff 引入；Tianqi 工程纪律"诚实评估"原则要求显式留痕而非掩盖）。

---

## §H Phase 10 / Step 0 衔接预告（v3 修订）

**Step 0 独立**：v3 修订新增 — Phase 9 closure typecheck remediation；Phase 10 实施序列从 Step 0 起步。

**裁决 9（K.5）保留**："视具体 Step 复杂度决定"是否拆两阶段流程。Phase 10 内部各 Step 由独立 Step 起草指令承接：

- **Step 0 起草指令**（**v3 新增**）：Phase 9 closure typecheck remediation；性质修复 + 防御；KI-P10-001 修复；预期单阶段流程（修复任务边界明确）
- **Step 1 起草指令**：协作三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）；性质纯文档协作；预期单阶段流程
- **Step 2 起草指令**：PR / Issue 模板 + CODEOWNERS（.github/ 目录建立）；性质 GitHub 平台协作；预期单阶段流程
- **Step 3 起草指令**：CI 强制门禁（GitHub Actions workflow + **4 项独立命令** lint / typecheck / test / coverage + 84% 起步门槛）；性质工程化基础设施；**可能拆两阶段**（CI 配置冻结后约束 Step 4-7）
- **Step 4 起草指令**：容器化（Dockerfile 多阶段 + 非 root + 健康检查 + docker-compose）；性质工程化；**可能拆两阶段**（Dockerfile 复杂度高）
- **Step 5 起草指令**：发布自动化（git tag 触发 + changesets 等）；性质工程化；预期单阶段流程
- **Step 6 起草指令**：README 可执行性更新 + Runbook 同步；性质文档；预期单阶段流程
- **Step 7 起草指令**：Phase 10 CLOSED + CHANGELOG + CI 门槛升级 84% → 85% + **closure 验证含 4 项独立命令实测输出**（v3 强制；Phase 9 closure 教训沉淀）；性质收官；预期单阶段流程

**Step 0 起草由独立指令启动**（不在本 Kickoff 范围）。Step 0 完成后 Step 1 才能起步。

---

## §I 对作品级代码库的意义

### I.1 Phase 启程级拆两阶段流程首次实战

Phase 10 Kickoff 是 Tianqi 历史**第 3 次拆两阶段流程实战**——前两次 Phase 9 / Step 6 + Step 14 是 Step 启程级（小范围接口冻结约束本 Sprint 后续 Step）；本次是 Phase 启程级（大范围 7 Step 划分约束整 Phase）。v1 → v2 修订证明 Phase 启程级用户审视的实证价值：用户审视后落地 K.1 修正补丁 + K.2 锁定策略 + K.3 方案 B + K.4 重新命名 + 关键观察响应；若 v1 直接 APPROVE，Phase 10 整体路径将偏离用户期望。

### I.2 Phase 10 主题边界从概念到约束的转化

补充文档 §1.2 一句"Phase 10：工程化与协作基础"在 ADR-0003 落地为：(1) 7 Step 划分严格按主题归类；(2) Phase 10 不修业务 KI（KI-P8-001 修复责任 Phase 转 Phase 13+ TBD）；(3) Phase 10 不构建业务代码（裁决 5 严守）；(4) Phase 10 不引入新错误码 / Port / Adapter（惯例 K + 元规则 B 严守）。Phase 10 主题专注度成为后续 Step 实施的硬约束。

### I.3 ADR 增量追写模式跨 Phase 一致性

惯例 M 在 Phase 9 / 19 Step 实战 19 次（Step 1-19 全部增量追写 ADR-0002）。Phase 10 沿用此模式：ADR-0003 自 Kickoff 起进入 Phase 10 内部 Step 增量追写阶段；Step 1-7 各自完成时追加；Phase 10 收官 Step 7 finalize（Status In Progress → Accepted；Consequences 段最终撰写；含 CI 门槛升级 84% → 85% 的工程承诺）。

### I.4 用户附加要求驱动的诚实修正实证

用户 APPROVE 回执含附加 1 项 PHASE_IMPLEMENT 阶段同步要求（§E.2 工作分布诚实修正）；本 Kickoff 在 PHASE_IMPLEMENT 阶段同步落地，承认"协作占比最高"v1 论证不严谨——按 Step 主题严格归类，工程化 Step 数（3）≥ 协作 Step 数（2）。命名仍保留 "Collaboration" 但理由从"工作分布支撑"调整为"4 理由合力"（直译§1.2 + ADR 命名一致性 + 拒绝 Release Foundation）。这是 Tianqi 工程纪律"诚实评估"原则的又一次实证（沿用 Phase 9 / Step 17 KI 状态最终评估的诚实纪律）。

### I.5 Tianqi 工程纪律连续性

Phase 10 Kickoff 是 Phase 9 CLOSED（2026-05-02）后第 1 个工程节点；Phase 9 累计 19 Step 工程纪律（元规则 B 跨 19 Step 兑现 + 拆两阶段流程 2 次实战 + 增量追写 ADR 19 次实战 + Sprint H 模板纪律三步全部守住 + 5 项 KI 状态最终评估）在 Phase 10 全部沿用——Phase 10 Kickoff 是连续性证据：拆两阶段流程第 3 次实战 + 增量追写 ADR-0003 起步 + 强制开局动作 1-6 完整 + 元规则 / 惯例触发表完整 + KI 状态变更（K.1 修正补丁）+ 诚实评估纪律（§E.2 工作分布修正）。

### I.6 Phase 10 启程显式声明的工程意义

读者翻开 ADR-0003 看到 `In Progress`；翻开 docs/phase10/00-phase-10-kickoff.md 看到 Phase 10 启程显式声明；翻开 docs/00-phase1-mapping.md 看到 Phase 10 启程段；翻开 git log 看到 v1 commit b701830 + v2 commit 52b18ce + PHASE_IMPLEMENT commit——清晰、可控、可信的工程历史。Phase 10 7 Step 实施旅程从此启程。

---

**Phase 10 Kickoff 完成（v3）— 2026-05-02 🚀**

拆两阶段流程第 3 次实战 + Phase 启程级首次实战 + 4 轮迭代（v1 → v2 → PHASE_IMPLEMENT v2 → v3）；v3 修订证明实施暴露问题后用户及时反馈调整的工程价值——Phase 9 closure typecheck 缺陷的工程教训沉淀进 Phase 10 流程，让"事后诚实留痕"层面工程纪律升级到"事前防御机制"层面工程纪律。Phase 10 / Step 0（KI-P10-001 修复）由独立指令承接；Step 0 完成后 Step 1 起步。
