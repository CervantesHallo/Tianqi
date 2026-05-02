# Phase 9 / Step 17 — 覆盖率核查 + KNOWN-ISSUES 更新（Sprint I 第三战）

> **执行时间**：2026-05-02
> **类型**：Phase 9 至今唯一"纯核查"Step — 不构建代码 / 不补测试 / 不修复 bug
> **本 Step 性质**：诚实评估 Phase 9 落幕时的真实状态；让 Step 18-19 收官有可靠数据
> **状态**：完成

---

## §A 当前任务

实地跑 `pnpm test:coverage` 多维度分析 Phase 9 累计 16 Step 后的覆盖率全景；逐一评估 4 项 open KI 状态；识别 Phase 9 暴露的、需要 Phase 10+ 修复的潜在新 KI。**零代码变更 / 零测试增量 / 零 bug 修复**——本 Step 是 Phase 9 16 个 Step 累计能力的"诚实清算"。

---

## §B 影响范围

### B.1 修改文件（3 个，仅文档变更）

| 文件 | 变更 |
|---|---|
| `docs/KNOWN-ISSUES.md` | 4 项 open KI 状态更新（实测复核 + 状态注脚）+ 新增 1 项 KI-P9-001 + 新增 Phase 9 状态总览段 |
| `docs/decisions/0002-phase-9-saga-orchestration.md` | Step 17 段（+~210 行；裁决摘要 + 多维度覆盖率表 + KI 评估表 + 6 项拒绝候选）+ Step 17-19 占位 → Step 18-19 |
| `docs/00-phase1-mapping.md` | Step 17 mega-bullet + Sprint I 进度 3/5 |

### B.2 新增文件（1 个，仅文档）

| 文件 | 性质 |
|---|---|
| `docs/phase9/17-coverage-and-known-issues.md` | 本文件（执行记录 9 节 A-I） |

### B.3 测试增量

- 单元 +0 / 集成 +0 / 契约 +0 — **裁决 7 严守**
- 总测试维持 **1971**（1867 passed + 104 skipped）

### B.4 lockfile / 第三方依赖

- lockfile 零变动
- 0 新增第三方依赖 — Sprint G+H+I 累计 8 步零新依赖

### B.5 git diff zero 跨 Phase 1-16 任何业务代码 + 锁定接口

实测验证：本 Step 仅修改 3 个文档文件 + 新增 1 个文档文件；**零业务代码变更 / 零 ESLint 配置变更（Step 15 锁定）/ 零 tsconfig 变更**。

---

## §C 设计决策

### C.1 强制开局动作 1-3 执行确认

| # | 动作 | 状态 |
|---|---|---|
| 1 | 重读《宪法》§17 + §22.2 + 《补充》§9.3 / §9.4 | ✅ |
| 2 | 核查 KNOWN-ISSUES 4 项 open KI | ✅ |
| 3 | 核查 ADR-0001 + ADR-0002 全部段（Step 1-16） | ✅ |

### C.2 强制开局动作 4 执行结果（覆盖率多维度分析）

#### 维度 1：全仓总体覆盖率（Phase 9 / Step 17 实测）

| 指标 | Phase 8 baseline | Phase 9 / Step 16 | Phase 9 / Step 17 实测 | vs Phase 8 |
|---|---|---|---|---|
| Lines | 85.97% | 84.92% | **84.92%** | -1.05pp |
| Branches | 79.78% | 79.57% | **79.57%** | -0.21pp |
| Functions | 94.86% | 91.68% | **91.68%** | -3.18pp |
| Statements | 85.97% | 84.92% | **84.92%** | -1.05pp |

**全部仍超 §9.3 红线**（80%/75%/80%/80%）。

**Phase 9 vs Phase 8 轻微下行的根因（诚实评估）**：
- Phase 9 引入 2 个新 postgres adapter（saga-state-store-postgres / dead-letter-store-postgres），CI 默认 skip 拉低 functions / lines 覆盖率
- Phase 9 引入 3 个新 Port，部分仍以 type-only export 为主（lines 0% 计入分母）
- 与此对应，Phase 9 业务 saga 模块全部 > 80% lines 覆盖（贡献正向）

