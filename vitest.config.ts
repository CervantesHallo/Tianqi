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
      // Phase 8 CLOSED gate per §9.3: 80% lines / functions / statements; branches
      // typically lag by ~5pp due to defensive validation paths so 75% is the
      // realistic floor. Numbers can be revisited at Step 19 ADR if Phase 8 ends
      // up significantly higher than 80% across the board.
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  }
});
