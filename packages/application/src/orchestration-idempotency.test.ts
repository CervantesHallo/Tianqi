import { describe, expect, it } from "vitest";
import { createOrchestrationIdempotencyRegistry } from "./orchestration-idempotency.js";

describe("Idempotency: registry", () => {
  it("accepts first request", () => {
    const reg = createOrchestrationIdempotencyRegistry();
    const key = { caseId: "c1", actionType: "execute", requestId: "r1" };
    const result = reg.check(key);
    expect(result.status).toBe("accepted");
    expect(result.previousOrchestrationId).toBeNull();
  });

  it("rejects duplicate after recording", () => {
    const reg = createOrchestrationIdempotencyRegistry();
    const key = { caseId: "c1", actionType: "execute", requestId: "r1" };
    reg.record(key, "orch-1");
    const result = reg.check(key);
    expect(result.status).toBe("duplicate_rejected");
    expect(result.previousOrchestrationId).toBe("orch-1");
  });

  it("accepts different request ids independently", () => {
    const reg = createOrchestrationIdempotencyRegistry();
    const k1 = { caseId: "c1", actionType: "execute", requestId: "r1" };
    const k2 = { caseId: "c1", actionType: "execute", requestId: "r2" };
    reg.record(k1, "orch-1");
    expect(reg.check(k2).status).toBe("accepted");
  });

  it("key string is stable and deterministic", () => {
    const reg = createOrchestrationIdempotencyRegistry();
    const key = { caseId: "case-42", actionType: "execute_orchestration", requestId: "req-abc" };
    const result = reg.check(key);
    expect(result.key).toBe("case-42::execute_orchestration::req-abc");
  });
});
