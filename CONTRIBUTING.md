# Contributing to Tianqi

Thank you for considering contributing to Tianqi (天启). This document outlines the process and requirements for contributions.

## Project Mission

Tianqi is a risk-control algorithm codebase whose primary mission is **making risk-control algorithms the kind of code engineers actually want to read**. The project follows six design priorities, in order: readability > engineering tricks; short paths > generic abstractions; semantic clarity > performance micro-tuning; comments explaining "why" > saving characters; flat file structure > nested directories; restraint > accumulation.

## Before You Contribute

Tianqi has strict engineering discipline documented in two top-level documents kept locally (not in this public repository):

- **Project Constitution** (《Tianqi 项目架构与代码规范总文档》, 1106 lines) — authoritative engineering norms (architecture, type system, error handling, testing, PR review, AI collaboration)
- **Phase 8-12 Supplement** (《Tianqi Phase 8–12 架构与代码规范补充文档》, 537 lines) — phase-specific constraints (CI/CD, collaboration assets, coverage thresholds, doc synchronization)

New contributors must read both before opening a PR. The accumulated decisions are also visible through:

- `docs/decisions/` — Architecture Decision Records (ADR-0001 Phase 8, ADR-0002 Phase 9, ADR-0003 Phase 10)
- `docs/phaseN/` — Phase execution records
- `docs/00-phase1-mapping.md` — Phase progress index
- `docs/KNOWN-ISSUES.md` — Open known issues (5 carried over from Phase 8/9)
- `docs/closure-checklist.md` — Phase closure validation checklist (Step 0 forward-looking)

## PR Process

Per **Constitution §24**, every PR must include the seven sections in its description:

1. Background (背景)
2. Change Scope (变更范围)
3. Design Rationale (设计理由)
4. Contract Changes (契约变化)
5. Test Results (测试结果)
6. Risk Assessment (风险评估)
7. Rollback Plan (回滚方案)

Phase 10 onwards uses **feature branch + PR + reviewer approval** workflow (see `docs/decisions/0003-phase-10-engineering-and-collaboration.md` workflow transition section). Direct pushes to `main` are reserved for ADR meta-workflow documentation only.

Merge method: **merge commit** (preserve iteration history). Squash and rebase merges are not used; commit history is part of the engineering record.

### PR Template

When you open a PR, GitHub auto-loads `.github/PULL_REQUEST_TEMPLATE.md` containing the seven sections plus the four-command validation checklist. Fill all sections; do not delete the template structure.

Issue templates (`.github/ISSUE_TEMPLATE/`) are similarly auto-loaded. Security vulnerabilities are redirected to GitHub Private Vulnerability Reporting per `.github/ISSUE_TEMPLATE/config.yml`.

## Mandatory Validation (Meta-rule Q v3)

Before opening a PR, run all four commands **independently** and record each output:

```bash
pnpm lint            # zero warnings, zero errors
pnpm typecheck       # zero errors
pnpm test            # all tests green
pnpm test:coverage   # coverage thresholds (currently 84% lines starting Step 3)
```

Do not substitute a single command (e.g. `pnpm test:coverage`) for independent typecheck verification. This rule exists because of KI-P10-001: a Phase 9 closure defect where vitest's lenient type-checking masked 10 typecheck errors that escaped review. See `docs/closure-checklist.md` for the broader rationale.

## Commit Convention

Tianqi uses [Conventional Commits](https://www.conventionalcommits.org/). Examples from project history:

- `feat(application): add LiquidationSaga`
- `fix(test): align saga-end-to-end mock builders with Engine Port types`
- `docs(decisions): append ADR-0003 Step N section`
- `docs(known-issues): close KI-PXX-XXX after remediation`

## AI Collaboration Discipline

If using AI assistants to contribute, follow **Constitution §22** and **Phase 8-12 Supplement §13**. Prohibited behaviors include (non-exhaustive):

- Skipping module boundaries for convenience
- Concealing poor design with comments
- Bypassing tests or test fixtures
- Breaking interface contracts without ADR-level disclosure
- Substituting partial validation for full validation

Honest assessment is a core engineering discipline: when results don't meet expectations, document the gap rather than rephrasing the claim.

## Code of Conduct

By contributing, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

To report a security vulnerability, follow the process in [SECURITY.md](./SECURITY.md). **Do not file public issues for security concerns.**

## Questions

For questions not covered here, open a GitHub Discussion (preferred) or Issue.
