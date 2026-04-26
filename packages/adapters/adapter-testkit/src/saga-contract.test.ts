// Phase 9 / Step 2 — adapter-testkit 自测：把 defineSagaContractTests 套件
// 挂载到参考实现 ReferenceSagaSubject，验证 17 个 it 全绿。
//
// 自测用途：
//   - 证明 defineSagaContractTests 套件本身行为正确（断言能跑通参考实现）
//   - 锁定参考实现（fixtures/reference-saga.ts）的契约一致性
//   - Step 6 SagaOrchestrator 起草前，让"契约必须长这样"得到第三方实现验证
//
// 严格 testkit-only：本测试文件只导入 fixtures/reference-saga.js（同包内
// 路径），不通过 src/index.ts 导出 createReferenceSagaSubject（元规则 F）。

import { defineSagaContractTests } from "./saga-contract.js";
import { createReferenceSagaSubject } from "./fixtures/reference-saga.js";

defineSagaContractTests("reference-saga", () => createReferenceSagaSubject());
