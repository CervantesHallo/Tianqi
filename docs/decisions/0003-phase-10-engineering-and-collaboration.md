# ADR-0003: Phase 10 工程化与协作基础

## Status

DRAFT (Phase 10 kickoff PHASE_DESIGN, 2026-05-02; pending user APPROVE before PHASE_IMPLEMENT upgrade to In Progress)

> **本 ADR 是增量追写**（惯例 M 沿用 Phase 9 模式）。Phase 10 启程指令拆两阶段流程：
>
> - **第一阶段（PHASE_DESIGN，本 commit）**：创建 ADR-0003 三段（Status DRAFT / Context / Decision 占位）+ PHASE-10-DESIGN-DRAFT.md 完整草案
> - **第二阶段（PHASE_IMPLEMENT，APPROVE 后）**：Status DRAFT → In Progress；删除 PHASE-10-DESIGN-DRAFT.md
> - **Phase 10 内部各 Step 完成时**：Decision 段下追加该 Step 的关键裁决摘要
> - **Phase 10 收官（最终 Step）**：Status In Progress → Accepted；Consequences 段最终撰写
>
> 这是 Phase 10 沿用 Phase 9 增量追写模式的连续性证据（惯例 M 跨 Phase 一致性）。

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

### Phase 10 完整 Step 划分（DRAFT 阶段；待 APPROVE 锁定）

| Step | 主题 | 性质 |
|---|---|---|
| 1 | 本启程指令（PHASE_DESIGN + PHASE_IMPLEMENT 两阶段；ADR-0003 + 启程标记）| 启程战 |
| 2 | 协作资产基础三件套（CONTRIBUTING / CODE_OF_CONDUCT / SECURITY）| 协作 |
| 3 | PR 模板 + Issue 模板 + CODEOWNERS（.github/ 目录建立）| 协作 |
| 4 | CI 强制门禁（GitHub Actions workflow + lint/typecheck/test/coverage + 85% 门槛）| 工程化 |
| 5 | 容器化（Dockerfile 多阶段 + 非 root + 健康检查 + docker-compose 开发编排）| 工程化 |
| 6 | 发布自动化（git tag 触发流水线 + changesets 或等价工具）| 工程化 |
| 7 | README 可执行性更新 + Runbook 同步 | 文档 |
| 8 | Phase 10 CLOSED + CHANGELOG 更新 | 收官 |

### Phase 10 强制开局动作模板（裁决 4 B；自 Step 2 起每 Step 必做）

| # | 动作 | 性质 |
|---|---|---|
| 1 | 重读宪法 + 补充文档（关键章节按 Step 主题） | 通用 |
| 2 | 核查 KNOWN-ISSUES 5 项 KI 状态 | 通用 |
| 3 | 核查 ADR-0001 + ADR-0002 + ADR-0003 | 通用 |
| 4 | 工程化主题专属核查（视 Step 主题：协作资产 / CI / 容器化 / 等）| Phase 10 专属 |

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

### 待 Phase 10 内部各 Step 增量追写

[由 Step 2-8 各自完成时增量填充该 Step 的关键裁决摘要]

### Step 2-8: [待 Phase 10 内部 Step 增量填充]

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
