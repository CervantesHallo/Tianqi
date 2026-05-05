# syntax=docker/dockerfile:1.7

# Tianqi Dockerfile — Phase 10 / Step 4
#
# Multi-stage build (per ADR-0003 Step 4 裁决 1 B + §7.5 容器化).
# Base: node:22-slim (per 裁决 2 β; alpine musl libc incompatible with
# better-sqlite3 11.5.0 prebuilt binaries — see Step 4 §C 实地核查).
# pnpm: read from package.json `packageManager` field (pnpm@10.0.0).
# Build chain: builder stage uses root `pnpm build` script (per 裁决 1 B
# build chain协调; §7.2 一致性严守; Step 3.5 教训严守 — no independent
# tsc command bypassing root script).

# ============================================================================
# Stage 1: builder — compile workspace dist outputs
# ============================================================================
FROM node:22-slim AS builder

WORKDIR /app

# Enable corepack so pnpm@10.0.0 (per packageManager field) resolves correctly
RUN corepack enable

# Copy lockfile + workspace metadata + tsconfig first to maximize Docker
# layer caching. tsconfig.json + tsconfig.base.json are needed by `pnpm build`
# (root script = tsc -b tsconfig.json).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY packages/ ./packages/

# Install all dependencies (dev included; required for build)
RUN pnpm install --frozen-lockfile

# Build workspace dist outputs (root script — §7.2 一致性 + Step 3.5)
RUN pnpm build

# ============================================================================
# Stage 2: runtime — minimal image with only what's needed at runtime
# ============================================================================
FROM node:22-slim AS runtime

WORKDIR /app

# Enable corepack (runtime may invoke pnpm-managed scripts in dev compose)
RUN corepack enable

# Copy build artifacts + node_modules from builder stage (per 裁决 3 B —
# avoid full monorepo source / tests / docs in runtime image; chown to
# `node` user up-front so non-root execution doesn't hit perm errors).
COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./
COPY --from=builder --chown=node:node /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=node:node /app/tsconfig.json ./
COPY --from=builder --chown=node:node /app/tsconfig.base.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages ./packages

# Switch to non-root `node` user (uid 1000) per 裁决 4 β.
# Using the base image's built-in user avoids creating an extra user
# (克制 + 业界 Node.js Dockerfile 标准实践).
USER node

# Health check (per 裁决 5 B; 库性质项目 — Tianqi 当前无 HTTP server entry).
# Phase 11+ 引入真实 HTTP server 时升级为 endpoint check.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD node -e "process.exit(0)"

# Default command keeps the container alive so it can be exec'd into for
# dev tasks (e.g. `docker compose run --rm tianqi pnpm build`).
# Phase 11+ replaces this with actual application entry point.
CMD ["node", "-e", "console.log('Tianqi container ready'); setInterval(() => {}, 1 << 30);"]
