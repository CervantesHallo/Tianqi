# ADR-0003: Phase 10 工程化与协作基础

## Status

In Progress (Phase 10 kickoff started 2026-05-02; PHASE_DESIGN v1 → v2 → user APPROVE → PHASE_IMPLEMENT v2 → user REQUEST_CHANGES + 4 项 v3 修订要求 → PHASE_IMPLEMENT v3 完成；ADR-0003 进入 Phase 10 内部 Step 0-7 增量追写阶段)

> **本 ADR 是增量追写**（惯例 M 沿用 Phase 9 模式）。Phase 10 启程指令拆两阶段流程：
>
> - **第一阶段（PHASE_DESIGN）v1**：创建 ADR-0003 三段（Status DRAFT / Context / Decision 占位）+ PHASE-10-DESIGN-DRAFT.md 完整草案
> - **第一阶段 v2**：用户 REQUEST_CHANGES + 反馈后修订（K.1 KI 字段 + K.2 升级路径 + K.3 方案 B + K.4 Kickoff 独立 + ADR 命名保留）
> - **第二阶段（PHASE_IMPLEMENT v2，v2 APPROVE 后）**：Status DRAFT v2 → In Progress；§E.2 工作分布诚实修正；删除 PHASE-10-DESIGN-DRAFT.md；同步 KNOWN-ISSUES.md KI-P8-001 字段；创建 00-phase-10-kickoff.md；同步 00-phase1-mapping.md Phase 10 启程段；**实测发现 Phase 9 closure 隐藏 typecheck 缺陷**
> - **第二阶段 v3 修订（PHASE_IMPLEMENT v2 后用户 REQUEST_CHANGES + 4 项 v3 要求）**（**本 commit**）：(1) 创建 KI-P10-001 跟踪 typecheck 缺陷；(2) **新增 Phase 10 / Step 0 — Phase 9 closure typecheck remediation**（独立 Step；在 Step 1 之前执行；总数从 7 Step + 1 Kickoff = 8 项 调整为 **8 Step + 1 Kickoff = 9 项**）；(3) ADR-0003 v3 同步含 Step 0 + 防御机制 + 元规则 Q 模板更新；(4) 元规则 Q 强制开局动作模板 v3 明示**全量验证含 4 项独立命令**（lint / typecheck / test / coverage 各自独立执行）
> - **Phase 10 内部各 Step 完成时**：Decision 段下追加该 Step 的关键裁决摘要
> - **Phase 10 收官（Step 7）**：Status In Progress → Accepted；Consequences 段最终撰写；CI 门槛 84% → 85% 升级
>
> 这是 Phase 10 沿用 Phase 9 增量追写模式的连续性证据（惯例 M 跨 Phase 一致性）。拆两阶段流程**第 3 次实战 + Phase 启程级首次实战**——v1 → v2 → PHASE_IMPLEMENT v2 → v3 修订共 4 轮迭代证明 Phase 启程级用户审视的实证价值（v3 修订特别证明用户在实施暴露问题后及时反馈调整的工程价值——Phase 9 closure typecheck 缺陷的工程教训沉淀进 Phase 10 流程，让"事后诚实留痕"层面工程纪律升级到"事前防御机制"层面工程纪律）。

## Context

Phase 9 已 CLOSED（2026-05-02，git tag `phase-9-closed`），ADR-0002 进入 Accepted 状态。Phase 1-7 + Phase 8 + Phase 9 累计的工程能力清晰：

- **Phase 1-7**：架构骨架完整（domain / application / policy / ports）；架构上无懈可击但只能在内存里跑
- **Phase 8**：基础设施 Adapter 落地（13 Adapter 包 + 5 业务 Engine Port）；架构不变 + 基础设施落地
- **Phase 9**：Saga 编排能力 + 4 业务 Saga + 跨 Saga 协调（7 saga 模块 + 4 持久化 Adapter）；编排能力 + 业务实例化

### Phase 10 的核心矛盾

Phase 1-9 累计 38 个 Step（Phase 8 19 + Phase 9 19），Tianqi 已是"代码完整 + 业务能力齐全"的项目。但实地核查（强制开局动作 4-6）发现仓库**协作 / 工程化基础设施严重缺失**：

| 维度 | 现状 | 期望（补充文档 §7） |
|---|---|---|
| 协作资产 | 1/7（仅 CHANGELOG） | 7/7（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / CHANGELOG / Issue 模板 / PR 模板 / CODEOWNERS） |
| CI 配置 | 0（无 .github/workflows/） | lint / typecheck / test / coverage 强制门禁 |
| 容器化 | 0（无 Dockerfile / docker-compose） | 多阶段构建 + 非 root + 健康检查 + 开发编排配置 |
| README 可执行性 | 滞后（停留 Phase 1-7 / 1106 tests）| CI 验证 README 可执行示例（§12.3）|
| Runbook | 0 | 同步运维行为变化（§12.4）|
| 发布自动化 | 0（无 git tag 触发流水线）| git tag 触发 + changesets 等单一事实来源 |
| 覆盖率门槛 | 当前 84.92%（CI 未强制）| 85%（CI 强制门禁，§9.3）|

**Phase 10 的目标**：把 Tianqi 从"代码完整 + 业务能力齐全"升级为"生产可发布、可协作、可观察"的工程基础设施完备状态。