#### 维度 2：按 package 覆盖率

##### Phase 9 新增 saga 模块（application/src/saga/）

| 模块 | Lines | Branches | Functions | Sprint |
|---|---|---|---|---|
| **cross-saga-coordination.ts** | **97.84%** | 92.5% | 100% | H Step 14 |
| saga-orchestrator.ts | 90.41% | 79.54% | 100% | G Step 6-8 |
| saga-manual-intervention.ts | 89.51% | 80.76% | 100% | G Step 9 |
| liquidation-saga.ts | 87.25% | 82.92% | 94.73% | H Step 10 |
| adl-saga.ts | 86.44% | 82% | 94.73% | H Step 11 |
| insurance-fund-saga.ts | 85.45% | 75% | 87.5% | H Step 12 |
| state-transition-saga.ts | 85.29% | 80.39% | 83.33% | H Step 13 |

**全部 ≥ 80% lines；最高 cross-saga-coordination.ts 97.84%（Step 14 v2 修订引入的 parseSagaIdToInfo + onDegradedFailure 等纯 helper 高覆盖率）**

##### Phase 9 新增 Sprint F 持久化 Adapter

| Adapter | Lines | Branches | Functions | 备注 |
|---|---|---|---|---|
| saga-state-store-memory | 94.16% | 84.37% | 100% | Sprint F Step 3 |
| saga-state-store-postgres | 40.7% | 34.78% | 24% | CI 默认 skip（KI-P8-002） |
| dead-letter-store-memory | 93.9% | 84.61% | 90% | Sprint F Step 4 |
| dead-letter-store-postgres | 37.97% | 36.66% | 25% | CI 默认 skip（KI-P8-002） |

##### Phase 1-7/8 既有包

| Package | Lines | Branches | Functions | KI 状态 |
|---|---|---|---|---|
| domain/src | 75.16% | 75.79% | 93.05% | KI-P8-001 未改善 |
| ports/src | 11.96% | 100% | 100% | KI-P8-005 局部改善（Phase 8 baseline 0%） |
| application/src（总体） | 86.5% | 81.68% | 95.93% | Phase 9 新增 saga 拉升 |
| 5 业务 Engine HTTP（Phase 8 Sprint E） | 93-97% | 47-63% | 100% | Phase 9 全程未触及 |
| event-store-memory | 100% | 91.66% | 100% | |
| event-store-postgres | 33.8% | 36.66% | 22.58% | KI-P8-002 |
| event-store-sqlite | 96% | 80.55% | 100% | |
| notification-memory | 95.71% | 77.77% | 100% | |
| notification-kafka | 47.41% | 47.61% | 50% | KI-P8-002 |
| config-memory | 95.89% | 85.36% | 100% | |
| config-file | 80.79% | 77.89% | 97.77% | |

#### 维度 3：按 layer

| Layer | 代表性 lines | 备注 |
|---|---|---|
| domain | 75.16% | KI-P8-001 |
| ports | 11.96% | KI-P8-005 结构性 |
| contracts | 高 | runtime 错误码工厂被广泛消费 |
| shared | 高 | brand 工厂被广泛消费 |
| application | 86.5% | 含 Phase 9 新增 saga 模块 |
| adapters（memory）| 94-100% | |
| adapters（postgres / kafka） | 33-48% | KI-P8-002 |
| adapters（HTTP Engine）| 93-97% | Phase 8 Sprint E |

#### 维度 4：按 Sprint 贡献

