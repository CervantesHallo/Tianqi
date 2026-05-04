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
      // Phase 10 / Step 3 升级 per ADR-0003 K.2 锁定 84% 起步路径.
      // lines / functions / statements 升至 84 (current 84.92% / 91.68% /
      // 84.92% all safely above; functions 91.68% remains safely above 84).
      // branches keep 75 因 KI-P8-005 结构性现象 (current 79.5%-79.58% 距
      // 75% 仅 4.5pp; v8 statistical noise 可能让 branches 偶发跌破 84%
      // 即便实际测试覆盖未变). Step 7 收官升级 85% 时再次审视 branches
      // 是否可同步升级.
      thresholds: {
        lines: 84,
        functions: 84,
        branches: 75,
        statements: 84
      }
    }
  }
});