### Phase 10 与 Phase 8/9 的性质差异

| 维度 | Phase 8 | Phase 9 | Phase 10 |
|---|---|---|---|
| 主题 | 基础设施 Adapter 落地 | Saga 编排架构 + 业务 Saga | **工程化与协作基础**（CI/CD + 协作资产 + 容器化 + 文档可执行）|
| 核心矛盾 | 架构不变 + 基础设施落地 | Saga 编排 + 业务实例化 | **代码完整 → 生产可发布** |
| 业务代码 | 大量新增（13 Adapter + 5 Engine Port）| 大量新增（7 saga + 4 持久化 Adapter）| **零新增**（不构建业务代码）|
| Step 数 | 19 | 19 | **8**（业务复杂度低）|
| 测试增量 | +562 | +303 | **接近 0**（工程化不需要业务测试）|
| 错误码增量 | +26 | +10 | **0** |
| 包数增量 | +13 | +4 | **0** |

**Phase 10 的克制原则**：不构建业务代码 / 不补业务测试 / 不修业务 KI / 不引入新错误码 / 不引入新 Port / 不引入新 Adapter。Phase 10 主题专注度是补充文档 §13.3 "Phase Gate 回溯义务"的精神延续。

### Phase 1-9 既有协作资产基线（强制开局动作 4 实地核查）

| 资产 | 现状 | Phase 10 责任 Step |
|---|---|---|
| README.md | ✅ 存在但严重过时（仍显示 Phase 1-7 CLOSED + 1106 tests）| Step 6 |
| CHANGELOG.md | ✅ 存在（Phase 9 / Step 19 创建；含 Phase 8 + Phase 9 段）| Step 7（增量 Phase 10 段）|
| CONTRIBUTING.md | ❌ 不存在 | Step 1 |
| CODE_OF_CONDUCT.md | ❌ 不存在 | Step 1 |
| SECURITY.md | ❌ 不存在 | Step 1 |
| Issue 模板 | ❌ 不存在（无 .github/）| Step 2 |
| PR 模板 | ❌ 不存在（无 .github/）| Step 2 |
| CODEOWNERS | ❌ 不存在 | Step 2 |
| .github/workflows/ CI | ❌ 不存在 | Step 3 |
| Dockerfile | ❌ 不存在 | Step 4 |
| docker-compose.yml | ❌ 不存在 | Step 4 |
| 发布自动化（changesets 等）| ❌ 不存在 | Step 5 |
| Runbook | ❌ 不存在 | Step 6 |

### Phase 1-9 既有 KI 状态（强制开局动作 2 实地核查）

5 项 open KI（Phase 9 / Step 17 已最终评估）：

| KI | Phase 10 责任判断 |
|---|---|
| KI-P8-001 domain 75.16% | **不是 Phase 10 责任**（Phase 10 主题工程化非业务覆盖率改善；归独立 Phase 责任）|
| KI-P8-002 真实基础设施 | **不是 Phase 10 责任**（Phase 11 责任）|
| KI-P8-003 时序 flake | **不是 Phase 10 责任**（Phase 11 责任）|
| KI-P8-005 ports 11.96% | **不是 Phase 10 责任**（结构性现象）|
| KI-P9-001 数据副本漂移 | **持续监控**（不修复，仅 Phase 10 起 Step 内 PR 描述明示）|

**Phase 10 不修任何 KI**——这与裁决 1 α 主题专注一致。

## Decision

> **本段在 Phase 10 启程 PHASE_DESIGN 阶段创建 Status DRAFT 占位。**
>
> Phase 10 内部各 Step 完成时，本段下增量追写该 Step 的关键裁决摘要（惯例 M 沿用 Phase 9 模式）。
>
> Phase 10 完整 Step 划分（裁决 2）+ 9 个核心裁决摘要（裁决 1-9）详见 `docs/phase10/PHASE-10-DESIGN-DRAFT.md`（PHASE_DESIGN 阶段草案；PHASE_IMPLEMENT 阶段完成后删除，设计沉淀进本 ADR）。

### Phase 10 完整 Step 划分（v3 修订；新增 Step 0；8 Step + 1 Kickoff = 9 总数）

| 编号 | 主题 | 性质 |
|---|---|---|
| **Phase 10 Kickoff** | **本启程指令**（PHASE_DESIGN v1+v2 + PHASE_IMPLEMENT v2+v3；ADR-0003 + 启程标记；不算 Step）| **启程战** |
| **Step 0** | **Phase 9 closure typecheck remediation**（修复 saga-end-to-end.integration.test.ts 10+ 处 mock builder 字段不匹配；KI-P10-001 修复责任；撰写"Phase closure typecheck 防御"指引；让 Step 1+ 在干净 baseline 上工作；**v3 新增**）| **修复 + 防御** |
| Step 1 | 协作资产基础三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）| 协作 |
| Step 2 | PR 模板 + Issue 模板 + CODEOWNERS（.github/ 目录建立）| 协作 |
| Step 3 | CI 强制门禁（GitHub Actions workflow + **4 项独立命令** lint / typecheck / test / coverage + **84% 起步门槛**）| 工程化 |
| Step 4 | 容器化（Dockerfile 多阶段 + 非 root + 健康检查 + docker-compose 开发编排）| 工程化 |
| Step 5 | 发布自动化（git tag 触发流水线 + changesets 或等价工具）| 工程化 |
| Step 6 | README 可执行性更新 + Runbook 同步 | 文档 |
| Step 7 | Phase 10 CLOSED + CHANGELOG 更新 + **CI 门槛升级 84% → 85%** | 收官 |

