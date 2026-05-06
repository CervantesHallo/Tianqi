# Tianqi（天启）

> 让风控算法第一次变成工程师愿意读的代码

Tianqi is a TypeScript monorepo for **risk-control algorithm processing**. It is built phase by phase, with explicit contracts, replayable audit trails, pluggable policies, orchestrated saga execution, and a complete engineering infrastructure for production releases.

The project mission and engineering norms are documented in two top-level documents (kept locally, not in this public repository): the **Project Constitution** and the **Phase 8–12 Supplement**. New contributors should request access before opening their first PR.

---

## Quick Start

**Prerequisites**: Node.js `22.x` and pnpm `10.0.0` (managed via the `packageManager` field in `package.json` — `corepack enable` will pick it up automatically).

```bash
# Clone the repository
git clone https://github.com/CervantesHallo/Tianqi.git
cd Tianqi

# Install dependencies (frozen lockfile)
pnpm install --frozen-lockfile

# Build workspace dist outputs (required by tests; see KI-P10-002)
pnpm build

# Validate locally — four independent commands per Meta-rule Q v3
pnpm lint            # zero warnings
pnpm typecheck       # zero errors
pnpm test            # 1971 tests
pnpm test:coverage   # thresholds 84% lines / 75% branches / 84% functions / 84% statements
```

If any of the four commands fails on a fresh clone, that is a **bug** — please open an issue. CI runs the same four commands as parallel jobs (`.github/workflows/ci.yml`); local validation is your responsibility, CI is the safety net (per `CONTRIBUTING.md`).

## Engineering Infrastructure

Phase 10 delivered four interlocking pieces of engineering infrastructure:

| Layer | Status | Reference |
|---|---|---|
| CI strict gate (4 parallel jobs + 84% coverage) | ✅ | `.github/workflows/ci.yml` (Step 3 + 3.5) |
| Containerization (Dockerfile multi-stage + docker-compose) | ✅ | `Dockerfile` + `docker-compose.yml` (Step 4) |
| Release automation (`phase-*-closed` tag → draft GitHub Release) | ✅ | `.github/workflows/release.yml` (Step 5) |
| Documentation (this README + operations runbook) | ✅ | `docs/runbook.md` (Step 6) |

Full design rationale lives in [ADR-0003](./docs/decisions/0003-phase-10-engineering-and-collaboration.md). Phase 11+ will build real-infrastructure binding (PostgreSQL / Kafka adapters) on this foundation.

## Documentation Navigation

| Audience | Document |
|---|---|
| Contributors (PR process, validation, AI discipline) | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Operators / SREs (deployment, health, troubleshooting, rollback) | [`docs/runbook.md`](./docs/runbook.md) |
| Security researchers (private vulnerability reporting) | [`SECURITY.md`](./SECURITY.md) |
| Architecture decisions | [`docs/decisions/`](./docs/decisions/) |
| Phase progress index | [`docs/00-phase1-mapping.md`](./docs/00-phase1-mapping.md) |
| Open known issues | [`docs/KNOWN-ISSUES.md`](./docs/KNOWN-ISSUES.md) |
| Phase closure validation checklist | [`docs/closure-checklist.md`](./docs/closure-checklist.md) |
| Release history | [`CHANGELOG.md`](./CHANGELOG.md) |

## Phase Status

| Phase | Theme | Status | Tag |
|---|---|---|---|
| Phase 1–7 | Architecture skeleton (domain / application / policy / ports) | Closed | (no tags) |
| Phase 8 | Adapter layer foundation (13 Adapter packages + 5 Engine Ports) | Closed (ADR-0001 Accepted) | (no tag) |
| Phase 9 | Saga orchestration (4 business sagas + cross-saga coordination + §4.8 enforcement) | Closed (ADR-0002 Accepted) | `phase-9-closed` |
| Phase 10 | Engineering and collaboration foundation (CI / containerization / release / docs) | In Progress (ADR-0003) | (pending `phase-10-closed`) |
| Phase 11+ | Real infrastructure binding | Not started | — |

## Project Mission

Tianqi follows six design priorities, applied in order whenever they conflict:

1. **Readability > engineering tricks**
2. **Short paths > generic abstractions**
3. **Semantic clarity > performance micro-tuning**
4. **Comments explaining "why" > saving characters**
5. **Flat file structure > nested directories**
6. **Restraint > accumulation**

These priorities are enforced through phase-gated development, mandatory ADRs for architectural decisions, and a four-command validation discipline (`pnpm lint` / `typecheck` / `test` / `test:coverage` independently verified). See `CONTRIBUTING.md` and the local Constitution for the full set of rules.

## Code of Conduct

By contributing or participating in project spaces, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md), which adopts the Contributor Covenant version 2.1.

## License

License is not yet specified in this repository. Contributions are accepted under the assumption that the project will adopt a permissive open-source license (MIT or Apache-2.0) before any public release. See `CONTRIBUTING.md` and `SECURITY.md` for participation and reporting guidelines.

## Contact

For collaboration, see [`CONTRIBUTING.md`](./CONTRIBUTING.md). For security vulnerabilities, follow the private channel in [`SECURITY.md`](./SECURITY.md). For general questions, open a GitHub Discussion (preferred) or Issue.
