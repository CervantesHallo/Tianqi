// Phase 9 / Step 4 — 一行挂载基础契约：让 14 个契约 it 在内存实现上全绿
// 验证。memory Adapter 不挂载持久化契约——其语义由设计上不持久化。

import { defineDeadLetterStoreContractTests } from "@tianqi/adapter-testkit";

import { createInMemoryDeadLetterStore } from "./dead-letter-store-memory.js";

defineDeadLetterStoreContractTests("dead-letter-store-memory", () =>
  createInMemoryDeadLetterStore()
);