**Step 0 单一职责**：(1) 修复 `packages/application/src/saga/saga-end-to-end.integration.test.ts` 10+ 处 mock builder 字段（KI-P10-001 修复）；(2) 实测验证 4 项独立命令全绿（lint / typecheck / test / coverage）；(3) 撰写"Phase closure typecheck 防御"指引文档（譬如 `docs/phase10/00-typecheck-defense-guidelines.md` 或附在执行记录内）；(4) KI-P10-001 状态升级 open → resolved；(5) 不引入新业务代码 / 新错误码 / 新 Port / 新 Adapter（与 Phase 10 其他 Step 同精神）。

**Step 0 必要性论证**：
- **不放在 Step 3 修复**——Step 3 主题"CI 强制门禁"应假设 baseline 是干净的；混合"修复历史缺陷 + 启用 CI"违反 Step 单一职责
- **不放在 Step 1/2 后修复**——Step 1/2 协作资产工作不应消耗 typecheck 失败的 baseline；让 Step 1/2 在干净 baseline 上工作（专注协作主题）
- **Step 0 编号必要**——传达"Phase 10 实施前的修复任务"语义；编号 0 显式标识"前置修复"性质（与 Step 1+ 实施任务区分）

### Phase 10 强制开局动作模板（裁决 4 B + v3 元规则 Q 模板更新；自 Step 0 起每 Step 必做）

**v3 修订**：模板新增"动作 5 全量验证 4 项独立命令"硬底（Phase 9 closure typecheck 教训的工程化沉淀）。

| # | 动作 | 性质 |
|---|---|---|
| 1 | 重读宪法 + 补充文档（关键章节按 Step 主题） | 通用 |
| 2 | 核查 KNOWN-ISSUES 6 项 KI 状态（Phase 8/9 5 项 + KI-P10-001；以及 Step 0 完成后 KI-P10-001 resolved 状态确认） | 通用 |
| 3 | 核查 ADR-0001 + ADR-0002 + ADR-0003（含 Phase 10 内部 Step 增量追写）| 通用 |
| 4 | 工程化主题专属核查（视 Step 主题）| Phase 10 专属 |
| 5 | **全量验证含 4 项独立命令**：`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:coverage` 各自独立执行**并各自记录实测输出**；不允许用单一命令（譬如 `pnpm test:coverage`）的"顺带验证"替代独立 typecheck 验证（**v3 新增 — Phase 9 closure 教训工程化沉淀**）| **Phase 10 v3 强制** |

**Step 编号映射（v3 修订）**：

| Step | 工程化主题专属核查（动作 4） |
|---|---|
| **Step 0** | **既有 saga-end-to-end.integration.test.ts 错误明细 + Engine Port 响应类型实测**（KI-P10-001 详情）+ vitest type-erasure 边界研究 + Phase 9 closure 验证流程历史（v3 新增）|
| Step 1 | 既有项目 CONTRIBUTING / CODE_OF_CONDUCT / SECURITY 文档惯例（主流参照：Contributor Covenant 等）|
| Step 2 | 既有 .github/ 目录 + GitHub 平台 PR/Issue 模板格式 + Tianqi 包 owner 划分 |
| Step 3 | 既有 .github/workflows/ + pnpm 命令本地一致性（**4 项独立命令**）+ 当前覆盖率实测 + KI-P10-001 已 resolved 状态确认 |
| Step 4 | 既有 Dockerfile / docker-compose / 容器化工具链 |
| Step 5 | 既有 git tag + changesets / 替代工具 |
| Step 6 | README 当前内容 + Runbook 既有结构 |
| Step 7 | ADR-0003 状态 + CHANGELOG / git tag 既有约定 + Step 0/3-6 累计覆盖率改善实测 + **Phase 10 收官验证含 4 项独立命令实测输出**（v3 强制）|

**动作 5 v3 设计理由**（Phase 9 closure 教训工程化沉淀）：
- **教训**：Phase 9 / Step 17/18/19 closure 报告显示 "lint zero / 1971 tests 维持 / coverage 84.92%/79.57%/91.68%/84.92%"——未明示 typecheck 实测；vitest 默认不严格 typecheck 测试文件，让 Step 16 引入的 saga-end-to-end.integration.test.ts mock builder 字段不匹配缺陷绕过 closure 验证
- **工程化沉淀**：Phase 10 元规则 Q 模板要求每 Step 强制开局动作含 4 项独立验证命令；**closure 验证含 4 项命令各自实测输出**（不是声称"全绿"）
- **协作 prompt 设计教训**：未来 Phase 起草指令时硬底必须明示"全量验证含 4 项独立命令实测输出"——Phase 10 / Step 7 收官 Step 起草指令将沿用此硬底为 Phase 10 closure 模板

### 元规则 / 惯例触发（Phase 10 启程；v3 修订）

