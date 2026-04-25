// Phase 9 / Step 1 — saga-port.ts 内 brand 工厂的最小覆盖测试。
//
// saga-port.ts 90% 是擦除型 type / interface（编译产物 0 行运行时代码），
// 仅 createSagaId / createCorrelationId 两个 brand 工厂含运行时校验
// （trim + 非空断言）。本文件按 packages/shared/src/identifiers.test.ts
// 既定模式做最小烟雾测试，让两个工厂从 0% 覆盖率拉到 100%。
//
// 不在本文件做的事：
//   - 不测 SagaStep / SagaContext / SagaResult 等结构（Step 2 契约测试承担）
//   - 不测 SagaPortError 字段（Step 6 编排器实地集成测试承担）
//   - 不为 brand 工厂额外造场景（trim 行为已由 createTraceId 等姐妹工厂在
//     identifiers.test.ts 共同模式下证明，本测试只需证"行为一致")

import { describe, expect, it } from "vitest";

import { createCorrelationId, createSagaId } from "./saga-port.js";

describe("saga-port brand factories", () => {
  it("creates strongly-typed SagaId / CorrelationId", () => {
    const sagaId = createSagaId("saga-deleverage-acct-001");
    const correlationId = createCorrelationId("corr-2026-04-26-1234");
    expect(sagaId).toBe("saga-deleverage-acct-001");
    expect(correlationId).toBe("corr-2026-04-26-1234");
  });

  it("trims whitespace and rejects empty SagaId", () => {
    expect(createSagaId("  saga-1  ")).toBe("saga-1");
    expect(() => createSagaId("")).toThrow("SagaId must be a non-empty string");
    expect(() => createSagaId("   ")).toThrow("SagaId must be a non-empty string");
  });

  it("trims whitespace and rejects empty CorrelationId", () => {
    expect(createCorrelationId("  corr-1  ")).toBe("corr-1");
    expect(() => createCorrelationId("")).toThrow("CorrelationId must be a non-empty string");
    expect(() => createCorrelationId("   ")).toThrow("CorrelationId must be a non-empty string");
  });
});
