# Security Policy

## Supported Versions

Tianqi follows phase-based versioning (`phase-N-closed` git tags; see ADR-0003 workflow transition). The following phases receive security updates:

| Phase | Status | Tag |
|---|---|---|
| Phase 9 | Supported | `phase-9-closed` |
| Phase 10 | In Progress | (pending Step 7 closure) |

Phases 1–8 no longer receive security updates. Users are expected to upgrade to `phase-9-closed` or later.

## Reporting a Vulnerability

**Do not file public issues, pull requests, or discussions for security vulnerabilities.**

Use **[GitHub Private Vulnerability Reporting](https://github.com/CervantesHallo/Tianqi/security/advisories/new)**:

1. Navigate to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Submit a report including:
   - Affected version (Phase number, git tag, or commit SHA)
   - Description of the vulnerability
   - Steps to reproduce
   - Impact assessment (severity, affected operations)
   - Suggested fix or mitigation, if any

## Response Timeline

Tianqi is currently maintained by a single maintainer. Best-effort commitments:

- **Acknowledgement**: within 7 days of report
- **Initial assessment**: within 14 days
- **Fix or mitigation plan**: within 30 days for high-severity vulnerabilities

These timelines are commitments under best-effort, not contractual SLAs. They will be reviewed when the project moves to multi-maintainer governance.

## Disclosure Policy

After a fix is released:

- The reporter is credited in the published advisory unless anonymity is requested.
- A coordinated disclosure timeline is agreed upon between reporter and maintainer before any public discussion.
- Vulnerability details are published as a GitHub Security Advisory and referenced from the relevant Phase CHANGELOG entry.

## Out of Scope

The following are not handled under this Security Policy:

- Vulnerabilities in third-party dependencies — report to the upstream project.
- Configuration issues in user-controlled deployments (incorrect environment variables, mis-scoped credentials, etc.).
- Documentation typos or non-security bugs — use regular GitHub Issues.
- Performance issues that do not lead to denial-of-service or data integrity harm.

## High-Sensitivity Surface

The following components of Tianqi are considered high-severity when affected by a vulnerability. Reports touching these areas are prioritized:

- **Saga orchestration** (`packages/application/src/saga/`) — compensation correctness, double audit (per Phase 8–12 Supplement §15.1), reverse-order compensation invariants.
- **Manual intervention workflow** (`saga-manual-intervention.ts`) — privilege controls, dead-letter handling integrity.
- **Audit event sink** (`AuditEventSinkPort` consumers) — audit log integrity, tamper resistance.
- **Idempotency keys** (engine ports' `idempotencyKey` fields) — replay protection, request deduplication.
- **Persistence adapters** (`saga-state-store-*`, `dead-letter-store-*`, `event-store-*`) — durability guarantees, schema migration safety.

## Code of Conduct

Reports concerning conduct rather than security should be raised under the [Code of Conduct](./CODE_OF_CONDUCT.md). The same private channel may be used; please mark the report accordingly.