| 规则 / 惯例 | 触发 |
|---|---|
| 元规则 B | 严守 — 不修改 Step 1-19（Phase 9）任何已锁定签名；Step 0 修复 saga-end-to-end.integration.test.ts mock builder 字段**不属于已锁定签名**（mock builder 是测试 fixture 而非接口契约；修复让 mock 对齐既有 Engine Port 锁定签名而非修改签名本身——这是 Step 0 在元规则 B 边界内的合法工作）|
| 元规则 P | 严守 — Phase 10 不主动引入第三方依赖（CI / 容器化工具是基础设施而非业务依赖；具体由各 Step 独立判断）|
| 元规则 Q | **Phase 10 v3 强制开局动作模板升级 — 5 项动作含动作 5 全量验证 4 项独立命令**（lint / typecheck / test / coverage 各自独立执行）；这是 Phase 9 closure 教训的工程化沉淀；不允许用单一命令的"顺带验证"替代 |
| 惯例 K | 严守 — Phase 10 0 新错误码 |
| 惯例 M | 沿用 Phase 9 模式 — ADR-0003 增量追写（含 Step 0-7 各自完成时追写）|
| §4.8 编译期硬约束 | 严守 — 本 Phase 不触碰 domain |
| 拆两阶段流程 | **第 3 次实战 + Phase 启程级首次实战 + 4 轮迭代**（v1 → v2 → PHASE_IMPLEMENT v2 → v3；Phase 内部 Step 视复杂度决定）|

### v2 修订要点（用户 REQUEST_CHANGES + 反馈后落地）

**K.1 修正补丁**（PHASE_IMPLEMENT 阶段执行）：
KI-P8-001 修复责任 Phase 字段：`Phase 10` → **`Phase 13+ TBD`**。
理由：Phase 10 工程化 / Phase 11 真实基础设施 / Phase 12 发布就绪都是非业务覆盖率改善 Phase；KI-P8-001 是业务 domain 覆盖率，应留待 Phase 13+ 业务能力延伸 Phase 修复。

**K.2 锁定策略**：CI 覆盖率门槛升级路径
- **Step 3 起步**：CI 门槛 = **84%**（当前实测 84.92%；84% 起步给 Step 3-6 实施过程缓冲空间，不让 CI 一启用就阻塞主分支推进）
- **Step 7 收官升级**：CI 门槛 84% → **85%**（补充文档 §9.3 Phase 10 CLOSED 后 85% 强制门禁）
- **升级路径三选**：
  - **A 推荐**：Step 3-6 实施过程顺手改善覆盖率（若有自然增量譬如新工程化测试 / Dockerfile lint 测试 / CI workflow 验证测试）
  - **B 推荐**：Step 7 收官前实测覆盖率，若 ≥85% 直接升级；若略低（≤0.5pp 差距）由 Step 7 内部小幅补充工程化测试改善
  - **C fallback**：若 Step 7 收官时仍 < 85%（罕见情况），登记新 KI（譬如 KI-P10-001 "覆盖率门槛升级延后"）+ 保持 84% 门槛 + Phase 11 责任改善 + ADR-0003 修订流程明示降级理由

**K.3 方案 B 落地**：不合并 Step 1 / Step 2（vs v1 的合并候选）；保持协作三件套与 PR/Issue/CODEOWNERS 主题独立。

**K.4 Kickoff 独立**：本启程指令命名为 "Phase 10 Kickoff"（不算 Step；与 Phase 8/9 启程模式协调——Phase 8/9 无独立 Kickoff，但 Phase 10 拆两阶段流程让 Kickoff 必然独立）。

**K.5 同意保留**：拆两阶段流程"视具体 Step 复杂度决定"。

**关键观察 — ADR 命名裁决（保留 "Engineering and Collaboration Foundation"）**：

裁决保留原命名而非改 "Engineering and Release Foundation"。理由：

1. **严格按补充文档 §1.2 直译**（**首要理由**）："Phase 10：工程化与协作基础"——"协作" = "Collaboration"
2. **工作分布（PHASE_IMPLEMENT 阶段诚实修正）**：8 总数（7 Step + 1 Kickoff）按 Step 主题分布——
   - **纯协作占 2 Step**：Step 1（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）+ Step 2（PR/Issue 模板 + CODEOWNERS）
   - **工程化占 3 Step**：Step 3（CI 强制门禁）+ Step 4（容器化）+ Step 5（发布自动化）
   - **文档占 1 Step**：Step 6（README 可执行性 + Runbook；含面向社区的协作维度但本质是文档）
   - **收官占 1 Step**：Step 7
   - **启程战占 1**：Phase 10 Kickoff（本启程指令；不算 Step）

   **诚实表述：工程化 Step 数（3）≥ 协作 Step 数（2）**。v1 草案"协作占比最高"基于把 Step 6 计入协作维度的论证不严谨；用户 PHASE_IMPLEMENT 阶段附加要求引导本次诚实修正——按 Step 主题严格归类，工程化 Step 数主导。命名仍保留 "Collaboration" 是因下列理由 1（直译§1.2 / 首要理由）+ 理由 3（ADR 命名一致性）+ 理由 4（拒绝 "Release Foundation"）的合力，而非因协作 Step 数最多。
