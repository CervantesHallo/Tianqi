# ADR-0003: Phase 10 工程化与协作基础

## Status

In Progress (Phase 10 kickoff started 2026-05-02; PHASE_DESIGN v1 → v2 → user APPROVE → PHASE_IMPLEMENT 完成；附加 §E.2 工作分布诚实修正；ADR-0003 自此进入 Phase 10 内部 Step 增量追写阶段)

> **本 ADR 是增量追写**（惯例 M 沿用 Phase 9 模式）。Phase 10 启程指令拆两阶段流程：
>
> - **第一阶段（PHASE_DESIGN）v1**：创建 ADR-0003 三段（Status DRAFT / Context / Decision 占位）+ PHASE-10-DESIGN-DRAFT.md 完整草案
> - **第一阶段 v2**：用户 REQUEST_CHANGES + 反馈后修订（K.1 KI 字段 + K.2 升级路径 + K.3 方案 B + K.4 Kickoff 独立 + ADR 命名保留）
> - **第二阶段（PHASE_IMPLEMENT，v2 APPROVE 后）**（**本 commit**）：Status DRAFT v2 → **In Progress**；§E.2 工作分布诚实修正（用户附加要求）；删除 PHASE-10-DESIGN-DRAFT.md；同步更新 KNOWN-ISSUES.md（KI-P8-001 修复责任 Phase → Phase 13+ TBD）；创建 docs/phase10/00-phase-10-kickoff.md 启程记录；同步 docs/00-phase1-mapping.md Phase 10 启程段
> - **Phase 10 内部各 Step 完成时**：Decision 段下追加该 Step 的关键裁决摘要
> - **Phase 10 收官（Step 7）**：Status In Progress → Accepted；Consequences 段最终撰写；CI 门槛 84% → 85% 升级
>
> 这是 Phase 10 沿用 Phase 9 增量追写模式的连续性证据（惯例 M 跨 Phase 一致性）。拆两阶段流程**第 3 次实战**——v1 → v2 修订证明 Phase 启程级用户审视的实证价值。

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

### Phase 10 完整 Step 划分（v2 修订；K.4 Kickoff 独立 + K.3 方案 B 不合并；7 Step + 1 Kickoff = 8 总数）

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

### Phase 10 强制开局动作模板（裁决 4 B；自 Step 1 起每 Step 必做）

| # | 动作 | 性质 |
|---|---|---|
| 1 | 重读宪法 + 补充文档（关键章节按 Step 主题） | 通用 |
| 2 | 核查 KNOWN-ISSUES 5 项 KI 状态 | 通用 |
| 3 | 核查 ADR-0001 + ADR-0002 + ADR-0003 | 通用 |
| 4 | 工程化主题专属核查（视 Step 主题）| Phase 10 专属 |

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

### 元规则 / 惯例触发（Phase 10 启程）

| 规则 / 惯例 | 触发 |
|---|---|
| 元规则 B | 严守 — 不修改 Step 1-19（Phase 9）任何已锁定签名 |
| 元规则 P | 严守 — Phase 10 不主动引入第三方依赖（CI / 容器化工具是基础设施而非业务依赖；具体由各 Step 独立判断）|
| 元规则 Q | Phase 10 沿用强制开局动作模板（裁决 4 B）|
| 惯例 K | 严守 — Phase 10 0 新错误码 |
| 惯例 M | 沿用 Phase 9 模式 — ADR-0003 增量追写 |
| §4.8 编译期硬约束 | 严守 — 本 Phase 不触碰 domain |
| 拆两阶段流程 | **第 3 次实战**（本启程指令；Phase 内部 Step 视复杂度决定）|

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

### 待 Phase 10 内部各 Step 增量追写

[由 Step 1-7 各自完成时增量填充该 Step 的关键裁决摘要]

### Step 1-7: [待 Phase 10 内部 Step 增量填充]

## Consequences

[本段由 Phase 10 收官 Step（Step 8）撰写；沿用 Phase 9 / Step 18 模式]

## Alternatives Considered

[各 Step 拒绝候选由对应 Step 完成时增量追写；启程指令 9 项核心裁决的拒绝候选详见 `docs/phase10/PHASE-10-DESIGN-DRAFT.md`，待 PHASE_IMPLEMENT 阶段沉淀进本段]

## References

- 《Tianqi 项目架构与代码规范总文档》§22.1 ADR 规范、§24.1 PR 七项、§27 最终裁决原则
- 《Tianqi Phase 8–12 架构与代码规范补充文档》§7 CI/CD 与协作约束、§9.3 覆盖率门槛、§9.4 测试数量底线、§12 文档同步约束、§13 编程 AI 执行规范追加、§14 最终裁决追加、§15 Phase 8-12 最终硬性指令
- `docs/decisions/0001-phase-8-adapter-layer.md`（Phase 8 ADR；Accepted）
- `docs/decisions/0002-phase-9-saga-orchestration.md`（Phase 9 ADR；Accepted Phase 9 CLOSED 2026-05-02）
- `docs/KNOWN-ISSUES.md`（5 项 open KI）
- `CHANGELOG.md`（Phase 8 + Phase 9 段）
- `docs/phase10/PHASE-10-DESIGN-DRAFT.md`（PHASE_DESIGN 阶段草案；APPROVE 后删除）
