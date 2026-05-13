import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    // Step 18 first-time coverage configuration. §9.3 红线: include must be the
    // 80%-coverage scope (domain / application / policy / ports / adapters/*),
    // exclude must keep adapter-testkit OUT (it's a test infra package; counting
    // its contract suites toward the threshold would mask real coverage gaps in
    // the production layers).
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "packages/domain/src/**",
        "packages/application/src/**",
        "packages/policy/src/**",
        "packages/ports/src/**",
        "packages/adapters/*/src/**"
      ],
      exclude: [
        // Step 18 reading of §9.3: testkit's own code is contract scaffolding, not
        // production logic; including it would inflate the % and let real domain
        // gaps slip below the gate. Keep it out.
        "packages/adapters/adapter-testkit/**",
        // All test files / fixtures / barrels are excluded from the numerator.
        "**/*.test.ts",
        "**/*.contract.test.ts",
        "**/*.persistent.test.ts",
        "**/*.integration.test.ts",
        "**/test/**",
        "**/fixtures/**",
        // Step 19 KI-P8-004 cleanup: with test files moved to src/, test-only
        // helpers (e.g. mock-downstream-server) live in src/helpers/. Excluding
        // that subdir keeps the coverage denominator on production code only.
        "**/helpers/**",
        "**/dist/**",
        "**/node_modules/**",
        // Re-export-only barrels carry no logic to cover.
        "**/index.ts"
      ],
      // Phase 10 / Step 7 收官升级 per ADR-0003 K.2 锁定路径 B (5-10 测试
      // 增量 + thresholds 升级). lines / functions / statements 84 → 85
      // (current 85.00% / 91.68% / 85.00% post-Step-7 boundary tests).
      // branches keep 75 因 KI-P8-005 结构性现象 — current 79.65% 距 75%
      // 4.65pp 安全裕度; Phase 11+ 真实基础设施测试引入后再评估 branches
      // 是否升级 80+. lines/statements 安全裕度紧 (85.00% exactly at
      // threshold; ~22905/26945 covered) — Phase 11+ 承接进一步覆盖率
      // 提升若 v8 噪声偶发让 CI 红色.
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85
      }
    }
  }
});