3. **ADR 命名一致性**：ADR-0001 = "Adapter Layer Foundation"（Phase 8 = "基础设施适配器层"）；ADR-0002 = "Saga Orchestration Architecture"（Phase 9 = "分布式补偿完整实现"，标题取 Saga 编排核心）；ADR-0003 沿用补充文档 §1.2 直译模式
4. **拒绝 "Release Foundation"**：Release（发布自动化）只是 Phase 10 一个 Step（Step 5）；用作 ADR 标题让发布权重过高 / 协作维度被遮蔽——尽管诚实修正后承认工程化 Step 数 ≥ 协作 Step 数，但"Release"作为单个 Step 主题不应升级为整 Phase 命名锚点

### v3 修订要点（PHASE_IMPLEMENT v2 后用户 REQUEST_CHANGES + 4 项要求落地）

用户 PHASE_IMPLEMENT v2 完成后回执：实测发现 Phase 9 closure 隐藏 typecheck 缺陷；要求 4 项 v3 修订让 Phase 10 流程在"事前防御机制"层面强化。

**v3 要求 1：创建 KI-P10-001（持续跟踪机制）**

KNOWN-ISSUES.md 新增 KI-P10-001 — Phase 9 closure 隐藏的 typecheck 缺陷：
- 状态 open；发现于 Phase 10 Kickoff PHASE_IMPLEMENT 实测；位置 `packages/application/src/saga/saga-end-to-end.integration.test.ts`（10+ 处 mock builder 字段不匹配）
- 影响：vitest 通过 / tsc -b 失败；根因：Phase 9 closure 验证流程未含独立 typecheck
- 修复责任 Phase 10 / Step 0；防御机制由 Step 3 CI + 元规则 Q v3 模板承接
- 协作教训留痕：Phase 9 / Step 17/18/19 起草指令硬底未明确"独立 typecheck"

**v3 要求 2：创建 Phase 10 / Step 0 — Phase 9 closure typecheck remediation**

不放在 Step 3 修复 — 独立 Step 0；Step 0 在 Step 1 之前执行；让 Step 1+ 在干净 baseline 上工作；Step 0 单一职责（修复 + 防御指引撰写）。

**Step 划分调整**：
- v2：7 Step + 1 Kickoff = 8 总数
- **v3：8 Step + 1 Kickoff = 9 总数**（含 Step 0）

**v3 要求 3：ADR-0003 同步修订（含 Step 0 + 防御机制 + 元规则 Q 模板）**

本段 v3 修订要点 + Step 划分含 Step 0 + 元规则 Q v3 模板更新 + Step 0 必要性论证全部落地。

**v3 要求 4：元规则 Q 强制开局动作模板更新（明示独立验证 4 项命令）**

元规则 Q v3 模板新增动作 5：`pnpm lint` / `pnpm typecheck` / `pnpm test` / `pnpm test:coverage` 4 项独立命令各自独立执行**并各自记录实测输出**；不允许用单一命令的"顺带验证"替代独立 typecheck 验证。**这是 Phase 9 closure 教训的工程化沉淀**——让 Tianqi 工程纪律不仅在"事后诚实留痕"层面有效，更在"事前防御机制"层面强化。

### Phase 9 closure typecheck 工程教训沉淀

**教训本质**：Phase 9 / Step 17/18/19 closure 验证执行报告含"lint zero / 1971 tests 维持 / coverage 84.92%/79.57%/91.68%/84.92%"——但**未明示 typecheck 实测**。vitest 默认不严格 typecheck 测试文件（type-erasure 阶段忽略类型不匹配），让 Step 16 引入的 saga-end-to-end.integration.test.ts 中 10+ 处 mock builder 字段不匹配绕过 closure 验证。

**协作 prompt 设计教训**：起草指令硬底未明确"独立 typecheck 验证"；AI 跑 `pnpm test:coverage` 顺带验证类型，让 vitest 宽松类型检查掩盖了缺陷。

**工程教训沉淀路径**：
1. **KI-P10-001**：持续跟踪机制（修复后 Step 0 关闭）
2. **Step 0 独立修复**：让 Phase 10 后续 Step 在干净 baseline 上工作
3. **Step 3 CI 强制门禁**：含独立 typecheck 步骤；让未来再次发生"vitest 通过但 typecheck 失败"自动被 CI 拦截
4. **元规则 Q v3 模板**：每 Step 强制开局动作含 4 项独立验证命令；不允许"顺带验证"
5. **未来 Phase 起草指令硬底沿用**：Phase 10 / Step 7 收官 Step 起草指令含"closure 验证 4 项命令各自实测输出"硬底；Phase 11+ 起草指令模板沿用

**工程价值**：
- "诚实评估"原则在工程层面升级 — 不仅"事后发现问题诚实留痕"，更"事前防御机制"
- 拆两阶段流程的实证价值再次兑现（v1 → v2 → v2 实施 → v3 共 4 轮迭代）
- 协作 prompt 设计教训显式留痕给未来用户（避免再次类似疏漏）

### Phase 10 起工作流模式过渡

Phase 1-9 全程在 main 分支直接工作（fast-flow，单人模式）。Phase 10 Kickoff 起过渡为 feature 分支工作 + PR 合并模式（标准协作）。

**过渡理由**：

1. Phase 10 主题"工程化与协作基础"要求工作流自身体现协作纪律——主题与工作流协调一致
2. Step 2 PR 模板建立后，Phase 10 Kickoff PR 自身是模板的最佳示范案例
3. 为 Tianqi 未来多人协作场景预留工作流基础
4. AI 不直接合并 main 分支符合"AI 提交工作 / 用户审视合并"的协作纪律