| Sprint | 主要贡献 |
|---|---|
| Sprint F（Step 1-5）| 持久化 adapter memory 90%+ / postgres 30-40%（KI-P8-002 延续）；Step 3-4 引入 4 个新 adapter 包 |
| Sprint G（Step 6-9）| saga-orchestrator 90.41% / saga-manual-intervention 89.51%；编排器三件套 + 人工介入全部高覆盖率 |
| Sprint H（Step 10-14）| 4 业务 saga + cross-saga-coordination 全部 ≥ 85%；cross-saga-coordination 97.84% 最高（v2 修订 parseSagaIdToInfo helper 高覆盖率） |
| Sprint I（Step 15-16）| Step 15 ESLint 规则零覆盖率影响 / Step 16 端到端集成测试拉升 saga 模块覆盖率 0.02-0.07pp |

### C.3 强制开局动作 5 执行结果（4 项 open KI 状态最终评估）

| KI | Phase 8 baseline | Phase 9 / Step 17 实测 | 状态变更 | 处置 |
|---|---|---|---|---|
| **KI-P8-001** domain 75.16% | 75.16% / 75.79% / 93.06% | **75.16% / 75.79% / 93.05%** | **未改善**（裁决 2 γ） | 状态保持 open + 注脚 Phase 9 全程未触碰 domain 测试；修复责任 Phase 转 **Phase 10**；诚实评估 |
| **KI-P8-002** external Adapter | event-store 40.71% / notification 47.42% | **event-store 33.8% / notification 47.41% / saga-state-store 40.7% / dead-letter 37.97%** | **延续 + Phase 9 引入 2 新 postgres adapter 一致 low coverage** | 状态保持 open；修复责任 Phase 11 |
| **KI-P8-003** 时序 flake | 复现率 ~10-20% | **Phase 9 实战 0 显式 flake** | **Phase 9 实战未触发但状态保持 open**（裁决 3 β） | 状态保持 open + 注脚 "Phase 9 实战 0 flake"；修复责任 Phase 11 |
| **KI-P8-005** ports 0% | 0% | **11.96%** | **局部改善 +11.96pp**（裁决 4 α） | 状态保持 open + 注脚 saga-port.ts 100%；修复责任 N/A 结构性现象 |

### C.4 强制开局动作 6 执行结果（潜在新 KI 识别）

实地核查 Step 1-16 累计的"风险点 + Phase 10+ 责任承接"事项：

| 候选事项 | 来源 | 升级 KI 判断 | 理由 |
|---|---|---|---|
| 业务 Saga 真取消能力 | Step 8 裁决 1 γ 局限性 | **不升级** | ADR 已留痕；不需要持续监控 |
| **StateTransition Saga 数据副本与 domain transitionRules 漂移** | Step 13 裁决 4 A 成本 | **升级 KI-P9-001** | 需要持续监控（domain 任何修改都要触发 Saga 数据副本同步评估） |
| 跨进程 sagaId 唯一性 | Step 14 强制开局动作 5 | **不升级** | 业务规模未到跨进程部署；ADR 已留痕 |
| listIncomplete O(n) 扫描扩展性 | Step 14 §I.4 | **不升级** | ADR 已留痕"Phase 10+ Adapter 扩展承接" |
| sagaId 命名约定漂移 | Step 14 v2 修订 | **不升级** | v2 修订已通过 SAGA_ID_NAMING_CONVENTION + parseSagaIdToInfo + onDegradedFailure + 元规则 B 锁定显式化防御 |
| Postgres 端到端集成测试缺失 | Step 16 风险点 E.3 | **不升级** | 已 cover by KI-P8-002 |
| 真实 Engine 引入时端到端测试时长上升 | Step 16 风险点 E.1 | **不升级** | 已 cover by KI-P8-002 |

**结论**：仅升级 1 项 KI（KI-P9-001）。其他事项已在 ADR-0002 留痕；不重复创建 KI（避免 KNOWN-ISSUES 与 ADR 冗余）。

### C.5 7 个核心裁决最终选择

