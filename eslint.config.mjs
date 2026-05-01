import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import eslintConfigPrettier from "eslint-config-prettier";

// Phase 9 / Step 15 — §4.8 编译期硬约束：domain 不依赖 Port。
//
// 历史背景：Phase 1-7 + Phase 9 全程通过纪律遵守《补充文档》§4.8（"领域层
// 不得依赖任何 Port 接口"）；Step 15 把纪律升级为机制 —— ESLint
// no-restricted-imports（开发时即时反馈 / IDE 红线）+ TypeScript project
// references 隔离（CI 强制保证；packages/domain/tsconfig.json 不 reference
// packages/ports）双重保护。
//
// 设计裁决（详见 docs/decisions/0002 Step 15 段 + docs/phase9/15）：
//   - 裁决 1 (C 双重保护)：lint + typecheck 双闸；单一机制易被绕过
//   - 裁决 2 (α 全仓 root)：规则集中管理 + 与既有 7 条规则同位置
//   - 裁决 4 (三类被约束 import 模式)：包名 / 子路径 / *-port 文件名
//   - 裁决 5 (domain 包全部代码)：src + tests 都受约束
//
// 错误信息含 "§4.8" 引用是 R1 硬要求 —— 让未来违规者一眼看出约束来源。
//
// 元规则 B 在 ESLint 配置层级（自 Step 15 起）：本规则一旦发布即冻结；
// 后续 Step 任何调整必须经 ADR-0002 修订流程。

const SECTION_4_8_VIOLATION_MESSAGE =
  "domain layer must not depend on ports (Phase 9 §4.8 hard compile-time constraint; " +
  "see docs/decisions/0002-phase-9-saga-orchestration.md Step 15)";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.d.ts"]
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "no-unused-vars": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error"
    }
  },
  // §4.8 编译期硬约束（Step 15 引入；元规则 B 锁定）
  // ----------------------------------------------------------
  // 仅作用于 packages/domain 包内全部 .ts 文件。三类被约束 import 模式：
  //   1. @tianqi/ports 包名（含子路径 @tianqi/ports/*）
  //   2. 任何相对路径含 "ports" 段（防御 monorepo 内相对路径绕过；
  //      譬如 ../../ports / ../../../packages/ports）
  //   3. 任何 *-port / *-port.js / *-port.ts 文件名 import（防御非标准
  //      命名譬如直接 import port 类型文件而非 @tianqi/ports 桶文件）
  //
  // 错误信息含 "§4.8" 引用 + ADR Step 15 路径 —— 让未来违规者一眼看出
  // 约束来源 + 修订路径。
  {
    files: ["packages/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@tianqi/ports", "@tianqi/ports/*"],
              message: SECTION_4_8_VIOLATION_MESSAGE
            },
            {
              group: ["**/ports", "**/ports/*", "**/ports/**"],
              message: SECTION_4_8_VIOLATION_MESSAGE
            },
            {
              group: ["**/*-port", "**/*-port.js", "**/*-port.ts"],
              message: SECTION_4_8_VIOLATION_MESSAGE
            }
          ]
        }
      ]
    }
  },
  eslintConfigPrettier
];