**过渡边界**：

- 不修改 Phase 1-9 任何 commits 历史
- 不撤回 phase-9-closed tag
- 仅作为 Phase 10 起的 forward-looking 工作纪律
- ADR-0003 本身的工作流元文档修订（譬如本段）允许直接在 main 追加，避免自指循环

**Phase 10 Kickoff PR 实证**：

| 维度 | 数据 |
|---|---|
| PR 编号 | #1（Tianqi 第一个 PR）|
| PR URL | https://github.com/CervantesHallo/Tianqi/pull/1 |
| feature 分支 | claude/stupefied-lewin-15fd78 |
| Commits 数 | 6（保留 4 轮迭代历史完整可见）|
| 合并方式 | merge commit |
| Merge commit SHA | aea059a |
| 提交日期 | 2026-05-02 |
| 含内容 | ADR-0003 创建 + KI-P10-001 + Step 0 + 元规则 Q v3 模板 + KI-P8-001 修复责任 Phase 修正 |

**对未来 Phase 工作流的承诺**：

- Phase 10 / Step 0 起每个 Step 都在独立 feature 分支工作 + PR 合并 + 用户审视
- Step 2 建立 PR 模板后，所有 Step PR 必须遵守该模板
- main 分支仅接受 merge commit（不接受 squash / rebase；保留迭代历史是 Tianqi 工程纪律的组成部分）
- 紧急 hotfix（极少数情况）仍允许直接 push main，但必须在 ADR 修订流程内显式声明

### Step 0: Phase 9 closure typecheck remediation + 防御指引

**裁决摘要**：

- **裁决 1（修复方向）**：α 测试 fixture 对齐 Engine Port 类型（Engine Port 已锁定，元规则 B 严守）
- **裁决 2（修复范围）**：C 全仓 typecheck 验证完整性 — 实测确认 baseline 全部 10 errors 仅在 saga-end-to-end.integration.test.ts；无隐藏类似缺陷
- **裁决 3（不增 it）**：既有 8 it 已使用 fixture；修复后既有 it PASS 即是修复正确性证明；新增 it 引入冗余违反"克制"
- **裁决 4（防御指引归属）**：β 独立 `docs/closure-checklist.md`（forward-looking 可独立引用；ADR 不越界承担 checklist 功能）
- **裁决 5（KI-P10-001 关闭时机）**：B 4 项独立命令全 PASS 后关闭（修复完成的真实证据）
- **裁决 6（0 新增）**：0 新错误码 / 0 新 Port / 0 新 Adapter / 0 新 workspace 包（惯例 K 第 19 次实战）
- **裁决 7（本段）**：B 增加 ADR Step 0 段（沿用 Phase 9 惯例 M 增量追写模式；惯例 M 第 20 次实战 + 跨 Phase 第 1 次）

**修复细节**：5 处 mock fixture 字段对齐（line 144 `MarkPriceQuote.queriedAt` 移除 / line 197-200 `ClosePositionResponse` 移除 `accountId`+`symbol` 加 `closedSize` / line 314-318 `QueryMarginBalanceResponse` 字段重命名 + 加 `totalMargin` / line 332-336 `QueryFundBalanceResponse` 加 `totalBalance`+`frozenBalance` / line 428-432 `DeleveragingTarget` 字段重命名 + 移除 `settlementCurrency` 加 `expectedDeleveragingPrice`）。

**Step 0 工程意义**：Phase 9 closure 教训沉淀完成。`docs/closure-checklist.md`（63 行）自 Step 0 起永久生效；未来 Phase closure 起草指令必须引用此 checklist 含 4 项独立命令实测输出硬底。元规则 Q v3 模板首次完整实战兑现（动作 5 baseline + post-fix 双向验证）。KI-P10-001 自 open → closed（修复 commit + 4 项命令 PASS 双重证据）。Tianqi 工程纪律从"事后诚实留痕"层面正式升级到"事前防御机制"层面。

### Step 1: 协作资产基础三件套（CONTRIBUTING + CODE_OF_CONDUCT + SECURITY）

**裁决摘要**：

- **裁决 1（文件归属）**：α 仓库根目录（业界最广泛 + GitHub 自动识别）
- **裁决 2（内容深度）**：B 标准（每文件 ≤ 100 行；含 Tianqi 项目特定上下文）
- **裁决 3（CONTRIBUTING 内容）**：引用《宪法》§24 + 元规则 Q v3 + Phase 10 工作流过渡 + KI-P10-001 教训；**不复制**宪法内容
- **裁决 4（CODE_OF_CONDUCT 标准）**：α Contributor Covenant 2.1 — 但**采用链接版而非全文复制**（避免双重维护 + 让标准维护者作为单一权威源；与裁决 3 引用而非复制原则一致）
- **裁决 5（SECURITY 报告渠道）**：α GitHub Private Vulnerability Reporting + 7/14/30 天 best-effort 响应承诺（单维护者可履行）
- **裁决 6（PR 模板预告）**：α 不预告（Step 1 独立完整；Step 2 PR 模板上线后通过独立小修订追加 CONTRIBUTING 段，沿用 Kickoff ADR 工作流过渡段模式）
- **裁决 7（0 新增）**：0 新错误码 / 0 新 Port / 0 新 Adapter / 0 新 workspace 包（惯例 K 第 20 次实战）
- **裁决 8（本段）**：B 增加 ADR Step 1 段（沿用 Phase 9 惯例 M 增量追写；惯例 M 第 21 次 + 跨 Phase 第 2 次实战）