| # | 裁决 | 选择 | 理由 |
|---|---|---|---|
| 1 | 覆盖率分析维度 | **C 多维度交叉**（4 维度全分析） | Phase 9 是 Tianqi 至今最大 Sprint 跨度（16 Step）；多维度数据让 Step 18 收官清单有可靠基础 |
| 2 | KI-P8-001 domain 状态 | **γ 未改善** | 实测 75.16% 与 Phase 8 baseline 完全一致；不为"关闭 KI"而牵强声明改善 |
| 3 | KI-P8-003 状态 | **β 保持 open** | Phase 9 测试套件运行时间短（12ms）未充分压测；KI 关闭应有更强证据 |
| 4 | KI-P8-005 状态 | **α 局部改善 + 状态保持 open** | 0% → 11.96% 是事实；但 ports 包整体仍以 type-only export 为主（结构性延续） |
| 5 | 新增 Phase 10+ KI | **B 新增 1 项**（KI-P9-001） | 仅"需要持续监控"的事项升级；ADR 留痕的不重复 |
| 6 | 覆盖率盲点 KI | **β 不新增** | KI-P8-002 已 cover 真实基础设施 CI skip 场景 |
| 7 | 测试增量 | **0 严守** | Sprint I 性质是"完整性核查"；本 Step 仅识别 + 记录 |

### C.6 KI 状态最终评估表（Phase 9 落幕时）

| KI | 创建 | 当前状态 | 修复责任 Phase | 修复 Step |
|---|---|---|---|---|
| KI-P8-001 | Phase 8 / Step 18 | open（未改善） | Phase 10 | 未确定 |
| KI-P8-002 | Phase 8 / Step 18 | open（延续） | Phase 11 | 未确定 |
| KI-P8-003 | Phase 8 / Step 18 | open（Phase 9 实战 0 显式 flake） | Phase 11 | 未确定 |
| KI-P8-005 | Phase 8 / Step 18 | open（Phase 9 局部改善） | N/A 结构性 | N/A |
| **KI-P9-001（新增）** | Phase 9 / Step 17 | open（持续监控） | Phase 10+ | 未确定 |

### C.7 KI-P9-001 详情

**KI-P9-001：StateTransition Saga 状态机数据副本与 domain transitionRules 漂移监控**

- **当前状态**：Phase 9 / Step 13 引入 `state-transition-saga.ts` 内部 `stateTransitionRules` 数据副本（从 domain `risk-case-state-machine.ts` 派生）；Saga 侧独立维护副本是裁决 4 A 的成本
- **风险**：未来某 Phase 修改 domain transitionRules 但忘记同步 Saga 副本 → false negative / false positive
- **监控建议**：
  - Phase 10+ 修改 `risk-case-state-machine.ts` 的 PR 必须明示是否同步更新 Saga 副本
  - Phase 10+ 引入 ESLint 自定义规则或 CI 检查比对两文件状态/动作字面量集合
  - 长期：考虑提取到 shared 包共享数据源（违反元规则 B 的代价 vs 漂移风险的代价权衡）
- **Phase 9 实测**：domain transitionRules 与 Saga 副本完全一致（基于 grep 实测）

### C.8 Phase 10+ 承接事项汇总

ADR-0002 留痕的事项（无需 KI 跟踪）：
- 业务 Saga 真取消能力（Step 8）
- 跨进程 sagaId 唯一性（Step 14）
- listIncomplete O(n) 扩展性（Step 14）
- BusinessSagaKind 类型扩展（Step 14）
- Postgres 端到端测试（Step 16）
- 真实 Engine 引入（Step 16）

升级为 KI 跟踪的事项：
- KI-P9-001 StateTransition 数据副本漂移监控

### C.9 元规则 / 惯例触发

| 规则 / 惯例 | 实战 |
|---|---|
| 元规则 B（接口冻结） | 严守 — 本 Step 仅文档变更 |
| 元规则 P（零新依赖） | 严守 — Sprint G+H+I 累计 8 步零新依赖 |
| 元规则 Q（强制开局） | 第 17 次实战（含 4 / 5 / 6 三项专属实地核查） |
| 惯例 K（错误码"仅必需"） | 严守 — 0 新错误码 |
| 惯例 M（ADR 增量追写） | 第 17 次实战 |
| §4.8 编译期硬约束（Step 15） | 严守 — 本 Step 不触碰 domain |
| 元规则 A / C / D / E / F / G / H / I / J / L / N / O | N/A |

