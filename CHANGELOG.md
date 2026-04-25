# Changelog

All notable changes to Tianqi (天启) are documented in this file. The repository
uses Phase-based release cycles (Phase 1-7 conclude internally; Phase 8 onwards
is what an external reader can pick up). This file follows the spirit of
[Keep a Changelog](https://keepachangelog.com/) but is keyed by Phase rather
than semver.

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
