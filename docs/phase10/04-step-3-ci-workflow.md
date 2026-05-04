# Phase 10 / Step 3 — CI 强制门禁（GitHub Actions Workflow）

> **执行时间**：2026-05-04
> **类型**：Phase 10 第一个"工程化建设"性质 Step；拆两阶段流程第 4 次实战 + **普通 Step 级别首次**
> **本 Step 性质**：CI workflow 从无到有；4 项独立命令从"贡献者自觉"升级为"CI 强制不可绕过"；vitest thresholds 升级 80 → 84
> **状态**：完成（PHASE_DESIGN v1 → v2 → IMPLEMENT 三轮迭代闭环）

---

## 🎯 拆两阶段流程在普通 Step 级别首次实证

| 实战次数 | 性质 | Step | 用户审视价值 |
|---|---|---|---|
| 1 | Step 启程级 | Phase 9 / Step 6 SagaOrchestrator | 5 → 7 类审计事件 |
| 2 | Step 启程级 | Phase 9 / Step 14 CrossSagaCoordination | sagaId convention 隐式→显式 |
| 3 | Phase 启程级 | Phase 10 Kickoff | v1 → v2 → v3 4 轮迭代 |
| **4** | **普通 Step 级别**（首次）| **Phase 10 / Step 3 本 Step** | **K.3 branch protection 时序裁决（鸡生蛋问题）+ node-version major-only 显式化** |

---

## §A 当前任务

Phase 10 / Step 3 — 创建 GitHub Actions CI workflow（4 jobs 并行验证 lint/typecheck/test/coverage）+ vitest thresholds 升级（80 → 84）+ CONTRIBUTING 追加 CI Verification 段。Phase 10 第一个工程化建设 Step；让 4 项独立命令从"贡献者自觉"升级为"CI 强制不可绕过"。

---

## §B 影响范围

### B.1 新增文件（2 个）

| 文件 | 行数 | 性质 |
|---|---|---|
| `.github/workflows/ci.yml` | 70 | CI workflow（4 jobs 并行）|
| `docs/phase10/04-step-3-ci-workflow.md` | 本执行记录 | 9 节 A-I |

### B.2 修改文件（4 个）

| 文件 | 变更 |
|---|---|
| `vitest.config.ts` | thresholds 升级 80 → 84/75/84/84（branches 维持 75）|
| `CONTRIBUTING.md` | 追加 ### CI Verification 子段（90 → 94 行）|
| `docs/decisions/0003-phase-10-engineering-and-collaboration.md` | Step 3 段增量追写（惯例 M 第 23 次 + 跨 Phase 第 4 次）|
| `docs/00-phase1-mapping.md` | Phase 10 Step 3 完成段追加 |

### B.3 删除文件（1 个）

| 文件 | 原因 |
|---|---|
| `docs/phase10/PHASE-10-STEP-3-DESIGN-DRAFT.md` | PHASE_DESIGN 阶段草案；设计沉淀进 ADR-0003 + .github/workflows/ci.yml 后作废 |

### B.4 业务代码 / 测试 / lockfile

- **业务代码**：0 修改
- **测试增量**：0
- **lockfile** `pnpm-lock.yaml`：零变动
- **错误码总数**：维持 84（惯例 K 第 22 次实战）
- **workspace 包数**：维持 25
- **KI 状态**：5 项 open（不变）

---

## §C 设计决策

### C.1 强制开局动作 1-3

✅ 重读《宪法》§17/§9 + 《补充文档》§7.1/§7.2/§9.3/§9.4/§13.1 + ADR-0003 K.2 锁定路径 + CONTRIBUTING；KI 5 项 open 稳定核查；ADR-0001/0002 Accepted + ADR-0003 In Progress 核查（Step 0/1/2 段已增量追写）。

### C.2 强制开局动作 4 — .github/ + 工具链 + 覆盖率工具链双重核查

| 维度 | 实测 | 处置 |
|---|---|---|
| .github/workflows/ | directory does not exist | 本 Step 创建 |
| Node.js 本机版本 | v22.20.0 | CI 用 `'22'` major-only |
| pnpm | 10.0.0（packageManager 锁定）| CI 沿用 packageManager 字段 |
| package.json scripts | 4 命令完整定义 | CI 直接调用 `pnpm run <command>` |
| vitest config | 单 root；当前 thresholds 80/80/75/80 | 升级 84/75/84/84 |