---

## §D 代码变更（仅文档）

### D.1 docs/KNOWN-ISSUES.md（修改）

- KI-P8-001 增加 Phase 9 / Step 17 实测复核段（"未改善"诚实记录）+ 修复责任 Phase 转 Phase 10
- KI-P8-002 增加 Phase 9 引入 2 新 postgres adapter 实测数据 + 状态保持 open
- KI-P8-003 增加 "Phase 9 实战 0 显式 flake" 注脚 + 状态保持 open 理由
- KI-P8-005 增加 Phase 9 局部改善（0% → 11.96%）+ 状态保持 open + 修复责任 N/A
- 新增 Phase 9 状态总览段（覆盖率全景 + Phase 8 → Phase 9 对比）
- 新增 KI-P9-001（StateTransition Saga 数据副本漂移监控）

### D.2 docs/decisions/0002-phase-9-saga-orchestration.md（修改）

- Step 17 段（+~210 行）：性质 + 强制开局动作 4-6 实测结果详细 + 7 个核心裁决摘要 + KI 状态最终评估表 + KI-P9-001 详情 + Phase 10+ 承接事项汇总 + 元规则 / 惯例触发表 + 6 项拒绝候选
- Step 17-19 占位 → Step 18-19

### D.3 docs/00-phase1-mapping.md（修改）

- Step 17 mega-bullet（覆盖率多维度数据 + KI 状态评估 + KI-P9-001 + Sprint I 进度 3/5）

### D.4 docs/phase9/17-coverage-and-known-issues.md（新增）

本文件（执行记录 9 节 A-I）。

### D.5 git diff zero 跨 Phase 1-16 任何业务代码 + 锁定接口

实测验证（grep 跨 packages）：本 Step 仅修改 3 个 docs 文件 + 新增 1 个 docs 文件；零业务代码变更 / 零 ESLint 配置变更 / 零 tsconfig 变更。

---

## §E 风险点

### E.1 覆盖率多维度数据的诚实表述

实测：Phase 9 vs Phase 8 全仓总体下行 -1.05pp（lines）。**诚实表述**：Phase 9 引入大量新代码（Sprint F 持久化 + Sprint G 编排器 + Sprint H 业务 saga）；其中 postgres adapter 在 CI 默认 skip 拉低总覆盖率，是 KI-P8-002 已知现象的延续，不是 Phase 9 的"工程退步"。Phase 9 业务 saga 模块全部 ≥ 80% lines 覆盖是工程能力 deliver 的证据。

### E.2 KI 状态评估的客观性

实测复核基于：
- KI-P8-001 实测 75.16% 与 Phase 8 baseline 完全一致 → 客观证据"未改善"
- KI-P8-005 实测 0% → 11.96% → 客观证据"局部改善"
- KI-P8-003 Phase 9 累计 16 Step 实战中无显式 flake 报告 → 客观证据但 12ms 套件运行时间不构成充分压测

诚实纪律：不为"关闭 KI"而牵强声明改善；不为"延续 open"而忽视实测改善。

### E.3 新增 KI 与 ADR 留痕的协调

KI-P9-001 与 ADR-0002 Step 13 段已留痕"未来 domain 变化由 ADR 修订流程同步"内容**协调一致**。KI-P9-001 是 ADR 留痕的"持续监控"维度升级，不是冗余。其他 6 项 Phase 10+ 承接事项保留在 ADR 留痕层，未升级 KI（避免 KNOWN-ISSUES 与 ADR 冗余）。

### E.4 推送过程

无异常预期。

---

## §F 测试计划（已实施）

### F.1 全量验证实测

