# Tianqi Phase Closure Checklist

任何 Phase 收官 Step 起草指令必须明示以下 checklist。本文档自 **Phase 10 / Step 0** 起永久生效（KI-P10-001 修复完成时建立）。

## 4 项独立命令实测输出（元规则 Q v3 模板核心）

每个 Phase closure Step 必须独立执行以下 4 项命令并各自记录实测输出：

| # | 命令 | 期望 | Phase 9 closure 实际 | Phase 10 起 |
|---|---|---|---|---|
| 1 | `pnpm lint` | 0 错误 / 0 警告 | ✅ 实测留痕 | ✅ 强制 |
| 2 | `pnpm typecheck` | 0 错误 | ❌ **未实测**（KI-P10-001 根因）| ✅ **强制独立实测** |
| 3 | `pnpm test` | 测试总数 ≥ 各 Phase 下限 + 全绿 | ✅ 实测留痕 | ✅ 强制 |
| 4 | `pnpm test:coverage` | 覆盖率 ≥ 各 Phase 门槛 | ✅ 实测留痕 | ✅ 强制 |

**关键纪律**：禁止用单一命令（譬如 `pnpm test:coverage`）的"顺带验证"替代独立 `pnpm typecheck` 验证。`vitest` 默认不严格 typecheck 测试文件（type-erasure 阶段忽略类型不匹配），独立 `tsc -b` 才暴露错误。

## Phase closure 报告必含项

收官 Step 执行报告 §F / §G 必须含：

- **4 项命令各自实测输出** — 不是聚合"全绿"声称；每项独立记录命令 + 退出码 + 关键摘要
- **ADR Status 升级** — `In Progress` → `Accepted (Phase X CLOSED, YYYY-MM-DD)`（沿用 ADR-0001 / ADR-0002 格式）
- **KI 状态最终评估** — 每个 open KI 显式核查（实测复核 + 修复责任 Phase 调整 + 状态 carried over / closed / 新增）
- **CHANGELOG 撰写** — Phase 段含 7 个 `###` 子段（Added / Changed / Architecture / Quality / Engineering Discipline / Known Issues / References / Compatibility；沿用 Phase 8/9 格式）
- **git tag 创建** — `phase-N-closed`（沿用 Phase 9 / Step 19 建立的命名约定；annotated tag with Phase 主题摘要）
- **Phase CLOSED 显式声明** ≥ 4 处 — ADR Status + CHANGELOG 段标题 + closure 执行记录顶部 + mapping CLOSED 段（≥3 是补充文档 §15 硬底；建议 ≥4 含 git tag annotated message）

## 修复责任传递规则

- 收官 Step 不修复任何 KI（除非 Phase 主题专属 KI）
- 收官 Step 发现的新缺陷必须登记新 KI（不为"全绿声称"而隐瞒）
- 收官 Step 发现的修复责任 Phase 调整必须经 ADR 修订流程留痕

## 历史教训沉淀

**KI-P10-001 教训**（Phase 9 closure 隐藏 typecheck 缺陷）：

- **发现**：Phase 10 Kickoff PHASE_IMPLEMENT 实测 `pnpm typecheck` FAIL；errors 预存在于 Phase 9 / Step 19 final commit `c9ebe88`
- **根因**：Phase 9 / Step 17/18/19 closure 验证执行报告显示 "lint zero / 1971 tests / coverage..."——**未明示 `pnpm typecheck` 实测**；vitest 默认不严格 typecheck 让 Step 16 引入的 saga-end-to-end.integration.test.ts 中 10 处 mock builder 字段不匹配绕过 closure 验证
- **修复**：Phase 10 / Step 0（本 Step）修复 fixture + 建立本 checklist + ADR-0003 元规则 Q v3 模板含动作 5 强制
- **防御**：自 Phase 10 起每个 Phase closure Step 起草指令必须含本 checklist；CI 强制门禁（Phase 10 / Step 3 建立）含 typecheck 独立验证；元规则 Q v3 模板每 Step 强制开局动作 5 含 4 项独立命令实测输出

**关键认知**：工程纪律不仅在"事后诚实留痕"层面有效，更在"事前防御机制"层面强化——本 checklist 是这一升级的标志性文档。

## 既有资产核查防御（Phase 10 / Step 1 教训）

任何 Step 强制开局动作中的"既有资产核查"必须使用以下双重命令，不允许仅用 `ls` 或单一 `grep` 替代：

- `git status --untracked-files=all` — 捕获先前 session 残留的未追踪文件
- `git ls-files <path>` — 列出已追踪文件以对比

**根因**：Step 1 实测发现 `CONTRIBUTING.md` 已作为未追踪文件存在（先前 session 残留）；若仅用 `ls` 核查会发现文件而误判为"无需创建"或"覆盖既有"——双重命令让"未追踪文件"与"已追踪文件"分别可见。

## 维护规则

- 本 checklist 不超 100 行（克制；只列硬性必含项，不展开理论）
- 本 checklist 由 Phase closure Step 起草指令引用，不直接修改 checklist 内容
- 本 checklist 修订必须经 ADR 修订流程（避免静默漂移）

## 引用与协调

- 元规则 Q v3 模板：`docs/decisions/0003-phase-10-engineering-and-collaboration.md` 强制开局动作模板段
- 错误码命名约定：补充文档 §6.4
- 覆盖率门槛：补充文档 §9.3（Phase 10 起 85%）
- 测试数量底线：补充文档 §9.4（Phase 9 起 ≥ 1700）
- ADR Status 格式：参照 ADR-0001 + ADR-0002 既有约定

---

**首次生效**：Phase 10 / Step 0（KI-P10-001 修复完成时；2026-05-XX）
**未来修订入口**：ADR 修订流程（不允许静默修改）