### C.3 强制开局动作 5 — 4 项独立命令 baseline + post-implementation + final

| # | 命令 | Baseline | Post-Impl | Final |
|---|---|---|---|---|
| 1 | `pnpm lint` | PASS | PASS | **PASS** |
| 2 | `pnpm typecheck` | PASS | PASS | **PASS** |
| 3 | `pnpm test` | 1971（1867+104）| 1971（1867+104）| **1971（1867+104）** |
| 4 | `pnpm test:coverage` | 84.92%/79.56%/91.68%/84.92% | 84.92%/79.57%/91.68%/84.92% | **84.92%/79.57%/91.68%/84.92%** |

vitest thresholds 升级后实测全部 ≥ 门槛（lines 84.92 ≥ 84 / functions 91.68 ≥ 84 / statements 84.92 ≥ 84 / branches 79.57 ≥ 75）。

### C.4 10 个核心裁决最终选择

详见 ADR-0003 Step 3 段表格。v2 修订 2 项（K.3 时序 + node-version 显式）；v2 → IMPLEMENT 0 修订（v2 接口冻结后实施完整对齐）。

### C.5 元规则 / 惯例触发情况

| 规则 / 惯例 | 触发情况 |
|---|---|
| 元规则 B（接口签名冻结）| **严守** — 0 业务代码修改；CI 配置 + vitest thresholds 守护 baseline 而非修改接口 |
| 元规则 P（不主动引入第三方依赖）| **严守** — CI 仅用 GitHub 官方 actions（actions/checkout / actions/setup-node）+ pnpm 官方 pnpm/action-setup；累计 24 步零新依赖 |
| 元规则 Q（强制开局动作 v3 模板）| **第 5 次实战** — Kickoff + Step 0 首次完整 + Step 1 + Step 2 + 本 Step；4 项独立命令 baseline + post-impl + final 三轮实测；附加要求 B 含 3 次 coverage 实测 |
| 惯例 K（错误码命名空间扩展）| **第 22 次实战** — 0 新错误码 |
| 惯例 M（ADR 增量追写）| **第 23 次 + 跨 Phase 第 4 次实战** — ADR-0003 Step 3 段 |
| §4.8 编译期硬约束 | **严守** — 不触碰 packages/domain |
| 拆两阶段流程 | **第 4 次实战 + 普通 Step 级别首次** — v1 → v2 → IMPLEMENT 三轮迭代；v1 → v2 修订 2 项（K.3 时序 + node-version 显式）|
| Phase 10 工作流过渡 | **第 5 次实战**（Kickoff + Step 0 + 1 + 2 + 本 Step；feature 分支 + PR 合并）|

A/C/D/E/F/G/H/I/J/L/N/O 全 N/A。

---

## §D 代码变更

### D.1 .github/workflows/ci.yml（70 行；新增）

4 jobs 并行：
- `lint`: `pnpm lint`（eslint --max-warnings=0）
- `typecheck`: `pnpm typecheck`（tsc -b tsconfig.json）
- `test`: `pnpm test`（vitest run）
- `coverage`: `pnpm test:coverage`（vitest run --coverage；含 thresholds 验证）

每 job steps：actions/checkout@v4 → pnpm/action-setup@v4 → actions/setup-node@v4（node-version: '22'，cache: 'pnpm'）→ pnpm install --frozen-lockfile → pnpm run <command>

触发：`pull_request` + `push: branches: [main]`。

### D.2 vitest.config.ts thresholds 升级

```ts
// 修改前
thresholds: {
  lines: 80, functions: 80, branches: 75, statements: 80
}

// 修改后（含 K.2 锁定路径注释 + branches 不升级理由 + Step 7 进一步升级承诺）
thresholds: {
  lines: 84, functions: 84, branches: 75, statements: 84
}
```

### D.3 CONTRIBUTING.md 追加 ### CI Verification 段（4 行）

90 → 94 行（≤ 100）。引用 .github/workflows/ci.yml 不复制内容（与 Step 1/2 同精神）。

### D.4 docs/decisions/0003-phase-10-engineering-and-collaboration.md Step 3 段

惯例 M 第 23 次 + 跨 Phase 第 4 次实战。约 50 行（含 10 项裁决摘要 + v1→v2 差异 + 实施细节 + 3 次 coverage 留痕 + CI Iteration 留痕 + Step 3 工程意义）。

