# Tianqi Runbook

This runbook documents operational procedures for running Tianqi in container environments. It covers the five required topics from Phase 8–12 Supplement §12.4: deployment, configuration, health check, troubleshooting, and rollback.

The current Phase 10 baseline is a **library-mode container** (no HTTP server, no runtime infrastructure dependencies). Phase 11+ will introduce real-infrastructure binding and upgrade this runbook accordingly.

## 1. Deployment

### Container Build

```bash
docker build -t tianqi:phase-N-closed .
```

Build duration is ~1–2 minutes (Step 4 实测 ~1m 42s on a baseline laptop). The runtime image is ~500 MB (Step 4 实测 508 MB), which includes dev dependencies because builder-stage `node_modules` is copied to the runtime stage. Phase 11+ may shrink this with `pnpm deploy` / `pnpm prune --prod`.

### Container Run

```bash
docker run -d \
  --name tianqi-prod \
  tianqi:phase-N-closed
```

The Dockerfile sets `USER node` (uid 1000; non-root), exposes the workspace under `/app`, and keeps the container alive with a placeholder `setInterval` so operators can `docker exec` for ad-hoc tasks (Phase 11+ replaces this with a real entry point).

### docker-compose (development)

```bash
docker compose up -d                                    # bring up the tianqi service
docker compose run --rm tianqi pnpm test                # run tests inside the container
docker compose run --rm tianqi node --version           # verify runtime
docker compose down                                     # tear down
```

The compose file currently orchestrates a single service (per ADR-0003 Step 4 裁决 6 α). Real-infra services (PostgreSQL / Kafka) are deferred to Phase 11.

## 2. Configuration

Tianqi has **no required runtime configuration files** at the Phase 10 baseline. The following environment variables are *declared* (used by Adapter contract tests) but not yet runtime-required:

- `TIANQI_TEST_POSTGRES_URL` — PostgreSQL connection string for `event-store-postgres` / `saga-state-store-postgres` / `dead-letter-store-postgres` adapters (KI-P8-002)
- `TIANQI_TEST_KAFKA_BROKERS` — Kafka brokers for `notification-kafka` adapter (KI-P8-002)

See `KNOWN-ISSUES.md` for the current state. Phase 11+ will bind these to real infrastructure and add deployment configuration.

## 3. Health Check

The Dockerfile defines a built-in health probe:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "process.exit(0)"
```

This is a **library-mode probe** — it verifies that the Node runtime is still reachable inside the container. There is no HTTP endpoint to hit because Tianqi at Phase 10 has no application server (per ADR-0003 Step 4 裁决 5 B).

Verify health:

```bash
docker inspect --format='{{.State.Health.Status}}' tianqi-prod
# Expected: healthy (after the first ~30s interval)
```

Phase 11+ will replace the probe with a real HTTP `/health` endpoint when the application server is introduced.

## 4. Troubleshooting

### Container fails to start

```bash
docker info                          # is the daemon running?
docker images tianqi:phase-N-closed  # was the image built and tagged correctly?
docker logs tianqi-prod              # what did the container print?
```

### Health check stays "starting" or flips to "unhealthy"

```bash
docker ps --filter name=tianqi-prod
docker inspect --format='{{json .State.Health.Log}}' tianqi-prod | jq .
```

If the probe is failing, the most likely cause at the Phase 10 baseline is a corrupt or incomplete image. Rebuild with `docker build --no-cache .` and re-deploy.

### `docker compose up` fails

```bash
docker compose down              # clean previous container + network
docker compose up -d --build     # force rebuild
docker compose logs tianqi       # inspect output
```

### CI fails on `pnpm test` after a fresh CI run

If a contributor's CI fails on `pnpm test` while local passes, the root cause is almost always the dist-based workspace issue tracked by KI-P10-002 (RESOLVED in Step 3.5). Verify `package.json` `test` script still includes the `pnpm build &&` prefix; CI's `test` and `coverage` jobs must include a `pnpm build` step. See ADR-0003 Step 3.5.

## 5. Rollback

### Roll back the container

```bash
docker stop tianqi-prod
docker rm tianqi-prod
docker run -d --name tianqi-prod tianqi:phase-PREV-closed
```

`phase-PREV-closed` is the previous milestone tag (e.g. roll back from `phase-10-closed` to `phase-9-closed`).

### Roll back a release

A `phase-*-closed` tag is intentionally **immutable** — rewriting tag history is not a supported operation. If a release was published in error:

1. Mark the GitHub Release as a pre-release or delete it via the GitHub UI (Settings → Releases → Edit / Delete).
2. Push a corrective tag with a small suffix (e.g. `phase-N-closed-fix1`) and run a fresh release through `release.yml` with corrected `CHANGELOG.md` notes.
3. Document the rollback in the next ADR entry so the chain of decisions stays auditable.

## References

- [`ADR-0003`](./decisions/0003-phase-10-engineering-and-collaboration.md): Phase 10 engineering infrastructure design (Step 0 / 1 / 2 / 3 / 3.5 / 4 / 5 / 6)
- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): CI strict gate (4 parallel jobs)
- [`.github/workflows/release.yml`](../.github/workflows/release.yml): Release automation (gh CLI + draft Release)
- [`Dockerfile`](../Dockerfile): Multi-stage build (builder + runtime; Node 22-slim)
- [`docker-compose.yml`](../docker-compose.yml): Single-service development orchestration
- [`KNOWN-ISSUES.md`](./KNOWN-ISSUES.md): Open issues including KI-P8-002 (real-infra adapter coverage gap)
