import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { InfrastructureError } from "./inf.js";
import { Phase8ContractError } from "./con.js";
import { SagaError } from "./sag.js";

describe("Phase 8 error namespaces: cross-namespace invariants", () => {
  it("assigns distinct layer identifiers per namespace", () => {
    const inf = new InfrastructureError(ERROR_CODES.ADAPTER_INITIALIZATION_FAILED, "a", {
      adapterName: "x",
      reason: "y"
    });
    const sag = new SagaError(ERROR_CODES.SAGA_STEP_TIMEOUT, "b", {
      stepId: "x",
      timeoutMs: 0
    });
    const con = new Phase8ContractError(ERROR_CODES.ADAPTER_CONTRACT_TEST_VIOLATION, "c", {
      adapterName: "x",
      suiteName: "y",
      reason: "z"
    });
    const layers = new Set([inf.layer, sag.layer, con.layer]);
    expect(layers.size).toBe(3);
  });

  it("does not share numeric slots between TQ-INF and TQ-SAG despite the same trailing 001", () => {
    expect(ERROR_CODES.INFRASTRUCTURE_UNAVAILABLE).toBe("TQ-INF-001");
    expect(ERROR_CODES.SAGA_STEP_TIMEOUT).toBe("TQ-SAG-001");
    expect(ERROR_CODES.INFRASTRUCTURE_UNAVAILABLE).not.toBe(ERROR_CODES.SAGA_STEP_TIMEOUT);
  });

  it("keeps every Phase 8 error code unique across the ERROR_CODES table", () => {
    const values = Object.values(ERROR_CODES);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