### D.5 docs/phase10/PHASE-10-STEP-3-DESIGN-DRAFT.md 删除

PHASE_DESIGN 阶段草案；设计沉淀进 ADR + ci.yml 后作废。

---

## §E 风险点

### E.1 CI 第一次运行的不确定性

**Fallback**：CI failure 时核查 GitHub Actions log；区分配置错误 vs 基础设施问题；前者修 yml + 追加 fix commit（不 force-push 抹掉失败历史；附加要求 A 严守）。

### E.2 84% 门槛在 79.5% branches 边缘的稳定性

**实测结果（附加要求 B）**：3 次 coverage 全部 79.57%（max-min 0.00pp；零波动）；远大于 75% 门槛 4.57pp 安全裕度。**branches 在本 baseline 表现极稳定**；前次 Step 1/2 观察的 79.5%-79.58% 范围未在本 Step 重现。

### E.3 pnpm 版本与 packageManager 字段一致性

**应对**：CI 通过 pnpm/action-setup@v4 自动读 packageManager 字段；将来升级 pnpm 必须同步修改 package.json 此字段。

### E.4 branch protection 设置由用户责任完成的协调

**应对**：本 Step PR 合并到 main 后用户在 GitHub UI 配置（v2 K.3 时序裁决）；本 Step 不在代码层面落地任何 branch protection。

### E.5 vitest thresholds 升级后本地与 CI 不一致

**实测结果**：本地 4 项命令 final 全 PASS；thresholds 84/75/84/84 在本地实测安全（lines 84.92 / functions 91.68 / statements 84.92 / branches 79.57 全部 ≥ 门槛）。CI 第一次运行将验证此一致性（详见 §G CI Iteration）。

---

## §F 测试计划

### F.1 4 项独立命令实测（baseline + post-implementation + final 三轮）

详见 §C.3 表格。**4/4 PASS**；test 1971 维持；coverage thresholds 升级后全部 ≥ 门槛。

### F.2 3 次 coverage 实测留痕（附加要求 B；branches 波动监测）

| 第 N 次 | lines | branches | functions | statements |
|---|---|---|---|---|
| 1 | 84.92% | 79.57% | 91.68% | 84.92% |
| 2 | 84.92% | 79.57% | 91.68% | 84.92% |
| 3 | 84.92% | 79.57% | 91.68% | 84.92% |
| **max-min** | **0.00pp** | **0.00pp** | **0.00pp** | **0.00pp** |

**结论**：3 次完全一致；零波动；branches 79.57% 距 75% 门槛 4.57pp 安全裕度。**不需要警示信号**（branches 79.57% 远 > 78%；附加要求 B 提示阈值未触发）。前次 Step 1/2 观察的 79.5%-79.58% 范围未在本次 3 连测重现——可能是 v8 在不同 baseline / runner / 时间点表现略有差异；本 baseline 极稳定。

### F.3 CI workflow 自身实测计划

PR push 后 CI 在 feature 分支首次运行；merge 后 CI 在 main 首次运行。具体结果在 §G CI Iteration 段填入。

### F.4 KNOWN-ISSUES 状态

5 项 open KI 稳定（不变）；KI-P10-001 已 RESOLVED（Step 0 关闭）。

---

## §G 验收硬底

| 项 | 期望 | 实测 |
|---|---|---|
| H1 | 测试总数 ≥ 1700（预期维持 1971）| ✅ 1971 |
| H2 | 覆盖率 ≥ 80%/75%/80%/80%（thresholds 升级后 ≥ 84/75/84/84）| ✅ 84.92%/79.57%/91.68%/84.92% |
| H3 | 4 项独立命令全 PASS | ✅ |
| H4 | push feature 分支成功 | （由后续步骤完成）|
| H5 | CI workflow 第一次运行 PASS（自身实证）| （由 push 后填入；详见 §G.1 CI Iteration）|
| H6 | PR 创建建议输出 | （由后续步骤完成）|

参考下限 R1-R8 全 PASS：R1 4 jobs 并行 ✅ / R2 84% 门槛安全 ✅ / R3 cache pnpm store ✅ / R4 PR + push to main ✅ / R5 CONTRIBUTING 追加 ✅ / R6 branch protection 建议 ✅ / R7 测试增量 0 ✅ / R8 业务代码 git diff 0 ✅。

完成项 G1-G24 全 PASS。

### §G.1 CI Iteration 留痕（附加要求 A）

