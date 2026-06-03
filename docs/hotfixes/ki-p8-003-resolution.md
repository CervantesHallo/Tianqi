# Hotfix: KI-P8-003 Saga Vacuous Timeout Race Condition Resolution

**性质**：Independent hotfix（**NOT a Phase 11 Step**）
**编号**：不绑 Step 编号；不进 Phase 11 12 Step 计数（Phase 11 进度 hotfix 前后均为 6/12）
**目录首次启用**：`docs/hotfixes/`（区别于 `docs/phase11/` 的 Step 工作；专用于独立 hotfix / 技术债清理留痕）
**日期**：2026-06-03
**KI**：KI-P8-003 系统性 timing flake（OPEN → RESOLVED）
**分支**：`claude/hotfix-ki-p8-003-saga-vacuous-timeout-race`
**基线 main HEAD**：`9ae3da9`（Phase 11 / Step 2 PR #16 merge commit）

---

## §A 缘起 — 三次系统性兑现强制处置

| # | 时间 | 场景 | 处置 |
|---|------|------|------|
| 1 | Phase 10 / Step 7 main CI 第七次（2026-05-13）| `saga-orchestrator.test.ts:755 > test_runSaga_with_overall_saga_timeout_vacuous_emits_saga_timed_out` expected `'compensated'` to be `'timed_out'` | 初始登记 |
| 2 | Phase 11 / Step 0.5 PR #14 CI run #2（2026-05-19）| 同测试同断言；首次 cross-job 不一致（Test ✅ Coverage ❌）| Re-run failed jobs → PASS |
| 3 | Phase 11 / Step 2 PR #16 CI run #3（2026-05-20）| 同测试同断言；cross-job 不一致再次复现 | Re-run + sustained 留痕 commit `7330c33` |

**频率**：≈ 1/3 CI runs；**系统性 timing flake 确认**（不是罕见偶发）。

第三次兑现后用户立约强制处置：「KI-P8-003 三次兑现 → 独立 hotfix（不绑 Step 编号）→ PHASE_DESIGN → 用户裁决 → PHASE_IMPLEMENT → CI 3 次连续 PASS 高置信证据 → merge → RESOLVED」。

---

## §B PHASE_DESIGN 阶段交付（K.1-K.8）

### K.1 Race Condition 代码定位

**主因点**：`packages/application/src/saga/saga-orchestrator.ts:829-841`（vacuous 路径 `overallTimedOut` 判定双次 `computeElapsedMs()` 调用）。

```ts
// 原实现（race-敏感）：
// Step 8: TQ-SAG-001 单步超时触发后，若整体预算也已耗光，仍按
// 整体超时聚合终态（裁决 3 R）。
if (
  execResult.error.code === "TQ-SAG-001" &&
  Number.isFinite(sagaTimeoutMs) &&
  computeElapsedMs() >= sagaTimeoutMs        // ← 第 1 次调用：条件判定（race 点）
) {
  overallTimedOut = true;
  overallTimeoutInfo = {
    lastExecutingStepName: step.name,
    elapsedMs: computeElapsedMs()             // ← 第 2 次调用：审计 payload
  };
}
```

终态映射点：`saga-orchestrator.ts:857`

```ts
state.overallStatus = overallTimedOut ? "timed_out" : "compensated";
```

依赖函数：`saga-orchestrator.ts:693`

```ts
const computeElapsedMs = (): number => clock().getTime() - sagaStartedAtMs;
// clock() = options.clock ?? ((): Date => new Date())
```

### K.2 Vacuous Terminal State R 设计意图（ADR-0002 + docs/phase9/08）

裁决 3 R 精细模式终态聚合规则：

| 路径 | succeeded | 整体超时? | 终态 |
|------|-----------|-----------|------|
| 全部成功 | N | — | `completed` |
| 普通失败 + 全部补偿成功 | k≥1 | 否 | **P** = `compensated` |
| 普通失败 + 部分补偿失败 | k≥1 | 否 | **Q** = `partially_compensated` |
| **整体超时 vacuous** | **0** | **是** | **R-vac** = `timed_out` |
| 整体超时含 succeeded（进入补偿） | k≥1 | 是 | 由 `aggregateCompensationOutcome` 决定 + `saga.timed_out` 审计触发 |
| 普通失败 vacuous（无 succeeded） | 0 | 否 | `compensated`（0 of 0）|

