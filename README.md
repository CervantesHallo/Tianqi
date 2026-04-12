<p align="center">
  <img src="./assets/tianqi-logo.png" alt="Tianqi logo" width="220" />
</p>

<h1 align="center">Tianqi</h1>

<p align="center">
  <strong>An elegant TypeScript engine for risk-case orchestration, replayable auditing, observability, and production release guardrails.</strong>
</p>

<p align="center">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white">
  <img alt="Tests" src="https://img.shields.io/badge/tests-1106%20passed-brightgreen">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
</p>

---

## What is Tianqi?

Tianqi is a modular TypeScript system for **risk-case processing in trading scenarios**. It is designed around a strict architecture with explicit contracts, replayable audit trails, pluggable policies, orchestrated execution paths, observability primitives, and production release guardrails.

The project was built phase by phase, with each phase ending in freeze checks, regression tests, and acceptance gates.

---

## Highlights

### Core case system
- `RiskCase`, `LiquidationCase`, and `ADLCase` domain flows
- explicit state transitions and transition guards
- structured audit records for creation, transition, coordination, and resolution

### Pluggable policy engine
- `RankingPolicy`
- `FundWaterfallPolicy`
- `CandidateSelectionPolicy`
- policy descriptors with `type / name / version`
- policy bundle resolution, prevalidation, and dry-run
- configuration version activation and rollback

### Application orchestration
- RiskCase orchestration path
- LiquidationCase orchestration path
- saga skeleton with compensation semantics
- idempotency guards and replayed-result handling
- audit-event publishing through explicit ports

### Audit and replay
- append-only audit event store boundary
- single-case replay and batch replay
- case reconstruction skeleton
- replay baseline snapshots and replay consistency checks

### Observability and fault drills
- trace context propagation
- structured metrics contract
- benchmark harness for key paths
- fault-injection scenarios for timeout, duplicate, out-of-order, and partial-write cases

### Production guardrails
- publish preflight checks
- contract freeze baseline
- rollback plan skeleton
- runbook and incident-manual readiness
- acceptance gate, final acceptance, and close-decision flow

---

## Project status

**Tianqi Phase 1–7: CLOSED**

All seven planned phases are complete and frozen.

| Phase | Theme | Status |
|---|---|---|
| Phase 1 | Skeleton | CLOSED |
| Phase 2 | Core case flows | CLOSED |
| Phase 3 | Pluggable policies | CLOSED |
| Phase 4 | Execution orchestration | CLOSED |
| Phase 5 | Audit and replay | CLOSED |
| Phase 6 | Observability and fault drills | CLOSED |
| Phase 7 | Production release guardrails | CLOSED |

### Final verification snapshot
- **Test files:** 106
- **Tests passed:** 1106
- **All phases:** closed

---

## Architecture

Tianqi follows a layered monorepo structure.

```text
Tianqi/
├─ assets/                 # logo and static assets
├─ docs/                   # phase documents and project mapping
├─ packages/
│  ├─ contracts/           # shared error codes and published contract boundaries
│  ├─ shared/              # identifiers and common primitives
│  ├─ domain/              # domain models, state machines, invariants
│  ├─ ports/               # repository and infrastructure-facing interfaces
│  ├─ policy/              # pluggable strategies and config versioning
│  └─ application/         # orchestration, replay, observability, release guards
├─ package.json
├─ pnpm-workspace.yaml
└─ vitest.config.ts

Layering rules
	•	Domain owns business states, invariants, and transition rules.
	•	Policy owns strategies, descriptors, bundles, and config versioning.
	•	Application owns orchestration, replay, observability, and release readiness.
	•	Ports define external collaboration boundaries.
	•	Adapters are intentionally thin and can be attached later.

⸻

Design goals

1. Strong contracts

Everything important is explicit:
	•	identifiers
	•	command models
	•	result models
	•	policy descriptors
	•	error codes
	•	event schemas
	•	release guard artifacts

2. Replayability by construction

Any meaningful state change should leave behind enough information to:
	•	audit what happened
	•	replay what happened
	•	reconstruct case outcomes
	•	compare expected and actual replay results

3. Safe extensibility

New strategies, adapters, or orchestration paths should be introducible without breaking the core semantics.

4. Release safety

Configuration changes, contract drift, rollback readiness, and runbook completeness should all be checked before release.

⸻

Repository scope

Tianqi is architecture-complete, but some integrations are intentionally adapter-based or in-memory by design.

This repository is well-suited for:
	•	architecture review
	•	collaborative development
	•	local development and test environments
	•	GitHub publication and open-source presentation
	•	extension into production adapters

What is still adapter-based

Depending on your deployment target, you may still want to wire in:
	•	persistent storage implementations
	•	external configuration center integration
	•	real monitoring / alerting backends
	•	release automation integration
	•	deployment secrets and environment management
	•	real rollback execution adapters

⸻

Getting started

Requirements
	•	Node.js 20+
	•	pnpm 9+

Install

pnpm install

Type check

pnpm typecheck

Lint

pnpm lint

Test

pnpm test

Run all core checks

pnpm lint && pnpm typecheck && pnpm test


⸻

Example capability map by phase

Phase	Main outcome
Phase 1	package skeleton, contracts, shared identifiers, baseline structure
Phase 2	core case models, state machines, coordination, repair and diagnostic flows
Phase 3	pluggable strategy interfaces, bundle resolution, config activation and rollback
Phase 4	orchestrators, saga skeletons, idempotency, audit-event publishing
Phase 5	event store, replay, reconstruction, replay baseline and acceptance flow
Phase 6	tracing, metrics, benchmark harness, fault drills, observability acceptance flow
Phase 7	release preflight, contract freeze baseline, rollback plan, runbook readiness, final close


⸻

Testing philosophy

Tianqi was built with regression-friendly engineering in mind.

The test suite validates:
	•	domain transition legality
	•	policy bundle resolution correctness
	•	orchestration and replay semantics
	•	trace / metrics / benchmark consistency
	•	fault drill handling
	•	release preflight and final close logic

The project favors:
	•	explicit invariants
	•	structured results over implicit behavior
	•	baseline snapshots and gate-style checks
	•	synchronized code and documentation changes

⸻

What Tianqi is not

Tianqi is not currently:
	•	a UI product
	•	a hosted SaaS
	•	a finished deployment platform
	•	a complete CI/CD release system
	•	a production dashboard

It is a high-discipline core engine and architecture base for building safer risk-processing systems.

⸻

Contributing

Contributions are welcome, but changes should preserve the project’s architectural discipline.

Please keep these rules in mind:
	•	do not bypass explicit ports
	•	do not blur domain, policy, and application responsibilities
	•	do not introduce incompatible contract drift casually
	•	add tests and docs for meaningful behavior changes
	•	keep risk, rollback, and compatibility implications explicit

⸻

License

This project is released under the MIT License.

⸻

Project description

An elegant TypeScript engine for risk-case orchestration, replayable auditing, observability, and production release guardrails.