**首次运行结果**：[由 push 后实测填入]

| 第 N 次 | 触发分支 | 4 jobs 状态 | 失败原因（如有）| 修复 commit SHA（如有）|
|---|---|---|---|---|
| 1 | feature 分支 (PR) | ⏳ 待 push 后实测 | - | - |

**修复策略**（如失败）：追加 fix commit（不 rebase / force-push 抹掉失败历史）；ADR-0003 Step 3 段 + 本段同步留痕；PR 描述 ## CI Iteration 段记录。

---

## §H Step 4 衔接预告

Step 4 创建 Dockerfile 多阶段构建 + 非 root + 健康检查 + docker-compose 开发编排。Step 4 严重依赖 Step 3：

- CI 强制门禁已建立（Dockerfile lint 可作为 CI 新 job）
- Phase 10 工作流过渡稳定运行 5 次（Kickoff + Step 0/1/2/3）
- 4 项独立命令 + 84% 门槛已成 PR 必过

Step 4 起草指令独立承接（不在本 Step 范围）。Step 4 是否拆两阶段视具体设计复杂度（Dockerfile 设计影响相对局部）。

**branch protection 配置时机**：本 Step PR 合并到 main 后，用户在 GitHub UI Settings → Branches → main rule 配置（v2 K.3 时序裁决；详见 ADR-0003 Step 3 段 § branch protection 建议）。

---

## §I 对作品级代码库的意义

### I.1 拆两阶段流程在普通 Step 级别首次实证

前 3 次拆两阶段实战均 Phase 启程级或复杂 Step 级；本 Step 是**普通 Step 级别首次**。v1 → v2 修订 2 项（K.3 时序 + node-version 显式）证明拆两阶段流程的实证价值不限于 Phase 启程或拆复杂 Step——CI workflow 设计影响 Phase 10 全程 + Phase 11+ 持续，用户审视让设计稳健。

### I.2 元规则 Q v3 模板从"贡献者自觉"升级为"CI 强制不可绕过"

Step 0 元规则 Q v3 模板首次完整实战（4 项独立命令）+ Step 1/2 沿用；本 Step CI 强制门禁让"提交 CI 绿但本地跑不起来"不可能（《补充文档》§13.1 严禁兑现）。Tianqi 工程纪律从"事前防御机制"层面进一步升级为"自动验证不可绕过"层面。

### I.3 CI 第一次运行的实证场景

本 Step PR 是 CI workflow 配置的第一次实证；CI 通过即配置正确——这是工程纪律的运行时证据。即使 CI 第一次失败（force-push 不抹掉失败历史；追加 fix commit）也成为"诚实评估"工程纪律的实证案例。

### I.4 K.3 branch protection 鸡生蛋问题的工程裁决

v1 草案 AI 建议"PR 合并前 UI 配置让本 PR 实证"看似合理；用户 v1 → v2 修订揭示鸡生蛋问题——GitHub Require status checks 下拉列表只在 workflow 至少在 main 跑过一次后才有 status check 名称可选。这是拆两阶段流程实证价值的具体证据：**没有用户审视，AI 草案的"看似合理建议"可能引入实施时无法克服的工程矛盾**。

### I.5 Phase 10 协作基础 → 工程化建设主题转换

Phase 10 协作基础（Kickoff + Step 0 + 1 + 2）落地完成；本 Step 启动工程化建设主题（CI / 容器化 / 发布 / 文档 / 收官）。CI 强制门禁是工程化建设第一块砖——为 Step 4-7 的 Dockerfile / 发布自动化 / README / 收官在保护下推进提供基础。

### I.6 主题专注度延续 5 步严守

Phase 10 主题专注度从 Kickoff（启程战）+ Step 0（修复 + 防御）+ Step 1（协作建设）+ Step 2（协作建设）+ 本 Step（工程化建设）连续 5 步严守。本 Step 不创建 Dockerfile（Step 4 责任）/ 不创建发布自动化（Step 5 责任）/ 不修改 README（Step 6 责任）/ 不创建 dependabot.yml（裁决 5 α）；克制 > 堆砌。

---

**Phase 10 / Step 3 完成 — 2026-05-04 ✅**

**Phase 10 工程化建设首战完成**。Step 4（容器化）由独立指令承接；CI 强制门禁在 main 上首次运行后用户在 GitHub UI 配置 branch protection；Step 4+ PR 受 CI + branch protection 强制保护。