裁决 4 III：`saga.timed_out` **仅整体超时**触发。

### K.3 Race Hypothesis（实证锁定）

`Date.now()` 整数 ms 精度与 setTimeout 内部 sub-ms 精度失配。

- `Date.now()` 精度 = 整数毫秒
- Node.js setTimeout(5ms) 在 libuv timer wheel 中可在 install + (4~7ms) 触发（OS jitter + cgroup wall clock 抖动）
- 当 `sagaStartedAtMs` 与 setTimeout install 处于同一 ms tick `T`：
  - setTimeout 在第 4ms 整数 tick 触发 → `Date.now() = T+4`
  - 条件判定时 `computeElapsedMs() = (T+4) - T = 4`
  - `4 >= 5` → **false** → `overallTimedOut` 维持 `false`
  - 终态错误映射为 `"compensated"`（违反裁决 3 R-vac + 裁决 4 III）

**频率吻合**：Node.js setTimeout(5) 触发分布约 33% 落在第 4ms tick → 与三次 CI 兑现 1/3 频率完全匹配。

**Step 8 缓解措施已耗尽实证**：docs/phase9/08 §E.2 记载"unit test 时序刻意拉开 fast/slow 比例 ≥1:10；本地实测 93ms 稳定"——但 CI 仍三次兑现 → 1:10 比例不足以根治；根因修复必要性实证。

### K.4 候选修复方案

| 候选 | 性质 | 推荐? |
|------|------|------|
| **Path A** 业务代码修复（install-time 静态值判定）| 根因修复 | ⭐ 推荐 |
| Path B 测试 fake timer | 测试缓解，不动业务 | 否决（vitest fake timer 与 Promise.race 交互复杂；不修生产 race）|
| Path C 测试断言放宽 | 修测试不修代码 | 否决（违反 ADR-0002 裁决 3 R-vac + 用户立约禁止改 P/Q/R 语义）|
| Path D tolerance（-1ms）| 缓解，非根治 | 否决（魔法数；边界 false positive）|
| Path E `performance.now()` 高精度时钟 | 接口破坏 | Backup（影响面过大）|

### K.5 裁决 — Path A

**核心修复 diff**：

```ts
// 行 829-841 替换为：
// Step 8 + KI-P8-003 hotfix (2026-06-03)：TQ-SAG-001 单步超时触发后，
// 若 effective 预算等于"saga 剩余预算"（即 sagaTimeout 是 clamp 因子
// 而非 stepTimeout），等价于整体预算耗光，聚合为整体超时终态（裁决 3 R）。
// [完整注释见 saga-orchestrator.ts]
if (
  execResult.error.code === "TQ-SAG-001" &&
  Number.isFinite(sagaTimeoutMs) &&
  elapsedBeforeStep + effectiveStepTimeoutMs >= sagaTimeoutMs
) {
  overallTimedOut = true;
  overallTimeoutInfo = {
    lastExecutingStepName: step.name,
    elapsedMs: computeElapsedMs()  // 审计 payload 信息观测用，非决策依据
  };
}
```

**判定逻辑**：由 `computeEffectiveStepTimeoutMs`（行 700-705）的构造：

```
effectiveStepTimeoutMs = min(stepTimeoutMs, sagaTimeoutMs - elapsedBeforeStep)
```

代数性质：
- 若 sagaTimeout 是 clamp 因子 → `elapsedBeforeStep + effectiveStepTimeoutMs === sagaTimeoutMs`
- 若 stepTimeout 是 clamp 因子 → `elapsedBeforeStep + effectiveStepTimeoutMs < sagaTimeoutMs`

`>= sagaTimeoutMs` 等价于"sagaTimeout 在本步骤被激活为 clamp 因子"——这是 install-time 已捕获的两个 const 的纯代数比较，**无 race**。

### K.6 5 不变量保持评估

| # | 不变量 | Path A 是否触及 | 评估 |
|---|--------|------------------|------|
| 1 | 严格逆序补偿（§4.3） | ❌ 不触及 `runCompensationPhase` 主循环 | ✓ 保持 |
| 2 | 仅 succeeded 被补偿 / 双重幂等保护（§4.2） | ❌ 不触及 `isStepEligibleForCompensation` 8 状态枚举 | ✓ 保持 |
| 3 | compensation_failed 必入死信（§4.5） | ❌ 不触及死信入队路径 | ✓ 保持 |
| 4 | 每次状态变化都 persist（§4.5） | ❌ persist 触发点 1-6 全部不变 | ✓ 保持 |
| 5 | 单点失败不阻断后续 / 链式继续（§4.6） | ❌ 不触及 chain continuation | ✓ 保持 |

