// Phase 9 / Step 3 — 一行挂载基础契约：让 13 个契约 it 在内存实现上全绿
// 验证。memory Adapter 不挂载持久化契约——其语义由设计上不持久化。

import { defineSagaStateStoreContractTests } from "@tianqi/adapter-testkit";

import { createInMemorySagaStateStore } from "./saga-state-store-memory.js";

defineSagaStateStoreContractTests("saga-state-store-memory", () =>
  createInMemorySagaStateStore()
);
