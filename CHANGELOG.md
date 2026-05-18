# Changelog

All notable changes to Tianqi (天启) are documented in this file. The repository
uses Phase-based release cycles (Phase 1-7 conclude internally; Phase 8 onwards
is what an external reader can pick up). This file follows the spirit of
[Keep a Changelog](https://keepachangelog.com/) but is keyed by Phase rather
than semver.

## [Phase 10] — 2026-05-13 — Engineering and Collaboration Foundation

> **2026-05-18 校正补丁**（Phase 11 Kickoff v3 §B.1.B 第 4 层防御机制）：本段原标 "Phase 10 — 2026-05-05" 为 Step 7 PHASE_IMPLEMENT 完成日（撰写时锁定）。真实 CLOSED 仪式日期 **2026-05-13**（PR #10 merge `cc74da3` + main CI 4/4 PASS + `phase-10-closed` tag `ab70043` push + release.yml 第一次真实运行 + GitHub Release published；间隔 8 天）。详见 ADR-0004 §B.1.B。

The Phase that turns Tianqi from "code complete + business capabilities" (Phase 1-9) into "production-deployable + collaboratable + observable" engineering infrastructure. 8 implementation Steps + 1 Kickoff = 10 PRs (#1-#10) added zero business code, zero new error codes, zero new packages, and only 6 boundary tests (lifting coverage 84.91% → 85.00%) while delivering the four bricks of engineering infrastructure.

### Engineering Infrastructure (4/4 完成)

- **CI strict gate** (Step 3 + 3.5): GitHub Actions workflow with 4 parallel jobs (lint / typecheck / test / coverage); 84% → 85% coverage threshold upgrade in Step 7; **double-defect-chain fix** (KI-P10-001 typecheck-layer + KI-P10-002 packaging-layer) as honest留痕 of "未在干净环境验证过的真绿色" baseline before Phase 10
- **Containerization** (Step 4): Multi-stage `Dockerfile` (`node:22-slim` + `USER node` + `HEALTHCHECK`); `docker-compose.yml` single-service development orchestration; runtime image ~508MB
- **Release automation** (Step 5): `phase-*-closed` tag-triggered `release.yml` via `gh release create` CLI (元规则 P 在"有 GitHub 官方等价物"场景严守); draft GitHub Release with auto-extracted CHANGELOG section; **第三方 action 严格度判断** 4-类型沉淀
- **Documentation** (Step 6 + Step 7): `README.md` rewritten 274 → 94 lines with engineering infrastructure overview; `docs/runbook.md` 125 lines covering deployment / configuration / health / troubleshooting / rollback; `CONTRIBUTING.md` trimmed 104 → 96 lines (Step 5 honest留痕承接兑现)

### Collaboration Assets (7/7 完成)

- `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md` / `SECURITY.md` (Step 1; project-level)
- `.github/PULL_REQUEST_TEMPLATE.md` / `.github/ISSUE_TEMPLATE/*` / `.github/CODEOWNERS` (Step 2; GitHub-platform)
- `README.md` / `CHANGELOG.md` (Step 6 / Phase 9; project-level)

### Workflow Transition

Phase 10 起 feature-branch + PR + merge-commit 工作流（Phase 1-9 直接 main）；累计 10 PRs (#1-#10) 全部 merge commit 合并保留迭代历史。拆两阶段流程实战 6 次（Phase 9 / Step 6 + Step 14 + Phase 10 / Kickoff + Step 3 + Step 3.5 + Step 5）；Phase 启程级 + 普通 Step 级别均被验证。

### Resolved Known Issues

- **KI-P10-001** (typecheck layer): saga-end-to-end fixture 与 Engine Port 类型对齐 (Step 0; vitest type-erasure 绕过的 typecheck 缺陷)
- **KI-P10-002** (packaging layer): root `build` script + `ci.yml` `pnpm build` step; `CONTRIBUTING` + `closure-checklist` 防御 (Step 3.5; dist-based workspace 在 fresh checkout 下不工作)
- **Double-defect-chain repair complete** — Tianqi 进入"干净环境真绿色"成熟度

### Open Known Issues (Phase 11+ 承接)

| KI | Topic | Owner Phase |
|---|---|---|
| KI-P8-001 | domain coverage 75.16% | Phase 13+ TBD |
| KI-P8-002 | 真实基础设施测试 (postgres / kafka) | Phase 11 |
| KI-P8-003 | 时序 flake (high-concurrency) | Phase 11 (with KI-P8-002) |
| KI-P8-005 | ports coverage 11.96% | structural / N/A |
| KI-P9-001 | StateTransition Saga 数据副本漂移 | Phase 10+ ongoing monitoring |

### Engineering Discipline Distillation

- 元规则 Q v3 模板（4 项独立命令实测输出）实战 10 次（Kickoff + Step 0/1/2/3/3.5/4/5/6/7）
- 拆两阶段流程实战 6 次（双层 PHASE_DESIGN/IMPLEMENT 流程在 Phase 启程 + 普通 Step 都被验证）
- 惯例 M（ADR 增量追写）跨 Phase 第 8 次实战；ADR-0003 总长 ~700 行（远低于 800 拆分阈值）
- "引用而不复制"纪律延伸到 README + Runbook + ADR-0003
- "未在干净环境验证过的真绿色" 措辞校正（避免 Phase 1-9 work 不公平污名）
- 第三方 action 严格度判断 4 类型 + 判断顺序沉淀（Phase 11+ 沿用基础）

### Test & Coverage

- Tests: 1971 → **1977** (+6 boundary tests in Step 7 covering lifecycle-continuity uncovered branches)
- Coverage: 84.91%/79.5%/91.68%/84.91% → **85.00%/79.63%/91.68%/85.00%**（lines/functions/statements 84 → 85；branches 维持 75；K.2 锁定路径 B 兑现）

### References

- ADR-0003: `docs/decisions/0003-phase-10-engineering-and-collaboration.md` (Status: Accepted Phase 10 CLOSED 2026-05-13)
- Phase 10 execution records: `docs/phase10/00-phase-10-kickoff.md` through `09-step-7-closure.md`
- Closure checklist: `docs/closure-checklist.md`
- Workflows: `.github/workflows/ci.yml` + `.github/workflows/release.yml`
- Containerization: `Dockerfile` + `docker-compose.yml`

### Compatibility

Zero breaking changes. Phase 1-9 production layers (domain / policy / shared / ports / adapters) remain byte-for-byte unchanged. Engine Port 类型签名零修改 (元规则 B 跨 Phase 10 严守). Test increment is +6 boundary tests on existing application-layer code; no new functions / types / error codes / packages.

### Phase 11+ Forward-Looking

- docker push 决策（Phase 11 起草指令必含; Step 5 K.3 强化承接）
- 真实基础设施测试（KI-P8-002 / KI-P8-003 修复责任）
- HEALTHCHECK 升级真实 HTTP endpoint（Step 4 段 Phase 11+ 承接事项）
- production deps 优化（pnpm deploy / prune --prod; runtime image 大小优化）
- 未来非数字 tag 评估（譬如 sprint-N-closed; Step 5 K.4 承接）
- coverage 进一步提升（Step 7 lines/statements 85.00% 安全裕度紧；v8 噪声偶发可能让 CI 红色 → Phase 11+ 加测试或登记 KI）

---

## [Phase 9] — 2026-05-02 — Saga Orchestration Architecture

The Phase that turns Tianqi from "infrastructure landed" (Phase 8) into "saga
orchestration delivered + 4 business sagas instantiated + cross-saga coordination
+ compile-time §4.8 enforcement". 19 Steps across 4 Sprints (F–I) added 7 saga
modules, 4 persistence Adapter packages, 11 new error codes, and 303 tests, while
leaving every Phase 1-7 production layer (domain / policy / shared) byte-for-byte
unchanged.

### Added

- **7 saga modules** (all in `packages/application/src/saga/`):
  - **Sprint G core orchestrator + manual intervention**:
    - `saga-orchestrator.ts` — SagaOrchestrator with 7 audit event types,
      6 persist trigger points, 5 invariants for reverse compensation,
      single-step + overall saga timeout (Step 6-8)
    - `saga-manual-intervention.ts` — §15.1 dual-audit (REQUESTED + APPLIED
      events) + dual-signature (requestedBy ≠ approvedBy) workflow (Step 9)
  - **Sprint H 4 business sagas** (template proven bidirectionally reusable;
    all share `LiquidationSagaPorts` type alias):
    - `liquidation-saga.ts` — 5-step margin liquidation (Step 10, sprint kickoff)
    - `adl-saga.ts` — multi-account fair deleveraging + insurance fund linkage
      (Step 11, high-complexity validation +1.2% LOC)
    - `insurance-fund-saga.ts` — single-account loss coverage in 4-step
      compact mode (Step 12, low-complexity validation -15.7% LOC)
    - `state-transition-saga.ts` — risk case state machine progression with
      0-N dynamic engine consumption (Step 13, extreme-low-complexity
      validation -6.9% LOC)
  - **Sprint H 5 cross-saga coordination**:
    - `cross-saga-coordination.ts` — `checkActiveSagaForCase` query + explicit
      `SAGA_ID_NAMING_CONVENTION` constant + `parseSagaIdToInfo` pure helper +
      `onDegradedFailure` callback (Step 14, two-phase design v1→v2 revision
      promoted sagaId convention from "de facto" to "explicit + helper")
- **4 persistence Adapter packages** (workspace count: 21 → 25):
  - `@tianqi/saga-state-store-{memory,postgres}` (Sprint F Step 3)
  - `@tianqi/dead-letter-store-{memory,postgres}` (Sprint F Step 4)
- **3 new Ports** in `packages/ports/`:
  - `saga-port.ts` (Step 1) — 11 types + 2 brand factories + 5 contract test
    families (Step 2 `defineSagaContractTests` 17 it × 4 business sagas + 1
    base = 85 contract assertions)
  - `saga-state-store-port.ts` (Step 3) — 4-method interface (save / load /
    listIncomplete / delete) + persistent contract function
  - `dead-letter-store-port.ts` (Step 4) — 5-method interface (enqueue / load
    / listPending / listBySaga / markAsProcessed) + persistent contract function
- **11 new error codes** in two namespaces:
  - `TQ-INF-019..024` — 6 codes for saga-state-store / dead-letter-store
    lifecycle failures (NOT_INITIALIZED / ALREADY_SHUT_DOWN /
    SCHEMA_VERSION_MISMATCH × 2)
  - `TQ-SAG-001..005` — 5 codes for saga semantics (SAGA_STEP_TIMEOUT /
    SAGA_STEP_EXECUTION_FAILED / SAGA_STEP_COMPENSATION_FAILED /
    SAGA_OVERALL_TIMED_OUT / SAGA_MANUAL_INTERVENTION_FAILED)
- **9 new audit event types** (frozen via meta-rule B at audit layer):
  - 7 saga orchestrator events: `saga.started` / `saga.step.execute.outcome` /
    `saga.compensation.started` / `saga.step.compensate.outcome` /
    `saga.dead_letter.enqueued` / `saga.completed` / `saga.timed_out`
  - 2 manual intervention events: `saga.manual_intervention.requested` /
    `saga.manual_intervention.applied`
- **Compile-time §4.8 enforcement** (Step 15): ESLint
  `no-restricted-imports` rule on `packages/domain/**/*.ts` + TypeScript
  project references isolation (domain tsconfig deliberately omits ports
  reference). Error message references "Phase 9 §4.8 hard compile-time
  constraint" + ADR Step 15 path for traceability.
- **End-to-end integration test suite** (Step 16):
  `saga-end-to-end.integration.test.ts` (8 it × 4 capability classes —
  forward / failure compensation / timeout compensation / dead letter +
  manual intervention + cross-saga coordination). Single-run 12 ms,
  fast/slow ≥ 1:10 timing-flake defense (KI-P8-003 mitigation).

### Changed

- **Test count**: 1668 → **1971** (+303)
- **Workspace packages**: 21 → 25 (+4 Sprint F persistence Adapter packages)
- **Aggregate coverage**: 85.97%/79.78%/94.86%/85.97% (Phase 8 baseline) →
  **84.92% lines / 79.57% branches / 91.68% functions / 84.92% statements**
  (Phase 9 final). All four metrics remain above §9.3 thresholds (80%/75%/80%/80%).
  Slight downward drift attributed to 2 new postgres Adapters CI-skipped by
  default (KI-P8-002 carried over) + 3 new Port files predominantly type-only.
- **Phase 9 saga modules coverage**: all ≥ 80% lines.
  `cross-saga-coordination.ts` highest at **97.84%** (v2 helper-rich design);
  saga-orchestrator 90.41% / saga-manual-intervention 89.51% / liquidation-saga
  87.25% / adl-saga 86.44% / insurance-fund-saga 85.45% / state-transition-saga
  85.29%.
- **Error code total**: 74 → **84** (+10: TQ-INF-019..024 + TQ-SAG-001..005;
  TQ-CON unchanged at 001-014).

### Architecture

- **Saga orchestration core layered architecture**:
  - Layer 0 — Persistence (Sprint F): SagaStateStorePort + DeadLetterStorePort
    + memory/postgres Adapters
  - Layer 1 — Orchestrator + manual intervention (Sprint G): SagaOrchestrator
    with 5 invariants + single-step + overall timeout + saga.timed_out audit
  - Layer 2 — Business saga instances (Sprint H Step 10-13): 4 business sagas
    consuming Sprint G + Phase 8 5 business engines
  - Layer 3 — Cross-saga coordination (Sprint H Step 14): query-only
    coordination over saga state via listIncomplete + sagaId-prefix parsing
- **Sprint H business saga template** proven bidirectionally reusable across
  three complexity scales: Step 11 high (+1.2% LOC vs Step 10 baseline) /
  Step 12 low (-15.7%) / Step 13 extreme-low (-6.9%). All four business sagas
  share `LiquidationSagaPorts` type alias (zero new Port introduction across
  Step 11-13).
- **Independent / transparent orchestration** (META-RULE F): 6 saga modules
  (saga-orchestrator + saga-manual-intervention + 4 business sagas +
  cross-saga-coordination) maintain `git diff zero` against `origin/main`
  across Steps 9-14 — orchestrator never modified once business sagas
  consume it.
- **§4.8 dual-layer enforcement** (Step 15): ESLint provides IDE-time red
  underline; TypeScript project references provide CI-time hard rejection.
  Single-mechanism failure modes (ESLint disabled / tsconfig refs accidentally
  added) are mutually defended.
- **Two-phase design flow** (DRAFT → user review → APPROVE → IMPLEMENT)
  validated twice: Step 6 SagaOrchestrator audit events 5→7 revision (avoiding
  Step 8 forced extension); Step 14 cross-saga-coordination v1→v2 sagaId
  convention promotion from de-facto to explicit + helper (avoiding silent
  failure as hidden hazard).

### Quality

- **5 contract test families** continue to pass:
  `defineSagaContractTests` (17 it × 4 business sagas + 1 base = 85 contract
  assertions); `definePersistentSagaStateStoreContractTests`,
  `definePersistentDeadLetterStoreContractTests`, plus inheriting Phase 8
  contract families.
- **End-to-end integration test runtime**: 12 ms single-run for the 8-it
  cross-capability suite — well under the 30 s G24 ceiling.
- **Production-layer changes**: zero through all 19 Steps (domain / policy /
  shared / existing Adapters all untouched).

### Engineering Discipline

Phase 9 forged 1 new meta-rule (Q) and 1 new convention (M), each grown from a
real conflict during the 19 Steps (running total: 15 meta-rules A–Q, 3
conventions K/L/M). Highlights:

- **META-RULE B (interface freeze)** cross-Step enforcement, peak case:
  Step 1 froze `SagaInvocation.sagaTimeoutMs` as a placeholder, Step 8
  activated it 7 Steps later without changing one character. Step 6 froze
  the SagaOrchestrator interface; Step 7/8/9 added three rounds of
  enhancement (compensation engine + timeout + manual-intervention hooks)
  without modifying the locked surface.
- **META-RULE F (independent / transparent orchestration)** validated 6
  times across Step 9-14: saga-manual-intervention (Step 9 zero
  saga-orchestrator imports); 4 business sagas (Step 10-13 consuming
  saga-orchestrator via factory closures, never modifying it); cross-saga-
  coordination (Step 14 zero imports of any business saga module).
- **META-RULE Q (mandatory startup procedure)** introduced in Step 1 and
  applied 19 times — every Phase 9 Step re-reads the constitution +
  supplement + KNOWN-ISSUES + ADR-0001 + ADR-0002 before starting any work.
- **CONVENTION K (error codes "only when necessary")** applied 18 times,
  delivering precisely the 10 codes the interface demanded — Sprint H 5
  Steps and Sprint I 5 Steps each accumulated 0 new codes (template
  discipline + no-business-functionality discipline upheld).
- **CONVENTION M (ADR incremental authoring)** introduced and applied 19
  times — ADR-0002 grew incrementally per Step (final 3859 lines, 14× longer
  than ADR-0001) rather than as a single end-of-Phase write. The
  retrospective on Phase 8's single-shot ADR authoring was the rule's
  origin; Phase 9's experience confirms incremental authoring scales
  better for long Phases.
- **Two-phase design flow** introduced as a workflow tool (not yet a
  meta-rule) and applied 2 times (Step 6 + Step 14) — both produced
  user-driven revisions that prevented downstream lock-in (audit-event
  expansion in Step 8; sagaId-convention silent failure in Step 14
  long-run).

The full meta-rule and convention set, plus 18 Step-level decisions and
their rejected alternatives (~120+ rejected candidates documenting "克制
> 堆砌" discipline), is documented in
`docs/decisions/0002-phase-9-saga-orchestration.md`.

### Known Issues

5 items registered in `docs/KNOWN-ISSUES.md`, all currently open:

| ID        | Status                          | Owning Phase           | Summary                                                                                                                                                                |
| --------- | ------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KI-P8-001 | open (carried over; unchanged)  | Phase 10               | `domain` package line coverage stuck at 75.16% — Phase 9 §4.8 + meta-rule B kept domain tests untouched. Honest assessment: not improved.                              |
| KI-P8-002 | open (carried over; consistent) | Phase 11               | `event-store-postgres` + `notification-kafka` + Phase 9's new `saga-state-store-postgres` + `dead-letter-store-postgres` all CI-skipped without `TIANQI_TEST_*` env vars |
| KI-P8-003 | open (Phase 9 实战 0 flake)     | Phase 11               | Timing-flake risk; Phase 9 12-ms end-to-end suite + fast/slow ≥ 1:10 defense kept Phase 9 实战 0 reported flakes, but the 12-ms runtime is insufficient stress.        |
| KI-P8-005 | open (partial improvement)      | N/A (structural)       | `packages/ports/src/` line coverage 0% → **11.96%** (Phase 9 added saga-port.ts at 100% covered + brand factories of two new Ports). Structural reality unchanged.    |
| KI-P9-001 | open (NEW; ongoing monitoring)  | Phase 10+ (monitoring) | StateTransition Saga's `stateTransitionRules` data-replica risks drifting from domain `transitionRules`. Mitigations: PR-description discipline + future ESLint check + long-term shared-package extraction. |

### References

- **Architecture Decision Record**: [`docs/decisions/0002-phase-9-saga-orchestration.md`](docs/decisions/0002-phase-9-saga-orchestration.md)
  (Accepted, Phase 9 CLOSED 2026-05-02; 3859 lines)
- **Phase 9 closure record**: [`docs/phase9/19-phase-9-closure.md`](docs/phase9/19-phase-9-closure.md)
- **Per-step execution records**: `docs/phase9/01-19` (19 documents, one per Step)
- **Phase 1 → 9 mapping**: [`docs/00-phase1-mapping.md`](docs/00-phase1-mapping.md)
- **Saga module index**: `packages/application/src/saga/` (7 modules + 17 tests)
- **Known issues**: [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md)

### Compatibility

Phase 9 introduces **zero breaking changes** for Phase 1-7 / Phase 8 consumers.
Every Phase 1-7 domain type, every Phase 8 Port shape, every Phase 8 error code
is preserved byte-for-byte. The 7 new saga modules are additive; nothing in
existing layers needed to import them. Phase 10+ application code can begin
consuming `SagaOrchestrator` / business sagas / `CrossSagaCoordination` directly
— that work is explicitly out of scope for Phase 9.

The §4.8 ESLint rule additions are net-restrictive: they reject `domain` →
`ports` imports that did not previously exist anyway (Phase 1-7 + Phase 9
全程零违规, verified by grep). Phase 10+ developers writing domain tests must
not import port types — type-erasure means doing so is unnecessary; in case of
genuine need, escalate via the ADR revision process (do not edit the lint rule
or the tsconfig references in passing PRs).

---

## [Phase 8] — 2026-04-26 — Adapter Layer Foundation

The first Phase that takes Tianqi from "architecturally sound but only runnable
in memory" to "architecture preserved + infrastructure landed". 19 Steps
across 5 Sprints (A–E) added 13 Adapter packages, 5 External Engine Ports, 26
new error codes, and 562 tests, while leaving every Phase 1-7 production layer
(domain / application / policy) byte-for-byte unchanged.

### Added

- **13 Adapter workspace packages** (workspace count: 8 → 21):
  - Sprint A: `@tianqi/adapter-testkit` (contract testing toolkit)
  - Sprint B: `@tianqi/event-store-{memory,sqlite,postgres}` (3 EventStore Adapters)
  - Sprint C: `@tianqi/notification-{memory,kafka}` (2 Notification Adapters)
  - Sprint D: `@tianqi/config-{memory,file}` (2 Config Adapters with hot-reload + history)
  - Sprint E: `@tianqi/external-engine-http-base` (HTTP infrastructure base) +
    5 business engines (`@tianqi/{margin,position,match,mark-price,fund}-engine-http`)
- **5 new External Engine Ports** in `packages/ports/` (first-time additions —
  Phase 1-7 contains no Engine Ports despite documented expectations; META-RULE A
  applied 4 times to bridge the gap):
  `MarginEnginePort` / `PositionEnginePort` / `MatchEnginePort` /
  `MarkPriceEnginePort` / `FundEnginePort`
- **26 new error codes** in two namespaces (`TQ-INF-002..018` — 15 codes for
  infrastructure failures; `TQ-CON-004..014` — 11 codes for contract / schema
  violations). Each code carries a distinct operator runbook; the seven
  `*_RESPONSE_SCHEMA_INVALID` codes (TQ-CON-005/008/009/010/011/012/013/014)
  are pairwise distinct under permanent test guard.
- **5 contract test families** in `@tianqi/adapter-testkit`:
  - `defineEventStoreContractTests` (21 it × 3 EventStore Adapters)
  - `definePersistentEventStoreContractTests` (12 persistent-only it for SQLite/Postgres)
  - `defineNotificationContractTests` (18 it × 2 Notification Adapters)
  - `defineConfigContractTests` (21 it × 2 Config Adapters)
  - `definePersistentConfigContractTests` (18 persistent-only it for config-file)
  - `defineExternalEngineContractTests` (21 it × 5 business engines + 1 base)
- **4 cross-Adapter integration test suites** at
  `packages/application/src/integration/` proving §3.7 Adapter substitution
  principle at runtime: same consumer code drives memory / sqlite / postgres
  EventStore Adapters; same drives memory / kafka Notification; same drives
  memory / file Config; multi-engine cooperation across all 5 business engines.
- **Vitest coverage gate** with `pnpm test:coverage`, threshold 80% lines /
  functions / statements + 75% branches per §9.3.

### Architecture

- **"Base + Business" two-layer pattern** for External Engine adapters
  (META-RULE O — the only special exception for Adapter-to-Adapter dependency):
  one base Adapter (`external-engine-http-base`) provides the five-pack
  stability stack (timeout / retry / circuit breaker / rate limit / trace
  propagation) on real undici; 5 business engines consume it via `workspace:*`
  with **zero stability code in the business layer** (verifiable by
  `grep "retry|timeout|circuit|rateLimit|backoff|sleep"` returning no hits in
  business-engine source).
- **1PC + compensation pattern** for Config Adapter activation (Step 11/12):
  in-memory active pointer commits first, audit append second; failure of the
  audit triggers active-pointer rollback + `TQ-CON-007`. The active pointer
  never outruns the audit trail.
- **Dual-path dispatch + originInstance self-loop suppression** for
  Notification Adapter (Step 8/9): in-process subscribers receive every
  publish but never their own publisher's messages.
- **Probe pattern** for adapter observability: branded read-only surfaces
  (e.g. `__externalEngineProbe: true`) exposed only via the testkit; production
  callers cannot import them. Six getter methods per probe — `getCircuitBreakerState`,
  `getCurrentConcurrency`, `getPeakConcurrency`, `getLastTraceId`,
  `getRetryStats`, `getLastCircuitTransitionAt`.
- **§3.7 Adapter substitution principle** enforced by Step 18 integration
  tests — same "thin application-layer-style consumer" function drives every
  Adapter in a swap family; only the factory differs.
- **400-599 timeout-value avoidance** (Step 14 §G): timeout milliseconds
  (200 / 300 / 1000) sit outside the 400-599 band so they cannot match the
  raw-HTTP-status leak guard regex `\b[45]\d\d\b`.

### Quality

- **Test count**: 1106 → **1668** (+562)
- **Aggregate coverage**: 85.97% lines / 79.78% branches / 94.86% functions /
  85.97% statements. Each metric clears the §9.3 gate (80% / 80% / 75% / 80%).
- **Workspace packages**: 8 → 21 (+13 Adapter packages)
- **Error codes**: 48 → 74 (+26 in TQ-INF and TQ-CON namespaces)
- **Production-layer changes**: zero (domain / application / policy untouched
  through all 19 Steps)

### Engineering Discipline

Phase 8 forged 14 meta-rules (A–P) and 2 conventions (K/L with revisions and
flexibility), each grown from a real conflict during the 19 Steps. Highlights:

- **META-RULE A** (existing fact wins) applied 7 times — Phase 1-7 documentation
  expected Engine Ports that did not actually exist; treated as first-time
  introductions rather than modifications.
- **META-RULE F** (Adapter-to-Adapter independence) hard-enforced across
  Sprint E's 5 business engines: zero cross-imports, zero shared helpers,
  zero shared mock instances.
- **META-RULE G** (third-party dependency intake) applied 6 times: better-sqlite3,
  pg, kafkajs, yaml, undici, @vitest/coverage-v8 — each justified against five
  conditions (license / maintenance / native build management / version pinning /
  no-handwrite-alternative).
- **META-RULE O** (base-Adapter privilege) introduced in Sprint E, applied
  exactly once (`external-engine-http-base`).
- **META-RULE P** (business-engine two-tier contract mount) applied 5 times,
  one per business engine.

The full 14 + 2 set is documented in `docs/decisions/0001-phase-8-adapter-layer.md`.

### Known Issues

5 items registered in `docs/KNOWN-ISSUES.md`, 4 currently open:

| ID        | Status           | Owning Phase      | Summary                                                                                                                                                                 |
| --------- | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KI-P8-001 | open             | Phase 9           | `domain` package line coverage at 75.16% (below per-package 80% expectation; aggregate still passes)                                                                    |
| KI-P8-002 | open             | Phase 11          | `event-store-postgres` + `notification-kafka` adapters skipped in CI without `TIANQI_TEST_*` env vars (Phase 8 §8.1 allows mock; Phase 11 mandates real infrastructure) |
| KI-P8-003 | open             | Phase 9 / 11      | Contract + integration tests occasionally flake under high parallelism (timing-sensitive 100 ms circuit-breaker reset assertions)                                       |
| KI-P8-004 | ✅ resolved      | Phase 8 / Step 19 | 6 Adapter packages had `rootDir: "."` + `dist/src/` indirection; Step 19 unified them to `rootDir: "src"` matching Sprint B-D pattern                                   |
| KI-P8-005 | N/A (structural) | —                 | `packages/ports/src/` 0% line coverage — pure type definitions are erased at build time, brand-constructor lines covered indirectly via consumers                       |

### References

- **Architecture Decision Record**: [`docs/decisions/0001-phase-8-adapter-layer.md`](docs/decisions/0001-phase-8-adapter-layer.md)
- **Phase 8 closure record**: [`docs/phase8/19-phase-8-closure.md`](docs/phase8/19-phase-8-closure.md)
- **Per-step execution records**: `docs/phase8/01-19` (19 documents, one per Step)
- **Phase 1 → 8 mapping**: [`docs/00-phase1-mapping.md`](docs/00-phase1-mapping.md)
- **Adapter registry**: [`packages/adapters/README.md`](packages/adapters/README.md)
- **Known issues**: [`docs/KNOWN-ISSUES.md`](docs/KNOWN-ISSUES.md)

### Compatibility

Phase 8 introduces **zero breaking changes** for Phase 1-7 consumers. Every
domain type, application port shape, policy contract, and Phase 1-7 error code
is preserved byte-for-byte. The 13 new Adapter packages are additive; nothing
in the existing application / domain / policy layers needed to import them.
Phase 9+ application code will begin consuming `EventStorePort` /
`NotificationPort` / `ConfigPort` directly — that work is explicitly out of
scope for Phase 8.

---

## [Phase 1-7] — Pre-2026-04 — Internal Consolidation

Phase 1-7 covered the domain model (risk-case / liquidation-case / adl-case
state machines), the application orchestrator with saga / replay / observability
harnesses, the policy bundle + config versioning system, the publish
preflight / rollback runbook, and the recovery display / audit framework. The
Phase 1-7 work product runs entirely in memory; Phase 8 introduces the
real-world adapter layer on top of that work product.

Phase 1-7 records are not back-filled into this CHANGELOG. They live in:

- `docs/00-phase1-mapping.md` — cross-Phase mapping
- `docs/phase{2,3,4,5,6,7}/` — per-Step execution records