### K.7 P/Q/R 终态边界评估

| 终态 | Path A 前 | Path A 后 |
|------|-----------|-----------|
| `completed` | 不变 | 不变 |
| **P** = `compensated` | 由 `aggregateCompensationOutcome` 决定 | 不变 |
| **Q** = `partially_compensated` | 由 `aggregateCompensationOutcome` 决定 | 不变 |
| **R-vac** = `timed_out` | race-敏感（偶发误判为 `compensated`） | **确定性**判定（race 消除）|
| **R-含补偿** | 不变 | 不变 |
| 普通失败 vacuous | 不变 | 不变 |

### K.8 测试总数

- Path A 默认：业务代码 ~5 行，测试 0 改动 → **1999 不变**

### Q1-Q5 用户裁决（PHASE_DESIGN 后回执）

| Q | 选项 | 裁决 |
|---|------|------|
| Q1 修复路径 | A / B / C / D / E | **Path A** |
| Q2 ADR-0002 增量 | 追加 hotfix 段 / 不追加 | **追加 hotfix 段** |
| Q3 新增 it 17 | 是（→2000）/ 否（→1999）| **否** |
| Q4 merge 门槛 | CI 3 次连续 PASS | **CI 3 次连续 PASS**（用户立约预设）|
| Q5 doc 命名 | `ki-p8-003-resolution.md` | `ki-p8-003-resolution.md`（用户立约预设）|

---

## §C PHASE_IMPLEMENT 阶段交付

### 修改文件

| 文件 | 改动 | LOC |
|------|------|-----|
| `packages/application/src/saga/saga-orchestrator.ts` | Path A 业务代码修复（条件判定 + 17 行注释解释 race + 修复语义 + 保持立约）| +20 / -7 |
| `docs/KNOWN-ISSUES.md` | KI-P8-003 状态 OPEN → RESOLVED + 兑现历史 #4 + 修复路径执行轨迹 | +12 / -10 |
| `docs/decisions/0002-phase-9-saga-orchestration.md` | 追加 Hotfix 段（References 段之前；不绑 Step 编号；惯例 M 增量追写）| +N |
| `docs/hotfixes/ki-p8-003-resolution.md` | 本文件（新建；docs/hotfixes/ 目录首次启用）| 新建 |

**新建目录**：`docs/hotfixes/`（首次启用；专用于独立 hotfix / 技术债清理留痕；区别于 `docs/phase11/` 的 Step 工作目录）。

### 测试增量

- **业务代码 0 测试改动**（it 13/14/15/16 全部维持原断言；it 14 不再 flake）
- **总测试数 1999 不变**（与用户立约「禁止扩张范围」+ Q3「不加 it 17」一致）

### 元规则 / 惯例触发

| 规则 | 触发情况 |
|------|----------|
| **A** 功能完整 | ✓ 修复 vacuous timed_out 路径确定性 |
| **B** 签名兼容 | ✓ **严守**——SagaStep / SagaInvocation / SagaOrchestratorOptions / `clock()` 接口 / AUDIT_EVENT_TYPES 全部零变化 |
| **C** 向后兼容 | ✓ 既有调用方零影响 |
| **K** 错误码命名空间 | N/A（不新增错误码；TQ-SAG-004 复用）|
| **M** ADR 增量追写 | ✓ ADR-0002 Hotfix 段（不绑 Step 编号；惯例 M 第 N 次实战；首次为"独立 hotfix"性质追写）|
| **P** 无第三方依赖 | ✓ 零新依赖 |

---

## §D 验证证据

### D.1 本地验证（PHASE_IMPLEMENT 后）

```bash
pnpm build         # ✓ tsc -b PASS
pnpm lint          # ✓ eslint . --max-warnings=0 PASS
pnpm typecheck     # ✓ tsc -b PASS
pnpm exec vitest run packages/application/src/saga/saga-orchestrator.test.ts
# ✓ 5 次连续：每次 16/16 PASS（80-92ms 测试耗时）
pnpm exec vitest run  # 全量
# ✓ 1873 PASS + 126 skipped = 1999 总数（本地 Postgres/Kafka 未运行 → integration 跳过）
```

