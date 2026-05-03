<!-- Tianqi PR Template — auto-loaded when you open a PR.
Fill all seven sections per Constitution §24.1. Do not delete section headers. -->

## 1. Background

<!-- What problem does this PR solve? Reference Phase / Step / Issue / KI if applicable. -->

## 2. Change Scope

<!-- List affected modules, contracts, events, configs, tests, docs. -->

## 3. Design Rationale

<!-- Why this approach? Per Constitution §27, prioritize: correctness > auditability >
state machine clarity > contract stability > maintainability > performance > speed. -->

## 4. Contract Changes

<!-- Any changes to public types, error codes, event schemas, API DTOs?
Mark version impact: [breaking] / [additive] / [internal-only] / [none]. -->

## 5. Test Results

Run all four commands **independently** and paste actual output (per Meta-rule Q v3
template; do not substitute a single command for independent typecheck verification —
see KI-P10-001 in `docs/closure-checklist.md`):

- [ ] `pnpm lint` — zero warnings
- [ ] `pnpm typecheck` — zero errors
- [ ] `pnpm test` — all green; test count not decreased
- [ ] `pnpm test:coverage` — meets phase threshold

## 6. Risk Assessment

<!-- What could break? Concurrency, idempotency, state machine, contract compatibility,
performance regression, persistence durability? -->

## 7. Rollback Plan

<!-- How to revert if needed? Commit SHAs to revert? Order? Any data migration concern? -->

---

## Phase / Step Mapping (if applicable)

<!-- Phase: e.g. Phase 10 / Step 2
     ADR: e.g. docs/decisions/0003-* §Step 2
     KI affected: e.g. closes KI-P10-001 / new KI-P10-002 -->

## Checklist

- [ ] Read [CONTRIBUTING.md](../CONTRIBUTING.md) and Constitution §22 / §24
- [ ] Documentation updated in same PR (per Constitution §12.1)
- [ ] No third-party dependencies added without explicit justification (Meta-rule P)
- [ ] Conventional Commits format followed
- [ ] Branch named `claude/phase-N-step-M-<topic>` or similar
- [ ] Merge method will be **merge commit** (preserve iteration history per ADR-0003)