**实施细节**：CONTRIBUTING.md 既有 84 行（先前 session 残留；内容质量符合裁决 3 全部要求 — 项目使命 / 引用宪法 §24 七项 / 元规则 Q v3 4 项独立命令 / KI-P10-001 教训引用 / Conventional Commits / AI 协作纪律 / closure-checklist 引用 / docs 导航；克制 > 堆砌 — 保留既有不重写）。CODE_OF_CONDUCT.md 22 行（链接 + scope + reporting + attribution；不复制 Contributor Covenant 全文）。SECURITY.md 68 行 ≤ 80（supported versions / private vulnerability reporting / response timeline 7-14-30 天 best-effort / disclosure policy / out of scope / 高敏感面 5 项 — saga 编排 / 人工介入 / 审计 / 幂等键 / 持久化 adapter）。

**Step 1 工程意义**：Tianqi 协作生态从此可见 — 仓库根目录 3 文件让贡献者 / 社区 / 安全研究者各有入口。CONTRIBUTING 引用而非复制《宪法》是"双重维护避免"的工程纪律。CODE_OF_CONDUCT 链接而非复制是同精神延伸（让标准维护者作为单一权威源）。Step 2 PR 模板 + Issue 模板 + CODEOWNERS 在干净 baseline 上承接（Step 1 不预占 .github/ 目录工作）。

### Step 2: .github/ 协作生态（PR 模板 + Issue 模板 + CODEOWNERS）

**裁决摘要**：

- **裁决 1（PR 模板深度）**：B 标准 30-60 行（七项标题 + 简短引导 + 4 项独立命令 checkbox + Phase/Step Mapping + Checklist）
- **裁决 2（Issue 模板）**：标准 3 模板（bug-report / feature-request / documentation-issue）+ config.yml（blank_issues_enabled: false + 安全 / 讨论 / 行为准则 3 个 contact_links 重定向）
- **裁决 3（CODEOWNERS）**：A 全仓 fallback（`* @CervantesHallo`；含未来多维护者升级路径注释）
- **裁决 4（CONTRIBUTING 同步）**：α 本 Step 追加 PR 模板段（4 行；CONTRIBUTING 84 → 90 行）
- **裁决 5（dependabot）**：α 不创建（Phase 10 主题不含依赖管理；Phase 11+ 或 Phase 12 引入）
- **裁决 6（0 新增）**：0 新错误码 / 0 新 Port / 0 新 Adapter / 0 新 workspace 包（惯例 K 第 21 次实战）
- **裁决 7（本段）**：B 增加 ADR Step 2 段（沿用 Phase 9 惯例 M 增量追写；惯例 M 第 22 次 + 跨 Phase 第 3 次实战）
- **裁决 8（既有资产核查教训沉淀）**：β 追加到 `docs/closure-checklist.md`（Step 1 教训：先前 session 残留 `CONTRIBUTING.md` 未追踪；双重命令防御 `git status --untracked-files=all` + `git ls-files <path>`；checklist 总长 63 → 72 行 ≤ 100）

**实施细节**：.github/ 目录从无到有；6 个新文件（PULL_REQUEST_TEMPLATE.md 57 行 / ISSUE_TEMPLATE/bug-report.md 48 行 / feature-request.md 38 行 / documentation-issue.md 40 行 / config.yml 16 行 / CODEOWNERS 11 行）；3 个修改文件（CONTRIBUTING.md PR 模板段追加 + closure-checklist.md 既有资产核查防御段追加 + ADR-0003 本段追加）。全部硬底满足（PR 模板 ≤ 60 / Issue 模板各 ≤ 50 / CODEOWNERS ≤ 15 / CONTRIBUTING ≤ 100 / closure-checklist ≤ 100）。

**Step 2 工程意义**：协作资产 7 件套达 7/7 完整（CHANGELOG + CONTRIBUTING + CODE_OF_CONDUCT + SECURITY + PR 模板 + Issue 模板 + CODEOWNERS）。.github/ 协作生态从无到有；GitHub UI 创建 PR / Issue 自动加载本 Step 模板；CODEOWNERS 让所有 PR 自动 request review；config.yml 重定向安全报告 + 讨论 + 行为准则。Phase 10 协作基础主题（Step 1 + Step 2）落地完成；Step 3-7 进入工程化建设主题（CI / 容器化 / 发布 / 文档 / 收官）。

### Step 3: CI 强制门禁（GitHub Actions Workflow）

**性质**：Phase 10 第一个"工程化建设"性质 Step；拆两阶段流程第 4 次实战 + **普通 Step 级别首次**（前 3 次：Phase 9 / Step 6 + Step 14 + Phase 10 Kickoff 均 Phase 启程级或复杂 Step 级）；4 轮迭代 v1 → v2 → IMPLEMENT。

**10 项核心裁决摘要**：