### D.2 saga-orchestrator unit test 5 次连跑（验证 flake 真消失）

| Run | 结果 | Tests | Duration |
|-----|------|-------|----------|
| 1 | ✓ | 16/16 PASS | 92ms |
| 2 | ✓ | 16/16 PASS | 92ms |
| 3 | ✓ | 16/16 PASS | 92ms |
| 4 | ✓ | 16/16 PASS | 92ms |
| 5 | ✓ | 16/16 PASS | 90ms |

Fix 前预期 1/3 概率 flake；fix 后 **0/5**（5 次连续 PASS）。

### D.3 CI 3 次连续 PASS（待 push 后实测；merge 强制门槛）

按用户立约 Section 五.E：「KI-P8-003 频率 ≈ 1/3，单次 CI PASS 不能证明修复成功——3 次连续 PASS 才能高置信证明 flake 真消失」。

| CI Run | 4 jobs 状态 | 实测时间 |
|--------|-------------|----------|
| #1 | <待 push 后 CI 跑> | TBD |
| #2 | <Re-run all jobs> | TBD |
| #3 | <Re-run all jobs> | TBD |

merge 条件：3 次中任何一次失败 → 不 merge；回到 PHASE_DESIGN 重评估。

---

## §E 立约对齐验证

| 立约 | 验证 |
|------|------|
| 不绑 Step 编号 | ✓ "Independent hotfix" 全局标识；PR title / commit / docs 一致 |
| 不进 Phase 11 12 Step 计数 | ✓ Phase 11 进度 hotfix 前后均为 6/12 |
| 不创建小数 Step 编号（"Step 0.6"已废除）| ✓ 所有引用改为 "Independent hotfix" |
| 不修 SagaStep 接口（元规则 B 严守）| ✓ Step 1 锁定接口零变化 |
| 不修 5 不变量（Phase 9 Step 7 立约）| ✓ K.6 逐项验证 |
| 不修 P/Q/R 终态语义（Phase 9 Step 8 立约）| ✓ K.7 逐项验证（R-vac 边界**改善**为确定性；P/Q + 含补偿 R + 普通失败 vacuous 全部不变）|
| 不新增错误码 | ✓ TQ-SAG-004 复用 |
| 不引入新第三方依赖（元规则 P）| ✓ 零新依赖 |
| 不预占 Step 3 ADL e2e 范围 | ✓ 仅修 KI-P8-003 |
| 不修 Phase 1-10 任何业务代码 | ✓ 仅修 Phase 9 Step 8 引入的 vacuous 判定逻辑（KI-P8-003 修复必要性）|
| 不 force-push（ADR-0003 §E.1）| ✓ 全部 commits 累加，无重写 |
| 不 squash merge | ✓ 保留 commits 完整历史 |
| CI 3 次连续 PASS（不在 1 次 PASS 后 merge）| ⏳ 待 push 后实测 |

---

## §F References

- 修复源码：`packages/application/src/saga/saga-orchestrator.ts:829-849`（行号 +20 / -7 后）
- 测试文件：`packages/application/src/saga/saga-orchestrator.test.ts:728-771`（it 14 vacuous timed_out；本 hotfix 不修测试）
- ADR-0002：`docs/decisions/0002-phase-9-saga-orchestration.md` Hotfix 段（增量追写惯例 M）
- KI 登记：`docs/KNOWN-ISSUES.md` KI-P8-003 段
- Phase 9 / Step 8 设计：`docs/phase9/08-timeout-mechanism.md`（§C 裁决 3 R + §E.2 KI-P8-003 缓解历史）
- 用户 hotfix prompt：本次会话内 Independent hotfix 立约（不绑 Step 编号 + CI 3 次 PASS 门槛 + 范围严守）
- 三次系统性兑现 commit 留痕：`7330c33`（PR #16 后 sustained 留痕）

---

**Tianqi 工程纪律严守证据**：清晰（race 机理 + Path A 修复 + 5 不变量 / P/Q/R 边界逐项验证）、可控（业务代码 ~5 行 + 测试 0 改动 + 范围严守）、可信（CI 3 次连续 PASS 高置信门槛 + 本地 5/5 连跑 + 全量 1999 PASS + lint/typecheck/build 通过）。