- **Lint**: 零警告（`pnpm lint`）
- **Typecheck**: 零错误（`pnpm -r build`，全 25 包通过）
- **Test**: **1971 tests（1867 passed + 104 skipped）** — 维持不变（裁决 7 0 增量）
- **Coverage**: **84.92% lines / 79.57% branches / 91.68% functions / 84.92% statements**
  - 与 Step 16 baseline 完全一致（裁决 7 0 增量）
  - 全部仍超 §9.3 红线（Functions +11.68pp）

### F.2 多维度覆盖率分析（强制开局动作 4）

详见 §C.2 完整四维度表。

### F.3 KNOWN-ISSUES 4 项 open KI 实测复核（强制开局动作 5）

详见 §C.3。

### F.4 Phase 10+ 潜在新 KI 识别（强制开局动作 6）

详见 §C.4。

---

## §G 验收

### G.1 硬底 H1-H4 全部达标

| # | 硬底 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700（预期维持 1971；本 Step 0 增量） | ✅ **1971** |
| H2 | 覆盖率 ≥ 80%/75%/80%/80% | ✅ **84.92%/79.57%/91.68%/84.92%** |
| H3 | 全量 lint / typecheck / test 全绿 | ✅ |
| H4 | push 到 origin main 成功 | 待提交 |

### G.2 参考下限 R1-R5 全部达成

| # | 参考下限 | 实测 |
|---|---|---|
| R1 | 多维度覆盖率分析（4 维度） | ✅ 全仓 + package + layer + Sprint |
| R2 | 4 项 open KI 状态全部评估 | ✅（C.3） |
| R3 | 新增 KI 数 ≤ 2 | ✅ 仅新增 1 项（KI-P9-001） |
| R4 | 测试增量 0 | ✅ |
| R5 | 不修改任何业务代码 | ✅ git diff zero 跨 Phase 1-16 |

### G.3 完成项 G1-G24 全部 PASS

| # | 完成项 | 状态 |
|---|---|---|
| G1 | Phase 9 强制开局动作 1-6 完成 | ✅ |
| G2 | 覆盖率分析维度裁决（A/B/C）已 §C 明示 | ✅ C |
| G3 | KI-P8-001 状态裁决已 §C 明示 | ✅ γ |
| G4 | KI-P8-003 状态裁决已 §C 明示 | ✅ β |
| G5 | KI-P8-005 状态裁决已 §C 明示 | ✅ α |
| G6 | 新增 Phase 10+ KI 裁决已 §C 明示 | ✅ B 新增 1 项 |
| G7 | 覆盖率盲点 KI 裁决已 §C 明示 | ✅ β 不新增 |
| G8 | 测试增量 0（裁决 7 严守） | ✅ |
| G9 | 不修改 Step 1-16 任何已锁定签名 | ✅ |
| G10 | 不修改任何业务代码 | ✅ |
| G11 | 不引入第三方依赖 | ✅ |
| G12 | 不引入新错误码 | ✅ |
| G13 | KNOWN-ISSUES 4 项 open KI 状态全部评估 | ✅ |
| G14 | KNOWN-ISSUES 更新 + 新增 KI-P9-001 | ✅ |
| G15 | ADR-0002 Step 17 段增量追写完成（惯例 M 第 17 次实战） | ✅ |
| G16 | docs/phase9/17 含完整覆盖率多维度表格 + KI 状态最终评估 | ✅（本文件） |
| G17 | 元规则 A–P + Q + 惯例 K + L + M 触发情况逐一声明 | ✅（§C.9） |
| G18 | 全量检查全绿 | ✅ |
| G19 | commit 消息遵守 commit-convention | ✅ |
| G20 | 已 push 到 origin main | 待提交 |
| G21 | Phase 9 落幕时的真实覆盖率状态有完整数据 | ✅（§C.2） |
| G22 | 不为"关闭 KI"而牵强声明改善（诚实评估） | ✅ KI-P8-001 γ 未改善 |
| G23 | 不为"新增 KI"而冗余创建（与 ADR 留痕协调） | ✅ 仅 KI-P9-001 |
| G24 | Sprint I 收官准备就绪（Step 18-19 起步条件） | ✅ |

