# Infrastructure Placeholder — DEPRECATED

**Status**: DEPRECATED since Phase 8.

**Reason**: Phase 8 起，Tianqi 所有 Adapter（EventStore / Notification / Config / External Engine 等）统一落地到 `packages/adapters/*`，并共享 `@tianqi/adapter-testkit` 的契约测试套件。本目录从 Phase 1 / Step 1 起即为占位目录，未承载任何实际 Adapter 代码、未定义 `package.json` 的 build 脚本、未贡献任何测试用例。

**禁止行为**: 不得在本目录新增任何 TypeScript 源文件、`package.json` 脚本、测试文件或子目录。需要实现新的 Adapter，请在 `packages/adapters/` 下新建独立包。

**保留理由**: 本目录暂不删除，以避免扰动 Phase 1-7 封板期间遗留的目录结构历史。统一清理工作不在 Phase 8 范围内。

## 历史占位说明（Phase 1 / Step 1 原文）

This package is intentionally reserved for adapters that implement ports against
external systems such as databases, queues, cache layers, and RPC/HTTP clients.

Phase 1 / Step 1 does not include real adapter implementations.