| # | 裁决 | 选择 |
|---|---|---|
| 1 | workflow 数量 / job 拆分 | **B 单 workflow + 4 jobs 并行**（lint / typecheck / test / coverage）|
| 2 | Node 版本 | **α 单版本 Node 22.x**（major-only `'22'`；不 pin patch；与 @types/node 协调）|
| 3 | pnpm 版本 | **α 沿用 packageManager 字段** pnpm@10.0.0 |
| 4 | cache | **B cache pnpm store**（pnpm/action-setup 内置）|
| 5 | 触发条件 | **B PR + push to main** |
| 6 | 覆盖率门槛实施 | **A vitest config thresholds 84/75/84/84**（branches 维持 75；KI-P8-005 结构性现象延续）|
| 7 | branch protection | **α + β 必须 PR + status checks + review**（GitHub UI 配置；本 Step 仅建议；**v2 时序：PR 合并到 main 后配置**避免鸡生蛋问题）|
| 8 | CONTRIBUTING 同步 | **α 本 Step 追加 CI Verification 段**（4 行；CONTRIBUTING 90 → 94 ≤ 100）|
| 9 | 0 新增 | 错误码 / Port / Adapter / 包；惯例 K 第 22 次实战 |
| 10 | ADR Step 3 段 | **B ≤ 40 行**；惯例 M 第 23 次 + 跨 Phase 第 4 次实战 |

**v1 → v2 草案与最终的差异**：

- v1 → v2 修订 1：§G branch protection 时序明示"PR 合并到 main 后"（避免鸡生蛋问题——Require status checks 下拉列表只在 workflow 至少在 main 跑过一次后才有 status check 名称可选）
- v1 → v2 修订 2：§C 裁决 2 + §D yml 显式声明 node-version `'22'` major-only（不 pin patch）
- v2 → IMPLEMENT 0 修订（v2 接口冻结后实施完整对齐）

**实施细节**：
- `.github/workflows/ci.yml` 创建（70 行；4 jobs 并行；GitHub 官方 actions only：actions/checkout@v4 + pnpm/action-setup@v4 + actions/setup-node@v4）
- `vitest.config.ts` thresholds 升级 80 → 84（lines / functions / statements；branches 维持 75）+ 含 K.2 锁定路径注释 + branches 不升级理由 + Step 7 进一步升级承诺
- `CONTRIBUTING.md` 追加 ### CI Verification 子段（90 → 94 行）
- branch protection 建议在 docs/phase10/04 §G + 本 ADR 段供用户 PR 合并后 GitHub UI 配置

**3 次 coverage 实测留痕**（附加要求 B；v8 噪声评估）：
- 3 次 branches 全部 79.57%（max-min 0.00pp；零波动；远大于 75% 门槛 4.57pp 安全裕度）
- v8 统计噪声在本 baseline 表现极稳定；前次 Step 1/2 观察到的 79.5%-79.58% 范围未在本 Step 重现

**CI 第一次运行实证结果**（附加要求 A；CI Iteration 诚实记录）：
- [由 PHASE_IMPLEMENT 阶段 push 后实测填入；如失败追加 fix commit + 留痕]

**Step 3 工程意义**：CI 强制门禁建立——元规则 Q v3 模板 4 项独立命令从"贡献者自觉"升级为"CI 强制不可绕过"；让"提交 CI 绿但本地跑不起来"不可能（《补充文档》§13.1 严禁兑现）。Phase 10 工程化建设主题首战完成；Step 4-7（容器化 / 发布 / 文档 / 收官）在 CI 门禁保护下推进。拆两阶段流程在普通 Step 级别首次实证——v1 → v2 用户审视让 branch protection 时序裁决从"AI 草率建议"升级为"避免鸡生蛋的工程裁决"。

### 待 Phase 10 内部各 Step 增量追写

[由 Step 4-7 各自完成时增量填充该 Step 的关键裁决摘要]

### Step 4-7: [待 Phase 10 内部 Step 增量填充]

## Consequences

[本段由 Phase 10 收官 Step（Step 8）撰写；沿用 Phase 9 / Step 18 模式]

## Alternatives Considered

[各 Step 拒绝候选由对应 Step 完成时增量追写；启程指令 9 项核心裁决的拒绝候选详见 `docs/phase10/PHASE-10-DESIGN-DRAFT.md`，待 PHASE_IMPLEMENT 阶段沉淀进本段]

## References

- 《Tianqi 项目架构与代码规范总文档》§22.1 ADR 规范、§24.1 PR 七项、§27 最终裁决原则
- 《Tianqi Phase 8–12 架构与代码规范补充文档》§7 CI/CD 与协作约束、§9.3 覆盖率门槛、§9.4 测试数量底线、§12 文档同步约束、§13 编程 AI 执行规范追加、§14 最终裁决追加、§15 Phase 8-12 最终硬性指令
- `docs/decisions/0001-phase-8-adapter-layer.md`（Phase 8 ADR；Accepted）
- `docs/decisions/0002-phase-9-saga-orchestration.md`（Phase 9 ADR；Accepted Phase 9 CLOSED 2026-05-02）
- `docs/KNOWN-ISSUES.md`（**6 项 KI**：4 carried over from Phase 8 + KI-P9-001 + **KI-P10-001 新增 v3**）
- `CHANGELOG.md`（Phase 8 + Phase 9 段；Phase 10 段由 Step 7 收官撰写）
- `docs/phase10/00-phase-10-kickoff.md`（启程记录；含 v3 调整说明）