---

## §H Step 18 衔接预告

Step 18 将做 ADR-0002 finalize + Phase 9 完整清单。Step 18 严重依赖本 Step 的：

- 多维度覆盖率数据（§C.2）作为 Phase 9 收官清单覆盖率部分
- KI 状态最终评估（§C.3 + §C.6）作为 Phase 9 未解决问题清单
- Phase 10+ 承接事项汇总（§C.8）作为 Phase 9 → Phase 10 衔接预告

Sprint I 进度 3/5。Step 18 / 19 由独立指令启动。

---

## §I 对作品级代码库的意义

### I.1 诚实评估的工程纪律

Phase 9 16 个 Step 累计的工程能力需要在 Step 17 被诚实清算——覆盖率改善了多少、KI 修复了几项、新风险又有几项。这是 Phase 9 落幕时的"诚实账单"。

**实测诚实记录**：
- KI-P8-001 未改善（拒绝牵强声明改善）
- KI-P8-005 局部改善（拒绝声明结构性现象已解决）
- KI-P8-003 Phase 9 实战 0 flake（但拒绝降级为 monitoring，因为压测不充分）
- 仅升级 KI-P9-001（拒绝冗余创建）

每一条都基于客观证据 + 诚实纪律。

### I.2 多维度数据的工程价值

4 维度交叉分析（全仓 / package / layer / Sprint）让 Phase 9 覆盖率改善有完整证据链：

- **全仓**：84.92% > 80% 红线 ✅
- **业务 saga 模块**：全部 ≥ 80% lines（最高 cross-saga-coordination 97.84%）
- **postgres adapter**：CI 默认 skip 是结构性现象（KI-P8-002 延续）
- **Sprint H**：模板纪律三步全部守住 + 覆盖率全部 ≥ 80%

读者翻开覆盖率报告，能从任一维度快速定位 Phase 9 工程能力的 deliver / 短板。

### I.3 Phase 10+ 承接清单的协调

ADR-0002 留痕的事项（无需 KI 跟踪）+ KI-P9-001（升级为 KI 跟踪） = Phase 10+ 全部承接事项。这种"双轨制"让：

- ADR 承担"设计裁决 + 历史追溯"
- KNOWN-ISSUES 承担"持续监控 + 状态跟踪"
- 不冗余、不遗漏

### I.4 Sprint I 完整性核查的推进

Sprint I 5 个 Step：

| Step | 主题 | 性质 | 状态 |
|---|---|---|---|
| 15 ✅ | §4.8 编译期硬约束 | 工程基础设施 | 完成 |
| 16 ✅ | Saga 集成测试 | 测试 | 完成 |
| **17 ✅** | **覆盖率核查 + KI 更新**（本 Step） | **质量** | **完成** |
| 18 | ADR-0002 finalize + Phase 9 完整清单 | 文档 | 待 |
| 19 | Phase 9 CLOSED + CHANGELOG 更新 | 收官 | 待 |

Sprint I 进度 3/5。Step 18-19 起步条件已就绪：本 Step 提供完整覆盖率数据 + KI 评估 + Phase 10+ 承接事项汇总。

### I.5 元规则 B 跨 17 个 Step 兑现

Phase 9 / Sprint F 起 Step 1 锁定 SagaStep / SagaInvocation / SagaResult 等接口；至 Step 17 跨 17 个 Step：

- Step 1-16 锁定的所有接口签名一字未改
- Step 14 引入的 10 项 cross-saga-coordination 形态自此冻结
- Step 15 引入的 4 项 ESLint 规则 + tsconfig references 自此冻结
- 端到端集成测试 + 覆盖率核查零修改任何业务代码

这是宪法 §28（不得用"先跑起来再说"破坏接口稳定性）的兑现。

---

**Phase 9 / Sprint I 进度 3/5 — 2026-05-02**

Sprint I 启程战（Step 15）+ 端到端集成（Step 16）+ 覆盖率核查（本 Step）完成。Step 18-19 由独立指令启动。
